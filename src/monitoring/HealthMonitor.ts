import type { ServerRegistration, ServerHealth } from '../types/server.ts';
import type { HealthConfig } from '../types/config.ts';
import { HealthStatus } from '../types/server.ts';
import { ServerRegistry } from '../registry/ServerRegistry.ts';
import { BackendMcpClient } from '../client/BackendMcpClient.ts';

/**
 * Health monitoring service for backend MCP servers.
 * Runs periodic health checks and updates server status in registry.
 */
export class HealthMonitor {
  private intervalId: number | null = null;
  private lastCheckTime: Date | null = null;
  private checkInProgress: boolean = false;

  constructor(
    private registry: ServerRegistry,
    private client: BackendMcpClient,
    private config: HealthConfig
  ) {}

  /**
   * Start periodic health monitoring
   */
  start(): void {
    if (this.intervalId !== null) {
      console.log('Health monitor already running');
      return;
    }

    console.log(`Starting health monitor (interval: ${this.config.checkInterval}ms)`);

    // Run initial check immediately
    this.runHealthChecks();

    // Schedule periodic checks
    this.intervalId = setInterval(() => {
      this.runHealthChecks();
    }, this.config.checkInterval) as unknown as number;
  }

  /**
   * Stop health monitoring
   */
  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Health monitor stopped');
    }
  }

  /**
   * Check if monitor is running
   */
  isRunning(): boolean {
    return this.intervalId !== null;
  }

  /**
   * Get last check time
   */
  getLastCheckTime(): Date | null {
    return this.lastCheckTime;
  }

  /**
   * Run health checks for all servers
   */
  async runHealthChecks(): Promise<void> {
    if (this.checkInProgress) {
      console.log('Health check already in progress, skipping');
      return;
    }

    this.checkInProgress = true;
    this.lastCheckTime = new Date();

    const servers = this.registry.listServers();
    console.log(`Running health checks for ${servers.length} servers`);

    const results = await Promise.allSettled(
      servers.map((server) => this.checkServer(server))
    );

    // Log summary
    const healthy = results.filter(
      (r) => r.status === 'fulfilled' && r.value.status === HealthStatus.HEALTHY
    ).length;
    const degraded = results.filter(
      (r) => r.status === 'fulfilled' && r.value.status === HealthStatus.DEGRADED
    ).length;
    const down = results.length - healthy - degraded;

    console.log(`Health check complete: ${healthy} healthy, ${degraded} degraded, ${down} down`);

    this.checkInProgress = false;
  }

  /**
   * Check a single server and update its health status
   */
  private async checkServer(server: ServerRegistration): Promise<ServerHealth> {
    try {
      const health = await this.client.checkHealth(server);

      // Determine final status based on consecutive failures
      let finalStatus = health.status;
      if (
        health.status !== HealthStatus.HEALTHY &&
        health.consecutiveFailures >= this.config.unhealthyThreshold
      ) {
        finalStatus = HealthStatus.DOWN;
      }

      const finalHealth: ServerHealth = {
        ...health,
        status: finalStatus,
      };

      // Update registry
      this.registry.updateHealth(server.id, finalHealth);

      if (finalStatus !== HealthStatus.HEALTHY) {
        console.warn(
          `Server ${server.id} health: ${finalStatus} (failures: ${health.consecutiveFailures})`
        );
      }

      return finalHealth;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Health check failed for ${server.id}:`, errorMessage);

      const failedHealth: ServerHealth = {
        status: HealthStatus.DOWN,
        lastCheck: new Date(),
        latency: 0,
        consecutiveFailures: server.health.consecutiveFailures + 1,
        errorMessage,
      };

      this.registry.updateHealth(server.id, failedHealth);

      return failedHealth;
    }
  }

  /**
   * Force an immediate health check for a specific server
   */
  async checkServerNow(serverId: string): Promise<ServerHealth | null> {
    const server = this.registry.getServer(serverId);
    if (!server) {
      console.warn(`Server not found: ${serverId}`);
      return null;
    }

    return await this.checkServer(server);
  }

  /**
   * Get health status summary
   */
  getHealthSummary(): {
    lastCheck: Date | null;
    isRunning: boolean;
    checkInterval: number;
    servers: Array<{
      id: string;
      name: string;
      status: string;
      lastCheck: Date;
      latency: number;
      consecutiveFailures: number;
      errorMessage?: string;
    }>;
  } {
    const servers = this.registry.listServers().map((server) => ({
      id: server.id,
      name: server.name,
      status: server.health.status,
      lastCheck: server.health.lastCheck,
      latency: server.health.latency,
      consecutiveFailures: server.health.consecutiveFailures,
      errorMessage: server.health.errorMessage,
    }));

    return {
      lastCheck: this.lastCheckTime,
      isRunning: this.isRunning(),
      checkInterval: this.config.checkInterval,
      servers,
    };
  }
}
