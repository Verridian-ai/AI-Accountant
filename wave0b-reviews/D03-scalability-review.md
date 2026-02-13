# D03: Scalability & Performance Review — Waves 1-10

**Reviewer**: D03 — Scalability & Performance Specialist
**Date**: 2026-02-13
**Scope**: Wave 1 (Chat→Agent Bridge) through Wave 10 (Accounts Payable)
**Status**: Complete

---

## Executive Summary

Waves 1-10 introduce significant architectural complexity: intent routing via LLM, SSE streaming, Cognee multi-user isolation, full Australian payroll (PAYG/Super/STP), invoicing (recurring + Stripe payments), and accounts payable with three-way matching. The plans are generally well-structured with good index discipline, monetary-in-cents convention, and Zod validation mandates. However, I identify **7 HIGH-severity bottlenecks**, **9 MEDIUM-severity concerns**, and **8 LOW-severity optimization opportunities** that must be addressed before or during implementation.

The most critical issues are: (1) SSE streaming architecture will not scale beyond ~100 concurrent users without Redis pub/sub, (2) Wave 1's intent router adds 200-500ms latency per chat message via Haiku classification, (3) Cognee multi-user dataset proliferation will degrade search performance, and (4) Wave 5's pay run processing is row-by-row without explicit batch transaction handling.

---

## 1. Performance Bottlenecks (HIGH Severity)

### B1: SSE Streaming Architecture — Single-Process EventEmitter (Wave 2)

**Severity**: HIGH | **Impact**: System-wide | **Risk**: Connection exhaustion

**Current state**: The existing SSE implementation (`events.ts`) uses a **Node.js in-process `EventEmitter`** with `setMaxListeners(100)`. Wave 2 explicitly states it will use this same pattern for the new `/api/chat/stream` endpoint (line 175: "Uses Node.js EventEmitter — NOT Redis pub/sub yet").

**Problems**:
1. **Connection limit**: Each SSE connection holds an open HTTP connection. Node.js defaults to ~1000 concurrent sockets. With `setMaxListeners(100)`, the EventEmitter itself warns at 100 listeners. Each browser tab opens 1 SSE connection, so 100 concurrent tabs = limit reached.
2. **No horizontal scaling**: EventEmitter is in-process only. If the server ever scales to multiple instances (Docker replicas, load balancer), SSE events from one instance are invisible to clients connected to another.
3. **Memory leak risk**: Each SSE connection attaches a listener and holds a reference to the Hono `stream` object. If clients disconnect ungracefully (network drops, mobile sleep), the `onAbort` handler may not fire immediately, leaving zombie listeners.
4. **No backpressure**: The current implementation writes to all listeners synchronously. A slow client (poor network) blocks `stream.write()`, which could stall event delivery to all other listeners sharing the event loop tick.

**Wave 2 specifics**: Adding a *second* SSE endpoint (`/api/chat/stream`) doubles the connection count per user (one for pipeline events, one for chat streaming). The mutation confirmation flow requires the SSE channel to be alive for the 15-minute TTL window.

**Recommendations**:
- Add `X-Accel-Buffering: no` header to the `/api/chat/stream` nginx location (currently only `/api/events` has `proxy_buffering off`, but no `X-Accel-Buffering` header on either).
- Add a new nginx location block for `/api/chat/stream` with identical SSE proxy settings as `/api/events`.
- Increase `setMaxListeners` to at least 500 or use `EventEmitter({ captureRejections: true })`.
- Implement per-connection write timeout (5s) — if `stream.write()` doesn't complete, disconnect that client.
- Plan for Redis pub/sub migration: Wave 2 should use an **abstraction layer** (`EventBus` interface with `emit()`, `subscribe()`, `unsubscribe()`) so the Redis pub/sub upgrade (planned for Wave 17/21) is a drop-in replacement.

---

### B2: Intent Router Latency — Haiku Call Per Chat Message (Wave 1)

**Severity**: HIGH | **Impact**: Chat UX | **Risk**: 200-500ms added latency

**Current state**: Wave 1 introduces an IntentRouter that classifies *every* chat message using Haiku. This means each user message goes through:
1. IntentRouter → Haiku API call (200-500ms including network)
2. AgentDispatcher → Primary agent invocation (500-2000ms for Sonnet agents)
3. ResponseFormatter → Format response (5-10ms)

