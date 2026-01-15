/**
 * Server Configuration Upload Tests with KV Persistence
 *
 * Tests the bulk upload functionality via multipart form data
 * with KV storage backend.
 */

import { assertEquals, assertExists } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { handler } from '../../main.ts';
import { deleteServer, listServers } from '../kv.ts';
import type { BackendServer } from '../types.ts';

// Helper to create multipart form data
function createMultipartBody(config: object, boundary: string): string {
  const configJson = JSON.stringify(config);
  return (
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="config"; filename="servers-config.json"\r\n` +
    `Content-Type: application/json\r\n` +
    `\r\n` +
    `${configJson}\r\n` +
    `--${boundary}--\r\n`
  );
}

// Helper to create unique test server config
function createTestServerConfig(suffix: string = '') {
  const timestamp = Date.now();
  return {
    servers: [
      {
        id: `upload-test-1-${timestamp}${suffix}`,
        name: `Upload Test Server 1 ${suffix}`,
        endpoint: 'http://localhost:3001/mcp',
        requiresSession: false,
      },
      {
        id: `upload-test-2-${timestamp}${suffix}`,
        name: `Upload Test Server 2 ${suffix}`,
        endpoint: 'http://localhost:3002/mcp',
        requiresSession: true,
      },
    ],
  };
}

// Helper to clean up test servers
async function cleanupTestServers(ids: string[]): Promise<void> {
  for (const id of ids) {
    await deleteServer(id);
  }
}

// =============================================================================
// Bulk Upload Integration Tests
// =============================================================================

Deno.test({
  name: 'Upload - POST /mcp/servers/upload persists servers to KV',
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const config = createTestServerConfig('-persist');
    const serverIds = config.servers.map((s) => s.id);
    const boundary = '----WebKitFormBoundary' + Date.now();

    try {
      const body = createMultipartBody(config, boundary);

      const req = new Request('http://localhost:8000/mcp/servers/upload', {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: body,
      });

      const res = await handler(req);
      assertEquals(res.status, 200);

      const resBody = await res.json();
      assertEquals(resBody.success, true);
      assertEquals(resBody.uploaded, 2);

      // Verify servers are in KV
      const listReq = new Request('http://localhost:8000/mcp/servers/register', {
        method: 'GET',
      });
      const listRes = await handler(listReq);
      const listBody = await listRes.json();

      for (const serverId of serverIds) {
        const found = listBody.servers.find((s: BackendServer) => s.id === serverId);
        assertExists(found, `Server ${serverId} should be in list after upload`);
      }
    } finally {
      await cleanupTestServers(serverIds);
    }
  },
});

Deno.test({
  name: 'Upload - requiresSession is preserved in KV',
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const config = createTestServerConfig('-session');
    const serverIds = config.servers.map((s) => s.id);
    const boundary = '----WebKitFormBoundary' + Date.now();

    try {
      const body = createMultipartBody(config, boundary);

      const req = new Request('http://localhost:8000/mcp/servers/upload', {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: body,
      });

      await handler(req);

      // Verify requiresSession values
      const listReq = new Request('http://localhost:8000/mcp/servers/register', {
        method: 'GET',
      });
      const listRes = await handler(listReq);
      const listBody = await listRes.json();

      const server1 = listBody.servers.find((s: BackendServer) => s.id === serverIds[0]);
      const server2 = listBody.servers.find((s: BackendServer) => s.id === serverIds[1]);

      assertExists(server1);
      assertExists(server2);
      assertEquals(server1.requiresSession, false);
      assertEquals(server2.requiresSession, true);
    } finally {
      await cleanupTestServers(serverIds);
    }
  },
});

Deno.test({
  name: 'Upload - Uploaded servers can be deleted',
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const config = createTestServerConfig('-deletable');
    const serverIds = config.servers.map((s) => s.id);
    const boundary = '----WebKitFormBoundary' + Date.now();

    try {
      // Upload servers
      const uploadBody = createMultipartBody(config, boundary);
      const uploadReq = new Request('http://localhost:8000/mcp/servers/upload', {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: uploadBody,
      });
      await handler(uploadReq);

      // Delete first server
      const deleteReq = new Request(`http://localhost:8000/mcp/servers/${serverIds[0]}`, {
        method: 'DELETE',
      });
      const deleteRes = await handler(deleteReq);
      assertEquals(deleteRes.status, 200);

      // Verify first is gone, second remains
      const listReq = new Request('http://localhost:8000/mcp/servers/register', {
        method: 'GET',
      });
      const listRes = await handler(listReq);
      const listBody = await listRes.json();

      const found1 = listBody.servers.find((s: BackendServer) => s.id === serverIds[0]);
      const found2 = listBody.servers.find((s: BackendServer) => s.id === serverIds[1]);

      assertEquals(found1, undefined, 'First server should be deleted');
      assertExists(found2, 'Second server should remain');
    } finally {
      await cleanupTestServers(serverIds);
    }
  },
});

Deno.test({
  name: 'Upload - Empty servers array succeeds',
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const config = { servers: [] };
    const boundary = '----WebKitFormBoundary' + Date.now();
    const body = createMultipartBody(config, boundary);

    const req = new Request('http://localhost:8000/mcp/servers/upload', {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: body,
    });

    const res = await handler(req);
    assertEquals(res.status, 200);

    const resBody = await res.json();
    assertEquals(resBody.success, true);
    assertEquals(resBody.uploaded, 0);
  },
});

