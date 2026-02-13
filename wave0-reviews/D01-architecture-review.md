# D01: Architecture Devil's Advocate Review

**Agent**: D01 — Architecture Devil's Advocate
**Date**: 2026-02-12
**Scope**: Waves 11–24 architecture decisions, database, frontend, infrastructure, wave ordering

---

## 1. Agent Architecture — Challenges, Alternatives, Recommendations

### 1.1 Agent Proliferation: 11 → 26 Is Unsustainable

**Challenge**: The plan adds 15 new Claude agents across Waves 11–20, bringing the total from 11 to 26. Each agent has its own system prompt, tools, Cognee dataset integration, and model configuration. At 26 agents, the orchestrator becomes a maintenance liability, and costs scale linearly with each new domain.

**Evidence of over-agenting**:
- Wave 11: `inventory_agent` — COGS calculation and stock queries could be handled by extending `budget_analyzer` with inventory tools
- Wave 11: `bank_reconciler_agent` — enhances existing `account_reconciler`; why not just ADD tools to it?
- Wave 12: `asset_management_agent` — depreciation is a pure math service, not an LLM task
- Wave 12: `multi_entity_agent` — entity context routing is middleware logic, not agent logic
- Wave 13: `financial_reporting_agent` — report generation is deterministic SQL aggregation, not AI
- Wave 13: `budgeting_agent` — the existing `budget_analyzer` already does this
- Wave 15: `forecasting_agent` — time-series forecasting is better done with statistical libraries (Prophet, ARIMA) than LLMs
- Wave 23: `tenant_routing_agent` — tenant resolution is a middleware concern, not an AI agent

**Recommendation**: **Merge agents aggressively. Target ≤18 agents total.**

| Proposed Merge | From | Into | Rationale |
|---|---|---|---|
| bank_reconciler → account_reconciler | Wave 11 | Existing | Same domain, just add tools |
| budgeting_agent → budget_analyzer | Wave 13 | Existing | Nearly identical scope |
| multi_entity_agent → orchestrator middleware | Wave 12 | orchestrator.ts | Not an AI task |
| tenant_routing_agent → auth middleware | Wave 23 | Hono middleware | Not an AI task |
| forecasting_agent → statistical service | Wave 15 | New service (no LLM) | LLMs are bad at math |

**Keep as separate agents** (justified):
- `inventory_agent` (Wave 11) — domain-specific enough IF inventory is truly needed
- `asset_management_agent` (Wave 12) — IF depreciation advice (not just calculation) is needed
- `financial_reporting_agent` (Wave 13) — IF natural language report explanation is needed
- `ocr_processing_agent` (Wave 14) — uses Vision API, fundamentally different modality
- `payment_matching_agent` (Wave 14) — complex multi-signal matching benefits from reasoning
- `compliance_monitoring_agent` (Wave 15) — ATO ruling interpretation benefits from LLM
- `cdr_product_agent` (Wave 18) — product comparison with natural language benefits from LLM
- `market_intelligence_agent` (Wave 19) — market briefing generation benefits from LLM

### 1.2 Every New Agent Gets 2 Agents — Consider Single Composite Agent Per Wave

**Challenge**: Waves 11–15 each introduce exactly 2 agents per wave. This pattern feels mechanical rather than principled. Some waves pair a "data agent" with a "reasoning agent" when one agent with both tool sets would suffice.

**Recommendation**: For each wave, ask: "Can one agent with a unified tool set handle both domains?" If yes, ship one agent. The orchestrator can still route to it via the existing `invoke()` pattern.

### 1.3 Stateless `invoke()` vs Conversational Agents

**Challenge**: R05 research identified "single-turn only" as a HIGH limitation. None of the 14 wave plans address this. Every new agent is still stateless `invoke()`. For complex tasks (tax strategy, financial planning, reconciliation), multi-turn dialogue would dramatically improve quality.

**Recommendation**: Wave 21's Vercel AI SDK migration SHOULD include session support for at least 3 conversational agents:
1. `tax_strategy` — multi-turn tax planning with follow-up questions
2. `financial_planner` — progressive wealth planning with scenario refinement
3. `compliance_monitoring_agent` — interactive compliance Q&A

Don't wait for Wave 21 — design the session schema in Wave 11 and retrofit conversation support during Wave 21.

### 1.4 No Agent Deprecation Strategy

