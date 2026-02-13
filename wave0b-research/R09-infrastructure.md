# R09: Docker & Infrastructure Analysis — Complete Report

## 1. Current Infrastructure

### 1.1 Docker Compose Topology (5 Services)

| Service | Image | Container | Port(s) | Depends On | Health Check |
|---------|-------|-----------|---------|------------|--------------|
| **postgres** | `pgvector/pgvector:pg17` | `cba-postgres` | 5432:5432 | — | `pg_isready` every 5s, 15 retries, 30s start |
| **redis** | `redis:7-alpine` | `cba-redis` | 6379:6379 | — | `redis-cli ping` every 10s, 5 retries, 10s start |
| **cognee** | Built from `./cognee-repo` | `cba-cognee` | 8000:8000 | postgres (healthy) | Python urllib `http://localhost:8000/api/v1/settings` every 30s, 60s start |
| **server** | Built from `./server/Dockerfile` | `cba-server` | 3501 (internal only) | postgres (healthy), redis (healthy) | `curl http://localhost:3501/health` every 30s |
| **client** | Built from `./client/Dockerfile` | `cba-client` | 8080:80 | server | `curl http://localhost:80` every 30s |

### 1.2 Volumes

| Volume | Mount Point | Purpose |
|--------|-------------|---------|
| `postgres-data` | `/var/lib/postgresql/data` | PostgreSQL persistent storage |
| `redis-data` | `/data` | Redis AOF persistence |
| `cognee-data` | `/app/.cognee_system` | Cognee Kuzu graph DB + system data |

### 1.3 Network

- Single bridge network: `cba-network`
- All 5 services on this network
- Server port 3501 NOT exposed externally (nginx proxies)

### 1.4 Bind Mounts (Host → Container)

| Host Path | Container Path | Service |
|-----------|---------------|---------|
| `./statements` | `/statements` | server |
| `./server/drizzle/0006_postgres_migration.sql` | `/docker-entrypoint-initdb.d/01-cba-schema.sql` | postgres |
| `./docker/init-cognee-db.sql` | `/docker-entrypoint-initdb.d/02-extensions.sql` | postgres |
| `./docker/init-cognee-db.sh` | `/docker-entrypoint-initdb.d/03-cognee-db.sh` | postgres |
| `./server/drizzle/0007_missing_tables.sql` | `/docker-entrypoint-initdb.d/04-missing-tables.sql` | postgres |
| `./server/drizzle/0008_account_ownership.sql` | `/docker-entrypoint-initdb.d/05-account-ownership.sql` | postgres |
| `./docker/migrations/0009_complete_schema.sql` | `/docker-entrypoint-initdb.d/06-complete-schema.sql` | postgres |
| `./docker/migrations/0010_add_missing_columns.sql` | `/docker-entrypoint-initdb.d/07-add-missing-columns.sql` | postgres |
| `./docker/migrations/0011_final_schema_sync.sql` | `/docker-entrypoint-initdb.d/08-final-schema-sync.sql` | postgres |
| `./docker/migrations/0012_tax_return_platform.sql` | `/docker-entrypoint-initdb.d/09-tax-return-platform.sql` | postgres |

### 1.5 PostgreSQL Configuration

- **Image**: pgvector/pgvector:pg17 (includes vector extension)
- **Extensions enabled** (via `init-cognee-db.sql`): `uuid-ossp`, `pg_trgm`, `vector`
- **Databases**: `ai_accountant` (CBA app, default), `cognee_db` (Cognee knowledge graph)
- **Cognee DB setup**: `init-cognee-db.sh` creates `cognee_db` + enables `vector`/`uuid-ossp`
- **Env defaults**: user=`app_user`, db=`ai_accountant`, password from `.env`

### 1.6 Redis Configuration

- **Command**: `redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru`
- **Persistence**: AOF (append-only file)
- **Memory**: 256MB hard cap, LRU eviction
- **Current usage**: Only `cognee-sessions.ts` (CogneeSessionService) uses Redis:
  - Session management (key prefix `cognee:session:`)
  - Query result caching (key prefix `cognee:cache:query:`)
  - Sliding-window rate limiting (key prefix `cognee:ratelimit:`)
- **Library**: `ioredis` v5.9.2 in server
- **NOT currently used for**: Pub/sub, job queues, general caching, SSE fan-out

### 1.7 Server Dockerfile

- **Base**: `node:20-slim`
- **Python**: Installed for Claude agent services (python3, pip, venv)
- **Non-root user**: `nodeuser:nodejs` (UID/GID 1001)
- **Entry point**: `node --import tsx/esm src/index.ts` (dev-friendly, uses tsx for TS execution)
- **Upload dir**: `/app/uploads` (writable by nodeuser)
- **Prod alternative**: `Dockerfile.prod` — multi-stage build, no Python, port 8080, Cloud Run compatible

### 1.8 Client Dockerfile

