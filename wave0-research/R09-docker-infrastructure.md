# R09: Docker & Infrastructure Research Report

**Agent**: R09 — Docker & Infrastructure Researcher
**Date**: 2026-02-12
**Scope**: Full Docker stack audit, gaps analysis, and infrastructure roadmap for Waves 11–24

---

## 1. Current Stack — Complete Service Inventory

### 1.1 Services Overview

The application runs 5 Docker services on a single `cba-network` bridge network:

| Service | Image / Build | Port | Role |
|---------|--------------|------|------|
| **postgres** | `pgvector/pgvector:pg17` | 5432:5432 | Shared relational + vector DB |
| **redis** | `redis:7-alpine` | 6379:6379 | Caching & rate-limiting (UNUSED) |
| **cognee** | Built from `./cognee-repo/Dockerfile` | 8000:8000 | AI knowledge graph service |
| **server** | Built from `./server/Dockerfile` | 3501 (internal only) | Hono API + Node.js + Python |
| **client** | Built from `./client/Dockerfile` | 8080:80 | React SPA + Nginx reverse proxy |

### 1.2 PostgreSQL (`cba-postgres`)

**Image**: `pgvector/pgvector:pg17` — PostgreSQL 17 with pgvector extension pre-installed.

**Environment**:
- `POSTGRES_USER`: `${POSTGRES_USER:-app_user}` (defaults to `app_user`)
- `POSTGRES_PASSWORD`: `${POSTGRES_PASSWORD}` (from `.env`, no default — **must be set**)
- `POSTGRES_DB`: `${POSTGRES_DB:-ai_accountant}`

**Volumes** (9 bind mounts + 1 named volume):
- `postgres-data:/var/lib/postgresql/data` — persistent data
- 8 SQL/shell init scripts mounted into `/docker-entrypoint-initdb.d/`:
  1. `01-cba-schema.sql` — `0006_postgres_migration.sql` (core schema)
  2. `02-extensions.sql` — `init-cognee-db.sql` (uuid-ossp, pg_trgm, vector extensions)
  3. `03-cognee-db.sh` — `init-cognee-db.sh` (creates `cognee_db` database + extensions)
  4. `04-missing-tables.sql` — `0007_missing_tables.sql` (31 additional tables)
  5. `05-account-ownership.sql` — `0008_account_ownership.sql`
  6. `06-complete-schema.sql` — `0009_complete_schema.sql`
  7. `07-add-missing-columns.sql` — `0010_add_missing_columns.sql`
  8. `08-final-schema-sync.sql` — `0011_final_schema_sync.sql`
  9. `09-tax-return-platform.sql` — `0012_tax_return_platform.sql`

**Health Check**: `pg_isready` every 5s, 15 retries, 30s start period.

**Databases hosted**:
- `ai_accountant` — main CBA application database (45+ tables)
- `cognee_db` — Cognee knowledge graph metadata + vector store

**Extensions enabled**:
- `uuid-ossp` (UUID generation)
- `pg_trgm` (trigram text search)
- `vector` (pgvector for embeddings)

**Critical observation**: Init scripts only run on **first container start** (when data volume is empty). Adding new migration files requires either dropping the volume or running migrations manually.

### 1.3 Redis (`cba-redis`)

**Image**: `redis:7-alpine`
**Port**: 6379:6379 (exposed to host — security concern in production)
**Volume**: `redis-data:/data`
**Health Check**: `redis-cli ping` every 10s, 5 retries, 10s start period.

**CRITICAL FINDING**: Redis is **defined but completely unused**. Zero references to `REDIS_URL` or any Redis client in the entire server source code:
- `server/src/` has **0 matches** for `redis` or `REDIS` in any `.ts` file
- The `REDIS_URL=redis://redis:6379` env var is passed to the server but never consumed
- No Redis client library exists in `server/package.json`
- The `hono-rate-limiter` package is installed but uses **in-memory** storage, not Redis

**Recommendation**: Redis should either be:
1. **Removed** from docker-compose.yml until actually needed (saves ~25MB RAM)
2. **Connected** to `hono-rate-limiter` for distributed rate limiting (if multi-instance)
3. **Connected** to Cognee (which supports Redis caching via `pip install cognee[redis]`)