**Challenge**: With 26 agents, some will inevitably become low-usage or redundant. There is no plan for deprecating, disabling, or consolidating agents over time.

**Recommendation**: Wave 20 (Admin Dashboard) should include an agent usage analytics view showing:
- Invocations per agent per week
- Token cost per agent per month
- Success/error rate per agent
- Auto-flag agents with <10 invocations/month for consolidation review

### 1.5 Tool Duplication Across Agents

**Challenge**: Multiple agents have overlapping Cognee search tools (`search_cognee`, `search_financial_context`, `search_similar_transactions`, `search_historical_patterns`). These are essentially the same function with different dataset filtering.

**Recommendation**: Create a **unified Cognee search tool** that accepts a `domain` parameter and delegates to the appropriate datasets. Register it once in cognee-tools.ts and share across all agents. This reduces tool definition bloat from ~60 tools to ~40.

---

## 2. Database Architecture — Challenges, Alternatives, Recommendations

### 2.1 CRITICAL: Dual-Schema Must Die

**Challenge**: R08 research found 25 tables in SQLite but MISSING from PostgreSQL Drizzle, 6 missing columns on `transactions`, and `wrapPgDb()` returning `any`. The wave plans perpetuate this by requiring every new table in BOTH `schema.ts` AND `postgres-schema.ts`. Over 14 waves, this adds ~90 new tables — maintaining dual definitions for 135+ tables is untenable.

**The `wrapPgDb()` proxy is architectural debt that compounds with every wave.**

**Recommendation**: **Drop SQLite support entirely. Go PostgreSQL-only before Wave 11.**

Justification:
- Docker is the only deployment target (no SQLite in production)
- Cognee already requires PostgreSQL (pgvector)
- Redis already requires Docker
- Every developer runs Docker anyway
- `wrapPgDb()` returns `any` — all type safety is lost at runtime
- Maintaining dual schemas for 135+ tables is unsustainable
- SQLite doesn't support concurrent access (critical for Wave 20 admin dashboard)

Migration path:
1. Create `0013_drop_sqlite.sql` — final sync migration
2. Delete `schema.ts` (or keep as documentation)
3. Move all table definitions to `postgres-schema.ts` using `pgTable()`
4. Replace `wrapPgDb()` with proper Drizzle PG queries
5. Add a `.env.local` with `DATABASE_URL=postgresql://...` for local dev

### 2.2 Table Explosion: 47 → 135+ Tables

**Challenge**: Starting from 47 tables, the wave plans add:
| Wave | New Tables | Running Total |
|------|-----------|---------------|
| 11 | 7 | 54 |
| 12 | 10 | 64 |
| 13 | 8 | 72 |
| 14 | 5 | 77 |
| 15 | 6 | 83 |
| 16 | 3 | 86 |
| 17 | 4 | 90 |
| 18 | 9 | 99 |
| 19 | 6 | 105 |
| 20 | 7 | 112 |
| 21 | 3 | 115 |
| 22 | 2 | 117 |
| 23 | 8 | 125 |
| 24 | 3 | 128 |

**128 tables for what started as a bank statement parser.** This is a legitimate ERP system's table count. The complexity budget is being spent freely.

**Recommendation**: Challenge whether every table is necessary:
- **Wave 16**: `datapoint_configs`, `graph_schemas`, `cognee_feedback` — these are Cognee's responsibility, not ours. Use Cognee's own configuration API instead of duplicating state in our DB.
- **Wave 17**: `temporal_queries`, `cross_module_insights`, `module_connections` — `temporal_queries` is a query cache (use Redis), `module_connections` is static config (use a JSON file), reduce to 1 table.
- **Wave 22**: `dashboard_layouts`, `saved_charts` — these could be a single `user_preferences` JSON blob on the `users` table.
- **Wave 21**: `agent_stream_sessions`, `structured_output_schemas`, `agent_migration_status` — `agent_migration_status` is a one-time migration tracker (use a JSON file or feature flag).

**Target: ≤110 tables** by eliminating Redis-cacheable, config-file-appropriate, and Cognee-delegatable tables.

### 2.3 Missing Foreign Key Discipline

**Challenge**: The wave plans specify column lists but rarely mention foreign key constraints, cascading deletes, or CHECK constraints. For an accounting system, referential integrity is non-negotiable.

