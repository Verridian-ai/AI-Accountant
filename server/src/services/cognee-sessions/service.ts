/**
 * Cognee Session & Cache Service
 *
 * Redis-backed session management, query caching, and rate limiting
 * for the Cognee knowledge graph integration.
 */

import Redis from 'ioredis';
import { createHash } from 'crypto';
import { logger } from '../../lib/logger.js';
import { config } from '../../lib/config.js';
import type {
  CogneeSession,
  RateLimitResult,
  RedisHealthStatus,
  CacheStats,
  CogneeSessionContext,
  CogneeUserSessionOptions,
} from './types.js';
import {
  MAX_CACHE_VALUE_BYTES,
  CONNECT_MAX_RETRIES,
  CONNECT_RETRY_BASE_MS,
  KEY_PREFIX,
} from './constants.js';
import {
  createCogneeSession as createCogneeSessionFn,
  getCogneeSessionContext,
  addConversationTurn as addConversationTurnFn,
  getOrCreateCogneeSession as getOrCreateCogneeSessionFn,
  cacheUserQueryResult as cacheUserQueryResultFn,
  getCachedUserQueryResult as getCachedUserQueryResultFn,
  destroyUserCogneeSessions as destroyUserCogneeSessionsFn,
} from './cognee-user-sessions.js';
import {
  checkRateLimit as checkRateLimitFn,
  getRateLimitStatus as getRateLimitStatusFn,
} from './rate-limiter.js';
import {
  getHealthStatus as getHealthStatusFn,
  computeCacheStats,
  flushKeys,
  scanKeys,
} from './health-stats.js';
import {
  createSession as createSessionFn,
  getSession as getSessionFn,
  updateSession as updateSessionFn,
  destroySession as destroySessionFn,
  listUserSessions as listUserSessionsFn,
} from './session-crud.js';

export class CogneeSessionService {
  private redis: Redis | null = null;
  private connected = false;
  private stats = { cacheHits: 0, cacheMisses: 0, rateLimitDenials: 0 };