- **Builder**: `node:20-alpine`, `npm ci`, `npm run build`
- **Runner**: `nginx:alpine`, serves from `/usr/share/nginx/html`
- **Build arg**: `VITE_API_URL` (empty = use nginx proxy)

### 1.9 Nginx Configuration (`client/nginx.conf`)

| Location | Proxy Target | Special Config |
|----------|-------------|----------------|
| `/` | Static files | SPA fallback to `index.html` |
| `/api/events` | `server:3501` | **SSE**: `proxy_buffering off`, `proxy_cache off`, `chunked_transfer_encoding off`, 86400s read timeout |
| `/api/` | `server:3501` | Standard reverse proxy |
| `/auth/` | `server:3501` | Standard reverse proxy |
| `/events` | `server:3501` | Secondary SSE endpoint (buffering off) |
| Static assets | — | 1-year cache, immutable |

### 1.10 SSE Implementation (Current)

- **Server**: `events.ts` — Node.js `EventEmitter` (in-process, no Redis pub/sub)
- **Endpoint**: `GET /api/events` in `index.ts:1059`
- **Protocol**: Standard SSE with `event: update\ndata: ...\n\n` format
- **Keep-alive**: 30-second heartbeat
- **Event types**: 14 structured types (BatchProgress, ParsingComplete, TransferDetected, EnrichmentStatus, VisionVerification, PipelineError, StatementUpdated, TransactionsUpdated, AccountsUpdated, BASUpdated, TaxUpdated, MerchantMemoryUpdated, AccountSetupNeeded, StatementAdded)
- **Limitation**: EventEmitter is single-process; no horizontal scaling support

### 1.11 Environment Variables

#### Currently in `.env` / `.env.example`

| Variable | Category | Required | Default |
|----------|----------|----------|---------|
| `VITE_OPENROUTER_API_KEY` | AI | Yes | — |
| `VITE_OPENAI_API_KEY` | AI | No | — |
| `ANTHROPIC_API_KEY` | AI | Yes | — |
| `CLAUDE_MODEL` | AI | No | `claude-sonnet-4-5-20250929` |
| `CLAUDE_VISION_MODEL` | AI | No | `claude-sonnet-4-5-20250929` |
| `USE_CLAUDE_AGENTS` | Feature | No | `true` |
| `USE_COGNEE` | Feature | No | `false` (example) / `true` (docker) |
| `AGENT_STATEMENT_PARSER` | Feature | No | `true` |
| `AGENT_TRANSACTION_CATEGORIZER` | Feature | No | `true` |
| `AGENT_GST_CALCULATOR` | Feature | No | `true` |
| `AGENT_ACCOUNT_RECONCILER` | Feature | No | `true` |
| `AGENT_BUDGET_ANALYZER` | Feature | No | `true` |
| `AGENT_CROSS_ACCOUNT_TRACER` | Feature | No | `true` |
| `AGENT_MAX_RETRIES` | Tuning | No | `3` |
| `AGENT_TIMEOUT_MS` | Tuning | No | `60000` |
| `AGENT_MAX_TOOL_CALLS` | Tuning | No | `10` |
| `POSTGRES_HOST` | DB | No | `postgres` |
| `POSTGRES_PORT` | DB | No | `5432` |
| `POSTGRES_DB` | DB | No | `ai_accountant` |
| `POSTGRES_USER` | DB | No | `app_user` |
| `POSTGRES_PASSWORD` | DB | Yes | — |
| `DATABASE_URL` | DB | Auto | Constructed |
| `PGSSLMODE` | DB | No | `disable` |
| `JWT_SECRET` | Auth | Yes | — |
| `ABNLOOKUP_GUID` | Enrichment | No | — |
| `GOOGLE_API_KEY` | Enrichment | No | — |
| `GOOGLE_AI_STUDIO_KEY` | AI | No | — |
| `PORT` | Server | No | `3501` |
| `VITE_API_URL` | Client | No | `http://localhost:3501` |
| `REDIS_URL` | Cache | No | `redis://redis:6379` |
| `COGNEE_API_URL` | AI | No | `http://cognee:8000` |
| `NODE_ENV` | Server | No | `production` (Docker) |

#### Cognee Service Env Vars (in docker-compose.yml only)

| Variable | Value |
|----------|-------|
| `HOST` | `0.0.0.0` |
| `ENVIRONMENT` | `local` |
| `LLM_PROVIDER` | `custom` |
| `LLM_MODEL` | `openrouter/google/gemini-3-flash-preview` |
| `LLM_ENDPOINT` | `https://openrouter.ai/api/v1` |
| `LLM_API_KEY` | `${VITE_OPENROUTER_API_KEY}` |
| `EMBEDDING_PROVIDER` | `openai` |
| `EMBEDDING_MODEL` | `text-embedding-3-small` |
| `EMBEDDING_DIMENSIONS` | `1536` |
| `EMBEDDING_API_KEY` | `${VITE_OPENROUTER_API_KEY}` |
| `EMBEDDING_ENDPOINT` | `https://openrouter.ai/api/v1` |
| `DB_PROVIDER` | `postgres` |
| `VECTOR_DB_PROVIDER` | `pgvector` |
| `GRAPH_DATABASE_PROVIDER` | `kuzu` |
| `REQUIRE_AUTHENTICATION` | `false` |
| `ENABLE_BACKEND_ACCESS_CONTROL` | `false` |
| `TELEMETRY_DISABLED` | `1` |

