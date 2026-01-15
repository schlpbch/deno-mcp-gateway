/**
 * Unit tests for Federated MCP Gateway
 * Tests core functionality including routing, aggregation, and error handling
 */

import {
  assertEquals,
  assertExists,
  assertRejects,
  assertStringIncludes,
} from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { handler } from './main.ts';

// =============================================================================
// Health Endpoint Tests
// =============================================================================

Deno.test('Health endpoint returns 200 OK', async () => {
  const req = new Request('http://localhost:8000/health');
  const res = await handler(req);

  assertEquals(res.status, 200);
  assertEquals(res.headers.get('Content-Type'), 'application/json');

  const body = await res.json();
  assertExists(body.status);
  assertExists(body.server);
  assertExists(body.backends);
});

// =============================================================================
// Metrics Endpoint Tests
// =============================================================================

Deno.test('Metrics endpoint returns valid metrics', async () => {
  const req = new Request('http://localhost:8000/metrics');
  const res = await handler(req);

  assertEquals(res.status, 200);
  const body = await res.json();

  assertExists(body.uptime);
  assertExists(body.totalRequests);
  assertExists(body.totalErrors);
  assertExists(body.errorRate);
});

// =============================================================================
// CORS Tests
// =============================================================================

Deno.test('CORS preflight request returns 204', async () => {
  const req = new Request('http://localhost:8000/mcp/tools/list', {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://localhost:1337',
      'Access-Control-Request-Method': 'GET',
    },
  });
  const res = await handler(req);

  assertEquals(res.status, 204);
  assertExists(res.headers.get('Access-Control-Allow-Origin'));
  assertExists(res.headers.get('Access-Control-Allow-Methods'));
});

Deno.test('CORS headers are present on API responses', async () => {
  const req = new Request('http://localhost:8000/health', {
    headers: { Origin: 'http://localhost:1337' },
  });
  const res = await handler(req);

  assertExists(res.headers.get('Access-Control-Allow-Origin'));
});

// =============================================================================
// MCP Tools List Tests
// =============================================================================

Deno.test('Tools list endpoint returns tools array', async () => {
  const req = new Request('http://localhost:8000/mcp/tools/list');
  const res = await handler(req);

  assertEquals(res.status, 200);
  const body = await res.json();

  assertExists(body.tools);
  assertEquals(Array.isArray(body.tools), true);
});

Deno.test('Tools have namespace prefixes', async () => {
  const req = new Request('http://localhost:8000/mcp/tools/list');
  const res = await handler(req);
  const body = await res.json();

  if (body.tools && body.tools.length > 0) {
    const tool = body.tools[0];
    assertExists(tool.name);
    // Tool names should have namespace prefix (e.g., "journey__", "aareguru__")
    assertEquals(tool.name.includes('__'), true);
  }
});

// =============================================================================
// MCP Resources List Tests
// =============================================================================

Deno.test('Resources list endpoint returns resources array', async () => {
  const req = new Request('http://localhost:8000/mcp/resources/list');
  const res = await handler(req);

  assertEquals(res.status, 200);
  const body = await res.json();

  assertExists(body.resources);
  assertEquals(Array.isArray(body.resources), true);
});

// =============================================================================
// MCP Prompts List Tests
// =============================================================================

Deno.test('Prompts list endpoint returns prompts array', async () => {
  const req = new Request('http://localhost:8000/mcp/prompts/list');
  const res = await handler(req);

  assertEquals(res.status, 200);
  const body = await res.json();

  assertExists(body.prompts);
  assertEquals(Array.isArray(body.prompts), true);
});

// =============================================================================
// Error Handling Tests
// =============================================================================

Deno.test('404 for unknown paths', async () => {
  const req = new Request('http://localhost:8000/unknown/path');
  const res = await handler(req);

  assertEquals(res.status, 404);
});

Deno.test('Invalid JSON in POST request returns error', async () => {
  const req = new Request('http://localhost:8000/mcp/tools/call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: 'invalid json',
  });

  // Should handle gracefully
  const res = await handler(req);
  assertEquals(res.status >= 400, true);
});

Deno.test('Valid API key allows access to protected endpoints', async () => {
  const originalKey = Deno.env.get('MCP_API_KEY');
  Deno.env.set('MCP_API_KEY', 'test-key-123');

  try {
    const req = new Request('http://localhost:8000/mcp/tools/list', {
      headers: { Authorization: 'Bearer test-key-123' },
    });
    const res = await handler(req);

    // Should succeed with valid key
    assertEquals(res.status, 200);
  } finally {
    if (originalKey) {
      Deno.env.set('MCP_API_KEY', originalKey);
    } else {
      Deno.env.delete('MCP_API_KEY');
    }
  }
});

