# MASTER AUDIT REPORT — CBA Statements Parse

**Date:** 2026-02-11
**Audit Team:** 9 specialists + supervisor
**Scope:** Full-stack accuracy, security, correctness, integration, and deployment audit

---

## EXECUTIVE SUMMARY

The CBA Statements Parse platform has a **strong architectural foundation** with 845-line Drizzle schema, 7 Claude agents with circuit breakers, comprehensive security middleware, and a sophisticated local RAG pipeline. However, the audit uncovered **a critical pattern of disconnected infrastructure** — extensive, well-engineered code that is never wired into the application.

### By the Numbers

| Metric | Count |
|--------|-------|
| **Total findings** | ~80+ across all audits |
| **P0 Critical** | 28 |
| **P1 High** | 31 |
| **P2 Medium** | ~15 |
| **P3 Low** | ~8 |
| **Dead code (LOC)** | ~5,000+ (security middleware, Zod validation, local RAG, Python agents) |
| **Audit reports** | 9 |

### The "Dead Code" Pattern

The single most impactful finding across the entire audit is that **thousands of lines of production-quality code are never connected:**

| Component | LOC | Status |
|-----------|-----|--------|
| Security middleware (OWASP headers, rate limiting) | ~345 | Never imported |
| Audit logging middleware | ~504 | Never imported |
| Zod validation schemas (25+ schemas) | ~424 | Never imported |
| Local RAG pipeline (dense/sparse/fusion/reranking/citations) | ~3,500 | Never imported |
| Python agent system (7 agents + orchestrator) | ~2,000+ | Never wired to routes |
| **Total disconnected code** | **~6,700+** | |

**Connecting these existing modules would resolve 10+ critical/high findings immediately** without writing new code.

---

## P0 CRITICAL FINDINGS (Fix Immediately)

### Security (T2)

| # | Finding | Location | Impact |
|---|---------|----------|--------|
| S1 | **Path traversal in file upload** — unsanitized `file.name` in `path.join()` allows arbitrary file write/RCE | `index.ts:486-505` | Remote code execution |
| S2 | **No file type/size validation** — any file accepted, `magika` installed but unused | `index.ts:475-521` | Denial of service, malware upload |
| S3 | **Wildcard CORS** — `cors()` with no origin restriction | `index.ts:63` | Cross-site request forgery |
| S4 | **Rate limiter bypass** — `x-forwarded-for` as key, trivially spoofable | `index.ts:50,59` | Abuse, brute force |
| S5 | **Hardcoded JWT secret fallback** | `docker-compose.yml:122` | Token forgery |

### Accuracy (T4)

| # | Finding | Location | Impact |
|---|---------|----------|--------|
| A1 | **`\|\|` instead of `??`** — `gstAmount=0` treated as falsy, recalculates GST for GST-free items | `bas.ts:240` | Corrupted BAS labels 1A/1B |
| A2 | **No transaction duplicate prevention** on reprocess | Pipeline | Double-counted transactions |
| A3 | **Opening/closing balance not validated** — AI-detected or first/last tx balance used without verification | `computeStatementMetadata()` | Incorrect reconciliation |
| A4 | **Python BAS ignores GST categories** — ALL income counted as G1 taxable sales | `bas_agent.py:449-462` | Incorrect BAS lodgement |
| A5 | **`Interest & Dividends` in both GST_FREE and INPUT_TAXED** category sets | Category conflict | Ambiguous GST treatment |

### TypeScript (T1)

| # | Finding | Location | Impact |
|---|---------|----------|--------|
| T1 | **`wrapPgDb()` returns `any`** — every DB query untyped | `schema.ts:26` | No compile-time safety |
| T2 | **`parseInt()` on UUID strings** → `NaN` → `0` | `routes/agents.ts:87,95,128` | Agents receive wrong record IDs |
| T3 | **25+ Zod schemas defined but never imported** | `validation/index.ts` | All API inputs unvalidated |

### Parser (T3)

| # | Finding | Location | Impact |
|---|---------|----------|--------|
| P1 | **Non-deterministic year inference** via `new Date()` | `cba.ts:265`, `cba-credit.ts:300` | Same PDF → different dates |
| P2 | **Pipeline ignores parser `extractAccountInfo()`** — uses AI instead | `pipeline.ts:177` | Wasted parser logic, AI errors |
| P3 | **CSV CBA sign convention likely double-inverted** | `csv-parser.ts:58` | Wrong transaction signs |

### RAG & Cognee (T5, T6)

