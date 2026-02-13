# D03: Scalability & Performance Review — Waves 11–24

**Reviewer**: D03 — Scalability & Performance Specialist
**Date**: 2026-02-12
**Status**: Complete

---

## 1. Critical Bottlenecks (Executive Summary)

| # | Bottleneck | Severity | Wave(s) | Threshold |
|---|-----------|----------|---------|-----------|
| **B1** | No job queue for long-running operations | **CRITICAL** | 13, 14, 15, 18, 19 | Report generation, OCR processing, full CDR crawl, anomaly scans, market refresh will block the single-threaded Node.js event loop or timeout HTTP requests at >30s |
| **B2** | Unbounded `index.ts` monolith — all 200+ endpoints in one file | **CRITICAL** | 11–24 | Hono processes all middleware for every request; at 200+ routes, cold parse + route matching degrades. Also a DX nightmare. |
| **B3** | 3D graph viz with unbounded node count | **HIGH** | 16, 20 | WebGL chokes above ~5,000 nodes at 60fps on mid-range hardware; Wave 16/20 propose rendering "all nodes and edges" from 25+ datasets |
| **B4** | CDR full crawl: 121+ data holders × N products | **HIGH** | 18 | At 2 req/s throttle, crawling 121 data holders with ~100 products each = ~12,100 requests = ~100 minutes; no incremental/delta crawl planned |
| **B5** | Cognee cognify time for large datasets | **HIGH** | 16, 17, 19 | Cognify with LLM entity extraction is O(n) per document; 10K+ documents = hours; no batching strategy mentioned |
| **B6** | PostgreSQL table explosion (45 → ~100 tables, many without indexes) | **MEDIUM** | 11–24 | New waves add 55+ tables; wave plans define table schemas but many omit index definitions for critical query patterns |
| **B7** | LLM token cost explosion with 26+ agents | **MEDIUM** | 11–24 | Each agent call costs $0.003–$0.015 (Sonnet) or $0.001–$0.005 (Haiku); a single user session touching 5 agents = $0.05–$0.10; at 100 DAU = $5–$10/day in AI costs alone |
| **B8** | No connection pooling strategy | **MEDIUM** | 11–24 | PostgreSQL default max_connections=100; with Cognee + server both connecting + potential multi-tenant, pool exhaustion is likely |
| **B9** | Offline sync conflict resolution (Wave 24) | **MEDIUM** | 24 | IndexedDB sync without CRDTs or vector clocks will produce lossy conflicts at scale |
| **B10** | Redis is a ghost service until Wave 17/24 | **LOW** | 17, 24 | 25MB RAM wasted; but more importantly, no caching layer for repeated Cognee queries or expensive report generation |

---

## 2. Database Performance

### 2.1 Current Index Coverage (Good)

The existing `postgres-schema.ts` has **35 indexes** across 20 tables — solid coverage for current query patterns:
- `transactions`: 7 indexes (userId, date, userId+date composite, statementId, category, accountId, transferIdx)
- `accounts`: 2 indexes (userId, accountNumberHash)
- `statements`: 4 indexes (hash unique, userId, uploadDate, userId+uploadDate, period)
- `merchant_memory`: 2 indexes (userId+pattern, category)

### 2.2 Missing Indexes for Planned Features

| Wave | Table | Missing Index | Query Pattern | Impact |
|------|-------|---------------|---------------|--------|
| 11 | `inventory_movements` | `(itemId, date)` | Stock history queries | Full table scan above 10K rows |
| 11 | `bank_recon_matches` | `(sessionId, confidence DESC)` | Match suggestion ranking | Slow sorting on large sessions |
| 13 | `budget_vs_actual` | `(budgetId, period)` | Monthly variance lookups | O(n) scan per budget report |
| 13 | `report_snapshots` | `(userId, entityId, periodEnd)` | Period comparison queries | Slow for multi-year comparisons |
| 14 | `payment_matches` | `(transactionId, status)` | Unmatched transaction lookup | N+1 risk on transaction list |
| 14 | `ocr_documents` | `(userId, status, uploadedAt)` | Processing queue ordering | Queue stalls above 1K documents |
| 15 | `anomaly_alerts` | `(userId, status, severity)` | Alert dashboard filtering | Full scan per dashboard load |
| 15 | `compliance_checks` | `(userId, dueDate, status)` | Calendar view queries | Missing for date-range calendar scans |
| 18 | `cdr_products` | `(productCategory, dataHolderId)` | Category browsing + holder filter | Full scan of potentially 10K+ products |
| 18 | `cdr_lending_rates` | `(productId, lendingRateType, rate)` | Rate comparison sorting | Cannot efficiently find "best rates" |
| 19 | `economic_indicators` | `(indicatorCode, effectiveDate DESC)` | Historical indicator lookups | Time-series queries slow without index |
| 19 | `market_prices` | `(symbol, asOf DESC)` | Price history charts | Slow charting above 1 year of daily data |
| 20 | `agent_executions` | `(agentType, startedAt DESC)` | Admin execution log browsing | Unbounded growth, no pagination index |
| 23 | `tenants`, `tenant_members` | Multiple RLS-supporting indexes | Tenant isolation queries | Every query gains tenant filter overhead |

