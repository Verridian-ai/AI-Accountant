/**
 * Tenant-Aware Rate Limiter
 * Sliding window rate limiting with per-minute, per-hour, and per-day counters.
 * Burst detection throttles requests when burst_limit is exceeded within 1 second.
 */

import { db, apiRateLimits } from '../schema.js';
import { eq } from 'drizzle-orm';

// ============================================================================
// TYPES
// ============================================================================

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: string;
  retryAfterMs?: number;
}

interface RateLimitConfig {
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
  burstLimit: number;
}

interface WindowCounter {
  timestamps: number[];
}

// ============================================================================
// TENANT RATE LIMITER
// ============================================================================

/**
 * In-memory sliding window rate limiter for tenant API requests.
 * Tracks request timestamps per tenant+endpoint and enforces per-minute,
 * per-hour, per-day, and burst limits.
 */
export class TenantRateLimiter {
  /** Key: `${tenantId}:${endpoint}` → timestamps of recent requests */
  private counters: Map<string, WindowCounter> = new Map();

  /** Default limits when no DB config exists for a tenant/endpoint */
  private static DEFAULT_CONFIG: RateLimitConfig = {
    requestsPerMinute: 60,
    requestsPerHour: 1000,
    requestsPerDay: 10000,
    burstLimit: 10,
  };

  /** Cleanup interval handle */
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Clean up old entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.resetCounters(), 5 * 60 * 1000);
  }

  /**
   * Check if a request should be allowed and record it.
   */
  async checkLimit(tenantId: string, endpoint: string): Promise<RateLimitResult> {
    const config = await this._getConfig(tenantId, endpoint);
    const key = `${tenantId}:${endpoint}`;
    const now = Date.now();

    // Get or create counter
    let counter = this.counters.get(key);
    if (!counter) {
      counter = { timestamps: [] };
      this.counters.set(key, counter);
    }

    // Clean old timestamps (keep last 24 hours)
    const dayAgo = now - 24 * 60 * 60 * 1000;
    counter.timestamps = counter.timestamps.filter((ts) => ts > dayAgo);

    // Check burst limit (requests in last 1 second)
    const oneSecAgo = now - 1000;
    const burstCount = counter.timestamps.filter((ts) => ts > oneSecAgo).length;
    if (burstCount >= config.burstLimit) {
      return {
        allowed: false,
        remaining: 0,
        limit: config.burstLimit,
        resetAt: new Date(now + 1000).toISOString(),
        retryAfterMs: 1000,
      };
    }

    // Check per-minute limit
    const oneMinAgo = now - 60 * 1000;
    const minuteCount = counter.timestamps.filter((ts) => ts > oneMinAgo).length;
    if (minuteCount >= config.requestsPerMinute) {
      const oldestInWindow = counter.timestamps.find((ts) => ts > oneMinAgo) ?? now;
      const resetAt = oldestInWindow + 60 * 1000;
      return {
        allowed: false,
        remaining: 0,
        limit: config.requestsPerMinute,
        resetAt: new Date(resetAt).toISOString(),
        retryAfterMs: resetAt - now,
      };
    }

    // Check per-hour limit
    const oneHourAgo = now - 60 * 60 * 1000;
    const hourCount = counter.timestamps.filter((ts) => ts > oneHourAgo).length;
    if (hourCount >= config.requestsPerHour) {
      const oldestInWindow = counter.timestamps.find((ts) => ts > oneHourAgo) ?? now;
      const resetAt = oldestInWindow + 60 * 60 * 1000;
      return {
        allowed: false,
        remaining: 0,
        limit: config.requestsPerHour,
        resetAt: new Date(resetAt).toISOString(),
        retryAfterMs: resetAt - now,
      };
    }

    // Check per-day limit
    const dayCount = counter.timestamps.length;
    if (dayCount >= config.requestsPerDay) {
      const oldestInWindow = counter.timestamps[0] ?? now;
      const resetAt = oldestInWindow + 24 * 60 * 60 * 1000;
      return {
        allowed: false,
        remaining: 0,
        limit: config.requestsPerDay,
        resetAt: new Date(resetAt).toISOString(),
        retryAfterMs: resetAt - now,
      };
    }

    // Request is allowed — record it
    counter.timestamps.push(now);

    const remaining = config.requestsPerMinute - minuteCount - 1;
    const resetAt = new Date(now + 60 * 1000).toISOString();

    return {
      allowed: true,
      remaining: Math.max(0, remaining),
      limit: config.requestsPerMinute,
      resetAt,
    };
  }

  /**
   * Increment the counter without checking (for recording purposes).
   */
  incrementCounter(tenantId: string, endpoint: string): void {
    const key = `${tenantId}:${endpoint}`;
    let counter = this.counters.get(key);
    if (!counter) {
      counter = { timestamps: [] };
      this.counters.set(key, counter);
    }
    counter.timestamps.push(Date.now());
  }

  /**
   * Fetch rate limit configuration from the DB for a tenant.
   * Falls back to defaults if no config exists.
   */
  async getRateLimits(
    tenantId: string,
  ): Promise<Array<RateLimitConfig & { endpointPattern: string }>> {
    const rows = await db
      .select()
      .from(apiRateLimits)
      .where(eq(apiRateLimits.tenantId, tenantId))
      .all();

    return (rows as any[]).map((row) => ({
      endpointPattern: row.endpointPattern ?? row.endpoint_pattern,
      requestsPerMinute: row.requestsPerMinute ?? row.requests_per_minute ?? 60,
      requestsPerHour: row.requestsPerHour ?? row.requests_per_hour ?? 1000,
      requestsPerDay: row.requestsPerDay ?? row.requests_per_day ?? 10000,
      burstLimit: row.burstLimit ?? row.burst_limit ?? 10,
    }));
  }

  /**
   * Clean up old timestamps from all counters.
   * Removes entries older than 24 hours and deletes empty counters.
   */
  resetCounters(): void {
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    for (const [key, counter] of this.counters.entries()) {
      counter.timestamps = counter.timestamps.filter((ts) => ts > dayAgo);
      if (counter.timestamps.length === 0) {
        this.counters.delete(key);
      }
    }
  }

  /** Stop the cleanup interval (for graceful shutdown) */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  // --------------------------------------------------------------------------
  // PRIVATE HELPERS
  // --------------------------------------------------------------------------

  /**
   * Get the rate limit config for a specific tenant+endpoint.
   * Matches endpoint patterns with simple prefix matching.
   */
  private async _getConfig(tenantId: string, endpoint: string): Promise<RateLimitConfig> {
    const allLimits = await this.getRateLimits(tenantId);
    if (allLimits.length === 0) return TenantRateLimiter.DEFAULT_CONFIG;

    // Find the most specific matching pattern
    let bestMatch: (RateLimitConfig & { endpointPattern: string }) | null = null;
    let bestLength = 0;

    for (const limit of allLimits) {
      const pattern = limit.endpointPattern;
      // Simple prefix or wildcard matching
      if (endpoint.startsWith(pattern) || pattern === '*') {
        if (pattern.length > bestLength) {
          bestMatch = limit;
          bestLength = pattern.length;
        }
      }
    }

    return bestMatch ?? TenantRateLimiter.DEFAULT_CONFIG;
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const tenantRateLimiter = new TenantRateLimiter();