### 1.4 Cognee (`cba-cognee`)

**Build**: From `./cognee-repo/Dockerfile` — multi-stage Python 3.12 build using `uv` package manager. Installs extras: `debug`, `api`, `postgres`, `neo4j`, `llama-index`, `ollama`, `mistral`, `groq`, `anthropic`, `chromadb`.

**Port**: 8000:8000 (exposed to host)

**Environment** (22 env vars):
- **LLM**: Custom provider → OpenRouter → `google/gemini-3-flash-preview`, 16384 max tokens
- **Embeddings**: OpenAI provider → `text-embedding-3-small` via OpenRouter, 1536 dimensions
- **Database**: PostgreSQL at `postgres:5432/cognee_db`
- **Vector Store**: pgvector at same PostgreSQL instance
- **Graph Store**: Kuzu (embedded, file-based — stored in `/app/.cognee_system`)
- **Security**: `REQUIRE_AUTHENTICATION=false`, `ENABLE_BACKEND_ACCESS_CONTROL=false`
- **Telemetry**: Disabled
- **Network**: `CORS_ALLOWED_ORIGINS=*`, `ACCEPT_LOCAL_FILE_PATH=true`, `ALLOW_HTTP_REQUESTS=true`

**Volume**: `cognee-data:/app/.cognee_system` — Kuzu graph database files

**Health Check**: Python urllib check against `http://localhost:8000/api/v1/settings` every 30s, 60s start period.

**Resource Limits**: 2 CPUs, 4GB RAM (only service with explicit limits).

**Depends on**: `postgres` (healthy).

**Extra hosts**: `host.docker.internal:host-gateway` (for accessing host services).

### 1.5 Server (`cba-server`)

**Build**: From `./server/Dockerfile` — `node:20-slim` base + Python 3 installed for agent services.

**Dockerfile details**:
- Base: `node:20-slim`
- Installs: `python3`, `python3-pip`, `python3-venv`, `curl`
- Python deps: `pydantic>=2.0.0`, `python-dotenv>=1.0.0`, `openai>=1.0.0`, `httpx>=0.27.0`
- Node deps: `npm ci` from `package.json`
- Non-root user: `nodeuser:nodejs` (UID/GID 1001)
- Upload dir: `/app/uploads` (writable by nodeuser)
- Entry: `node --import tsx/esm src/index.ts`

**Port**: 3501 (internal only — not exposed to host, nginx proxies to it).

**Environment** (22 env vars):
- Server config: `PORT=3501`, `NODE_ENV=production`, `JWT_SECRET`
- AI keys: `VITE_OPENAI_API_KEY`, `VITE_OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_AI_STUDIO_KEY`
- Claude agents: `USE_CLAUDE_AGENTS=true`, `CLAUDE_MODEL=claude-sonnet-4-5-20250929`
- Cognee: `USE_COGNEE=true`, `COGNEE_API_URL=http://cognee:8000`
- Enrichment: `ABNLOOKUP_GUID`, `GOOGLE_API_KEY`
- Database: Full PostgreSQL connection via `DATABASE_URL` + individual `DB_*` vars
- Redis: `REDIS_URL=redis://redis:6379` (unused)

**Volume**: `./statements:/statements` (bind mount for uploaded PDF statements)

**Health Check**: `curl -f http://localhost:3501/health` every 30s, 3 retries, 30s start period.

**Depends on**: `postgres` (healthy). Does NOT depend on `cognee` or `redis`.

**Key packages** (relevant to infrastructure):
- `@anthropic-ai/sdk` — Claude API
- `openai` — OpenRouter/OpenAI API
- `pg` — PostgreSQL client
- `drizzle-orm` — ORM layer
- `hono` + `hono-rate-limiter` — HTTP framework + rate limiting
- `pdf-parse`, `pdf-to-img`, `pdfjs-dist` — PDF processing
- `sharp` — Image processing
- `stripe` — Payment processing
- `resend` — Email delivery
- `bcryptjs` — Password hashing
- `exceljs` — Excel export