### 1.12 Existing Migrations

**Located in `docker-entrypoint-initdb.d` (executed only on first PG init)**:

| Order | File | Source |
|-------|------|--------|
| 01 | `0006_postgres_migration.sql` | `server/drizzle/` |
| 02 | `init-cognee-db.sql` (extensions) | `docker/` |
| 03 | `init-cognee-db.sh` (cognee_db create) | `docker/` |
| 04 | `0007_missing_tables.sql` | `server/drizzle/` |
| 05 | `0008_account_ownership.sql` | `server/drizzle/` |
| 06 | `0009_complete_schema.sql` | `docker/migrations/` |
| 07 | `0010_add_missing_columns.sql` | `docker/migrations/` |
| 08 | `0011_final_schema_sync.sql` | `docker/migrations/` |
| 09 | `0012_tax_return_platform.sql` | `docker/migrations/` |

**Migration files that EXIST but are NOT wired into docker-compose.yml**:

| File | Purpose |
|------|---------|
| `0023_inventory_bank_recon.sql` | Wave 11 tables |
| `0024_fixed_assets_multi_entity.sql` | Wave 12 tables |
| `0025_financial_reporting.sql` | Wave 13 tables |
| `0026_ai_ocr_payment_matching.sql` | Wave 14 tables |
| `0028_cognee_datapoints.sql` | Wave 16 tables |
| `0029_temporal_intelligence.sql` | Wave 17 tables |

**CRITICAL**: Migrations 0013–0022 (Waves 1–10) do NOT exist yet. These are the migrations Waves 1–10 will create.

**Also missing**: Migration 0027 (Wave 15: Predictive Analytics & Compliance Monitoring)

### 1.13 Migration Runner Architecture

**Current approach**: PostgreSQL `docker-entrypoint-initdb.d/` — files only run on **first container start** (empty data volume). After initial setup, new migrations must be applied manually or via Drizzle Kit.

**Drizzle Kit**: Server has `db:generate` and `db:migrate` scripts but these use Drizzle's migration system, separate from Docker init scripts.

**PROBLEM**: No automatic migration runner for existing databases. Current approach requires `docker compose down -v` (wipe data) to apply new migrations.

---

## 2. Per-Wave Infrastructure Changes

### Wave 1: Chat → Agent Bridge & Intent Routing (Migration 0013)

**New env vars**:
| Variable | Purpose | Default |
|----------|---------|---------|
| `INTENT_ROUTING_MODEL` | Claude model for intent classification | `claude-haiku-4-5-20251001` |
| `INTENT_CONFIDENCE_THRESHOLD` | Min confidence for auto-routing | `0.7` |
| `MAX_CONVERSATION_CONTEXT` | Max messages in context window | `20` |

**Docker changes**: None (no new services)
**Migration**: `0013_agent_bridge_intent_routing.sql` — tables: `conversations`, `conversation_messages`, `agent_invocations`, `intent_routes`, `agent_capabilities` + sync 31 tables from schema.ts that only exist as Drizzle definitions
**Nginx**: No changes needed (SSE already configured for `/api/events`)

### Wave 2: Transaction Mutation & Streaming (Migration 0014)

**New env vars**:
| Variable | Purpose | Default |
|----------|---------|---------|
| `SSE_REDIS_CHANNEL` | Redis pub/sub channel for SSE fan-out | `sse:updates` |
| `SSE_USE_REDIS` | Enable Redis-backed SSE (vs in-process) | `false` |
| `MUTATION_AUDIT_ENABLED` | Log all agent-initiated mutations | `true` |

**Docker changes**: None (Redis already present)
**Key infrastructure change**: SSE EventEmitter → Redis pub/sub adapter for horizontal scaling readiness. The `events.ts` module should gain a Redis adapter that publishes to a channel when `SSE_USE_REDIS=true`. This is NOT required for single-instance but prepares for multi-instance.
**Redis usage**: New pub/sub channel `sse:updates` for broadcasting SSE events
**Migration**: `0014_transaction_mutations_streaming.sql` — tables: `agent_mutations`, `mutation_audit_log`, `streaming_sessions`

### Wave 3: Multi-User Cognee & Custom DataPoints (Migration 0015)

