/**
 * Claude Agent Framework — Retry & Circuit Breaker
 *
 * Exponential backoff with jitter and circuit breaker pattern.
 */

import type { RetryConfig } from './types.js';
import { DEFAULT_RETRY_CONFIG } from './config.js';

/**
 * Retry a function with exponential backoff and jitter.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const cfg = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Check if error is retryable
      const errorType = (err as Record<string, unknown>)?.type as
        | string
        | undefined;
      const isRetryable =
        errorType && cfg.retryableErrors.includes(errorType);

      if (!isRetryable || attempt === cfg.maxRetries) {
        throw lastError;
      }

      // Calculate delay with jitter
      const baseDelay = Math.min(
        cfg.initialDelayMs * Math.pow(cfg.backoffMultiplier, attempt),
        cfg.maxDelayMs
      );
      const jitter = baseDelay * 0.2 * Math.random();
      const delay = baseDelay + jitter;

      console.warn(
        `[Retry] Attempt ${attempt + 1}/${cfg.maxRetries} failed (${errorType}), retrying in ${Math.round(delay)}ms`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError ?? new Error('retryWithBackoff exhausted');
}

/**
 * Circuit breaker: stops calling a failing service and falls back.
 */
export class AgentCircuitBreaker {
  private failures = 0;
  private lastFailure: Date | null = null;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  readonly failureThreshold: number;
  readonly recoveryTimeMs: number;

  constructor(failureThreshold = 5, recoveryTimeMs = 60_000) {
    this.failureThreshold = failureThreshold;
    this.recoveryTimeMs = recoveryTimeMs;
  }

  async execute<T>(
    fn: () => Promise<T>,
    fallback: () => Promise<T>
  ): Promise<T> {
    if (this.state === 'open') {
      if (
        this.lastFailure &&
        Date.now() - this.lastFailure.getTime() > this.recoveryTimeMs
      ) {
        this.state = 'half-open';
      } else {
        return fallback();
      }
    }

    try {
      const result = await fn();
      this.failures = 0;
      this.state = 'closed';
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailure = new Date();
      if (this.failures >= this.failureThreshold) {
        this.state = 'open';
      }
      return fallback();
    }
  }

  getState() {
    return this.state;
  }
}
