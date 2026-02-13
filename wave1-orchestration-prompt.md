# Wave 1 — Chat→Agent Bridge & Intent Routing — Orchestration Prompt

You are the **Team Lead** for Wave 1: Chat→Agent Bridge & Intent Routing. You coordinate 10 specialized agents to add intent-based chat routing, PostgreSQL schema synchronization, and extended agent HTTP routes to GoldLedger.

## Architecture References
- **Master plan**: `docs/wave0-master-plan.md`
- **Implementation plan**: `docs/Agent planning chat.md` (Wave 1, lines 682–730)
- **Existing agents pattern**: `server/src/services/claude/agents/payroll-agent.ts`
- **Base class**: `server/src/services/claude/base-agent.ts` (ClaudeAgent<TInput, TOutput>)
- **Docker stack**: `docker-compose.yml` (5 services: postgres, redis, cognee, server, client)
- **Research**: `wave0b-research/R01-R10` (complete codebase analysis)

## Current State (Before Wave 1)
- 21 Claude agents registered in orchestrator (from Waves 11-17 partial execution)
- SQLite schema: 88 tables in `server/src/schema.ts`
- PostgreSQL schema: 57 tables in `server/src/db/postgres-schema.ts` (**31 tables missing from PG**)
- 254 existing API endpoints (197 inline in index.ts + 11 in route files)
- Cognee: 27+ datasets, single admin user (no per-user isolation)
- Chat endpoint (`POST /api/chat`): Simple query → AI response, no intent routing
- Orchestrator `analyze()` method: Hardcoded to `budget_analyzer` — no intent classification
- Only 4 of 21 agents have HTTP routes (in `routes/agents.ts`)
- 12 migrations applied (0009–0012 + 0023–0029)
- Tab-based SPA: 19 tabs in BottomNavigation

## Dependencies
- **Requires**: Nothing — this is the **foundational** wave
- **Blocks**: Wave 2 (mutations require intent routing), all subsequent waves
- **Estimated Complexity**: HIGH

## Database Schema Changes

### PostgreSQL Sync (33 tables + column additions)
**Migration**: `docker/migrations/0013_postgres_schema_sync.sql`

