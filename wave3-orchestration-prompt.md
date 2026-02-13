# Wave 3 — Multi-User Cognee & Custom DataPoints — Orchestration Prompt

You are the **Team Lead** for Wave 3: Multi-User Cognee & Custom DataPoints. You coordinate 10 specialized agents to transform the single-admin Cognee setup into a multi-user, session-aware knowledge graph system with per-user dataset isolation and 8 custom DataPoint models.

## Architecture References
- **Master plan**: `docs/wave0-master-plan.md`
- **Implementation plan**: `docs/Agent planning chat.md` (Wave 3, lines ~750–820)
- **Cognee client**: `server/src/services/cognee_client.ts` (953 lines — single source of truth)
- **Cognee tools**: `server/src/services/claude/cognee-tools.ts` (671 lines — agent tool wrappers)
- **RAG wrapper**: `server/src/services/rag.ts` (USE_COGNEE gate + indexing)
- **Session service (Wave 17)**: `server/src/services/cognee-sessions.ts` (Redis cache/sessions/rate-limit)
- **Wave 16 DataPoints**: `server/src/services/cognee-datapoints.ts`, `cognee-ontologies.ts`, `cognee-feedback.ts`, `cognee-graph.ts`
- **Base class**: `server/src/services/claude/base-agent.ts` (ClaudeAgent<TInput, TOutput>)
- **Docker stack**: `docker-compose.yml` (5 services: postgres, redis, cognee, server, client)

## Current State (After Wave 2)
- 21 Claude agents operational (11 original + 10 from Waves 11-17)
- SQLite + PostgreSQL dual schema synchronized (88 SQLite tables, 57 PG tables)
- Agent mutation framework with propose/confirm/execute flow
- SSE streaming for real-time agent progress
- Single-admin Cognee: `admin@cognee-cba.dev` shared token for ALL users
- 27 Cognee datasets, no per-user isolation
- Wave 16 DataPoint CRUD (3 predefined types), ontologies, feedback already built
- Wave 17 `CogneeSessionService` with Redis cache/sessions/rate-limiting already built
- Docker: 5 services (postgres, redis, cognee, server, client)
- Migrations 0009–0014 applied

## Dependencies
- **Requires**: Wave 2 complete (agent mutation framework for session tracking)
- **Unlocks**: Wave 4 (Payroll), Wave 7 (Invoicing), Wave 10 (AP), Wave 16+ (Knowledge — already built, needs compatibility)
- **Estimated Complexity**: HIGH

## CRITICAL COMPATIBILITY: Wave 16 & Wave 17
Wave 16 (`cognee-datapoints.ts`, `cognee-ontologies.ts`, `cognee-feedback.ts`, `cognee-graph.ts`) and Wave 17 (`cognee-sessions.ts`, `temporal-cognify.ts`, `cross-module-intelligence.ts`) are **already built**. Wave 3 agents MUST:
1. **NOT replace** any Wave 16/17 services — only extend them
2. **ADD `userId` parameter** to CogneeClient methods without breaking existing callers (use optional parameter with fallback to admin)
3. **Extend `CogneeSessionService`** — don't create a duplicate session manager
4. **Preserve all 27 existing datasets** — only add prefix isolation on top
5. **Keep `datasetPrefix` pattern** already in `cognee-tools.ts` — just wire it to user context

## Database Schema Changes

### New Tables (2 tables)
| Table | Columns |
|-------|---------|
| `cognee_user_accounts` | id, userId (FK→users, UNIQUE), cogneeEmail, cogneeRefreshToken (AES-256-GCM encrypted refresh token — REVISION: NOT password per D02 CRIT-03), cogneeUserId, datasetPrefix, isActive, lastSyncAt, createdAt, updatedAt |
| `cognee_sessions` | id, userId (FK→users), sessionType ('chat'\|'analysis'\|'batch'), cogneeSessionId, state ('active'\|'paused'\|'expired'), contextData (JSON), createdAt, lastActivityAt, expiresAt |

**Migration**: `docker/migrations/0015_cognee_multi_user.sql`

## API Endpoints (4 endpoints)
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/cognee/init-user | Initialize Cognee account for a GoldLedger user (creates cognee_user_accounts record + optional Cognee-side user) |
| POST | /api/cognee/reindex | Re-index all datasets for a user with their dataset prefix |
| GET | /api/cognee/session | Get or create active Cognee session for current user |
| GET | /api/cognee/graph/:userId | Get user-scoped knowledge graph (delegates to Wave 16 CogneeGraphService with user filter) |