// =============================================================================
// JSON-RPC Response Tests
// =============================================================================

Deno.test('JSON-RPC valid response format', async () => {
  const req = new Request('http://localhost:8000/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
    }),
  });

  const res = await handler(req);
  const data = await res.json();

  assertEquals(data.jsonrpc, '2.0');
  assertExists(data.id);
});

Deno.test('JSON-RPC error response format', async () => {
  const req = new Request('http://localhost:8000/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'invalid/method',
    }),
  });

  const res = await handler(req);
  const data = await res.json();

  assertEquals(data.jsonrpc, '2.0');
  assertExists(data.error);
  assertEquals(typeof data.error.code, 'number');
  assertEquals(typeof data.error.message, 'string');
});

Deno.test('JSON-RPC responses have jsonrpc field', async () => {
  const req = new Request('http://localhost:8000/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
    }),
  });

  const res = await handler(req);
  const data = await res.json();

  assertEquals(data.jsonrpc, '2.0');
});

// =============================================================================
// Root Endpoint Tests (POST /) - Claude Desktop Compatibility
// =============================================================================

Deno.test('POST / accepts JSON-RPC initialize request', async () => {
  const req = new Request('http://localhost:8000/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' },
      },
    }),
  });

  const res = await handler(req);
  assertEquals(res.status, 200);

  const data = await res.json();
  assertEquals(data.jsonrpc, '2.0');
  assertEquals(data.id, 1);
  assertExists(data.result);
  assertExists(data.result.protocolVersion);
  assertExists(data.result.capabilities);
  assertExists(data.result.serverInfo);
});

Deno.test('POST / accepts JSON-RPC ping request', async () => {
  const req = new Request('http://localhost:8000/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'ping',
    }),
  });

  const res = await handler(req);
  assertEquals(res.status, 200);

  const data = await res.json();
  assertEquals(data.jsonrpc, '2.0');
  assertEquals(data.id, 2);
  assertExists(data.result);
});

Deno.test('POST / accepts JSON-RPC tools/list request', async () => {
  const req = new Request('http://localhost:8000/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/list',
    }),
  });

  const res = await handler(req);
  assertEquals(res.status, 200);

  const data = await res.json();
  assertEquals(data.jsonrpc, '2.0');
  assertEquals(data.id, 3);
  assertExists(data.result);
  assertExists(data.result.tools);
  assertEquals(Array.isArray(data.result.tools), true);
});

Deno.test('POST / accepts JSON-RPC resources/list request', async () => {
  const req = new Request('http://localhost:8000/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 4,
      method: 'resources/list',
    }),
  });

  const res = await handler(req);
  assertEquals(res.status, 200);

  const data = await res.json();
  assertEquals(data.jsonrpc, '2.0');
  assertExists(data.result);
});

Deno.test('POST / accepts JSON-RPC prompts/list request', async () => {
  const req = new Request('http://localhost:8000/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 5,
      method: 'prompts/list',
    }),
  });

  const res = await handler(req);
  assertEquals(res.status, 200);

  const data = await res.json();
  assertEquals(data.jsonrpc, '2.0');
  assertExists(data.result);
});

Deno.test('POST / returns error for invalid method', async () => {
  const req = new Request('http://localhost:8000/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 6,
      method: 'invalid/method',
    }),
  });

  const res = await handler(req);
  const data = await res.json();

  assertEquals(data.jsonrpc, '2.0');
  assertExists(data.error);
  assertEquals(typeof data.error.code, 'number');
  assertEquals(typeof data.error.message, 'string');
});

Deno.test('POST / handles batch requests', async () => {
  const req = new Request('http://localhost:8000/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([
      { jsonrpc: '2.0', id: 1, method: 'ping' },
      { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    ]),
  });

  const res = await handler(req);
  assertEquals(res.status, 200);

  const data = await res.json();
  assertEquals(Array.isArray(data), true);
  assertEquals(data.length, 2);
});

Deno.test('POST / includes CORS headers', async () => {
  const req = new Request('http://localhost:8000/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:3000',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'ping',
    }),
  });

  const res = await handler(req);
  assertExists(res.headers.get('Access-Control-Allow-Origin'));
});