**Recommendation**: Establish and enforce a migration template:
```sql
-- Every migration MUST include:
-- 1. FOREIGN KEY with ON DELETE CASCADE or RESTRICT (never SET NULL for financial data)
-- 2. CHECK constraints for enums (e.g., CHECK(status IN ('active','disposed','written_off')))
-- 3. NOT NULL on all required columns
-- 4. INDEX on all foreign keys + frequently-queried columns
-- 5. UNIQUE constraints where applicable
```

### 2.4 No Data Retention or Archival Strategy

**Challenge**: With 128 tables accumulating financial data over years, there is no plan for:
- Data retention policies (how long to keep audit trails, agent execution logs)
- Archival (moving old data to cold storage)
- Partitioning (large tables like `transactions`, `agent_executions`)
- Soft delete vs hard delete conventions

**Recommendation**: Add a data lifecycle policy:
- `transactions`: Partition by financial year (PostgreSQL range partitioning)
- `agent_executions` (Wave 20): Retain 90 days, archive to cold storage
- `audit_log`: Retain 7 years (ATO requirement)
- `system_metrics` (Wave 20): Retain 30 days, aggregate monthly

### 2.5 Migration Numbering Collision Risk

**Challenge**: R08 proposes migrations starting at 0013. Wave plans use 0023–0036. But the existing codebase already has 0009–0012. If Wave plans assume prior waves completed their migrations, any reordering or parallelization breaks the sequence.

**Recommendation**: Switch to **timestamped migrations** (e.g., `20260215_001_inventory.sql`) or use Drizzle's built-in `drizzle-kit push` / `drizzle-kit generate` for schema-driven migrations rather than hand-written SQL.

---

## 3. Frontend Architecture — Challenges, Alternatives, Recommendations

### 3.1 CRITICAL: 15+ Tabs in BottomNavigation Is Not Viable

**Challenge**: The current app uses `BottomNavigation.tsx` with tabs. Waves 11–24 add the following new navigation items:
- Wave 11: `inventory`, `reconciliation`
- Wave 12: `assets`, `entities`
- Wave 13: `reports`, `budgets`
- Wave 14: `documents`
- Wave 15: `compliance`
- Wave 16: `knowledge`
- Wave 17: `intelligence`
- Wave 18: `banking-products`
- Wave 19: `market`
- Wave 22: `dashboards`

That's **12 new navigation items** on top of the existing ~8. **20+ tabs in a bottom navigation bar is unusable.**

**Current recognition**: Wave 24 plans to replace BottomNavigation with sidebar + router. **This is far too late.** By Wave 24, 13 waves will have built UI components targeting a tab system that gets ripped out.

**Recommendation**: **Move the sidebar navigation + React Router migration to Wave 11 (first wave).** This is a prerequisite, not a capstone. Every subsequent wave will benefit from URL-based routing (deep linking, bookmarkable states, browser back/forward).

Concrete plan:
1. Wave 11 Agent 1 (currently schema-builder) should be replaced with a **navigation-refactor agent**
2. Install `react-router-dom` and create route definitions for all existing and planned features
3. Replace `BottomNavigation` with a collapsible sidebar grouped by domain:
   - **Core**: Transactions, Statements, Accounts
   - **Tax & Compliance**: BAS, GST, Tax, Compliance
   - **Business**: Invoices, Bills, Inventory, Assets, Entities
   - **Analytics**: Reports, Budgets, Forecasts, Dashboards
   - **Banking**: Products, Loans, Market
   - **AI**: Chat, Knowledge, Intelligence
   - **Admin**: (separate `/admin` route)
4. All subsequent waves add their features as new routes, not new tabs

### 3.2 Feature-Folder Explosion: 20+ Folders

**Challenge**: Each wave creates 1-2 new feature folders under `client/src/features/`. By Wave 24, there will be ~25 feature folders. This is structurally fine (feature folders scale well), but the concern is **cross-feature component sharing**.

**Evidence of sharing problems**:
- Wave 22 creates `client/src/components/charts/` — a shared component library. But this should exist BEFORE Waves 13-19 which all need charts.
- Wave 16 creates `KnowledgeGraphExplorer.tsx` with three.js. Wave 20 creates `CogneeGraphViewer.tsx` with three.js. These are the same component built twice.
- Wave 24 creates `ResponsiveContainer.tsx`. Every prior wave's components need this.