| # | Finding | Location | Impact |
|---|---------|----------|--------|
| R1 | **Entire local RAG pipeline (~3,500 LOC) is dead code** | `rag/search/`, `rag/reranking/`, etc. | Sophisticated pipeline unused |
| R2 | **Categorizer learning loop broken** — never stores new mappings back to Cognee | Agent categorizer | No improvement over time |
| R3 | **Three separate Cognee clients** with inconsistent protocols | `cogneeTools`, `ragService`, `cogneeClient` | Silent failures, wrong data format |
| R4 | **Embedding dimension mismatch** — Docker 1536d vs Python SDK 384d | Config inconsistency | Garbage search results |
| R5 | **Dataset namespace mismatch** — seeds to wrong dataset names | `cognee_service.py` vs `cognee_client.ts` | Seeded data invisible |

### Python Orchestrator (T9)

| # | Finding | Location | Impact |
|---|---------|----------|--------|
| O1 | **Entire Python subprocess orchestrator is unused** — routes import TS Claude agents only | `routes/agents.ts` imports | ~2,000 LOC dead code |
| O2 | **`pydantic-ai` missing from requirements.txt** | `requirements.txt` | All Python agents fail to import |
| O3 | **Communication protocol mismatch** — TS sends env var/stdin, Python expects function args | `orchestrator.ts` vs `base.py` | Complete communication failure |

### Docker (T8)

| # | Finding | Location | Impact |
|---|---------|----------|--------|
| D1 | **Missing migration files** in Docker init — 31 tables + GST columns missing on fresh deploy | `docker-compose.yml` volumes | Broken fresh deployment |
| D2 | **Server container runs as root** (`uid=0`) | `server/Dockerfile` | Privilege escalation risk |

### Enrichment (T7)

| # | Finding | Location | Impact |
|---|---------|----------|--------|
| E1 | **ABN lookup is a stub** — always returns `abnFound: false` | `merchant-intelligence.ts:236-259` | No real ABN resolution |
| E2 | **Google Places adapter does not exist** | Zero references | No geocoding/place enrichment |

---

## P1 HIGH FINDINGS (Fix Soon)

