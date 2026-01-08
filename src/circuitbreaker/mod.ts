/**
 * Circuit Breaker Module Exports
 * 
 * Main entry point for circuit breaker functionality
 */

export {
  CircuitBreaker,
  CircuitBreakerRegistry,
  CircuitState,
  type CircuitBreakerConfig,
  type CircuitBreakerStatus,
  CircuitOpenError,
  CircuitBreakerOperationError,
  CircuitBreakerError,
  isCircuitOpenError,
  isCircuitBreakerOperationError,
} from './CircuitBreaker.ts';

export { circuitBreakerRegistry } from './CircuitBreaker.ts';