**Problems**:
1. **Serial latency**: The total chat latency is `Haiku_classification + Agent_execution + Formatting`. For a Sonnet agent, this is 700ms-2500ms minimum. Users expect chat responses within 1-2 seconds.
2. **No caching**: Identical or similar queries ("What's my GST?" asked 3 times) each trigger a fresh Haiku classification call. There's no mention of caching intent classifications.
3. **No timeout budget**: The plan doesn't specify a latency budget for classification. What if Haiku is slow (API rate limit, cold start)?
4. **Multi-agent overhead**: For `multi_agent` intents, the dispatcher runs agents sequentially with result chaining. A 3-agent pipeline = 1500-6000ms.

**Recommendations**:
- **Cache intent classifications**: Hash the query (normalized lowercase, stop words removed) and cache the `IntentClassification` result in Redis with a 60-second TTL. Many users ask similar questions.
- **Set a classification timeout**: 2 seconds max for Haiku classification. If exceeded, fall back to keyword-based routing (regex patterns for known agent categories like "GST", "BAS", "payroll", "invoice").
- **Parallel agent execution**: For `multi_agent` intents where agents don't depend on each other's output, dispatch in parallel with `Promise.all()` rather than sequentially.
- **Pre-classify common patterns**: Build a lookup table of high-confidence patterns (e.g., "calculate BAS" → `gst_calculator`, "list employees" → `payroll_agent`) that bypass Haiku entirely. Only use Haiku for ambiguous queries.

---

### B3: Cognee Multi-User Dataset Proliferation (Wave 3)

**Severity**: HIGH | **Impact**: Cognee performance | **Risk**: Exponential dataset growth

**Current state**: Wave 3 introduces per-user dataset prefixing: `user_{userId}_bank_transactions`, `user_{userId}_financial_insights`, etc. The current system has 27 datasets. After Wave 10, there are ~35 dataset templates.

**Problems**:
1. **Dataset explosion**: With 100 users × 35 datasets = 3,500 Cognee datasets. With 1000 users = 35,000 datasets. Cognee stores metadata for each dataset in PostgreSQL and maintains vector indexes per dataset. This does not scale linearly.
2. **No documented Cognee dataset limits**: The plan doesn't mention what happens when Cognee manages thousands of datasets. Each dataset creates its own pgvector index partition, consuming memory.
3. **Cross-user search impossible**: Some queries benefit from shared data (e.g., "typical GST treatment for office supplies"). Per-user isolation prevents cross-referencing patterns from other users.
4. **Re-indexing cost**: Wave 3's `/api/cognee/reindex` endpoint re-indexes ALL datasets for a user. With 35 datasets and 10K+ documents each, this could take hours.
5. **pgvector memory pressure**: Each vector index (1536-dim, text-embedding-3-small) consumes ~6KB per vector. 1000 users × 1000 vectors per dataset × 35 datasets = 35M vectors = ~210GB of vector storage. This exceeds typical PostgreSQL memory.

**Recommendations**:
- **Shared + private datasets**: Use a two-tier strategy. Shared datasets (GST rules, ATO rulings, award rates) are global and read-only. Private datasets (transactions, employees, invoices) are per-user prefixed. This reduces the multiplier from 35× to ~20× per user.
- **Lazy dataset creation**: Don't pre-create all 35 datasets per user. Create only when a user first interacts with a feature (e.g., `pay_run_history` only created when user runs their first pay run).
- **Dataset archival**: For inactive users (no activity > 90 days), archive their datasets (drop vector indexes, keep raw data in PostgreSQL). Rebuild indexes on next login.
- **Document count limits per dataset**: Cap at 10,000 documents per dataset. Older documents get archived (kept in DB but removed from vector index).
- **Batch reindex**: `/api/cognee/reindex` should queue a background job, not block the HTTP response. Use the existing Redis queue pattern.

---

### B4: Pay Run Calculation — No Transaction Batching (Wave 5)

**Severity**: HIGH | **Impact**: Payroll processing | **Risk**: Timeout for 100+ employees

**Current state**: Wave 5's pay run engine processes employees individually. The plan mentions `PAY_RUN_BATCH_SIZE=100` as an env var but doesn't detail how batch processing works. The PAYG calculation, super calculation, and leave accrual are separate service calls per employee.