**New env vars**:
| Variable | Purpose | Default |
|----------|---------|---------|
| `COGNEE_DEFAULT_USER` | Default Cognee user for unauthenticated requests | `default` |
| `COGNEE_SESSION_TTL` | Session TTL in seconds | `1800` |
| `COGNEE_USER_ISOLATION` | Enable per-user dataset namespacing | `true` |
| `COGNEE_MAX_DATASETS_PER_USER` | Max datasets per user | `50` |

**Docker changes**:
- Cognee service: Change `ENABLE_BACKEND_ACCESS_CONTROL=false` → `ENABLE_BACKEND_ACCESS_CONTROL=true`
- Cognee service: Add `COGNEE_DEFAULT_USER=${COGNEE_DEFAULT_USER:-default}`

**Redis usage**: Extended use of `CogneeSessionService` for per-user session tracking
**Migration**: `0015_multiuser_cognee.sql` — tables: `cognee_user_datasets`, `cognee_user_sessions`, `cognee_namespace_mappings`

### Wave 4: Employee Management & Pay Structures (Migration 0016)

**New env vars**:
| Variable | Purpose | Default |
|----------|---------|---------|
| `TFN_ENCRYPTION_KEY` | AES-256-GCM key for TFN at-rest encryption | — (REQUIRED) |
| `TFN_ENCRYPTION_IV_LENGTH` | IV length for AES-GCM | `16` |
| `PAYROLL_TAX_TABLE_URL` | URL for ATO tax table download | ATO official URL |

**Docker changes**: None
**Security**: TFN encryption key MUST be 32 bytes (256-bit), generated with `openssl rand -base64 32`. Must be in `.env` and NEVER committed to git.
**Migration**: `0016_employee_management.sql` — tables: `employees`, `pay_categories`, `pay_rates`, `employment_types`, `tax_declarations`, `super_funds`

### Wave 5: Pay Run Processing & Leave Management (Migration 0017)

**New env vars**:
| Variable | Purpose | Default |
|----------|---------|---------|
| `LEAVE_ACCRUAL_CALCULATION` | Accrual method | `proportional` |
| `PAY_RUN_BATCH_SIZE` | Max employees per pay run batch | `100` |

**Docker changes**: None
**Migration**: `0017_pay_runs_leave.sql` — tables: `pay_runs`, `pay_run_lines`, `leave_balances`, `leave_requests`, `leave_accruals`, `timesheets`, `timesheet_entries`

### Wave 6: STP Compliance & Payroll Reporting (Migration 0018)

**New env vars**:
| Variable | Purpose | Default |
|----------|---------|---------|
| `ATO_STP_ENDPOINT` | ATO STP Phase 2 API endpoint | ATO official URL |
| `ATO_STP_SOFTWARE_ID` | Registered software ID for STP | — |
| `ATO_STP_CERT_PATH` | Path to ATO client certificate | — |
| `PAYSLIP_TEMPLATE_DIR` | Custom payslip template directory | `/app/templates/payslips` |

**Docker changes**:
- Server volumes: Add `./server/templates:/app/templates:ro` (payslip templates)
- If using ATO certificates: Add `./secrets/ato-cert.pem:/app/secrets/ato-cert.pem:ro`
**Migration**: `0018_stp_compliance.sql` — tables: `stp_submissions`, `stp_events`, `payment_summaries`, `super_contributions`, `award_interpretations`

### Wave 7: Customer Management & Invoice Generation (Migration 0019)

**New env vars**:
| Variable | Purpose | Default |
|----------|---------|---------|
| `INVOICE_NUMBER_PREFIX` | Invoice numbering prefix | `INV-` |
| `INVOICE_PDF_ENGINE` | PDF generation engine | `puppeteer` |
| `INVOICE_TEMPLATE_DIR` | Custom invoice template directory | `/app/templates/invoices` |

**Docker changes**:
- Server Dockerfile: Install `chromium` for Puppeteer PDF generation (OR use `pdf-lib` for lighter approach)
  - If Puppeteer: `RUN apt-get install -y chromium --no-install-recommends`
  - Set `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium`
  - Alternative: Use existing `pdfjs-dist` dependency (already in package.json) with `pdf-lib` for generation (no Chromium needed)
- Server volumes: Add templates mount
**Migration**: `0019_customers_invoices.sql` — tables: `customers`, `customer_contacts`, `invoices`, `invoice_lines`, `invoice_templates`, `invoice_numbering`

**RECOMMENDATION**: Prefer `pdf-lib` (pure JS, no Chromium) over Puppeteer for invoice PDFs. This avoids bloating the server Docker image with Chromium (~400MB). The `pdfjs-dist` already in `package.json` handles reading; `pdf-lib` handles creation.

### Wave 8: Recurring Invoices & Payment Processing (Migration 0020)

**New env vars**:
| Variable | Purpose | Default |
|----------|---------|---------|
| `STRIPE_SECRET_KEY` | Stripe API secret key | — |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (for client) | — |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | — |
| `PAYMENT_GATEWAY` | Active payment gateway | `stripe` |

