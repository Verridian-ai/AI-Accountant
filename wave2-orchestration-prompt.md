# Wave 2 — Transaction Mutation & Streaming — Orchestration Prompt

You are the **Team Lead** for Wave 2: Transaction Mutation & Streaming. You coordinate 10 specialized agents to build the agent mutation framework, SSE streaming pipeline, confirmation/rejection flows, and audit trail for GoldLedger.

## Architecture References
- **Master plan**: `docs/wave0-master-plan.md`
- **Implementation plan**: `docs/Agent planning chat.md` (Wave 2, lines 731–810)
- **Existing agents pattern**: `server/src/services/claude/agents/payroll-agent.ts`
- **Base class**: `server/src/services/claude/base-agent.ts` (ClaudeAgent<TInput, TOutput>)
- **Docker stack**: `docker-compose.yml` (5 services: postgres, redis, cognee, server, client)
- **Research**: `wave0b-research/R01-R10` (complete codebase analysis)
- **Wave 1 plan**: `wave1-orchestration-prompt.md` (Wave 2 depends on Wave 1 deliverables)

## Current State (After Wave 1)
- 21 Claude agents registered in orchestrator (unchanged from Wave 1)
- **NEW**: IntentRouter service classifies user queries into 5 intent categories
- **NEW**: AgentDispatcher executes single/multi-agent pipelines from classification
- **NEW**: ResponseFormatter produces structured `ChatResponse` (answer + agentType + actions + followups)
- **NEW**: Orchestrator has `routeAndDispatch()` replacing stub `analyze()`
- **NEW**: `POST /api/chat` uses full intent→dispatch→format pipeline
- **NEW**: 8 extended agent routes (`/api/agents/parse`, `/api/agents/categorize`, etc.)
- **NEW**: AgentResponseCard, IntentDebugPanel, AgentRoutingIndicator UI components
- **NEW**: `searchForAgent()` on CogneeTools — agent-type-specific dataset selection
- PostgreSQL schema: 90 tables (57 existing + 33 synced by Wave 1's migration 0013)
- SQLite schema: 88 tables in `server/src/schema.ts` (unchanged)
- 262 API endpoints (254 existing + 8 new from Wave 1)
- SSE: Node.js EventEmitter in-process (`events.ts`) — NO Redis pub/sub, NO streaming responses
- Nginx: `/api/events` proxied with buffering off, 86400s read timeout
- Redis: Available but only used by `cognee-sessions.ts` — NOT used for pub/sub or job queues
- 13 migrations applied (0009–0013)
- Tab-based SPA: 19 tabs in BottomNavigation (unchanged)

## Dependencies
- **Requires**: Wave 1 complete (IntentRouter, AgentDispatcher, ResponseFormatter, enhanced chat endpoint)
- **Blocks**: Wave 3 (Cognee isolation builds on mutation audit patterns), all subsequent waves
- **Estimated Complexity**: HIGH

## Database Schema Changes

### New Tables (3)
**Migration**: `docker/migrations/0014_agent_mutations.sql`

#### 1. `agent_mutations`
Tracks every agent-proposed database mutation through its lifecycle: proposed → pending_confirmation → confirmed → executed (or rejected/expired).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `TEXT` | PRIMARY KEY | UUID |
| `session_id` | `TEXT` | NOT NULL, FK → agent_sessions.id | Agent session that created this |
| `agent_type` | `TEXT` | NOT NULL | AgentType that proposed the mutation |
| `mutation_type` | `TEXT` | NOT NULL | `create`, `update`, `delete`, `batch_update` |
| `target_table` | `TEXT` | NOT NULL | Table being mutated (e.g., `transactions`) |
| `target_id` | `TEXT` | NULL | Row ID for single-record mutations |
| `target_ids` | `TEXT` | NULL | JSON array of IDs for batch mutations |
| `before_state` | `TEXT` | NULL | JSON snapshot of record(s) before mutation |
| `after_state` | `TEXT` | NOT NULL | JSON of proposed new state |
| `description` | `TEXT` | NOT NULL | Human-readable description of the change |
| `status` | `TEXT` | NOT NULL DEFAULT 'proposed' | `proposed`, `pending_confirmation`, `confirmed`, `executing`, `executed`, `rejected`, `expired`, `failed` |
| `confidence` | `REAL` | NULL | Agent's confidence in the mutation (0.0–1.0) |
| `requires_confirmation` | `BOOLEAN` | NOT NULL DEFAULT true | Whether user must confirm before execution |
| `confirmed_at` | `TIMESTAMP WITH TIME ZONE` | NULL | When user confirmed |
| `executed_at` | `TIMESTAMP WITH TIME ZONE` | NULL | When mutation was applied |
| `rejected_at` | `TIMESTAMP WITH TIME ZONE` | NULL | When user rejected |
| `rejection_reason` | `TEXT` | NULL | User's reason for rejection |
| `error_message` | `TEXT` | NULL | Error if execution failed |
| `expires_at` | `TIMESTAMP WITH TIME ZONE` | NULL | Auto-expire unconfirmed mutations |
| `created_at` | `TIMESTAMP WITH TIME ZONE` | NOT NULL DEFAULT NOW() | |
| `updated_at` | `TIMESTAMP WITH TIME ZONE` | NOT NULL DEFAULT NOW() | |

**Indexes**: `session_id`, `status`, `agent_type`, `target_table`, `created_at`, composite `(status, expires_at)`

#### 2. `agent_sessions`
Groups related agent interactions into a conversational session with context.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `TEXT` | PRIMARY KEY | UUID |
| `user_id` | `TEXT` | NOT NULL | Authenticated user — REVISION (D02-CRIT-02): Changed from NULL to NOT NULL. Every session must be bound to a user. |
| `started_at` | `TIMESTAMP WITH TIME ZONE` | NOT NULL DEFAULT NOW() | |
| `last_activity_at` | `TIMESTAMP WITH TIME ZONE` | NOT NULL DEFAULT NOW() | |
| `status` | `TEXT` | NOT NULL DEFAULT 'active' | `active`, `completed`, `expired` |
| `context` | `TEXT` | NULL | JSON context accumulated during session |
| `total_mutations` | `INTEGER` | NOT NULL DEFAULT 0 | Count of mutations in this session |
| `confirmed_mutations` | `INTEGER` | NOT NULL DEFAULT 0 | Count confirmed |
| `rejected_mutations` | `INTEGER` | NOT NULL DEFAULT 0 | Count rejected |
| `query_count` | `INTEGER` | NOT NULL DEFAULT 0 | Total queries in session |
| `agent_types_used` | `TEXT` | NULL | JSON array of agent types invoked |
| `created_at` | `TIMESTAMP WITH TIME ZONE` | NOT NULL DEFAULT NOW() | |

**Indexes**: `user_id`, `status`, `last_activity_at`

#### 3. `agent_audit_log`
Immutable audit trail of all agent actions and state changes.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `TEXT` | PRIMARY KEY | UUID |
| `mutation_id` | `TEXT` | NULL, FK → agent_mutations.id | Related mutation (if any) |
| `session_id` | `TEXT` | NULL, FK → agent_sessions.id | Session context |
| `agent_type` | `TEXT` | NOT NULL | Agent that performed the action |
| `action` | `TEXT` | NOT NULL | `mutation_proposed`, `mutation_confirmed`, `mutation_rejected`, `mutation_executed`, `mutation_failed`, `mutation_expired`, `query_executed`, `tool_called`, `error_occurred` |
| `target_table` | `TEXT` | NULL | Affected table |
| `target_id` | `TEXT` | NULL | Affected record ID |
| `before_state` | `TEXT` | NULL | JSON snapshot before |
| `after_state` | `TEXT` | NULL | JSON snapshot after |
| `metadata` | `TEXT` | NULL | JSON additional context (tool name, error details, etc.) |
| `user_id` | `TEXT` | NULL | User who triggered or confirmed |
| `ip_address` | `TEXT` | NULL | Client IP for audit |
| `created_at` | `TIMESTAMP WITH TIME ZONE` | NOT NULL DEFAULT NOW() | Immutable timestamp |

**Indexes**: `mutation_id`, `session_id`, `agent_type`, `action`, `created_at`, `target_table`

### Dual Schema Additions
Each of the 3 new tables must be defined in **both**:
- `server/src/schema.ts` — using `sqliteTable()` (with `integer({ mode: 'boolean' })` for booleans, `integer` for timestamps)
- `server/src/db/postgres-schema.ts` — using `pgTable()` (with `boolean()`, `timestamp({ withTimezone: true })`, `real()`)

## API Endpoints (6 new)

| # | Method | Path | Purpose | Request | Response |
|---|--------|------|---------|---------|----------|
| 1 | POST | `/api/chat/stream` | SSE streaming chat (intent → agent → progressive response) | `{ query: string, sessionId?: string }` | SSE stream: `event: token`, `event: tool_start`, `event: tool_end`, `event: mutation_proposed`, `event: complete` |
| 2 | POST | `/api/chat/confirm/:actionId` | Confirm a pending mutation | `{ reason?: string }` | `{ success: boolean, mutation: AgentMutation }` |
| 3 | POST | `/api/chat/reject/:actionId` | Reject a pending mutation | `{ reason?: string }` | `{ success: boolean, mutation: AgentMutation }` |
| 4 | GET | `/api/chat/pending` | List pending mutations for current session | Query: `?sessionId=...` | `{ mutations: AgentMutation[] }` |
| 5 | GET | `/api/chat/history` | Get chat session history | Query: `?sessionId=...&limit=50` | `{ sessions: AgentSession[], total: number }` |
| 6 | GET | `/api/agent-audit` | Query audit trail | Query: `?agentType=...&action=...&from=...&to=...&limit=50` | `{ entries: AuditEntry[], total: number }` |

**Route namespace**: `/api/chat/*` for mutation flows, `/api/agent-audit` for audit. These are safe namespaces per R03 analysis.

## UI Components (4 new + 2 modified)

### New Components
| Component | File Path | Description |
|-----------|-----------|-------------|
| `StreamingMessage` | `client/src/features/chat/components/StreamingMessage.tsx` | Progressive text rendering with typing animation for SSE-streamed responses |
| `ConfirmationCard` | `client/src/features/chat/components/ConfirmationCard.tsx` | Before/after diff preview for agent-proposed mutations with Approve/Reject buttons |
| `AgentProgressBar` | `client/src/features/chat/components/AgentProgressBar.tsx` | Real-time progress: tool calls completed, current step, spinner |
| `AuditTrailViewer` | `client/src/features/transactions/components/AuditTrailViewer.tsx` | Agent audit log viewer with filtering by agent, action, date range |

### Modified Components
| Component | Changes |
|-----------|---------|
| `FloatingChat.tsx` | Streaming message display, confirmation dialog integration, session ID management |
| `api.ts` | Add `streamChat()`, `confirmMutation()`, `rejectMutation()`, `fetchPendingMutations()`, `fetchAuditLog()` |

## New Service Files (5)

### 1. `server/src/services/claude/mutation-tools.ts`
- `MutationTools` class — provides standardized methods for agents to propose DB mutations
- `proposeMutation()` — creates a mutation record and SSE-broadcasts `mutation_proposed` event
- `executeMutation()` — applies confirmed mutations to the database with before/after snapshots
- `batchProposeMutations()` — batch version for bulk categorization/updates

### 2. `server/src/services/claude/mutation-auth.ts`
- `MutationAuthService` class — authorization layer for mutations
- `canPropose(agentType, targetTable)` — checks if agent is allowed to mutate this table
- `canAutoExecute(agentType, mutationType, confidence)` — determines if mutation skips confirmation
- Permission matrix: Haiku agents need confirmation for all writes; Sonnet agents with confidence > 0.9 can auto-execute categorization updates

### 3. `server/src/services/claude/confirmation-flow.ts`
- `ConfirmationFlowService` class — manages the propose→confirm→execute lifecycle
- `proposeAndBroadcast()` — propose + SSE notification + timeout scheduling
- `confirm(mutationId, userId)` — validate + execute + audit log
- `reject(mutationId, userId, reason)` — mark rejected + audit log
- `expireStale()` — cron-like expiration of unconfirmed mutations (15 min TTL default)

### 4. `server/src/services/claude/streaming.ts`
- `StreamingService` class — SSE streaming for chat responses
- `createStream(res)` — sets up SSE response headers and returns a writer
- `streamToken(writer, token)` — sends progressive text tokens
- `streamToolEvent(writer, event)` — sends tool_start/tool_end events
- `streamMutationProposal(writer, mutation)` — sends mutation proposals
- `streamComplete(writer, response)` — sends final complete event with full ChatResponse
- Uses Node.js `EventEmitter` (reuses existing `events.ts` pattern — NOT Redis pub/sub yet)

### 5. `server/src/services/claude/audit.ts`
- `AuditService` class — immutable audit trail management
- `logMutationProposed()`, `logMutationConfirmed()`, `logMutationRejected()`, `logMutationExecuted()`, `logMutationFailed()`
- `logQueryExecuted()`, `logToolCalled()`, `logError()`
- `queryAudit(filters)` — paginated query with date range, agent type, action filters

## Agent Integration (Modified Agents)

### `base-agent.ts` Modifications
- Add optional `mutationTools?: MutationTools` property to ClaudeAgent
- Add `setMutationTools(tools: MutationTools)` method
- In the agentic loop, if a tool handler returns a `MutationProposal`, call `mutationTools.proposeMutation()`
- This is **backward-compatible**: agents that don't use mutations are unaffected

### `transaction-categorizer.ts` Modifications
- Import MutationTools
- When categorizing transactions, use `proposeMutation()` instead of direct DB writes
- Each categorization becomes a confirmable mutation (or auto-executes if confidence > 0.9)
- Batch categorization uses `batchProposeMutations()`

### `gst-calculator.ts` Modifications
- When setting GST categories on transactions, use `proposeMutation()`
- GST mutations always require confirmation (financial compliance)

### `orchestrator.ts` Modifications
- In `invoke()`, inject `MutationTools` instance into each agent before execution
- In `routeAndDispatch()`, create/reuse `AgentSession` for session context
- Add `getSessionMutations(sessionId)` method

## Cognee Integration
- Index confirmed mutations into `transaction_patterns` dataset (existing dataset — new data source)
- Store agent decision reasoning (intent classification + agent response) as Cognee content for future learning
- **No new Cognee datasets required** — reuses existing datasets
- Use `CogneeTools.indexAndCognify()` after successful mutation execution

## Testing Criteria
1. Mutation propose → confirm → execute flow works end-to-end
2. SSE streaming delivers progressive tokens and tool events
3. Rejection flow: reject mutation → audit logged → no DB change
4. Expiration: unconfirmed mutations expire after TTL
5. Audit log captures all state transitions with before/after snapshots
6. Batch mutation: 100+ transaction categorizations in single session
7. `cd server && npx tsc --noEmit` — ZERO new errors
8. `cd client && npx tsc --noEmit` — ZERO new errors

## Team Structure (10 Agents)

| Agent | Name | Role | Sub-Wave | Depends On |
|-------|------|------|----------|------------|
| 1 | Mutation Schema Builder | Create migration 0014 + SQLite/PG dual schema definitions | 1 | — |
| 2 | Mutation Tools Service | Create `mutation-tools.ts` — core mutation proposal/execution engine | 1 | — |
| 3 | Mutation Auth Service | Create `mutation-auth.ts` — authorization rules for agent mutations | 1 | — |
| 4 | Confirmation Flow Service | Create `confirmation-flow.ts` — full lifecycle management | 2 | Agents 1, 2, 3 |
| 5 | SSE Streaming Service | Create `streaming.ts` — progressive token/event streaming | 1 | — |
| 6 | Audit Trail Service | Create `audit.ts` — immutable audit logging | 2 | Agent 1 |
| 7 | API Endpoints Builder | Create 6 API endpoints in `index.ts` | 2 | Agents 4, 5, 6 |
| 8 | Agent Integration | Modify `base-agent.ts`, `orchestrator.ts`, `transaction-categorizer.ts`, `gst-calculator.ts` | 3 | Agents 2, 4 |
| 9 | UI Chat & Audit Components | Create 4 UI components + modify FloatingChat + api.ts | 3 | Agent 7 |
| 10 | Testing & Validation | Verify all Wave 2 deliverables, TypeScript compilation, backward compatibility | 4 | ALL |

## Security Requirements (REVISION NOTE: Added per D01/D02 debate findings)

### SQL Injection Prevention (REVISION NOTE: D01-CRIT-01 — CRITICAL)
The `MutationTools` class constructs SQL with agent-provided table and column names. Agent output could be influenced by prompt injection, so defense-in-depth is MANDATORY:
1. **TABLE WHITELIST**: `const MUTABLE_TABLES = ['transactions', 'accounts', 'merchant_memory', 'pending_categorization', 'bas_calculations', 'bas_periods', 'transfer_links', 'reconciliation_alerts', 'deductions', 'tax_strategies', 'report_snapshots', 'kpi_metrics', 'budgets', 'budget_lines', 'budget_vs_actual', 'forecast_scenarios', 'forecast_periods', 'ocr_documents', 'ocr_line_items', 'payment_matches', 'payment_match_rules', 'inventory_items', 'inventory_stock', 'inventory_movements', 'bank_recon_matches', 'bank_recon_rules', 'bank_recon_sessions', 'fixed_assets', 'asset_depreciation', 'asset_disposals', 'inter_entity_transactions', 'consolidation_snapshots', 'consolidation_snapshot_lines', 'wage_payments'] as const;`
2. **COLUMN WHITELIST**: Validate column names against known schema columns for each table
3. Reject any table/column not in the whitelist BEFORE building SQL
4. Table and column names MUST be validated with a regex: `/^[a-z_][a-z0-9_]*$/` (lowercase alphanumeric + underscore only)

### User Identity Binding (REVISION NOTE: D02-CRIT-02)
- `agent_sessions.user_id` MUST be **NOT NULL** — every session must be bound to an authenticated user
- Confirm/reject endpoints (`POST /api/chat/confirm/:actionId`, `POST /api/chat/reject/:actionId`) MUST validate that the requesting user owns the session that proposed the mutation
- Row-level security: `executeMutation()` should verify the authenticated user has access to the target records

### CSRF Protection (REVISION NOTE: D02-SEC-03)
All POST/PUT/DELETE mutation endpoints MUST validate `Origin` header against allowed origins. The Wave 1 auth middleware sets the foundation; Wave 2 adds mutation-specific CSRF checks.

### Audit Log Data Redaction (REVISION NOTE: D02-SEC-07)
The `GET /api/agent-audit` endpoint MUST:
1. Require authentication (via Wave 1 auth middleware)
2. Scope audit queries to the authenticated user's data only (filter by `user_id`)
3. Redact sensitive fields in before/after state snapshots: TFN patterns (`\d{3}\s?\d{3}\s?\d{3}`), BSB+account patterns, strip any field named `tfn`, `tax_file_number`, `bank_account_number`, `bsb`
4. Restrict full audit access (unscoped) to admin role

## Coordination Rules

1. **DO NOT** modify any file not listed in your task — ask Team Lead before touching shared files
2. **DO NOT** remove any existing agent types from `types.ts` (BC-01)
3. **DO NOT** remove any existing tables from `schema.ts` (BC-02)
4. **DO NOT** modify migrations 0013 or 0023–0029 (BC-03)
5. **Dual schema pattern**: New tables go in BOTH `schema.ts` AND `postgres-schema.ts` (BC-04)
6. **DO NOT** modify `ClaudeAgent.invoke()` core signature — only add optional properties (BC-05)
7. **DO NOT** create a second CogneeClient — add methods to existing singleton (BC-06)
8. **Migration 0014 only** — no other migration numbers (BC-07)
9. **Route namespace**: Use `/api/chat/*` for mutation endpoints, `/api/agent-audit` for audit (BC-10)
10. **Marker files**: Create `.agent-done-W02-{NN}` on completion (e.g., `.agent-done-W02-01`) — REVISION NOTE: Zero-padded per D04-MARKER-01 / D05-L-02
11. **Error handling**: Mutation operations MUST be wrapped in try/catch with consistent JSON error response `{ error: string, code: number }` (REVISION NOTE: D01-DC-05)
12. **SSE format**: Use `event: {type}\ndata: {json}\n\n` format matching existing `events.ts` pattern
13. **DO NOT** change the existing `GET /api/events` SSE endpoint — Wave 2 adds a NEW streaming endpoint
14. **Confidence thresholds**: Auto-execute mutations ONLY if agent confidence > 0.9 AND mutation type is categorization/GST
15. **Backward compatibility**: `POST /api/chat` (non-streaming) must continue to work — streaming is a separate endpoint
16. **Zod validation (REVISION NOTE: D04-CONSIST-06)**: All new API endpoints MUST use Zod schemas for request body validation via `zValidator` middleware
17. **SSE connection cleanup (REVISION NOTE: D03-B1)**: SSE streaming service MUST implement per-connection write timeout (5s) and connection cleanup on client disconnect. Use an abstraction layer (`EventBus` interface) so Redis pub/sub can be swapped in later.
18. **Nginx SSE configuration (REVISION NOTE: D03-B7)**: Wave 2 Agent 9 (or Agent 7) MUST add an nginx location block for `/api/chat/stream` in `docker/nginx.conf` with identical SSE settings as `/api/events`: `proxy_buffering off`, `proxy_cache off`, `chunked_transfer_encoding off`, `proxy_read_timeout 86400s`, and `add_header X-Accel-Buffering no`. Also add `proxy_read_timeout 120s` to the generic `/api/` location for long-running operations (pay runs, batch categorization). Without this, SSE streaming will NOT work through Docker nginx.
19. **Rate limiting (REVISION NOTE: D01-DC-04 / D02-SEC-06)**: All new API endpoints MUST use the existing rate limiter middleware. Tiered limits: read endpoints 100 req/min, write endpoints 30 req/min, AI/streaming endpoints 20 req/min.
20. **Code splitting (REVISION NOTE: D03-S6)**: All new UI feature components MUST be lazy-loaded via `React.lazy()` + `Suspense`. Each feature folder is a separate chunk. List components with 100+ potential rows MUST use `@tanstack/react-virtual`.

## Execution Priority Order

### Sub-Wave 1 (Parallel — no dependencies):
Agents 1, 2, 3, 5 — Schema, MutationTools, MutationAuth, Streaming

### Sub-Wave 2 (After Sub-Wave 1):
Agents 4, 6 — ConfirmationFlow (needs schema + tools + auth), Audit (needs schema)

### Sub-Wave 3 (After Sub-Wave 2):
Agents 7, 8 — API endpoints (needs all services), Agent integration (needs tools + flow)

### Sub-Wave 4 (After ALL):
Agent 9 — UI components (needs API endpoints)
Agent 10 — Testing & Validation (needs everything)

## Debate Findings (Pre-incorporated)
- D01: Route modularization recommended — Wave 2 adds 6 endpoints to index.ts inline (acceptable for now; Wave 10+ can refactor)
- D02: SSE streaming should use existing EventEmitter pattern, NOT Redis pub/sub (Redis pub/sub deferred to Wave 17/21)
- D03: Mutation auto-execution needs clear confidence thresholds — set at 0.9 for categorization only
- D04: Agent mutations need both per-record and batch support — `proposeMutation()` + `batchProposeMutations()`
- D05: Audit trail must be immutable — `agent_audit_log` has no UPDATE/DELETE, only INSERTs
