/**
 * Cognee Session & Cache Service
 *
 * Redis-backed session management, query caching, and rate limiting
 * for the Cognee knowledge graph integration.
 *
 * Features:
 * - Session lifecycle (create/get/update/destroy/list)
 * - Query result caching with TTL
 * - Sliding-window rate limiting via sorted sets
 * - Graceful degradation when Redis is unavailable
 */

import Redis from 'ioredis';
import { randomUUID, createHash } from 'crypto';

// ============================================================================
// INTERFACES
// ============================================================================

export interface CogneeSession {
  id: string;
  userId: string;
  sessionType: string;
  state: 'active' | 'paused' | 'expired';
  data: Record<string, unknown>;
  createdAt: string;
  lastActivityAt: string;
  expiresAt: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: string;
  retryAfter?: number;
}

export interface RedisHealthStatus {
  connected: boolean;
  memoryUsedMb: number;
  totalKeys: number;
  uptimeSeconds: number;
  activeSessions: number;
  cachedQueries: number;
}

export interface CacheStats {
  cacheHits: number;
  cacheMisses: number;
  hitRate: number;
  activeSessions: number;
  rateLimitDenials: number;
  totalCachedBytes: number;
}

// Wave 3: Cognee user-scoped session types
export interface CogneeSessionContext {
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string; timestamp: string }>;
  activeFilters: Record<string, any>;
  lastQuery: string;
  lastDatasets: string[];
  datasetPrefix: string;
  cogneeSessionId?: string;
}

export interface CogneeUserSessionOptions {
  sessionType: 'chat' | 'analysis' | 'batch';
  ttlMinutes?: number;
  datasetPrefix: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SESSION_TTL_SECONDS = 30 * 60; // 30 minutes
const MAX_CACHE_VALUE_BYTES = 1024 * 1024; // 1 MB
const CONNECT_MAX_RETRIES = 3;
const CONNECT_RETRY_BASE_MS = 1000;
const KEY_PREFIX = 'cognee:';

// ============================================================================
// SERVICE
// ============================================================================

export class CogneeSessionService {
  private redis: Redis | null = null;
  private connected = false;
  private stats = { cacheHits: 0, cacheMisses: 0, rateLimitDenials: 0 };

  constructor(redisUrl?: string) {
    const url = redisUrl ?? process.env.REDIS_URL ?? 'redis://localhost:6379';
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
      console.warn('[CogneeSession] Redis error:', err.message);
    });