**Recommendation**: Create a **shared component library wave** that runs BEFORE Wave 11:
- `components/charts/` — Recharts components (currently Wave 22)
- `components/layout/` — Responsive containers, grid systems (currently Wave 24)
- `components/data-display/` — Tables, cards, status badges (shared patterns)
- `components/3d/` — Three.js graph viewer (used in Waves 16, 20)

### 3.3 Admin Panel as Separate App vs Route

**Challenge**: Wave 20 proposes admin as a `/admin` route within the same SPA. This means:
- Admin bundle is shipped to all users (security concern)
- Admin components inflate the main bundle size
- No separate deployment/access control

**Recommendation**: **Keep admin as a separate route** (not a separate app) but use React lazy loading to code-split the admin bundle:
```tsx
const AdminLayout = React.lazy(() => import('./features/admin/AdminLayout'));
```
This gives URL-based access control without the overhead of a separate build pipeline.

### 3.4 No State Management Strategy

**Challenge**: The current app uses React context (SSEContext) and local state. With 25+ feature modules, some with cross-module data dependencies (e.g., entity context, tenant context, subscription limits), there is no plan for global state management.

**Recommendation**: Adopt **TanStack Query (React Query)** for server state management. It's already a natural fit since TanStack Table is in use. Benefits:
- Automatic caching, deduplication, and background refetch
- No need for Redux/Zustand for server state
- Works perfectly with the existing API pattern

For client-only state (entity context, tenant context, UI preferences), keep React Context — but define them early (Wave 11, not Wave 23).

### 3.5 Chat Widget vs Agent Workspace

**Challenge**: The current chat widget handles all agent interactions through a single text input. With 26 agents, the orchestrator must infer which agent to route to from natural language. This becomes increasingly unreliable as agent count grows.

**Recommendation**: Evolve the chat into an **Agent Workspace** (Wave 17 or 20):
- Sidebar with agent type selection (like selecting a ChatGPT custom GPT)
- Persistent conversation threads per agent (requires session support)
- Quick-action buttons for common queries per agent
- Visual results embedded in chat (charts, tables, not just text)

---

## 4. Infrastructure — Challenges, Alternatives, Recommendations

### 4.1 Docker-Local Sustainability

**Challenge**: The current architecture runs everything on a single Docker host: PostgreSQL, Redis, Cognee, server, and client. Waves 18-19 add CDR crawlers and market data feeds that run on schedules. Wave 20 adds system monitoring. By Wave 24, this single Docker host runs:
- PostgreSQL with 128+ tables and pgvector
- Redis for caching and rate limiting
- Cognee with 25+ datasets, Kuzu graph DB, and LLM calls
- Node.js server with 26 agents making Anthropic API calls
- Nginx serving the React SPA
- Scheduled crawlers (CDR, RBA, ABS, market prices, sentiment)
- Background workers (OCR processing, Cognee indexing)

**This is fine for development and small-scale deployment**, but it's not production-ready for multiple tenants (Wave 23).

**Recommendation**: The architecture is acceptable for Waves 11-22 (single-user/small-team). For Wave 23 (multi-tenant), a real infrastructure decision is needed. Options:
1. **Keep single-host** but add proper resource limits in docker-compose (memory, CPU per service)
2. **Split to 2 hosts**: App stack (server + client + Redis) + Data stack (PostgreSQL + Cognee)
3. **Cloud-managed services**: RDS for PostgreSQL, ElastiCache for Redis, ECS/Cloud Run for app

Defer this decision until Wave 22 — it's premature to architect for scale before the feature set stabilizes.

### 4.2 Cognee/Kuzu Performance for 3D Graph Visualization

**Challenge**: Wave 16 and Wave 20 both plan 3D graph visualization of Cognee's knowledge graph. Kuzu is an embedded graph database designed for analytical queries. Rendering 1000+ nodes in three.js (Wave 20's testing criteria) requires fast graph traversal and serialization.

**Concerns**:
- Cognee's graph API (`/v1/datasets/{name}/graph`) returns the full graph — no pagination or filtering
- Kuzu's query performance for large graphs hasn't been benchmarked
- three.js with 1000+ nodes requires GPU acceleration — won't work well in Docker desktop browsers via VNC

**Recommendation**:
- **Do NOT switch to Neo4j** — Kuzu is embedded in Cognee and switching would require forking Cognee
- Instead, add **server-side graph pagination** to the Cognee client: return nodes within N hops of a seed node
- Use **3d-force-graph** (WebGL) with progressive loading: render core nodes first, expand on click
- Set realistic testing criteria: 500 nodes at 30fps, not 1000 at 60fps

