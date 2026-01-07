import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { RequestMetrics, RequestTimer } from './RequestMetrics.ts';

/**
 * Tests for RequestMetrics and RequestTimer
 */

// Reset metrics before each test group
function resetMetrics(): void {
  RequestMetrics.getInstance().reset();
}

// ================== REQUEST METRICS TESTS ==================

Deno.test('RequestMetrics - singleton instance', () => {
  const instance1 = RequestMetrics.getInstance();
  const instance2 = RequestMetrics.getInstance();
  assertEquals(instance1, instance2);
});

Deno.test('RequestMetrics - records request timing', () => {
  resetMetrics();
  const metrics = RequestMetrics.getInstance();

  metrics.record({
    endpoint: '/mcp/tools/list',
    method: 'GET',
    duration: 100,
    cacheHit: false,
    timestamp: new Date(),
    status: 'success',
  });

  const stats = metrics.getEndpointStats('GET', '/mcp/tools/list');
  assertEquals(stats?.totalRequests, 1);
  assertEquals(stats?.successCount, 1);
  assertEquals(stats?.errorCount, 0);
});

Deno.test('RequestMetrics - tracks errors separately', () => {
  resetMetrics();
  const metrics = RequestMetrics.getInstance();

  metrics.record({
    endpoint: '/mcp/tools/call',
    method: 'POST',
    duration: 50,
    cacheHit: false,
    timestamp: new Date(),
    status: 'success',
  });

  metrics.record({
    endpoint: '/mcp/tools/call',
    method: 'POST',
    duration: 200,
    cacheHit: false,
    timestamp: new Date(),
    status: 'error',
  });

  const stats = metrics.getEndpointStats('POST', '/mcp/tools/call');
  assertEquals(stats?.totalRequests, 2);
  assertEquals(stats?.successCount, 1);
  assertEquals(stats?.errorCount, 1);
});

Deno.test('RequestMetrics - tracks cache hits', () => {
  resetMetrics();
  const metrics = RequestMetrics.getInstance();

  metrics.record({
    endpoint: '/mcp/tools/list',
    method: 'GET',
    duration: 5,
    cacheHit: true,
    timestamp: new Date(),
    status: 'success',
  });

  metrics.record({
    endpoint: '/mcp/tools/list',
    method: 'GET',
    duration: 100,
    cacheHit: false,
    timestamp: new Date(),
    status: 'success',
  });

  const stats = metrics.getEndpointStats('GET', '/mcp/tools/list');
  assertEquals(stats?.cacheHits, 1);
  assertEquals(stats?.cacheMisses, 1);
});

Deno.test('RequestMetrics - calculates min/max duration', () => {
  resetMetrics();
  const metrics = RequestMetrics.getInstance();

  metrics.record({
    endpoint: '/test',
    method: 'GET',
    duration: 100,
    cacheHit: false,
    timestamp: new Date(),
    status: 'success',
  });

  metrics.record({
    endpoint: '/test',
    method: 'GET',
    duration: 50,
    cacheHit: false,
    timestamp: new Date(),
    status: 'success',
  });

  metrics.record({
    endpoint: '/test',
    method: 'GET',
    duration: 200,
    cacheHit: false,
    timestamp: new Date(),
    status: 'success',
  });

  const stats = metrics.getEndpointStats('GET', '/test');
  assertEquals(stats?.minDuration, 50);
  assertEquals(stats?.maxDuration, 200);
});

Deno.test('RequestMetrics - getSummary returns aggregate stats', () => {
  resetMetrics();
  const metrics = RequestMetrics.getInstance();

  // Add some requests
  for (let i = 0; i < 5; i++) {
    metrics.record({
      endpoint: '/mcp/tools/list',
      method: 'GET',
      duration: 100,
      cacheHit: i < 3, // 3 cache hits
      timestamp: new Date(),
      status: 'success',
    });
  }

  const summary = metrics.getSummary();
  assertEquals(summary.totalRequests, 5);
  assertEquals(summary.totalErrors, 0);
  assertEquals(summary.cacheHitRate, 60); // 3/5 = 60%
});

Deno.test('RequestMetrics - getSummary calculates percentiles', () => {
  resetMetrics();
  const metrics = RequestMetrics.getInstance();

  // Add requests with varying durations
  const durations = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  for (const duration of durations) {
    metrics.record({
      endpoint: '/test',
      method: 'GET',
      duration,
      cacheHit: false,
      timestamp: new Date(),
      status: 'success',
    });
  }

  const summary = metrics.getSummary();
  assertEquals(summary.p50Latency, 50);
  assertEquals(summary.p95Latency, 100);
  assertEquals(summary.p99Latency, 100);
});

Deno.test('RequestMetrics - getRecentRequests returns history', () => {
  resetMetrics();
  const metrics = RequestMetrics.getInstance();

  metrics.record({
    endpoint: '/test1',
    method: 'GET',
    duration: 100,
    cacheHit: false,
    timestamp: new Date(),
    status: 'success',
  });

  metrics.record({
    endpoint: '/test2',
    method: 'POST',
    duration: 200,
    cacheHit: true,
    timestamp: new Date(),
    status: 'success',
  });

  const recent = metrics.getRecentRequests();
  assertEquals(recent.length, 2);
  assertEquals(recent[0].endpoint, '/test1');
  assertEquals(recent[1].endpoint, '/test2');
});

Deno.test('RequestMetrics - reset clears all data', () => {
  const metrics = RequestMetrics.getInstance();

  metrics.record({
    endpoint: '/test',
    method: 'GET',
    duration: 100,
    cacheHit: false,
    timestamp: new Date(),
    status: 'success',
  });

  metrics.reset();

  const summary = metrics.getSummary();
  assertEquals(summary.totalRequests, 0);
  assertEquals(metrics.getRecentRequests().length, 0);
});

// ================== REQUEST TIMER TESTS ==================

Deno.test('RequestTimer - records timing on finish', () => {
  resetMetrics();
  const timer = new RequestTimer('/test', 'GET');

  // Simulate some work
  const duration = timer.finish('success');

  assertEquals(typeof duration, 'number');
  assertEquals(duration >= 0, true);

  const stats = RequestMetrics.getInstance().getEndpointStats('GET', '/test');
  assertEquals(stats?.totalRequests, 1);
});

Deno.test('RequestTimer - records cache hit status', () => {
  resetMetrics();
  const timer = new RequestTimer('/cached', 'GET');
  timer.setCacheHit(true);
  timer.finish('success');

  const stats = RequestMetrics.getInstance().getEndpointStats('GET', '/cached');
  assertEquals(stats?.cacheHits, 1);
});

Deno.test('RequestTimer - records error status', () => {
  resetMetrics();
  const timer = new RequestTimer('/error', 'POST');
  timer.finish('error');

  const stats = RequestMetrics.getInstance().getEndpointStats('POST', '/error');
  assertEquals(stats?.errorCount, 1);
});
