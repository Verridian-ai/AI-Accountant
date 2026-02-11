# Docker Deployment & E2E Runtime Verification Report

**Auditor:** Teammate 8 — Docker Deployment & E2E Runtime Verifier
**Date:** 2026-02-11
**Scope:** Docker Compose, Dockerfiles, migrations, SSE, nginx, volumes, environment variables, runtime state

---

## Executive Summary

The Docker stack is running with all 4 services operational. The architecture is sound — PostgreSQL with pgvector, Cognee knowledge graph, Hono API server, and React nginx frontend are properly networked and communicating. However, there are **critical migration gaps**, **security concerns** (container runs as root, API keys in env), and **missing migration automation** that would cause failures on a fresh deployment.

| Area | Status | Severity |
|------|--------|----------|
| docker-compose.yml structure | PASS | — |
| Service health & networking | PASS | — |
| Postgres init scripts | PASS with gaps | Medium |
| Migration automation | FAIL | **Critical** |
| Dockerfile security (server) | FAIL | High |
| nginx SSE passthrough | PASS | — |
| Volume persistence | PASS | — |
| Environment variable passing | PASS with issues | Medium |

---

## 1. Docker Compose Completeness

**File:** `docker-compose.yml` (183 lines)

### Services Configured: 4/4

| Service | Image / Build | Ports | Health Check | depends_on | Restart |
|---------|--------------|-------|--------------|------------|---------|
| postgres | pgvector/pgvector:pg17 | 5432:5432 | `pg_isready` (5s interval, 15 retries, 30s start_period) | — | unless-stopped |
| cognee | Built from `./cognee-repo` | 8000:8000 | None | postgres (service_healthy) | unless-stopped |
| server | Built from `./server` | 3501:3501 | None | postgres (service_healthy) | unless-stopped |
| client | Built from `./client` | 8080:80 | None | server (service_started) | unless-stopped |

### Findings

- **PASS:** All 4 services properly defined with appropriate `depends_on` conditions
- **PASS:** Postgres uses `service_healthy` condition so downstream services wait for readiness
- **PASS:** Single bridge network `cba-network` connecting all services
- **PASS:** Resource limits on cognee (2 CPUs, 4GB RAM) — appropriate for knowledge graph workloads
- **ISSUE [Medium]:** No health checks on `server`, `cognee`, or `client` services in compose. If the server crashes after startup, Docker won't auto-restart until OOM or process exit
- **ISSUE [Low]:** `cognee` has no health check; `depends_on` for server/client doesn't wait for cognee to be ready, which could cause initial Cognee API calls to fail
- **ISSUE [Low]:** Postgres port 5432 is exposed to host — acceptable for dev, but should be internal-only in production

---

## 2. Postgres Init Scripts — Execution Order

Docker `initdb.d` scripts run in alphabetical order on **first initialization only**.

| Order | File | Purpose |
|-------|------|---------|
| 01 | `01-cba-schema.sql` (→ `0006_postgres_migration.sql`) | Creates all 14 core tables, indexes, triggers, helper functions |
| 02 | `02-extensions.sql` (→ `docker/init-cognee-db.sql`) | Enables `uuid-ossp`, `pg_trgm`, `vector` extensions in `ai_accountant` |
| 03 | `03-cognee-db.sh` (→ `docker/init-cognee-db.sh`) | Creates `cognee_db` database + enables `vector`, `uuid-ossp` extensions |

### Findings

- **PASS:** Scripts are numbered correctly and will execute in proper order
- **PASS:** `init-cognee-db.sh` uses `set -e` for fail-fast behavior
- **PASS:** Extensions (`uuid-ossp`, `pg_trgm`, `vector`) created in `ai_accountant` DB
- **PASS:** Separate `cognee_db` created for Cognee with vector extension
- **ISSUE [Critical]:** `0007_missing_tables.sql` (31 additional tables) is **NOT mounted** in `docker-entrypoint-initdb.d/`. Only `0006` is mounted. On a fresh deployment, tables like `business_profiles`, `bas_periods`, `bas_calculations`, `tax_codes`, `tax_brackets`, `deductions`, `cgt_assets`, `audit_log`, `sessions`, `teams`, etc. will be **missing**
- **ISSUE [Critical]:** `0008_account_ownership.sql` (adds `ownership_tag` to accounts, `is_owner_contribution` to transactions) is **NOT mounted**. The server's Drizzle schema includes these columns, causing `42703` errors ("column does not exist") at runtime
- **ISSUE [Medium]:** `migrations/v2_tables.sql` (adds `gst_learning_rules`, `budgets`, `recurring_patterns`, etc.) is not mounted or referenced anywhere in Docker setup
- **EVIDENCE:** Postgres logs confirm the column errors at startup:
  ```
  ERROR: column "ownership_tag" does not exist at character 266
  ERROR: column "is_owner_contribution" does not exist at character 208
  ```
  These were manually fixed on the running instance (columns now exist), but a fresh `docker compose up` would reproduce the errors.

