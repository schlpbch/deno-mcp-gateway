/**
 * Unit tests for MCP Gateway
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

Deno.test('Health endpoint includes backend server status', async () => {
  const req = new Request('http://localhost:8000/health');
  const res = await handler(req);
  const body = await res.json();

  assertEquals(Array.isArray(body.backends), true);
  // Should have at least journey, aareguru, open-meteo
  assertEquals(body.backends.length >= 3, true);
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

// =============================================================================
// Rate Limiting Tests
// =============================================================================

Deno.test('Rate limiting blocks excessive requests', async () => {
  const requests = [];

  // Send 150 requests (limit is 100/min)
  for (let i = 0; i < 150; i++) {
    const req = new Request('http://localhost:8000/health', {
      headers: { 'x-forwarded-for': '192.168.1.100' },
    });
    requests.push(handler(req));
  }

  const responses = await Promise.all(requests);
  const rateLimited = responses.filter((r: Response) => r.status === 429);

  // Should have at least some rate-limited responses
  assertEquals(rateLimited.length > 0, true);
});

// =============================================================================
// Authentication Tests (when API key is set)
// =============================================================================

Deno.test(
  'Protected endpoints require auth when API key is configured',
  async () => {
    // Set API key temporarily
    const originalKey = Deno.env.get('MCP_API_KEY');
    Deno.env.set('MCP_API_KEY', 'test-key-123');

    try {
      const req = new Request('http://localhost:8000/mcp/tools/list');
      const res = await handler(req);

      // Should return 401 without auth header
      assertEquals(res.status, 401);
    } finally {
      // Restore original state
      if (originalKey) {
        Deno.env.set('MCP_API_KEY', originalKey);
      } else {
        Deno.env.delete('MCP_API_KEY');
      }
    }
  }
);

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
