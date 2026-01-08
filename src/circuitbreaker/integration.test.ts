/**
 * Circuit Breaker Integration Tests
 * 
 * Tests for circuit breaker integration with backend communication
 */

import {
  assertEquals,
  assert,
  assertThrows,
} from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  CircuitBreaker,
  CircuitBreakerRegistry,
  CircuitState,
  CircuitOpenError,
  isCircuitOpenError,
} from './mod.ts';

// Mock backend responses
interface MockBackend {
  healthy: boolean;
  responseTime: number;
  callCount: number;
}

// Simulate backend with circuit breaker
async function simulateBackendCall(
  breaker: CircuitBreaker,
  backend: MockBackend
): Promise<string> {
  return breaker.execute(async () => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, backend.responseTime));

    backend.callCount++;

    if (!backend.healthy) {
      throw new Error('Backend unhealthy');
    }

    return 'success';
  });
}

Deno.test('Integration - Single Backend with Circuit Breaker', async () => {
  const breaker = new CircuitBreaker('backend-service');
  const backend: MockBackend = {
    healthy: true,
    responseTime: 10,
    callCount: 0,
  };

  // Successful calls
  for (let i = 0; i < 3; i++) {
    const result = await simulateBackendCall(breaker, backend);
    assertEquals(result, 'success');
  }

  assertEquals(backend.callCount, 3);
  assertEquals(breaker.getState(), CircuitState.CLOSED);
});

Deno.test('Integration - Backend Failure Detection', async () => {
  const breaker = new CircuitBreaker('backend-service', {
    failureThreshold: 2,
  });
  const backend: MockBackend = {
    healthy: false,
    responseTime: 10,
    callCount: 0,
  };

  // Fail twice to trigger circuit open
  for (let i = 0; i < 2; i++) {
    try {
      await simulateBackendCall(breaker, backend);
    } catch {
      // Expected
    }
  }

  assertEquals(breaker.getState(), CircuitState.OPEN);
  assertEquals(backend.callCount, 2); // Only 2 calls made
});

Deno.test('Integration - Circuit Open Stops Backend Calls', async () => {
  const breaker = new CircuitBreaker('backend-service', {
    failureThreshold: 1,
  });
  const backend: MockBackend = {
    healthy: false,
    responseTime: 10,
    callCount: 0,
  };

  // Open circuit
  try {
    await simulateBackendCall(breaker, backend);
  } catch {
    // Expected
  }

  assertEquals(breaker.getState(), CircuitState.OPEN);
  const initialCallCount = backend.callCount;

  // Try to call while open
  let errorThrown = false;
  try {
    await simulateBackendCall(breaker, backend);
  } catch (error) {
    errorThrown = true;
    assert(isCircuitOpenError(error));
  }

  assert(errorThrown);
  assertEquals(backend.callCount, initialCallCount); // No additional calls made
});

Deno.test('Integration - Multiple Backends with Shared Registry', async () => {
  const registry = new CircuitBreakerRegistry();

  const backend1: MockBackend = {
    healthy: false,
    responseTime: 10,
    callCount: 0,
  };

  const backend2: MockBackend = {
    healthy: true,
    responseTime: 10,
    callCount: 0,
  };

  const breaker1 = registry.getOrCreate('backend-1', { failureThreshold: 1 });
  const breaker2 = registry.getOrCreate('backend-2', { failureThreshold: 1 });

  // Fail backend 1
  try {
    await simulateBackendCall(breaker1, backend1);
  } catch {
    // Expected
  }

  // Backend 2 should still work
  const result = await simulateBackendCall(breaker2, backend2);
  assertEquals(result, 'success');

  const statuses = registry.getAllStatuses();
  assertEquals(statuses['backend-1'].state, CircuitState.OPEN);
  assertEquals(statuses['backend-2'].state, CircuitState.CLOSED);
});

Deno.test('Integration - Backend Recovery', async () => {
  const breaker = new CircuitBreaker('backend-service', {
    failureThreshold: 1,
    successThreshold: 1,
    timeout: 100,
  });

  const backend: MockBackend = {
    healthy: false,
    responseTime: 10,
    callCount: 0,
  };

  // Fail once
  try {
    await simulateBackendCall(breaker, backend);
  } catch {
    // Expected
  }

  assertEquals(breaker.getState(), CircuitState.OPEN);

  // Wait for recovery timeout
  await new Promise(resolve => setTimeout(resolve, 150));

  // Backend recovers
  backend.healthy = true;

  // Attempt recovery
  const result = await simulateBackendCall(breaker, backend);
  assertEquals(result, 'success');
  assertEquals(breaker.getState(), CircuitState.CLOSED);
});