---

## 3. Drizzle Migration Coverage

### Migration Files Present

| File | Tables Created | Columns Added |
|------|---------------|---------------|
| `0006_postgres_migration.sql` | 14 tables: users, user_settings, accounts, account_balance_history, statements, statement_accounts, transactions, transaction_history, transfer_links, user_categories, merchant_memory, pending_categorization, reconciliation_alerts, debt_payoff_scenarios | Core schema |
| `0007_missing_tables.sql` | 31 tables: business_profiles, bas_periods, bas_calculations, tax_codes, tax_brackets, deductions, cgt_assets, cgt_events, depreciable_assets, depreciation_schedule, tax_year_summary, audit_log, sessions, teams, team_members, team_invitations, subscriptions, export_history, parser_metrics, parser_accuracy_aggregates, parser_feedback, chart_of_accounts, journal_entries, journal_entry_lines, accounting_periods, account_balances, rag_namespaces, rag_chunks, rag_documents, rag_citations, upload_queue | — |
| `0008_account_ownership.sql` | — | `accounts.ownership_tag`, `transactions.is_owner_contribution` |
| `migrations/v2_tables.sql` | gst_learning_rules, budgets, recurring_patterns + ALTER TABLE additions | `gst_amount`, `gst_category` on transactions |

### Schema vs. Database Comparison

**Verified at runtime** (45 tables in `ai_accountant` DB):
- All 14 core tables from `0006` present
- All 31 tables from `0007` present (manually applied at some point)
- `ownership_tag` and `is_owner_contribution` columns present (manually applied)
- `gst_amount` and `gst_category` columns present on transactions

### Findings

- **ISSUE [Critical]:** `gst_amount` and `gst_category` are NOT in `0006_postgres_migration.sql` (the transactions CREATE TABLE). They exist in the Drizzle schema (`schema.ts:211-212`) and in the live DB but have no migration file that adds them via `ALTER TABLE`. The `v2_tables.sql` may have been applied manually but is not in the Docker init pipeline
- **ISSUE [Critical]:** No automated migration runner. The server does not run migrations on startup — it relies on Postgres `initdb.d` scripts which only execute on first container creation. Schema changes require manual SQL execution
- **ISSUE [Medium]:** `migrate-to-postgres.ts` exists but is not referenced in any Dockerfile CMD or startup script

---

## 4. Dockerfile Audit

### Root Dockerfile (Google Cloud Run variant)

**File:** `./Dockerfile` (42 lines)

| Aspect | Status | Details |
|--------|--------|---------|
| Base image | node:20-alpine | Good — minimal image |
| Non-root user | PASS | Creates `nodejs:1001` user, sets ownership |
| Dependencies | Includes python3, make, g++ | Needed for native modules |
| Health check | PASS | `curl -f http://localhost:${PORT}/health` |
| Port | 8080 | Cloud Run default |

**Note:** This Dockerfile is for Cloud Run deployment, not used by Docker Compose.

### Server Dockerfile (`server/Dockerfile`)

**File:** `server/Dockerfile` (31 lines)

| Aspect | Status | Details |
|--------|--------|---------|
| Base image | node:20-slim | Reasonable — includes system libs |
| Non-root user | **FAIL** | Runs as root (confirmed: `uid=0(root)`) |
| Python | Installed (python3, pip, venv) | Verified: Python 3.11.2 |
| Dependencies | `npm install` (not `npm ci`) | Uses non-deterministic install |
| Health check | **MISSING** | No HEALTHCHECK instruction |
| COPY scope | `COPY . .` | Copies entire context including potential secrets |
| Port | 3501 | Correct |