## UI Components
**None** — Wave 3 is a backend-only wave. All UI interactions happen through existing chat and knowledge UIs.

## New Claude Agents
**None** — Wave 3 enhances the Cognee infrastructure used by all existing agents.

## Security Requirements (REVISION — D02 CRIT-03, D03 B3, D01 DC-09)

### 1. No Password Storage (D02 CRIT-03)
The `cognee_user_accounts` table stores an **encrypted refresh token**, NOT a Cognee password. Passwords are used only transiently during initial account creation (`createCogneeUser()`), immediately exchanged for tokens, and discarded. The column is named `cogneeRefreshToken` (not `cogneePasswordHash`).

### 2. Short-Lived Access Tokens (D02 CRIT-03)
Cognee access tokens cached in `userTokenCache` MUST expire within 15 minutes. The `setupUserAuth()` method caps token lifetime at 900 seconds. Token refresh uses the stored encrypted refresh token, not re-authentication with a password.

### 3. Token Cache Bounds (D03 S5)
The `userTokenCache` is bounded at 1000 entries with LRU eviction. A sweep interval removes expired entries every 5 minutes. This prevents unbounded memory growth with many users.

### 4. Dataset Pooling (D03 B3)
Per-user dataset prefixing applies ONLY to private datasets. Shared reference datasets (`gst_rules`, `ato_rulings`, `award_rates`, etc.) are global and unprefixed. Some datasets (`merchant_data`) use row-level `user_id` metadata filtering instead of per-user copies. This reduces dataset proliferation from 35× per user to ~15× per user.

### 5. Gradual Auth Migration (D01 DC-09)
Cognee auth (`REQUIRE_AUTHENTICATION=true`) is NOT enabled in Wave 3. The migration is phased:
- **Phase 1 (Wave 3):** Add optional userId, keep auth disabled
- **Phase 2 (Post-Wave 3):** Enable auth after testing all existing callers
- **Phase 3 (Wave 4+):** Require userId, deprecate admin-token fallback

## Cognee Integration — Major Changes

### Docker Config Changes

> **REVISION NOTE (D01 DC-09 — Gradual Auth Migration):** Do NOT enable `REQUIRE_AUTHENTICATION=true` or `ENABLE_BACKEND_ACCESS_CONTROL=true` in Wave 3. This will break all existing Wave 11-17 callers. Instead, Wave 3 adds the optional userId parameter infrastructure. Auth is enabled AFTER verification that all callers work with the new userId parameter (Phase 2).

```yaml
# docker-compose.yml — Cognee service — CHANGES for Wave 3
# REVISION: Auth remains DISABLED in Wave 3 (D01 DC-09 gradual migration)
# Phase 1 (Wave 3): REQUIRE_AUTHENTICATION=false (add userId support)
# Phase 2 (Post-Wave 3): REQUIRE_AUTHENTICATION=true (enable after verification)
- REQUIRE_AUTHENTICATION=false          # REVISION: Keep false for Phase 1 (D01 DC-09)
- ENABLE_BACKEND_ACCESS_CONTROL=false   # REVISION: Keep false for Phase 1 (D01 DC-09)
- CACHING=true                          # NEW
- CACHE_BACKEND=redis                   # NEW
- CACHE_HOST=redis                      # NEW (service name)
- CACHE_PORT=6379                       # NEW
```

### Per-User Dataset Isolation (Prefix Strategy)
```typescript
// cognee-tools.ts already has prefixDataset() — just wire userId:
const tools = new CogneeTools({ datasetPrefix: `user_${userId}` });
// prefixDataset('bank_transactions') → 'user_123_bank_transactions'
```

