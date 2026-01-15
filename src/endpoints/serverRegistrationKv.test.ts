/**
 * Server Registration Integration Tests with KV Persistence
 *
 * Tests the full flow of server registration, listing, and deletion
 * through HTTP endpoints with KV storage backend.
 */

import { assertEquals, assertExists } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { handler } from '../../main.ts';
import { deleteServer, listServers } from '../kv.ts';
import type { BackendServer } from '../types.ts';

// Helper to create unique test server data
function createTestServerData(suffix: string = '') {
  const uniqueId = `integration-test-${Date.now()}${suffix}`;
  return {
    id: uniqueId,
    name: `Integration Test Server ${suffix}`,
    endpoint: `http://localhost:${3000 + Math.floor(Math.random() * 1000)}/mcp`,
    requiresSession: false,
  };
}

// Helper to clean up test servers from KV
async function cleanupTestServer(id: string): Promise<void> {
  await deleteServer(id);
}

// =============================================================================
// Server Registration Integration Tests
// =============================================================================

Deno.test({
  name: 'Integration - POST /servers/register persists to KV',
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const serverData = createTestServerData('-persist');

    try {
      // Register server via HTTP
      const registerReq = new Request('http://localhost:8000/servers/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serverData),
      });

      const registerRes = await handler(registerReq);
      assertEquals(registerRes.status, 200);

      const registerBody = await registerRes.json();
      assertEquals(registerBody.success, true);

      // Verify server is in KV via GET endpoint
      const listReq = new Request('http://localhost:8000/mcp/servers/register', {
        method: 'GET',
      });

      const listRes = await handler(listReq);
      assertEquals(listRes.status, 200);

      const listBody = await listRes.json();
      const found = listBody.servers.find((s: BackendServer) => s.id === serverData.id);
      assertExists(found, 'Registered server should be in list');
      assertEquals(found.name, serverData.name);
      assertEquals(found.endpoint, serverData.endpoint);
    } finally {
      await cleanupTestServer(serverData.id);
    }
  },
});

Deno.test({
  name: 'Integration - GET /mcp/servers/register returns servers from KV',
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const serverData1 = createTestServerData('-list1');
    const serverData2 = createTestServerData('-list2');

    try {
      // Register two servers
      for (const data of [serverData1, serverData2]) {
        const req = new Request('http://localhost:8000/servers/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        await handler(req);
      }

      // Get list
      const listReq = new Request('http://localhost:8000/mcp/servers/register', {
        method: 'GET',
      });

      const listRes = await handler(listReq);
      assertEquals(listRes.status, 200);

      const listBody = await listRes.json();
      assertEquals(Array.isArray(listBody.servers), true);

      // Both servers should be present
      const found1 = listBody.servers.find((s: BackendServer) => s.id === serverData1.id);
      const found2 = listBody.servers.find((s: BackendServer) => s.id === serverData2.id);
      assertExists(found1, 'First server should be in list');
      assertExists(found2, 'Second server should be in list');
    } finally {
      await cleanupTestServer(serverData1.id);
      await cleanupTestServer(serverData2.id);
    }
  },
});

Deno.test({
  name: 'Integration - DELETE /mcp/servers/{id} removes from KV',
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const serverData = createTestServerData('-delete');

    try {
      // Register server
      const registerReq = new Request('http://localhost:8000/servers/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serverData),
      });
      await handler(registerReq);

      // Verify it exists
      const listReq1 = new Request('http://localhost:8000/mcp/servers/register', {
        method: 'GET',
      });
      const listRes1 = await handler(listReq1);
      const listBody1 = await listRes1.json();
      const foundBefore = listBody1.servers.find((s: BackendServer) => s.id === serverData.id);
      assertExists(foundBefore, 'Server should exist before deletion');

      // Delete server
      const deleteReq = new Request(`http://localhost:8000/mcp/servers/${serverData.id}`, {
        method: 'DELETE',
      });
      const deleteRes = await handler(deleteReq);
      assertEquals(deleteRes.status, 200);

      const deleteBody = await deleteRes.json();
      assertEquals(deleteBody.success, true);

      // Verify it's gone from KV
      const listReq2 = new Request('http://localhost:8000/mcp/servers/register', {
        method: 'GET',
      });
      const listRes2 = await handler(listReq2);
      const listBody2 = await listRes2.json();
      const foundAfter = listBody2.servers.find((s: BackendServer) => s.id === serverData.id);
      assertEquals(foundAfter, undefined, 'Server should not exist after deletion');
    } finally {
      // Cleanup in case test failed
      await cleanupTestServer(serverData.id);
    }
  },
});

Deno.test({
  name: 'Integration - DELETE non-existent server returns 404',
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const deleteReq = new Request(
      `http://localhost:8000/mcp/servers/non-existent-server-${Date.now()}`,
      {
        method: 'DELETE',
      }
    );

    const deleteRes = await handler(deleteReq);
    assertEquals(deleteRes.status, 404);

    const body = await deleteRes.json();
    assertExists(body.error);
  },
});

Deno.test({
  name: 'Integration - Register server with requiresSession=true',
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const serverData = {
      ...createTestServerData('-session'),
      requiresSession: true,
    };

    try {
      // Register server
      const registerReq = new Request('http://localhost:8000/servers/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serverData),
      });

      const registerRes = await handler(registerReq);
      assertEquals(registerRes.status, 200);

      // Verify requiresSession is persisted
      const listReq = new Request('http://localhost:8000/mcp/servers/register', {
        method: 'GET',
      });
      const listRes = await handler(listReq);
      const listBody = await listRes.json();

      const found = listBody.servers.find((s: BackendServer) => s.id === serverData.id);
      assertExists(found);
      assertEquals(found.requiresSession, true);
    } finally {
      await cleanupTestServer(serverData.id);
    }
  },
});

