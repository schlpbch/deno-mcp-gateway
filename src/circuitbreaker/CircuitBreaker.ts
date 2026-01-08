/**
 * Circuit Breaker Pattern Implementation
 * 
 * Prevents cascading failures by stopping requests to failing services.
 * States: CLOSED (normal) → OPEN (failing) → HALF_OPEN (recovery) → CLOSED
 */

import {
  CircuitOpenError,
  CircuitBreakerOperationError,
  type CircuitBreakerError,
  isCircuitOpenError,
  isCircuitBreakerOperationError,
} from './errors.ts';

// Re-export error types for convenience
export {
  CircuitOpenError,
  CircuitBreakerOperationError,
  CircuitBreakerError,
  isCircuitOpenError,
  isCircuitBreakerOperationError,
} from './errors.ts';

export enum CircuitState {
  CLOSED = 'CLOSED',           // Normal operation
  OPEN = 'OPEN',               // Failing, reject requests
  HALF_OPEN = 'HALF_OPEN',     // Testing recovery
}

export interface CircuitBreakerConfig {
  failureThreshold?: number;       // Failures before opening (default: 5)
  successThreshold?: number;       // Successes before closing from half-open (default: 2)
  timeout?: number;                // Time in ms before half-open (default: 30000)
  monitorWindow?: number;          // Time window to count failures (default: 60000)
}

/**
 * Circuit breaker status snapshot
 */
export interface CircuitBreakerStatus {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  isHealthy: boolean;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private openedAt = 0;

  private failureThreshold: number;
  private successThreshold: number;
  private timeout: number;
  private monitorWindow: number;

  constructor(private name: string, config: CircuitBreakerConfig = {}) {
    this.failureThreshold = config.failureThreshold ?? 5;
    this.successThreshold = config.successThreshold ?? 2;
    this.timeout = config.timeout ?? 30000;
    this.monitorWindow = config.monitorWindow ?? 60000;
  }

  /**
   * Execute an async operation with circuit breaker protection
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Check if we should attempt recovery
    if (this.state === CircuitState.OPEN) {
      const timeSinceOpened = Date.now() - this.openedAt;
      if (timeSinceOpened >= this.timeout) {
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
        console.log(`[CircuitBreaker] ${this.name}: Transitioning to HALF_OPEN`);
      } else {
        const remainingTimeout = this.timeout - timeSinceOpened;
        throw new CircuitOpenError(this.name, remainingTimeout);
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Record a successful request
   */
  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.state = CircuitState.CLOSED;
        console.log(
          `[CircuitBreaker] ${this.name}: Transitioned to CLOSED (recovered)`
        );
      }
    }
  }

  /**
   * Record a failed request
   */
  private onFailure(): void {
    const now = Date.now();
    
    // Reset counter if outside monitoring window
    if (now - this.lastFailureTime > this.monitorWindow) {
      this.failureCount = 1;
    } else {
      this.failureCount++;
    }

    this.lastFailureTime = now;

    if (this.state === CircuitState.HALF_OPEN) {
      // Any failure while half-open goes back to open
      this.state = CircuitState.OPEN;
      this.openedAt = now;
      console.log(
        `[CircuitBreaker] ${this.name}: Recovery failed, back to OPEN`
      );
    } else if (
      this.state === CircuitState.CLOSED &&
      this.failureCount >= this.failureThreshold
    ) {
      this.state = CircuitState.OPEN;
      this.openedAt = now;
      console.log(
        `[CircuitBreaker] ${this.name}: Failure threshold reached, opening circuit`
      );
    }
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get circuit breaker status
   */
  getStatus(): CircuitBreakerStatus {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      isHealthy: this.state === CircuitState.CLOSED,
    };
  }

  /**
   * Reset circuit breaker (for testing or manual recovery)
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
    console.log(`[CircuitBreaker] ${this.name}: Reset`);
  }
}

/**
 * Circuit Breaker Registry - manages multiple circuit breakers
 */
export class CircuitBreakerRegistry {
  private breakers = new Map<string, CircuitBreaker>();

  /**
   * Get or create a circuit breaker for a service
   */
  getOrCreate(
    serviceId: string,
    config?: CircuitBreakerConfig
  ): CircuitBreaker {
    if (!this.breakers.has(serviceId)) {
      this.breakers.set(serviceId, new CircuitBreaker(serviceId, config));
    }
    return this.breakers.get(serviceId)!;
  }

  /**
   * Get all circuit breaker statuses
   */
  getAllStatuses(): Record<string, CircuitBreakerStatus> {
    const statuses: Record<string, CircuitBreakerStatus> = {};
    for (const [id, breaker] of this.breakers.entries()) {
      statuses[id] = breaker.getStatus();
    }
    return statuses;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }
}

// Global registry
export const circuitBreakerRegistry = new CircuitBreakerRegistry();
