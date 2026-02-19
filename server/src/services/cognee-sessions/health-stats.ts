/**
 * Health & Stats — Redis health checks and cache statistics.
 */

import Redis from 'ioredis';
import { logger } from '../../lib/logger.js';
import type { RedisHealthStatus, CacheStats } from './types.js';
import { KEY_PREFIX } from './constants.js';

/**
 * Scan Redis keys matching a pattern.
 */
export async function scanKeys(redis: Redis, pattern: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor = '0';
  do {
    const [nextCursor, batch] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = nextCursor;
    keys.push(...batch);
  } while (cursor !== '0');
  return keys;
}

/**
 * Get Redis health status including memory, keys, sessions, and cache counts.
 */
export async function getHealthStatus(redis: Redis): Promise<RedisHealthStatus> {
  try {
    const info = await redis.info();
    const memoryMatch = info.match(/used_memory:(\d+)/);
    const uptimeMatch = info.match(/uptime_in_seconds:(\d+)/);
    const totalKeys = await redis.dbsize();
    const sessionKeys = await scanKeys(redis, `${KEY_PREFIX}session:*`);
    const cacheKeys = await scanKeys(redis, `${KEY_PREFIX}cache:query:*`);
    return {
      connected: true,
      memoryUsedMb: memoryMatch ? parseInt(memoryMatch[1], 10) / (1024 * 1024) : 0,
      totalKeys,
      uptimeSeconds: uptimeMatch ? parseInt(uptimeMatch[1], 10) : 0,
      activeSessions: sessionKeys.length,
      cachedQueries: cacheKeys.length,
    };
  } catch (err: unknown) {
    logger.warn(
      '[CogneeSession] Health check failed:',
      err instanceof Error ? err.message : String(err),
    );
    return {
      connected: false,
      memoryUsedMb: 0,
      totalKeys: 0,
      uptimeSeconds: 0,
      activeSessions: 0,
      cachedQueries: 0,
    };
  }
}

/**
 * Compute cache statistics from internal stats counters.
 */
export function computeCacheStats(stats: {
  cacheHits: number;
  cacheMisses: number;
  rateLimitDenials: number;
}): CacheStats {
  const total = stats.cacheHits + stats.cacheMisses;
  return {
    cacheHits: stats.cacheHits,
    cacheMisses: stats.cacheMisses,
    hitRate: total > 0 ? stats.cacheHits / total : 0,
    activeSessions: 0,
    rateLimitDenials: stats.rateLimitDenials,
    totalCachedBytes: 0,
  };
}

/**
 * Flush keys matching a pattern from Redis.
 */
export async function flushKeys(redis: Redis, pattern?: string): Promise<number> {
  try {
    const fullPattern = pattern ? `${KEY_PREFIX}${pattern}` : `${KEY_PREFIX}*`;
    const keys = await scanKeys(redis, fullPattern);
    if (keys.length === 0) return 0;
    return await redis.del(...keys);
  } catch (err: unknown) {
    logger.warn('[CogneeSession] Flush failed:', err instanceof Error ? err.message : String(err));
    return 0;
  }
}
