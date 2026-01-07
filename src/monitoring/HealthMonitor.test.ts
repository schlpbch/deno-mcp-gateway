import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { HealthStatus, TransportType } from '../types/server.ts';
import type { ServerRegistration, ServerHealth } from '../types/server.ts';
import type { HealthConfig } from '../types/config.ts';

/**
 * Tests for HealthMonitor functionality
 */

function createMockServer(
  id: string,
  healthStatus: HealthStatus = HealthStatus.UNKNOWN,
  consecutiveFailures: number = 0
): ServerRegistration {
  return {
    id,
    name: `Test Server ${id}`,
    endpoint: `https://${id}.example.com/mcp`,
    transport: TransportType.HTTP,
    capabilities: {
      tools: ['tool1'],
      resources: [],
      prompts: [],
    },
    health: {
      status: healthStatus,
      lastCheck: new Date(),
      latency: 100,
      consecutiveFailures,
    },
    priority: 1,
    registeredAt: new Date(),
  };
}

function createMockConfig(): HealthConfig {
  return {
    checkInterval: 60000, // 1 minute
    unhealthyThreshold: 3,
  };
}

// Mock registry for testing
class MockRegistry {
  private servers: Map<string, ServerRegistration> = new Map();

  register(server: ServerRegistration): void {
    this.servers.set(server.id, server);
  }

  getServer(id: string): ServerRegistration | undefined {
    return this.servers.get(id);
  }

  listServers(): ServerRegistration[] {
    return Array.from(this.servers.values());
  }

  updateHealth(id: string, health: ServerHealth): void {
    const server = this.servers.get(id);
    if (server) {
      server.health = health;
    }
  }

  clear(): void {
    this.servers.clear();
  }
}

// Mock client for testing
class MockClient {
  public healthResults: Map<string, ServerHealth> = new Map();
  public shouldThrow: Map<string, boolean> = new Map();

  setHealthResult(serverId: string, health: ServerHealth): void {
    this.healthResults.set(serverId, health);
  }

  setShouldThrow(serverId: string, shouldThrow: boolean): void {
    this.shouldThrow.set(serverId, shouldThrow);
  }

  async checkHealth(server: ServerRegistration): Promise<ServerHealth> {
    if (this.shouldThrow.get(server.id)) {
      throw new Error(`Health check failed for ${server.id}`);
    }

    return (
      this.healthResults.get(server.id) || {
        status: HealthStatus.HEALTHY,
        lastCheck: new Date(),
        latency: 50,
        consecutiveFailures: 0,
      }
    );
  }
}

// Testable health monitor
class TestableHealthMonitor {
  private lastCheckTime: Date | null = null;
  private checkInProgress: boolean = false;

  constructor(
    private registry: MockRegistry,
    private client: MockClient,
    private config: HealthConfig
  ) {}

  getLastCheckTime(): Date | null {
    return this.lastCheckTime;
  }

  async runHealthChecks(): Promise<void> {
    if (this.checkInProgress) {
      return;
    }

    this.checkInProgress = true;
    this.lastCheckTime = new Date();

    const servers = this.registry.listServers();

    await Promise.allSettled(
      servers.map((server) => this.checkServer(server))
    );

    this.checkInProgress = false;
  }

  private async checkServer(server: ServerRegistration): Promise<ServerHealth> {
    try {
      const health = await this.client.checkHealth(server);

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

      this.registry.updateHealth(server.id, finalHealth);
      return finalHealth;
    } catch (error) {
      const failedHealth: ServerHealth = {
        status: HealthStatus.DOWN,
        lastCheck: new Date(),
        latency: 0,
        consecutiveFailures: server.health.consecutiveFailures + 1,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      };

      this.registry.updateHealth(server.id, failedHealth);
      return failedHealth;
    }
  }

  getHealthSummary(): {
    lastCheck: Date | null;
    servers: Array<{
      id: string;
      status: string;
      consecutiveFailures: number;
    }>;
  } {
    return {
      lastCheck: this.lastCheckTime,
      servers: this.registry.listServers().map((server) => ({
        id: server.id,
        status: server.health.status,
        consecutiveFailures: server.health.consecutiveFailures,
      })),
    };
  }
}

// ================== HEALTH MONITOR TESTS ==================

Deno.test('HealthMonitor - runHealthChecks updates server health', async () => {
  const registry = new MockRegistry();
  const client = new MockClient();
  const config = createMockConfig();
  const monitor = new TestableHealthMonitor(registry, client, config);

  registry.register(createMockServer('server-1', HealthStatus.UNKNOWN));

  client.setHealthResult('server-1', {
    status: HealthStatus.HEALTHY,
    lastCheck: new Date(),
    latency: 50,
    consecutiveFailures: 0,
  });

  await monitor.runHealthChecks();

  const server = registry.getServer('server-1');
  assertEquals(server?.health.status, HealthStatus.HEALTHY);
});