This is the **largest migration** — syncs 33 SQLite tables missing from PostgreSQL, plus adds missing columns to 2 existing PG tables. Uses `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for idempotency.

#### Tables to CREATE in PostgreSQL (33):
1. `business_profiles` — Business identity (ABN, entity type, BAS frequency)
2. `bas_periods` — BAS reporting periods
3. `bas_calculations` — Computed BAS label values (G1-G11, 1A-1B, W1-W2, etc.)
4. `tax_codes` — Tax code definitions
5. `tax_brackets` — Income tax bracket tables
6. `deductions` — Tax deduction claims
7. `cgt_assets` — Capital gains tax assets
8. `cgt_events` — CGT disposal events
9. `depreciable_assets` — Div 40 depreciable assets
10. `depreciation_schedule` — Annual depreciation calculations
11. `tax_year_summary` — Annual tax position summary
12. `audit_log` — System audit trail
13. `sessions` — JWT refresh token sessions
14. `teams` — Multi-user team definitions
15. `team_members` — Team membership
16. `team_invitations` — Team invitation tokens
17. `subscriptions` — Stripe subscription records
18. `export_history` — Data export log
19. `parser_metrics` — Statement parser performance metrics
20. `parser_accuracy_aggregates` — Aggregated parser accuracy stats
21. `parser_feedback` — User corrections to parser output
22. `chart_of_accounts` — General ledger account definitions
23. `journal_entries` — Double-entry journal headers
24. `journal_entry_lines` — Journal entry debit/credit lines
25. `accounting_periods` — Fiscal period definitions
26. `account_balances` — Period-end account balances
27. `rag_namespaces` — RAG vector store namespace config
28. `rag_chunks` — Indexed text chunks with embeddings
29. `rag_documents` — Source documents for RAG
30. `rag_citations` — Query→chunk relevance citations
31. `tax_offsets` — Tax offset claims (LITO, LMITO, etc.)
32. `capital_losses` — Capital loss carry-forward ledger
33. `upload_queue` — Statement upload processing queue

#### Column additions to EXISTING PG tables:
- `accounts`: Add `ownership_tag TEXT`
- `transactions`: Add `gst_amount REAL`, `gst_category TEXT`, `transaction_hash TEXT`, `parser_version TEXT`, `extraction_hash TEXT`, `is_owner_contribution BOOLEAN DEFAULT false`

#### Indexes (per R04 recommendations):
- `business_profiles(user_id)` UNIQUE
- `bas_periods(user_id, financial_year, quarter)` UNIQUE
- `bas_calculations(bas_period_id)`, `(period_id)`
- `deductions(user_id, tax_year)`
- `cgt_assets(user_id, status)`
- `cgt_events(user_id, tax_year)`, `(asset_id)`
- `tax_year_summary(user_id, tax_year)` UNIQUE
- `audit_log(user_id)`, `(timestamp)`, `(entity_type, entity_id)`
- `sessions(user_id)`, `(expires_at)`
- `chart_of_accounts(user_id, code)` UNIQUE
- `journal_entries(user_id, entry_date)`, `(transaction_id)`
- `journal_entry_lines(entry_id)`, `(account_id)`
- `rag_chunks(namespace_id)`, `(content_hash)` per namespace
- `upload_queue(user_id, state)`, `(batch_id)`

## API Endpoints (9 endpoints)

| # | Method | Path | Description | Handler |
|---|--------|------|-------------|---------|
| 1 | POST | `/api/chat` | **REWRITE** — Intent-routed agent dispatch replaces hardcoded logic | `index.ts` (line 950 rewrite) |
| 2 | POST | `/api/agents/parse` | Statement parser agent route | `routes/agent-routes-extended.ts` |
| 3 | POST | `/api/agents/categorize` | Transaction categorizer agent route | `routes/agent-routes-extended.ts` |
| 4 | POST | `/api/agents/merchant-intel` | Merchant intelligence agent route | `routes/agent-routes-extended.ts` |
| 5 | POST | `/api/agents/payroll/calculate` | Payroll agent route | `routes/agent-routes-extended.ts` |
| 6 | POST | `/api/agents/tax/strategy` | Tax strategy agent route | `routes/agent-routes-extended.ts` |
| 7 | POST | `/api/agents/tax/claims` | Personal tax claims agent route | `routes/agent-routes-extended.ts` |
| 8 | POST | `/api/agents/financial-plan` | Financial planner agent route | `routes/agent-routes-extended.ts` |
| 9 | GET | `/api/agents/status` | All agent health/status dashboard | `routes/agent-routes-extended.ts` |

**CRITICAL**: New agent routes (2-8) MUST be registered BEFORE the existing wildcard `POST /api/agents/:type/run` (line 1913 in index.ts) to avoid pattern overlap. Use a separate route file mounted via `app.route()` before the generic routes.

## UI Components
### Modified Components (3):
- `FloatingChat.tsx` — Enhanced with structured response handling, agent progress indicator, suggested follow-up actions. Message type expansion from `{role, content}` to `{role, content, type, agentType, data}`
- `ChatInterface.tsx` — Support for rich message rendering (AgentResponseCard), streaming-ready architecture, action confirmations
- `api.ts` — Update `sendChatMessage()` return type: `{ answer: string, agentType?: string, intentClassification?: { intent: string, confidence: number }, actions?: Action[], suggestedFollowups?: string[] }`

### New Components (3):
- `AgentResponseCard.tsx` — `features/chat/components/` — Rich card for structured agent responses (tables, action cards, confirmations). Replaces plain text assistant messages.
- `IntentDebugPanel.tsx` — `features/chat/components/` — Developer/debug panel showing intent classification results, agent routing, confidence scores. Toggled via dev mode setting.
- `AgentRoutingIndicator.tsx` — `features/chat/components/` — Visual indicator showing which agent is processing (icon + name + progress spinner).

## New Services (3 files to CREATE)

### 1. `server/src/services/claude/intent-router.ts`
**Purpose**: Classify user queries into intent categories, select the appropriate agent(s)

**Key interface**:
```typescript
export interface IntentClassification {
  intent: 'agent_invocation' | 'direct_question' | 'transaction_edit' | 'batch_operation' | 'multi_agent';
  primaryAgent: AgentType;
  secondaryAgents: AgentType[];
  confidence: number;
  reasoning: string;
  extractedParams: Record<string, unknown>;
}
```

Uses **Haiku** for fast, cheap classification. System prompt lists all 21+ agents with capabilities. Returns structured JSON.

### 2. `server/src/services/claude/agent-dispatcher.ts`
**Purpose**: Execute agent pipeline based on IntentClassification result

- Single agent dispatch: `orchestrator.invoke(primaryAgent, params)`
- Multi-agent pipeline: Sequential execution with result chaining
- Error handling: Circuit breaker + fallback to direct DB query
- SSE event emission for progress updates

### 3. `server/src/services/claude/response-formatter.ts`
**Purpose**: Transform raw agent output into structured chat responses

- Format tables, lists, monetary values
- Generate follow-up action suggestions
- Handle error formatting (must return `{ answer: string }` for client compatibility)

## Cognee Integration
- **No new datasets** — Wave 1 enhances existing search with agent-specific context
- Enhance `ragService.searchMulti()` to use intent-aware dataset selection
- Agent mapping to preferred Cognee search types:
  - `gst_calculator` → CHUNKS + RAG_COMPLETION (GST rulings)
  - `merchant_intelligence` → CHUNKS_LEXICAL (merchant name matching)
  - `tax_strategy` → GRAPH_COMPLETION (multi-step tax reasoning)
  - `budget_analyzer` → CHUNKS (spending pattern matching)
  - `financial_reporting` → CHUNKS (historical data retrieval)

## Testing Criteria
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `cd client && npx tsc --noEmit` passes clean
- [ ] `curl` test: POST `/api/chat` with "How much did I spend on fuel?" routes to `budget_analyzer`
- [ ] `curl` test: POST `/api/chat` with "Calculate BAS for Q2" routes to `gst_calculator`
- [ ] `curl` test: POST `/api/agents/categorize` invokes `transaction_categorizer`
- [ ] All 21 existing agents remain accessible via `orchestrator.invoke()`
- [ ] GET `/api/agents/status` returns health for all registered agents
- [ ] Migration 0013 creates 33 tables + adds 7 columns when applied to PostgreSQL
- [ ] PostgreSQL table count ≥ 88 after migration (matching SQLite)
- [ ] postgres-schema.ts has pgTable definitions for all 33 new tables

## Team Structure — 10 Agents

### Agent 1: postgres-schema-sync [PRIORITY: SUB-WAVE 1]
**Role**: Create PostgreSQL migration 0013 syncing all 33 missing tables + column gaps
**Task file**: `wave1-agent-tasks/01-postgres-schema-sync.md`
**Creates**: `docker/migrations/0013_postgres_schema_sync.sql`
**Modifies**: `server/src/db/postgres-schema.ts`
**Dependencies**: None — can start immediately

### Agent 2: intent-router-builder [PRIORITY: SUB-WAVE 1]
**Role**: Build the IntentRouter service with Haiku-based classification
**Task file**: `wave1-agent-tasks/02-intent-router-builder.md`
**Creates**: `server/src/services/claude/intent-router.ts`
**Dependencies**: None — can start immediately

### Agent 3: agent-dispatcher-builder [PRIORITY: SUB-WAVE 1]
**Role**: Build the AgentDispatcher for executing classified intents
**Task file**: `wave1-agent-tasks/03-agent-dispatcher-builder.md`
**Creates**: `server/src/services/claude/agent-dispatcher.ts`
**Dependencies**: None — can start immediately

### Agent 4: response-formatter-builder [PRIORITY: SUB-WAVE 1]
**Role**: Build the ResponseFormatter for structured chat responses
**Task file**: `wave1-agent-tasks/04-response-formatter-builder.md`
**Creates**: `server/src/services/claude/response-formatter.ts`
**Dependencies**: None — can start immediately

### Agent 5: chat-endpoint-rewriter [DEPENDS ON: Agents 2, 3, 4]
**Role**: Rewrite POST `/api/chat` to use IntentRouter + AgentDispatcher pipeline
**Task file**: `wave1-agent-tasks/05-chat-endpoint-rewriter.md`
**Modifies**: `server/src/index.ts` (chat route at line ~950)
**Dependencies**: IntentRouter, AgentDispatcher, ResponseFormatter must exist

### Agent 6: agent-http-routes-builder [DEPENDS ON: Agent 3]
**Role**: Create extended agent HTTP routes (7 new POST + 1 GET status)
**Task file**: `wave1-agent-tasks/06-agent-http-routes-builder.md`
**Creates**: `server/src/routes/agent-routes-extended.ts`
**Modifies**: `server/src/index.ts` (mount routes BEFORE wildcard)
**Dependencies**: AgentDispatcher must exist

### Agent 7: orchestrator-updater [DEPENDS ON: Agent 2]
**Role**: Update AgentOrchestrator to replace stub `analyze()` with `routeAndDispatch()`
**Task file**: `wave1-agent-tasks/07-orchestrator-updater.md`
**Modifies**: `server/src/services/claude/orchestrator.ts`
**Dependencies**: IntentRouter must exist

### Agent 8: ui-chat-enhancer [DEPENDS ON: Agent 5]
**Role**: Enhance FloatingChat and ChatInterface for structured agent responses
**Task file**: `wave1-agent-tasks/08-ui-chat-enhancer.md`
**Creates**: `client/src/features/chat/components/AgentResponseCard.tsx`, `IntentDebugPanel.tsx`, `AgentRoutingIndicator.tsx`
**Modifies**: `client/src/features/chat/FloatingChat.tsx`, `client/src/features/chat/ChatInterface.tsx`, `client/src/api.ts`
**Dependencies**: Chat endpoint must be rewritten first

### Agent 9: cognee-agent-context [DEPENDS ON: Agent 2]
**Role**: Enhance Cognee search to use intent-aware dataset selection per agent type
**Task file**: `wave1-agent-tasks/09-cognee-agent-context.md`
**Modifies**: `server/src/services/claude/cognee-tools.ts`, `server/src/services/cognee_client.ts`
**Dependencies**: IntentRouter must exist (needs agent type mapping)

### Agent 10: testing-validation [DEPENDS ON: All]
**Role**: Run full verification: tsc checks, curl tests, migration validation
**Task file**: `wave1-agent-tasks/10-testing-validation.md`
**Dependencies**: All agents must complete

## Security Requirements (REVISION NOTE: Added per D02-CRIT-01 — Authentication)

### Basic Auth Middleware (JWT-based)
Wave 1 MUST implement basic authentication middleware on ALL `/api/*` routes. The existing `sessions` table (synced by migration 0013) already has `user_id`, `refresh_token_hash`, and `expires_at` columns — wire these for JWT auth.

**Implementation (Agent 5 responsibility)**:
1. Create `server/src/middleware/auth.ts` with `authMiddleware()` Hono middleware
2. Extract JWT from `Authorization: Bearer <token>` header
3. Validate token, extract `userId`, attach to request context (`c.set('userId', userId)`)
4. Apply to ALL `/api/*` routes via `app.use('/api/*', authMiddleware())`
5. Allow bypass for health check endpoints (`/api/health`, `/api/agents/status`)
6. Use `jsonwebtoken` package (already in server dependencies) with `JWT_SECRET` env var
7. If `JWT_SECRET` is not set, operate in development mode (no auth required) with a console warning

### CSRF Protection (REVISION NOTE: Added per D02-SEC-03)
All POST/PUT/DELETE mutation endpoints MUST validate `Origin` and `Referer` headers against allowed origins. Set `SameSite=Strict` on session cookies.

## Coordination Rules

1. **Schema lock**: Only Agent 1 modifies `postgres-schema.ts` — no other agent touches it
2. **index.ts lock**: Only Agents 5 and 6 modify `server/src/index.ts` — Agent 6 first (mount routes), then Agent 5 (rewrite chat handler)
3. **types.ts caution**: If any agent needs to modify `types.ts`, append new types ONLY — never remove or rename existing types (BC-01)
4. **Cognee client caution**: Agent 9 adds methods to existing `CogneeClient` class — never create a parallel client (BC-06)
5. **Route registration order**: Agent 6's extended routes MUST be mounted BEFORE the existing `POST /api/agents/:type/run` wildcard
6. **Dual schema**: Agent 1 adds pgTable definitions only — SQLite tables already exist for all 33 tables
7. **Test before done**: `cd server && npx tsc --noEmit` must pass before marking any agent done
8. **Marker naming**: Use `.agent-done-W01-{NN}` format (e.g., `.agent-done-W01-01`) — REVISION NOTE: Zero-padded per D04-MARKER-01 / D05-L-02
9. **Zod validation**: All new API endpoints MUST use Zod schemas for request body validation via `zValidator` middleware
10. **Pagination standard**: All list endpoints MUST support `?offset=0&limit=50` pagination pattern, returning `{ data: T[], total: number }`
11. **Error format**: `/api/chat` must return `{ answer: string }` even on error — NOT `{ error: string }`
12. **Backward compatibility**: All 21 existing agents must remain functional. Do not remove agent types, schema tables, or existing routes (BC-01 through BC-10)
13. **Error handling pattern (REVISION NOTE: Added per D01-DC-05)**: All new endpoints MUST use try/catch with consistent JSON error response format `{ error: string, code: number }`. Create `server/src/errors.ts` with typed error classes (`NotFoundError`, `ValidationError`, `AuthorizationError`) and wire Hono's `app.onError()` global handler.
14. **Route extraction (REVISION NOTE: Added per D01-CRIT-04)**: Agent 6 MUST create a separate route file (`server/src/routes/agent-routes-extended.ts`) for all new agent endpoints. Do NOT add routes inline to `index.ts`. Mount via `app.route('/api', agentRoutesExtended)` in index.ts.
15. **Migration idempotency (REVISION NOTE: Added per D01-CRIT-02 / D04-DEP-01)**: Migration 0013 MUST use `CREATE TABLE IF NOT EXISTS` for ALL tables and `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for column additions. Migrations 0023-0029 (from Waves 11-17) already exist on disk and may reference tables from this migration. Migration 0013 must be idempotent so it can be applied safely regardless of whether later migrations have already run.
16. **Dynamic IntentRouter agent list (REVISION NOTE: D01-CRIT-05)**: IntentRouter's system prompt MUST be dynamically generated from the Orchestrator's agent registry — NOT hardcoded. Add `getRegisteredAgents()` method to Orchestrator that returns agent metadata (name, description, capabilities). IntentRouter.classify() calls this on each invocation to get the current agent list. This ensures Waves 7 (invoice_agent) and 10 (accounts_payable_agent) are automatically routable without modifying IntentRouter.
17. **Intent classification optimization (REVISION NOTE: D03-B2)**: IntentRouter MUST implement: (a) keyword pre-filter — high-confidence pattern matches bypass Haiku entirely (e.g., "BAS" → gst_calculator, "payslip" → payroll_agent, "invoice" → invoice_agent), (b) Redis cache — hash normalized query and cache IntentClassification result with 60-second TTL, (c) classification timeout — 2-second max for Haiku call, fallback to keyword routing if exceeded, (d) parallel multi-agent dispatch — for `multi_agent` intents where agents don't depend on each other's output, use Promise.all() not sequential execution.
18. **Rate limiting (REVISION NOTE: D01-DC-04 / D02-SEC-06)**: All new API endpoints MUST use the existing rate limiter middleware. Tiered limits: read endpoints 100 req/min, write endpoints 30 req/min, AI/streaming endpoints 20 req/min.
19. **Code splitting (REVISION NOTE: D03-S6)**: All new UI feature components MUST be lazy-loaded via `React.lazy()` + `Suspense`. Each feature folder is a separate chunk. List components with 100+ potential rows MUST use `@tanstack/react-virtual`.

## Execution Priority Order

```
Sub-wave 1 (Parallel): Agent 1 + Agent 2 + Agent 3 + Agent 4
Sub-wave 2 (After 1):  Agent 5 + Agent 6 + Agent 7 + Agent 9
Sub-wave 3 (After 2):  Agent 8
Sub-wave 4 (After 3):  Agent 10
```

## START THE TEAM NOW

Spawn all 10 teammates and begin coordinating their work according to the sub-wave execution order above. Read each agent's task file from `wave1-agent-tasks/` for detailed atomic tasks with file paths and specs. Reference `docs/wave0-master-plan.md` for overall context.

## Debate Findings Applied

| Finding ID | Severity | Summary | Resolution | Rule # |
|-----------|----------|---------|------------|--------|
| D02-CRIT-01 | Critical | No authentication on API routes | JWT auth middleware added to Agent 5 scope | §Security Requirements |
| D01-CRIT-02 | Critical | Migration ordering conflicts with Waves 11-17 | Idempotent DDL (`IF NOT EXISTS`) required | Rule 15 |
| D01-CRIT-04 | Critical | Routes added inline to 2000-line index.ts | Separate route file mandate for Agent 6 | Rule 14 |
| D01-CRIT-05 | Critical | IntentRouter hardcodes 21-agent list; Waves 7/10 add new agents | Dynamic agent list from Orchestrator registry | Rule 16 |
| D01-DC-04 | High | No rate limiting on new endpoints | Tiered rate limiter middleware required | Rule 18 |
| D01-DC-05 | High | Inconsistent error handling across endpoints | Typed error classes + global Hono error handler | Rule 13 |
| D02-SEC-03 | High | No CSRF protection on mutation endpoints | Origin/Referer validation + SameSite cookies | §CSRF Protection |
| D02-SEC-06 | High | Rate limiting gaps on AI/streaming endpoints | Tiered limits (read 100, write 30, AI 20 req/min) | Rule 18 |
| D03-B2 | Medium | Intent classification latency (no caching/fallback) | Keyword pre-filter, Redis cache, timeout fallback | Rule 17 |
| D03-S6 | Medium | No code splitting for new UI feature modules | React.lazy + Suspense + TanStack Virtual required | Rule 19 |
| D04-MARKER-01 | Low | Inconsistent marker file naming | Zero-padded `.agent-done-W01-{NN}` format | Rule 8 |
| D04-DEP-01 | Low | Migration dependency on out-of-order waves | Idempotent DDL covers all orderings | Rule 15 |
| D05-L-02 | Low | Marker naming inconsistency across waves | Standardized zero-pad format | Rule 8 |