**Findings:**
- **ISSUE [High]:** Server container runs as **root** (`uid=0`). The root Dockerfile has proper non-root user setup, but `server/Dockerfile` does not
- **ISSUE [Medium]:** Uses `npm install` instead of `npm ci` — not reproducible across builds
- **ISSUE [Medium]:** `COPY . .` copies everything including `.env`, test files, etc. No `.dockerignore` was checked
- **ISSUE [Low]:** No HEALTHCHECK in Dockerfile (compose could add one, but doesn't)

### Client Dockerfile (`client/Dockerfile`)

**File:** `client/Dockerfile` (36 lines)

| Aspect | Status | Details |
|--------|--------|---------|
| Multi-stage | PASS | Builder (node:20-alpine) → Production (nginx:alpine) |
| Build arg | `VITE_API_URL` (empty = use nginx proxy) | Correct |
| nginx config | Copies `nginx.conf` to `/etc/nginx/conf.d/default.conf` | Correct |
| Dependencies | `npm install` (not `npm ci`) | Non-deterministic |
| Non-root | Inherits nginx default (nginx user) | Acceptable |

---

## 5. Nginx Configuration

**File:** `client/nginx.conf` (50 lines)

### Proxy Routes

| Location | Upstream | Special Config |
|----------|----------|----------------|
| `/` | Static files | SPA fallback (`try_files $uri $uri/ /index.html`) |
| `/api/` | `http://server:3501` | Standard proxy headers |
| `/auth/` | `http://server:3501` | Standard proxy headers |
| `/events` | `http://server:3501` | SSE-specific config |
| Static assets | — | 1-year cache with `immutable` |

### SSE Passthrough

```nginx
location /events {
    proxy_pass http://server:3501;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_buffering off;
    proxy_cache off;
}
```

**Findings:**
- **PASS:** SSE endpoint properly configured with `proxy_buffering off` and `proxy_cache off`
- **PASS:** HTTP/1.1 with empty `Connection` header (required for SSE)
- **ISSUE [Medium]:** The SSE endpoint in nginx is `/events` but the server serves it at `/api/events`. The nginx location `/events` will proxy to `http://server:3501/events` (not `/api/events`). The client likely connects to `/api/events` which hits the `/api/` location block — that block does **NOT** have SSE-specific config (`proxy_buffering off`). SSE may still work through `/api/events` but with buffering enabled, causing delayed event delivery
- **PASS:** Gzip compression enabled for common static types

---

## 6. SSE Event Handling

**Server-side** (`server/src/events.ts` + `server/src/index.ts:998-1029`)

| Aspect | Status | Details |
|--------|--------|---------|
| Event types | 14 structured types | batch_progress, parsing_complete, transfer_detected, enrichment_status, vision_verification, pipeline_error, statement_updated, transactions_updated, accounts_updated, bas_updated, tax_updated, merchant_memory_updated, account_setup_needed, statement_added |
| Dual channel | PASS | Sends on both `update` (legacy) and typed event channel |
| Keep-alive | PASS | 30-second interval keep-alive comments |
| Cleanup | PASS | `stream.onAbort()` removes listener and clears interval |
| Auth | Token via query param | EventSource doesn't support headers, so `?token=JWT` is used |
| Max listeners | 100 | `emitter.setMaxListeners(100)` |

**Findings:**
- **PASS:** Well-structured SSE with proper typed events
- **PASS:** Keep-alive prevents proxy/load balancer timeouts
- **PASS:** Proper cleanup on client disconnect
- **ISSUE [Low]:** No reconnection ID (`Last-Event-ID`) support — clients will miss events if disconnected

---

## 7. Volume Persistence

| Volume | Mount Point | Purpose |
|--------|-------------|---------|
| `postgres-data` (named) | `/var/lib/postgresql/data` | Database persistence |
| `cognee-data` (named) | `/app/.cognee_system` | Cognee knowledge graph data |
| `./statements` (bind mount) | `/statements` on server | PDF test files (host → container) |

**Findings:**
- **PASS:** Named volumes for persistent data (survive `docker compose down`)
- **PASS:** Volumes verified:
  - `cbastatementsparse_postgres-data` exists
  - `cbastatementsparse_cognee-data` exists
- **PASS:** Statements bind mount working — 29 PDFs visible inside server container at `/statements/`
- **ISSUE [Low]:** No volume for server `uploads/` directory. Uploaded files stored inside the container will be lost on rebuild
- **ISSUE [Low]:** `cognee-data` volume is at `/app/.cognee_system` — if Cognee stores Kuzu graph data elsewhere, it may be lost

---

## 8. Environment Variable Passing

### .env.example vs. docker-compose.yml

| Variable | In .env.example | Used in compose | Verified in container |
|----------|----------------|-----------------|----------------------|
| POSTGRES_USER | Yes | Yes (default: app_user) | Yes |
| POSTGRES_PASSWORD | Yes | Yes (no default!) | Yes |
| POSTGRES_DB | Yes | Yes (default: ai_accountant) | Yes |
| VITE_OPENROUTER_API_KEY | Yes | Yes (cognee + server) | Yes |
| VITE_OPENAI_API_KEY | Yes | Yes (server) | Not checked |
| ANTHROPIC_API_KEY | Yes | Yes (server) | Yes |
| JWT_SECRET | Yes | Yes (default provided) | Yes |
| USE_CLAUDE_AGENTS | Yes | Yes (default: true) | Yes (true) |
| USE_COGNEE | Yes | Yes (default: true) | Yes (true) |
| CLAUDE_MODEL | Yes | Yes (default: claude-sonnet-4-5-20250929) | Not in env output |
| COGNEE_API_URL | — | Hardcoded: http://cognee:8000 | Yes |
| DATABASE_URL | Yes | Constructed in compose | Yes |

### Findings

- **PASS:** All critical environment variables are being passed through correctly
- **ISSUE [High]:** `.env.example` sets `USE_CLAUDE_AGENTS=false` and `USE_COGNEE=false` but docker-compose.yml defaults to `true` for both. A user copying `.env.example` to `.env` will get conflicting behavior depending on whether they remove or keep those lines
- **ISSUE [Medium]:** `.env.example` has `ENABLE_BACKEND_ACCESS_CONTROL=true` but docker-compose.yml hardcodes `ENABLE_BACKEND_ACCESS_CONTROL=false` for cognee. The compose file overrides the env value
- **ISSUE [Medium]:** `POSTGRES_PASSWORD` has no default in compose but has a weak default in `.env.example` (`change-me-in-production`). A missing `.env` file would cause a blank password
- **ISSUE [Low]:** Several `.env.example` variables are not used in compose: `AGENT_*` per-agent toggles, `AGENT_MAX_RETRIES`, `AGENT_TIMEOUT_MS`, `CLAUDE_VISION_MODEL`

---

## 9. Runtime Verification

### Service Status (at audit time)

```
NAME           STATUS                    PORTS
cba-client     Up 14 minutes             0.0.0.0:8080->80/tcp
cba-cognee     Up 14 minutes             0.0.0.0:8000->8000/tcp
cba-postgres   Up 14 minutes (healthy)   0.0.0.0:5432->5432/tcp
cba-server     Up 14 minutes             0.0.0.0:3501->3501/tcp
```

### Endpoint Tests

| Endpoint | Method | Result | Notes |
|----------|--------|--------|-------|
| `http://localhost:8080` | GET | 200 | Client serving correctly |
| `http://localhost:3501/health` | GET | 200 | `{"status":"healthy","timestamp":"..."}` |
| `http://localhost:3501/api/transactions` | GET | 401 | JWT required — auth working |
| `http://localhost:8080/api/events` | GET | 401 (Unauthorized) | SSE requires JWT token |

### Network

All 4 containers on `cba-network`: cba-cognee, cba-postgres, cba-server, cba-client

### Database State

- 45 tables in `ai_accountant` database
- Extensions: `uuid-ossp`, `pg_trgm`, `vector` (pgvector 0.8.1)
- `cognee_db` has: `uuid-ossp`, `vector`
- All columns including `gst_amount`, `gst_category`, `ownership_tag`, `is_owner_contribution` present (manually applied)

### Cognee State

- Cognee startup successful with FastAPI deprecation warnings (non-blocking)
- Knowledge graph empty but service responsive
- Warning: `Dataset 'bank_transactions' has 2 data item(s) but the knowledge graph is empty. Please run cognify to process the data before searching.`

---

## 10. Test PDF Files

**Location:** `./statements/` (bind-mounted to `/statements/` in server container)

**Count:** 29 PDF files (UUID-named CBA bank statements)

<details>
<summary>Full file listing (29 files)</summary>

1. 096B4C33-4F7F-41B2-8B03-EA50CA97803F.pdf
2. 0C0E7411-972F-411C-8D55-DF5C07141757.pdf
3. 0F186BF0-7890-4C3A-9630-EAB55D89B8CD.pdf
4. 2F16135E-AE75-4038-B64A-2775677F4A91.pdf
5. 4F31D02B-89FC-45BA-947D-1858D626C954.pdf
6. 56DF890F-4DD5-496A-AE84-13FF89A9A61C.pdf
7. 5D3CF385-68AF-4520-8DDC-D266A8160C31.pdf
8. 5DDF65BE-9543-431E-8BE2-EC13BDC40490.pdf
9. 688331F3-0A24-426F-8698-932170A2ABFE.pdf
10. 6BCA5CC6-7279-458C-967B-817093BD0E87.pdf
11. 7D88272D-CF32-4EFC-B6F6-1638E9529FF5.pdf
12. 8A36502A-2979-4E27-AF77-2E551AB5E594.pdf
13. 9022793D-8D75-4924-8187-EF5CE3B6B268.pdf
14. 973C5576-2DFD-45B2-A1E9-83D507B81371.pdf
15. AB9FC11B-D941-4D67-A707-0452434671B6.pdf
16. ACFB5A3B-2E57-4B0E-A315-F7D44CA4DBCE.pdf
17. B3B55937-06A3-42AB-86FB-5808D1345E48.pdf
18. B61F2812-B7B3-47CF-A5B9-35C749631171.pdf
19. CC1B91CC-0814-4DD3-B102-7EB86CCAC120.pdf
20. CC6F3904-B8E6-435B-9608-C21E36494195 (2).pdf
21. CC6F3904-B8E6-435B-9608-C21E36494195.pdf
22. D4DAEB6B-95D5-4DA3-8547-24E62FF6BEA4.pdf
23. DC7C149C-EFF9-4264-A7E2-FED07576DA92.pdf
24. DEBCEC97-28EB-47A0-94CB-3F3391249409.pdf
25. E26E4F8E-08DD-4376-82B2-4227A322DED2.pdf
26. E7966FDF-25CA-49BF-AC10-AE2FC877C256.pdf
27. F1CE19AC-80C1-4F77-AD24-4B16FA4DC6F7.pdf
28. F6BE2709-90AD-472B-9F63-14AA11814B04.pdf
29. F966D0D2-5EE0-4598-A64D-328DE26E3687.pdf

</details>

**Note:** File #20 has a space and `(2)` suffix — duplicate of #21. This could cause issues with file path handling if not properly quoted.

---

## Critical Issues Summary

### P0 — Must Fix Before Fresh Deployment

| # | Issue | Impact | Fix |
|---|-------|--------|-----|
| 1 | `0007_missing_tables.sql` not mounted in Postgres `initdb.d` | 31 tables missing on fresh deploy, all BAS/tax/team/audit features broken | Mount as `04-missing-tables.sql` in compose volumes |
| 2 | `0008_account_ownership.sql` not mounted | `ownership_tag` and `is_owner_contribution` columns missing, causes `42703` errors on every page load | Mount as `05-account-ownership.sql` |
| 3 | `gst_amount` / `gst_category` columns have no migration in the init pipeline | GST features broken on fresh deploy | Add ALTER TABLE statements to a migration file and mount it |
| 4 | Server container runs as root | Container escape would give host-level access | Add non-root user to `server/Dockerfile` (copy pattern from root Dockerfile) |

### P1 — Should Fix

| # | Issue | Impact | Fix |
|---|-------|--------|-----|
| 5 | No health checks on server/cognee/client in compose | Docker can't detect and restart unhealthy services | Add health checks similar to postgres |
| 6 | SSE nginx location mismatch (`/events` vs `/api/events`) | SSE may be buffered through `/api/` location, causing delayed events | Change nginx location to `/api/events` or add `proxy_buffering off` to `/api/` block |
| 7 | `.env.example` defaults contradict compose defaults | User confusion on feature flags | Align defaults |
| 8 | `npm install` instead of `npm ci` in Dockerfiles | Non-reproducible builds | Use `npm ci` for production images |

### P2 — Nice to Have

| # | Issue | Impact | Fix |
|---|-------|--------|-----|
| 9 | No migration runner on server startup | Manual SQL execution required for schema changes | Add startup migration script |
| 10 | Postgres port exposed to host | Security surface in production | Remove port mapping or bind to localhost |
| 11 | No `Last-Event-ID` support in SSE | Missed events on reconnection | Implement event ID tracking |
| 12 | No `.dockerignore` audit | Potentially large build contexts | Add/verify `.dockerignore` files |

---

## 11. Agent Endpoints & Orchestrator Audit

### Claude Agent Registry (7 agents)

The orchestrator (`server/src/services/claude/orchestrator.ts`) registers 7 Claude agents:

| Agent Type | File | Purpose | Circuit Breaker |
|-----------|------|---------|----------------|
| `statement_parser` | `agents/statement-parser.ts` | Parse PDF text into structured transactions | Yes |
| `transaction_categorizer` | `agents/transaction-categorizer.ts` | Assign categories to transactions | Yes |
| `gst_calculator` | `agents/gst-calculator.ts` | Calculate GST amounts and categories | Yes |
| `account_reconciler` | `agents/account-reconciler.ts` | Reconcile balances across statements | Yes |
| `budget_analyzer` | `agents/budget-analyzer.ts` | Financial analysis and insights | Yes |
| `cross_account_tracer` | `agents/cross-account-tracer.ts` | Detect inter-account transfers | Yes |
| `merchant_intelligence` | `agents/merchant-intelligence.ts` | Merchant normalization and memory | Yes |

### Agent API Endpoints

| Endpoint | Method | Route Mounting | Auth |
|----------|--------|---------------|------|
| `/api/agents` | GET | `index.ts:1828` | JWT |
| `/api/agents/:type` | GET | `index.ts:1839` | JWT |
| `/api/agents/:type/run` | POST | `index.ts:1851` | JWT |
| `/api/agents/code/execute` | POST | `index.ts:1888` | JWT |
| `/api/agents/analyze-finances` | POST | `index.ts:1916` | JWT |
| `/api/agents/calculate-bas` | POST | `index.ts:1943` | JWT |
| `/api/agents/calculate-tax` | POST | `index.ts:1967` | JWT |
| `/api/agents/reconcile` | POST | `index.ts:1991` | JWT |
| `/api/claude-agents/analyze` | POST | `routes/agents.ts:19` | JWT |
| `/api/claude-agents/bas/calculate` | POST | `routes/agents.ts:49` | JWT |
| `/api/claude-agents/reconcile` | POST | `routes/agents.ts:109` | JWT |
| `/api/claude-agents/transfers/analyze` | POST | `routes/agents.ts:144` | JWT |

### Python Agents (14 files)

| File | Purpose |
|------|---------|
| `bas_agent.py` | BAS calculation logic |
| `cgt_calculator.py` | Capital Gains Tax |
| `code_interpreter.py` | Python code sandbox |
| `depreciation_calculator.py` | Asset depreciation schedules |
| `financial_analyst.py` | Financial analysis |
| `gst_rules.py` | GST rule application |
| `reconciliation_agent.py` | Balance reconciliation |
| `tax_agent.py` | Income tax calculation |
| `runner.py` | Agent execution runner |
| `config.py` | Agent configuration |
| `observability.py` | Logging/metrics |
| `base.py` | Base agent class |
| `tax_config.py` | Tax configuration |

**Findings:**
- **PASS:** All 7 Claude agents registered with individual circuit breakers (5 failures = trip, 60s recovery)
- **PASS:** Orchestrator emits SSE progress events (`started`, `completed`, `error`) for each agent invocation
- **PASS:** `isEnabled()` check prevents agent calls when `USE_CLAUDE_AGENTS=false`
- **ISSUE [Medium]:** `AgentType` defined in TWO places with DIFFERENT values:
  - `services/claude/types.ts`: 7 types (statement_parser, transaction_categorizer, gst_calculator, account_reconciler, budget_analyzer, cross_account_tracer, merchant_intelligence)
  - `services/agents.ts`: 4 types (financial_analyst, bas, tax, reconciliation)
  - These are separate systems (Claude vs Python agents) but share the type name, creating confusion
- **ISSUE [Medium]:** Duplicate endpoint patterns: `/api/agents/reconcile` (index.ts:1991) and `/api/claude-agents/reconcile` (routes/agents.ts:109) — both do reconciliation but via different agent systems
- **ISSUE [Low]:** `/api/agents/code/execute` allows arbitrary Python code execution — this is a security concern even behind JWT auth

### Orchestrator Pipeline

The `processStatement()` method in orchestrator.ts chains agents:
1. `statement_parser` → parse PDF text
2. `transaction_categorizer` → assign categories
3. `gst_calculator` → compute GST amounts

Each step uses the circuit breaker pattern. If any agent fails after 5 attempts, the breaker opens and the pipeline falls back to legacy AI (`aiService`).

---

## 12. Batch Processing & Queue System

**Endpoint:** `POST /api/statements/batch`
**Queue:** `server/src/services/queue.ts` — `BulkUploadQueue`

| Feature | Value |
|---------|-------|
| Max files per batch | 50 |
| Concurrent workers | 3 (default) |
| Retry on failure | 3 retries, exponential backoff |
| Queue persistence | In-memory (no persistence across restarts despite SQLite mention) |
| SSE events | `batch_progress` emitted for each file |
| Rate limiting | Bypassed for upload/retry endpoints |

**30-PDF Batch Test:** Not executed as a live test (would require JWT authentication and would mutate database state). The infrastructure is in place:
- 29 PDFs available in `/statements/` (not 30 — one is a duplicate with `(2)` suffix)
- Batch endpoint accepts up to 50 files
- Queue processes 3 files concurrently
- SSE events broadcast progress to all connected clients

---

## 13. Resource Baselines (Idle State)

Measured at audit time with services running but no active processing:

| Container | CPU | Memory | Memory Limit | PIDs | Net I/O |
|-----------|-----|--------|--------------|------|---------|
| cba-client | 0.00% | 34.8 MiB | 62.7 GiB (host) | 49 | 8.4 kB / 292 kB |
| cba-server | 0.21% | 67.8 MiB | 62.7 GiB (host) | 32 | 72.2 kB / 65.2 kB |
| cba-cognee | 3.73% | 312.8 MiB | 4 GiB (capped) | 105 | 193 kB / 39.7 kB |
| cba-postgres | 0.00% | 32.0 MiB | 62.7 GiB (host) | 7 | 52.7 kB / 42.5 kB |
| **Total** | **~4%** | **~447 MiB** | — | **193** | — |

**Findings:**
- **PASS:** Total idle memory under 500 MiB — very reasonable for a 4-service stack
- **PASS:** Cognee properly capped at 4 GiB with resource limits
- **ISSUE [Low]:** Only cognee has resource limits in compose. Server/client/postgres have no memory limits — a memory leak could consume all host RAM
- **NOTE:** Cognee uses 312.8 MiB idle — the largest consumer. During cognify operations this will grow significantly
- **NOTE:** Client has 49 PIDs (nginx workers) — default auto-detection, appropriate for the host

---

## Recommendations

1. **Create a unified migration runner:** Either mount all SQL files in `initdb.d` with proper ordering, or add a server startup script that runs pending migrations via Drizzle
2. **Add non-root user to server Dockerfile:** Copy the pattern from the root `Dockerfile` (addgroup/adduser, chown, USER directive)
3. **Add health checks to all services in compose:**
   - server: `curl -f http://localhost:3501/health`
   - client: `curl -f http://localhost:80`
   - cognee: `curl -f http://localhost:8000/` (needs curl installed)
4. **Fix nginx SSE routing:** Add `proxy_buffering off; proxy_cache off;` to the `/api/` location block, or create a specific `/api/events` location
5. **Align `.env.example` with compose defaults** to prevent confusion
6. **Add resource limits to server and postgres** in docker-compose.yml to prevent unbounded memory growth
7. **Consolidate agent endpoint patterns** — the duplicate reconcile endpoints (`/api/agents/reconcile` vs `/api/claude-agents/reconcile`) and dual AgentType definitions should be unified
8. **Add queue persistence** — the bulk upload queue claims SQLite-backed persistence but operates in-memory; server restarts lose queue state
