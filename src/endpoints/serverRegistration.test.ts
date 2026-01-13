/**
 * Tests for dynamic server registration endpoints
 * Covers POST /mcp/servers/register and GET /mcp/servers/register
 */

import { assertEquals, assertExists } from 'https://deno.land/std@0.208.0/assert/mod.ts';

interface BackendServer {
  id: string;
  name: string;
  endpoint: string;
  requiresSession: boolean;
}

// Mock implementation of the registration logic
const dynamicServers = new Map<string, BackendServer>();

async function handleRegisterPost(body: Record<string, unknown>): Promise<{ success: boolean; serverId?: string; error?: string }> {
  if (!body.id || !body.name || !body.endpoint) {
    return { success: false, error: 'Missing required fields: id, name, endpoint' };
  }

  try {
    new URL(body.endpoint as string);
  } catch {
    return { success: false, error: 'Invalid endpoint URL format' };
  }

  const newServer: BackendServer = {
    id: body.id as string,
    name: body.name as string,
    endpoint: body.endpoint as string,
    requiresSession: (body.requiresSession as boolean) || false,
  };

  dynamicServers.set(body.id as string, newServer);

  return {
    success: true,
    serverId: body.id as string,
  };
}

function handleRegisterGet(): BackendServer[] {
  return Array.from(dynamicServers.values());
}

Deno.test('Server Registration - POST /mcp/servers/register', async (t) => {
  // Clear previous state
  dynamicServers.clear();

  await t.step('should register a valid server', async () => {
    const result = await handleRegisterPost({
      id: 'test-server',
      name: 'Test Server',
      endpoint: 'https://example.com/mcp',
      requiresSession: false,
    });

    assertEquals(result.success, true);
    assertEquals(result.serverId, 'test-server');
  });

  await t.step('should reject missing id field', async () => {
    const result = await handleRegisterPost({
      name: 'Test Server',
      endpoint: 'https://example.com/mcp',
    });

    assertEquals(result.success, false);
    assertExists(result.error);
  });

  await t.step('should reject missing name field', async () => {
    const result = await handleRegisterPost({
      id: 'test-server',
      endpoint: 'https://example.com/mcp',
    });

    assertEquals(result.success, false);
    assertExists(result.error);
  });

  await t.step('should reject missing endpoint field', async () => {
    const result = await handleRegisterPost({
      id: 'test-server',
      name: 'Test Server',
    });

    assertEquals(result.success, false);
    assertExists(result.error);
  });

  await t.step('should reject invalid endpoint URL', async () => {
    const result = await handleRegisterPost({
      id: 'test-server',
      name: 'Test Server',
      endpoint: 'not-a-valid-url',
    });

    assertEquals(result.success, false);
    assertExists(result.error);
  });

  await t.step('should accept requiresSession field', async () => {
    const result = await handleRegisterPost({
      id: 'session-server',
      name: 'Session Server',
      endpoint: 'https://example.com/mcp',
      requiresSession: true,
    });

    assertEquals(result.success, true);
    const servers = handleRegisterGet();
    const server = servers.find((s) => s.id === 'session-server');
    assertEquals(server?.requiresSession, true);
  });

  await t.step('should overwrite server with same id', async () => {
    await handleRegisterPost({
      id: 'duplicate-id',
      name: 'First Server',
      endpoint: 'https://first.com/mcp',
    });

    const result = await handleRegisterPost({
      id: 'duplicate-id',
      name: 'Second Server',
      endpoint: 'https://second.com/mcp',
    });

    assertEquals(result.success, true);
    const servers = handleRegisterGet();
    const server = servers.find((s) => s.id === 'duplicate-id');
    assertEquals(server?.name, 'Second Server');
    assertEquals(server?.endpoint, 'https://second.com/mcp');
  });
});