Deno.test('Integration - Slow Backend Detection', async () => {
  const breaker = new CircuitBreaker('slow-backend', {
    failureThreshold: 1,
  });

  const backend: MockBackend = {
    healthy: true,
    responseTime: 1000, // Very slow
    callCount: 0,
  };

  // This will take 1 second but should succeed
  const start = Date.now();
  const result = await simulateBackendCall(breaker, backend);
  const elapsed = Date.now() - start;

  assertEquals(result, 'success');
  assert(elapsed >= 1000);
  assertEquals(breaker.getState(), CircuitState.CLOSED);
});

Deno.test('Integration - Rapid Failures Trigger Circuit', async () => {
  const breaker = new CircuitBreaker('api-service', {
    failureThreshold: 3,
  });

  const backend: MockBackend = {
    healthy: false,
    responseTime: 5,
    callCount: 0,
  };

  const startTime = Date.now();

  // Rapid failures
  for (let i = 0; i < 10; i++) {
    try {
      await simulateBackendCall(breaker, backend);
    } catch (error) {
      if (isCircuitOpenError(error)) {
        break; // Circuit opened
      }
    }
  }

  const elapsed = Date.now() - startTime;

  // Circuit should open after 3 failures, then reject fast
  // Total time should be much less than 10 * 5ms = 50ms
  assert(elapsed < 50);
  assertEquals(breaker.getState(), CircuitState.OPEN);
});

Deno.test('Integration - Error Details Preserved', async () => {
  const breaker = new CircuitBreaker('debug-service');

  const errorMessage = 'Specific error from backend';

  try {
    await breaker.execute(async () => {
      throw new Error(errorMessage);
    });
  } catch (error) {
    if (error instanceof Error) {
      assertEquals(error.message, errorMessage);
    }
  }
});

Deno.test('Integration - Concurrent Requests', async () => {
  const breaker = new CircuitBreaker('concurrent-service');
  const backend: MockBackend = {
    healthy: true,
    responseTime: 50,
    callCount: 0,
  };

  // Fire concurrent requests
  const promises = Array(5).fill(null).map(() =>
    simulateBackendCall(breaker, backend)
  );

  const results = await Promise.all(promises);

  assertEquals(results.length, 5);
  assertEquals(backend.callCount, 5);
  results.forEach(result => assertEquals(result, 'success'));
});

Deno.test('Integration - Partial Failure Scenario', async () => {
  const breaker = new CircuitBreaker('flaky-service', {
    failureThreshold: 2,
  });

  const backend: MockBackend = {
    healthy: true,
    responseTime: 10,
    callCount: 0,
  };

  // Some succeed
  const result1 = await simulateBackendCall(breaker, backend);
  assertEquals(result1, 'success');

  // Service becomes flaky
  backend.healthy = false;

  // First failure
  try {
    await simulateBackendCall(breaker, backend);
  } catch {
    // Expected
  }

  // Circuit still closed (one failure)
  assertEquals(breaker.getState(), CircuitState.CLOSED);

  // Second failure
  try {
    await simulateBackendCall(breaker, backend);
  } catch {
    // Expected
  }

  // Now circuit is open
  assertEquals(breaker.getState(), CircuitState.OPEN);

  // Further calls rejected immediately
  try {
    await simulateBackendCall(breaker, backend);
  } catch (error) {
    assert(isCircuitOpenError(error));
  }
});

Deno.test('Integration - Registry Isolation', async () => {
  const registry1 = new CircuitBreakerRegistry();
  const registry2 = new CircuitBreakerRegistry();

  const breaker1 = registry1.getOrCreate('service');
  const breaker2 = registry2.getOrCreate('service');

  // Breakers from different registries are different instances
  assert(breaker1 !== breaker2);
});

Deno.test('Integration - Circuit State Consistency', async () => {
  const breaker = new CircuitBreaker('state-test', { failureThreshold: 1 });

  // Check initial state
  let status = breaker.getStatus();
  assertEquals(status.state, CircuitState.CLOSED);
  assertEquals(status.isHealthy, true);

  // Trigger failure
  try {
    await breaker.execute(async () => {
      throw new Error('test');
    });
  } catch {
    // Expected
  }

  // Check state after failure
  status = breaker.getStatus();
  assertEquals(status.state, CircuitState.OPEN);
  assertEquals(status.isHealthy, false);
  assertEquals(status.failureCount, 1);
});