### 4.3 Redis as Ghost Service

**Challenge**: Redis is declared in docker-compose but R01 research and Wave 17 both note it's been a "ghost service" — declared but largely unused. Wave 17 plans to activate it for Cognee session caching. Meanwhile, Waves 20 (rate limiting), 23 (rate limits per tenant), and 24 (PWA offline sync) all assume Redis is available.

**Recommendation**: **Wire Redis properly in Wave 11** as a foundation:
- Rate limiting middleware (already planned, just not wired)
- API response caching (5-minute TTL for analytics endpoints)
- Agent result caching (same query within 60s returns cached result)

This gives immediate performance benefits and validates Redis before it's load-bearing in later waves.

### 4.4 No Background Job System

**Challenge**: Multiple waves need scheduled/background work:
- Wave 14: OCR document processing queue
- Wave 18: CDR crawl pipeline (2 req/s rate limited)
- Wave 19: Market data refresh (hourly/daily)
- Wave 24: Offline sync conflict resolution

The current `queue.ts` is a simple in-memory state machine for batch uploads. It doesn't support scheduled jobs, retries with backoff, or distributed workers.

**Recommendation**: Adopt **BullMQ** (Redis-backed job queue) as the standard background job system. Install in Wave 11, use for:
- Wave 11: Bank reconciliation auto-matching (background)
- Wave 14: OCR document queue (replaces custom `document_queue` table)
- Wave 18: CDR crawl scheduling
- Wave 19: Market data refresh scheduling

This eliminates the need for `document_queue`, `cdr_crawl_log` (as job state), and custom scheduler services.

---

## 5. Integration & Ordering — Reordering Suggestions

### 5.1 Current Wave Order vs Proposed Reordering

| Current Order | Proposed Order | Rationale |
|---|---|---|
| Wave 11: Inventory & Recon | **Wave 11: Navigation Refactor + Foundation** | Sidebar nav, React Router, Redis wiring, chart library — prerequisites for ALL subsequent waves |
| Wave 12: Assets & Entities | **Wave 12: Inventory & Bank Reconciliation** | Core accounting feature |
| Wave 13: Reports & Budgets | **Wave 13: Fixed Assets & Multi-Entity** | Multi-entity needed before reports |
| Wave 14: OCR & Matching | **Wave 14: Financial Reporting & Budgeting** | Reports before OCR |
| Wave 15: Predictions & Compliance | **Wave 15: OCR & Payment Matching** | Natural next step after reports |
| Wave 16: Custom DataPoints | **Wave 16: Predictive Analytics & Compliance** | Compliance is more urgent than Cognee DataPoints |
| Wave 17: Temporal Queries | **Wave 17: Advanced Visualizations (Recharts)** | Charts should come BEFORE Wave 18-19 which need them |
| Wave 18: CDR Open Banking | **Wave 18: CDR Open Banking** | Keep — external API integration |
| Wave 19: Market Intelligence | **Wave 19: Market Intelligence** | Keep — builds on CDR |
| Wave 20: Admin Dashboard | **Wave 20: Admin Dashboard** | Keep — monitoring/management |
| Wave 21: Vercel AI SDK | **Wave 21: Vercel AI SDK Migration** | Keep — framework upgrade |
| Wave 22: Visualizations | **Wave 22: Custom DataPoints & Temporal Queries** | Merge Waves 16+17 after charts exist |
| Wave 23: Multi-Tenant | **Wave 23: Multi-Tenant & Access Control** | Keep — near-end |
| Wave 24: Mobile PWA | **Wave 24: Mobile PWA** | Keep — capstone |

### 5.2 Key Reordering Justifications

1. **Navigation refactor (new Wave 11)**: Every subsequent wave adds navigation items. Building on a tab system that gets replaced in Wave 24 is wasteful. Do it first.

2. **Charts (move from Wave 22 to Wave 17)**: Waves 13 (reports), 15 (forecasting), 19 (market) all build dashboards that need charts. Installing Recharts in Wave 22 means 5 prior waves build chart-less dashboards that get retrofitted. Move chart library installation to Wave 17 (or ideally the new Wave 11 foundation).

