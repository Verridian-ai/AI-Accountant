# Agent 2: CogneeClient Multi-User Enhancement

## Role
Add per-user authentication token management, userId parameter to all public methods, and new user account management methods to CogneeClient.

## Priority: SUB-WAVE 1 (Start Immediately)

## Files to MODIFY

### 1. `server/src/services/cognee_client.ts`
**Purpose**: Transform single-admin client into multi-user-aware client while preserving backward compatibility
**CRITICAL**: This file is 953 lines. Read it fully before making changes. Do NOT break existing methods.

#### Step 1: Add user token cache with LRU eviction (near top of class, after existing token fields)

> **REVISION NOTE (D03 scalability):** The token cache MUST be bounded with LRU eviction (max 1000 entries) to prevent unbounded memory growth. A `setInterval` sweep removes expired entries every 5 minutes.

```typescript
// Per-user token cache for multi-user support (Wave 3)
// REVISION: LRU-bounded to 1000 entries (D03 S5 fix)
private userTokenCache: Map<string, { token: string; expiresAt: number }> = new Map();
private static readonly MAX_TOKEN_CACHE_SIZE = 1000;

constructor(/* ... existing params ... */) {
  // ... existing constructor code ...

  // Wave 3: Sweep expired tokens every 5 minutes
  setInterval(() => this.sweepExpiredTokens(), 5 * 60 * 1000).unref();
}

/**
 * Evict expired entries and enforce LRU bound (Wave 3)
 */
private sweepExpiredTokens(): void {
  const now = Date.now();
  for (const [key, value] of this.userTokenCache) {
    if (value.expiresAt <= now) {
      this.userTokenCache.delete(key);
    }
  }
}

/**
 * LRU eviction: if cache exceeds MAX_TOKEN_CACHE_SIZE, remove oldest entries (Wave 3)
 */
private evictIfNeeded(): void {
  if (this.userTokenCache.size > CogneeClient.MAX_TOKEN_CACHE_SIZE) {
    // Map insertion order = LRU order; delete oldest entries
    const excess = this.userTokenCache.size - CogneeClient.MAX_TOKEN_CACHE_SIZE;
    let deleted = 0;
    for (const key of this.userTokenCache.keys()) {
      if (deleted >= excess) break;
      this.userTokenCache.delete(key);
      deleted++;
    }
  }
}
```

#### Step 2: Modify `getAuthToken()` to support per-user tokens
**BEFORE**: `getAuthToken()` returns a single cached admin token.
**AFTER**: `getAuthToken(userId?: string)` checks userTokenCache first, then falls back to admin token.

```typescript
async getAuthToken(userId?: string): Promise<string> {
  // If userId provided, check per-user cache first
  if (userId) {
    const cached = this.userTokenCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.token;
    }
    // If user has a Cognee account, authenticate as that user
    // (caller must have called setupUserAuth first)
    // Fall through to admin token if not set up
  }

  // Existing admin token logic — preserve as-is
  // ...existing code...
}
```

#### Step 3: Add user account management methods

> **REVISION NOTE (D02 CRIT-03):** Do NOT store Cognee passwords in the application database. Use Cognee's OAuth2/API key flow instead. If password auth is the only option, use short-lived tokens (< 15 min) with a proper refresh flow. Store only refresh tokens (encrypted), NEVER passwords. Add token revocation on user logout/session expiry.

```typescript
/**
 * Create a Cognee user account (Wave 3 multi-user)
 * Calls Cognee's user registration endpoint.
 * SECURITY: The password is used ONLY for initial account creation and immediate
 * token retrieval. It is NOT stored — only the resulting refresh token is kept
 * (encrypted in cognee_user_accounts.cogneeRefreshToken).
 */
async createCogneeUser(email: string, password: string): Promise<{ userId: string; refreshToken: string }> {
  const adminToken = await this.getAuthToken(); // admin token for user creation
  const response = await fetch(`${this.baseUrl}/api/v1/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ username: email, password }),
  });
  if (!response.ok) {
    throw new Error(`Failed to create Cognee user: ${response.status}`);
  }
  const result = await response.json();

  // Immediately authenticate to get tokens — discard password after this
  const tokens = await this.getCogneeUserTokens(email, password);
  return { userId: result.userId ?? result.id, refreshToken: tokens.refreshToken };
}

/**
 * Get Cognee auth tokens for a specific user (Wave 3 multi-user)
 * Returns BOTH access_token (short-lived, < 15 min) and refresh_token
 * REVISION: Short-lived access tokens per D02 CRIT-03
 */
async getCogneeUserTokens(email: string, password: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const response = await fetch(`${this.baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: email, password }),
  });
  if (!response.ok) {
    throw new Error(`Cognee user auth failed: ${response.status}`);
  }
  const data = await response.json();
  return {
    accessToken: data.access_token ?? data.token,
    refreshToken: data.refresh_token ?? data.access_token ?? data.token,
    expiresIn: data.expires_in ?? 900, // Default 15 min
  };
}

/**
 * Refresh a Cognee access token using a stored refresh token (Wave 3)
 * REVISION: This replaces password-based re-auth per D02 CRIT-03
 */
async refreshCogneeToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const response = await fetch(`${this.baseUrl}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!response.ok) {
    throw new Error(`Cognee token refresh failed: ${response.status}`);
  }
  const data = await response.json();
  return {
    accessToken: data.access_token ?? data.token,
    refreshToken: data.refresh_token ?? refreshToken, // Keep old refresh token if not rotated
    expiresIn: data.expires_in ?? 900,
  };
}

/**
 * Set up per-user auth token cache entry using refresh token (Wave 3)
 * REVISION: Uses refresh token, NOT password. Token lifetime capped at 15 min (D02 CRIT-03)
 */
