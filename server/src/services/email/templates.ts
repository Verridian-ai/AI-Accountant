/**
 * Email template utilities — rate limiter and template config initialization.
 *
 * The real template logic lives in the parent ../email.ts. This module
 * provides the RateLimiter class and initTemplateConfig used by email-service.ts.
 */

export class RateLimiter {
  private timestamps: number[] = [];
  private readonly windowMs: number = 1000;
  private readonly maxRequests: number;

  constructor(maxRequestsPerSecond: number) {
    this.maxRequests = maxRequestsPerSecond;
  }

  async waitForSlot(): Promise<void> {
    const now = Date.now();
    this.timestamps = this.timestamps.filter((t) => now - t < this.windowMs);

    if (this.timestamps.length >= this.maxRequests) {
      const oldestTimestamp = this.timestamps[0];
      const waitTime = this.windowMs - (now - oldestTimestamp);
      if (waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    this.timestamps.push(Date.now());
  }
}

/**
 * Initialize template configuration — called on module load by email-service.ts.
 * Currently a no-op; the sender module holds config and BRAND directly.
 */
export function initTemplateConfig(
  _config: Record<string, unknown>,
  _brand: Record<string, unknown>,
): void {
  // Config and brand are already initialized in the sender module.
}