**Recommendation**: Every wave migration MUST include `CREATE INDEX` statements for the composite query patterns documented in the API endpoints. Current wave plans define endpoints but do NOT specify indexes.

### 2.3 Projected Table Sizes (per user per year)

| Table | Growth Rate | Rows at 1yr/1 user | Rows at 3yr/100 users | Concern? |
|-------|------------|---------------------|----------------------|----------|
| `transactions` | ~200/month | 2,400 | 720,000 | **YES** — needs partition strategy at 1M+ |
| `inventory_movements` | ~50/month | 600 | 180,000 | Moderate |
| `bank_recon_matches` | ~100/session × 12 | 1,200 | 360,000 | Moderate |
| `ocr_documents` | ~20/month | 240 | 72,000 | Low |
| `payment_matches` | ~200/month | 2,400 | 720,000 | **YES** — mirrors transactions |
| `anomaly_alerts` | ~10/month | 120 | 36,000 | Low |
| `cdr_products` | 10K (crawled) | 10,000 | 10,000 (shared) | **YES** — single large table |
| `cdr_lending_rates` | ~3/product | 30,000 | 30,000 (shared) | **YES** — rate comparison queries |
| `market_prices` | ~100/day | 36,500 | 36,500 (shared) | **YES** — time-series, needs cleanup policy |
| `economic_indicators` | ~20/day | 7,300 | 7,300 (shared) | Moderate |
| `agent_executions` | ~50/day | 18,250 | 5,475,000 | **CRITICAL** — grows fastest, needs retention policy |
| `audit_trails` (W15) | ~100/day | 36,500 | 10,950,000 | **CRITICAL** — grows fastest, needs partitioning |

### 2.4 N+1 Query Risks

| Wave | Endpoint | Risk | Description |
|------|----------|------|-------------|
| 11 | `GET /api/inventory/stock` | **HIGH** | Stock summary likely loads all items then queries stock per item |
| 13 | `GET /api/reports/profit-loss` | **HIGH** | P&L aggregation across all transaction categories without pre-computation |
| 13 | `GET /api/budgets/:id/vs-actual` | **HIGH** | Budget vs actual must join budget_lines × months × actual transactions |
| 14 | `GET /api/matching/suggestions` | **HIGH** | Match suggestions scan all unmatched transactions × all candidates |
| 15 | `GET /api/compliance/calendar` | **MEDIUM** | Calendar loads all obligations then filters by date range |
| 18 | `GET /api/cdr/best-rates` | **HIGH** | Must scan all products × rates to find minimum per category |
| 20 | `GET /api/admin/agents` | **MEDIUM** | Agent dashboard loads all 25+ agents then execution counts per agent |

**Recommendation**: Use aggregate views or materialized queries. The P&L (Wave 13) and budget vs actual reports should use `GROUP BY` with CTEs, not application-level loops. Consider `CREATE MATERIALIZED VIEW` for expensive cross-table aggregations.

### 2.5 SQLite vs PostgreSQL at Scale

The dual-schema approach with `wrapPgDb()` returning `any` is a **technical debt time bomb**:
- At 45 tables: manageable (current state)
- At 100 tables: unmaintainable — every new table needs definition in BOTH `schema.ts` and `postgres-schema.ts`
- At multi-tenant (Wave 23): **impossible** — SQLite cannot do row-level security, concurrent writes, or handle multi-user load

**Recommendation**: Wave 11 should formally deprecate SQLite for Docker deployments. By Wave 13 (financial reports requiring complex JOINs), SQLite compatibility will be a constant friction point. The `wrapPgDb()` proxy should be eliminated before Wave 15.

---

## 3. Cognee Performance

### 3.1 Kuzu Graph Store Limits

Kuzu is an **embedded** graph database (file-based, stored in `/app/.cognee_system`). Performance characteristics:
- **Node limit for queries**: ~100K nodes before scan-heavy Cypher queries exceed 1s
- **Edge limit for traversal**: Traversal performance degrades at >500K edges due to adjacency list scanning
- **Memory**: Kuzu memory-maps files; with 4GB Cognee container limit, effective working set is ~2GB for graph operations
- **No clustering**: Single-node, no replication — Cognee downtime = no graph queries

