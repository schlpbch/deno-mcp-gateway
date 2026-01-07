import {
  assertEquals,
  assertThrows,
} from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { ServerRegistry } from './ServerRegistry.ts';
import { HealthStatus, TransportType } from '../types/server.ts';
import type { ServerRegistration, ServerHealth, ServerCapabilities } from '../types/server.ts';

function createMockServer(
  id: string,
  healthStatus: HealthStatus = HealthStatus.HEALTHY
): ServerRegistration {
  return {
    id,
    name: `Test Server ${id}`,
    endpoint: `https://${id}.example.com/mcp`,
    transport: TransportType.HTTP,
    capabilities: {
      tools: ['tool1', 'tool2'],
      resources: [],
      prompts: [],
    },
    health: {
      status: healthStatus,
      lastCheck: new Date(),
      latency: 100,
      consecutiveFailures: 0,
    },
    priority: 1,
    registeredAt: new Date(),
  };
}

Deno.test('ServerRegistry - singleton instance', () => {
  const instance1 = ServerRegistry.getInstance();
  const instance2 = ServerRegistry.getInstance();
  assertEquals(instance1, instance2);
});

Deno.test('ServerRegistry - register and get server', () => {
  const registry = ServerRegistry.getInstance();
  registry.clear();

  const server = createMockServer('journey-service-mcp');
  registry.register(server);

  const retrieved = registry.getServer('journey-service-mcp');
  assertEquals(retrieved?.id, 'journey-service-mcp');
  assertEquals(retrieved?.name, 'Test Server journey-service-mcp');
});

Deno.test('ServerRegistry - unregister server', () => {
  const registry = ServerRegistry.getInstance();
  registry.clear();

  const server = createMockServer('test-server');
  registry.register(server);
  assertEquals(registry.getServer('test-server')?.id, 'test-server');

  registry.unregister('test-server');
  assertEquals(registry.getServer('test-server'), undefined);
});

Deno.test('ServerRegistry - listServers returns all servers', () => {
  const registry = ServerRegistry.getInstance();
  registry.clear();

  registry.register(createMockServer('server-1'));
  registry.register(createMockServer('server-2'));
  registry.register(createMockServer('server-3'));

  const servers = registry.listServers();
  assertEquals(servers.length, 3);
});

Deno.test('ServerRegistry - listHealthyServers filters unhealthy servers', () => {
  const registry = ServerRegistry.getInstance();
  registry.clear();

  registry.register(createMockServer('healthy-1', HealthStatus.HEALTHY));
  registry.register(createMockServer('degraded-1', HealthStatus.DEGRADED));
  registry.register(createMockServer('down-1', HealthStatus.DOWN));
  registry.register(createMockServer('healthy-2', HealthStatus.HEALTHY));

  const healthyServers = registry.listHealthyServers();
  assertEquals(healthyServers.length, 2);
  assertEquals(healthyServers.every((s) => s.health.status === HealthStatus.HEALTHY), true);
});

Deno.test('ServerRegistry - resolveToolServer finds correct server', () => {
  const registry = ServerRegistry.getInstance();
  registry.clear();

  registry.register(createMockServer('journey-service-mcp'));
  registry.register(createMockServer('swiss-mobility-mcp'));

  const server = registry.resolveToolServer('journey.findTrips');
  assertEquals(server.id, 'journey-service-mcp');
});

Deno.test('ServerRegistry - resolveToolServer throws for unknown server', () => {
  const registry = ServerRegistry.getInstance();
  registry.clear();

  assertThrows(
    () => registry.resolveToolServer('unknown.someTool'),
    Error,
    'Server not found for tool'
  );
});

Deno.test('ServerRegistry - resolveResourceServer finds correct server', () => {
  const registry = ServerRegistry.getInstance();
  registry.clear();

  registry.register(createMockServer('journey-service-mcp'));

  // The extractServerId function uses dot notation, so URI-style resources
  // need to use dot notation for namespacing (e.g., "journey.routes/123")
  const server = registry.resolveResourceServer('journey.routes/123');
  assertEquals(server.id, 'journey-service-mcp');
});

Deno.test('ServerRegistry - resolvePromptServer finds correct server', () => {
  const registry = ServerRegistry.getInstance();
  registry.clear();

  registry.register(createMockServer('journey-service-mcp'));

  const server = registry.resolvePromptServer('journey.tripPlanner');
  assertEquals(server.id, 'journey-service-mcp');
});

Deno.test('ServerRegistry - updateHealth updates server health', () => {
  const registry = ServerRegistry.getInstance();
  registry.clear();

  registry.register(createMockServer('test-server', HealthStatus.HEALTHY));

  const newHealth: ServerHealth = {
    status: HealthStatus.DOWN,
    lastCheck: new Date(),
    latency: 5000,
    consecutiveFailures: 3,
    errorMessage: 'Connection timeout',
  };

  registry.updateHealth('test-server', newHealth);

  const server = registry.getServer('test-server');
  assertEquals(server?.health.status, HealthStatus.DOWN);
  assertEquals(server?.health.consecutiveFailures, 3);
  assertEquals(server?.health.errorMessage, 'Connection timeout');
});

Deno.test('ServerRegistry - updateCapabilities updates server capabilities', () => {
  const registry = ServerRegistry.getInstance();
  registry.clear();

  registry.register(createMockServer('test-server'));

  const newCapabilities: ServerCapabilities = {
    tools: ['newTool1', 'newTool2', 'newTool3'],
    resources: [{ uriPrefix: 'test://', description: 'Test resources' }],
    prompts: ['prompt1'],
  };

  registry.updateCapabilities('test-server', newCapabilities);

  const server = registry.getServer('test-server');
  assertEquals(server?.capabilities.tools.length, 3);
  assertEquals(server?.capabilities.resources.length, 1);
  assertEquals(server?.capabilities.prompts.length, 1);
});

Deno.test('ServerRegistry - clear removes all servers', () => {
  const registry = ServerRegistry.getInstance();

  registry.register(createMockServer('server-1'));
  registry.register(createMockServer('server-2'));

  registry.clear();

  assertEquals(registry.listServers().length, 0);
});