    this._connect();
  }

  // ==========================================================================
  // SESSION MANAGEMENT
  // ==========================================================================

  async createSession(userId: string, sessionType: string): Promise<CogneeSession | null> {
    if (!this._ensureConnected()) return null;

    const id = this._generateSessionId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);

    const session: CogneeSession = {
      id,
      userId,
      sessionType,
      state: 'active',
      data: {},
      createdAt: now.toISOString(),
      lastActivityAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    try {
      const key = `${KEY_PREFIX}session:${userId}:${id}`;
      await this.redis!.set(key, JSON.stringify(session), 'EX', SESSION_TTL_SECONDS);
      return session;
    } catch (err: any) {
      console.warn('[CogneeSession] Failed to create session:', err.message);
      return null;
    }
  }

  async getSession(sessionId: string): Promise<CogneeSession | null> {
    if (!this._ensureConnected()) return null;

    try {
      const key = await this._findSessionKey(sessionId);
      if (!key) return null;

      const data = await this.redis!.get(key);
      if (!data) return null;

      const session: CogneeSession = JSON.parse(data);
      // Refresh TTL on access
      session.lastActivityAt = new Date().toISOString();
      await this.redis!.set(key, JSON.stringify(session), 'EX', SESSION_TTL_SECONDS);
      return session;
    } catch (err: any) {
      console.warn('[CogneeSession] Failed to get session:', err.message);
      return null;
    }
  }

  async updateSession(sessionId: string, updates: Partial<Pick<CogneeSession, 'state' | 'data'>>): Promise<CogneeSession | null> {
    if (!this._ensureConnected()) return null;

    try {
      const key = await this._findSessionKey(sessionId);
      if (!key) return null;

      const data = await this.redis!.get(key);
      if (!data) return null;

      const session: CogneeSession = JSON.parse(data);

      if (updates.state) session.state = updates.state;
      if (updates.data) session.data = { ...session.data, ...updates.data };
      session.lastActivityAt = new Date().toISOString();

      await this.redis!.set(key, JSON.stringify(session), 'EX', SESSION_TTL_SECONDS);
      return session;
    } catch (err: any) {
      console.warn('[CogneeSession] Failed to update session:', err.message);
      return null;
    }
  }

  async destroySession(sessionId: string): Promise<boolean> {
    if (!this._ensureConnected()) return false;

    try {
      const key = await this._findSessionKey(sessionId);
      if (!key) return false;

      const deleted = await this.redis!.del(key);
      return deleted > 0;
    } catch (err: any) {
      console.warn('[CogneeSession] Failed to destroy session:', err.message);
      return false;
    }
  }

  async listUserSessions(userId: string): Promise<CogneeSession[]> {
    if (!this._ensureConnected()) return [];

    try {
      const pattern = `${KEY_PREFIX}session:${userId}:*`;
      const keys = await this._scanKeys(pattern);

      const sessions: CogneeSession[] = [];
      for (const key of keys) {
        const data = await this.redis!.get(key);
        if (data) {
          sessions.push(JSON.parse(data));
        }
      }
      return sessions;
    } catch (err: any) {
      console.warn('[CogneeSession] Failed to list sessions:', err.message);
      return [];
    }
  }

  // ==========================================================================
  // QUERY CACHING
  // ==========================================================================

  async cacheQueryResult(cacheKey: string, result: unknown, ttlSeconds: number = 300): Promise<boolean> {
    if (!this._ensureConnected()) return false;

    try {
      const serialized = this._serializeForCache(result);
      if (!serialized) return false;

      const key = `${KEY_PREFIX}cache:query:${cacheKey}`;
      await this.redis!.set(key, serialized, 'EX', ttlSeconds);
      return true;
    } catch (err: any) {
      console.warn('[CogneeSession] Failed to cache result:', err.message);
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
      console.warn('[CogneeSession] Failed to get cached result:', err.message);
      this.stats.cacheMisses++;
      return null;
    }
  }

  async invalidateCache(pattern: string): Promise<number> {
    if (!this._ensureConnected()) return 0;

    try {
      const fullPattern = `${KEY_PREFIX}cache:query:${pattern}`;
      const keys = await this._scanKeys(fullPattern);

      if (keys.length === 0) return 0;

      const deleted = await this.redis!.del(...keys);
      return deleted;
    } catch (err: any) {
      console.warn('[CogneeSession] Failed to invalidate cache:', err.message);
      return 0;
    }
  }

  buildCacheKey(queryType: string, params: Record<string, unknown>): string {
    const sortedJson = JSON.stringify(params, Object.keys(params).sort());
    return this._hashKey(`${queryType}:${sortedJson}`);
  }

  // ==========================================================================
  // RATE LIMITING (sliding window via sorted sets)
  // ==========================================================================

  async checkRateLimit(operation: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const defaultAllowed: RateLimitResult = {
      allowed: true,
      remaining: limit,
      limit,
      resetAt: new Date(Date.now() + windowSeconds * 1000).toISOString(),
    };

    if (!this._ensureConnected()) return defaultAllowed;

    try {
      const key = `${KEY_PREFIX}ratelimit:${operation}`;
      const now = Date.now();
      const windowStart = now - windowSeconds * 1000;

      const pipeline = this.redis!.pipeline();
      // Remove expired entries
      pipeline.zremrangebyscore(key, 0, windowStart);
      // Add current request
      pipeline.zadd(key, now.toString(), `${now}:${randomUUID()}`);
      // Count entries in window
      pipeline.zcard(key);
      // Set expiry on the key itself
      pipeline.expire(key, windowSeconds);

      const results = await pipeline.exec();
      if (!results) return defaultAllowed;

      const count = (results[2]?.[1] as number) ?? 0;
      const allowed = count <= limit;

      if (!allowed) {
        this.stats.rateLimitDenials++;
        // Find the oldest entry to determine when the window resets
        const oldest = await this.redis!.zrange(key, 0, 0, 'WITHSCORES');
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
    } catch (err: any) {
      console.warn('[CogneeSession] Rate limit check failed:', err.message);
      return defaultAllowed;
    }
  }

  async getRateLimitStatus(operation: string): Promise<{ count: number; limit: number } | null> {
    if (!this._ensureConnected()) return null;

    try {
      const key = `${KEY_PREFIX}ratelimit:${operation}`;
      const count = await this.redis!.zcard(key);
      return { count, limit: 0 }; // limit is context-dependent, caller knows it
    } catch (err: any) {
      console.warn('[CogneeSession] Rate limit status failed:', err.message);
      return null;
    }
  }

  // ==========================================================================
  // WAVE 3: USER-SCOPED COGNEE SESSIONS
  // ==========================================================================

  /**
   * Create a Cognee-specific session for a user (Wave 3)
   * Stores conversation context and dataset prefix in Redis
   */
  async createCogneeSession(
    userId: string,
    options: CogneeUserSessionOptions
  ): Promise<{ sessionId: string; context: CogneeSessionContext } | null> {
    if (!this._ensureConnected()) return null;

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
      await this.redis!.set(
        key,
        JSON.stringify({ userId, sessionType: options.sessionType, context, createdAt: new Date().toISOString() }),
        'EX',
        ttl
      );

      // Add to user's Cognee session set
      await this.redis!.sadd(`${KEY_PREFIX}csessions:user:${userId}`, sessionId);

      return { sessionId, context };
    } catch (err: any) {
      console.warn('[CogneeSession] Failed to create Cognee session:', err.message);
      return null;
    }
  }

  /**
   * Get a Cognee session context (Wave 3)
   */
  async getCogneeSession(sessionId: string): Promise<CogneeSessionContext | null> {
    if (!this._ensureConnected()) return null;

    try {
      const key = `${KEY_PREFIX}csession:${sessionId}`;
      const data = await this.redis!.get(key);
      if (!data) return null;

      const parsed = JSON.parse(data);
      return parsed.context as CogneeSessionContext;
    } catch (err: any) {
      console.warn('[CogneeSession] Failed to get Cognee session:', err.message);
      return null;
    }
  }

  /**
   * Update Cognee session with new conversation turn (Wave 3)
   * Appends to history (max 20 turns) and refreshes TTL on activity.
   */
  async addConversationTurn(
    sessionId: string,
    role: 'user' | 'assistant',
    content: string,
    query?: string,
    datasets?: string[]
  ): Promise<void> {
    if (!this._ensureConnected()) return;

    try {
      const key = `${KEY_PREFIX}csession:${sessionId}`;
      const data = await this.redis!.get(key);
      if (!data) return;

      const parsed = JSON.parse(data);
      const context = parsed.context as CogneeSessionContext;

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
      const ttl = await this.redis!.ttl(key);
      parsed.context = context;
      await this.redis!.set(key, JSON.stringify(parsed), 'EX', Math.max(ttl, 1800));
    } catch (err: any) {
      console.warn('[CogneeSession] Failed to add conversation turn:', err.message);
    }
  }

  /**
   * Get or create a Cognee session for a user (Wave 3)
   * Returns existing active session if one exists, otherwise creates new.
   */
  async getOrCreateCogneeSession(
    userId: string,
    options: CogneeUserSessionOptions
  ): Promise<{ sessionId: string; context: CogneeSessionContext; isNew: boolean } | null> {
    if (!this._ensureConnected()) return null;

    try {
      // Check for existing active sessions
      const sessionIds = await this.redis!.smembers(`${KEY_PREFIX}csessions:user:${userId}`);
      for (const sid of sessionIds) {
        const ctx = await this.getCogneeSession(sid);
        if (ctx) {
          return { sessionId: sid, context: ctx, isNew: false };
        }
        // Expired — remove from set
        await this.redis!.srem(`${KEY_PREFIX}csessions:user:${userId}`, sid);
      }

      // No active session — create new
      const result = await this.createCogneeSession(userId, options);
      if (!result) return null;
      return { ...result, isNew: true };
    } catch (err: any) {
      console.warn('[CogneeSession] Failed to get/create Cognee session:', err.message);
      return null;
    }
  }

  /**
   * Cache Cognee search results with user-scoped key (Wave 3)
   */
  async cacheUserQueryResult(
    userId: string,
    queryHash: string,
    result: any,
    ttlSeconds: number = 300
  ): Promise<boolean> {
    if (!this._ensureConnected()) return false;

    try {
      const key = `${KEY_PREFIX}cache:user_${userId}:${queryHash}`;
      const serialized = this._serializeForCache(result);
      if (!serialized) return false;

      await this.redis!.set(key, serialized, 'EX', ttlSeconds);
      return true;
    } catch (err: any) {
      console.warn('[CogneeSession] Failed to cache user query result:', err.message);
      return false;
    }
  }

  /**
   * Get cached Cognee search result for user (Wave 3)
   */
  async getCachedUserQueryResult(userId: string, queryHash: string): Promise<any | null> {
    if (!this._ensureConnected()) return null;

    try {
      const key = `${KEY_PREFIX}cache:user_${userId}:${queryHash}`;
      const data = await this.redis!.get(key);
      return data ? this._deserializeFromCache(data) : null;
    } catch (err: any) {
      console.warn('[CogneeSession] Failed to get cached user query result:', err.message);
      return null;
    }
  }

  /**
   * Destroy all Cognee sessions for a user (Wave 3)
   */
  async destroyUserCogneeSessions(userId: string): Promise<number> {
    if (!this._ensureConnected()) return 0;

    try {
      const sessionIds = await this.redis!.smembers(`${KEY_PREFIX}csessions:user:${userId}`);
      let destroyed = 0;
      for (const sid of sessionIds) {
        const deleted = await this.redis!.del(`${KEY_PREFIX}csession:${sid}`);
        if (deleted > 0) destroyed++;
      }
      await this.redis!.del(`${KEY_PREFIX}csessions:user:${userId}`);
      return destroyed;
    } catch (err: any) {
      console.warn('[CogneeSession] Failed to destroy user Cognee sessions:', err.message);
      return 0;
    }
  }

  // ==========================================================================
  // HEALTH & STATS
  // ==========================================================================

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

    try {
      const info = await this.redis!.info();

      const memoryMatch = info.match(/used_memory:(\d+)/);
      const uptimeMatch = info.match(/uptime_in_seconds:(\d+)/);

      const totalKeys = await this.redis!.dbsize();
      const sessionKeys = await this._scanKeys(`${KEY_PREFIX}session:*`);
      const cacheKeys = await this._scanKeys(`${KEY_PREFIX}cache:query:*`);

      return {
        connected: true,
        memoryUsedMb: memoryMatch ? parseInt(memoryMatch[1], 10) / (1024 * 1024) : 0,
        totalKeys,
        uptimeSeconds: uptimeMatch ? parseInt(uptimeMatch[1], 10) : 0,
        activeSessions: sessionKeys.length,
        cachedQueries: cacheKeys.length,
      };
    } catch (err: any) {
      console.warn('[CogneeSession] Health check failed:', err.message);
      return disconnected;
    }
  }

  getStats(): CacheStats {
    const total = this.stats.cacheHits + this.stats.cacheMisses;
    return {
      cacheHits: this.stats.cacheHits,
      cacheMisses: this.stats.cacheMisses,
      hitRate: total > 0 ? this.stats.cacheHits / total : 0,
      activeSessions: 0, // filled from health check if needed
      rateLimitDenials: this.stats.rateLimitDenials,
      totalCachedBytes: 0, // approximate only via health check
    };
  }

  async flush(pattern?: string): Promise<number> {
    if (!this._ensureConnected()) return 0;

    try {
      const fullPattern = pattern ? `${KEY_PREFIX}${pattern}` : `${KEY_PREFIX}*`;
      const keys = await this._scanKeys(fullPattern);

      if (keys.length === 0) return 0;

      const deleted = await this.redis!.del(...keys);
      return deleted;
    } catch (err: any) {
      console.warn('[CogneeSession] Flush failed:', err.message);
      return 0;
    }
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  private async _connect(): Promise<void> {
    if (!this.redis) return;

    for (let attempt = 1; attempt <= CONNECT_MAX_RETRIES; attempt++) {
      try {
        await this.redis.connect();
        this.connected = true;
        console.log('[CogneeSession] Connected to Redis');
        return;
      } catch (err: any) {
        console.warn(`[CogneeSession] Connection attempt ${attempt}/${CONNECT_MAX_RETRIES} failed: ${err.message}`);
        if (attempt < CONNECT_MAX_RETRIES) {
          const delay = CONNECT_RETRY_BASE_MS * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    console.warn('[CogneeSession] Could not connect to Redis — operating in degraded mode (no caching/sessions)');
  }

  private _ensureConnected(): boolean {
    if (this.connected && this.redis) return true;
    return false;
  }

  private _generateSessionId(): string {
    return randomUUID();
  }

  private _hashKey(input: string): string {
    return createHash('sha256').update(input).digest('hex');
  }

  private _serializeForCache(data: unknown): string | null {
    try {
      const json = JSON.stringify(data);
      if (Buffer.byteLength(json, 'utf-8') > MAX_CACHE_VALUE_BYTES) {
        console.warn('[CogneeSession] Cache value exceeds 1MB limit, skipping');
        return null;
      }
      return json;
    } catch {
      return null;
    }
  }

  private _deserializeFromCache<T>(data: string): T | null {
    try {
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  }

  private async _findSessionKey(sessionId: string): Promise<string | null> {
    if (!this.redis) return null;

    const pattern = `${KEY_PREFIX}session:*:${sessionId}`;
    const keys = await this._scanKeys(pattern);
    return keys.length > 0 ? keys[0] : null;
  }

  private async _scanKeys(pattern: string): Promise<string[]> {
    if (!this.redis) return [];

    const keys: string[] = [];
    let cursor = '0';

    do {
      const [nextCursor, batch] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      keys.push(...batch);
    } while (cursor !== '0');

    return keys;
  }

  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.connected = false;
      this.redis = null;
    }
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

export const cogneeSessionService = new CogneeSessionService();