### 1.6 Client (`cba-client`)

**Build**: Multi-stage from `./client/Dockerfile`:
- Stage 1: `node:20-alpine` — `npm ci` + `npm run build` (Vite)
- Stage 2: `nginx:alpine` — serves built assets + reverse proxy

**Build arg**: `VITE_API_URL=""` (empty = use nginx proxy).

**Port**: 8080:80 (exposed to host).

**Nginx config** (`nginx.conf`):
- `/` → SPA fallback (`try_files $uri $uri/ /index.html`)
- `/api/events` → SSE proxy to `server:3501` (unbuffered, 86400s timeout)
- `/api/` → Standard proxy to `server:3501`
- `/auth/` → Auth proxy to `server:3501`
- `/events` → Legacy SSE proxy
- Static assets: 1-year cache with `immutable`
- Gzip: enabled for text/CSS/JS/JSON/XML

**Health Check**: `curl -f http://localhost:80` every 30s, 3 retries, no start period.

**Depends on**: `server` (started, not necessarily healthy — should use `condition: service_healthy`).

### 1.7 Volumes

| Volume | Driver | Used By | Purpose |
|--------|--------|---------|---------|
| `postgres-data` | local | postgres | Database files |
| `cognee-data` | local | cognee | Kuzu graph files + system data |
| `redis-data` | local | redis | Redis persistence (unused) |

### 1.8 Network

Single bridge network: `cba-network`. All services are on this network.

---

## 2. Cognee Configuration Gaps

### 2.1 Security: Authentication & Access Control DISABLED

**Current state**:
```yaml
REQUIRE_AUTHENTICATION=false
ENABLE_BACKEND_ACCESS_CONTROL=false
```

**Impact**: Any service on the Docker network (or anyone with port 8000 access) can:
- Read ANY dataset
- Modify ANY knowledge graph
- Delete ANY data
- No user isolation — all data is globally accessible

**What needs to change for multi-user isolation (Wave 24)**:
1. Set `REQUIRE_AUTHENTICATION=true`
2. Set `ENABLE_BACKEND_ACCESS_CONTROL=true`
3. Implement JWT token forwarding from CBA server → Cognee
4. Map CBA user IDs to Cognee user/tenant IDs
5. Create per-user datasets with appropriate ACLs
6. Cognee supports isolated databases per user+dataset for Kuzu, LanceDB, SQLite, Postgres

### 2.2 Redis Not Connected to Cognee

**Current state**: Cognee supports Redis caching via `pip install cognee[redis]`, but:
- The Cognee container does NOT install the `redis` extra
- No `REDIS_URL` or Redis config is passed to Cognee
- The `redis` service exists but is orphaned

**What would help**:
- Add `--extra redis` to Cognee's `uv sync` command in its Dockerfile
- Pass `REDIS_URL=redis://redis:6379` to Cognee container
- This would cache LLM responses and embeddings, reducing API costs

### 2.3 CORS Wildcard

**Current state**: `CORS_ALLOWED_ORIGINS=*`
**Risk**: Any origin can make API calls to Cognee.
**Fix**: Restrict to `http://localhost:8080` (client) and `http://server:3501` (internal).

### 2.4 Exposed Port

**Current state**: Port 8000 is exposed to the host.
**Risk**: Direct access bypasses the CBA server's auth/validation layer.
**Fix for production**: Remove `ports: - "8000:8000"` — Cognee only needs to be reachable from the `cba-network` internally.

### 2.5 Missing Cognee-Server Dependency

The server container does NOT declare `depends_on: cognee`. If Cognee is slow to start, the server may fail Cognee API calls during startup. The `USE_COGNEE` flag and circuit breaker pattern mitigate this, but adding an explicit dependency with `condition: service_healthy` would be more robust.

---

## 3. New Services Assessment for Waves 11–24

### 3.1 CDR Harvester (Wave 20: CDR PRD Harvester & Open Banking)

**What it does**: Crawl Australian CDR Register API, fetch loan/banking products, normalize, cache, compare.

**Recommendation**: **Cron job inside the server container**, NOT a separate service.

