# Agent W17-04: Redis Session & Cache Builder

## Role
Build the Cognee session management service using Redis. Activate Redis for query caching, session state, and rate limiting of Cognee API calls.

## Priority: WAVE 17 (After W17-01 and W17-02 complete)

## Wait Condition
Check for `.agent-done-W17-01` and `.agent-done-W17-02` marker files before starting.

## Context
- Docker compose: `docker-compose.yml` -- existing service definitions
- Temporal queries use result caching (cache_expires_at field in temporalQueries table)
- Cognee API calls should be rate-limited to prevent overload
- Session state needed for multi-step temporal queries and graph explorations

## Files to CREATE

### 1. `server/src/services/cognee-sessions.ts`
**Purpose**: Redis-backed session management, query caching, and rate limiting for Cognee operations
**Pattern**: Follow `server/src/services/queue.ts` for connection management patterns

- [ ] Create `CogneeSessionService` class with the following methods:

  - `constructor(redisUrl?: string)` -- Connects to Redis using `ioredis` package. Default URL from `REDIS_URL` env var or `redis://localhost:6379`. Graceful reconnection handling. Connection health check on init.

  - **Session Management**:

  - `createSession(userId: string, sessionType: string): Promise<CogneeSession>` -- Creates session in Redis with TTL (default 30 minutes). Session types: 'temporal_query', 'graph_exploration', 'insight_analysis', 'feedback_review'. Stores: userId, type, state, createdAt, lastActivityAt, data.
    ```typescript
    interface CogneeSession {
      id: string;
      userId: string;
      sessionType: string;
      state: 'active' | 'paused' | 'expired';
      data: Record<string, unknown>; // session-specific data
      createdAt: string;
      lastActivityAt: string;
      expiresAt: string;
    }
    ```

  - `getSession(sessionId: string): Promise<CogneeSession | null>` -- Retrieves session from Redis. Returns null if expired or not found. Refreshes TTL on access.

  - `updateSession(sessionId: string, updates: Partial<CogneeSession>): Promise<CogneeSession>` -- Updates session data in Redis. Refreshes TTL.

  - `destroySession(sessionId: string): Promise<void>` -- Removes session from Redis.

  - `listUserSessions(userId: string): Promise<CogneeSession[]>` -- Lists all active sessions for a user. Uses Redis SCAN with pattern `session:${userId}:*`.

  - **Query Caching**:

  - `cacheQueryResult(cacheKey: string, result: unknown, ttlSeconds: number): Promise<void>` -- Stores query result in Redis with TTL. Key format: `cache:query:${hash(query + params)}`. Serializes result to JSON.

  - `getCachedResult(cacheKey: string): Promise<unknown | null>` -- Retrieves cached result. Returns null if not found or expired.

  - `invalidateCache(pattern: string): Promise<number>` -- Invalidates cache entries matching pattern. Uses Redis SCAN + DEL. Returns count of deleted keys. Pattern examples: `cache:query:*` (all queries), `cache:query:temporal:*` (temporal queries only).

  - `buildCacheKey(queryType: string, params: Record<string, unknown>): string` -- Generates deterministic cache key from query type and parameters. Uses stable JSON stringify + hash.

  - **Rate Limiting**:

  - `checkRateLimit(operation: string, limit: number, windowSeconds: number): Promise<RateLimitResult>` -- Sliding window rate limiter using Redis sorted sets. Operations: 'cognify', 'search', 'graph_query', 'feedback'. Returns allowed/denied with remaining quota.
    ```typescript
    interface RateLimitResult {
      allowed: boolean;
      remaining: number;
      limit: number;
      resetAt: string; // when window resets
      retryAfter?: number; // seconds to wait if denied
    }
    ```

  - `getRateLimitStatus(operation: string): Promise<RateLimitStatus>` -- Current rate limit status without consuming quota.

  - **Health & Stats**:

  - `getHealthStatus(): Promise<RedisHealthStatus>` -- Returns: connected, memory usage, key count, uptime.
    ```typescript
    interface RedisHealthStatus {
      connected: boolean;
      memoryUsedMb: number;
      totalKeys: number;
      uptimeSeconds: number;
      activeSessions: number;
      cachedQueries: number;
    }
    ```

  - `getStats(): Promise<CacheStats>` -- Cache hit/miss ratios, session counts, rate limit denials.
    ```typescript
    interface CacheStats {
      cacheHits: number;
      cacheMisses: number;
      hitRate: number;
      activeSessions: number;
      rateLimitDenials: number;
      totalCachedBytes: number;
    }
    ```

  - `flush(pattern?: string): Promise<number>` -- Clear cache entries. Without pattern, clears all app keys (preserving Redis system keys). With pattern, clears matching keys only.

- [ ] Implement private helper methods:
  - `_connect(): Promise<void>` -- Redis connection with retry logic (3 attempts, exponential backoff)
  - `_ensureConnected(): void` -- Throws if not connected
  - `_generateSessionId(): string` -- UUID v4 for session IDs
  - `_hashKey(input: string): string` -- Deterministic hash for cache keys (use crypto.createHash('sha256'))
  - `_serializeForCache(data: unknown): string` -- JSON.stringify with size limit check (max 1MB per entry)
  - `_deserializeFromCache(data: string): unknown` -- JSON.parse with error handling

## Files to MODIFY

### 2. `docker-compose.yml`
- [ ] Add Redis service:
  ```yaml
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3
    restart: unless-stopped
  ```

- [ ] Add `redis_data` to volumes section:
  ```yaml
  volumes:
    postgres_data:
    redis_data:
  ```

- [ ] Add `REDIS_URL: redis://redis:6379` environment variable to server service

- [ ] Add `depends_on: redis: condition: service_healthy` to server service

### 3. `server/src/services/temporal-cognify.ts` (from W17-02)
- [ ] Wire `_checkCache()` to use `CogneeSessionService.getCachedResult()` instead of DB cache
- [ ] Wire `_updateCache()` to use `CogneeSessionService.cacheQueryResult()` instead of DB cache
- [ ] Add rate limiting: before Cognee API calls, check `CogneeSessionService.checkRateLimit('search', 100, 60)` (100 searches per minute)

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `docker compose config` validates with Redis service
- [ ] `docker compose up redis -d` starts Redis successfully
- [ ] `docker compose exec redis redis-cli ping` returns PONG
- [ ] `CogneeSessionService` can be instantiated and connects to Redis
- [ ] `createSession()` creates session retrievable by `getSession()`
- [ ] Session expires after TTL (test with short TTL like 2 seconds)
- [ ] `cacheQueryResult()` stores and `getCachedResult()` retrieves correctly
- [ ] Cache entries expire after TTL
- [ ] `checkRateLimit()` returns `allowed: false` after limit exceeded
- [ ] `invalidateCache('cache:query:*')` clears all query caches
- [ ] `getHealthStatus()` returns valid metrics
- [ ] `npm install ioredis` succeeds (add to server/package.json)
- [ ] Create marker file: `.agent-done-W17-04`

## Dependencies
- **Requires**: W17-01 (`.agent-done-W17-01`), W17-02 (`.agent-done-W17-02`) -- temporal service for cache integration
- **npm install**: Must install `ioredis` and `@types/ioredis` packages
- **IMPORTANT**: Only W17-04 modifies docker-compose.yml in Wave 17