**3D Visualization Concern (Wave 16/20)**:
The admin panel requests "full graph data for 3D viz" via `GET /api/admin/cognee/graph`. If the graph has:
- **<1,000 nodes**: Three.js force-graph renders smoothly at 60fps
- **1,000–5,000 nodes**: Frame drops begin; need LOD (Level of Detail) or clustering
- **5,000–10,000 nodes**: WebGL struggles; force simulation becomes sluggish
- **>10,000 nodes**: **Unusable without server-side aggregation**

**The plan says 25+ datasets after Wave 17**. If each dataset contributes ~500 nodes and ~2,000 edges, that's 12,500 nodes / 50,000 edges — well above the smooth rendering threshold.

**Recommendations**:
1. Wave 16 graph endpoint MUST support pagination: `?limit=1000&offset=0`
2. Server-side graph clustering: group nodes by dataset/type, return summary nodes
3. Frontend: Use LOD — show dataset-level clusters by default, expand on click
4. Cap the `GET /api/admin/cognee/graph` response at 2,000 nodes; provide drill-down for detail

### 3.2 Cognify Processing Time

Cognify = LLM-powered entity extraction + relationship mapping. Per-document cost:
- 1 document → ~500–2,000 tokens input → ~200–500 tokens output
- At `google/gemini-3-flash-preview` via OpenRouter: ~0.3s per document
- **10 documents**: ~3s (acceptable)
- **100 documents**: ~30s (needs background processing)
- **1,000 documents**: ~5 min (MUST be async)
- **10,000 documents**: ~50 min (needs batching + progress tracking)

Wave 16 proposes activating custom DataPoints on existing datasets. If those datasets have thousands of documents, re-cognifying them could take **hours**.

**Recommendations**:
1. ALL cognify operations must be background jobs (not blocking HTTP requests)
2. Wave 16 `POST /api/cognee/datapoints/:id/activate` must return immediately with a job ID
3. Implement progress tracking via SSE (reuse existing `events.ts` pattern)
4. Batch cognify in chunks of 50 documents with configurable concurrency

### 3.3 Redis Caching Impact

Redis exists but is unused until Wave 17 proposes activating it. Estimated caching benefits:

| Query Type | Uncached Latency | Cached Latency | Cache Hit Rate (est.) |
|-----------|------------------|----------------|----------------------|
| CHUNKS search | 200–500ms | 5–10ms | 60% (repeated queries) |
| GRAPH_COMPLETION | 2–5s (LLM) | 5–10ms | 40% (varied queries) |
| RAG_COMPLETION | 3–8s (LLM) | 5–10ms | 30% |
| Dataset stats | 100–300ms | 1–5ms | 90% |

**Recommendation**: Don't wait until Wave 17. Wire Redis to Cognee in Wave 11 as a foundational improvement:
1. Add `redis` extra to Cognee Dockerfile
2. Pass `REDIS_URL` to Cognee
3. Reduces LLM API costs by 30–60% for repeated queries
4. Estimated savings: ~$50–$200/month at 100 DAU depending on query patterns

---

## 4. API Performance

### 4.1 Slow Endpoints by Wave

| Wave | Endpoint | Expected Latency | Bottleneck | Mitigation |
|------|----------|-----------------|------------|------------|
| 13 | `GET /api/reports/profit-loss` | **3–10s** | Aggregates ALL transactions by category for period | Pre-compute via materialized view or cache; paginate by category |
| 13 | `GET /api/reports/balance-sheet` | **3–10s** | Joins accounts + transactions + journal entries | Same as above |
| 13 | `POST /api/reports/generate` | **5–30s** | Template-based report with AI analysis | **MUST be background job** |
| 14 | `POST /api/ocr/upload` | **10–60s** | Claude Vision API call per page | Background queue; return job ID immediately |
| 14 | `POST /api/ocr/batch-upload` | **60–600s** | 10 documents × multi-page OCR | **MUST be background job** |
| 14 | `POST /api/matching/auto-match` | **5–30s** | Scans all unmatched × all candidates | Background job with progress updates |
| 15 | `POST /api/anomalies/scan` | **10–60s** | Statistical analysis over all transactions | Background job |
| 15 | `POST /api/forecasts/cash-flow` | **5–20s** | Seasonal decomposition + AI analysis | Background job or pre-compute nightly |
| 18 | `POST /api/cdr/crawl/full` | **60–120 min** | 121 data holders × products at 2 req/s | **MUST be background job with progress tracking** |
| 19 | `POST /api/market/sentiment/research` | **5–30s** | last30days external API + LLM summary | Background job; cache aggressively |
| 19 | `POST /api/market/feeds/:id/refresh` | **3–15s** | External API fetch + DB upsert | Background job |
| 20 | `GET /api/admin/cognee/graph` | **5–30s** | Fetch full graph from Cognee (large payload) | Pagination + server-side aggregation |