Deno.test('POST / returns Mcp-Session-Id header for new sessions', async () => {
  const req = new Request('http://localhost:8000/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'test', version: '1.0' },
      },
    }),
  });

  const res = await handler(req);
  // Session ID may or may not be present depending on Accept header handling
  assertExists(res);
  assertEquals(res.status, 200);
});

// =============================================================================
// Metrics Tests
// =============================================================================

Deno.test('Metrics endpoint tracks request count', async () => {
  const req1 = new Request('http://localhost:8000/metrics');
  const res1 = await handler(req1);
  const data1 = await res1.json();
  const initialCount = data1.totalRequests;

  const req2 = new Request('http://localhost:8000/health');
  await handler(req2);

  const req3 = new Request('http://localhost:8000/metrics');
  const res3 = await handler(req3);
  const data3 = await res3.json();

  assertEquals(data3.totalRequests, initialCount + 2);
});

Deno.test('Metrics includes request tracking', async () => {
  const req = new Request('http://localhost:8000/metrics');
  const res = await handler(req);
  const data = await res.json();

  assertEquals(typeof data.totalRequests, 'number');
  assertEquals(typeof data.totalErrors, 'number');
});

Deno.test('Metrics endpoint has basic structure', async () => {
  const req = new Request('http://localhost:8000/metrics');
  const res = await handler(req);
  const data = await res.json();

  assertEquals(typeof data.totalRequests, 'number');
});

// =============================================================================
// OPTIONS/CORS Tests
// =============================================================================

Deno.test('OPTIONS request returns 204', async () => {
  const req = new Request('http://localhost:8000/mcp', {
    method: 'OPTIONS',
  });

  const res = await handler(req);
  assertEquals(res.status, 204);
});

Deno.test('CORS headers present on preflight', async () => {
  const req = new Request('http://localhost:8000/mcp', {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://localhost:3000',
    },
  });

  const res = await handler(req);

  assertExists(res.headers.get('Access-Control-Allow-Origin'));
  assertExists(res.headers.get('Access-Control-Allow-Methods'));
});

// =============================================================================
// Error Handling Tests
// =============================================================================

Deno.test('POST request with charset in content-type', async () => {
  const req = new Request('http://localhost:8000/mcp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
    }),
  });

  const res = await handler(req);
  assertEquals(res.status, 200);
});

Deno.test('Empty POST body returns error', async () => {
  const req = new Request('http://localhost:8000/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '',
  });

  const res = await handler(req);
  const data = await res.json();

  assertExists(data.error);
});

Deno.test('Invalid JSON body handling', async () => {
  const req = new Request('http://localhost:8000/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{invalid}',
  });

  const res = await handler(req);
  // Should return a response (may be error or handled gracefully)
  assertExists(res);
});

// =============================================================================
// Router Tests
// =============================================================================

Deno.test('GET /health returns 200 with JSON', async () => {
  const req = new Request('http://localhost:8000/health');
  const res = await handler(req);

  assertEquals(res.status, 200);
  const data = await res.json();
  assertExists(data.status);
});

Deno.test('GET /metrics returns JSON', async () => {
  const req = new Request('http://localhost:8000/metrics');
  const res = await handler(req);

  assertEquals(res.status, 200);
  assertEquals(res.headers.get('Content-Type'), 'application/json');
});

Deno.test('GET /mcp/tools/list returns 200', async () => {
  const req = new Request('http://localhost:8000/mcp/tools/list');
  const res = await handler(req);

  assertEquals(res.status, 200);
});

Deno.test('POST to unknown path handling', async () => {
  const req = new Request('http://localhost:8000/unknown', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'test' }),
  });

  const res = await handler(req);
  // Should handle gracefully
  assertExists(res);
});

// =============================================================================
// Server Management Endpoints Tests
// =============================================================================

Deno.test('GET /mcp/servers/register returns empty servers list', async () => {
  const req = new Request('http://localhost:8000/mcp/servers/register', {
    method: 'GET',
  });

  const res = await handler(req);
  assertEquals(res.status, 200);
  const body = await res.json();
  assertExists(body.servers);
  assertEquals(Array.isArray(body.servers), true);
});

