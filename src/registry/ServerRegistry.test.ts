/**
 * Tests for ServerRegistry
 */

import {
  assertEquals,
  assertThrows,
} from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  type ServerRegistration,
  ServerRegistry,
  getRegistry,
  resetRegistry,
} from './ServerRegistry.ts';

Deno.test('ServerRegistry - Register and list servers', () => {
  const registry = new ServerRegistry();

  const server1: ServerRegistration = {
    id: 'server-1',
    name: 'Server 1',
    endpoint: 'http://localhost:8080/mcp',
    transport: 'HTTP',
    capabilities: {
      tools: ['tool1', 'tool2'],
      resources: [],
      prompts: [],
    },
  };

  const server2: ServerRegistration = {
    id: 'server-2',
    name: 'Server 2',
    endpoint: 'http://localhost:8081/mcp',
    transport: 'HTTP',
    capabilities: {
      tools: [],
      resources: [],
      prompts: [],
    },
  };

  registry.register(server1);
  registry.register(server2);

  const servers = registry.listServers();
  assertEquals(servers.length, 2);
  assertEquals(servers.map((s) => s.id).sort(), ['server-1', 'server-2']);
});

Deno.test('ServerRegistry - Unregister server', () => {
  const registry = new ServerRegistry();

  const server: ServerRegistration = {
    id: 'server-1',
    name: 'Server 1',
    endpoint: 'http://localhost:8080/mcp',
    transport: 'HTTP',
    capabilities: {
      tools: [],
      resources: [],
      prompts: [],
    },
  };

  registry.register(server);
  assertEquals(registry.listServers().length, 1);

  registry.unregister('server-1');
  assertEquals(registry.listServers().length, 0);
});

Deno.test('ServerRegistry - Get server by ID', () => {
  const registry = new ServerRegistry();

  const server: ServerRegistration = {
    id: 'journey',
    name: 'Journey Service',
    endpoint: 'http://localhost:8080/mcp',
    transport: 'HTTP',
    capabilities: {
      tools: ['findTrips'],
      resources: [],
      prompts: [],
    },
  };

  registry.register(server);

  const found = registry.getServer('journey');
  assertEquals(found?.id, 'journey');
  assertEquals(found?.name, 'Journey Service');
});

Deno.test('ServerRegistry - Resolve tool server', () => {
  const registry = new ServerRegistry();

  const server: ServerRegistration = {
    id: 'journey',
    name: 'Journey Service',
    endpoint: 'http://localhost:8080/mcp',
    transport: 'HTTP',
    capabilities: {
      tools: ['findTrips', 'compareRoutes'],
      resources: [],
      prompts: [],
    },
  };

  registry.register(server);

  const resolved = registry.resolveToolServer('journey.findTrips');
  assertEquals(resolved.id, 'journey');
});

Deno.test('ServerRegistry - Resolve tool server not found', () => {
  const registry = new ServerRegistry();

  assertThrows(
    () => registry.resolveToolServer('nonexistent.tool'),
    Error,
    'No server found for tool',
  );
});

Deno.test('ServerRegistry - Update server health', () => {
  const registry = new ServerRegistry();

  const server: ServerRegistration = {
    id: 'server-1',
    name: 'Server 1',
    endpoint: 'http://localhost:8080/mcp',
    transport: 'HTTP',
    capabilities: {
      tools: [],
      resources: [],
      prompts: [],
    },
  };

  registry.register(server);

  registry.updateHealth('server-1', { status: 'HEALTHY' });

  const updated = registry.getServer('server-1');
  assertEquals(updated?.health?.status, 'HEALTHY');
});

Deno.test('ServerRegistry - Get healthy servers', () => {
  const registry = new ServerRegistry();

  const healthy: ServerRegistration = {
    id: 'healthy',
    name: 'Healthy Server',
    endpoint: 'http://localhost:8080/mcp',
    transport: 'HTTP',
    capabilities: {
      tools: [],
      resources: [],
      prompts: [],
    },
  };

  const unhealthy: ServerRegistration = {
    id: 'unhealthy',
    name: 'Unhealthy Server',
    endpoint: 'http://localhost:8081/mcp',
    transport: 'HTTP',
    capabilities: {
      tools: [],
      resources: [],
      prompts: [],
    },
  };

  registry.register(healthy);
  registry.register(unhealthy);

  registry.updateHealth('healthy', { status: 'HEALTHY' });
  registry.updateHealth('unhealthy', { status: 'DOWN' });

  const healthyServers = registry.getHealthyServers();
  assertEquals(healthyServers.length, 1);
  assertEquals(healthyServers[0].id, 'healthy');
});