### 4.2 Need for a Job Queue: CRITICAL

**14 of the planned 200+ endpoints will take >5 seconds**. The current architecture has NO job queue.

The existing `queue.ts` is a file-upload queue only (in-memory with SQLite persistence). It cannot handle:
- Report generation (Wave 13)
- OCR batch processing (Wave 14)
- Anomaly scanning (Wave 15)
- CDR crawling (Wave 18)
- Market data refresh (Wave 19)

**Recommendation**: Add **BullMQ** (Redis-backed job queue) before Wave 13:

```
Estimated effort: 1 agent, 1 wave
Dependencies: Redis (already in Docker stack)
Pattern: POST endpoint → enqueue job → return jobId → poll GET /jobs/:id or SSE
```

This should be a **pre-Wave 13 infrastructure task**. Without it, Waves 13–19 will all need ad-hoc background processing solutions, leading to inconsistency and bugs.

### 4.3 Pagination

**Current state**: The existing `fetchTransactions` returns `{ transactions, total }` — properly paginated.

**Waves 11–24 plan**: Many new list endpoints but pagination is not explicitly mentioned in most wave plans:

| Wave | Endpoint | Needs Pagination? |
|------|----------|------------------|
| 11 | `GET /api/inventory/items` | YES — could grow to 10K+ items |
| 11 | `GET /api/inventory/movements/:itemId` | YES — hundreds per item |
| 13 | `GET /api/reports/snapshots` | YES — grows with usage |
| 14 | `GET /api/ocr/documents` | YES |
| 15 | `GET /api/anomalies` | YES — accumulates over time |
| 15 | `GET /api/audit-trail` | **CRITICAL** — grows fastest of all tables |
| 18 | `GET /api/cdr/products` | YES — 10K+ products |
| 19 | `GET /api/market/prices` | YES — daily price data |
| 20 | `GET /api/admin/agents/:type/executions` | **CRITICAL** — agent execution logs |
| 20 | `GET /api/admin/activity` | **CRITICAL** — global activity feed |

**Recommendation**: Establish a standard pagination pattern (`?page=1&limit=50`) in Wave 11 and mandate it for ALL list endpoints. The existing pattern from `fetchTransactions` should be formalized.

---

## 5. Frontend Performance

### 5.1 3D Graph Visualization (Wave 16/20)

**Library**: three.js (~200KB gzip) + 3d-force-graph (~50KB gzip)

Performance benchmarks for force-directed graph:
| Node Count | Edge Count | Init Time | Steady FPS | Memory |
|-----------|-----------|-----------|-----------|--------|
| 100 | 300 | <500ms | 60fps | ~50MB |
| 500 | 2,000 | 1–2s | 55–60fps | ~100MB |
| 1,000 | 5,000 | 3–5s | 40–55fps | ~200MB |
| 5,000 | 20,000 | 10–20s | 15–30fps | ~500MB |
| 10,000 | 50,000 | 30–60s | <10fps | ~1GB+ |

With 25+ Cognee datasets potentially producing 10K+ nodes, the proposed "full graph" 3D view is **not viable without LOD**.

**Recommendations**:
1. Default view: Dataset-level summary (25 nodes representing datasets, edges showing cross-references)
2. Drill-down: Click dataset → expand to entity-level (max 500 nodes per dataset view)
3. Graph query endpoint: Server-side filtering by dataset, entity type, time range
4. WebGL fallback: Detect GPU capabilities; fall back to 2D force-graph on weak GPUs
5. Virtual scrolling for graph node lists (if displayed alongside the visualization)

### 5.2 List Virtualization

Current: TanStack Virtual already handles the transaction list.

**New risks**:
| Wave | Component | List Size Concern |
|------|-----------|-------------------|
| 11 | ItemList.tsx | 10K+ inventory items — needs virtual list |
| 13 | BudgetEditor.tsx | 12 months × N categories — grid virtualization needed |
| 14 | MatchSuggestions.tsx | Could have 1000+ suggestions — needs virtual list |
| 18 | ProductExplorer.tsx | 10K+ CDR products — **must** use virtual list |
| 19 | MarketPrices.tsx | Scrolling price table — moderate |
| 20 | AgentExecutionLog.tsx | Thousands of log entries — needs virtual list + pagination |
| 22 | DashboardGrid.tsx | Drag-and-drop with many widgets — moderate |

**Recommendation**: Mandate TanStack Virtual for any list that could exceed 100 visible items. Wave plans should explicitly state virtualization requirements.