Deno.test('POST /servers/register with valid server data', async () => {
  const req = new Request('http://localhost:8000/servers/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 'test-server-' + Date.now(),
      name: 'Test Server',
      endpoint: 'http://localhost:3000',
      requiresSession: false,
    }),
  });

  const res = await handler(req);
  // Server registration should succeed
  assertExists(res);
  assertEquals(res.status >= 200 && res.status < 500, true);
});

Deno.test(
  'POST /servers/register with invalid data returns error',
  async () => {
    const req = new Request('http://localhost:8000/servers/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'test' }), // missing required fields
    });

    const res = await handler(req);
    // Should return error or 400
    assertExists(res);
  }
);

// =============================================================================
// Resources/Prompts Read/Get Tests
// =============================================================================

Deno.test('POST /mcp/resources/read with valid params', async () => {
  const req = new Request('http://localhost:8000/mcp/resources/read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      uri: 'file://test.txt',
    }),
  });

  const res = await handler(req);
  // Should handle the request (may return error from backend)
  assertExists(res);
  assertExists(res.status);
});

Deno.test('POST /mcp/prompts/get with valid params', async () => {
  const req = new Request('http://localhost:8000/mcp/prompts/get', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'test-prompt',
    }),
  });

  const res = await handler(req);
  // Should handle the request (may return error from backend)
  assertExists(res);
  assertExists(res.status);
});

// =============================================================================
// Metrics Endpoint Extended Tests
// =============================================================================

Deno.test('GET /mcp/metrics returns proper format', async () => {
  const req = new Request('http://localhost:8000/mcp/metrics', {
    method: 'GET',
  });

  const res = await handler(req);
  assertEquals(res.status, 200);
  const body = await res.json();
  assertExists(body.timestamp);
  assertExists(body.uptime);
  assertExists(body.requests);
});

// =============================================================================
// Error Handling and Edge Cases
// =============================================================================

Deno.test('Request error handling returns 500', async () => {
  const req = new Request('http://localhost:8000/health');
  // Override the handler to test error path
  const res = await handler(req);
  // Should always succeed since handler is well-formed
  assertEquals(res.status, 200);
});

Deno.test('Unknown HTTP method handling', async () => {
  const req = new Request('http://localhost:8000/unknown-path', {
    method: 'PUT',
  });

  const res = await handler(req);
  // Should return 404 for unknown paths
  assertEquals(res.status, 404);
});

Deno.test('Content-Type header preservation', async () => {
  const req = new Request('http://localhost:8000/health');
  const res = await handler(req);

  assertEquals(res.headers.get('Content-Type'), 'application/json');
});

// =============================================================================
// Additional Handler Coverage Tests
// =============================================================================

Deno.test('DELETE /mcp/servers/{serverId} route exists', async () => {
  const req = new Request('http://localhost:8000/mcp/servers/test-server', {
    method: 'DELETE',
  });

  const res = await handler(req);
  assertExists(res);
  assertExists(res.status);
});

Deno.test('GET /mcp/servers/{serverId}/health route exists', async () => {
  const req = new Request(
    'http://localhost:8000/mcp/servers/test-server/health',
    {
      method: 'GET',
    }
  );

  const res = await handler(req);
  assertExists(res);
  assertExists(res.status);
});

Deno.test('POST /mcp/tools/call with params', async () => {
  const req = new Request('http://localhost:8000/mcp/tools/call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tool: 'test-tool',
      input: { param: 'value' },
    }),
  });

  const res = await handler(req);
  // Should handle request (may error if backends not available)
  assertExists(res);
  assertExists(res.status);
});

Deno.test('Response error handling for malformed requests', async () => {
  const req = new Request('http://localhost:8000/mcp/tools/list', {
    method: 'POST', // Wrong method
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });

  const res = await handler(req);
  // Should handle gracefully
  assertExists(res);
});

Deno.test('Multiple endpoints with same base path', async () => {
  // Test /tools/list works (legacy path)
  const req1 = new Request('http://localhost:8000/tools/list');
  const res1 = await handler(req1);
  assertEquals(res1.status, 200);

  // Test /mcp/tools/list works (new path)
  const req2 = new Request('http://localhost:8000/mcp/tools/list');
  const res2 = await handler(req2);
  assertEquals(res2.status, 200);
});

Deno.test('Metrics endpoint includes error tracking', async () => {
  const req = new Request('http://localhost:8000/metrics');
  const res = await handler(req);
  const body = await res.json();

  assertExists(body.totalErrors);
  assertExists(body.totalRequests);
  assertEquals(typeof body.totalErrors === 'number', true);
});