Deno.test({
  name: 'Integration - Register duplicate server ID overwrites',
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const serverData1 = createTestServerData('-dup');
    const serverData2 = { ...serverData1, name: 'Updated Server Name' };

    try {
      // Register first version
      const req1 = new Request('http://localhost:8000/servers/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serverData1),
      });
      await handler(req1);

      // Register second version with same ID
      const req2 = new Request('http://localhost:8000/servers/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serverData2),
      });
      await handler(req2);

      // Verify updated name
      const listReq = new Request('http://localhost:8000/mcp/servers/register', {
        method: 'GET',
      });
      const listRes = await handler(listReq);
      const listBody = await listRes.json();

      const found = listBody.servers.find((s: BackendServer) => s.id === serverData1.id);
      assertExists(found);
      assertEquals(found.name, 'Updated Server Name');
    } finally {
      await cleanupTestServer(serverData1.id);
    }
  },
});

// =============================================================================
// Validation Tests
// =============================================================================

Deno.test({
  name: 'Integration - Register server with missing id returns 400',
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const req = new Request('http://localhost:8000/servers/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Server',
        endpoint: 'http://localhost:3000',
      }),
    });

    const res = await handler(req);
    assertEquals(res.status, 400);

    const body = await res.json();
    assertExists(body.error);
  },
});

Deno.test({
  name: 'Integration - Register server with missing name returns 400',
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const req = new Request('http://localhost:8000/servers/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'test-missing-name',
        endpoint: 'http://localhost:3000',
      }),
    });

    const res = await handler(req);
    assertEquals(res.status, 400);

    const body = await res.json();
    assertExists(body.error);
  },
});

Deno.test({
  name: 'Integration - Register server with missing endpoint returns 400',
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const req = new Request('http://localhost:8000/servers/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'test-missing-endpoint',
        name: 'Test Server',
      }),
    });

    const res = await handler(req);
    assertEquals(res.status, 400);

    const body = await res.json();
    assertExists(body.error);
  },
});

Deno.test({
  name: 'Integration - Register server with invalid endpoint URL returns 400',
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const req = new Request('http://localhost:8000/servers/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'test-invalid-url',
        name: 'Test Server',
        endpoint: 'not-a-valid-url',
      }),
    });

    const res = await handler(req);
    assertEquals(res.status, 400);

    const body = await res.json();
    assertExists(body.error);
  },
});

// =============================================================================
// Concurrent Operations Tests
// =============================================================================

Deno.test({
  name: 'Integration - Concurrent registrations do not corrupt data',
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const serverIds: string[] = [];
    const numServers = 5;

    try {
      // Create server data
      const serverDataArray = Array.from({ length: numServers }, (_, i) => {
        const data = createTestServerData(`-concurrent-${i}`);
        serverIds.push(data.id);
        return data;
      });

      // Register all concurrently
      const registerPromises = serverDataArray.map((data) => {
        const req = new Request('http://localhost:8000/servers/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        return handler(req);
      });

      const responses = await Promise.all(registerPromises);

      // All should succeed
      for (const res of responses) {
        assertEquals(res.status, 200);
      }

      // Verify all are in KV
      const listReq = new Request('http://localhost:8000/mcp/servers/register', {
        method: 'GET',
      });
      const listRes = await handler(listReq);
      const listBody = await listRes.json();

      for (const id of serverIds) {
        const found = listBody.servers.find((s: BackendServer) => s.id === id);
        assertExists(found, `Server ${id} should be in list after concurrent registration`);
      }
    } finally {
      for (const id of serverIds) {
        await cleanupTestServer(id);
      }
    }
  },
});

Deno.test({
  name: 'Integration - Register and immediately list',
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const serverData = createTestServerData('-immediate');

    try {
      // Register server
      const registerReq = new Request('http://localhost:8000/servers/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serverData),
      });
      const registerRes = await handler(registerReq);
      assertEquals(registerRes.status, 200);

      // Immediately list (no delay)
      const listReq = new Request('http://localhost:8000/mcp/servers/register', {
        method: 'GET',
      });
      const listRes = await handler(listReq);
      const listBody = await listRes.json();

      // Server should be immediately available
      const found = listBody.servers.find((s: BackendServer) => s.id === serverData.id);
      assertExists(found, 'Server should be immediately available after registration');
    } finally {
      await cleanupTestServer(serverData.id);
    }
  },
});

// =============================================================================
// CORS and Headers Tests
// =============================================================================

Deno.test({
  name: 'Integration - GET /mcp/servers/register has CORS headers',
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const req = new Request('http://localhost:8000/mcp/servers/register', {
      method: 'GET',
    });

    const res = await handler(req);
    assertEquals(res.status, 200);

    // Check CORS headers
    assertEquals(res.headers.get('Access-Control-Allow-Origin'), '*');
    assertExists(res.headers.get('Access-Control-Allow-Methods'));
  },
});

Deno.test({
  name: 'Integration - GET /mcp/servers/register has JSON content type',
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const req = new Request('http://localhost:8000/mcp/servers/register', {
      method: 'GET',
    });

    const res = await handler(req);
    assertEquals(res.status, 200);

    const contentType = res.headers.get('Content-Type');
    assertExists(contentType);
    assertEquals(contentType.includes('application/json'), true);
  },
});
