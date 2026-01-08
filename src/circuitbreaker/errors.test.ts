/**
 * Error Types Tests
 * 
 * Test suite for circuit breaker error types
 */

import {
  assertEquals,
  assert,
  assertStringIncludes,
} from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  CircuitBreakerError,
  CircuitOpenError,
  CircuitBreakerOperationError,
  CircuitStateTransitionError,
  isCircuitBreakerError,
  isCircuitOpenError,
  isCircuitBreakerOperationError,
} from './errors.ts';

Deno.test('CircuitOpenError - Message Format', () => {
  const error = new CircuitOpenError('test-service', 5000);

  assertEquals(error.serviceName, 'test-service');
  assertEquals(error.code, 'CIRCUIT_OPEN');
  assertEquals(error.name, 'CircuitOpenError');
  assertStringIncludes(error.message, 'test-service');
  assertStringIncludes(error.message, 'OPEN');
});

Deno.test('CircuitOpenError - Timeout Calculation', () => {
  const error = new CircuitOpenError('my-service', 30000);

  assertStringIncludes(error.message, '30');
});

Deno.test('CircuitOpenError - Inheritance', () => {
  const error = new CircuitOpenError('service', 1000);

  assert(error instanceof CircuitOpenError);
  assert(error instanceof CircuitBreakerError);
  assert(error instanceof Error);
});

Deno.test('CircuitBreakerOperationError - With Error', () => {
  const originalError = new Error('Operation failed');
  const error = new CircuitBreakerOperationError('test-service', originalError);

  assertEquals(error.serviceName, 'test-service');
  assertEquals(error.code, 'OPERATION_FAILED');
  assertEquals(error.name, 'CircuitBreakerOperationError');
  assertEquals(error.originalError, originalError);
  assertStringIncludes(error.message, 'Operation failed');
});

Deno.test('CircuitBreakerOperationError - With Unknown Error', () => {
  const error = new CircuitBreakerOperationError('test-service', 'string error');

  assertEquals(error.originalError, 'string error');
  assertStringIncludes(error.message, 'string error');
});

Deno.test('CircuitBreakerOperationError - Inheritance', () => {
  const error = new CircuitBreakerOperationError(
    'service',
    new Error('test')
  );

  assert(error instanceof CircuitBreakerOperationError);
  assert(error instanceof CircuitBreakerError);
  assert(error instanceof Error);
});

Deno.test('CircuitStateTransitionError - Message Format', () => {
  const error = new CircuitStateTransitionError(
    'test-service',
    'CLOSED',
    'HALF_OPEN',
    'Invalid state change'
  );

  assertEquals(error.serviceName, 'test-service');
  assertEquals(error.code, 'INVALID_STATE_TRANSITION');
  assertEquals(error.name, 'CircuitStateTransitionError');
  assertStringIncludes(error.message, 'CLOSED');
  assertStringIncludes(error.message, 'HALF_OPEN');
  assertStringIncludes(error.message, 'Invalid state change');
});

Deno.test('CircuitBreakerError - Base Properties', () => {
  const error = new CircuitBreakerError('test message', 'my-service', 'TEST_CODE');

  assertEquals(error.message, 'test message');
  assertEquals(error.serviceName, 'my-service');
  assertEquals(error.code, 'TEST_CODE');
  assertEquals(error.name, 'CircuitBreakerError');
  assert(error instanceof Error);
});

Deno.test('Type Guard - isCircuitBreakerError', () => {
  const cbError = new CircuitBreakerError('test', 'service', 'code');
  const regularError = new Error('regular');

  assert(isCircuitBreakerError(cbError));
  assert(!isCircuitBreakerError(regularError));
  assert(!isCircuitBreakerError(null));
  assert(!isCircuitBreakerError(undefined));
  assert(!isCircuitBreakerError('not an error'));
});

Deno.test('Type Guard - isCircuitOpenError', () => {
  const openError = new CircuitOpenError('service', 1000);
  const operationError = new CircuitBreakerOperationError('service', new Error('test'));
  const regularError = new Error('test');

  assert(isCircuitOpenError(openError));
  assert(!isCircuitOpenError(operationError));
  assert(!isCircuitOpenError(regularError));
  assert(!isCircuitOpenError(null));
});

Deno.test('Type Guard - isCircuitBreakerOperationError', () => {
  const operationError = new CircuitBreakerOperationError('service', new Error('test'));
  const openError = new CircuitOpenError('service', 1000);
  const regularError = new Error('test');

  assert(isCircuitBreakerOperationError(operationError));
  assert(!isCircuitBreakerOperationError(openError));
  assert(!isCircuitBreakerOperationError(regularError));
  assert(!isCircuitBreakerOperationError(null));
});

Deno.test('Error Stack Trace', () => {
  const error = new CircuitOpenError('service', 1000);

  assert(error.stack !== undefined);
  assertStringIncludes(error.stack!, 'CircuitOpenError');
});

Deno.test('Error Serialization', () => {
  const error = new CircuitBreakerOperationError('service', new Error('test'));

  const serialized = JSON.stringify({
    name: error.name,
    message: error.message,
    serviceName: error.serviceName,
    code: error.code,
  });

  assertStringIncludes(serialized, 'CircuitBreakerOperationError');
  assertStringIncludes(serialized, 'service');
  assertStringIncludes(serialized, 'OPERATION_FAILED');
});

Deno.test('Error Message Details', () => {
  const openError = new CircuitOpenError('database', 15000);
  assert(openError.message.includes('15')); // Should show seconds

  const operationError = new CircuitBreakerOperationError(
    'cache-service',
    new Error('Connection timeout')
  );
  assert(operationError.message.includes('Connection timeout'));
});

Deno.test('Multiple Error Instances', () => {
  const error1 = new CircuitOpenError('service-1', 1000);
  const error2 = new CircuitOpenError('service-2', 2000);

  assertEquals(error1.serviceName, 'service-1');
  assertEquals(error2.serviceName, 'service-2');
  assert(error1.message !== error2.message);
});
