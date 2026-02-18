/**
 * Cognee Sessions -- User-Scoped Cognee Session Methods (Wave 3)
 *
 * Extracted from CogneeSessionService for file-size compliance.
 * All methods receive the redis instance and helper functions via parameters.
 */

import type Redis from 'ioredis';
import { logger } from '../../lib/logger.js';
import type { CogneeSessionContext, CogneeUserSessionOptions } from './types.js';
import { KEY_PREFIX } from './constants.js';

export async function createCogneeSession(
  redis: Redis,
  userId: string,
  options: CogneeUserSessionOptions,
): Promise<{ sessionId: string; context: CogneeSessionContext } | null> {
  const sessionId = `cognee_${userId}_${Date.now()}`;
  const context: CogneeSessionContext = {
    conversationHistory: [],
    activeFilters: {},
    lastQuery: '',
    lastDatasets: [],
    datasetPrefix: options.datasetPrefix,
  };
  const ttl = (options.ttlMinutes ?? 30) * 60;

  try {
    const key = `${KEY_PREFIX}csession:${sessionId}`;
    await redis.set(
      key,
      JSON.stringify({
        userId,
        sessionType: options.sessionType,
        context,
        createdAt: new Date().toISOString(),
      }),
      'EX',
      ttl,
    );

    await redis.sadd(`${KEY_PREFIX}csessions:user:${userId}`, sessionId);

    return { sessionId, context };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('[CogneeSession] Failed to create Cognee session:', message);
    return null;
  }
}

export async function getCogneeSessionContext(
  redis: Redis,
  sessionId: string,
): Promise<CogneeSessionContext | null> {
  try {
    const key = `${KEY_PREFIX}csession:${sessionId}`;
    const data = await redis.get(key);
    if (!data) return null;

    const parsed = JSON.parse(data) as { context: CogneeSessionContext };
    return parsed.context;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('[CogneeSession] Failed to get Cognee session:', message);
    return null;
  }
}

export async function addConversationTurn(
  redis: Redis,
  sessionId: string,
  role: 'user' | 'assistant',
  content: string,
  query?: string,
  datasets?: string[],
): Promise<void> {
  try {
    const key = `${KEY_PREFIX}csession:${sessionId}`;
    const data = await redis.get(key);
    if (!data) return;

    const parsed = JSON.parse(data) as { context: CogneeSessionContext };
    const context = parsed.context;

    context.conversationHistory.push({
      role,
      content,
      timestamp: new Date().toISOString(),
    });

    // Keep last 20 turns to avoid memory bloat
    if (context.conversationHistory.length > 20) {
      context.conversationHistory = context.conversationHistory.slice(-20);
    }

    if (query) context.lastQuery = query;
    if (datasets) context.lastDatasets = datasets;

    // Refresh TTL on activity (at least 30 min)
    const ttl = await redis.ttl(key);
    parsed.context = context;
    await redis.set(key, JSON.stringify(parsed), 'EX', Math.max(ttl, 1800));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('[CogneeSession] Failed to add conversation turn:', message);
  }
}

export async function getOrCreateCogneeSession(
  redis: Redis,
  userId: string,
  options: CogneeUserSessionOptions,
  getCogneeSessionFn: (redis: Redis, sessionId: string) => Promise<CogneeSessionContext | null>,
  createCogneeSessionFn: (
    redis: Redis,
    userId: string,
    options: CogneeUserSessionOptions,
  ) => Promise<{ sessionId: string; context: CogneeSessionContext } | null>,
): Promise<{ sessionId: string; context: CogneeSessionContext; isNew: boolean } | null> {
  try {
    const sessionIds = await redis.smembers(`${KEY_PREFIX}csessions:user:${userId}`);
    for (const sid of sessionIds) {
      const ctx = await getCogneeSessionFn(redis, sid);
      if (ctx) {
        return { sessionId: sid, context: ctx, isNew: false };
      }
      // Expired -- remove from set
      await redis.srem(`${KEY_PREFIX}csessions:user:${userId}`, sid);
    }

    // No active session -- create new
    const result = await createCogneeSessionFn(redis, userId, options);
    if (!result) return null;
    return { ...result, isNew: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('[CogneeSession] Failed to get/create Cognee session:', message);
    return null;
  }
}

export async function cacheUserQueryResult(
  redis: Redis,
  userId: string,
  queryHash: string,
  result: unknown,
  ttlSeconds: number,
  serializeFn: (data: unknown) => string | null,
): Promise<boolean> {
  try {
    const key = `${KEY_PREFIX}cache:user_${userId}:${queryHash}`;
    const serialized = serializeFn(result);
    if (!serialized) return false;

    await redis.set(key, serialized, 'EX', ttlSeconds);
    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('[CogneeSession] Failed to cache user query result:', message);
    return false;
  }
}

export async function getCachedUserQueryResult<T>(
  redis: Redis,
  userId: string,
  queryHash: string,
  deserializeFn: <U>(data: string) => U | null,
): Promise<T | null> {
  try {
    const key = `${KEY_PREFIX}cache:user_${userId}:${queryHash}`;
    const data = await redis.get(key);
    return data ? deserializeFn<T>(data) : null;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('[CogneeSession] Failed to get cached user query result:', message);
    return null;
  }
}

export async function destroyUserCogneeSessions(redis: Redis, userId: string): Promise<number> {
  try {
    const sessionIds = await redis.smembers(`${KEY_PREFIX}csessions:user:${userId}`);
    let destroyed = 0;
    for (const sid of sessionIds) {
      const deleted = await redis.del(`${KEY_PREFIX}csession:${sid}`);
      if (deleted > 0) destroyed++;
    }
    await redis.del(`${KEY_PREFIX}csessions:user:${userId}`);
    return destroyed;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('[CogneeSession] Failed to destroy user Cognee sessions:', message);
    return 0;
  }
}