**Docker changes**: None (Stripe SDK already in `server/package.json`: `"stripe": "^20.2.0"`)
**Nginx**: Add webhook endpoint route: `location /api/webhooks/stripe` (standard proxy, no special config)
**Client**: Add `VITE_STRIPE_PUBLISHABLE_KEY` build arg to client Dockerfile
**Migration**: `0020_recurring_payments.sql` — tables: `recurring_invoices`, `recurring_schedules`, `payment_transactions`, `payment_methods`, `dunning_rules`, `dunning_attempts`

### Wave 9: AR Aging & Multi-Currency (Migration 0021)

**New env vars**:
| Variable | Purpose | Default |
|----------|---------|---------|
| `EXCHANGE_RATE_API_KEY` | API key for exchange rate service | — |
| `EXCHANGE_RATE_PROVIDER` | Exchange rate provider | `exchangerate-api` |
| `BASE_CURRENCY` | Default currency | `AUD` |
| `EXCHANGE_RATE_CACHE_TTL` | Cache TTL for exchange rates (seconds) | `3600` |

**Docker changes**: None
**Redis usage**: Cache exchange rates with TTL (key: `exchange:rates:{currency_pair}`)
**Migration**: `0021_ar_aging_multicurrency.sql` — tables: `currencies`, `exchange_rates`, `ar_aging_snapshots`, `ar_aging_details`, `invoice_currency_amounts`

### Wave 10: Accounts Payable & Purchase Orders (Migration 0022)

**New env vars**:
| Variable | Purpose | Default |
|----------|---------|---------|
| `AP_AUTO_MATCH_THRESHOLD` | Auto-match confidence for AP→PO matching | `0.85` |
| `PO_APPROVAL_REQUIRED` | Require PO approval workflow | `true` |

**Docker changes**: None
**Migration**: `0022_accounts_payable.sql` — tables: `suppliers`, `supplier_contacts`, `purchase_orders`, `po_lines`, `bills`, `bill_lines`, `bill_payments`, `ap_aging_snapshots`

---

## 3. Redis Plan

### 3.1 Current State

| Feature | Status | Key Pattern |
|---------|--------|-------------|
| Cognee sessions | Active | `cognee:session:{userId}:{sessionId}` |
| Query caching | Active | `cognee:cache:query:{hash}` |
| Rate limiting | Active | `cognee:ratelimit:{operation}` |

### 3.2 Wave 2 Additions: Pub/Sub for SSE

```
Channel: sse:updates
Purpose: Fan-out SSE events across multiple server instances
Pattern: Server publishes to channel, SSE endpoint subscribes
Key pattern: N/A (pub/sub, not key-value)
```

**Implementation approach**:
1. Create `RedisSSEAdapter` that wraps `events.ts` EventEmitter
2. When `SSE_USE_REDIS=true`: events.emit() → redis.publish('sse:updates', ...)
3. SSE endpoint subscribes to Redis channel instead of EventEmitter
4. Graceful fallback to in-process EventEmitter when Redis is unavailable

### 3.3 Wave 3 Additions: Cognee Multi-User Sessions

Extend existing `CogneeSessionService`:
- `cognee:namespace:{userId}` — User-to-Cognee-namespace mapping
- `cognee:datasets:{userId}:*` — Per-user dataset inventory

### 3.4 Wave 9 Additions: Exchange Rate Cache

```
Key pattern: exchange:rates:{base}:{target}
TTL: 3600 seconds (configurable via EXCHANGE_RATE_CACHE_TTL)
Value: { rate: number, timestamp: string, source: string }
```

### 3.5 Recommended Redis Config Changes

Current: `--maxmemory 256mb --maxmemory-policy allkeys-lru`

**No change needed for Waves 1-10**. The 256MB limit is sufficient for:
- ~10K sessions (≈50MB)
- ~100K cached queries (≈100MB)
- Pub/sub (no memory impact beyond connection buffers)
- Exchange rates (≈1MB)

**Consider for Wave 11+**: If BullMQ job queue is added (per D03 debate finding), increase to `512mb` and switch to `allkeys-lfu` (least-frequently-used is better for mixed workloads).

---

## 4. Migration Runner

### 4.1 Current Mechanism

PostgreSQL `docker-entrypoint-initdb.d/` — **ONLY runs on first start** (when data volume is empty).

**Limitations**:
- Cannot add migrations to existing databases
- Requires `docker compose down -v` to re-run all migrations (DATA LOSS)
- No migration tracking (no `schema_migrations` table)
- No rollback support

### 4.2 Recommended Migration Strategy for Waves 1-10

**Option A: Runtime Migration Runner (Recommended)**