### CogneeClient Modifications
1. Add `userId?: string` optional parameter to ALL public methods (search, add, cognify, etc.)
2. Add `userTokenCache: Map<string, { token: string; expiresAt: number }>` for per-user tokens — **REVISION: LRU-bounded at 1000 entries with 5-minute expired entry sweep (D03 S5)**
3. Add `createCogneeUser(email, password)` → returns `{ userId, refreshToken }` — **REVISION: Password used transiently, only refresh token stored (D02 CRIT-03)**
4. Add `getCogneeUserTokens(email, password)` → returns `{ accessToken, refreshToken, expiresIn }` — **REVISION: Short-lived tokens < 15 min (D02 CRIT-03)**
5. Add `refreshCogneeToken(refreshToken)` → refresh access token without password — **REVISION: New method per D02 CRIT-03**
6. Add `revokeUserToken(userId, refreshToken?)` → revoke on logout/session expiry — **REVISION: New method per D02 CRIT-03**
7. Modify `getAuthToken(userId?)` to check userTokenCache first, fall back to admin token with deprecation warning
8. Add `searchWithSession(query, dataset, sessionId, ...)` for conversational memory

### 8 Custom DataPoint Models
| DataPoint | Fields | Target Dataset |
|-----------|--------|----------------|
| `TransactionNode` | amount, merchant, category, date, gst_amount, account_id | bank_transactions |
| `AccountNode` | account_number, account_type, balance, bank_name | financial_insights |
| `CategoryNode` | name, parent, tax_deductible, gst_applicable | financial_insights |
| `GSTRuleNode` | rule_type, rate, description, ato_reference | gst_rules |
| `PatternNode` | pattern_type, frequency, amount_range, entities | transaction_patterns |
| `BASPeriodNode` | quarter, financial_year, gst_collected, gst_paid | financial_insights |
| `MerchantNode` | name, abn, category, avg_amount, frequency | merchant_data |
| `DeductionNode` | type, category, amount, tax_year, ato_ruling | deduction_patterns |

### Redis-Cognee Bridge Extensions
1. Add Cognee cache env vars to docker-compose.yml
2. Extend `CogneeSessionService` with user-scoped session data
3. Pass `session_id` to Cognee search calls for conversational memory
4. Cache with user-scoped keys: `cognee:cache:user_{userId}:{hash}`

## Testing Criteria
- [ ] Multi-user isolation: User A's search doesn't return User B's data
- [ ] Session memory: Follow-up questions within a session retain context
- [ ] DataPoint indexing: All 8 DataPoint models can be created and indexed
- [ ] Redis caching: Repeated queries hit cache (>50% speedup)
- [ ] Docker compose: `docker compose up -d` starts cleanly with new env vars
- [ ] Wave 16 compatibility: DataPoint CRUD, ontology, feedback, graph still work
- [ ] Wave 17 compatibility: Temporal search, cross-module intelligence still work
- [ ] Fallback to admin: When userId not provided, all methods use admin token (backward compat)
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `cd client && npx tsc --noEmit` passes clean

## Team Structure — 10 Agents

### Agent 1: cognee-multi-user-schema [PRIORITY: SUB-WAVE 1]
**Role**: Create cognee_user_accounts and cognee_sessions tables in dual schema + migration SQL
**Task file**: `wave3-agent-tasks/01-cognee-multi-user-schema.md`
**Creates**: docker/migrations/0015_cognee_multi_user.sql
**Modifies**: server/src/schema.ts, server/src/db/postgres-schema.ts
**Dependencies**: None — can start immediately

### Agent 2: cognee-client-multi-user [PRIORITY: SUB-WAVE 1]
**Role**: Add per-user auth token management and userId parameter to CogneeClient
**Task file**: `wave3-agent-tasks/02-cognee-client-multi-user.md`
**Modifies**: server/src/services/cognee_client.ts
**Dependencies**: None — can start immediately

### Agent 3: cognee-session-extension [PRIORITY: SUB-WAVE 1]
**Role**: Extend Wave 17 CogneeSessionService with user-scoped sessions and conversation memory
**Task file**: `wave3-agent-tasks/03-cognee-session-extension.md`
**Modifies**: server/src/services/cognee-sessions.ts
**Dependencies**: None — can start immediately

### Agent 4: docker-cognee-config [PRIORITY: SUB-WAVE 1]
**Role**: Update Docker config for multi-user Cognee with auth and Redis caching
**Task file**: `wave3-agent-tasks/04-docker-cognee-config.md`
**Modifies**: docker-compose.yml
**Dependencies**: None — can start immediately

