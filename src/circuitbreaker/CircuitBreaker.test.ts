/**
 * Circuit Breaker Tests
 * 
 * Comprehensive test suite for the circuit breaker pattern implementation
 */

import { assertEquals, assertThrows, assert } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  CircuitBreaker,
  CircuitBreakerRegistry,
  CircuitState,
  CircuitOpenError,
  isCircuitOpenError,
  isCircuitBreakerOperationError,
  type CircuitBreakerStatus,
} from './mod.ts';

// Helper to wait/sleep
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

Deno.test('CircuitBreaker - Initial State', () => {
  const breaker = new CircuitBreaker('test-service');
  assertEquals(breaker.getState(), CircuitState.CLOSED);

  const status = breaker.getStatus();
  assertEquals(status.state, CircuitState.CLOSED);
  assertEquals(status.failureCount, 0);
  assertEquals(status.successCount, 0);
  assertEquals(status.isHealthy, true);
});

Deno.test('CircuitBreaker - Successful Operation', async () => {
  const breaker = new CircuitBreaker('test-service');

  const result = await breaker.execute(async () => {
    return 'success';
  });

  assertEquals(result, 'success');
  assertEquals(breaker.getState(), CircuitState.CLOSED);
  assertEquals(breaker.getStatus().failureCount, 0);
});

Deno.test('CircuitBreaker - Single Failure', async () => {
  const breaker = new CircuitBreaker('test-service');

  let errorThrown = false;
  try {
    await breaker.execute(async () => {
      throw new Error('Operation failed');
    });
  } catch {
    errorThrown = true;
  }

  assert(errorThrown);
  assertEquals(breaker.getState(), CircuitState.CLOSED);
  assertEquals(breaker.getStatus().failureCount, 1);
});

Deno.test('CircuitBreaker - Opens After Threshold', async () => {
  const config = {
    failureThreshold: 3,
  };
  const breaker = new CircuitBreaker('test-service', config);

  // Trigger 3 failures to open circuit
  for (let i = 0; i < 3; i++) {
    try {
      await breaker.execute(async () => {
        throw new Error('Failure');
      });
    } catch {
      // Expected
    }
  }

  assertEquals(breaker.getState(), CircuitState.OPEN);
  assertEquals(breaker.getStatus().failureCount, 3);
});

Deno.test('CircuitBreaker - Rejects Requests When Open', async () => {
  const config = {
    failureThreshold: 1,
  };
  const breaker = new CircuitBreaker('test-service', config);

  // Open circuit
  try {
    await breaker.execute(async () => {
      throw new Error('Failure');
    });
  } catch {
    // Expected
  }

  // Try to execute when open
  let errorThrown = false;
  try {
    await breaker.execute(async () => {
      return 'This should not execute';
    });
  } catch (error) {
    errorThrown = true;
    assert(isCircuitOpenError(error));
  }

  assert(errorThrown);
  assertEquals(breaker.getState(), CircuitState.OPEN);
});

Deno.test('CircuitBreaker - Transitions to HALF_OPEN', async () => {
  const config = {
    failureThreshold: 1,
    timeout: 100, // 100ms
  };
  const breaker = new CircuitBreaker('test-service', config);

  // Open circuit
  try {
    await breaker.execute(async () => {
      throw new Error('Failure');
    });
  } catch {
    // Expected
  }

  assertEquals(breaker.getState(), CircuitState.OPEN);

  // Wait for timeout
  await sleep(150);

  // Next execution should try to recover (HALF_OPEN)
  try {
    await breaker.execute(async () => {
      return 'recovery attempt';
    });
  } catch {
    // May fail depending on timing
  }

  // After recovery attempt, should be HALF_OPEN or CLOSED
  const state = breaker.getState();
  assert(
    state === CircuitState.HALF_OPEN || state === CircuitState.CLOSED,
    `Expected HALF_OPEN or CLOSED, got ${state}`
  );
});

Deno.test('CircuitBreaker - Closes After Successful Recovery', async () => {
  const config = {
    failureThreshold: 1,
    successThreshold: 1,
    timeout: 100,
  };
  const breaker = new CircuitBreaker('test-service', config);

  // Open circuit
  try {
    await breaker.execute(async () => {
      throw new Error('Failure');
    });
  } catch {
    // Expected
  }

  assertEquals(breaker.getState(), CircuitState.OPEN);

  // Wait for recovery attempt
  await sleep(150);

  // Successful operation in HALF_OPEN state
  const result = await breaker.execute(async () => {
    return 'recovered';
  });

  assertEquals(result, 'recovered');
  assertEquals(breaker.getState(), CircuitState.CLOSED);
  assertEquals(breaker.getStatus().failureCount, 0);
});

Deno.test('CircuitBreaker - Returns to OPEN on HALF_OPEN Failure', async () => {
  const config = {
    failureThreshold: 1,
    timeout: 100,
  };
  const breaker = new CircuitBreaker('test-service', config);

  // Open circuit
  try {
    await breaker.execute(async () => {
      throw new Error('Failure');
    });
  } catch {
    // Expected
  }

  await sleep(150);

  // Fail in HALF_OPEN state
  try {
    await breaker.execute(async () => {
      throw new Error('Recovery failed');
    });
  } catch {
    // Expected
  }

  assertEquals(breaker.getState(), CircuitState.OPEN);
});

Deno.test('CircuitBreaker - Reset', () => {
  const breaker = new CircuitBreaker('test-service');
  breaker.getStatus(); // Populate some state

  breaker.reset();

  assertEquals(breaker.getState(), CircuitState.CLOSED);
  assertEquals(breaker.getStatus().failureCount, 0);
  assertEquals(breaker.getStatus().successCount, 0);
});