Add a startup migration script to the server that:
1. Creates a `schema_migrations` table if not exists
2. Scans `/app/migrations/` directory for SQL files
3. Runs any file not yet recorded in `schema_migrations`
4. Records filename + timestamp on success

```
Server Dockerfile addition:
  COPY ../docker/migrations /app/migrations

Server startup:
  1. Run migration check
  2. Apply pending migrations
  3. Start Hono server
```

**Option B: Drizzle Kit Push (Simpler but less portable)**

Use `drizzle-kit push` to sync schema on startup. Pros: automatic. Cons: no explicit SQL control, harder to audit.

**Option C: Docker Init Script (Fragile)**

Keep adding to `docker-entrypoint-initdb.d/`. Requires volume wipe for new deploys. NOT RECOMMENDED.

### 4.3 Migration File Plan (Waves 1-10)

| Wave | File | Docker Entry |
|------|------|-------------|
| 1 | `docker/migrations/0013_agent_bridge_intent_routing.sql` | 10-agent-bridge.sql |
| 2 | `docker/migrations/0014_transaction_mutations_streaming.sql` | 11-mutations-streaming.sql |
| 3 | `docker/migrations/0015_multiuser_cognee.sql` | 12-multiuser-cognee.sql |
| 4 | `docker/migrations/0016_employee_management.sql` | 13-employee-management.sql |
| 5 | `docker/migrations/0017_pay_runs_leave.sql` | 14-pay-runs-leave.sql |
| 6 | `docker/migrations/0018_stp_compliance.sql` | 15-stp-compliance.sql |
| 7 | `docker/migrations/0019_customers_invoices.sql` | 16-customers-invoices.sql |
| 8 | `docker/migrations/0020_recurring_payments.sql` | 17-recurring-payments.sql |
| 9 | `docker/migrations/0021_ar_aging_multicurrency.sql` | 18-ar-aging-multicurrency.sql |
| 10 | `docker/migrations/0022_accounts_payable.sql` | 19-accounts-payable.sql |

---

## 5. New Dependencies

### 5.1 Server NPM Packages

| Package | Wave | Purpose | Size Impact |
|---------|------|---------|-------------|
| `pdf-lib` | 7 | Invoice PDF generation (pure JS) | ~2MB |
| `@bull-mq/bullmq` | 2+ | Redis-backed job queue (optional, recommended by D03) | ~1MB |
| `currency.js` | 9 | Precise currency calculations (avoids floating point) | ~10KB |
| `node-schedule` | 8 | Cron-like scheduling for recurring invoices | ~50KB |
| `ioredis` | — | Already installed (v5.9.2) | — |
| `stripe` | — | Already installed (v20.2.0) | — |
| `@anthropic-ai/sdk` | — | Already installed (v0.74.0) | — |

### 5.2 Client NPM Packages

| Package | Wave | Purpose |
|---------|------|---------|
| `@stripe/stripe-js` | 8 | Stripe Elements for payment forms |
| `@stripe/react-stripe-js` | 8 | React components for Stripe |
| `react-pdf` | 7 | Invoice PDF preview in browser |

### 5.3 System-Level Dependencies (Server Dockerfile)

**No new system packages needed** if using `pdf-lib` for PDF generation. If Puppeteer is chosen instead:
```dockerfile
RUN apt-get install -y chromium --no-install-recommends
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
```

### 5.4 Python Dependencies (Server requirements.txt)

No changes needed for Waves 1-10. The Python layer is a legacy prototype.

---

## 6. Docker Compose Diff

### 6.1 Wave 1 Changes (Minimal)

```yaml
# server service — add new env vars:
  environment:
    # ... existing vars ...
    - INTENT_ROUTING_MODEL=${INTENT_ROUTING_MODEL:-claude-haiku-4-5-20251001}
    - INTENT_CONFIDENCE_THRESHOLD=${INTENT_CONFIDENCE_THRESHOLD:-0.7}
    - MAX_CONVERSATION_CONTEXT=${MAX_CONVERSATION_CONTEXT:-20}
```

### 6.2 Wave 2 Changes (SSE Redis)

```yaml
# server service — add:
  environment:
    # ... existing vars ...
    - SSE_REDIS_CHANNEL=${SSE_REDIS_CHANNEL:-sse:updates}
    - SSE_USE_REDIS=${SSE_USE_REDIS:-false}
    - MUTATION_AUDIT_ENABLED=${MUTATION_AUDIT_ENABLED:-true}
```

### 6.3 Wave 3 Changes (Cognee Multi-User)

```yaml
# cognee service — change:
  environment:
    # ... existing vars ...
    - ENABLE_BACKEND_ACCESS_CONTROL=true         # Changed from false
    - COGNEE_DEFAULT_USER=${COGNEE_DEFAULT_USER:-default}  # NEW

# server service — add:
  environment:
    # ... existing vars ...
    - COGNEE_DEFAULT_USER=${COGNEE_DEFAULT_USER:-default}
    - COGNEE_SESSION_TTL=${COGNEE_SESSION_TTL:-1800}
    - COGNEE_USER_ISOLATION=${COGNEE_USER_ISOLATION:-true}
```