### 5.3 Code Splitting & Bundle Size

**Current bundle**: React + TanStack Table/Virtual + Tailwind. Estimated: ~200KB gzip.

**Projected additions**:
| Wave | Library | Added Size (gzip) | Cumulative |
|------|---------|-------------------|------------|
| 16/20 | three.js | ~200KB | 400KB |
| 16/20 | 3d-force-graph | ~50KB | 450KB |
| 22 | Recharts (D3) | ~40KB | 490KB |
| 22 | react-grid-layout | ~15KB | 505KB |
| 24 | Workbox (SW) | ~20KB | 525KB |
| 24 | idb | ~5KB | 530KB |
| 21 | Vercel AI SDK (client) | ~15KB | 545KB |

**545KB gzip is large but manageable IF code-split properly.** The concern is that three.js (200KB) and Recharts (40KB) are pulled into the main bundle.

**Recommendations**:
1. **Lazy load Three.js**: Only the Knowledge Graph page (Wave 16) and Admin Graph (Wave 20) need it. Use `React.lazy()` + `Suspense`.
2. **Lazy load Recharts**: Only load on pages that use charts (analytics, reports, budgets, market).
3. **Route-based splitting**: Wave 24 introduces react-router-dom — use `React.lazy()` for each route.
4. **Critical path**: Main bundle should contain only layout, navigation, and transaction list (~200KB).
5. **Service Worker**: Wave 24's Workbox will pre-cache split chunks, masking the download cost.

### 5.4 Chart Performance

Recharts (D3-based) performance:
| Data Points | Render Time | Interaction FPS |
|------------|------------|-----------------|
| 100 | <50ms | 60fps |
| 500 | 50–200ms | 55–60fps |
| 1,000 | 200–500ms | 40–55fps |
| 5,000 | 1–3s | 20–30fps |
| 10,000 | 3–10s | <15fps |

**Concern areas**:
- Wave 15 cash flow forecast: 12 months × 3 scenarios × daily data = ~1,000 points — fine
- Wave 19 market prices: Daily prices × 1 year × 10 symbols = ~3,650 points — needs data aggregation for charts
- Wave 22 Sankey diagram: Money flow with many categories — keep under 50 nodes

**Recommendation**: For time-series charts with >1,000 data points, implement server-side data aggregation (hourly/daily/weekly bucketing based on time range).

---

## 6. External API Rate Limits

### 6.1 CDR APIs (Wave 18)

| API | Rate Limit | Planned Usage | Risk |
|-----|-----------|---------------|------|
| CDR Register (data holders) | 300 TPS (public) | 1 call/day | None |
| PRD Products (per data holder) | Varies, est. 10 TPS | 121 calls for catalog | Low — at 2 req/s planned |
| PRD Product Detail | Varies, est. 10 TPS | 10K+ calls for detail | **HIGH** — must throttle |

**Full crawl analysis**:
- 121 data holders × 1 catalog request = 121 requests (1 min at 2 req/s)
- ~100 products per holder × 121 holders = 12,100 detail requests (101 min at 2 req/s)
- Total: ~102 minutes for a full crawl

**Missing from Wave 18 plan**:
1. **Incremental crawl**: No delta/since-modified strategy — plan crawls everything each time
2. **Retry with backoff**: No mention of 429 handling
3. **Crawl scheduling**: Plan says "nightly re-index" but a 100-min crawl + Cognee indexing exceeds overnight windows if also running cognify
4. **Data staleness**: No `effectiveTo` filtering — stale products stay in DB forever

**Recommendations**:
1. Implement `If-Modified-Since` / `Last-Modified` headers for delta crawling
2. Add `lastCrawled` timestamp per data holder and skip if crawled within 24h
3. Product detail fetch should be lazy (on-demand when user views product, cached for 24h)
4. Add TTL-based cleanup: delete products where `effectiveTo < NOW()`

### 6.2 Market Data APIs (Wave 19)

| API | Free Tier Limit | Planned Usage | Risk |
|-----|----------------|---------------|------|
| Alpha Vantage (ASX) | **25 requests/day** | Multiple stock lookups | **CRITICAL** — 25/day is essentially useless for real-time |
| CoinGecko | 30 req/min | Crypto prices | Low |
| RBA CSV tables | No limit (static files) | Daily download | None |
| ABS SDMX API | No documented limit | Weekly data | Low |

**Alpha Vantage free tier is inadequate**. 25 req/day means you can look up 25 stock prices per day. If a user has 10 stocks on a watchlist and refreshes twice, that's the daily limit.