  constructor(redisUrl?: string) {
    const url = redisUrl ?? config.redisUrl;
    this.redis = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        if (times > CONNECT_MAX_RETRIES) return null;
        return Math.min(times * CONNECT_RETRY_BASE_MS, 5000);
      },
    });

    this.redis.on('connect', () => {
      this.connected = true;
    });
    this.redis.on('close', () => {
      this.connected = false;
    });
    this.redis.on('error', (err: Error) => {
      logger.warn({ err: err.message }, '[CogneeSession] Redis error');
    });

    this._connect();
  }

  // -- Session Management (delegated to session-crud.ts) --

  async createSession(userId: string, sessionType: string): Promise<CogneeSession | null> {
    if (!this._ensureConnected()) return null;
    return createSessionFn(this.redis!, userId, sessionType);
  }

  async getSession(sessionId: string): Promise<CogneeSession | null> {
    if (!this._ensureConnected()) return null;
    return getSessionFn(this.redis!, sessionId, (id) => this._findSessionKey(id));
  }

  async updateSession(
    sessionId: string,
    updates: Partial<Pick<CogneeSession, 'state' | 'data'>>,
  ): Promise<CogneeSession | null> {
    if (!this._ensureConnected()) return null;
    return updateSessionFn(this.redis!, sessionId, updates, (id) => this._findSessionKey(id));
  }

  async destroySession(sessionId: string): Promise<boolean> {
    if (!this._ensureConnected()) return false;
    return destroySessionFn(this.redis!, sessionId, (id) => this._findSessionKey(id));
  }

  async listUserSessions(userId: string): Promise<CogneeSession[]> {
    if (!this._ensureConnected()) return [];
    return listUserSessionsFn(this.redis!, userId);
  }

  // --------------------------------------------------------------------------
  // QUERY CACHING
  // --------------------------------------------------------------------------

  async cacheQueryResult(
    cacheKey: string,
    result: unknown,
    ttlSeconds: number = 300,
  ): Promise<boolean> {
    if (!this._ensureConnected()) return false;
    try {
      const serialized = this._serializeForCache(result);
      if (!serialized) return false;
      const key = `${KEY_PREFIX}cache:query:${cacheKey}`;
      await this.redis!.set(key, serialized, 'EX', ttlSeconds);
      return true;
    } catch (err: any) {
      logger.warn('[CogneeSession] Failed to cache result:', err.message);
      return false;
    }
  }

  async getCachedResult<T = unknown>(cacheKey: string): Promise<T | null> {
    if (!this._ensureConnected()) {
      this.stats.cacheMisses++;
      return null;
    }
    try {
      const key = `${KEY_PREFIX}cache:query:${cacheKey}`;
      const data = await this.redis!.get(key);
      if (data) {
        this.stats.cacheHits++;
        return this._deserializeFromCache<T>(data);
      }
      this.stats.cacheMisses++;
      return null;
    } catch (err: any) {
      logger.warn('[CogneeSession] Failed to get cached result:', err.message);
      this.stats.cacheMisses++;
      return null;
    }
  }

  async invalidateCache(pattern: string): Promise<number> {
    if (!this._ensureConnected()) return 0;
    try {
      const fullPattern = `${KEY_PREFIX}cache:query:${pattern}`;
      const keys = await scanKeys(this.redis!, fullPattern);
      if (keys.length === 0) return 0;
      return await this.redis!.del(...keys);
    } catch (err: any) {
      logger.warn('[CogneeSession] Failed to invalidate cache:', err.message);
      return 0;
    }
  }

  buildCacheKey(queryType: string, params: Record<string, unknown>): string {
    const sortedJson = JSON.stringify(params, Object.keys(params).sort());
    return this._hashKey(`${queryType}:${sortedJson}`);
  }

  // -- Rate Limiting (delegated to rate-limiter.ts) --

  async checkRateLimit(
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
    if (!this._ensureConnected()) return defaultAllowed;
    const result = await checkRateLimitFn(this.redis!, operation, limit, windowSeconds);
    if (!result.allowed) this.stats.rateLimitDenials++;
    return result;
  }

  async getRateLimitStatus(operation: string): Promise<{ count: number; limit: number } | null> {
    if (!this._ensureConnected()) return null;
    return getRateLimitStatusFn(this.redis!, operation);
  }

  // --------------------------------------------------------------------------
  // WAVE 3: USER-SCOPED COGNEE SESSIONS (delegated)
  // --------------------------------------------------------------------------

  async createCogneeSession(userId: string, options: CogneeUserSessionOptions) {
    if (!this._ensureConnected()) return null;
    return createCogneeSessionFn(this.redis!, userId, options);
  }

  async getCogneeSession(sessionId: string): Promise<CogneeSessionContext | null> {
    if (!this._ensureConnected()) return null;
    return getCogneeSessionContext(this.redis!, sessionId);
  }

  async addConversationTurn(
    sessionId: string,
    role: 'user' | 'assistant',
    content: string,
    query?: string,
    datasets?: string[],
  ): Promise<void> {
    if (!this._ensureConnected()) return;
    return addConversationTurnFn(this.redis!, sessionId, role, content, query, datasets);
  }

  async getOrCreateCogneeSession(userId: string, options: CogneeUserSessionOptions) {
    if (!this._ensureConnected()) return null;
    return getOrCreateCogneeSessionFn(
      this.redis!,
      userId,
      options,
      getCogneeSessionContext,
      createCogneeSessionFn,
    );
  }

  async cacheUserQueryResult(
    userId: string,
    queryHash: string,
    result: any,
    ttlSeconds: number = 300,
  ): Promise<boolean> {
    if (!this._ensureConnected()) return false;
    return cacheUserQueryResultFn(
      this.redis!,
      userId,
      queryHash,
      result,
      ttlSeconds,
      this._serializeForCache.bind(this),
    );
  }

  async getCachedUserQueryResult(userId: string, queryHash: string): Promise<any | null> {
    if (!this._ensureConnected()) return null;
    return getCachedUserQueryResultFn(
      this.redis!,
      userId,
      queryHash,
      this._deserializeFromCache.bind(this),
    );
  }

  async destroyUserCogneeSessions(userId: string): Promise<number> {
    if (!this._ensureConnected()) return 0;
    return destroyUserCogneeSessionsFn(this.redis!, userId);
  }

  // -- Health & Stats (delegated to health-stats.ts) --

  async getHealthStatus(): Promise<RedisHealthStatus> {
    const disconnected: RedisHealthStatus = {
      connected: false,
      memoryUsedMb: 0,
      totalKeys: 0,
      uptimeSeconds: 0,
      activeSessions: 0,
      cachedQueries: 0,
    };
    if (!this._ensureConnected()) return disconnected;
    return getHealthStatusFn(this.redis!);
  }

  getStats(): CacheStats {
    return computeCacheStats(this.stats);
  }

  async flush(pattern?: string): Promise<number> {
    if (!this._ensureConnected()) return 0;
    return flushKeys(this.redis!, pattern);
  }

  // --------------------------------------------------------------------------
  // PRIVATE HELPERS
  // --------------------------------------------------------------------------

  private async _connect(): Promise<void> {
    if (!this.redis) return;
    for (let attempt = 1; attempt <= CONNECT_MAX_RETRIES; attempt++) {
      try {
        await this.redis.connect();
        this.connected = true;
        logger.info('[CogneeSession] Connected to Redis');
        return;
      } catch (err: any) {
        logger.warn(
          `[CogneeSession] Connection attempt ${attempt}/${CONNECT_MAX_RETRIES} failed: ${err.message}`,
        );
        if (attempt < CONNECT_MAX_RETRIES) {
          const delay = CONNECT_RETRY_BASE_MS * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
    logger.warn(
      '[CogneeSession] Could not connect to Redis — operating in degraded mode (no caching/sessions)',
    );
  }

  private _ensureConnected(): boolean {
    return !!(this.connected && this.redis);
  }

  private _hashKey(input: string): string {
    return createHash('sha256').update(input).digest('hex');
  }

  _serializeForCache(data: unknown): string | null {
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

  _deserializeFromCache<T>(data: string): T | null {
    try {
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  }

  private async _findSessionKey(sessionId: string): Promise<string | null> {
    if (!this.redis) return null;
    const pattern = `${KEY_PREFIX}session:*:${sessionId}`;
    const keys = await scanKeys(this.redis, pattern);
    return keys.length > 0 ? keys[0] : null;
  }

  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.connected = false;
      this.redis = null;
    }
  }
}

// Singleton
export const cogneeSessionService = new CogneeSessionService();