3. **Admin (Wave 20) could move earlier**: The user explicitly requested admin. However, admin benefits from monitoring all the agents and modules that exist, so keeping it at Wave 20 (after most features are built) is actually correct. The alternative is a minimal admin shell in Wave 13 that grows.

4. **Merge Waves 16+17**: Custom DataPoints (Wave 16) and Temporal Queries (Wave 17) are both Cognee-enhancement waves with no new agents. They can be a single wave with 6-7 agents instead of 20 across two waves. This saves significant API cost and coordination overhead.

### 5.3 Parallelization Opportunities

Several waves have NO actual dependency between them:
- **Wave 14 (OCR) || Wave 15 (Compliance)**: OCR doesn't need compliance; compliance doesn't need OCR. These can run in parallel.
- **Wave 18 (CDR) || Wave 19 (Market Intelligence)**: Both are external data integrations with no cross-dependency. Can run in parallel.
- **Wave 22 (Visualizations) || Wave 21 (Vercel AI SDK)**: Frontend-only (charts) vs backend-only (agent framework). No overlap. Can run in parallel.

**Recommendation**: Run these as parallel pairs to compress the overall timeline from 14 sequential waves to ~10 sequential stages.

### 5.4 Hidden Dependencies

| Dependency | Source | Target | Issue |
|---|---|---|---|
| Entity context | Wave 12 (entities) | Waves 13-24 (all entity-scoped features) | Every subsequent wave must support entity-scoping — this is a cross-cutting concern that should be a middleware pattern, not per-feature code |
| Cognee datasets | Every wave | Cognee service | If Cognee goes down, ALL waves' knowledge features fail. Need a graceful degradation strategy (already partially solved by USE_COGNEE flag) |
| index.ts growth | Every wave adds endpoints | server/src/index.ts | At 130 endpoints now, projecting to ~350. This file will be 10,000+ lines. MUST be split into route modules |
| Token costs | Waves 11-20 add agents | Anthropic API billing | 26 agents × concurrent users = significant API cost. No budgeting or cost alerting in any wave plan |

---

## 6. Critical Issues — Showstoppers

### 6.1 SHOWSTOPPER: `server/src/index.ts` Will Become Unmaintainable

**Current state**: ~4,680 lines, ~130 endpoints, all in one file.
**Projected**: ~350+ endpoints, ~12,000+ lines after Wave 24.

**This is the single highest-risk architectural issue in the entire plan.**

**Recommendation**: **Before Wave 11, refactor index.ts into route modules:**
```
server/src/routes/
  auth.ts           // /api/auth/*
  transactions.ts   // /api/transactions/*
  statements.ts     // /api/statements/*
  bas.ts            // /api/bas/*
  gst.ts            // /api/gst/*
  tax.ts            // /api/tax/*
  agents.ts         // /api/agents/* (already partially exists)
  analytics.ts      // /api/analytics/*
  loans.ts          // /api/loans/*
  payroll.ts        // /api/payroll/*
  transfers.ts      // /api/transfers/*
  economic.ts       // /api/economic/*
  admin.ts          // /api/admin/*
  // Wave 11+:
  inventory.ts      // /api/inventory/*
  recon.ts          // /api/recon/*
  // etc.
```

Hono supports this with `app.route('/api/auth', authRoutes)`. This is a ~2-day refactor that pays back immediately.

### 6.2 SHOWSTOPPER: No Testing Strategy Across 14 Waves

**Challenge**: Every wave plan lists testing criteria as checkboxes (e.g., "tsc --noEmit passes clean"), but there is:
- No unit test framework configured
- No integration test framework configured
- No E2E test framework configured
- No CI/CD pipeline
- No test coverage requirements
- "tsc --noEmit passes clean" is TYPE checking, not TESTING

For an **accounting application** where financial accuracy is legally important, this is a critical gap.

**Recommendation**: **Add a Wave 10.5 or make testing part of Wave 11's foundation:**
1. Install Vitest for unit/integration tests
2. Install Playwright for E2E tests
3. Require each wave to ship with:
   - Unit tests for all service functions (especially financial calculations)
   - Integration tests for API endpoints
   - At least 2 E2E tests per new feature module
4. Add `vitest run` and `playwright test` to the testing criteria

### 6.3 CRITICAL: API Cost Projection

**Challenge**: 26 agents making Anthropic API calls, some using Sonnet 4.5 (expensive), with no per-user or per-tenant cost controls:

