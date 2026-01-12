/**
 * Server Configuration Upload and Management Tests
 */

import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.208.0/assert/mod.ts';

// Test configuration data
const validServerConfig = {
  servers: [
    {
      id: 'test-journey',
      name: 'Test Journey Service',
      endpoint: 'http://localhost:3001/mcp',
      requiresSession: true,
    },
    {
      id: 'test-mobility',
      name: 'Test Swiss Mobility',
      endpoint: 'http://localhost:3002/mcp',
      requiresSession: false,
    },
  ],
};

const invalidServerConfig = {
  servers: [
    {
      id: 'incomplete-server',
      name: 'Missing endpoint',
      endpoint: 'invalid-url-no-protocol-or-slashes', // Invalid - no protocol
      requiresSession: false,
    },
  ],
};

const configWithDuplicateIds = {
  servers: [
    {
      id: 'duplicate',
      name: 'Server 1',
      endpoint: 'http://localhost:3001/mcp',
      requiresSession: false,
    },
    {
      id: 'duplicate',
      name: 'Server 2',
      endpoint: 'http://localhost:3002/mcp',
      requiresSession: false,
    },
  ],
};

const configWithInvalidUrl = {
  servers: [
    {
      id: 'bad-url',
      name: 'Bad URL Server',
      endpoint: 'not-a-valid-url',
      requiresSession: false,
    },
  ],
};

// ============================================================================
// Configuration Validation Tests
// ============================================================================

Deno.test('Configuration Validation - Valid configuration', () => {
  const errors = validateServerConfig(validServerConfig);
  assertEquals(errors.length, 0);
  clearAllServers();
});

Deno.test('Configuration Validation - Missing endpoint', () => {
  const errors = validateServerConfig(invalidServerConfig);
  assertEquals(errors.length, 1);
  assertStringIncludes(errors[0], 'endpoint');
  clearAllServers();
});

Deno.test('Configuration Validation - Duplicate server IDs', () => {
  const errors = validateServerConfig(configWithDuplicateIds);
  assertEquals(errors.length, 1);
  assertStringIncludes(errors[0], 'duplicate');
});

Deno.test('Configuration Validation - Invalid endpoint URL', () => {
  const errors = validateServerConfig(configWithInvalidUrl);
  assertEquals(errors.length, 1);
  assertStringIncludes(errors[0], 'URL');
});

Deno.test('Configuration Validation - No servers array', () => {
  const errors = validateServerConfig({} as typeof validServerConfig);
  assertEquals(errors.length, 1);
  assertStringIncludes(errors[0], 'servers');
});

Deno.test('Configuration Validation - Empty servers array', () => {
  const errors = validateServerConfig({ servers: [] });
  assertEquals(errors.length, 0, 'Empty servers array should be valid');
});

// ============================================================================
// Server Registration Tests
// ============================================================================

Deno.test('Server Registration - Register single server', async () => {
  const server = validServerConfig.servers[0];
  const result = await registerServer(server);
  assertEquals(result.success, true);
  assertEquals(result.serverId, server.id);
});

Deno.test('Server Registration - Register duplicate server ID', async () => {
  const server = validServerConfig.servers[0];
  // Register first time
  await registerServer(server);
  // Register again - should update
  const result = await registerServer(server);
  assertEquals(result.success, true, 'Should allow re-registration');
});

Deno.test('Server Registration - Register multiple servers', async () => {
  const servers = validServerConfig.servers;
  const results = await Promise.all(servers.map(registerServer));
  assertEquals(results.length, 2);
  assertEquals(
    results.every((r) => r.success),
    true
  );
});

// ============================================================================
// Bulk Upload Tests
// ============================================================================

Deno.test('Bulk Upload - Upload valid configuration', async () => {
  clearAllServers();
  const result = await uploadServerConfiguration(validServerConfig);
  assertEquals(result.success, true);
  assertEquals(result.uploaded, 2);
  assertEquals(result.failed, 0);
  assertEquals(result.errors.length, 0);
});

Deno.test('Bulk Upload - Upload with validation errors', async () => {
  clearAllServers();
  const mixedConfig = {
    servers: [
      validServerConfig.servers[0],
      {
        id: 'bad-server',
        name: 'Bad Server',
        endpoint: '', // Empty endpoint - should fail
        requiresSession: false,
      } as typeof validServerConfig.servers[0],
    ],
  };

  const result = await uploadServerConfiguration(mixedConfig);
  assertEquals(result.success, false);
  assertEquals(result.failed > 0, true);  // At least one failed
  assertEquals(result.errors.length > 0, true);  // At least one error
});

Deno.test('Bulk Upload - Empty configuration', async () => {
  const result = await uploadServerConfiguration({ servers: [] });
  assertEquals(result.success, true);
  assertEquals(result.uploaded, 0);
  assertEquals(result.failed, 0);
});

// ============================================================================
// Server Listing Tests
// ============================================================================