Deno.test('ServerRegistry - Resolve resource server', () => {
  const registry = new ServerRegistry();

  const server: ServerRegistration = {
    id: 'resource-server',
    name: 'Resource Server',
    endpoint: 'http://localhost:8080/mcp',
    transport: 'HTTP',
    capabilities: {
      tools: [],
      resources: ['resource://data/'],
      prompts: [],
    },
  };

  registry.register(server);

  const resolved = registry.resolveResourceServer('resource://data/');
  assertEquals(resolved.id, 'resource-server');
});

Deno.test('ServerRegistry - Resolve prompt server', () => {
  const registry = new ServerRegistry();

  const server: ServerRegistration = {
    id: 'prompt-server',
    name: 'Prompt Server',
    endpoint: 'http://localhost:8080/mcp',
    transport: 'HTTP',
    capabilities: {
      tools: [],
      resources: [],
      prompts: ['plan-trip', 'compare-routes'],
    },
  };

  registry.register(server);

  const resolved = registry.resolvePromptServer('prompt-server.plan-trip');
  assertEquals(resolved.id, 'prompt-server');
});

Deno.test('ServerRegistry - Get statuses', () => {
  const registry = new ServerRegistry();

  const server: ServerRegistration = {
    id: 'server-1',
    name: 'Server 1',
    endpoint: 'http://localhost:8080/mcp',
    transport: 'HTTP',
    capabilities: {
      tools: [],
      resources: [],
      prompts: [],
    },
  };

  registry.register(server);
  registry.updateHealth('server-1', { status: 'HEALTHY' });

  const statuses = registry.getStatuses();
  assertEquals(statuses['server-1'].status, 'HEALTHY');
});

Deno.test('ServerRegistry - Reset all', () => {
  const registry = new ServerRegistry();

  const server: ServerRegistration = {
    id: 'server-1',
    name: 'Server 1',
    endpoint: 'http://localhost:8080/mcp',
    transport: 'HTTP',
    capabilities: {
      tools: [],
      resources: [],
      prompts: [],
    },
  };

  registry.register(server);
  assertEquals(registry.listServers().length, 1);

  registry.resetAll();
  assertEquals(registry.listServers().length, 0);
});

Deno.test('ServerRegistry - Reset health', () => {
  const registry = new ServerRegistry();

  const server: ServerRegistration = {
    id: 'server-1',
    name: 'Server 1',
    endpoint: 'http://localhost:8080/mcp',
    transport: 'HTTP',
    capabilities: {
      tools: [],
      resources: [],
      prompts: [],
    },
  };

  registry.register(server);
  registry.updateHealth('server-1', { status: 'HEALTHY' });

  const before = registry.getServer('server-1');
  assertEquals(before?.health?.status, 'HEALTHY');

  registry.resetHealth('server-1');

  const after = registry.getServer('server-1');
  assertEquals(after?.health?.status, 'UNKNOWN');
});

Deno.test('ServerRegistry - Singleton registry', () => {
  // Reset to ensure clean state
  resetRegistry();

  const registry1 = getRegistry();
  const server: ServerRegistration = {
    id: 'test-server',
    name: 'Test Server',
    endpoint: 'http://localhost:8080/mcp',
    transport: 'HTTP',
    capabilities: {
      tools: [],
      resources: [],
      prompts: [],
    },
  };

  registry1.register(server);

  // Get the same instance
  const registry2 = getRegistry();
  assertEquals(registry2.getServer('test-server')?.id, 'test-server');

  // Reset and verify
  resetRegistry();
  const registry3 = getRegistry();
  assertEquals(registry3.listServers().length, 0);
});