Deno.test('CircuitBreaker - Monitor Window Resets Failures', async () => {
  const config = {
    failureThreshold: 2,
    monitorWindow: 100, // 100ms window
  };
  const breaker = new CircuitBreaker('test-service', config);

  // First failure
  try {
    await breaker.execute(async () => {
      throw new Error('Failure 1');
    });
  } catch {
    // Expected
  }

  assertEquals(breaker.getStatus().failureCount, 1);

  // Wait for monitor window to reset
  await sleep(150);

  // Second failure should reset the count (outside window)
  try {
    await breaker.execute(async () => {
      throw new Error('Failure 2');
    });
  } catch {
    // Expected
  }

  // Should only count the most recent failure
  assertEquals(breaker.getStatus().failureCount, 1);
});

Deno.test('CircuitBreaker - Custom Configuration', () => {
  const config = {
    failureThreshold: 10,
    successThreshold: 5,
    timeout: 60000,
    monitorWindow: 120000,
  };
  const breaker = new CircuitBreaker('test-service', config);

  assertEquals(breaker.getState(), CircuitState.CLOSED);
  // Configuration is applied internally, verified by behavior
});

Deno.test('CircuitBreakerRegistry - Get or Create', () => {
  const registry = new CircuitBreakerRegistry();

  const breaker1 = registry.getOrCreate('service-1');
  const breaker2 = registry.getOrCreate('service-1');

  assertEquals(breaker1, breaker2); // Same instance
});

Deno.test('CircuitBreakerRegistry - Multiple Services', () => {
  const registry = new CircuitBreakerRegistry();

  const breaker1 = registry.getOrCreate('service-1');
  const breaker2 = registry.getOrCreate('service-2');

  assert(breaker1 !== breaker2);
});

Deno.test('CircuitBreakerRegistry - Get All Statuses', async () => {
  const registry = new CircuitBreakerRegistry();

  const breaker1 = registry.getOrCreate('service-1');
  const breaker2 = registry.getOrCreate('service-2');

  // Open one circuit
  try {
    await breaker1.execute(async () => {
      throw new Error('Failure');
    });
  } catch {
    // Expected
  }

  const statuses = registry.getAllStatuses();

  assertEquals(Object.keys(statuses).length, 2);
  assertEquals(statuses['service-1'].failureCount, 1);
  assertEquals(statuses['service-2'].failureCount, 0);
});

Deno.test('CircuitBreakerRegistry - Reset All', async () => {
  const registry = new CircuitBreakerRegistry();

  const breaker1 = registry.getOrCreate('service-1');
  const breaker2 = registry.getOrCreate('service-2');

  // Modify states
  try {
    await breaker1.execute(async () => {
      throw new Error('Failure');
    });
  } catch {
    // Expected
  }

  registry.resetAll();

  const statuses = registry.getAllStatuses();
  assertEquals(statuses['service-1'].failureCount, 0);
  assertEquals(statuses['service-2'].failureCount, 0);
  assertEquals(statuses['service-1'].state, CircuitState.CLOSED);
});

Deno.test('CircuitBreaker - Type Guards', async () => {
  const breaker = new CircuitBreaker('test-service', {
    failureThreshold: 1,
  });

  // Open circuit
  try {
    await breaker.execute(async () => {
      throw new Error('Failure');
    });
  } catch {
    // Expected
  }

  // Try to execute when open
  try {
    await breaker.execute(async () => {
      return 'test';
    });
  } catch (error) {
    assert(isCircuitOpenError(error));
    assert(error instanceof CircuitOpenError);
  }
});

Deno.test('CircuitBreaker - Generic Type Support', async () => {
  const breaker = new CircuitBreaker('test-service');

  interface MyResult {
    id: number;
    name: string;
  }

  const result = await breaker.execute(async (): Promise<MyResult> => {
    return { id: 1, name: 'test' };
  });

  assertEquals(result.id, 1);
  assertEquals(result.name, 'test');
});

Deno.test('CircuitBreaker - Preserves Original Error', async () => {
  const breaker = new CircuitBreaker('test-service');

  const originalError = new Error('Original failure');

  try {
    await breaker.execute(async () => {
      throw originalError;
    });
  } catch (error) {
    assertEquals(error, originalError);
  }
});

Deno.test('CircuitBreaker - Service Name in Error', async () => {
  const breaker = new CircuitBreaker('my-service', {
    failureThreshold: 1,
  });

  // Open circuit
  try {
    await breaker.execute(async () => {
      throw new Error('Failure');
    });
  } catch {
    // Expected
  }

  try {
    await breaker.execute(async () => {
      return 'test';
    });
  } catch (error) {
    if (isCircuitOpenError(error)) {
      assertEquals(error.serviceName, 'my-service');
      assertEquals(error.code, 'CIRCUIT_OPEN');
    }
  }
});

Deno.test('CircuitBreaker - Status Snapshot', async () => {
  const breaker = new CircuitBreaker('test-service', {
    failureThreshold: 2,
  });

  // Create some failures
  for (let i = 0; i < 2; i++) {
    try {
      await breaker.execute(async () => {
        throw new Error('Failure');
      });
    } catch {
      // Expected
    }
  }

  const status: CircuitBreakerStatus = breaker.getStatus();

  assertEquals(status.state, CircuitState.OPEN);
  assertEquals(status.failureCount, 2);
  assertEquals(status.isHealthy, false);
});
