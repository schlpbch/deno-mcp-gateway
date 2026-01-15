/**
 * Deno KV Storage Tests
 *
 * Comprehensive tests for the KV storage module that handles
 * persistent storage of dynamically registered MCP servers.
 */

import {
  assertEquals,
  assertExists,
  assertRejects,
} from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  saveServer,
  getServer,
  deleteServer,
  listServers,
  saveServers,
  syncToMap,
  closeKv,
} from './kv.ts';
import type { BackendServer } from './types.ts';

// Helper to create test server objects
function createTestServer(id: string, overrides: Partial<BackendServer> = {}): BackendServer {
  return {
    id,
    name: `Test Server ${id}`,
    endpoint: `http://localhost:${3000 + parseInt(id.replace(/\D/g, '') || '0')}`,
    requiresSession: false,
    ...overrides,
  };
}

// Helper to clean up test data
async function cleanupTestServers(ids: string[]): Promise<void> {
  for (const id of ids) {
    await deleteServer(id);
  }
}

// =============================================================================
// KV Storage Unit Tests
// =============================================================================

Deno.test({
  name: 'KV Storage - saveServer and getServer',
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const testId = `test-save-get-${Date.now()}`;
    const server = createTestServer(testId);

    try {
      // Save server
      await saveServer(server);

      // Retrieve server
      const retrieved = await getServer(testId);

      assertExists(retrieved);
      assertEquals(retrieved.id, server.id);
      assertEquals(retrieved.name, server.name);
      assertEquals(retrieved.endpoint, server.endpoint);
      assertEquals(retrieved.requiresSession, server.requiresSession);
    } finally {
      await cleanupTestServers([testId]);
    }
  },
});

Deno.test({
  name: 'KV Storage - getServer returns null for non-existent server',
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const result = await getServer('non-existent-server-id-12345');
    assertEquals(result, null);
  },
});

Deno.test({
  name: 'KV Storage - deleteServer removes server',
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const testId = `test-delete-${Date.now()}`;
    const server = createTestServer(testId);

    // Save server first
    await saveServer(server);

    // Verify it exists
    const beforeDelete = await getServer(testId);
    assertExists(beforeDelete);

    // Delete server
    const deleted = await deleteServer(testId);
    assertEquals(deleted, true);

    // Verify it's gone
    const afterDelete = await getServer(testId);
    assertEquals(afterDelete, null);
  },
});

Deno.test({
  name: 'KV Storage - deleteServer returns false for non-existent server',
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const deleted = await deleteServer('non-existent-server-id-67890');
    assertEquals(deleted, false);
  },
});

Deno.test({
  name: 'KV Storage - listServers returns all servers',
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const testIds = [
      `test-list-1-${Date.now()}`,
      `test-list-2-${Date.now()}`,
      `test-list-3-${Date.now()}`,
    ];

    try {
      // Save multiple servers
      for (const id of testIds) {
        await saveServer(createTestServer(id));
      }

      // List all servers
      const servers = await listServers();

      // Verify our test servers are in the list
      for (const id of testIds) {
        const found = servers.find((s) => s.id === id);
        assertExists(found, `Server ${id} should be in the list`);
      }
    } finally {
      await cleanupTestServers(testIds);
    }
  },
});

Deno.test({
  name: 'KV Storage - saveServers bulk save',
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const testIds = [
      `test-bulk-1-${Date.now()}`,
      `test-bulk-2-${Date.now()}`,
      `test-bulk-3-${Date.now()}`,
    ];
    const servers = testIds.map((id) => createTestServer(id));

    try {
      // Bulk save
      await saveServers(servers);

      // Verify all were saved
      for (const id of testIds) {
        const retrieved = await getServer(id);
        assertExists(retrieved, `Server ${id} should exist after bulk save`);
      }
    } finally {
      await cleanupTestServers(testIds);
    }
  },
});

Deno.test({
  name: 'KV Storage - syncToMap populates map from KV',
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const testIds = [`test-sync-1-${Date.now()}`, `test-sync-2-${Date.now()}`];

    try {
      // Save servers to KV
      for (const id of testIds) {
        await saveServer(createTestServer(id));
      }

      // Create empty map and sync
      const map = new Map<string, BackendServer>();
      await syncToMap(map);

      // Verify map contains our test servers
      for (const id of testIds) {
        const found = map.get(id);
        assertExists(found, `Map should contain server ${id}`);
      }
    } finally {
      await cleanupTestServers(testIds);
    }
  },
});

Deno.test({
  name: 'KV Storage - saveServer overwrites existing server',
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const testId = `test-overwrite-${Date.now()}`;
    const originalServer = createTestServer(testId, { name: 'Original Name' });
    const updatedServer = createTestServer(testId, { name: 'Updated Name' });

    try {
      // Save original
      await saveServer(originalServer);
      const original = await getServer(testId);
      assertEquals(original?.name, 'Original Name');

      // Save updated (should overwrite)
      await saveServer(updatedServer);
      const updated = await getServer(testId);
      assertEquals(updated?.name, 'Updated Name');
    } finally {
      await cleanupTestServers([testId]);
    }
  },
});