### 6.4 Wave 4 Changes (Payroll Security)

```yaml
# server service — add:
  environment:
    # ... existing vars ...
    - TFN_ENCRYPTION_KEY=${TFN_ENCRYPTION_KEY}    # REQUIRED, 32-byte base64
```

### 6.5 Wave 6 Changes (STP)

```yaml
# server service — add:
  environment:
    # ... existing vars ...
    - ATO_STP_ENDPOINT=${ATO_STP_ENDPOINT:-https://api.ato.gov.au/stp/v2}
    - ATO_STP_SOFTWARE_ID=${ATO_STP_SOFTWARE_ID}
    - ATO_STP_CERT_PATH=${ATO_STP_CERT_PATH:-/app/secrets/ato-cert.pem}
  volumes:
    # ... existing volumes ...
    - ./server/templates:/app/templates:ro          # Payslip templates
    - ./secrets:/app/secrets:ro                     # ATO certificates (optional)
```

### 6.6 Wave 7 Changes (Invoicing)

```yaml
# server service — add:
  environment:
    # ... existing vars ...
    - INVOICE_NUMBER_PREFIX=${INVOICE_NUMBER_PREFIX:-INV-}
    - INVOICE_PDF_ENGINE=${INVOICE_PDF_ENGINE:-pdf-lib}
```

### 6.7 Wave 8 Changes (Payments)

```yaml
# server service — add:
  environment:
    # ... existing vars ...
    - STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
    - STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET}
    - PAYMENT_GATEWAY=${PAYMENT_GATEWAY:-stripe}

# client service — add build arg:
  build:
    args:
      VITE_API_URL: ""
      VITE_STRIPE_PUBLISHABLE_KEY: ${STRIPE_PUBLISHABLE_KEY}  # NEW
```

### 6.8 Wave 9 Changes (Multi-Currency)

```yaml
# server service — add:
  environment:
    # ... existing vars ...
    - EXCHANGE_RATE_API_KEY=${EXCHANGE_RATE_API_KEY}
    - EXCHANGE_RATE_PROVIDER=${EXCHANGE_RATE_PROVIDER:-exchangerate-api}
    - BASE_CURRENCY=${BASE_CURRENCY:-AUD}
    - EXCHANGE_RATE_CACHE_TTL=${EXCHANGE_RATE_CACHE_TTL:-3600}
```

### 6.9 Migration Volumes (All Waves)

```yaml
# postgres service — add new migration mounts:
  volumes:
    # ... existing 9 migrations ...
    - ./docker/migrations/0013_agent_bridge_intent_routing.sql:/docker-entrypoint-initdb.d/10-agent-bridge.sql:ro
    - ./docker/migrations/0014_transaction_mutations_streaming.sql:/docker-entrypoint-initdb.d/11-mutations-streaming.sql:ro
    - ./docker/migrations/0015_multiuser_cognee.sql:/docker-entrypoint-initdb.d/12-multiuser-cognee.sql:ro
    - ./docker/migrations/0016_employee_management.sql:/docker-entrypoint-initdb.d/13-employee-management.sql:ro
    - ./docker/migrations/0017_pay_runs_leave.sql:/docker-entrypoint-initdb.d/14-pay-runs-leave.sql:ro
    - ./docker/migrations/0018_stp_compliance.sql:/docker-entrypoint-initdb.d/15-stp-compliance.sql:ro
    - ./docker/migrations/0019_customers_invoices.sql:/docker-entrypoint-initdb.d/16-customers-invoices.sql:ro
    - ./docker/migrations/0020_recurring_payments.sql:/docker-entrypoint-initdb.d/17-recurring-payments.sql:ro
    - ./docker/migrations/0021_ar_aging_multicurrency.sql:/docker-entrypoint-initdb.d/18-ar-aging-multicurrency.sql:ro
    - ./docker/migrations/0022_accounts_payable.sql:/docker-entrypoint-initdb.d/19-accounts-payable.sql:ro
```

---

## 7. Security Considerations

### 7.1 Port Exposure (D02 Finding)

Currently exposed to host:
- **postgres**: 5432 — **SHOULD NOT BE EXPOSED** in production
- **redis**: 6379 — **SHOULD NOT BE EXPOSED** in production
- **cognee**: 8000 — **SHOULD NOT BE EXPOSED** in production

**Recommended**: Remove host port mappings for postgres, redis, and cognee. They only need to be accessible on the `cba-network` bridge.

```yaml
# Production: Remove these port mappings
postgres:
  # ports:
  #   - "5432:5432"    # Internal only
redis:
  # ports:
  #   - "6379:6379"    # Internal only
cognee:
  # ports:
  #   - "8000:8000"    # Internal only
```

