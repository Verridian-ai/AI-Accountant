# Phase 2: Execution Agent Team Definition

**Author**: Architect Reviewer (Phase 1 Planning Team)
**Date**: 2026-02-17
**Status**: FINAL — Incorporates all Phase 1 teammate inputs (v2)
**Depends On**: REFACTORING_PLAN_REFINED.md, COGNEE_INTEGRATION_PLAN.md, DOCKER_ROLLBACK_PLAN.md

---

## 1. Executive Summary

Phase 2 transforms the Phase 1 planning output into executed code changes across **4 parallel tracks** with **8 specialized agents** over **~8 weeks** (2 FTE equivalent). The plan accounts for:

- ~23 of the original 63 REFACTOR tasks already completed on `refactor/REFACTOR-018-account-service`
- 10 mandatory Cognee features (F1-F10) defined in COGNEE_INTEGRATION_PLAN.md
- Docker rollback checkpoints after each track milestone
- Devil's advocate final consensus: SKIP 12 tasks, DEFER 3
- Sprint prioritization: "Does this prevent wrong numbers in financial reports?" = Sprint 1
- Cognee maximalist mandate: ALL 10 features (F1-F10) mandatory, no exit criteria

### Current Codebase Metrics (Verified 2026-02-17)

| Metric | Current | Target |
|--------|---------|--------|
| `any` occurrences (server) | 917 | <100 |
| `any` occurrences (client) | 406 | <50 |
| `any` files (server) | 262 files | <50 files |
| `any` files (client) | 88 files | <20 files |
| server/src/index.ts | 172 lines | <100 lines (cleanup only) |
| Route files extracted | 36/36 | 36/36 (done) |
| Routes with Zod validation | 7/36 | 36/36 |
| Routes with auth/RBAC | 3/36 | 36/36 |
| Test files | 14 | 80+ |
| Test coverage | <5% | >60% |
| Claude agent files | 51 | 51 (no change — wire, don't add) |
| Service subdirectories | 82 | 82 (consolidation only) |

---

## 2. Track Overview

```
Week 1-2         Week 3-4         Week 5-6         Week 7-8
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│ Track A  │     │ Track A  │     │         │     │         │
│ Found.+  │────►│ Type     │     │         │     │         │
│ Types    │     │ Safety   │     │         │     │         │
├─────────┤     ├─────────┤     ├─────────┤     ├─────────┤
│ Track B  │     │ Track B  │     │         │     │         │
│ Security │────►│ Security │     │         │     │         │
│ Hardening│     │ Complete │     │         │     │         │
├─────────┤     ├─────────┤     ├─────────┤     ├─────────┤
│         │     │ Track C  │     │ Track C  │     │ Track C  │
│         │     │ Test     │────►│ Server   │────►│ Client+  │
│         │     │ Infra    │     │ Tests    │     │ E2E      │
├─────────┤     ├─────────┤     ├─────────┤     ├─────────┤
│ Track D  │     │ Track D  │     │ Track D  │     │ Track D  │
│ DataPts+ │────►│ Sessions+│────►│ RBAC +   │────►│ MCP +    │
│ Ontology │     │ NodeSets │     │ Pipelines│     │ Verify   │
└─────────┘     └─────────┘     └─────────┘     └─────────┘
     │               │               │               │
  Docker           Docker          Docker          Docker
  Checkpoint 1    Checkpoint 2   Checkpoint 3    Checkpoint 4
```

---

## 2.1 Sprint Prioritization (Financial Safety Net Principle)

The devil's advocate and codebase-auditor reached consensus on a litmus test for task ordering:

> **"Does this prevent wrong numbers in financial reports?"** → Sprint 1. Otherwise → Sprint 2+.

This means financial-path type safety and validation MUST come before general cleanup.

### Sprint 0: Enabling (Serialization Point)

Before parallel work begins, one agent runs REFACTOR-020 (schema split) as a serialization point. All agents depend on stable schema types.

### Sprint 1: Financial Safety Net (Weeks 1-4)

**Litmus**: These tasks prevent wrong BAS numbers, incorrect GST, miscalculated tax.

| Priority | Task | Agent | Rationale |
|----------|------|-------|-----------|
| P0 | R031: Test infrastructure | test-infra-agent (C1) | Foundation for verifying correctness |
| P0 | R032+033: Tax + payroll tests | server-test-agent (C2) | Protect financial calculations |
| P0 | Scoped `any` elimination on financial paths (bas/, tax/, gst/, accounts/) | foundation-agent (A1) | Type errors here = wrong money |
| P0 | R003: TS strict flags | foundation-agent (A1) | Catches null/undefined in math |
| P0 | R057: Input validation (financial routes) | security-agent (B1) | Prevent invalid amounts/dates entering system |

### Sprint 2: Risk Reduction (Weeks 3-6)

| Priority | Task | Agent | Rationale |
|----------|------|-------|-----------|
| P1 | R007: Remaining `any` elimination | foundation-agent (A1) | Broader type safety |
| P1 | R034-037: More service tests | server-test-agent (C2) | Broader test coverage |
| P1 | R058: RBAC middleware | security-agent (B1) | Access control |
| P1 | Cognee F1-F6 (DataPoints, Ontology, Pipelines, Memify, NodeSets, Search Types) | cognee-agent (D1) | Intelligence upgrade |

### Sprint 3+: Polish (Weeks 5-8)

Everything else: client tests, E2E, Cognee F7-F10 (Sessions, RBAC, MCP, Agent Wiring), remaining cleanup.

## 2.2 Cognee Maximalist Mandate

**There is no exit criterion for Cognee. Cognee is non-negotiable.**

The `COGNEE_INTEGRATION_PLAN.md` defines 10 mandatory features (F1-F10), all P0 or P1. The cognee-agent implements ALL of them across the full 8-week timeline. Cognee provides knowledge graph construction, multi-hop reasoning, 14 search modes, custom DataPoints, ontology-driven extraction, memify enrichment, session memory, multi-tenant RBAC, and MCP server — none of which pgvector or any alternative can replicate.

**Decision: Implement ALL 10 features. No exceptions. No deferrals. No A/B testing.**

---

## 3. Agent Roster

### 3.1 Track A: Foundation & Type Safety

#### Agent A1: `foundation-agent`

- **Role**: TypeScript strict mode, `any` elimination, shared types
- **Model**: `claude-opus-4-6`
- **Subagent Type**: `general-purpose`
- **Duration**: Weeks 1-4 (front-loaded)
- **File Ownership**:
  - `server/tsconfig.json`, `client/tsconfig.json`, `client/tsconfig.app.json`
  - `packages/shared/src/**/*`
  - `server/src/db-adapter.ts` (wrapPgDb type safety)
  - `server/src/schema.ts` (type exports)

**Spawn Prompt**:
```
You are the Foundation Agent on the GoldLedger Phase 2 execution team.

## Mission
Enable TypeScript strict flags and eliminate `any` types across the codebase.

## Tasks (in order)

### Week 1: Enable Strict Flags
1. Read server/tsconfig.json and client/tsconfig.app.json
2. Enable these flags ONE AT A TIME, fixing errors after each:
   - `noImplicitAny` (highest impact — will surface ~80% of issues)
   - `strictNullChecks` (already partially enabled via `strict: true` but not enforced)
   - `noImplicitReturns` (client has this, server does not)
3. After each flag, run `npx tsc --noEmit` and fix ALL errors before moving on
4. Commit after each flag: `refactor(REFACTOR-003): enable {flagName}`

### Week 2-3: Eliminate `any` Types (Financial Safety Net First)
1. Start with `server/src/db-adapter.ts` — this is the ROOT CAUSE of most `any` propagation
   - wrapPgDb() returns `any` — add proper generic return types
   - This single fix will cascade type safety to all DB queries
2. SPRINT 1 PRIORITY — Financial paths first (wrong types here = wrong money):
   - bas/ (BAS calculations — wrong `any` can produce incorrect GST)
   - tax/ services (tax calculations — wrong types = wrong deductions)
   - accounts/ (balance calculations — wrong types = incorrect balances)
   - bills/ (payment amounts — wrong types = incorrect AP totals)
3. Then remaining `server/src/services/` files — currently 917 occurrences across 262 files
   - Use `packages/shared/src/types/` for shared interfaces
4. Work through `client/src/` files — currently 406 occurrences across 88 files
   - Most client `any` comes from API response types
   - Use `client/src/api/types.ts` for API response interfaces

### Week 4: Cleanup
1. Add explicit return types to all exported functions
2. Replace remaining `as any` casts with proper type guards
3. Verify: `grep -r "any" server/src/ --include="*.ts" | grep -v node_modules | wc -l` < 50 occurrences

## Rules
- NEVER use `any` as a fix — use `unknown` + type guard, generics, or concrete types
- NEVER break existing functionality — all existing tests must pass
- Run `npx tsc --noEmit` after EVERY file change
- Commit format: `refactor(REFACTOR-0XX): description`
- Max 500 lines changed per commit
- Read the file BEFORE editing it
```

**Verification Criteria**:
- `npx tsc --noEmit` passes with `noImplicitAny: true` in both server and client
- `grep -r ": any" server/src/ --include="*.ts" | wc -l` < 50
- `grep -r ": any" client/src/ --include="*.ts" --include="*.tsx" | wc -l` < 20
- All 14 existing test files still pass

---

#### Agent A2: `schema-agent`

- **Role**: Database schema type safety, migration validation
- **Model**: `claude-sonnet-4-5-20250929`
- **Subagent Type**: `general-purpose`
- **Duration**: Weeks 1-2
- **File Ownership**:
  - `server/src/schema.ts`
  - `server/src/db/postgres-schema.ts`
  - `server/src/db/postgres-connection.ts`
  - `server/src/db-adapter.ts` (shared with A1 — coordinate via task system)
  - `docker/migrations/*.sql`

**Spawn Prompt**:
```
You are the Schema Agent on the GoldLedger Phase 2 execution team.

## Mission
Make database operations type-safe by fixing the wrapPgDb() adapter and validating schema consistency.

## Background
The codebase uses `sqliteTable()` from Drizzle ORM for ALL table definitions, then a `wrapPgDb()`
proxy in `db-adapter.ts` translates at runtime to PostgreSQL. This proxy returns `any`, defeating
all type safety for database queries.

## Tasks

### Week 1: Type-Safe DB Adapter
1. Read `server/src/db-adapter.ts` — understand the wrapPgDb() proxy
2. Read `server/src/schema.ts` — all table definitions
3. Read `server/src/db/postgres-connection.ts` — actual PG connection
4. Create typed query helpers that preserve Drizzle's type inference:
   - Option A: Generic wrapper — `typedQuery<T>(table, query) => Promise<T[]>`
   - Option B: Drizzle PG schema — migrate sqliteTable() → pgTable() (bigger change)
   - RECOMMENDED: Option A first (less risk), Option B as follow-up task
5. Update the 5 most-used services to use typed queries:
   - accounts.ts, transactions routes, statements routes, bas.ts, bills.ts

### Week 2: Schema Validation
1. Verify all 45+ tables in schema.ts match the migration files in docker/migrations/
2. Check for schema drift: tables in migrations that aren't in schema.ts
3. Validate that postgres-schema.ts and schema.ts don't conflict
4. Create a schema test that verifies table/column alignment

## Rules
- NEVER modify migration files — they are immutable historical records
- NEVER drop or alter tables without explicit approval
- Run `npx tsc --noEmit` after EVERY change
- Coordinate with foundation-agent on db-adapter.ts changes via task system
- Commit format: `refactor(REFACTOR-0XX): description`
```

**Verification Criteria**:
- `wrapPgDb()` no longer returns raw `any`
- At least 5 core services use typed DB queries
- Schema consistency test exists and passes
- Zero new migration files created (read-only analysis + type overlays)

---

### 3.2 Track B: Security Hardening

#### Agent B1: `security-agent`

- **Role**: Zod validation, RBAC middleware, security hardening
- **Model**: `claude-opus-4-6`
- **Subagent Type**: `general-purpose`
- **Duration**: Weeks 1-4
- **File Ownership**:
  - `server/src/routes/*.ts` (all 36 route files)
  - `server/src/middleware/auth.ts`
  - `server/src/middleware/security.ts`
  - `server/src/services/auth-middleware.ts`
  - `server/src/services/admin-auth/`

**Spawn Prompt**:
```
You are the Security Agent on the GoldLedger Phase 2 execution team.

## Mission
Add Zod request validation and RBAC auth middleware to ALL 36 route files.

## Current State
- 7 of 36 route files have Zod validation
- 3 of 36 route files have auth/RBAC middleware
- Middleware exists: `server/src/middleware/auth.ts`, `server/src/middleware/security.ts`
- RBAC service exists: `server/src/services/admin-auth/authorization.ts`

## Tasks

### Week 1-2: Zod Validation (29 remaining routes)
1. Read each route file in `server/src/routes/`
2. For each POST/PUT/PATCH endpoint:
   - Define a Zod schema for the request body
   - Add validation middleware using the existing pattern from the 7 done routes
3. For each GET endpoint with query params:
   - Define a Zod schema for query parameters
   - Validate and parse with defaults
4. Priority order (Financial Safety Net first — wrong input = wrong money):
   - bas.ts, tax.ts, accounts.ts (financial calculations — Sprint 1)
   - transactions.ts, statements.ts (core data — Sprint 1)
   - bills.ts, invoicing-routes.ts, payroll.ts (business logic — Sprint 1)
   - chat-core.ts, agents.ts, ai-agents.ts (AI endpoints — Sprint 2)
   - Remaining routes alphabetically (Sprint 2)

### Week 3-4: RBAC Middleware (33 remaining routes)
1. Study the auth middleware pattern in the 3 routes that already have it
2. For each route file, determine the minimum required role:
   - viewer: GET-only routes (read data)
   - bookkeeper: Transaction CRUD, categorization
   - accountant: BAS, GST, tax, reports
   - admin: User management, system settings, agent config
   - owner: Tenant management, billing, destructive operations
3. Apply `requireAuth()` middleware to all authenticated routes
4. Apply `requireRole('X')` middleware for role-restricted routes
5. Apply `requirePermission('X')` for fine-grained permissions

### Week 4: Security Audit
1. Run OWASP checklist against all routes
2. Verify no route accepts raw user input in SQL queries
3. Check rate limiting is applied to expensive endpoints (AI, OCR, crawl)
4. Verify CORS headers are correctly set

## Rules
- NEVER remove existing validation — only ADD
- NEVER change the API contract (request/response shapes) — only validate
- Test each route after adding validation: send a request with invalid data, verify 400
- Run `npx tsc --noEmit` after EVERY file change
- Commit format: `refactor(REFACTOR-0XX): add Zod validation to {route}`
- Max 2 route files per commit
```

**Verification Criteria**:
- `grep -rl "z.object\|zod" server/src/routes/*.ts | wc -l` = 36
- `grep -rl "requireAuth\|requireRole" server/src/routes/*.ts | wc -l` = 36
- All existing tests pass
- Manual test: POST to any endpoint with invalid body returns 400 with Zod error

---

### 3.3 Track C: Testing

#### Agent C1: `test-infra-agent`

- **Role**: Set up test infrastructure, CI pipeline, coverage tooling
- **Model**: `claude-sonnet-4-5-20250929`
- **Subagent Type**: `general-purpose`
- **Duration**: Week 3 (after Tracks A/B stabilize)
- **File Ownership**:
  - `server/vitest.config.ts` (or `jest.config.ts`)
  - `server/src/test-utils/` (new directory)
  - `client/vitest.config.ts`
  - `.github/workflows/` (CI if it exists)

**Spawn Prompt**:
```
You are the Test Infrastructure Agent on the GoldLedger Phase 2 execution team.

## Mission
Set up test infrastructure so that test-writer agents can be productive.

## Tasks

### Week 3: Test Infrastructure
1. Audit current test setup:
   - Read `server/package.json` for test runner config
   - Read existing 14 test files to understand patterns
   - Check if vitest or jest is configured
2. Create test utilities:
   - `server/src/test-utils/db-mock.ts` — mock database adapter (wrapPgDb returns typed mocks)
   - `server/src/test-utils/auth-mock.ts` — mock auth context (tenant, user, role)
   - `server/src/test-utils/cognee-mock.ts` — mock Cognee client (no real HTTP)
   - `server/src/test-utils/fixtures.ts` — common test data (accounts, transactions, statements)
3. Create test configuration:
   - Coverage threshold: 60% minimum (line + branch)
   - Test file pattern: `*.test.ts` co-located with source
   - Separate configs for unit vs integration tests
4. Create CI configuration (if not exists):
   - Run `tsc --noEmit` (type check)
   - Run unit tests
   - Run `npm run build` (build check)
   - Coverage report

## Rules
- Test utils must work with the EXISTING test runner (don't switch from jest to vitest or vice versa)
- Mock patterns must match how services actually use DB/Cognee/Auth
- Read at least 3 existing test files before designing the infrastructure
- Commit format: `test(infra): description`
```

**Verification Criteria**:
- `server/src/test-utils/` directory exists with 4+ utility files
- `npm test` runs without error
- Coverage reporting works (`npm test -- --coverage`)
- At least one example test uses the new mock utilities

---

#### Agent C2: `server-test-agent`

- **Role**: Write server-side unit and integration tests
- **Model**: `claude-sonnet-4-5-20250929`
- **Subagent Type**: `general-purpose`
- **Duration**: Weeks 5-6 (after test infra is ready)
- **File Ownership**:
  - `server/src/services/**/*.test.ts`
  - `server/src/routes/**/*.test.ts`

**Spawn Prompt**:
```
You are the Server Test Agent on the GoldLedger Phase 2 execution team.

## Mission
Write unit tests for the 20 highest-priority server services and routes.

## Priority Order (Financial Safety Net first — wrong tests here = wrong money undetected)
Sprint 1 (MUST — financial correctness):
1. bas service + route (BAS/GST calculations — wrong BAS = ATO penalties)
2. tax services (tax calculations — wrong deductions = compliance risk)
3. accounts service + route (balance calculations — wrong balances = bad decisions)
4. bills service + route (AP amounts — wrong payments = real money lost)
5. payroll service (pay calculations — wrong pay = legal liability)

Sprint 2 (SHOULD — data integrity):
6. transactions route (CRUD, filtering, pagination)
7. statements route (upload, parse)
8. budgets service (variance, generation)
9. bank-reconciliation service (matching, rules)
10. cash-flow-forecast service (forecasting models)
11-20: Remaining services by file size

## Test Pattern
For each service:
1. Read the service file to understand public API
2. Read test-utils to understand available mocks
3. Write tests covering:
   - Happy path for each public method
   - Error cases (invalid input, missing data)
   - Edge cases (empty arrays, null values, boundary conditions)
   - At least one integration-style test (multiple methods together)
4. Target: 70%+ coverage per file

## Rules
- Use the mock utilities from test-utils/ — do NOT make real HTTP or DB calls
- Co-locate tests: `accounts.test.ts` next to `accounts.ts` (or in accounts/ dir)
- Run `npm test -- --run {file}` after writing each test file
- Fix any failing tests before moving to the next service
- Commit format: `test(service-name): add unit tests`
- Max 1 test file per commit
```

**Verification Criteria**:
- 20+ new `*.test.ts` files exist
- `npm test` passes with 0 failures
- Coverage report shows >60% for tested services
- Tests run in <30 seconds (no real I/O)

---

#### Agent C3: `client-test-agent`

- **Role**: Write client component tests and E2E tests
- **Model**: `claude-sonnet-4-5-20250929`
- **Subagent Type**: `general-purpose`
- **Duration**: Weeks 7-8 (last phase)
- **File Ownership**:
  - `client/src/**/*.test.tsx`
  - `client/src/**/*.test.ts`
  - `e2e/` (if created)

**Spawn Prompt**:
```
You are the Client Test Agent on the GoldLedger Phase 2 execution team.

## Mission
Write component tests for critical UI features and basic E2E smoke tests.

## Priority Components (by user-facing importance)
1. LedgerPage / TransactionTable (core transaction view)
2. FileUpload / UploadZone (statement upload)
3. ChatInterface / FloatingChat (AI chat)
4. AccountManager / AccountSwitcher (account management)
5. BASDashboard / BASPage (BAS calculations)
6. CategorySelect / CategoryBreakdown (transaction categorization)
7. Settings page
8. InvoiceEditor / InvoiceList (invoicing)

## Test Pattern
For each component:
1. Read the component source
2. Write tests using React Testing Library:
   - Renders without error
   - Displays correct data when given props
   - User interactions (click, type, select) trigger correct callbacks
   - Error states render correctly
   - Loading states render correctly
3. For pages, test route integration

## E2E Smoke Tests (if time permits)
1. Login → navigate to transactions → verify table renders
2. Upload a statement → verify it appears in list
3. Open chat → send a message → verify response appears

## Rules
- Use @testing-library/react for component tests
- Mock ALL API calls — no real server needed
- Run tests after each file: `npx vitest run {file}`
- Commit format: `test(component-name): add component tests`
```

**Verification Criteria**:
- 10+ client test files exist
- `npm test` (client) passes
- Core pages (Ledger, Upload, Chat) have test coverage
- No flaky tests

---

### 3.4 Track D: Cognee Maximalist Integration (ALL 10 Features)

#### Agent D1: `cognee-agent` (Cognee Implementation Agent)

- **Role**: Execute the MAXIMALIST Cognee integration plan — ALL 10 features (F1-F10) from COGNEE_INTEGRATION_PLAN.md. No deferrals. No exit criteria. Cognee is the platform.
- **Model**: `claude-opus-4-6`
- **Subagent Type**: `general-purpose`
- **Duration**: Weeks 1-8 (full timeline — longest track, highest strategic value)
- **File Ownership**:
  - `server/src/services/cognee/**/*` (14 files — client hierarchy, auth, search, data-ops, cognify, etc.)
  - `server/src/services/cognee_client.ts` (barrel re-export)
  - `server/src/services/cognee-datapoints/**/*` (DataPoint config CRUD)
  - `server/src/services/cognee-ontologies/**/*` (ontology management)
  - `server/src/services/cognee-sessions/**/*` (Redis sessions, rate limiting)
  - `server/src/services/cognee-graph/**/*` (graph mutations, queries, traversal)
  - `server/src/services/cognee-feedback/**/*` (feedback + memify trigger)
  - `server/src/services/cognee-admin/**/*` (dataset management, graph stats)
  - `server/src/services/cognee-migration.ts` (tenant migration)
  - `server/src/services/claude/cognee-tools*.ts` (agent tool wrappers)
  - `server/src/services/claude/orchestrator.ts` (agent dispatch)
  - `server/src/services/claude/intent-router.ts` (intent classification)
  - `server/src/routes/chat-core.ts` (chat endpoint)
  - `server/src/routes/cognee.ts` (Cognee API routes)
  - `server/cognee-models/**/*` (NEW — Python DataPoints, OWL ontology, custom tasks, pipelines)
  - `.mcp.json` (NEW — MCP server configuration)
  - `docker-compose.yml` (Cognee env vars + cognee-mcp service + volume mounts)

**Spawn Prompt**:
```
You are the Cognee Implementation Agent on the GoldLedger Phase 2 execution team.

## Mission
Execute the MAXIMALIST Cognee integration plan documented in docs/COGNEE_INTEGRATION_PLAN.md.
Implement ALL 10 features (F1-F10). No exceptions. No deferrals. No exit criteria.
Cognee IS the platform — there is no "maybe pgvector instead" discussion.

## CRITICAL: Read docs/COGNEE_INTEGRATION_PLAN.md IN FULL before any work. It is 1,644 lines.

The plan defines 10 mandatory features. Execute them in this order across 8 weeks:

### Week 1-2: Foundation Features (F1, F2, F5, F6)

#### F1: Custom DataPoint Models (Python Pydantic) — §3 of plan
1. Create `server/cognee-models/goldledger_datapoints.py` with 10 DataPoint classes:
   TransactionNode, AccountNode, MerchantNode, CategoryNode, GSTRuleNode,
   PatternNode, BASPeriodNode, DeductionNode, FinancialYearNode, TransferNode
2. Each model inherits from `cognee.infrastructure.engine.DataPoint`
3. Mount into Cognee container via docker-compose volume: `./server/cognee-models:/app/custom_models:ro`
4. Verify cognify uses custom models for entity extraction

#### F2: Custom Ontologies (RDF/OWL) — §4 of plan
1. Create `server/cognee-models/ontologies/australian-finance.owl`
   - 15+ OWL classes: Transaction, Account, Merchant, Category, GSTClassification,
     BASPeriod, FinancialYear, TaxDeduction, ATORuling, SoleTrader, Company, Trust, etc.
   - 12+ object properties (belongsTo, paidTo, categorizedAs, hasGSTClassification, etc.)
   - GST classification individuals (StandardRated, GSTFree, InputTaxed, ExportGSTFree)
   - ATO deduction individuals (D1-D15)
   - BAS quarter individuals (Q1=Jul-Sep, Q2=Oct-Dec, Q3=Jan-Mar, Q4=Apr-Jun)
2. Wire to cognify via `ontology_file_path` parameter

#### F5: NodeSet Tagging Strategy — §7 of plan
1. Create `server/src/services/cognee/nodeset-utils.ts`
2. Tag ALL data ingestion across 3 dimensions:
   - Temporal: FY2024-25, Q1-Q4, YYYY-MM
   - Categorical: tax_deductions, gst_applicable, gst_free, income, expenses
   - Account: account_{id}
3. Add `addDataWithNodeSets()` to data-ops.ts
4. Add `searchWithNodeSets()` to search.ts

#### F6: All 14 Search Types — §8 of plan
1. Create `server/src/services/cognee/search-type-selector.ts`
2. Map ALL 14 types to specific use cases:
   CHUNKS, CHUNKS_LEXICAL, GRAPH_COMPLETION, GRAPH_COMPLETION_COT,
   GRAPH_COMPLETION_CONTEXT_EXTENSION, RAG_COMPLETION, SUMMARIES,
   GRAPH_SUMMARY_COMPLETION, NATURAL_LANGUAGE, CYPHER, CODE,
   FEELING_LUCKY, FEEDBACK, CODING_RULES
3. Implement smart `selectSearchType(query, context)` function
4. Wire into cognee-tools.ts for all agent searches

### Week 3-4: Intelligence & Agent Wiring (F4, F7, F10)

#### F7: Sessions with Redis — §9 of plan
1. Wire CogneeSessionService to /api/chat endpoint (currently NOT wired)
2. Create session per chat conversation, pass session_id to all Cognee search calls
3. Record conversation turns (user + assistant) in Redis
4. Add sessionId to chat response for client persistence
5. Update FloatingChat.tsx to persist sessionId in state
6. Session lifecycle: 30-min TTL, max 100 turns, last 10 turns context

#### F10: Agent-Cognee Wiring Matrix — §12 of plan
1. Wire ALL 26 agents to chat via intent router:
   - Enhance intent-router.ts with full INTENT_TO_AGENT mapping
   - Add routeAndDispatch(query, context) to orchestrator.ts
   - Each agent gets specific datasets, search types, session handling
2. Intent classification keywords for each agent (categorize→categorizer, gst→gst_calculator, etc.)
3. Agent response → Cognee feedback loop (submitSearchFeedback after every response)
4. Test: Every agent routable from /api/chat

#### F4: Memify Enrichment Rules — §6 of plan
1. Create `server/cognee-models/tasks/memify_enrichment.py` with 5 rules:
   - Spending pattern derivation
   - BAS quarter summaries
   - Merchant intelligence
   - Transfer pattern rules
   - Recurring payment schedules
2. Wire triggerMemify() to execute custom enrichment after cognify

### Week 5-6: Security & Pipelines (F3, F8)

#### F8: Multi-Tenant RBAC — §10 of plan (MANDATORY, not deferrable)
1. Phase 1: Enable `REQUIRE_AUTHENTICATION=true` in docker-compose.yml
2. Phase 2: Run migration script (create Cognee accounts, tenants, roles, permissions)
   - Create `server/src/services/cognee/migration-rbac.ts`
   - Grant shared dataset read to all tenants
   - Grant tenant-specific dataset read/write
3. Phase 3: Enable `ENABLE_BACKEND_ACCESS_CONTROL=true`
4. Enforce shared dataset rules at addData() level
5. Verification: User A cannot see User B's data

#### F3: Custom Pipelines & Tasks — §5 of plan
1. Create 5 custom Python tasks:
   - `server/cognee-models/tasks/financial_entity_extraction.py`
   - `server/cognee-models/tasks/gst_classification.py`
   - `server/cognee-models/tasks/transfer_detection.py`
   - `server/cognee-models/tasks/temporal_patterns.py`
   - `server/cognee-models/tasks/tax_deduction.py`
2. Create custom pipeline: `server/cognee-models/pipelines/goldledger_pipeline.py`
3. Mount tasks in Cognee container
4. Verify custom tasks execute during cognify

### Week 7-8: MCP Server & Integration (F9)

#### F9: MCP Server — §11 of plan (REQUIRED, not optional)
1. Deploy cognee-mcp as sidecar or separate service in docker-compose.yml
2. 11 tools exposed: cognify, search, add_rules, codify, save_interaction,
   get_rules, list_data, delete, prune, cognify_status, search_transactions
3. Create `.mcp.json` for Claude Code integration
4. Verify Claude Code can access Cognee MCP tools
5. Verify Agent SDK can query knowledge graph

### Week 8: Integration Testing & Documentation
1. End-to-end verification of ALL 10 features
2. Performance benchmarks for each search type
3. Docker health checks pass for all services (including cognee-mcp)
4. Updated MAXIMALIST_COGNIFY_PROMPT deployed

## Rules
- Follow docs/COGNEE_INTEGRATION_PLAN.md precisely — it is the source of truth
- ALL 10 features are mandatory. There is NO exit criterion. Do not skip any feature.
- Test each feature in isolation before moving to the next
- Run `npx tsc --noEmit` after every TypeScript change
- Commit format: `refactor(cognee-FX): description` (e.g., `refactor(cognee-F1): add Python DataPoint models`)
- Docker checkpoint after Weeks 2, 4, 6, and 8
- If enabling ENABLE_BACKEND_ACCESS_CONTROL breaks things, fix forward — do NOT rollback to disabled
- MCP server is REQUIRED, not optional
- Multi-tenant RBAC is REQUIRED, not deferrable
```

**Verification Criteria**:
- F1: 10 Python DataPoint models mounted in Cognee container, used during cognify
- F2: OWL ontology file created, passed to cognify via `ontology_file_path`
- F3: 5 custom pipeline tasks execute during cognify
- F4: Memify produces derived PatternNodes, BASPeriodNodes, MerchantNodes
- F5: All data ingested with NodeSet tags (temporal + categorical + account)
- F6: All 14 search types mapped, smart type selection returns different results per type
- F7: Chat endpoint creates/uses sessions, multi-turn context works ("What about Q3?" resolves)
- F8: `REQUIRE_AUTHENTICATION=true` AND `ENABLE_BACKEND_ACCESS_CONTROL=true` in docker-compose.yml
- F9: MCP server deployed, 11 tools accessible from Claude Code
- F10: ALL 26 agents accessible from chat via intent router
- `npx tsc --noEmit` passes after all changes
- Docker: all services (including cognee-mcp) pass health checks

---

#### Agent D2: `cleanup-agent`

- **Role**: Dead code removal, barrel export consolidation, import hygiene
- **Model**: `claude-sonnet-4-5-20250929`
- **Subagent Type**: `general-purpose`
- **Duration**: Weeks 1-2 (then available for overflow)
- **File Ownership**:
  - `server/src/services/*.ts` (top-level monolithic files that have been split)
  - `client/src/features/*/index.ts` (barrel exports)
  - `eslint.config.mjs`

**Spawn Prompt**:
```
You are the Cleanup Agent on the GoldLedger Phase 2 execution team.

## Mission
Remove dead code, consolidate barrel exports, and clean up the codebase after
the massive wave 13-24 feature additions and recent service splitting.

## Tasks

### Week 1: Dead Code Removal
1. For each service in server/src/services/ that has BOTH:
   - A monolithic file (e.g., `accounts.ts`)
   - A split directory (e.g., `accounts/`)
   Verify the monolithic file is ONLY a re-export barrel, then:
   - If barrel only: leave it (backward compat)
   - If it has actual logic: ensure the logic is in the split dir, then convert to barrel
2. Find and remove unused imports across server/src/
3. Find and remove commented-out code blocks (>5 lines)
4. Find and remove console.log statements (should be logger calls)

### Week 2: Import Path Hygiene
1. Ensure all service imports use consistent paths
2. Verify barrel exports in client/src/features/*/index.ts are up to date
3. Clean up any circular dependencies
4. Verify ESLint config is consistent and not overly permissive

## Rules
- NEVER delete a file without confirming zero references (grep -r)
- NEVER modify business logic — only imports, exports, dead code
- Run `npx tsc --noEmit` after EVERY change
- Run `npm test` after removing any code
- Commit format: `refactor(cleanup): description`
```

**Verification Criteria**:
- No monolithic service files with actual logic (all should be barrel re-exports or fully split)
- `grep -r "console.log" server/src/ --include="*.ts" | grep -v node_modules | wc -l` = 0
- `npx tsc --noEmit` passes in both server and client
- All existing tests pass

---

## 4. Task Assignment Matrix

### Tasks ALREADY DONE (Skip)

| REFACTOR ID | Description | Evidence |
|-------------|-------------|----------|
| REFACTOR-001 | Remove dead code (initial) | Done in wave audit |
| REFACTOR-002 | Consolidate ESLint | eslint.config.mjs exists |
| REFACTOR-004 | Consolidate tsconfig | Done — server + client + shared |
| REFACTOR-005 | Create shared types package | packages/shared/ exists |
| REFACTOR-006 | Extract route modules | 36 route files exist |
| REFACTOR-007 | Split api.ts | client/src/api/ (18 files) exists |
| REFACTOR-008 | Create logger utility | server/src/lib/logger.ts exists |
| REFACTOR-009 | Create config utility | server/src/lib/config.ts exists |
| REFACTOR-010 | Extract middleware | 5 middleware files exist |
| REFACTOR-012-016 | Route extractions | All 36 routes extracted |
| REFACTOR-018-020 | Service splits (accounts, admin-auth, etc.) | 82 service subdirs exist |
| REFACTOR-021 | Create repositories | Statement/user repos exist |
| REFACTOR-022 | Global error handling | error-handler.ts middleware exists |
| REFACTOR-023 | Consolidate Zod schemas (invoicing) | Done per git log |

### Tasks SKIPPED (Devil's Advocate Final Consensus)

| REFACTOR ID | Description | Reason |
|-------------|-------------|--------|
| REFACTOR-023 | DI container (Awilix) | Over-engineering. JS modules ARE singletons. vi.mock() provides test isolation. |
| REFACTOR-028 | Event-driven architecture | Adds complexity without clear benefit for single-server deployment. |
| REFACTOR-029 | CQRS pattern | Unnecessary for current read/write ratios. Premature optimization. |
| REFACTOR-047 | GraphQL layer | REST + Zod validation is sufficient. GraphQL adds schema maintenance burden. |
| REFACTOR-048 | WebSocket refactor | SSE already works for real-time. WebSocket migration is scope creep. |
| REFACTOR-049 | Microservice extraction | Single Docker server is correct for current scale. Extract when scaling demands. |
| REFACTOR-050 | Prometheus metrics | Not needed for single-Docker deployment. Add when scaling. |
| REFACTOR-052 | Storybook setup | No design system team to maintain it. Use component tests instead. |
| REFACTOR-054 | JSDoc all exports | Diminishing returns. Focus on complex/public APIs only. |
| REFACTOR-055 | Onboarding developer guide | Write AFTER refactoring is done, not during. |
| REFACTOR-060 | Performance benchmarks | Premature optimization. Profile when users report slowness. |
| REFACTOR-063 | Full CI/CD pipeline | Basic CI in Phase 2. Full CD is a deployment concern, not refactoring. |

### Tasks DEFERRED (Post-Phase 2)

| REFACTOR ID | Description | Reason |
|-------------|-------------|--------|
| REFACTOR-051 | OpenAPI/Swagger | Add AFTER Zod schemas are done (Phase 2 output enables this). |
| REFACTOR-053 | Architecture Decision Records | Write AFTER decisions are made in Phase 2, not before. |
| REFACTOR-055 | Developer onboarding guide | Write AFTER the codebase is in its final refactored state. |

### Task → Agent Assignment

| REFACTOR ID | Task | Agent | Track | Week |
|-------------|------|-------|-------|------|
| REFACTOR-003 | Enable TS strict flags | foundation-agent (A1) | A | 1 |
| REFACTOR-011 | Expand shared types | foundation-agent (A1) | A | 1-2 |
| REFACTOR-024-042 | Remaining service splits | cleanup-agent (D2) | D | 1-2 |
| COGNEE-F1 | Custom DataPoint Models (10 Python Pydantic classes) | cognee-agent (D1) | D | 1-2 |
| COGNEE-F2 | Custom Ontologies (RDF/OWL Australian finance) | cognee-agent (D1) | D | 1-2 |
| COGNEE-F5 | NodeSet Tagging Strategy (3-dimensional) | cognee-agent (D1) | D | 1-2 |
| COGNEE-F6 | All 14 Search Types (smart selection) | cognee-agent (D1) | D | 1-2 |
| COGNEE-F7 | Sessions with Redis (wire to chat) | cognee-agent (D1) | D | 3-4 |
| COGNEE-F10 | Agent-Cognee Wiring (ALL 26 agents) | cognee-agent (D1) | D | 3-4 |
| COGNEE-F4 | Memify Enrichment Rules (5 rules) | cognee-agent (D1) | D | 3-4 |
| COGNEE-F8 | Multi-Tenant RBAC (full isolation) | cognee-agent (D1) | D | 5-6 |
| COGNEE-F3 | Custom Pipelines & Tasks (5 custom tasks) | cognee-agent (D1) | D | 5-6 |
| COGNEE-F9 | MCP Server (sidecar deployment, 11 tools) | cognee-agent (D1) | D | 7-8 |
| NEW-SECURITY-01 | Zod validation (29 routes) | security-agent (B1) | B | 1-2 |
| NEW-SECURITY-02 | RBAC middleware (33 routes) | security-agent (B1) | B | 3-4 |
| REFACTOR-043 | DB adapter type safety | schema-agent (A2) | A | 1-2 |
| REFACTOR-044 | Schema consistency validation | schema-agent (A2) | A | 2 |
| NEW-TEST-01 | Test infrastructure setup | test-infra-agent (C1) | C | 3 |
| NEW-TEST-02 | Server service tests (20 files) | server-test-agent (C2) | C | 5-6 |
| NEW-TEST-03 | Client component tests (10 files) | client-test-agent (C3) | C | 7-8 |

---

## 5. File Ownership & Conflict Prevention

### Exclusive Ownership Rules

Each agent has exclusive write access to their owned files. If two agents need to modify the same file:
1. One agent owns the file
2. The other creates a task requesting the change
3. The owner implements and commits

### Critical Shared Files (Require Coordination)

| File | Primary Owner | Secondary Users | Coordination |
|------|---------------|-----------------|-------------|
| `server/src/db-adapter.ts` | schema-agent (A2) | foundation-agent (A1) | A2 does structural change first, A1 adds type annotations |
| `server/tsconfig.json` | foundation-agent (A1) | schema-agent (A2) | A1 owns all tsconfig changes |
| `server/src/schema.ts` | schema-agent (A2) | — | Read-only for all others |
| `docker-compose.yml` | cognee-agent (D1) | — | Cognee env vars + cognee-mcp service + volume mounts; Docker checkpoints by team lead |
| `server/cognee-models/**/*` | cognee-agent (D1) | — | Python DataPoints, OWL ontology, custom tasks, pipelines — Cognee exclusive |
| `.mcp.json` | cognee-agent (D1) | — | MCP server config for Claude Code integration |
| `server/src/routes/*.ts` | security-agent (B1) | server-test-agent (C2) | B1 modifies routes; C2 writes .test.ts files only |
| `server/src/services/claude/orchestrator.ts` | cognee-agent (D1) | — | Critical path for agent wiring |

---

## 6. Docker Checkpoints

After each track milestone, the team lead runs:

```bash
# Checkpoint script (from DOCKER_ROLLBACK_PLAN.md)
PHASE="phase2-checkpoint-N"
docker tag cba-server:latest cba-server:$PHASE
docker tag cba-client:latest cba-client:$PHASE
docker compose exec postgres pg_dump -U postgres ai_accountant > backups/$PHASE.sql
echo "$PHASE checkpoint at $(date)" >> backups/checkpoint-log.txt
```

### Checkpoint Schedule

| Checkpoint | After | Verification |
|-----------|-------|-------------|
| CP1 (Week 2) | Track A flags + Track B Zod + Track D F1+F2+F5+F6 (DataPoints, Ontology, NodeSets, Search) | `tsc --noEmit` passes, Docker services start, DataPoint models mounted |
| CP2 (Week 4) | Track A `any` elim + Track B RBAC + Track D F4+F7+F10 (Memify, Sessions, Agent Wiring) | All tests pass, routes validated, 26 agents routable from chat |
| CP3 (Week 6) | Track C server tests + Track D F3+F8 (Pipelines, RBAC) | >60% coverage, Cognee auth + access control enabled |
| CP4 (Week 8) | Track C client tests + Track D F9 (MCP Server) | E2E smoke tests pass, MCP tools accessible, all 10 Cognee features verified |

---

## 7. Success Criteria (Phase 2 Complete)

| Criterion | Metric | Verified By |
|-----------|--------|------------|
| Type safety | `noImplicitAny: true` in both tsconfigs, <70 total `any` occurrences | `grep -r ": any"` + `tsc --noEmit` |
| Input validation | 36/36 routes have Zod validation | `grep -rl "z.object" server/src/routes/ | wc -l` |
| Auth coverage | 36/36 routes have auth middleware | `grep -rl "requireAuth" server/src/routes/ | wc -l` |
| Test coverage | >60% line coverage, 30+ test files | `npm test -- --coverage` |
| Cognee security | `REQUIRE_AUTHENTICATION=true` AND `ENABLE_BACKEND_ACCESS_CONTROL=true` | docker-compose.yml |
| Agent accessibility | ALL 26 agents reachable from chat | Manual test: send categorize/gst/tax/payroll/invoice messages |
| Session memory | Chat maintains conversational context | Manual test: multi-turn conversation ("What about Q3?" resolves) |
| Cognee DataPoints | 10 Python Pydantic DataPoint models mounted | Cognify uses custom models for extraction |
| Cognee Ontology | OWL file for Australian finance deployed | `ontology_file_path` accepted by cognify |
| Cognee MCP Server | cognee-mcp service running, 11 tools exposed | Claude Code can use Cognee MCP tools |
| Cognee NodeSets | All data tagged with temporal/categorical/account NodeSets | Search scoped by NodeSet returns filtered results |
| DB type safety | wrapPgDb returns typed results | `grep "any" server/src/db-adapter.ts | wc -l` < 5 |
| Clean codebase | 0 console.log, 0 dead code files | `grep -r "console.log" server/src/` |
| Docker healthy | All 5 services start and pass health checks | `docker compose ps` |

---

## 8. Risk Mitigations

### Risk 1: `noImplicitAny` causes cascade of 500+ errors
**Mitigation**: Enable flag in `tsconfig.json` but add `// @ts-expect-error` temporarily for files not yet fixed. Foundation agent works through files systematically, removing `// @ts-expect-error` as types are fixed. This keeps the build passing throughout.

### Risk 2: Cognee auth enablement breaks all data access
**Mitigation**: Follow the phased approach in COGNEE_INTEGRATION_PLAN.md (C1a → C1b → C1c). If C1b breaks, rollback to C1a (auth on, access control off) — this is still an improvement.

### Risk 3: Agents step on each other's files
**Mitigation**: Strict file ownership (Section 5). Task system tracks who owns what. Shared files require task-based coordination.

### Risk 4: Test infrastructure doesn't match existing patterns
**Mitigation**: Test-infra agent must READ existing 14 test files before designing anything. Match existing patterns, don't introduce new test frameworks.

### Risk 5: 8-week timeline is optimistic
**Mitigation**: Tracks are prioritized. If time runs short:
1. Track A + B (type safety + security) = MUST HAVE
2. Track D (Cognee) = MUST HAVE (ALL 10 features F1-F10 are mandatory)
3. Track C (testing) = NICE TO HAVE (can be Phase 3 if time-constrained)

### Risk 6: Cognee feature implementation takes longer than planned
**Mitigation**: The 10 features (F1-F10) are sequenced by dependency and value. Weeks 1-4 deliver the highest-value features (DataPoints, Ontology, Search Types, Sessions, Agent Wiring). Even if weeks 7-8 slip, the system will have significant Cognee integration. There is NO exit criterion — all features are mandatory, but the sequencing ensures maximum value delivery at every checkpoint.

### Risk 7: `any` count (1,323 occurrences) is larger than expected
**Mitigation**: The financial-path-first sprint ordering (Section 2.1) ensures the most critical `any` types (BAS calculations, tax, accounts) are fixed first. Remaining `any` in non-financial paths (admin UI, market feeds, CDR crawler) can be tolerated or deferred to Phase 3.

---

## Appendix: Agent Spawn Sequence

The team lead should spawn agents in this order to minimize early conflicts:

```
Week 1:
  1. cleanup-agent (D2) — starts immediately, least conflict risk
  2. foundation-agent (A1) — starts on tsconfig flags
  3. security-agent (B1) — starts on Zod validation
  4. schema-agent (A2) — starts on db-adapter analysis
  5. cognee-agent (D1) — starts on Phase A (consolidation)

Week 3:
  6. test-infra-agent (C1) — after A/B have stabilized the codebase

Week 5:
  7. server-test-agent (C2) — after test infra is ready

Week 7:
  8. client-test-agent (C3) — after server tests prove the pattern
```

**Total parallel agents at peak**: 5 (weeks 1-2), then decreasing as tracks complete.