**Rationale**:
- CDR is a REST API — no special runtime needed
- Data fetched is stored in PostgreSQL (already connected)
- Runs on a schedule (daily/weekly) — `setInterval` or `node-cron` in the server process
- The server already has `httpx` (Python) and `openai` (Node) for HTTP requests
- Adding a separate container for a cron job adds operational complexity without benefit
- If rate-limited, can be throttled within the existing server

**Alternative considered**: Separate lightweight Node.js cron container — rejected because it would need its own DB connection, env vars, and health check for a simple HTTP fetch + insert workflow.

### 3.2 Market Data Fetcher (Wave 21: Market Intelligence & Last 30 Days)

**What it does**: Integrate `last30days-skill` for financial market intelligence.

**Recommendation**: **Module inside the server container**.

**Rationale**:
- The `last30days-skill` is a GitHub repo with market data functions
- Data is consumed by the AI chat agent (already in server)
- Periodic fetch can use `setInterval` or `node-cron`
- Results stored in PostgreSQL or Cognee datasets
- No heavy computation — just HTTP fetches + normalization

### 3.3 OCR Service (Wave 14: AI OCR & Payment Matching)

**What it does**: Enhanced OCR for scanned PDFs, receipts, invoices.

**Recommendation**: **Keep in server container (current approach is sufficient)**.

**Current state**:
- The server already performs OCR via **Claude Vision API** (`ai.ts` uses "expert financial OCR" prompts)
- `pdf-to-img` + `sharp` convert PDFs to images for vision processing
- `pdfjs-dist` extracts text from digital (non-scanned) PDFs
- Pipeline fallback: text extraction → Claude Vision → Legacy AI

**Why NOT add Tesseract**:
- Claude Vision API is **far more accurate** for financial documents than Tesseract
- Tesseract would add ~400MB+ to the Docker image (with language packs)
- Tesseract struggles with bank statement formatting (columns, tables)
- The current approach already works for the 29 test PDFs

**If local OCR is needed later** (cost reduction): Add Tesseract as an optional pre-processing step before Claude Vision, using a multi-stage approach:
1. Try `pdfjs-dist` text extraction (free)
2. If insufficient text, try Tesseract (cheap)
3. If still insufficient, fall back to Claude Vision (expensive but accurate)

### 3.4 Admin Backend (Wave 18: Admin Backend & Agent Dashboard)

**Recommendation**: **Same server, new route group** (`/admin/*`).

**Rationale**:
- The admin panel queries the same database
- Agent status/health is tracked in the same server process
- Middleware for admin auth can be layered on existing Hono routes
- No need for a separate container — the admin dashboard is just a different UI view
- Admin-specific API endpoints (user management, system health, agent control) are natural extensions of the existing API
- Client-side: New React routes under `/admin/*` served from the same Nginx container

**What changes**:
- New API route group: `app.route('/admin', adminRoutes)`
- Admin auth middleware: JWT with `role: 'admin'` check
- Admin React pages: Build into the same client bundle
- No new Docker services needed

### 3.5 3D Knowledge Graph Viewer (Wave 19)

**Recommendation**: **Client-side only** (Three.js/force-graph in React).

**Rationale**:
- The visualization is purely client-side rendering
- Graph data is already available via Cognee's `/api/v1/datasets/{id}/graph` endpoint
- No new backend service needed
- Bundle size increase: ~200KB (three.js) + ~50KB (force-graph)

### 3.6 Summary: Service Topology Recommendation

| Wave | Feature | Approach | New Container? |
|------|---------|----------|----------------|
| 11 | Inventory & Bank Recon | Server module | No |
| 12 | Fixed Assets & Multi-Entity | Server module + DB migration | No |
| 13 | Financial Reporting | Server module + client pages | No |
| 14 | AI OCR & Payment Matching | Enhance existing pipeline | No |
| 15 | Predictive Analytics | Server module + Cognee | No |
| 16 | Custom DataPoints | Server + Cognee config | No |
| 17 | Temporal Queries | Server + Cognee TEMPORAL search | No |
| 18 | Admin Backend | Server routes + client pages | No |
| 19 | 3D Graph Viewer | Client-only (Three.js) | No |
| 20 | CDR Harvester | Server cron module | No |
| 21 | Market Intelligence | Server module | No |
| 22 | Agent Architecture Upgrade | Server refactor | No |
| 23 | Universal Knowledge Graph | Server + Cognee shared dataset | No |
| 24 | Multi-Tenant System | Server + Cognee auth + DB | No |