**Problems**:
1. **Row-by-row DB inserts**: Creating `pay_run_lines` and `pay_run_summary` one row at a time for 100 employees with ~5 pay categories each = 500+ individual INSERT statements. At 2ms per insert = 1 second minimum, plus PAYG/super calculations.
2. **No database transaction wrapping**: The plan doesn't mention wrapping the entire pay run in a single database transaction. If the server crashes mid-processing, you get a half-processed pay run with no rollback.
3. **Leave balance updates**: Each employee's leave balance update is a separate SELECT + UPDATE. For 100 employees = 200 queries just for leave.
4. **STP event generation (Wave 6)**: Generating STP XML for a pay run iterates all employees again, querying YTD totals. This is another O(n) pass.

**Recommendations**:
- **Batch INSERT**: Use Drizzle's batch insert (`db.insert(payRunLines).values([...array])`) instead of individual inserts.
- **Single transaction**: Wrap the entire pay run (lines + summary + leave updates) in a single PostgreSQL transaction. Rollback on any failure.
- **Pre-compute in memory**: Load all employees + pay structures in a single query, compute PAYG/super in memory, then batch-write results.
- **Configurable batch size**: The `PAY_RUN_BATCH_SIZE=100` should chunk processing into groups of 100 employees per transaction batch, not limit total employees.
- **Background processing**: Pay runs for 50+ employees should be queued as background jobs via Redis, with SSE progress events. The HTTP endpoint should return 202 Accepted immediately.

---

### B5: Three-Way Matching Query Complexity (Wave 10)

**Severity**: HIGH | **Impact**: AP workflow | **Risk**: O(n²) matching

**Current state**: Wave 10's three-way matching compares PO lines ↔ receipt lines ↔ bill lines. The matching logic checks quantities, prices, and amounts with tolerance thresholds.

**Problems**:
1. **Nested joins**: A three-way match requires joining `purchase_orders` → `po_lines` → `po_receipt_lines` → `po_receipts` → `bills` → `bill_lines`. This is a 6-table join.
2. **No matching index**: The plan specifies indexes on `po_lines(purchase_order_id)` but not on `po_receipt_lines(po_line_id)` — this is the critical join column for three-way matching.
3. **Discrepancy scanning**: Checking ALL unmatched PO-receipt-bill combinations for discrepancies is O(n × m × k) where n=PO lines, m=receipt lines, k=bill lines.
4. **Batch payment runs**: `supplier_payment_runs` group multiple bills. Loading all bills for a payment run with their full three-way match status requires many sub-queries.

**Recommendations**:
- **Add missing index**: `po_receipt_lines(po_line_id)` index is essential for three-way match joins.
- **Materialized match view**: Create a database view or materialized query that pre-joins the three-way match columns. Refresh on receipt or bill creation.
- **Match on write**: Perform three-way matching when a receipt or bill is created (event-driven), not on query. Store the match result in a `match_status` column on `bills`.
- **Limit batch payment size**: Default cap at 50 bills per payment run to keep query size manageable.

---

### B6: index.ts Monolith — 5000+ Lines with 270+ Endpoints (Waves 1-10 collectively)

**Severity**: HIGH | **Impact**: Server startup, DX, maintenance | **Risk**: Degrading route matching

**Current state**: `server/src/index.ts` is already 5000+ lines with 254 endpoints. Waves 1-10 add approximately 127 new endpoints:
- Wave 1: +9 endpoints
- Wave 2: +6 endpoints
- Wave 3: +4 endpoints
- Wave 4: +15 endpoints
- Wave 5: +15 endpoints
- Wave 6: +18 endpoints
- Wave 7: +17 endpoints (in separate route file)
- Wave 8: +13 endpoints
- Wave 9: +12 endpoints
- Wave 10: +22 endpoints (some in separate route files)

**Total after Wave 10**: ~381 endpoints, estimated 7000-8000 lines in index.ts.