### 7.2 Secrets Management

- `.env` currently stores API keys in plaintext on disk
- Wave 4 introduces `TFN_ENCRYPTION_KEY` — a critical secret
- Wave 6 introduces ATO certificates
- Wave 8 introduces Stripe secrets

**Recommendation**: Add `.env` to `.gitignore` (verify it's there), document that production should use Docker secrets or cloud secret managers.

### 7.3 Cognee Auth (Wave 3)

Changing `ENABLE_BACKEND_ACCESS_CONTROL=true` will require the server to authenticate to Cognee. The `CogneeClient` class needs to be updated to pass user tokens or use a service account.

---

## 8. Development vs Production Considerations

### 8.1 Dev-Only Features

| Feature | Purpose | Prod Status |
|---------|---------|-------------|
| `tsx` runtime | TypeScript execution without build | **Dev only** — prod should use compiled JS |
| Port 5432 exposed | Direct PG access for debugging | Remove in prod |
| Port 6379 exposed | Direct Redis access for debugging | Remove in prod |
| Port 8000 exposed | Direct Cognee access for debugging | Remove in prod |
| `proxy_buffering off` on all endpoints | SSE support | Keep for SSE routes only |

### 8.2 Production Concerns

1. **SSL/TLS**: No HTTPS configured. Nginx should terminate TLS in production
2. **Connection pooling**: `pg` driver has default pool, no explicit config. May need `pg-pool` tuning for high concurrency
3. **Server Dockerfile uses tsx**: Production should compile TS → JS for faster startup. `Dockerfile.prod` exists but isn't used in docker-compose.yml
4. **No horizontal scaling**: SSE uses in-process EventEmitter. Wave 2 Redis pub/sub addresses this
5. **Cognee resource limits**: CPU 2.0, Memory 4G — may need tuning for heavy graph operations

---

## 9. Summary: Complete .env.example Addition for Waves 1-10

```env
# ─── Wave 1: Intent Routing ────────────────────────────────────
INTENT_ROUTING_MODEL=claude-haiku-4-5-20251001
INTENT_CONFIDENCE_THRESHOLD=0.7
MAX_CONVERSATION_CONTEXT=20

# ─── Wave 2: SSE & Mutations ──────────────────────────────────
SSE_REDIS_CHANNEL=sse:updates
SSE_USE_REDIS=false
MUTATION_AUDIT_ENABLED=true

# ─── Wave 3: Multi-User Cognee ────────────────────────────────
COGNEE_DEFAULT_USER=default
COGNEE_SESSION_TTL=1800
COGNEE_USER_ISOLATION=true
COGNEE_MAX_DATASETS_PER_USER=50

# ─── Wave 4: Payroll (TFN Encryption) ─────────────────────────
# Generate with: openssl rand -base64 32
TFN_ENCRYPTION_KEY=

# ─── Wave 5: Pay Runs ─────────────────────────────────────────
LEAVE_ACCRUAL_CALCULATION=proportional
PAY_RUN_BATCH_SIZE=100

# ─── Wave 6: STP Compliance ───────────────────────────────────
ATO_STP_ENDPOINT=https://api.ato.gov.au/stp/v2
ATO_STP_SOFTWARE_ID=
ATO_STP_CERT_PATH=/app/secrets/ato-cert.pem

# ─── Wave 7: Invoicing ────────────────────────────────────────
INVOICE_NUMBER_PREFIX=INV-
INVOICE_PDF_ENGINE=pdf-lib

# ─── Wave 8: Payment Gateway (Stripe) ─────────────────────────
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
PAYMENT_GATEWAY=stripe

# ─── Wave 9: Multi-Currency ───────────────────────────────────
EXCHANGE_RATE_API_KEY=
EXCHANGE_RATE_PROVIDER=exchangerate-api
BASE_CURRENCY=AUD
EXCHANGE_RATE_CACHE_TTL=3600

# ─── Wave 10: Accounts Payable ────────────────────────────────
AP_AUTO_MATCH_THRESHOLD=0.85
PO_APPROVAL_REQUIRED=true
```

---

## 10. Critical Pre-Wave-1 Tasks

Before Waves 1-10 begin, these infrastructure items should be addressed:

1. **Runtime migration runner** — Without this, migrations can't be applied to existing databases
2. **Port lockdown** — Remove host port exposure for postgres/redis/cognee
3. **`.gitignore` verification** — Ensure `.env` is excluded
4. **BullMQ consideration** — If job queue is desired (D03 finding), install before Wave 2 for SSE streaming integration
5. **Testing framework** — Vitest is in both `package.json` files but no test files exist yet (D01 finding)
6. **Hono route refactor** — `index.ts` is already 5000+ lines. Consider `app.route()` modularization before adding more endpoints

---

*Report generated by Agent R09 — Infrastructure Analyzer*
*Date: 2026-02-13*
