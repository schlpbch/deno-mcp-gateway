/**
 * Custom Error Types for Circuit Breaker
 */

/**
 * Base error class for circuit breaker errors
 */
export class CircuitBreakerError extends Error {
  constructor(
    message: string,
    public readonly serviceName: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

/**
 * Thrown when circuit breaker is OPEN and rejects requests
 */
export class CircuitOpenError extends CircuitBreakerError {
  constructor(serviceName: string, timeoutMs: number) {
    super(
      `Circuit breaker for "${serviceName}" is OPEN. Service unavailable. Recovery attempt in ${Math.ceil(timeoutMs / 1000)}s.`,
      serviceName,
      'CIRCUIT_OPEN'
    );
    this.name = 'CircuitOpenError';
  }
}

/**
 * Thrown when operation within circuit breaker fails
 */
export class CircuitBreakerOperationError extends CircuitBreakerError {
  constructor(
    serviceName: string,
    public readonly originalError: Error | unknown
  ) {
    const message =
      originalError instanceof Error
        ? originalError.message
        : String(originalError);
    super(
      `Operation failed for "${serviceName}": ${message}`,
      serviceName,
      'OPERATION_FAILED'
    );
    this.name = 'CircuitBreakerOperationError';
  }
}

/**
 * Thrown when circuit breaker cannot transition to requested state
 */
export class CircuitStateTransitionError extends CircuitBreakerError {
  constructor(
    serviceName: string,
    currentState: string,
    requestedState: string,
    reason: string
  ) {
    super(
      `Cannot transition ${serviceName} from ${currentState} to ${requestedState}: ${reason}`,
      serviceName,
      'INVALID_STATE_TRANSITION'
    );
    this.name = 'CircuitStateTransitionError';
  }
}

/**
 * Type guard to check if error is a CircuitBreakerError
 */
export function isCircuitBreakerError(error: unknown): error is CircuitBreakerError {
  return error instanceof CircuitBreakerError;
}

/**
 * Type guard to check if error is a CircuitOpenError
 */
export function isCircuitOpenError(error: unknown): error is CircuitOpenError {
  return error instanceof CircuitOpenError;
}

/**
 * Type guard to check if error is a CircuitBreakerOperationError
 */
export function isCircuitBreakerOperationError(
  error: unknown
): error is CircuitBreakerOperationError {
  return error instanceof CircuitBreakerOperationError;
}