**Problems**:
1. **Cold start time**: Hono parses all routes on startup. 380+ routes with Zod validators = measurable startup overhead.
2. **Route matching**: Hono's trie-based router is fast, but middleware execution (JWT, CORS, rate limiting, Zod validation) runs for each request. With 380 routes, the middleware chain is long.
3. **Memory**: Each route closure captures its handler scope. 380 closures = non-trivial memory footprint.
4. **DX**: Finding and modifying routes in a 7000-line file is error-prone.

**Recommendations**:
- **Route modularization**: Waves 4-6 should create `payroll-routes.ts` (mentioned but not enforced). Wave 10 should create `ap-routes.ts`. Mandate route file extraction in coordination rules.
- **Route group middleware**: Apply JWT/Zod middleware at the route group level, not per-route, to reduce middleware chain length.
- **Lazy route loading**: For rarely-used feature routes (STP, awards, dunning), consider lazy-loading the route handlers.

---

### B7: Nginx SSE Proxy — Missing Configuration for New Streaming Endpoint (Wave 2)

**Severity**: HIGH | **Impact**: SSE streaming in Docker | **Risk**: Buffered/broken streams

**Current state**: The nginx.conf has SSE proxy configuration for `/api/events` (proxy_buffering off, chunked_transfer_encoding off, 86400s read timeout). However, Wave 2 adds a NEW streaming endpoint: `/api/chat/stream`.

**Problems**:
1. **No nginx config for `/api/chat/stream`**: The generic `/api/` location block uses default proxy settings (buffering ON, standard timeouts). SSE responses through this location will be buffered, causing chat tokens to arrive in chunks instead of streaming.
2. **Missing `X-Accel-Buffering: no`**: Even the existing `/api/events` location doesn't set the `X-Accel-Buffering` response header, which some nginx configurations need.
3. **No `proxy_read_timeout` on generic API**: The generic `/api/` location has no explicit `proxy_read_timeout`. If a pay run takes 30+ seconds, nginx may timeout the request before the server responds.

**Recommendations**:
- **Add nginx location for `/api/chat/stream`** with identical SSE settings as `/api/events`:
  ```nginx
  location /api/chat/stream {
      proxy_pass http://server:3501/api/chat/stream;
      proxy_http_version 1.1;
      proxy_set_header Host $host;
      proxy_set_header Connection '';
      proxy_buffering off;
      proxy_cache off;
      chunked_transfer_encoding off;
      proxy_read_timeout 86400s;
      add_header X-Accel-Buffering no;
  }
  ```
- **Add `proxy_read_timeout 120s`** to the generic `/api/` location for long-running operations (pay runs, batch categorization).
- This MUST be in Wave 2's Agent 9 (UI/SSE) or Agent 7 (API endpoints) task scope.

---

## 2. Scalability Concerns (MEDIUM Severity)

### S1: Cognee Search Cache Missing (Wave 3)

**Severity**: MEDIUM | **Impact**: Cognee performance | **Risk**: Redundant API calls

Wave 3 mentions Redis caching (`CACHE_BACKEND=redis`) for Cognee, but this is Cognee-internal caching only. The GoldLedger server makes HTTP calls to Cognee that go through the network layer. Repeated identical searches (common in chat follow-ups) are not cached at the GoldLedger server level.

**Recommendation**: Add server-side Cognee search result caching in `CogneeTools` or `cognee_client.ts`. Cache key: `cognee:search:${userId}:${hash(query+dataset+search_type)}`, TTL: 30s for CHUNKS, 120s for GRAPH_COMPLETION.

---

### S2: Agent Mutation Accumulation (Wave 2)

**Severity**: MEDIUM | **Impact**: Database growth | **Risk**: Audit table bloat

The `agent_mutations` and `agent_audit_log` tables are append-only (audit log has no DELETE per spec). Each chat interaction that proposes mutations creates:
- 1 `agent_sessions` row
- 1+ `agent_mutations` rows (each with full JSON `before_state` and `after_state`)
- 2+ `agent_audit_log` rows (proposed + executed/rejected)

For batch categorization of 100 transactions, that's 100 mutation rows + 200 audit rows per operation. Over time, these tables will grow unbounded.

**Recommendation**: Add a `retention_days` config (default 90) and a scheduled cleanup job that archives old mutations/audit entries to a separate `agent_audit_archive` table or exports to S3/file.

---

### S3: Exchange Rate External API Dependency (Wave 9)