**Recommendations**:
1. **Cache aggressively**: Store Alpha Vantage responses for 24h (prices don't change intraday for free tier)
2. **Batch requests**: Use the `BATCH_STOCK_QUOTES` endpoint (5 symbols per request = 125 stocks/day)
3. **Consider Yahoo Finance v8 API** as a free alternative (no official API but widely used)
4. **Display data freshness**: Show "Last updated: 2 hours ago" to set user expectations
5. **Rate limit the refresh button**: Prevent users from exhausting the daily quota

### 6.3 LLM API Token Usage & Cost Projection

**Current agents (25)**:
| Model | Price per 1M tokens (input/output) | Usage per call |
|-------|-----------------------------------|----------------|
| Claude Sonnet 4.5 | $3.00 / $15.00 | ~2K in / ~500 out |
| Claude Haiku 4.5 | $0.80 / $4.00 | ~1K in / ~300 out |
| Gemini Flash (OpenRouter) | $0.10 / $0.40 | ~1K in / ~500 out |

**Per-request cost estimates**:
| Agent | Model | Est. Cost/Call |
|-------|-------|----------------|
| statement_parser | Sonnet | $0.014 |
| transaction_categorizer | Haiku | $0.002 |
| gst_calculator | Sonnet | $0.010 |
| budget_analyzer | Sonnet | $0.010 |
| financial_reporting_agent (W13) | Sonnet | $0.015 |
| forecasting_agent (W15) | Sonnet | $0.015 |
| compliance_monitoring_agent (W15) | Haiku | $0.003 |
| cdr_product_agent (W18) | Haiku | $0.002 |
| market_intelligence_agent (W19) | Sonnet | $0.015 |
| Chat (multi-agent orchestration) | Sonnet | $0.020–$0.050 |

**Cost projections**:
| Scenario | DAU | Agent Calls/User/Day | Daily Cost | Monthly Cost |
|----------|-----|---------------------|-----------|-------------|
| Light use | 10 | 5 | $0.75 | $22 |
| Moderate | 50 | 10 | $7.50 | $225 |
| Heavy | 100 | 20 | $30.00 | $900 |
| Multi-tenant | 500 | 15 | $112.50 | $3,375 |

**Cognee LLM costs** (separate from agent costs):
- Cognify: ~$0.0005/document (Gemini Flash via OpenRouter)
- Search (GRAPH_COMPLETION): ~$0.002/query
- At 100 DAU × 10 searches/day = $2/day = $60/month

**Total estimated monthly cost at 100 DAU**: ~$900 (agents) + $60 (Cognee) = **~$960/month in LLM APIs alone**

**Recommendations**:
1. **Cache agent responses**: Common queries (category lookups, GST rules) should be cached
2. **Use Haiku by default**: Reserve Sonnet for complex reasoning (parsing, forecasting, financial reports)
3. **Token budget per request**: Set maxTokens appropriately — many agents don't need 4K output tokens
4. **Cognee Redis caching**: Reduces Cognee LLM costs by 30–60%
5. **Wave 23 subscription tiers**: Align agent call limits with plan tiers (free: 50 calls/month, starter: 500, pro: 5000)

---

## 7. Scaling Roadmap

### 7.1 Architecture Inflection Points

| User Count | Inflection | Required Change |
|-----------|-----------|-----------------|
| **1–10** (current) | None | Current architecture works fine |
| **10–50** | Connection pool exhaustion | Add PgBouncer or connection pool config |
| **50–100** | LLM cost becomes significant | Must add caching, rate limiting per user, and subscription tiers |
| **100–500** | Single-node PostgreSQL limit | Need read replica for analytics queries; CDR data needs dedicated DB |
| **500–1000** | Cognee bottleneck | Cognee needs horizontal scaling (not supported in current embedded Kuzu mode) |
| **1000+** | Full re-architecture | Microservices, separate Cognee clusters per tenant group, Redis cluster, CDN |

### 7.2 Data Retention Strategy (MISSING from all wave plans)

No wave plan mentions data retention or archival. Projected growth:

| Table | Monthly Growth (100 users) | Annual Size | 3-Year Size |
|-------|--------------------------|-------------|-------------|
| `transactions` | 600K rows | 7.2M | 21.6M |
| `audit_trails` | 3M rows | 36M | **108M** |
| `agent_executions` | 1.5M rows | 18M | **54M** |
| `market_prices` | 3K rows | 36K | 108K |

**Recommendation**: Add retention policies:
- `audit_trails`: Partition by month, archive after 12 months, delete after 3 years
- `agent_executions`: Keep 90 days hot, archive to cold storage
- `market_prices`: Keep 1 year daily, aggregate to weekly for older data
- `anomaly_alerts`: Auto-dismiss after 90 days if unresolved

### 7.3 Pre-Wave Infrastructure Investments

These should be implemented BEFORE Wave 11 or as part of Wave 11:

| Investment | Priority | Effort | Blocks |
|-----------|----------|--------|--------|
| BullMQ job queue (Redis-backed) | **P0** | 1 agent-day | Wave 13, 14, 15, 18, 19 |
| Standard pagination middleware | **P0** | 0.5 agent-day | All list endpoints |
| PostgreSQL connection pooling | **P1** | 0.5 agent-day | Wave 23 (multi-tenant) |
| Redis → Cognee caching | **P1** | 0.5 agent-day | All Cognee queries |
| Deprecate SQLite for Docker | **P1** | 1 agent-day | Wave 13+ (complex queries) |
| Log rotation + retention config | **P2** | 0.5 agent-day | Wave 20 (admin monitoring) |
| Standard index template for new tables | **P2** | 0.5 agent-day | All waves |

---

## 8. Recommendations by Wave

### Wave 11 (Inventory & Bank Reconciliation)
- **Add indexes**: `inventory_movements(itemId, date)`, `bank_recon_matches(sessionId, confidence)`
- **Pagination**: All list endpoints (items, movements, sessions)
- **Pre-compute**: Inventory valuation should be a cached computation, not real-time aggregation
- **Foundational**: Install BullMQ, wire Redis to Cognee, establish pagination pattern

### Wave 12 (Fixed Assets & Multi-Entity)
- **Depreciation batch**: `POST /api/assets/depreciate-all` processes all active assets — must be async job
- **Entity context**: Global entity switcher adds query overhead to every endpoint — add `entityId` index to all entity-scoped tables
- **Consolidation**: `GET /api/consolidation/:parentId` is expensive (aggregates across entities) — cache with short TTL

### Wave 13 (Financial Reporting & Budgeting) — HIGH RISK
- **MUST use job queue**: Report generation (`POST /api/reports/generate`) CANNOT be synchronous
- **Materialized views**: P&L and Balance Sheet should use `CREATE MATERIALIZED VIEW` refreshed nightly or on-demand
- **Budget grid**: 12 months × N categories grid needs careful frontend virtualization
- **KPI calculation**: `POST /api/kpis/refresh` recalculates all KPIs — async job with progress

### Wave 14 (AI OCR & Payment Matching)
- **MUST use job queue**: All OCR endpoints return job IDs, not results
- **Document queue**: The existing `document_queue` table is good — wire it to BullMQ
- **File size limits**: Max 10MB per document, 50MB per batch
- **Concurrent OCR**: Limit to 3 concurrent Claude Vision calls to control API costs

### Wave 15 (Predictive Analytics & Compliance)
- **Forecast pre-computation**: Don't compute forecasts on every request — compute nightly, serve cached
- **Anomaly detection**: Statistical analysis over all transactions = full table scan — use incremental approach (only scan new transactions since last scan)
- **Audit trail partitioning**: This table will grow fastest — partition by month from day one
- **Compliance scheduler**: Use cron job (node-cron) for upcoming obligation checks

### Wave 16 (Custom DataPoints)
- **Graph pagination**: `GET /api/cognee/graph/:dataset` MUST return paginated results with max 2,000 nodes
- **Cognify async**: DataPoint activation triggers background cognify — return job ID
- **Graph stats caching**: Cache node/edge counts for 1 hour (expensive to compute)
- **LOD for visualization**: Default to dataset-level summary, drill down on click

### Wave 17 (Temporal Queries)
- **Redis activation**: This is the right wave to wire Redis properly
- **Query caching**: Temporal queries are expensive (time-scoped graph traversal) — cache for 5 minutes
- **Cross-module scan**: `POST /api/intelligence/scan` must be async (touches all modules)
- **Subscription throttle**: In-app notifications should be batched (max 1 per type per hour)

### Wave 18 (CDR Open Banking) — HIGH RISK
- **MUST use job queue**: Full crawl is 100+ minutes — must track progress
- **Incremental crawl**: Add `lastModified` tracking, skip unchanged data holders
- **Rate limiting**: Implement per-data-holder throttle (2 req/s)
- **Product caching**: Cache product details for 24h — they rarely change daily
- **Index strategy**: CDR products need composite indexes for filtering + sorting by rate

### Wave 19 (Market Intelligence)
- **Alpha Vantage budget**: 25 req/day is critically low — implement batch endpoint + 24h caching
- **Scheduler**: Market data refresh should be a scheduled job, not on-demand
- **Sentiment caching**: last30days results cached for 6 hours (sentiment doesn't change minute-to-minute)
- **Data cleanup**: Market prices older than 1 year should be aggregated to weekly

### Wave 20 (Admin Dashboard)
- **3D graph LOD**: See Wave 16 recommendations — even more critical at 25+ datasets
- **Execution log pagination**: MUST paginate with cursor-based pagination (offset is slow on millions of rows)
- **System metrics buffering**: Don't write metrics on every request — buffer and flush every 30s
- **Health check caching**: Don't ping all services on every dashboard load — cache for 30s

### Wave 21 (Vercel AI SDK Migration)
- **Streaming backpressure**: SSE streams need client-side flow control — if the client tab is hidden, pause the stream
- **Schema validation overhead**: Zod validation adds ~1ms per response — negligible
- **Benchmark fairly**: Compare latency excluding network — streaming TTFB will be faster but total time may be longer
- **Rollback strategy**: Keep legacy agent classes for 1 wave after migration — don't delete immediately

### Wave 22 (Advanced Visualizations)
- **Lazy load Recharts**: Don't include in main bundle — load on first chart render
- **Data aggregation**: Server-side bucketing for time-series with >1,000 data points
- **Dashboard widget cap**: Limit to 12 widgets per dashboard to prevent render storm
- **Chart memoization**: `React.memo` all chart components — Recharts re-renders are expensive

### Wave 23 (Multi-Tenant & Access Control) — HIGHEST RISK
- **Row-Level Security**: Every table needs `userId`/`tenantId` filter — add as PostgreSQL RLS policy, not app-level WHERE clause
- **Connection pool per tenant**: Consider PgBouncer with `tenant_id` routing
- **Cognee namespace explosion**: 100 tenants × 25 datasets = 2,500 Cognee datasets — verify Cognee handles this
- **Rate limiting per tenant**: Use Redis-backed token bucket (BullMQ already provides this)
- **Subscription enforcement**: Cache plan limits in Redis — don't query DB on every request
- **Migration complexity**: Adding `tenantId` to ALL existing tables is a massive ALTER TABLE + data migration

### Wave 24 (Mobile & PWA)
- **Offline data budget**: Don't cache everything — cache last 100 transactions + account balances only (~50KB)
- **Sync conflict strategy**: Implement "last write wins" for simple fields, "merge" for lists — NOT manual resolution for every conflict
- **Push notification throttle**: Max 5 push notifications per user per hour
- **Service worker cache**: Use Workbox's runtime caching with stale-while-revalidate for API responses
- **Navigation restructure**: The tab→sidebar migration touches every page — high regression risk, needs thorough testing

---

## Appendix A: Data Volume Projection Model

### Per-User Annual Data Generation

| Data Type | Monthly Rows | Annual Rows | Avg Row Size | Annual Size |
|-----------|-------------|-------------|-------------|-------------|
| Transactions | 200 | 2,400 | 500B | 1.2MB |
| OCR documents | 20 | 240 | 2KB | 480KB |
| Inventory movements | 50 | 600 | 300B | 180KB |
| Payment matches | 200 | 2,400 | 200B | 480KB |
| Anomaly alerts | 10 | 120 | 500B | 60KB |
| Audit trail | 1,000 | 12,000 | 400B | 4.8MB |
| Agent executions | 500 | 6,000 | 1KB | 6MB |
| **Total per user/year** | | | | **~13MB** |

### Platform-Wide Projections (Shared Tables)

| Data Type | Growth Rate | Annual Size |
|-----------|-----------|-------------|
| CDR products | 10K products (crawled) | ~20MB |
| CDR rates/fees | 50K rows | ~10MB |
| Market prices | 36K rows/year | ~7MB |
| Economic indicators | 7K rows/year | ~1.4MB |
| Cognee graph (Kuzu) | varies | ~100MB–1GB |
| **Total shared/year** | | **~140MB–1GB** |

### Total Storage at Scale

| Users | Year 1 | Year 3 | Notes |
|-------|--------|--------|-------|
| 10 | 270MB | 530MB | Comfortable on 5GB disk |
| 100 | 1.4GB | 4.2GB | Need monitoring |
| 500 | 6.6GB | 19.8GB | Need cleanup policies |
| 1000 | 13.1GB | 39.3GB | Need archival strategy |

---

## Appendix B: Recommended Technology Additions

| Technology | Purpose | Wave | Priority |
|-----------|---------|------|----------|
| **BullMQ** | Redis-backed job queue | Pre-13 | **P0** |
| **PgBouncer** | Connection pooling | Pre-23 | **P1** |
| **node-cron** | Scheduled tasks | 15, 18, 19 | **P1** |
| **cursor-pagination** | Efficient large-table paging | 20+ | **P2** |
| **PostgreSQL partitioning** | Audit trail + agent logs | 15, 20 | **P2** |
| **Materialized views** | Financial reports | 13 | **P1** |
| **CDN (Cloudflare)** | Static asset delivery | 24 (PWA) | **P2** |
