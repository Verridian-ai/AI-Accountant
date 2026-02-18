/**
 * Cognee Sessions — Query cache helpers (serialize, deserialize, CRUD, key-building)
 */

import Redis from 'ioredis';
import { createHash } from 'crypto';
import { logger } from '../../lib/logger.js';
import { MAX_CACHE_VALUE_BYTES, KEY_PREFIX } from './constants.js';
import { scanKeys } from './health-stats.js';

function hashKey(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function serializeForCache(data: unknown): string | null {
  try {
    const json = JSON.stringify(data);
    if (Buffer.byteLength(json, 'utf-8') > MAX_CACHE_VALUE_BYTES) {
      logger.warn('[CogneeSession] Cache value exceeds 1MB limit, skipping');
      return null;
    }
    return json;
  } catch {
    return null;
  }
}

export function deserializeFromCache<T>(data: string): T | null {
  try {
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

export async function findSessionKey(redis: Redis, sessionId: string): Promise<string | null> {
  const pattern = `${KEY_PREFIX}session:*:${sessionId}`;
  const keys = await scanKeys(redis, pattern);
  return keys.length > 0 ? keys[0] : null;
}

export async function cacheQueryResult(
  redis: Redis,
  cacheKey: string,
  result: unknown,
  ttlSeconds: number,
): Promise<boolean> {
  try {
    const serialized = serializeForCache(result);
    if (!serialized) return false;
    const key = `${KEY_PREFIX}cache:query:${cacheKey}`;
    await redis.set(key, serialized, 'EX', ttlSeconds);
    return true;
  } catch (err) {
    logger.warn(
      '[CogneeSession] Failed to cache result:',
      err instanceof Error ? err.message : String(err),
    );
    return false;
  }
}

export async function getCachedResult<T = unknown>(
  redis: Redis,
  cacheKey: string,
  stats: { cacheHits: number; cacheMisses: number },
): Promise<T | null> {
  try {
    const key = `${KEY_PREFIX}cache:query:${cacheKey}`;
    const data = await redis.get(key);
    if (data) {
      stats.cacheHits++;
      return deserializeFromCache<T>(data);
    }
    stats.cacheMisses++;
    return null;
  } catch (err) {
    logger.warn(
      '[CogneeSession] Failed to get cached result:',
      err instanceof Error ? err.message : String(err),
    );
    stats.cacheMisses++;
    return null;
  }
}

export async function invalidateCache(redis: Redis, pattern: string): Promise<number> {
  try {
    const fullPattern = `${KEY_PREFIX}cache:query:${pattern}`;
    const keys = await scanKeys(redis, fullPattern);
    if (keys.length === 0) return 0;
    return await redis.del(...keys);
  } catch (err) {
    logger.warn(
      '[CogneeSession] Failed to invalidate cache:',
      err instanceof Error ? err.message : String(err),
    );
    return 0;
  }
}

export function buildCacheKey(queryType: string, params: Record<string, unknown>): string {
  const sortedJson = JSON.stringify(params, Object.keys(params).sort());
  return hashKey(`${queryType}:${sortedJson}`);
}