**Severity**: MEDIUM | **Impact**: Multi-currency | **Risk**: API failure cascading

Wave 9's exchange rate refresh (`POST /api/exchange-rates/refresh`) hits an external API. If the API is down, rate-sensitive operations (invoice creation, multi-currency conversion) fail.

**Recommendation**: Cache exchange rates aggressively (Redis TTL 4 hours). Use last-known rate if refresh fails. Log staleness warnings when rates are >24 hours old.

---

### S4: STP XML Payload Size (Wave 6)

**Severity**: MEDIUM | **Impact**: STP reporting | **Risk**: Large XML in TEXT columns

STP events store full XML payloads in the `xmlPayload TEXT` column. For a company with 100 employees, the YTD STP XML could be 50-100KB per event. With monthly STP events = 1.2MB/year per company.

**Recommendation**: Consider GZIP compression for stored XML payloads. Or store XML in the file system and keep only the path in the database.

---

### S5: Per-User Token Cache (Wave 3) — Memory-Based Map

**Severity**: MEDIUM | **Impact**: Server memory | **Risk**: Unbounded growth

Wave 3 adds `userTokenCache: Map<string, { token: string; expiresAt: number }>` to CogneeClient. This is an in-memory `Map` with no eviction policy. With 1000 users, this is ~1000 entries (acceptable), but if user tokens are never evicted after expiry, the map grows indefinitely.

**Recommendation**: Use `setInterval` to sweep expired entries every 5 minutes. Or use Redis for token caching instead of in-memory Map (allows horizontal scaling).

---

### S6: Frontend Bundle Size — 57+ New Components (Waves 1-10)

**Severity**: MEDIUM | **Impact**: Initial page load | **Risk**: Large JavaScript bundle

Waves 1-10 add approximately 57 new React components:
- Wave 1: 3 (chat components)
- Wave 2: 4 (streaming, confirmation, progress, audit)
- Wave 4: 6 (employee management)
- Wave 5: 6 (pay runs, leave)
- Wave 6: 7 (STP, payslips, timesheets, awards, reports)
- Wave 7: 8 (customers, invoices)
- Wave 8: 5 (recurring, subscriptions, payments, dunning)
- Wave 9: 7 (AR aging, templates, currency)
- Wave 10: 11 (suppliers, bills, POs, payment runs)

Without code splitting, the initial bundle could exceed 2-3MB (uncompressed).

**Recommendation**:
- **Route-based code splitting**: Use `React.lazy()` + `Suspense` for feature folders. Only load `features/payroll/` when the user navigates to the payroll tab.
- **Dynamic imports**: Each feature dashboard should be a lazy-loaded chunk.
- The plan already uses Vite, which supports automatic chunk splitting. Ensure `build.rollupOptions.output.manualChunks` is configured.

---

### S7: Database Connection Pooling (All Waves)

**Severity**: MEDIUM | **Impact**: PostgreSQL connections | **Risk**: Pool exhaustion

The current `wrapPgDb()` proxy doesn't mention connection pooling. With:
- CBA server → PostgreSQL
- Cognee → PostgreSQL
- Redis connections
- Background jobs (pay runs, STP)
- SSE connections holding open request handlers

PostgreSQL's default `max_connections=100` will be stressed. Each pay run or batch operation that runs in parallel could consume 5+ connections.

**Recommendation**:
- Configure `pg` connection pool: `max: 20, min: 5, idleTimeoutMillis: 30000`.
- Add `pgbouncer` to docker-compose for production (connection multiplexing).
- Monitor connection count via `/health` endpoint.

---

### S8: Recurring Invoice Generation — No Scheduler Strategy (Wave 8)

**Severity**: MEDIUM | **Impact**: Invoice accuracy | **Risk**: Missed generations

Wave 8 mentions "Use `node-schedule` or simple `setInterval`" for recurring invoice generation. Neither approach is reliable:
- `setInterval` drifts and is lost on server restart.
- `node-schedule` is in-process only — lost on restart.

**Recommendation**: Use a Redis-based scheduler or cron-like approach:
1. On server startup, scan `recurring_invoices` for `nextGenerationDate <= NOW()` and generate missed invoices.
2. Use a polling approach: every 5 minutes, check for due recurring invoices. This is idempotent and survives restarts.
3. Store `lastGeneratedAt` to prevent double-generation.

