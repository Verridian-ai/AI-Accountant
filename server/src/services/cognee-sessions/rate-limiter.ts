/**
 * Rate Limiting — Sliding window rate limiter via Redis sorted sets.
 */

import Redis from 'ioredis';
import { randomUUID } from 'crypto';
import { logger } from '../../lib/logger.js';
import type { RateLimitResult } from './types.js';
import { KEY_PREFIX } from './constants.js';

/**
 * Check rate limit for an operation using sliding window.
 */
export async function checkRateLimit(
  redis: Redis,
  operation: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const defaultAllowed: RateLimitResult = {
    allowed: true,
    remaining: limit,
    limit,
    resetAt: new Date(Date.now() + windowSeconds * 1000).toISOString(),
  };
  try {
    const key = `${KEY_PREFIX}ratelimit:${operation}`;
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;
    const pipeline = redis.pipeline();
    pipeline.zremrangebyscore(key, 0, windowStart);
    pipeline.zadd(key, now.toString(), `${now}:${randomUUID()}`);
    pipeline.zcard(key);
    pipeline.expire(key, windowSeconds);
    const results = await pipeline.exec();
    if (!results) return defaultAllowed;
    const count = (results[2]?.[1] as number) ?? 0;
    const allowed = count <= limit;
    if (!allowed) {
      const oldest = await redis.zrange(key, 0, 0, 'WITHSCORES');
      const oldestTimestamp = oldest.length >= 2 ? parseInt(oldest[1], 10) : now;
      const resetAt = oldestTimestamp + windowSeconds * 1000;
      return {
        allowed: false,
        remaining: 0,
        limit,
        resetAt: new Date(resetAt).toISOString(),
        retryAfter: Math.ceil((resetAt - now) / 1000),
      };
    }
    return {
      allowed: true,
      remaining: Math.max(0, limit - count),
      limit,
      resetAt: new Date(now + windowSeconds * 1000).toISOString(),
    };
  } catch (err: unknown) {
    logger.warn(
      '[CogneeSession] Rate limit check failed:',
      err instanceof Error ? err.message : String(err),
    );
    return defaultAllowed;
  }
}

/**
 * Get current rate limit status for an operation.
 */
export async function getRateLimitStatus(
  redis: Redis,
  operation: string,
): Promise<{ count: number; limit: number } | null> {
  try {
    const key = `${KEY_PREFIX}ratelimit:${operation}`;
    const count = await redis.zcard(key);
    return { count, limit: 0 };
  } catch (err: unknown) {
    logger.warn(
      '[CogneeSession] Rate limit status failed:',
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}
