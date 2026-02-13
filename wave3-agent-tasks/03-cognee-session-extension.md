# Agent 3: Cognee Session Service Extension

## Role
Extend the existing Wave 17 `CogneeSessionService` (Redis-based) with user-scoped session data, conversation memory, and Cognee session bridging. Do NOT replace the service — only ADD new methods and extend existing ones.

## Priority: SUB-WAVE 1 (Start Immediately)

## Files to MODIFY

### 1. `server/src/services/cognee-sessions.ts`
**Purpose**: Extend existing Redis session/cache/rate-limit service with multi-user Cognee session support
**CRITICAL**: Read the entire file first. The Wave 17 service already provides:
- `createSession(userId, metadata)` → Redis session lifecycle
- `getSession(sessionId)` → Get session data
- `updateSession(sessionId, data)` → Update session
- `destroySession(sessionId)` → Cleanup
- `listUserSessions(userId)` → All sessions for a user
- `cacheQueryResult(key, result, ttlSeconds)` → Cache with TTL
- `getCachedQueryResult(key)` → Read cache
- `checkRateLimit(userId, limit, windowSeconds)` → Sliding window rate limit

#### Step 1: Add Cognee-specific session types
Add these types near the top of the file (after existing type declarations):

```typescript
// Wave 3: Cognee session types
interface CogneeSessionContext {
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string; timestamp: string }>;
  activeFilters: Record<string, any>;
  lastQuery: string;
  lastDatasets: string[];
  datasetPrefix: string;    // user's dataset prefix (e.g. 'user_abc123')
  cogneeSessionId?: string; // Cognee-side session ID if applicable
}

interface CogneeUserSessionOptions {
  sessionType: 'chat' | 'analysis' | 'batch';
  ttlMinutes?: number; // default 30
  datasetPrefix: string;
}
```

#### Step 2: Add user-scoped Cognee session methods
```typescript
/**
 * Create a Cognee-specific session for a user (Wave 3)
 * Stores conversation context and dataset prefix in Redis
 */
async createCogneeSession(
  userId: string,
  options: CogneeUserSessionOptions
): Promise<{ sessionId: string; context: CogneeSessionContext }> {
  const sessionId = `cognee_${userId}_${Date.now()}`;
  const context: CogneeSessionContext = {
    conversationHistory: [],
    activeFilters: {},
    lastQuery: '',
    lastDatasets: [],
    datasetPrefix: options.datasetPrefix,
  };
  const ttl = (options.ttlMinutes ?? 30) * 60;

  // Store in Redis with TTL
  await this.redis.setex(
    `cognee:session:${sessionId}`,
    ttl,
    JSON.stringify({ userId, sessionType: options.sessionType, context, createdAt: new Date().toISOString() })
  );

  // Add to user's session set
  await this.redis.sadd(`cognee:sessions:user:${userId}`, sessionId);

  return { sessionId, context };
}

/**
 * Get a Cognee session context (Wave 3)
 */
async getCogneeSession(sessionId: string): Promise<CogneeSessionContext | null> {
  const data = await this.redis.get(`cognee:session:${sessionId}`);
  if (!data) return null;
  const parsed = JSON.parse(data);
  return parsed.context;
}

/**
 * Update Cognee session with new conversation turn (Wave 3)
 */
async addConversationTurn(
  sessionId: string,
  role: 'user' | 'assistant',
  content: string,
  query?: string,
  datasets?: string[]
): Promise<void> {
  const key = `cognee:session:${sessionId}`;
  const data = await this.redis.get(key);
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

  // Refresh TTL on activity
  const ttl = await this.redis.ttl(key);
  parsed.context = context;
  await this.redis.setex(key, Math.max(ttl, 1800), JSON.stringify(parsed));
}

/**
 * Get or create a Cognee session for a user (Wave 3)
 * Returns existing active session if one exists, otherwise creates new
 */
async getOrCreateCogneeSession(
  userId: string,
  options: CogneeUserSessionOptions
): Promise<{ sessionId: string; context: CogneeSessionContext; isNew: boolean }> {
  // Check for existing active session
  const sessionIds = await this.redis.smembers(`cognee:sessions:user:${userId}`);
  for (const sid of sessionIds) {
    const ctx = await this.getCogneeSession(sid);
    if (ctx) {
      return { sessionId: sid, context: ctx, isNew: false };
    }
    // Expired — remove from set
    await this.redis.srem(`cognee:sessions:user:${userId}`, sid);
  }

  // No active session — create new
  const result = await this.createCogneeSession(userId, options);
  return { ...result, isNew: true };
}

/**
 * Cache Cognee search results with user-scoped key (Wave 3)
 */
async cacheUserQueryResult(
  userId: string,
  queryHash: string,
  result: any,
  ttlSeconds: number = 300
): Promise<void> {
  const key = `cognee:cache:user_${userId}:${queryHash}`;
  await this.redis.setex(key, ttlSeconds, JSON.stringify(result));
}

/**
 * Get cached Cognee search result for user (Wave 3)
 */
async getCachedUserQueryResult(userId: string, queryHash: string): Promise<any | null> {
  const key = `cognee:cache:user_${userId}:${queryHash}`;
  const data = await this.redis.get(key);
  return data ? JSON.parse(data) : null;
}

/**
 * Destroy all Cognee sessions for a user (Wave 3)
 */
async destroyUserCogneeSessions(userId: string): Promise<number> {
  const sessionIds = await this.redis.smembers(`cognee:sessions:user:${userId}`);
  let destroyed = 0;
  for (const sid of sessionIds) {
    await this.redis.del(`cognee:session:${sid}`);
    destroyed++;
  }
  await this.redis.del(`cognee:sessions:user:${userId}`);
  return destroyed;
}
```

#### Step 3: Export new types
Ensure `CogneeSessionContext` and `CogneeUserSessionOptions` are exported from the file.

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] All existing Wave 17 methods still work (no breaking changes)
- [ ] New methods (`createCogneeSession`, `getCogneeSession`, `addConversationTurn`, `getOrCreateCogneeSession`, `cacheUserQueryResult`, `getCachedUserQueryResult`, `destroyUserCogneeSessions`) compile
- [ ] Types `CogneeSessionContext` and `CogneeUserSessionOptions` are exported
- [ ] Create marker file: `.agent-done-W03-03`

## Dependencies
- **None** — can start immediately (modifies cognee-sessions.ts in isolation)
- **Note**: This service requires Redis — already configured in Docker stack