---

### S9: Dunning Reminder Batch — No Rate Limiting (Wave 8)

**Severity**: MEDIUM | **Impact**: Email delivery | **Risk**: Email provider throttling

`POST /api/dunning/send-reminders` triggers a batch of dunning emails. If a user has 500 overdue invoices, this sends 500 emails in a single HTTP request handler.

**Recommendation**: Queue dunning emails through Redis. Process at most 10 emails per second to avoid provider throttling. Return 202 Accepted with a job ID for status tracking.

---

## 3. Optimization Opportunities (LOW Severity)

### O1: Agent Response Caching

Common queries like "What's my GST for Q2?" return the same result within a BAS period. Cache agent responses (keyed by `agentType + normalized_query + userId + date_bucket`) in Redis with 5-minute TTL for read-only queries.

### O2: Cognee Dataset Pre-warming

After user login, proactively warm Cognee search indexes for the user's most-accessed datasets (transactions, financial_insights). This reduces first-query latency from ~2s to ~500ms.

### O3: Virtual Scrolling for Employee/Invoice/Bill Lists

The plans mention TanStack Table but don't mandate `@tanstack/react-virtual` for large lists. With 100+ employees, 500+ invoices, or 1000+ transactions, DOM rendering degrades.

**Already partially addressed**: The existing codebase uses TanStack Virtual for the transaction table. Ensure all new list components (EmployeeList, InvoiceList, BillList, POList) also use virtual scrolling.

### O4: Server-Side Pagination Enforcement

The plans mandate `?offset=0&limit=50` pagination (good), but some endpoints (e.g., `GET /api/ar/aging`, `GET /api/gst/sales-summary`) return aggregated reports that may scan entire tables. These should use date-range filtering to limit scan scope.

### O5: Pay Run Idempotency

`POST /api/payroll/pay-runs/:id/process` should be idempotent. If called twice (network retry), it should not double-process. Use the `status` field as a guard: only process if status is `draft`.

### O6: PDF Generation Performance (Waves 6, 7)

`pdf-lib` is lightweight (~2MB) but generating PDFs for 100 payslips or 50 invoices in a single request is slow. Consider:
- Generating PDFs asynchronously (return 202 Accepted, generate in background)
- Caching generated PDFs (path stored in `payslips.pdfPath` / `invoices.pdfPath`)

### O7: Cognee Temporal Search Concurrency (Wave 3 + Wave 17)

Wave 3 extends Wave 17's temporal search. Multiple Cognee search calls (CHUNKS + GRAPH_COMPLETION + temporal) run per chat query. These should run in parallel with `Promise.all()`, not sequentially.

### O8: PostgreSQL VACUUM Schedule

With Waves 1-10 adding 40+ new tables and high write volumes (mutations, audit logs, pay runs, invoices), PostgreSQL autovacuum may not keep up. Add a manual VACUUM schedule for high-churn tables (`agent_mutations`, `agent_audit_log`, `pay_run_lines`).

---

## 4. Per-Wave Performance Verdict

| Wave | Name | Verdict | Key Issues |
|------|------|---------|------------|
| **1** | Chat→Agent Bridge | **NEEDS OPTIMIZATION** | B2: Intent router adds 200-500ms per message. No caching. No timeout budget. No parallel multi-agent dispatch. |
| **2** | Transaction Mutation & Streaming | **NEEDS OPTIMIZATION** | B1: EventEmitter won't scale. B7: Missing nginx SSE config for `/api/chat/stream`. S2: Audit table bloat. |
| **3** | Multi-User Cognee | **NEEDS OPTIMIZATION** | B3: Dataset proliferation (100 users × 35 datasets = 3500 datasets). S1: No server-side search cache. S5: In-memory token cache unbounded. |
| **4** | Employee Management | **PERFORMANT** | Good index discipline. TFN encryption is low-overhead. 15 endpoints are manageable. One concern: employee list should use virtual scrolling. |
| **5** | Pay Run Processing | **NEEDS OPTIMIZATION** | B4: Row-by-row processing for 100+ employees. No transaction batching. No background job queue for large pay runs. |
| **6** | STP Compliance | **PERFORMANT** (with caveats) | S4: STP XML payload size should be monitored. Good index coverage. Mock ATO endpoint removes external dependency risk. |
| **7** | Invoicing | **PERFORMANT** | Good design: `pdf-lib` (not Puppeteer), route modularization (`invoicing-routes.ts`), proper indexes. Minor: PDF generation should be async for bulk. |
| **8** | Recurring Invoices | **NEEDS OPTIMIZATION** | S8: No reliable scheduler strategy. S9: Dunning batch has no rate limiting. Payment gateway integration introduces external dependency. |
| **9** | AR Aging & Multi-Currency | **PERFORMANT** (with caveats) | S3: Exchange rate API dependency. Good Redis caching plan. AR aging bucketing is straightforward SQL. |
| **10** | Accounts Payable | **NEEDS OPTIMIZATION** | B5: Three-way matching is O(n²) without proper indexes. B6: 22 more endpoints in the monolith. Missing `po_receipt_lines(po_line_id)` index. |