Deno.test({
  name: 'Upload - Single server upload',
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const serverId = `upload-single-${Date.now()}`;
    const config = {
      servers: [
        {
          id: serverId,
          name: 'Single Upload Server',
          endpoint: 'http://localhost:3000/mcp',
          requiresSession: false,
        },
      ],
    };
    const boundary = '----WebKitFormBoundary' + Date.now();

    try {
      const body = createMultipartBody(config, boundary);

      const req = new Request('http://localhost:8000/mcp/servers/upload', {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: body,
      });

      const res = await handler(req);
      assertEquals(res.status, 200);

      const resBody = await res.json();
      assertEquals(resBody.uploaded, 1);

      // Verify in KV
      const listReq = new Request('http://localhost:8000/mcp/servers/register', {
        method: 'GET',
      });
      const listRes = await handler(listReq);
      const listBody = await listRes.json();

      const found = listBody.servers.find((s: BackendServer) => s.id === serverId);
      assertExists(found);
    } finally {
      await cleanupTestServers([serverId]);
    }
  },
});

Deno.test({
  name: 'Upload - Many servers upload',
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const timestamp = Date.now();
    const serverIds: string[] = [];
    const servers = Array.from({ length: 10 }, (_, i) => {
      const id = `upload-many-${timestamp}-${i}`;
      serverIds.push(id);
      return {
        id,
        name: `Many Upload Server ${i}`,
        endpoint: `http://localhost:${3000 + i}/mcp`,
        requiresSession: i % 2 === 0,
      };
    });

    const config = { servers };
    const boundary = '----WebKitFormBoundary' + Date.now();

    try {
      const body = createMultipartBody(config, boundary);

      const req = new Request('http://localhost:8000/mcp/servers/upload', {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: body,
      });

      const res = await handler(req);
      assertEquals(res.status, 200);

      const resBody = await res.json();
      assertEquals(resBody.uploaded, 10);

      // Verify all in KV
      const listReq = new Request('http://localhost:8000/mcp/servers/register', {
        method: 'GET',
      });
      const listRes = await handler(listReq);
      const listBody = await listRes.json();

      for (const serverId of serverIds) {
        const found = listBody.servers.find((s: BackendServer) => s.id === serverId);
        assertExists(found, `Server ${serverId} should be in list`);
      }
    } finally {
      await cleanupTestServers(serverIds);
    }
  },
});

// =============================================================================
// Error Handling Tests
// =============================================================================

Deno.test({
  name: 'Upload - Invalid content type returns 400',
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const req = new Request('http://localhost:8000/mcp/servers/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ servers: [] }),
    });

    const res = await handler(req);
    assertEquals(res.status, 400);

    const body = await res.json();
    assertExists(body.error);
  },
});

Deno.test({
  name: 'Upload - Missing boundary returns 400',
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const req = new Request('http://localhost:8000/mcp/servers/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      body: 'some data',
    });

    const res = await handler(req);
    assertEquals(res.status, 400);

    const body = await res.json();
    assertExists(body.error);
  },
});

Deno.test({
  name: 'Upload - Invalid JSON in config returns 400 or 500',
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const boundary = '----WebKitFormBoundary' + Date.now();
    const body =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="config"; filename="servers-config.json"\r\n` +
      `Content-Type: application/json\r\n` +
      `\r\n` +
      `{invalid json}\r\n` +
      `--${boundary}--\r\n`;

    const req = new Request('http://localhost:8000/mcp/servers/upload', {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: body,
    });

    const res = await handler(req);
    // Should return error status (400 or 500 depending on implementation)
    assertEquals(res.status >= 400, true);
  },
});

Deno.test({
  name: 'Upload - Missing config file returns 400',
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const boundary = '----WebKitFormBoundary' + Date.now();
    const body =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="other"; filename="other.txt"\r\n` +
      `Content-Type: text/plain\r\n` +
      `\r\n` +
      `some text\r\n` +
      `--${boundary}--\r\n`;

    const req = new Request('http://localhost:8000/mcp/servers/upload', {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: body,
    });

    const res = await handler(req);
    assertEquals(res.status, 400);

    const resBody = await res.json();
    assertExists(resBody.error);
  },
});

// =============================================================================
// Re-upload and Update Tests
// =============================================================================

Deno.test({
  name: 'Upload - Re-uploading updates existing servers',
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const timestamp = Date.now();
    const serverId = `upload-reupload-${timestamp}`;
    const boundary = '----WebKitFormBoundary' + timestamp;

    try {
      // First upload
      const config1 = {
        servers: [
          {
            id: serverId,
            name: 'Original Name',
            endpoint: 'http://localhost:3000/mcp',
            requiresSession: false,
          },
        ],
      };

      const req1 = new Request('http://localhost:8000/mcp/servers/upload', {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: createMultipartBody(config1, boundary),
      });
      await handler(req1);

      // Second upload with updated name
      const config2 = {
        servers: [
          {
            id: serverId,
            name: 'Updated Name',
            endpoint: 'http://localhost:3000/mcp',
            requiresSession: true,
          },
        ],
      };

      const req2 = new Request('http://localhost:8000/mcp/servers/upload', {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: createMultipartBody(config2, boundary),
      });
      await handler(req2);

      // Verify updated values
      const listReq = new Request('http://localhost:8000/mcp/servers/register', {
        method: 'GET',
      });
      const listRes = await handler(listReq);
      const listBody = await listRes.json();

      const found = listBody.servers.find((s: BackendServer) => s.id === serverId);
      assertExists(found);
      assertEquals(found.name, 'Updated Name');
      assertEquals(found.requiresSession, true);
    } finally {
      await cleanupTestServers([serverId]);
    }
  },
});