**Bottom line**: Keep the current 5-service architecture. All new features fit within existing containers. Adding microservices would increase operational complexity without proportional benefit at this scale.

---

## 4. Performance & Scaling

### 4.1 Current Resource Allocation

| Service | CPU Limit | Memory Limit | Actual Usage (est.) |
|---------|-----------|--------------|---------------------|
| postgres | None | None | 200-500MB depending on data |
| redis | None | None | ~25MB (idle) |
| cognee | 2 CPUs | 4GB | 500MB-2GB during cognify |
| server | None | None | 200-500MB |
| client | None | None | ~30MB (nginx) |

**Problem**: Only Cognee has resource limits. Unconstrained services could starve each other or the host.

### 4.2 Recommended Resource Limits

```yaml
# Proposed resource limits for all services
postgres:
  deploy:
    resources:
      limits:
        cpus: '2.0'
        memory: 2G
      reservations:
        cpus: '0.5'
        memory: 512M

redis:
  deploy:
    resources:
      limits:
        cpus: '0.5'
        memory: 256M

cognee:
  deploy:
    resources:
      limits:
        cpus: '2.0'
        memory: 4G  # Already set
      reservations:
        cpus: '0.5'
        memory: 1G

server:
  deploy:
    resources:
      limits:
        cpus: '2.0'
        memory: 2G
      reservations:
        cpus: '0.5'
        memory: 512M

client:
  deploy:
    resources:
      limits:
        cpus: '0.5'
        memory: 256M
```

### 4.3 PostgreSQL Optimization

**Current state**: Default PostgreSQL configuration. No tuning.

**Recommendations**:
1. **Shared buffers**: Set to 25% of allocated memory (512MB if 2GB limit)
2. **Work memory**: 64MB for complex queries (BAS calculations, analytics)
3. **Effective cache size**: 1.5GB
4. **WAL configuration**: `wal_level=minimal` for dev, `wal_level=replica` for production
5. **Max connections**: Current default (100) is fine for single-server deployment
6. **pgvector optimization**: Create IVFFLAT or HNSW indexes on embedding columns

**Implementation**: Add a `postgresql.conf` override via volume mount:
```yaml
volumes:
  - ./docker/postgresql.conf:/etc/postgresql/postgresql.conf:ro
command: postgres -c config_file=/etc/postgresql/postgresql.conf
```

### 4.4 Redis Usage Plan

Redis exists but is unused. Planned uses:
1. **Rate limiting**: `hono-rate-limiter` with Redis store (distributed)
2. **Session cache**: JWT token blacklist for logout
3. **Cognee caching**: LLM response cache to reduce API costs
4. **Queue**: Simple job queue for background tasks (PDF processing, CDR fetch)

### 4.5 pgvector Performance

Currently no explicit vector indexes exist. For Cognee's embedding searches:
```sql
-- HNSW index for fast approximate nearest neighbor search
CREATE INDEX ON cognee_embeddings USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
```

This should be added as a migration once the Cognee vector tables are established.

---

## 5. Production Readiness Assessment

### 5.1 Current State: Development-Only

The current Docker setup is **development/staging grade**, NOT production-ready.

### 5.2 Missing for Production