---

## 5. Cross-Cutting Recommendations

### 5.1 Mandatory Additions to All Wave Coordination Rules

The following should be added to coordination rules for ALL waves:

```
- **Background jobs**: Any operation processing 50+ records MUST be queued via Redis/BullMQ,
  returning 202 Accepted with a job ID. This includes: batch categorization (Wave 2),
  pay run processing (Wave 5), STP generation (Wave 6), recurring invoice generation (Wave 8),
  batch payment runs (Wave 10).

- **Database transactions**: Multi-row write operations MUST be wrapped in a single PostgreSQL
  transaction. If any part fails, the entire operation rolls back.

- **Virtual scrolling**: All list components with potentially 100+ rows MUST use
  @tanstack/react-virtual.

- **Code splitting**: Each feature folder (`payroll/`, `invoicing/`, `ap/`) MUST be lazy-loaded
  via React.lazy() + Suspense.
```

### 5.2 Infrastructure Changes Required

| Change | Priority | Wave | Description |
|--------|----------|------|-------------|
| Add nginx location for `/api/chat/stream` | P0 | 2 | SSE streaming will not work through nginx without this |
| Increase `proxy_read_timeout` to 120s for `/api/` | P1 | 2 | Long-running operations will timeout at nginx default (60s) |
| Add connection pooling config | P1 | 1 | `max: 20, min: 5` pool settings in database connection |
| Add Redis-based job queue | P1 | 5 | Pay runs, STP, dunning, recurring invoices need background processing |
| Add pgbouncer or connection multiplexing | P2 | 3+ | When multi-user is enabled, connection count spikes |

### 5.3 Performance Budget

| Metric | Target | Current Risk |
|--------|--------|-------------|
| Chat response time (intent + agent + format) | < 2000ms p95 | 2500ms+ without caching |
| SSE event delivery | < 100ms from emit to client | OK for EventEmitter; degrades with 100+ connections |
| Pay run processing (100 employees) | < 10 seconds | 30+ seconds with row-by-row inserts |
| Three-way match query | < 500ms | Unknown; needs index optimization |
| Page load (lazy-loaded feature) | < 1500ms FCP | Risk: 3MB+ bundle without code splitting |
| Cognee search response | < 1500ms | OK with caching; 3000ms+ for GRAPH_COMPLETION without cache |

---

## 6. Comparison with Waves 11-24 Review

The previous D03 review (Waves 11-24) identified **B1: No job queue** and **B2: index.ts monolith** as critical. These same issues persist and are even more acute in Waves 1-10:

- **B1 (job queue)**: Still not addressed. Waves 1-10 add more long-running operations (pay runs, STP, batch mutations) that need background processing.
- **B2 (monolith)**: Waves 1-10 add ~131 endpoints, with only Waves 7 and 10 using separate route files. The rest pile into `index.ts`.
- **B6 (table explosion)**: Waves 1-10 add ~44 new tables (3+3+2+7+7+7+6+5+4+10), bringing the total to ~132 tables. This is manageable for PostgreSQL but requires good index discipline.
- **B7 (LLM cost)**: Wave 1's intent router adds a Haiku call per message. At $0.001 per call and 100 DAU × 20 messages/day = $2/day for classification alone, on top of agent costs.

---

**End of D03 Scalability & Performance Review — Waves 1-10**