Deno.test('ServerRegistry - Multiple servers with same tool', () => {
  const registry = new ServerRegistry();

  const server1: ServerRegistration = {
    id: 'server-1',
    name: 'Server 1',
    endpoint: 'http://localhost:8080/mcp',
    transport: 'HTTP',
    capabilities: {
      tools: ['findTrips'],
      resources: [],
      prompts: [],
    },
  };

  const server2: ServerRegistration = {
    id: 'server-2',
    name: 'Server 2',
    endpoint: 'http://localhost:8081/mcp',
    transport: 'HTTP',
    capabilities: {
      tools: ['findTrips'],
      resources: [],
      prompts: [],
    },
  };

  registry.register(server1);
  registry.register(server2);

  // Last registered should win
  const resolved = registry.resolveToolServer('server-2.findTrips');
  assertEquals(resolved.id, 'server-2');
});

Deno.test('ServerRegistry - Invalid registration - missing endpoint', () => {
  const registry = new ServerRegistry();

  const server: ServerRegistration = {
    id: 'server-1',
    name: 'Server 1',
    endpoint: '',
    transport: 'HTTP',
    capabilities: {
      tools: [],
      resources: [],
      prompts: [],
    },
  };

  assertThrows(
    () => registry.register(server),
    Error,
    'Server must have id and endpoint',
  );
});

Deno.test('ServerRegistry - Health initialization on register', () => {
  const registry = new ServerRegistry();

  const server: ServerRegistration = {
    id: 'server-1',
    name: 'Server 1',
    endpoint: 'http://localhost:8080/mcp',
    transport: 'HTTP',
    capabilities: {
      tools: [],
      resources: [],
      prompts: [],
    },
    // No health property specified
  };

  registry.register(server);

  const registered = registry.getServer('server-1');
  assertEquals(registered?.health?.status, 'UNKNOWN');
});

Deno.test('ServerRegistry - Update health on non-existent server', () => {
  const registry = new ServerRegistry();

  assertThrows(
    () => registry.updateHealth('nonexistent', { status: 'HEALTHY' }),
    Error,
    'Server nonexistent not found',
  );
});

Deno.test('ServerRegistry - Unregister non-existent server', () => {
  const registry = new ServerRegistry();

  assertThrows(
    () => registry.unregister('nonexistent'),
    Error,
    'Server nonexistent not found',
  );
});

Deno.test('ServerRegistry - Resource resolution not found', () => {
  const registry = new ServerRegistry();

  assertThrows(
    () => registry.resolveResourceServer('nonexistent://resource'),
    Error,
    'No server found for resource',
  );
});

Deno.test('ServerRegistry - Prompt resolution not found', () => {
  const registry = new ServerRegistry();

  assertThrows(
    () => registry.resolvePromptServer('nonexistent.prompt'),
    Error,
    'No server found for prompt',
  );
});

Deno.test('ServerRegistry - Multiple capabilities', () => {
  const registry = new ServerRegistry();

  const server: ServerRegistration = {
    id: 'multi-service',
    name: 'Multi Service',
    endpoint: 'http://localhost:8080/mcp',
    transport: 'HTTP',
    capabilities: {
      tools: ['tool1', 'tool2', 'tool3'],
      resources: ['resource://data/', 'resource://files/'],
      prompts: ['prompt1', 'prompt2'],
    },
  };

  registry.register(server);

  // Verify all tools are resolvable
  assertEquals(registry.resolveToolServer('multi-service.tool1').id, 'multi-service');
  assertEquals(registry.resolveToolServer('multi-service.tool2').id, 'multi-service');
  assertEquals(registry.resolveToolServer('multi-service.tool3').id, 'multi-service');

  // Verify all resources are resolvable
  assertEquals(
    registry.resolveResourceServer('resource://data/').id,
    'multi-service',
  );
  assertEquals(
    registry.resolveResourceServer('resource://files/').id,
    'multi-service',
  );

  // Verify all prompts are resolvable
  assertEquals(registry.resolvePromptServer('multi-service.prompt1').id, 'multi-service');
  assertEquals(registry.resolvePromptServer('multi-service.prompt2').id, 'multi-service');
});
