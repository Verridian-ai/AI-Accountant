/**
 * Sentiment Analysis — Circuit Breaker
 */

import { logger } from '../../lib/logger.js';

interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
}

const circuitBreaker: CircuitBreakerState = {
  failures: 0,
  lastFailure: 0,
  isOpen: false,
};

const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_RECOVERY_MS = 60_000;

export function recordSuccess(): void {
  circuitBreaker.failures = 0;
  circuitBreaker.isOpen = false;
}

export function recordFailure(): void {
  circuitBreaker.failures++;
  circuitBreaker.lastFailure = Date.now();
  if (circuitBreaker.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    circuitBreaker.isOpen = true;
    logger.warn('[Sentiment] Circuit breaker OPEN — falling back to OpenRouter');
  }
}

export function isCircuitOpen(): boolean {
  if (!circuitBreaker.isOpen) return false;
  if (Date.now() - circuitBreaker.lastFailure > CIRCUIT_BREAKER_RECOVERY_MS) {
    circuitBreaker.isOpen = false;
    circuitBreaker.failures = 0;
    logger.info('[Sentiment] Circuit breaker CLOSED — retrying Anthropic');
    return false;
  }
  return true;
}