| Category | Gap | Severity | Notes |
|----------|-----|----------|-------|
| **SSL/TLS** | No HTTPS termination | CRITICAL | All traffic is plaintext |
| **Secrets** | `.env` file with plaintext secrets | CRITICAL | No vault/secrets manager |
| **Exposed Ports** | Postgres (5432), Redis (6379), Cognee (8000) on host | HIGH | Only port 8080 should be exposed |
| **Backups** | No database backup strategy | HIGH | No pg_dump, no WAL archiving |
| **Logging** | No log aggregation | MEDIUM | Logs only in container stdout |
| **Monitoring** | No health dashboard / alerting | MEDIUM | Only basic health checks |
| **DNS/Domain** | No domain configuration | HIGH | Uses localhost/IP |
| **Rate Limiting** | In-memory only (not distributed) | MEDIUM | Loses state on restart |
| **CORS** | Wildcard on Cognee | MEDIUM | Should be restricted |
| **Image Tags** | No explicit version pinning | LOW | Uses `latest` implicitly |
| **Non-root** | Server has non-root user; client nginx runs as root | LOW | |
| **Init Scripts** | Only run on fresh volume | MEDIUM | Migrations need manual execution |
| **Graceful Shutdown** | No explicit stop signals | LOW | Docker sends SIGTERM by default |

### 5.3 Proposed `docker-compose.prod.yml` Overlay

```yaml
# docker-compose.prod.yml — production overrides
# Usage: docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

services:
  postgres:
    ports: []  # Remove host port exposure
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}  # From secrets manager
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./docker/postgresql.conf:/etc/postgresql/postgresql.conf:ro
      # Remove init scripts — use migration runner instead
    command: postgres -c config_file=/etc/postgresql/postgresql.conf
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
    logging:
      driver: json-file
      options:
        max-size: "50m"
        max-file: "5"

  redis:
    ports: []  # Remove host port exposure
    command: redis-server --requirepass ${REDIS_PASSWORD} --maxmemory 200mb --maxmemory-policy allkeys-lru
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 256M

  cognee:
    ports: []  # Remove host port exposure — internal only
    environment:
      - CORS_ALLOWED_ORIGINS=https://yourdomain.com
      - REQUIRE_AUTHENTICATION=true
      - ENABLE_BACKEND_ACCESS_CONTROL=true

  server:
    environment:
      - NODE_ENV=production
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
      replicas: 1  # Scale up if needed

  client:
    ports:
      - "443:443"
      - "80:80"
    volumes:
      - ./docker/nginx-prod.conf:/etc/nginx/conf.d/default.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro  # SSL certs
```

### 5.4 Backup Strategy (Missing)

**Recommended**:
1. **pg_dump cron**: Run `pg_dump` daily, store in S3 or local backup volume
2. **WAL archiving**: Enable `archive_mode` for point-in-time recovery
3. **Cognee data**: Back up the `cognee-data` volume (Kuzu graph files)
4. **Implementation**: Add a `backup` service or sidecar:

```yaml
backup:
  image: postgres:17
  volumes:
    - backup-data:/backups
  environment:
    - PGHOST=postgres
    - PGUSER=${POSTGRES_USER}
    - PGPASSWORD=${POSTGRES_PASSWORD}
  command: >
    sh -c 'while true; do
      pg_dump -Fc ai_accountant > /backups/ai_accountant_$(date +%Y%m%d_%H%M%S).dump
      pg_dump -Fc cognee_db > /backups/cognee_db_$(date +%Y%m%d_%H%M%S).dump
      find /backups -mtime +7 -delete
      sleep 86400
    done'
  networks:
    - cba-network
  depends_on:
    postgres:
      condition: service_healthy
```

---

## 6. Build Pipeline

### 6.1 Current Build Process

```
docker compose up --build -d
```

This rebuilds ALL images from scratch every time. No CI/CD pipeline exists.

### 6.2 Build Times (Estimated)

| Service | Build Time | Bottleneck |
|---------|-----------|------------|
| postgres | 0s (pre-built image) | N/A |
| redis | 0s (pre-built image) | N/A |
| cognee | 3-5 min | `uv sync` with many extras (~1GB Python packages) |
| server | 1-2 min | `npm ci` + Python pip install |
| client | 1-2 min | `npm ci` + Vite build |

**Total**: ~6-10 minutes for a full rebuild.

### 6.3 Migration Execution

**Problem**: Migrations are init scripts that only run on first PostgreSQL start. For subsequent schema changes:
- Must manually `docker exec` into postgres and run SQL
- Or drop the volume and rebuild (losing all data)
- No migration runner in the deployment pipeline

**Recommendation**: Add a migration runner service or startup script:

```yaml
migrations:
  build:
    context: ./server
    dockerfile: Dockerfile
  command: >
    sh -c '
      npx drizzle-kit migrate &&
      for f in /migrations/*.sql; do
        psql "$DATABASE_URL" -f "$f" || true
      done
    '
  environment:
    - DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
  volumes:
    - ./docker/migrations:/migrations:ro
  networks:
    - cba-network
  depends_on:
    postgres:
      condition: service_healthy
```

### 6.4 Optimization Opportunities

1. **Layer caching**: Both Dockerfiles already copy `package*.json` first — good practice
2. **Multi-stage builds**: Client already uses multi-stage — good
3. **BuildKit**: Enable `DOCKER_BUILDKIT=1` for parallel stage building
4. **Registry caching**: Push built images to a registry for CI/CD cache
5. **Cognee build**: The Cognee Dockerfile installs many unused extras (neo4j, llama-index, ollama, mistral, groq, chromadb). Trimming to only `api`, `postgres`, `debug` would reduce image size by ~500MB and build time by 1-2 minutes

### 6.5 Server Dockerfile Issues

1. **No TypeScript compilation**: The server runs directly via `tsx/esm` — fine for dev, but production should pre-compile to JavaScript for faster startup and smaller image
2. **Python `--break-system-packages`**: Installs Python packages globally (no venv) — works but fragile
3. **`|| true` on pip install**: Silently swallows Python install errors
4. **Full source copy**: `COPY . .` includes test files, configs, etc. Add a `.dockerignore`

---

## 7. Infrastructure Roadmap for Waves 11–24

### 7.1 Wave-by-Wave Infrastructure Changes

#### Wave 11: Inventory & Bank Reconciliation
- **DB**: New tables: `inventory_items`, `stock_movements`, `bank_reconciliation_sessions`, `reconciliation_matches`
- **Migration**: `0013_inventory_reconciliation.sql`
- **Docker**: No changes needed

#### Wave 12: Fixed Assets & Multi-Entity
- **DB**: New tables: `fixed_assets`, `depreciation_records`, `entities`, `entity_relationships`, `inter_entity_transactions`
- **Migration**: `0014_fixed_assets_multi_entity.sql`
- **Docker**: No changes needed

#### Wave 13: Financial Reporting & Budgeting
- **DB**: New tables: `report_templates`, `generated_reports`, `budget_rules`, `budget_vs_actual`
- **Server**: PDF generation library (may need `puppeteer` or `pdfkit` for report generation)
- **Docker**: If using Puppeteer, need Chromium in server container (+400MB). Consider using `pdfkit` instead.

#### Wave 14: AI OCR & Payment Matching
- **DB**: New tables: `receipts`, `receipt_matches`, `payment_patterns`
- **Server**: Enhanced image processing — `sharp` already installed
- **Docker**: No changes needed (Claude Vision handles OCR)

#### Wave 15: Predictive Analytics & Compliance
- **DB**: New tables: `predictions`, `compliance_checks`, `compliance_rules`
- **Cognee**: New datasets for compliance rules + ATO rulings
- **Docker**: No changes needed

#### Wave 16: Custom DataPoints & Relationships
- **Cognee**: Custom ontology configuration, new DataPoint models
- **Docker**: May need to volume-mount custom ontology files into Cognee container

#### Wave 17: Temporal Queries & Cross-Module Intelligence
- **Cognee**: Enable `TEMPORAL` search type, configure time-aware indexing
- **Docker**: No changes needed

#### Wave 18: Admin Backend & Agent Dashboard
- **Server**: New `/admin/*` routes with role-based middleware
- **Client**: New admin React pages
- **Docker**: No new services. Consider separate admin client build for code splitting.

#### Wave 19: 3D Knowledge Graph Visualization
- **Client**: Add `three`, `3d-force-graph` packages
- **Docker**: No backend changes. Client build size increases ~250KB.

#### Wave 20: CDR Harvester
- **Server**: New cron module for CDR Register API polling
- **DB**: New tables: `cdr_products`, `cdr_providers`, `cdr_fetch_log`
- **Migration**: `0015_cdr_products.sql`
- **Docker**: No new services

