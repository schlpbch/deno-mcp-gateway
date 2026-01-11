/**
 * Dynamic Server Registry for MCP Gateway
 *
 * Manages registration, unregistration, and resolution of backend MCP servers.
 * Supports dynamic runtime registration without restart.
 */

export interface ServerCapabilities {
  tools: string[];
  resources: string[];
  prompts: string[];
}

export interface ServerHealth {
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN' | 'UNKNOWN';
  lastCheck?: number;
  message?: string;
}

export interface ServerRegistration {
  id: string;
  name: string;
  endpoint: string;
  transport: 'HTTP' | 'STDIO';
  capabilities: ServerCapabilities;
  health?: ServerHealth;
  requiresSession?: boolean;
}

/**
 * Registry for managing backend MCP server registrations
 */
export class ServerRegistry {
  private servers = new Map<string, ServerRegistration>();
  private toolToServer = new Map<string, string>();
  private resourceToServer = new Map<string, string>();
  private promptToServer = new Map<string, string>();

  /**
   * Register a new server
   */
  register(server: ServerRegistration): void {
    if (!server.id || !server.endpoint) {
      throw new Error('Server must have id and endpoint');
    }

    this.servers.set(server.id, {
      ...server,
      health: server.health || { status: 'UNKNOWN' },
    });

    // Index tools, resources, and prompts
    server.capabilities.tools.forEach((tool) => {
      this.toolToServer.set(`${server.id}.${tool}`, server.id);
    });

    server.capabilities.resources.forEach((resource) => {
      this.resourceToServer.set(resource, server.id);
    });

    server.capabilities.prompts.forEach((prompt) => {
      this.promptToServer.set(`${server.id}.${prompt}`, server.id);
    });
  }

  /**
   * Unregister a server
   */
  unregister(serverId: string): void {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`Server ${serverId} not found`);
    }

    // Remove from indexes
    server.capabilities.tools.forEach((tool) => {
      this.toolToServer.delete(`${server.id}.${tool}`);
    });

    server.capabilities.resources.forEach((resource) => {
      this.resourceToServer.delete(resource);
    });

    server.capabilities.prompts.forEach((prompt) => {
      this.promptToServer.delete(`${server.id}.${prompt}`);
    });

    this.servers.delete(serverId);
  }

  /**
   * Get a specific server by ID
   */
  getServer(serverId: string): ServerRegistration | null {
    return this.servers.get(serverId) || null;
  }

  /**
   * List all registered servers
   */
  listServers(): ServerRegistration[] {
    return Array.from(this.servers.values());
  }

  /**
   * Get all healthy servers
   */
  getHealthyServers(): ServerRegistration[] {
    return Array.from(this.servers.values()).filter(
      (server) =>
        server.health?.status === 'HEALTHY' ||
        server.health?.status === 'DEGRADED',
    );
  }

  /**
   * Update server health status
   */
  updateHealth(serverId: string, health: ServerHealth): void {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`Server ${serverId} not found`);
    }

    server.health = {
      ...health,
      lastCheck: Date.now(),
    };
  }

  /**
   * Resolve which server handles a tool
   */
  resolveToolServer(toolName: string): ServerRegistration {
    // Try exact match first (serverId.toolName)
    const serverId = this.toolToServer.get(toolName);
    if (serverId) {
      const server = this.servers.get(serverId);
      if (server) return server;
    }

    // Try prefix match (serverId from toolName prefix)
    const [prefix] = toolName.split('.');
    for (const [id, server] of this.servers) {
      if (id === prefix) {
        return server;
      }
    }

    throw new Error(`No server found for tool: ${toolName}`);
  }

  /**
   * Resolve which server handles a resource
   */
  resolveResourceServer(resourceUri: string): ServerRegistration {
    const serverId = this.resourceToServer.get(resourceUri);
    if (!serverId) {
      throw new Error(`No server found for resource: ${resourceUri}`);
    }

    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`Server ${serverId} not found`);
    }

    return server;
  }

  /**
   * Resolve which server handles a prompt
   */
  resolvePromptServer(promptName: string): ServerRegistration {
    // Try exact match first (serverId.promptName)
    const serverId = this.promptToServer.get(promptName);
    if (serverId) {
      const server = this.servers.get(serverId);
      if (server) return server;
    }

    // Try prefix match (serverId from promptName prefix)
    const [prefix] = promptName.split('.');
    for (const [id, server] of this.servers) {
      if (id === prefix) {
        return server;
      }
    }

    throw new Error(`No server found for prompt: ${promptName}`);
  }

  /**
   * Get status of all servers
   */
  getStatuses(): Record<string, ServerHealth> {
    const statuses: Record<string, ServerHealth> = {};
    for (const [id, server] of this.servers) {
      statuses[id] = server.health || { status: 'UNKNOWN' };
    }
    return statuses;
  }

  /**
   * Reset all servers
   */
  resetAll(): void {
    this.servers.clear();
    this.toolToServer.clear();
    this.resourceToServer.clear();
    this.promptToServer.clear();
  }

  /**
   * Reset a specific server's health
   */
  resetHealth(serverId: string): void {
    const server = this.servers.get(serverId);
    if (server) {
      server.health = { status: 'UNKNOWN' };
    }
  }
}

// Singleton instance
let registryInstance: ServerRegistry | null = null;

export function getRegistry(): ServerRegistry {
  if (!registryInstance) {
    registryInstance = new ServerRegistry();
  }
  return registryInstance;
}

export function resetRegistry(): void {
  registryInstance = null;
}