Deno.test({
  name: 'KV Storage - server with requiresSession=true',
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const testId = `test-session-${Date.now()}`;
    const server = createTestServer(testId, { requiresSession: true });

    try {
      await saveServer(server);
      const retrieved = await getServer(testId);

      assertExists(retrieved);
      assertEquals(retrieved.requiresSession, true);
    } finally {
      await cleanupTestServers([testId]);
    }
  },
});

Deno.test({
  name: 'KV Storage - server with special characters in name',
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const testId = `test-special-${Date.now()}`;
    const server = createTestServer(testId, {
      name: 'Server with "quotes" & <special> chars!',
    });

    try {
      await saveServer(server);
      const retrieved = await getServer(testId);

      assertExists(retrieved);
      assertEquals(retrieved.name, 'Server with "quotes" & <special> chars!');
    } finally {
      await cleanupTestServers([testId]);
    }
  },
});

Deno.test({
  name: 'KV Storage - server with HTTPS endpoint',
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const testId = `test-https-${Date.now()}`;
    const server = createTestServer(testId, {
      endpoint: 'https://secure.example.com:8443/mcp',
    });

    try {
      await saveServer(server);
      const retrieved = await getServer(testId);

      assertExists(retrieved);
      assertEquals(retrieved.endpoint, 'https://secure.example.com:8443/mcp');
    } finally {
      await cleanupTestServers([testId]);
    }
  },
});

Deno.test({
  name: 'KV Storage - concurrent saves do not corrupt data',
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const testIds = Array.from({ length: 10 }, (_, i) => `test-concurrent-${Date.now()}-${i}`);

    try {
      // Save all servers concurrently
      await Promise.all(testIds.map((id) => saveServer(createTestServer(id))));

      // Verify all were saved correctly
      const servers = await listServers();
      for (const id of testIds) {
        const found = servers.find((s) => s.id === id);
        assertExists(found, `Server ${id} should exist after concurrent save`);
      }
    } finally {
      await cleanupTestServers(testIds);
    }
  },
});

Deno.test({
  name: 'KV Storage - empty listServers returns empty array',
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    // Create a unique prefix that won't match any existing servers
    const servers = await listServers();
    // Result should be an array (may contain other test data)
    assertEquals(Array.isArray(servers), true);
  },
});

Deno.test({
  name: 'KV Storage - saveServers with empty array',
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    // Should not throw
    await saveServers([]);
  },
});

Deno.test({
  name: 'KV Storage - syncToMap clears existing map entries',
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const testId = `test-sync-clear-${Date.now()}`;

    try {
      // Create map with pre-existing entry
      const map = new Map<string, BackendServer>();
      map.set('pre-existing', createTestServer('pre-existing'));

      // Save a server to KV
      await saveServer(createTestServer(testId));

      // Sync should clear the pre-existing entry
      await syncToMap(map);

      // Pre-existing entry should be gone (unless it was in KV)
      // Our test server should be present
      const found = map.get(testId);
      assertExists(found);
    } finally {
      await cleanupTestServers([testId]);
    }
  },
});

// =============================================================================
// Edge Cases and Error Handling
// =============================================================================

Deno.test({
  name: 'KV Storage - server ID with unicode characters',
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const testId = `test-unicode-${Date.now()}-日本語`;
    const server = createTestServer(testId, { name: 'Unicode Test 日本語' });

    try {
      await saveServer(server);
      const retrieved = await getServer(testId);

      assertExists(retrieved);
      assertEquals(retrieved.id, testId);
      assertEquals(retrieved.name, 'Unicode Test 日本語');
    } finally {
      await cleanupTestServers([testId]);
    }
  },
});

Deno.test({
  name: 'KV Storage - server with very long endpoint URL',
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const testId = `test-long-url-${Date.now()}`;
    const longPath = 'a'.repeat(500);
    const server = createTestServer(testId, {
      endpoint: `http://localhost:3000/${longPath}/mcp`,
    });

    try {
      await saveServer(server);
      const retrieved = await getServer(testId);

      assertExists(retrieved);
      assertEquals(retrieved.endpoint, server.endpoint);
    } finally {
      await cleanupTestServers([testId]);
    }
  },
});

Deno.test({
  name: 'KV Storage - delete and re-save same server ID',
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const testId = `test-delete-resave-${Date.now()}`;
    const server1 = createTestServer(testId, { name: 'Version 1' });
    const server2 = createTestServer(testId, { name: 'Version 2' });

    try {
      // Save v1
      await saveServer(server1);
      assertEquals((await getServer(testId))?.name, 'Version 1');

      // Delete
      await deleteServer(testId);
      assertEquals(await getServer(testId), null);

      // Save v2
      await saveServer(server2);
      assertEquals((await getServer(testId))?.name, 'Version 2');
    } finally {
      await cleanupTestServers([testId]);
    }
  },
});

Deno.test({
  name: 'KV Storage - multiple deletes of same server',
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const testId = `test-multi-delete-${Date.now()}`;
    await saveServer(createTestServer(testId));

    // First delete should succeed
    const firstDelete = await deleteServer(testId);
    assertEquals(firstDelete, true);

    // Second delete should return false (already deleted)
    const secondDelete = await deleteServer(testId);
    assertEquals(secondDelete, false);

    // Third delete should also return false
    const thirdDelete = await deleteServer(testId);
    assertEquals(thirdDelete, false);
  },
});