### Agent 5: dataset-prefix-wiring [DEPENDS ON: Agent 2]
**Role**: Wire per-user dataset prefix into cognee-tools.ts and all agent consumers
**Task file**: `wave3-agent-tasks/05-dataset-prefix-wiring.md`
**Modifies**: server/src/services/claude/cognee-tools.ts, server/src/services/rag.ts
**Dependencies**: Agent 2 must complete CogneeClient changes

### Agent 6: datapoint-models-builder [DEPENDS ON: Agent 2]
**Role**: Define 8 custom DataPoint models and indexing pipeline
**Task file**: `wave3-agent-tasks/06-datapoint-models-builder.md`
**Creates**: server/src/services/cognee/datapoint-models.ts
**Modifies**: server/src/services/cognee-datapoints.ts
**Dependencies**: Agent 2 must complete CogneeClient changes

### Agent 7: wave16-compatibility [DEPENDS ON: Agents 2, 5]
**Role**: Ensure Wave 16 services (DataPoints, Ontologies, Feedback, Graph) work with multi-user
**Task file**: `wave3-agent-tasks/07-wave16-compatibility.md`
**Modifies**: server/src/services/cognee-datapoints.ts, cognee-ontologies.ts, cognee-feedback.ts, cognee-graph.ts
**Dependencies**: CogneeClient and prefix wiring must be ready

### Agent 8: api-cognee-endpoints [DEPENDS ON: Agents 1, 2, 3]
**Role**: Wire 4 new API routes in server/src/index.ts
**Task file**: `wave3-agent-tasks/08-api-cognee-endpoints.md`
**Modifies**: server/src/index.ts
**Dependencies**: Schema, CogneeClient, and session service must exist

### Agent 9: chat-session-integration [DEPENDS ON: Agents 3, 5]
**Role**: Integrate Cognee sessions into chat endpoint and agent orchestrator
**Task file**: `wave3-agent-tasks/09-chat-session-integration.md`
**Modifies**: server/src/services/claude/orchestrator.ts, server/src/index.ts (chat endpoint)
**Dependencies**: Session extension and prefix wiring must be ready

### Agent 10: testing-validation [DEPENDS ON: All]
**Role**: Run full verification plan, compatibility tests, and documentation
**Task file**: `wave3-agent-tasks/10-testing-validation.md`
**Dependencies**: All agents must complete

## Coordination Rules

1. **Schema lock**: Only Agent 1 modifies schema.ts and postgres-schema.ts
2. **cognee_client.ts lock**: Only Agent 2 modifies cognee_client.ts
3. **cognee-sessions.ts lock**: Only Agent 3 modifies cognee-sessions.ts
4. **docker-compose.yml lock**: Only Agent 4 modifies docker-compose.yml
5. **cognee-tools.ts lock**: Only Agent 5 modifies cognee-tools.ts
6. **index.ts lock**: Only Agent 8 modifies server/src/index.ts
7. **Backward compatibility**: All CogneeClient methods MUST keep working without userId (optional param with admin fallback)
8. **Wave 16/17 preservation**: DO NOT delete or rename any existing Wave 16/17 methods or services
9. **Dual schema**: Every table in BOTH schema.ts AND postgres-schema.ts
10. **Test before done**: `cd server && npx tsc --noEmit` must pass
11. **Marker naming**: Use `.agent-done-W03-{NN}` format
12. **Zod validation**: All new API endpoints MUST use Zod schemas for request body validation
13. **Rate limiting (REVISION NOTE: D01-DC-04 / D02-SEC-06)**: All new API endpoints MUST use the existing rate limiter middleware. Tiered limits: read endpoints 100 req/min, write endpoints 30 req/min, AI/streaming endpoints 20 req/min, sensitive endpoints (TFN/payment/STP) 10 req/min.
14. **Code splitting (REVISION NOTE: D03-S6)**: Wave 3 is backend-only. For future waves: all new UI feature components MUST be lazy-loaded via React.lazy() + Suspense.

## Execution Priority Order

```
Sub-wave 1 (Parallel): Agent 1 + Agent 2 + Agent 3 + Agent 4
Sub-wave 2 (After 1):  Agent 5 + Agent 6
Sub-wave 3 (After 2):  Agent 7 + Agent 8 + Agent 9
Sub-wave 4 (After 3):  Agent 10
```

## START THE TEAM NOW

Spawn all 10 teammates and begin coordinating their work according to the sub-wave execution order above. Read each agent's task file from `wave3-agent-tasks/` for detailed atomic tasks.