Deno.test('HealthMonitor - marks server DOWN after threshold failures', async () => {
  const registry = new MockRegistry();
  const client = new MockClient();
  const config = createMockConfig();
  config.unhealthyThreshold = 3;
  const monitor = new TestableHealthMonitor(registry, client, config);

  registry.register(createMockServer('server-1', HealthStatus.UNKNOWN, 2));

  // Return degraded with 3 consecutive failures (meets threshold)
  client.setHealthResult('server-1', {
    status: HealthStatus.DEGRADED,
    lastCheck: new Date(),
    latency: 500,
    consecutiveFailures: 3,
  });

  await monitor.runHealthChecks();

  const server = registry.getServer('server-1');
  assertEquals(server?.health.status, HealthStatus.DOWN);
});

Deno.test('HealthMonitor - keeps DEGRADED if below threshold', async () => {
  const registry = new MockRegistry();
  const client = new MockClient();
  const config = createMockConfig();
  config.unhealthyThreshold = 5;
  const monitor = new TestableHealthMonitor(registry, client, config);

  registry.register(createMockServer('server-1', HealthStatus.UNKNOWN));

  // Return degraded with only 2 failures (below threshold of 5)
  client.setHealthResult('server-1', {
    status: HealthStatus.DEGRADED,
    lastCheck: new Date(),
    latency: 500,
    consecutiveFailures: 2,
  });

  await monitor.runHealthChecks();

  const server = registry.getServer('server-1');
  assertEquals(server?.health.status, HealthStatus.DEGRADED);
});

Deno.test('HealthMonitor - handles client errors gracefully', async () => {
  const registry = new MockRegistry();
  const client = new MockClient();
  const config = createMockConfig();
  const monitor = new TestableHealthMonitor(registry, client, config);

  registry.register(createMockServer('server-1', HealthStatus.HEALTHY, 0));

  client.setShouldThrow('server-1', true);

  await monitor.runHealthChecks();

  const server = registry.getServer('server-1');
  assertEquals(server?.health.status, HealthStatus.DOWN);
  assertEquals(server?.health.consecutiveFailures, 1);
});

Deno.test('HealthMonitor - checks multiple servers in parallel', async () => {
  const registry = new MockRegistry();
  const client = new MockClient();
  const config = createMockConfig();
  const monitor = new TestableHealthMonitor(registry, client, config);

  registry.register(createMockServer('server-1'));
  registry.register(createMockServer('server-2'));
  registry.register(createMockServer('server-3'));

  client.setHealthResult('server-1', {
    status: HealthStatus.HEALTHY,
    lastCheck: new Date(),
    latency: 50,
    consecutiveFailures: 0,
  });

  client.setHealthResult('server-2', {
    status: HealthStatus.DEGRADED,
    lastCheck: new Date(),
    latency: 200,
    consecutiveFailures: 1,
  });

  client.setShouldThrow('server-3', true);

  await monitor.runHealthChecks();

  assertEquals(registry.getServer('server-1')?.health.status, HealthStatus.HEALTHY);
  assertEquals(registry.getServer('server-2')?.health.status, HealthStatus.DEGRADED);
  assertEquals(registry.getServer('server-3')?.health.status, HealthStatus.DOWN);
});

Deno.test('HealthMonitor - getHealthSummary returns all server statuses', async () => {
  const registry = new MockRegistry();
  const client = new MockClient();
  const config = createMockConfig();
  const monitor = new TestableHealthMonitor(registry, client, config);

  registry.register(createMockServer('server-1', HealthStatus.HEALTHY));
  registry.register(createMockServer('server-2', HealthStatus.DOWN, 5));

  const summary = monitor.getHealthSummary();

  assertEquals(summary.servers.length, 2);
  assertEquals(summary.servers.find((s) => s.id === 'server-1')?.status, HealthStatus.HEALTHY);
  assertEquals(summary.servers.find((s) => s.id === 'server-2')?.status, HealthStatus.DOWN);
});

Deno.test('HealthMonitor - updates lastCheckTime after check', async () => {
  const registry = new MockRegistry();
  const client = new MockClient();
  const config = createMockConfig();
  const monitor = new TestableHealthMonitor(registry, client, config);

  registry.register(createMockServer('server-1'));

  assertEquals(monitor.getLastCheckTime(), null);

  await monitor.runHealthChecks();

  const lastCheck = monitor.getLastCheckTime();
  assertEquals(lastCheck !== null, true);
  assertEquals(lastCheck instanceof Date, true);
});

Deno.test('HealthMonitor - increments consecutiveFailures on error', async () => {
  const registry = new MockRegistry();
  const client = new MockClient();
  const config = createMockConfig();
  const monitor = new TestableHealthMonitor(registry, client, config);

  // Start with 2 failures
  registry.register(createMockServer('server-1', HealthStatus.DEGRADED, 2));

  client.setShouldThrow('server-1', true);

  await monitor.runHealthChecks();

  const server = registry.getServer('server-1');
  assertEquals(server?.health.consecutiveFailures, 3);
});