async setupUserAuth(userId: string, refreshToken: string): Promise<void> {
  const tokens = await this.refreshCogneeToken(refreshToken);
  const expiresIn = Math.min(tokens.expiresIn, 900); // Cap at 15 min
  this.userTokenCache.set(userId, {
    token: tokens.accessToken,
    expiresAt: Date.now() + expiresIn * 1000,
  });
  this.evictIfNeeded(); // REVISION: LRU eviction (D03 S5)
}

/**
 * Clear cached token for a user (Wave 3) — call on logout/session expiry
 */
clearUserToken(userId: string): void {
  this.userTokenCache.delete(userId);
}

/**
 * Revoke a Cognee user's tokens (Wave 3) — call on session expiry/logout
 * REVISION: Added per D02 CRIT-03 for proper token lifecycle
 */
async revokeUserToken(userId: string, refreshToken?: string): Promise<void> {
  this.userTokenCache.delete(userId);
  if (refreshToken) {
    try {
      await fetch(`${this.baseUrl}/api/v1/auth/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    } catch (e) {
      console.warn(`Failed to revoke Cognee token for user ${userId}:`, e);
    }
  }
}
```

#### Step 4: Add `userId` optional parameter to ALL public methods
For EACH of these methods, add `userId?: string` as the LAST parameter and pass it to `getAuthToken(userId)`:

- `add(data, dataset, userId?)`
- `search(query, dataset, topK, searchType, userId?)`
- `searchRich(query, dataset, topK, searchType, userId?)`
- `cognify(datasets, background, customPrompt, userId?)`
- `addAndCognify(data, dataset, background, userId?)`
- `listDatasets(userId?)`
- `getDatasetStatus(userId?)`
- `getDatasetGraph(datasetId, userId?)`
- `createDataset(name, userId?)`
- `submitFeedback(data, userId?)`
- `triggerMemify(data, userId?)`
- `createDataPoint(datasetName, schema, userId?)`
- `getDataPoints(datasetName, userId?)`
- `deleteDataPoint(datasetName, dpId, userId?)`
- `applyOntology(datasetName, ontology, userId?)`
- `getOntology(datasetName, userId?)`
- `getNodeSets(datasetName, userId?)`
- `createNodeSet(datasetName, nodeSet, userId?)`
- `deleteNodeSet(datasetName, nodeSetId, userId?)`
- `temporalSearch(query, options, userId?)`
- `temporalCognify(dataset, options, userId?)`
- `crossDatasetSearch(query, datasets, options, userId?)`

**IMPORTANT**: Where methods call `this.authHeaders()`, change to use `this.getAuthToken(userId)`:
```typescript
// BEFORE:
const headers = await this.authHeaders();
// AFTER:
const token = await this.getAuthToken(userId);
const headers = { 'Authorization': `Bearer ${token}` };
```

If there's a private `authHeaders()` method, modify it to accept optional userId:
```typescript
private async authHeaders(userId?: string): Promise<Record<string, string>> {
  const token = await this.getAuthToken(userId);
  return { 'Authorization': `Bearer ${token}` };
}
```

#### Step 5: Add session-aware search method
```typescript
/**
 * Search with conversational session context (Wave 3)
 * Passes session_id to Cognee for memory-aware retrieval
 */
async searchWithSession(
  query: string,
  dataset: string,
  sessionId: string,
  topK: number = 5,
  searchType: CogneeSearchType = 'CHUNKS',
  userId?: string
): Promise<CogneeSearchResult[]> {
  const token = await this.getAuthToken(userId);
  const response = await fetch(`${this.baseUrl}/api/v1/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      query,
      search_type: searchType,
      datasets: [dataset],
      top_k: topK,
      session_id: sessionId,
    }),
  });
  if (!response.ok) {
    console.error(`Cognee session search failed: ${response.status}`);
    return [];
  }
  return response.json();
}
```

#### Step 6: Add domain-specific convenience methods with userId
For ALL domain-specific convenience methods (addStatementData, addTransaction, searchSimilarTransactions, getCategoryPatterns, traceAccountFlows, getGSTRuling, addCorrection, storeMerchantMapping, lookupMerchant, batchLookupMerchants, updateMerchantFromCorrection):
- Add `userId?: string` as the LAST parameter
- Pass `userId` through to the underlying `add()`, `search()`, or `searchRich()` calls

## Backward Compatibility Contract
- ALL existing calls (without userId) MUST continue to work using the admin token
- `getAuthToken()` without args MUST return admin token as before
- No existing method signatures change — only new optional parameter added
- If `REQUIRE_AUTHENTICATION=false` in Cognee, auth headers are still sent but Cognee ignores them

> **REVISION NOTE (D02 CRIT-03 — Password Storage):** The `cognee_user_accounts` table MUST store an encrypted **refresh token** (`cogneeRefreshToken`), NOT the Cognee password. The column previously named `cogneePasswordHash` is renamed to `cogneeRefreshToken` (AES-256-GCM encrypted). The `createCogneeUser()` method accepts a password ONLY for initial account creation, immediately retrieves tokens, and discards the password. Subsequent auth uses `refreshCogneeToken()` with the stored refresh token. See Wave 3 Agent 1 migration for the updated column name.

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] All existing method signatures preserved (optional param only)
- [ ] `getAuthToken()` without args still returns admin token
- [ ] `getAuthToken('user123')` checks userTokenCache, falls back to admin
- [ ] New methods (`createCogneeUser`, `getCogneeUserToken`, `setupUserAuth`, `searchWithSession`) compile
- [ ] Create marker file: `.agent-done-W03-02`

## Dependencies
- **None** — can start immediately (cognee_client.ts is self-contained)
