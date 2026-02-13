# Agent 10: Testing & Validation

## Role
Run the full verification plan for Wave 3, checking TypeScript compilation, backward compatibility, Wave 16/17 preservation, and documenting results.

## Priority: SUB-WAVE 4 (After ALL agents complete)

## Verification Steps

### Step 1: TypeScript Compilation
```bash
cd server && npx tsc --noEmit
cd client && npx tsc --noEmit
```
Both must pass clean. If there are errors:
- Fix import paths (`.js` extension required in ESM)
- Fix missing type exports
- Fix optional parameter type mismatches
- Do NOT fix pre-existing errors (check git diff to identify new errors only)

### Step 2: Schema Verification
- [ ] Verify `cogneeUserAccounts` exists in schema.ts with correct columns
- [ ] Verify `cogneeSessions` exists in schema.ts with correct columns
- [ ] Verify matching pgTable definitions in postgres-schema.ts
- [ ] Verify type exports: CogneeUserAccount, NewCogneeUserAccount, CogneeSession, NewCogneeSession
- [ ] Verify migration `0015_cognee_multi_user.sql` has valid PostgreSQL syntax

### Step 3: CogneeClient Backward Compatibility
Test that all existing CogneeClient methods still work without userId:
- [ ] `cogneeClient.search(query, dataset, topK, type)` — no userId arg → uses admin token
- [ ] `cogneeClient.add(data, dataset)` — no userId arg → uses admin token
- [ ] `cogneeClient.cognify(datasets, bg)` — no userId arg → uses admin token
- [ ] `cogneeClient.getAuthToken()` — no args → returns admin token
- [ ] All convenience methods (addStatementData, searchSimilarTransactions, etc.) still compile

### Step 4: New CogneeClient Methods
- [ ] `cogneeClient.createCogneeUser(email, password)` compiles
- [ ] `cogneeClient.getCogneeUserToken(email, password)` compiles
- [ ] `cogneeClient.setupUserAuth(userId, email, password)` compiles
- [ ] `cogneeClient.clearUserToken(userId)` compiles
- [ ] `cogneeClient.searchWithSession(query, dataset, sessionId)` compiles

### Step 5: Session Service Extensions
- [ ] `cogneeSessionService.createCogneeSession(userId, options)` compiles
- [ ] `cogneeSessionService.getCogneeSession(sessionId)` compiles
- [ ] `cogneeSessionService.addConversationTurn(sessionId, role, content)` compiles
- [ ] `cogneeSessionService.getOrCreateCogneeSession(userId, options)` compiles
- [ ] `cogneeSessionService.cacheUserQueryResult(userId, hash, result)` compiles
- [ ] `cogneeSessionService.getCachedUserQueryResult(userId, hash)` compiles
- [ ] `cogneeSessionService.destroyUserCogneeSessions(userId)` compiles
- [ ] All existing Wave 17 methods still compile and work

### Step 6: CogneeTools Prefix Wiring
- [ ] `CogneeTools.forUser('abc123')` creates tools with prefix `user_abc123`
- [ ] All CogneeClient calls in cognee-tools.ts pass userId
- [ ] `prefixDataset()` correctly applies user prefix

### Step 7: DataPoint Models
- [ ] File `server/src/services/cognee/datapoint-models.ts` exists
- [ ] Exports 8 DataPoint definitions (TransactionNode through DeductionNode)
- [ ] `ALL_DATAPOINT_MODELS` has exactly 8 entries
- [ ] `registerAllDataPoints()` function compiles

### Step 8: Wave 16 Compatibility
- [ ] `cognee-datapoints.ts` — all methods accept optional userId
- [ ] `cognee-ontologies.ts` — all methods accept optional userId
- [ ] `cognee-feedback.ts` — all methods accept optional userId
- [ ] `cognee-graph.ts` — all methods accept optional userId
- [ ] Wave 16 API routes (`/api/knowledge/*`) still respond correctly

### Step 9: Wave 17 Compatibility
- [ ] `temporal-cognify.ts` — no breaking changes
- [ ] `cross-module-intelligence.ts` — no breaking changes
- [ ] `cognee-sessions.ts` — extended, not replaced
- [ ] `intelligence-subscriptions.ts` — no breaking changes

### Step 10: API Endpoints
- [ ] POST `/api/cognee/init-user` endpoint exists with Zod validation
- [ ] POST `/api/cognee/reindex` endpoint exists with Zod validation
- [ ] GET `/api/cognee/session` endpoint exists
- [ ] GET `/api/cognee/graph/:userId` endpoint exists
- [ ] Chat endpoint (`/api/chat`) accepts userId and sessionId

### Step 11: Docker Configuration
- [ ] `docker-compose.yml` has `REQUIRE_AUTHENTICATION=true`
- [ ] `docker-compose.yml` has `ENABLE_BACKEND_ACCESS_CONTROL=true`
- [ ] `docker-compose.yml` has CACHING, CACHE_BACKEND, CACHE_HOST, CACHE_PORT
- [ ] Cognee service depends on redis
- [ ] `docker compose config` validates without errors (if Docker available)

### Step 12: Marker Files
Verify all Wave 3 agent markers exist:
- [ ] `.agent-done-W03-01` (schema)
- [ ] `.agent-done-W03-02` (CogneeClient)
- [ ] `.agent-done-W03-03` (sessions)
- [ ] `.agent-done-W03-04` (Docker)
- [ ] `.agent-done-W03-05` (prefix wiring)
- [ ] `.agent-done-W03-06` (DataPoint models)
- [ ] `.agent-done-W03-07` (Wave 16 compat)
- [ ] `.agent-done-W03-08` (API endpoints)
- [ ] `.agent-done-W03-09` (chat integration)

## Final Actions
1. Fix any compilation errors found
2. Create marker file: `.agent-done-W03-10`
3. Create wave completion marker: `.agent-done-wave3`
4. Report results summary to team lead

## Dependencies
- **ALL agents (1-9)** must complete before validation begins