Deno.test('Server Registration - GET /mcp/servers/register', async (t) => {
  dynamicServers.clear();

  await t.step('should return empty array when no servers registered', () => {
    const servers = handleRegisterGet();
    assertEquals(servers.length, 0);
  });

  await t.step('should return all registered servers', async () => {
    await handleRegisterPost({
      id: 'server-1',
      name: 'Server 1',
      endpoint: 'https://server1.com/mcp',
    });

    await handleRegisterPost({
      id: 'server-2',
      name: 'Server 2',
      endpoint: 'https://server2.com/mcp',
    });

    const servers = handleRegisterGet();
    assertEquals(servers.length, 2);
    assertEquals(servers[0].id, 'server-1');
    assertEquals(servers[1].id, 'server-2');
  });

  await t.step('should return servers with all properties', async () => {
    dynamicServers.clear();

    await handleRegisterPost({
      id: 'full-server',
      name: 'Full Server',
      endpoint: 'https://full.com/mcp',
      requiresSession: true,
    });

    const servers = handleRegisterGet();
    const server = servers[0];

    assertEquals(server.id, 'full-server');
    assertEquals(server.name, 'Full Server');
    assertEquals(server.endpoint, 'https://full.com/mcp');
    assertEquals(server.requiresSession, true);
  });
});

Deno.test('Server Registration - Deduplication', async (t) => {
  dynamicServers.clear();

  await t.step('should deduplicate servers by id in aggregated list', async () => {
    // Simulate hardcoded servers
    const hardcodedServers: BackendServer[] = [
      {
        id: 'hardcoded-1',
        name: 'Hardcoded Server 1',
        endpoint: 'https://hardcoded1.com/mcp',
        requiresSession: false,
      },
    ];

    // Register a server with same id as hardcoded
    await handleRegisterPost({
      id: 'hardcoded-1',
      name: 'Overridden Server 1',
      endpoint: 'https://overridden1.com/mcp',
      requiresSession: true,
    });

    // Aggregate servers (simulating health endpoint logic)
    const allServersMap = new Map<string, BackendServer>();
    hardcodedServers.forEach((s) => allServersMap.set(s.id, s));
    Array.from(dynamicServers.values()).forEach((s) => allServersMap.set(s.id, s));

    const aggregated = Array.from(allServersMap.values());

    // Should have only 1 server (not 2)
    assertEquals(aggregated.length, 1);
    // Dynamic server should override hardcoded
    assertEquals(aggregated[0].name, 'Overridden Server 1');
    assertEquals(aggregated[0].endpoint, 'https://overridden1.com/mcp');
    assertEquals(aggregated[0].requiresSession, true);
  });

  await t.step('should prevent duplicate servers in health response', async () => {
    dynamicServers.clear();

    const hardcodedServers: BackendServer[] = [
      {
        id: 'journey',
        name: 'Journey Service',
        endpoint: 'https://journey.com/mcp',
        requiresSession: true,
      },
      {
        id: 'aareguru',
        name: 'Aareguru',
        endpoint: 'https://aareguru.com/mcp',
        requiresSession: false,
      },
    ];

    // Register some dynamic servers
    await handleRegisterPost({
      id: 'swiss-mobility',
      name: 'Swiss Mobility',
      endpoint: 'https://swiss.com/mcp',
    });

    await handleRegisterPost({
      id: 'open-meteo',
      name: 'Open Meteo',
      endpoint: 'https://meteo.com/mcp',
    });

    // Also register a duplicate
    await handleRegisterPost({
      id: 'journey',
      name: 'Journey Service Updated',
      endpoint: 'https://journey-updated.com/mcp',
    });

    // Aggregate
    const allServersMap = new Map<string, BackendServer>();
    hardcodedServers.forEach((s) => allServersMap.set(s.id, s));
    Array.from(dynamicServers.values()).forEach((s) => allServersMap.set(s.id, s));
    const aggregated = Array.from(allServersMap.values());

    // Should have 4 unique servers (not 5)
    assertEquals(aggregated.length, 4);

    // Verify no duplicates
    const ids = aggregated.map((s) => s.id);
    const uniqueIds = new Set(ids);
    assertEquals(ids.length, uniqueIds.size);

    // Verify dynamic server overwrote hardcoded
    const journey = aggregated.find((s) => s.id === 'journey');
    assertEquals(journey?.name, 'Journey Service Updated');
    assertEquals(journey?.endpoint, 'https://journey-updated.com/mcp');
  });
});