Deno.test('Server Listing - List registered servers', async () => {
  // Register servers first
  for (const server of validServerConfig.servers) {
    await registerServer(server);
  }

  const servers = await listRegisteredServers();
  assertEquals(servers.length >= 2, true);
  const ids = servers.map((s) => s.id);
  assertEquals(ids.includes('test-journey'), true);
  assertEquals(ids.includes('test-mobility'), true);
});

Deno.test('Server Listing - List empty servers', async () => {
  // Clear all servers
  await clearAllServers();
  const servers = await listRegisteredServers();
  assertEquals(servers.length, 0);
});

// ============================================================================
// Server Deletion Tests
// ============================================================================

Deno.test('Server Deletion - Delete existing server', async () => {
  const server = validServerConfig.servers[0];
  await registerServer(server);

  const deleted = await deleteServer(server.id);
  assertEquals(deleted, true);

  const servers = await listRegisteredServers();
  const ids = servers.map((s) => s.id);
  assertEquals(ids.includes(server.id), false);
});

Deno.test('Server Deletion - Delete non-existent server', async () => {
  const deleted = await deleteServer('non-existent-server');
  assertEquals(deleted, false);
});

// ============================================================================
// Server Health Check Tests
// ============================================================================

Deno.test('Health Check - Get health status', async () => {
  const server = validServerConfig.servers[0];
  await registerServer(server);

  const health = await getServerHealth(server.id);
  assertEquals(health.id, server.id);
  assertEquals(health.name, server.name);
  assertEquals(
    ['healthy', 'unhealthy', 'unknown'].includes(health.status),
    true
  );
});

Deno.test('Health Check - Health for non-existent server', async () => {
  const health = await getServerHealth('non-existent');
  assertEquals(health.status, 'unknown');
});

// ============================================================================
// API Endpoint Tests
// ============================================================================
// NOTE: These tests require a running server on localhost:8000
// They are skipped unless explicitly run with the test server

// Commented out - requires running server
// Deno.test('API Endpoints - POST /mcp/servers/register', async () => {
//   const response = await fetch('http://localhost:8000/mcp/servers/register', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify(validServerConfig.servers[0]),
//   });

//   assertEquals(response.status, 200);
//   const data = await response.json();
//   assertEquals(data.success, true);
// });

// ============================================================================
// Helper Functions (Mock implementations for testing)
// ============================================================================

// Mock server storage for testing
const mockServers = new Map<
  string,
  typeof validServerConfig.servers[0]
>();

function validateServerConfig(
  config: typeof validServerConfig
): string[] {
  const errors: string[] = [];

  if (!config.servers || !Array.isArray(config.servers)) {
    errors.push('Configuration must have a "servers" array');
    return errors;
  }

  const ids = new Set<string>();

  for (let i = 0; i < config.servers.length; i++) {
    const server = config.servers[i];

    if (!server.id) {
      errors.push(`Server ${i}: missing required field "id"`);
    }
    if (!server.name) {
      errors.push(`Server ${i}: missing required field "name"`);
    }
    if (!server.endpoint) {
      errors.push(`Server ${i}: missing required field "endpoint"`);
    } else {
      try {
        new URL(server.endpoint);
      } catch {
        errors.push(`Server ${i}: invalid endpoint URL: ${server.endpoint}`);
      }
    }

    if (server.id && ids.has(server.id)) {
      errors.push(`Server ${i}: duplicate server ID "${server.id}"`);
    }
    if (server.id) {
      ids.add(server.id);
    }
  }

  return errors;
}

async function registerServer(
  server: (typeof validServerConfig.servers)[0]
): Promise<{ success: boolean; serverId: string }> {
  // Mock implementation - store in mockServers map
  mockServers.set(server.id, server);
  return { success: true, serverId: server.id };
}

async function uploadServerConfiguration(
  config: typeof validServerConfig
): Promise<{
  success: boolean;
  uploaded: number;
  failed: number;
  errors: string[];
}> {
  const validationErrors = validateServerConfig(config);
  if (validationErrors.length > 0) {
    return {
      success: false,
      uploaded: 0,
      failed: config.servers.length,
      errors: validationErrors,
    };
  }

  let uploaded = 0;
  const errors: string[] = [];

  for (const server of config.servers) {
    try {
      await registerServer(server);
      uploaded++;
    } catch (error) {
      errors.push(
        `Failed to register ${server.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  return {
    success: errors.length === 0,
    uploaded,
    failed: config.servers.length - uploaded,
    errors,
  };
}

async function listRegisteredServers(): Promise<
  (typeof validServerConfig.servers)[0][]
> {
  // Mock implementation - return stored servers
  return Array.from(mockServers.values());
}

async function deleteServer(serverId: string): Promise<boolean> {
  // Mock implementation - remove from storage
  return mockServers.delete(serverId);
}

async function getServerHealth(
  serverId: string
): Promise<{ id: string; name: string; status: string }> {
  const server = mockServers.get(serverId);
  if (!server) {
    return { id: serverId, name: 'Unknown', status: 'unknown' };
  }
  return { id: serverId, name: server.name, status: 'healthy' };
}

async function clearAllServers(): Promise<void> {
  // Mock implementation - clear storage
  mockServers.clear();
}