| Area | Finding | Location |
|------|---------|----------|
| Security | 1,273 lines security infrastructure never wired | `middleware/security.ts`, `middleware/audit.ts` |
| Accuracy | Balance invariant (`opening + sum = closing`) never validated in pipeline | Reconciler never auto-invoked |
| Accuracy | Transfer detection failure is non-fatal — leaves txs as income/expense | Silent failure path |
| Accuracy | Enrichment overwrites user-edited GST fields (doesn't check `isEdited`) | `enrichment.ts` |
| Accuracy | Python and TS GST-free category lists diverge significantly | Cross-system inconsistency |
| TypeScript | 30+ explicit `as any` casts in route handlers | `index.ts` throughout |
| TypeScript | Client-server type divergence (missing GST fields, naming conventions) | `api.ts` vs `schema.ts` |
| TypeScript | Duplicate route registrations (dead code) | `index.ts:439/461` vs `677/701` |
| Parser | 6 of 7 non-CBA bank parsers have section-end bug → phantom transactions | All non-CBA parsers |
| Parser | Credit card payment amounts CR suffix sign conflict | Credit card parsers |
| Parser | No provenance fields (`parser_version`, `extraction_hash`) anywhere | All parsers |
| Cognee | No request timeouts on Cognee fetch calls | `cognee_client.ts` |
| Cognee | JSON vs multipart disagreement for `/api/v1/add` | `cognee_client.ts` vs `rag.ts` |
| RAG | `cogneeTools.index()` sends JSON but Cognee expects multipart — indexing silently fails | `cognee-tools.ts` |
| RAG | No per-tool circuit breaker — failing Cognee consumes entire tool budget | `base-agent.ts` |
| RAG | Local RAG has SQLite FTS5 syntax incompatible with PostgreSQL | `sparse-search.ts` |
| Enrichment | No merchant-level caching — agents fire unconditionally | `enrichment.ts` |
| Enrichment | Cognee writes append-only — duplicate merchant mappings | `cognee_client.ts` |
| Enrichment | ABN/industry fields from agent output ignored | `enrichment.ts:101-107` |
| Docker | No health checks on server/cognee/client services | `docker-compose.yml` |
| Docker | SSE nginx mismatch — `/events` has config but client uses `/api/events` | `nginx.conf` |
| Docker | `npm install` instead of `npm ci` — non-reproducible builds | Dockerfiles |
| Python | GST classification divergence between TS and Python | Different keyword sets |
| Python | Circuit breaker in `health.ts` is dead code — never integrated | `health.ts` |

---

## PRIORITIZED REMEDIATION PLAN

### Phase 1: Critical Security (Days 1-2)

1. **Sanitize file upload paths** — validate filename, use UUID-based storage names
2. **Add file type validation** — use the already-installed `magika` package
3. **Restrict CORS** — whitelist specific origins
4. **Fix rate limiter** — use connection IP, not `x-forwarded-for`
5. **Remove hardcoded JWT secret** — require env var, fail on startup if missing

### Phase 2: Wire Existing Infrastructure (Days 3-5)

6. **Import and apply security middleware** (`middleware/security.ts`) — OWASP headers already written
7. **Import and apply audit middleware** (`middleware/audit.ts`) — audit logging already written
8. **Import and wire Zod validation** (`validation/index.ts`) — 25+ schemas already written
9. **Consolidate Cognee clients** — merge three clients into one with correct multipart + consistent search

### Phase 3: Accuracy Fixes (Days 5-8)

10. **Fix `||` to `??` in bas.ts:240** — prevents GST-free corruption
11. **Add transaction dedup** — hash(date + description + amount + accountId) on insert
12. **Validate balance invariant** — `opening + sum(tx) = closing` in pipeline
13. **Fix category conflict** — remove `Interest & Dividends` from one of GST_FREE/INPUT_TAXED
14. **Wire parser `extractAccountInfo()`** — use parser output instead of AI for account detection

### Phase 4: Parser & Determinism (Days 8-12)

15. **Fix year inference** — derive from statement period dates, not `new Date()`
16. **Add provenance fields** — `parser_version`, `extraction_hash` on every parsed transaction
17. **Fix section-end bug** in non-CBA parsers
18. **Fix CSV sign convention** for CBA

### Phase 5: Integration & Enrichment (Days 12-18)

19. **Connect local RAG pipeline** — or remove 3,500 LOC if not needed
20. **Fix categorizer learning loop** — store new mappings back to Cognee
21. **Implement real ABN lookup** — RapidAPI or official ABR API
22. **Add Google Places adapter** — or deprioritize if not needed
23. **Fix Cognee namespace mismatch** — align seed datasets with query datasets
24. **Fix embedding dimension mismatch** — standardize on text-embedding-3-small

### Phase 6: Docker & Deployment (Days 18-20)

25. **Add missing migrations** to Docker init pipeline (0007, 0008, GST columns)
26. **Fix server Dockerfile** — add non-root user
27. **Add health checks** to all services in compose
28. **Fix nginx SSE routing** — `/api/events` needs `proxy_buffering off`
29. **Switch to `npm ci`** in Dockerfiles

### Phase 7: Python System Decision (Backlog)

30. **Decide:** Connect Python agents to routes, OR remove them entirely
31. If keeping: fix `pydantic-ai` dependency, communication protocol, response format
32. If keeping: align GST/BAS rules with TS implementations

---

## ARCHITECTURAL OBSERVATIONS

### What Works Well
- Drizzle ORM schema is comprehensive (845 lines, 45+ tables)
- Claude agent base class is well-designed (bounded loops, token budgets, circuit breakers)
- Security middleware code quality is high (just needs connecting)
- Local RAG pipeline architecture is sophisticated (dense/sparse/fusion/reranking)
- Docker networking and volume persistence are correct

### Structural Decisions Needed
1. **Single vs Dual Agent System** — TS Claude agents are production; Python agents are prototype. Choose one.
2. **Cognee Client Consolidation** — Three clients doing the same thing differently. Merge them.
3. **Local RAG vs Cognee RAG** — ~3,500 LOC local pipeline exists alongside Cognee. Pick a strategy.
4. **Bank Parser Investment** — Only CBA is production-grade. Other 7 are scaffolds. Prioritize based on user needs.

---

## INDIVIDUAL AUDIT REPORTS

| Report | File |
|--------|------|
| T1: TypeScript & API Contracts | [TYPESCRIPT_API_CONTRACT_AUDIT.md](TYPESCRIPT_API_CONTRACT_AUDIT.md) |
| T2: Security & Abuse Resistance | [SECURITY_AUDIT.md](SECURITY_AUDIT.md) |
| T3: Parser Correctness & Determinism | [PARSER_DETERMINISM_AUDIT.md](PARSER_DETERMINISM_AUDIT.md) |
| T4: Accuracy Invariants & Reconciliation | [ACCURACY_INVARIANTS.md](ACCURACY_INVARIANTS.md) |
| T5: Cognee Storage & Graph Persistence | [COGNEE_STORAGE_GRAPH_PERSISTENCE.md](COGNEE_STORAGE_GRAPH_PERSISTENCE.md) |
| T6: RAG & Tooling Integration | [RAG_COGNEE_TOOLS_AUDIT.md](RAG_COGNEE_TOOLS_AUDIT.md) |
| T7: ABN + Places Enrichment | [ENRICHMENT_ABN_PLACES.md](ENRICHMENT_ABN_PLACES.md) |
| T8: Docker Deployment & E2E | [DEPLOYMENT_E2E_REPORT.md](DEPLOYMENT_E2E_REPORT.md) |
| T9: Python Orchestrator Alignment | [PYTHON_ORCHESTRATOR_AUDIT.md](PYTHON_ORCHESTRATOR_AUDIT.md) |

---

*Generated by 9-teammate audit team on 2026-02-11*