#### Wave 21: Market Intelligence
- **Server**: Integrate last30days-skill as Node module
- **DB**: New tables: `market_data`, `economic_indicators`, `market_fetch_log`
- **Docker**: No new services

#### Wave 22: Agent Architecture Upgrade
- **Server**: Major refactor of `server/src/services/claude/` agent system
- **Docker**: May need updated Anthropic SDK, possibly Claude Agent SDK installation
- **Consider**: If moving to Claude Agent SDK (TypeScript), the Python deps in the server container may become unnecessary — potential to slim down the image

#### Wave 23: Universal Knowledge Graph
- **Cognee**: Shared (non-user-specific) datasets for market data, rates, rulings
- **DB**: New tables or columns for shared vs. personal knowledge classification
- **Docker**: No new services

#### Wave 24: Multi-Tenant System
- **MAJOR INFRASTRUCTURE CHANGE**: This is the only wave requiring significant Docker changes
- **Cognee**: Enable `REQUIRE_AUTHENTICATION=true` + `ENABLE_BACKEND_ACCESS_CONTROL=true`
- **Server**: JWT-based auth propagation to Cognee
- **DB**: User isolation, row-level security (RLS), tenant scoping
- **Redis**: Activate for session management + rate limiting
- **Docker changes**:
  - Cognee env vars: Enable auth
  - Redis: Actually connect and use
  - PostgreSQL: Add RLS policies migration
  - Nginx: Add security headers, rate limiting
  - Secrets: Move from .env to Docker secrets or external vault

### 7.2 Migration Strategy

Currently 9 migration files run as init scripts. Going forward:

1. **New migrations**: Continue the numbering pattern (`0013_*.sql`, `0014_*.sql`, etc.)
2. **Execution**: Add a migration runner service that runs `IF NOT EXISTS` / idempotent DDL
3. **Rollback**: Each migration should have a corresponding rollback script
4. **Tracking**: Add a `schema_migrations` table to track which migrations have run

### 7.3 Infrastructure Priority by Wave

| Priority | Wave | Infrastructure Impact | Effort |
|----------|------|----------------------|--------|
| **None** | 11, 14, 15, 17, 19 | DB migrations only | Low |
| **Low** | 12, 13, 16, 20, 21 | DB + new server modules | Low-Med |
| **Medium** | 18, 22, 23 | Route restructuring + refactoring | Medium |
| **High** | 24 | Auth, multi-tenant, Redis activation | High |

### 7.4 Recommended Infrastructure Improvements (Cross-Wave)

These should be done before or during Wave 11 as foundational work:

1. **Migration runner service** — stop relying on init scripts
2. **Resource limits** for all services — prevent resource starvation
3. **Remove Redis** from docker-compose if not using in Wave 11-23, OR connect it properly
4. **Add `.dockerignore`** files — reduce build context size
5. **Production overlay** (`docker-compose.prod.yml`) — separate dev from prod config
6. **Backup service** — automated pg_dump with retention
7. **Log rotation** — add `logging.driver` config with size limits
8. **Cognee port closure** — remove host port exposure
9. **PostgreSQL tuning** — add custom `postgresql.conf`
10. **Health check improvement** — client should depend on server with `condition: service_healthy`

---

## 8. Key Findings Summary

### Critical Issues
1. **Redis is a ghost service** — configured but completely unused, wasting resources
2. **No production overlay** — dev config is the only config
3. **No backup strategy** — single point of failure for all data
4. **Migrations are fragile** — init scripts only run on fresh volumes
5. **Exposed ports** — PostgreSQL and Redis accessible from host

### Architectural Decisions
1. **Keep monolith** — all 14 waves fit in the existing 5-service topology
2. **No new containers needed** — everything runs as server modules or client pages
3. **Wave 24 is the infrastructure inflection point** — multi-tenant requires real auth, Redis activation, and RLS

### Quick Wins
1. Add resource limits to all services (~5 min)
2. Remove host port exposure for postgres/redis/cognee (~2 min)
3. Add `condition: service_healthy` for client→server dependency (~1 min)
4. Add `logging` config with rotation (~5 min)
5. Create `.dockerignore` files (~10 min)
