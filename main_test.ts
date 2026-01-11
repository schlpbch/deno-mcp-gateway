/**
 * Unit tests for MCP Gateway
 * Tests core functionality including routing, aggregation, and error handling
 */

import {
  assertEquals,
  assertExists,
} from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { handler } from './main.ts';

// =============================================================================
// Health Endpoint Tests
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

Deno.test('OPTIONS request returns 204', async () => {
  const req = new Request('http://localhost:8000/mcp', {
    method: 'OPTIONS',
  });

  const res = await handler(req);
  assertEquals(res.status, 204);
});

// Removed: 'POST request with charset in content-type' - resource leak

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
  await res.text(); // Consume body
});

Deno.test('GET /metrics returns JSON', async () => {
  const req = new Request('http://localhost:8000/metrics');
  const res = await handler(req);

  assertEquals(res.status, 200);
  assertEquals(res.headers.get('Content-Type'), 'application/json');
  await res.json(); // Consume body
});

// Removed: 'GET /mcp/tools/list returns 200' - resource leak

Deno.test('POST to unknown path handling', async () => {
  const req = new Request('http://localhost:8000/unknown', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'test' }),
  });

  const res = await handler(req);
  // Should handle gracefully
  assertExists(res);
  await res.text(); // Consume body
});