| Agent Tier | Model | Cost/1K input | Cost/1K output | Agents |
|---|---|---|---|---|
| Complex | Sonnet 4.5 | $3/M | $15/M | 12 |
| Simple | Haiku 4.5 | $0.80/M | $4/M | 14 |

With multi-tenant (Wave 23), one heavy user could run up thousands of dollars in API costs.

**Recommendation**:
1. Add per-user daily token budget (enforce in orchestrator.ts)
2. Add per-tenant monthly cost caps (enforce in Wave 23 subscription tiers)
3. Cache frequent agent responses in Redis (e.g., same BAS calculation within a quarter)
4. Use Haiku for ALL agents that don't genuinely need Sonnet's reasoning

---

## 7. Approved Decisions — Sound Architecture Choices

### 7.1 Vercel AI SDK Hybrid Migration (Wave 21) ✅

The R05 research is excellent. The hybrid approach (keep ClaudeAgent base, adopt Vercel AI SDK for streaming + structured output) is the right call. The alternative of full Claude Agent SDK migration would be wasteful. **Approved as-is.**

### 7.2 Custom ClaudeAgent<TInput, TOutput> Framework ✅

The existing agent framework is well-designed: generics, typed I/O, circuit breakers, token budgets, per-agent model selection. It's lean (~2,500 LOC) and does exactly what's needed. **Do not replace it — enhance it.**

### 7.3 Cognee as Knowledge Layer ✅

Using Cognee for knowledge graph storage, vector search, and graph reasoning is architecturally sound. The smart search type selection (CHUNKS for similarity, CHUNKS_LEXICAL for keywords, GRAPH_COMPLETION for reasoning) is well-thought-out. **Approved.**

### 7.4 CDR Open Banking via Public PRD API (Wave 18) ✅

Using the unauthenticated CDR Product Reference Data API for loan comparison is clever — no consent flow needed, 121+ data holders, real rate data. The 2 req/s rate limiting strategy is correct. **Approved as-is.**

### 7.5 Recharts for Chart Library (Wave 22) ✅

Recharts over D3 (too low-level), Chart.js (less React-native), or Victory (less community) is the right choice. Lightweight, declarative, good TypeScript support. **Approved — but move it earlier in the wave order.**

### 7.6 10-Agent Team Structure Per Wave ✅

The sub-wave execution pattern (schema → service → agent → API → UI → testing) with explicit dependency ordering is well-designed for parallel execution. File locks prevent merge conflicts. **Approved as-is.**

### 7.7 Workbox for PWA (Wave 24) ✅

Workbox is the standard PWA toolkit. Cache-first for static, network-first for API, IndexedDB for offline storage. **Approved as-is.**

### 7.8 BullMQ NOT Included — Redis Queue Pattern

The absence of a formal job queue is a gap (noted in 4.4), but the wave plans' approach of using PostgreSQL tables for job state is acceptable for the scale. BullMQ is a nice-to-have, not a requirement. **Acceptable.**

---

## Summary of Recommendations

| # | Priority | Recommendation | Waves Affected |
|---|----------|---------------|----------------|
| 1 | **P0** | Refactor index.ts into route modules BEFORE Wave 11 | All |
| 2 | **P0** | Drop SQLite, go PostgreSQL-only | All |
| 3 | **P0** | Add testing framework (Vitest + Playwright) | All |
| 4 | **P0** | Move navigation refactor (sidebar + React Router) to Wave 11 | 11-24 |
| 5 | **P1** | Merge agents: target ≤18, not 26 | 11-15, 23 |
| 6 | **P1** | Move chart library (Recharts) installation to Wave 11 foundation | 13-22 |
| 7 | **P1** | Wire Redis properly in Wave 11 | 11-24 |
| 8 | **P1** | Add API cost budgeting per user/tenant | 11-23 |
| 9 | **P2** | Merge Waves 16+17 (Cognee enhancements) | 16-17 |
| 10 | **P2** | Parallelize Waves 14||15 and 18||19 | 14-15, 18-19 |
| 11 | **P2** | Add data retention policies | 15, 20 |
| 12 | **P2** | Use timestamped migrations instead of sequential numbering | All |
| 13 | **P3** | Evolve chat into Agent Workspace | 17 or 20 |
| 14 | **P3** | Add BullMQ for background jobs | 14, 18, 19 |
