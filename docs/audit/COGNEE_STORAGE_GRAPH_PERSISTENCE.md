# Audit Report: Cognee Storage, Graph Quality & Persistence

**Auditor:** Teammate 5 — Cognee Storage, Graph Quality & Persistence Specialist
**Date:** 2026-02-11
**Scope:** Cognee service configuration, backends (pgvector + Kuzu), volumes, graph structure quality, persistence across restarts

---

## 1. Backend Configuration Audit

### 1.1 Vector Backend: pgvector on Shared PostgreSQL

**Status: PASS with notes**

- `docker-compose.yml:82` sets `VECTOR_DB_PROVIDER=pgvector`
- `docker-compose.yml:83` sets `VECTOR_DB_URL=postgresql://${POSTGRES_USER:-app_user}:${POSTGRES_PASSWORD}@postgres:5432/cognee_db`
- The vector store correctly points to the `cognee_db` database (not the CBA app's `ai_accountant`), providing database-level isolation
- `docker/init-cognee-db.sh:18` creates the `vector` extension in `cognee_db`
- `docker/init-cognee-db.sql:9` also creates the `vector` extension in the default `ai_accountant` database

**Finding [INFO-1]:** Both `ai_accountant` and `cognee_db` have the `vector` extension enabled. Only `cognee_db` is used by Cognee. The extension in `ai_accountant` is unused but harmless — it exists for potential future local RAG usage.

### 1.2 Graph Backend: Kuzu Embedded

**Status: PASS**

- `docker-compose.yml:85` sets `GRAPH_DATABASE_PROVIDER=kuzu`
- Kuzu is an embedded file-based graph database that stores data in the volume-mounted `/app/.cognee_system` directory
- Per `cognee-repo/CLAUDE.md`, Kuzu is the default graph backend and requires no extra service
- This is appropriate for a single-user application

**Finding [INFO-2]:** No `GRAPH_DATABASE_URL` is set because Kuzu embedded uses a local filesystem path. The graph data directory defaults to `SYSTEM_ROOT_DIRECTORY` which maps to `/app/.cognee_system` inside the container.

### 1.3 LLM Provider: OpenRouter

**Status: PASS with MISMATCH vs. Documentation**

- `docker-compose.yml:62-66` configures:
  - `LLM_PROVIDER=custom`
  - `LLM_MODEL=openrouter/google/gemini-3-flash-preview`
  - `LLM_ENDPOINT=https://openrouter.ai/api/v1`
  - `LLM_API_KEY=${VITE_OPENROUTER_API_KEY}`

**Finding [MISMATCH-1]:** The `docker-compose.yml` uses `LLM_PROVIDER=custom` and model `openrouter/google/gemini-3-flash-preview`. However, `docs/COGNEE_INTEGRATION.md:346` specifies `LLM_PROVIDER=openai` and model `openrouter/openai/gpt-4o`. The Python SDK service (`cognee_service.py:33`) also hardcodes `LLM_PROVIDER=openai` and defaults to `openrouter/openai/gpt-4o`. The Docker config is correct per the cognee-repo CLAUDE.md which recommends `custom` for OpenRouter. The Python SDK files are stale.

**Finding [MISMATCH-2]:** `cognee_service.py:33-38` sets `LLM_PROVIDER=openai` instead of `custom`. Per `cognee-repo/CLAUDE.md`, when using OpenRouter as a custom endpoint, `LLM_PROVIDER` should be `custom`. This may cause the Cognee SDK to route through OpenAI's default endpoint rather than OpenRouter when the Python SDK service is used directly. Since the Docker container uses HTTP REST API (not the Python SDK), the Docker-level environment variable (`custom`) takes precedence at runtime.

### 1.4 Embeddings: text-embedding-3-small via OpenRouter

**Status: PASS with MISMATCH vs. Documentation**

- `docker-compose.yml:68-73` configures:
  - `EMBEDDING_PROVIDER=openai`
  - `EMBEDDING_MODEL=text-embedding-3-small`
  - `EMBEDDING_DIMENSIONS=1536`
  - `EMBEDDING_API_KEY=${VITE_OPENROUTER_API_KEY}`
  - `EMBEDDING_ENDPOINT=https://openrouter.ai/api/v1`

**Finding [MISMATCH-3]:** The documentation (`COGNEE_INTEGRATION.md:71`) and the `MEMORY.md` reference `fastembed` with `BAAI/bge-small-en-v1.5` at 384 dimensions. The actual Docker config uses `text-embedding-3-small` at 1536 dimensions via OpenRouter. This is a significant divergence:
- **Documentation:** `fastembed` + `BAAI/bge-small-en-v1.5` (384 dims, local, free)
- **Docker reality:** `openai` + `text-embedding-3-small` (1536 dims, API, costs money)
- **Python SDK files:** `cognee_service.py:41-43` and `seed.py:36-37` still configure `fastembed`

This means the Python SDK service and Docker container would use **different embedding models** if both were active. Since they index into the same `cognee_db`, this would produce incompatible vector spaces.

**Severity: HIGH** — If the seed script (`seed.py`) is run inside the container using the Python SDK with its hardcoded `fastembed` config, the embeddings (384 dims) would be incompatible with the container's REST API embeddings (1536 dims). This would cause search failures or zero-similarity results.

---

## 2. Volume Mounts & Persistence

### 2.1 Cognee Data Volume

**Status: PASS**

- `docker-compose.yml:93` mounts `cognee-data:/app/.cognee_system`
- `docker-compose.yml:172-173` declares `cognee-data` as a named Docker volume with `local` driver
- Named volumes persist across container restarts and `docker compose down` (only removed with `docker compose down -v`)
- This volume stores: Kuzu graph database files, Cognee system state, local data

**Finding [PASS-1]:** Volume configuration is correct. The `cognee-data` named volume will persist Kuzu graph data and Cognee's system directory across container restarts.

### 2.2 PostgreSQL Data Volume

**Status: PASS**

- `docker-compose.yml:31` mounts `postgres-data:/var/lib/postgresql/data`
- `docker-compose.yml:171-172` declares `postgres-data` as a named Docker volume
- This persists all PostgreSQL data including pgvector indexes for Cognee

**Finding [PASS-2]:** PostgreSQL data (including cognee_db with pgvector indexes) is properly persisted.

### 2.3 Init Scripts Volume Mounts

**Status: PASS with NOTE**

- `docker-compose.yml:32-34` mounts three init scripts as read-only into `/docker-entrypoint-initdb.d/`:
  - `01-cba-schema.sql` — CBA app schema
  - `02-extensions.sql` — `init-cognee-db.sql`
  - `03-cognee-db.sh` — `init-cognee-db.sh`

**Finding [NOTE-1]:** The ordering is correct (SQL extensions before shell script that creates `cognee_db`). However, `docker-entrypoint-initdb.d` scripts only run on **first initialization** (empty data directory). If the postgres volume already exists, these scripts will NOT re-run. If the `cognee_db` database gets dropped, it will not be automatically recreated without removing the postgres volume and reinitializing.

---

## 3. REST Client Audit (cognee_client.ts)

### 3.1 Error Handling

**Status: WARN — Errors Silently Swallowed**

- `cognee_client.ts:251-263` — `add()` method catches errors and logs `console.warn`, returns `void`
- `cognee_client.ts:266-296` — `search()` method catches errors, returns empty array `[]`
- `cognee_client.ts:234-247` — `cognify()` method catches errors, logs warning

**Finding [WARN-1]:** All Cognee REST client methods silently swallow errors with `console.warn`. The caller has no way to know if an operation failed. For example:
- `addTransaction()` at line 35-44 calls `add()` but doesn't check if it succeeded
- `addCorrection()` at line 88-96 calls `add()` — if it fails, the correction is lost silently
- `storeMerchantMapping()` at line 103-124 sends two texts in one `add()` call — if it fails, merchant mapping is lost

**Severity: MEDIUM** — Silent failures mean data may not be indexed into Cognee without any user-visible indication. The pipeline will appear to succeed even when Cognee ingestion fails.

### 3.2 Timeout Management

**Status: FAIL — No Timeouts**

**Finding [FAIL-1]:** `cognee_client.ts` uses bare `fetch()` calls with no timeout or `AbortSignal`. If the Cognee container is unresponsive (e.g., during a heavy `cognify()` operation), requests will hang indefinitely, potentially blocking the Node.js event loop.

Contrast with `rag.ts:143-144` which properly uses `AbortSignal.timeout(5000)` for health checks.

**Severity: HIGH** — A hung Cognee container could cause the entire server to become unresponsive due to pending fetch promises.

### 3.3 Auth Configuration

**Status: PASS**

- `docker-compose.yml:87-88` sets `REQUIRE_AUTHENTICATION=false` and `ENABLE_BACKEND_ACCESS_CONTROL=false`
- No auth tokens are sent in `cognee_client.ts` fetch requests — this is correct given auth is disabled
- The `rag.ts` service also sends no auth tokens

**Finding [INFO-3]:** Authentication is intentionally disabled for this single-user application. This is appropriate for local/Docker deployment. For production (Neon DB), authentication should be re-enabled.

### 3.4 API Method Discrepancy: JSON vs. Multipart

**Status: WARN — Two Incompatible Approaches**

**Finding [WARN-2]:** There are **two** different approaches to calling Cognee's `/api/v1/add` endpoint:

1. `cognee_client.ts:251-263` sends **JSON** body: `{ data: string[], dataset_name: string }`
2. `rag.ts:47-78` sends **multipart form data**: `FormData` with `data` (Blob file) + `datasetName` (form field)

Per MEMORY.md, the Cognee `/api/v1/add` endpoint expects **multipart form data** (`data` is `UploadFile`, `datasetName` is Form field). This means `cognee_client.ts` may be sending data in the wrong format.

However, looking at the `cognee-repo/CLAUDE.md`, the API also accepts JSON for text data. The Cognee REST API may accept both formats, but this dual approach is fragile and should be consolidated.

**Severity: MEDIUM** — If Cognee's add endpoint only accepts multipart, then `cognee_client.ts` will silently fail on all `add()` calls (errors are swallowed per WARN-1). The `rag.ts` implementation (multipart) would be the correct one.

---

## 4. Init Script Audit (cognee_db Creation)

### 4.1 init-cognee-db.sql

**Status: PASS**

- `docker/init-cognee-db.sql:7-9` creates extensions `uuid-ossp`, `pg_trgm`, and `vector` in the default database (`ai_accountant`)
- These extensions are for the CBA app's database, not Cognee's

### 4.2 init-cognee-db.sh

**Status: PASS with NOTE**

- `docker/init-cognee-db.sh:10-14` creates `cognee_db` database conditionally (IF NOT EXISTS pattern using `\gexec`)
- `docker/init-cognee-db.sh:17-19` creates `vector` and `uuid-ossp` extensions in `cognee_db`

**Finding [NOTE-2]:** The script uses the `$POSTGRES_USER` variable for ownership, which defaults to `app_user`. Cognee's DB_USERNAME also defaults to `app_user`, so ownership is aligned.

**Finding [NOTE-3]:** The script does NOT create the `pg_trgm` extension in `cognee_db` (only in `ai_accountant`). If Cognee ever needs trigram search, this would fail. Currently not an issue since Cognee uses pgvector for search.

---

## 5. Graph Node/Edge Quality Assessment

### 5.1 DataPoint Model Coverage

**Status: GOOD — Comprehensive Schema**

The `models.py` file defines 10 DataPoint classes:

| Model | Purpose | Index Fields | Relationships |
|---|---|---|---|
| `AccountNode` | Bank accounts | bank, account_name | — |
| `StatementNode` | Parsed statements | filename, period_start | from_account -> AccountNode |
| `CategoryNode` | Transaction categories | name, description | — |
| `GSTRuleNode` | ATO GST rules | description, gst_category | applies_to -> CategoryNode |
| `PatternNode` | Recurring patterns | description_pattern, frequency | suggests_category -> CategoryNode, observed_in -> AccountNode |
| `TransactionNode` | Individual transactions | description, ai_reasoning | belongs_to, in_statement, categorized_as, gst_treatment, matches_pattern, transfer_pair |
| `TransferNode` | Cross-account transfers | — (empty) | debit_from, credit_to -> AccountNode |
| `BASPeriodNode` | BAS reporting periods | financial_year | — |
| `CorrectionNode` | User corrections | transaction_description, old/new_category | for_transaction -> TransactionNode |
| `DeductionNode` | Tax deductions | deduction_type, description | applies_to -> TransactionNode |

**Finding [QUALITY-1]:** The schema is well-designed for Australian accounting:
- **Merchants**: Not modeled as a separate node type. Merchant data is embedded in `TransactionNode.description` and `PatternNode.description_pattern`. The `cognee_client.ts` merchant mapping system stores merchant data as plain text strings, not as structured DataPoint nodes. This limits graph-quality queries like "show all transactions for merchant X."
- **ABNs**: Not modeled as a separate node. ABN data is only stored in merchant mapping text blobs (e.g., `cognee_client.ts:122`).
- **Locations**: Not modeled at all.
- **Category Priors**: Well-modeled via `PatternNode.suggests_category` -> `CategoryNode` edge and `CorrectionNode` for learning from user corrections.

**Severity: LOW** — Missing merchant/ABN/location nodes reduce graph traversal quality for enrichment queries, but the text-based approach still allows semantic search.

### 5.2 Seed Data Quality

**Status: GOOD**

- `seed.py` defines 29 categories matching the app's source of truth (`categories.ts`)
- Each category includes: name, account code, type, tax code, and keywords
- GST rules cover: GST-free, input-taxed, standard 10%, capital acquisitions, private, fuel tax credits, BAS labels, quarter dates, no-ABN rule
- Tax config covers: FY2024-25 and FY2023-24 brackets, company tax, offsets, Medicare, deductions, CGT, depreciation

**Finding [QUALITY-2]:** The seed data is comprehensive and well-structured for Australian tax accounting. However, the seed script uses `cognee.api.v1.add` (Python SDK) which configures `fastembed` embeddings (384 dims) while the Docker container uses `text-embedding-3-small` (1536 dims). See MISMATCH-3.

### 5.3 Graph Relationship Quality

**Status: WARN — Underutilized**

**Finding [QUALITY-3]:** The DataPoint models define rich relationships, but the actual REST API clients (`cognee_client.ts`, `rag.ts`) only send **flat text strings** to Cognee. They never instantiate or use the DataPoint models. The Python SDK service (`cognee_service.py`) does use structured DataPoint models, but:
- It's not clear if `cognee_service.py` is actually invoked in the Docker setup (the server uses `cognee_client.ts` HTTP calls)
- The enrichment pipeline (`enrichment.ts:266`) calls `cogneeClient.storeMerchantMapping()` which sends text, not structured nodes

This means the graph likely contains only text-extracted entities (from Cognee's LLM-based extraction during `cognify()`), not the precisely-typed nodes defined in `models.py`.

**Severity: MEDIUM** — The sophisticated graph schema exists on paper but isn't used in practice. The actual graph quality depends entirely on Cognee's automatic LLM-based entity extraction from flat text.

---

## 6. Namespace Isolation

### 6.1 Cognee Dataset Isolation

**Status: PARTIAL — Datasets Used But Not Enforced**

The system uses multiple dataset names:

| Client | Datasets Used |
|---|---|
| `cognee_client.ts` | `bank_formats`, `bank_transactions`, `merchant_mappings`, `merchant_corrections`, `transfer_patterns`, `gst_rulings` |
| `rag.ts` | `bank_transactions`, `knowledge_base` |
| `cognee-tools.ts` | Any (via `prefixDataset()`) |
| `cognee_service.py` | `statement_parser`, `categorizer`, `gst_rules` |
| `seed.py` | `categorizer`, `gst_rules` |

**Finding [NAMESPACE-1]:** There are **two completely different naming schemes** for datasets:
- `cognee_client.ts` uses: `bank_formats`, `bank_transactions`, `merchant_mappings`, `gst_rulings`
- `cognee_service.py`/`seed.py` use: `statement_parser`, `categorizer`, `gst_rules`

These are not aligned. Data seeded by `seed.py` into `categorizer` won't be found by `cognee_client.ts` searching in `bank_transactions`.

**Severity: HIGH** — Seeded knowledge (categories, GST rules) lives in different dataset namespaces than what the TypeScript client queries. The search in `cognee_client.ts:79` queries `gst_rulings` but seed data was loaded into `gst_rules`.

### 6.2 Cognee Backend Access Control

**Status: DISABLED**

- `docker-compose.yml:88` sets `ENABLE_BACKEND_ACCESS_CONTROL=false`
- Per `cognee-repo/CLAUDE.md`, this means no user-level dataset isolation
- All data is accessible to all API consumers (single default user)

**Finding [NAMESPACE-2]:** With `ENABLE_BACKEND_ACCESS_CONTROL=false`, dataset names provide **logical** grouping only. Any search can still potentially return results from any dataset depending on Cognee's internal routing. However, the search requests in `cognee_client.ts:275` explicitly pass `datasets: [dataset]` to filter, which should provide filtering at the application level.

### 6.3 Local RAG Namespace Isolation

**Status: WELL-IMPLEMENTED (Separate System)**

- `rag/namespace-manager.ts` implements per-user namespace isolation for the **local** RAG system (not Cognee)
- This is a separate system from Cognee's dataset isolation
- Uses database-level namespaceId columns for multi-tenant filtering

**Finding [INFO-4]:** The local RAG namespace system is well-designed but operates independently from Cognee's dataset system. These are two parallel knowledge storage systems.

---

## 7. Cognee Environment Variables Verification

### 7.1 Full Environment Variable Comparison

| Variable | docker-compose.yml | COGNEE_INTEGRATION.md | Match? |
|---|---|---|---|
| `LLM_PROVIDER` | `custom` | `openai` | **MISMATCH** |
| `LLM_MODEL` | `openrouter/google/gemini-3-flash-preview` | `openrouter/openai/gpt-4o` | **MISMATCH** |
| `LLM_ENDPOINT` | `https://openrouter.ai/api/v1` | `https://openrouter.ai/api/v1` | Match |
| `LLM_MAX_TOKENS` | `16384` | `16384` | Match |
| `EMBEDDING_PROVIDER` | `openai` | `fastembed` | **MISMATCH** |
| `EMBEDDING_MODEL` | `text-embedding-3-small` | `BAAI/bge-small-en-v1.5` | **MISMATCH** |
| `EMBEDDING_DIMENSIONS` | `1536` | `384` | **MISMATCH** |
| `DB_PROVIDER` | `postgres` | `postgres` | Match |
| `DB_NAME` | `cognee_db` | `ai_accountant` | **MISMATCH** |
| `VECTOR_DB_PROVIDER` | `pgvector` | `pgvector` | Match |
| `GRAPH_DATABASE_PROVIDER` | `kuzu` | `kuzu` | Match |
| `REQUIRE_AUTHENTICATION` | `false` | `false` | Match |
| `ENABLE_BACKEND_ACCESS_CONTROL` | `false` | `true` | **MISMATCH** |
| `TELEMETRY_DISABLED` | `1` | `true` | Equivalent |

**Finding [CONFIG-1]:** 7 out of 14 key variables are mismatched between `docker-compose.yml` and `COGNEE_INTEGRATION.md`. The Docker config appears to be the evolved/corrected version (e.g., using `custom` provider for OpenRouter, separate `cognee_db`, disabling access control for simplicity). The documentation is stale and should be updated.

### 7.2 Additional Docker-Only Variables

These variables are in `docker-compose.yml` but not in the integration doc:

| Variable | Value | Purpose |
|---|---|---|
| `HOST` | `0.0.0.0` | Bind Cognee to all interfaces |
| `ENVIRONMENT` | `local` | Development mode |
| `DEBUG` | `false` | Disable debug logging |
| `CORS_ALLOWED_ORIGINS` | `*` | Allow all origins |
| `EMBEDDING_MAX_TOKENS` | `8191` | Max tokens per embedding |
| `EMBEDDING_API_KEY` | `${VITE_OPENROUTER_API_KEY}` | Separate embedding API key |
| `EMBEDDING_ENDPOINT` | `https://openrouter.ai/api/v1` | Embedding endpoint |
| `ACCEPT_LOCAL_FILE_PATH` | `true` | Allow local file ingestion |
| `ALLOW_HTTP_REQUESTS` | `true` | Allow outbound HTTP |

**Finding [CONFIG-2]:** `CORS_ALLOWED_ORIGINS=*` at `docker-compose.yml:60` is permissive. Since Cognee is on an internal Docker network and only accessible via the server container, this is acceptable for local development but should be restricted in production.

---

## 8. Cognee Health Check

### 8.1 Docker Health Check

**Status: MISSING**

**Finding [FAIL-2]:** The `cognee` service in `docker-compose.yml:47-105` has **no `healthcheck`** defined. Compare with the `postgres` service (`docker-compose.yml:37-42`) which has a proper healthcheck. This means:
- The `server` service `depends_on: cognee` (line 145) only waits for the container to **start**, not for Cognee to be **ready**
- Actually, the server `depends_on` only lists `postgres` (with `condition: service_healthy`), not `cognee`. The server does not wait for Cognee at all.

**Severity: MEDIUM** — On first boot, the server may attempt Cognee API calls before the Cognee container is ready (loading models, connecting to Postgres, etc.), causing initial failures. The silent error handling in `cognee_client.ts` masks this.

### 8.2 Application-Level Health Check

**Status: PARTIAL**

- `rag.ts:141-151` implements `isHealthy()` which calls `GET /api/v1/settings` with a 5-second timeout
- This is the **only** health check implementation
- However, it's unclear if `isHealthy()` is called during startup or used for circuit-breaking

**Finding [WARN-3]:** The `isHealthy()` method in `rag.ts:143` calls `/api/v1/settings` instead of `/api/v1/health`. Per `COGNEE_INTEGRATION.md:1249`, the correct health endpoint is `GET /api/v1/health`. The `/api/v1/settings` endpoint may work but is not the canonical health check.

**Finding [WARN-4]:** `cognee_client.ts` has **no health check** at all. It provides no way to verify Cognee availability before making API calls.

---

## Summary of Findings

### Critical Issues (Action Required)

| ID | Severity | Description | Files |
|---|---|---|---|
| MISMATCH-3 | **HIGH** | Embedding dimension mismatch between Docker (1536) and Python SDK (384) — would produce incompatible vectors | `docker-compose.yml:70`, `cognee_service.py:41-43`, `seed.py:36-37` |
| NAMESPACE-1 | **HIGH** | Dataset naming mismatch — seeded data in `categorizer`/`gst_rules` won't be found by TS client querying `bank_transactions`/`gst_rulings` | `cognee_client.ts:79-83`, `seed.py:148,243` |
| FAIL-1 | **HIGH** | No request timeouts in `cognee_client.ts` — hung Cognee could block server | `cognee_client.ts:253,271,236` |

### Important Issues

| ID | Severity | Description | Files |
|---|---|---|---|
| FAIL-2 | **MEDIUM** | No Docker healthcheck for Cognee service; server doesn't wait for Cognee readiness | `docker-compose.yml:47-105` |
| WARN-1 | **MEDIUM** | All Cognee client errors silently swallowed | `cognee_client.ts:258-263,282-295,241-246` |
| WARN-2 | **MEDIUM** | JSON vs multipart form data disagreement for /api/v1/add | `cognee_client.ts:253-256`, `rag.ts:52-57` |
| QUALITY-3 | **MEDIUM** | Rich DataPoint schema defined but not used; only flat text sent via REST | `models.py:1-140`, `cognee_client.ts:251-263` |

### Informational

| ID | Severity | Description | Files |
|---|---|---|---|
| MISMATCH-1 | LOW | LLM provider/model divergence between Docker and docs | `docker-compose.yml:62-63`, `COGNEE_INTEGRATION.md:346-347` |
| MISMATCH-2 | LOW | Python SDK uses `openai` provider instead of `custom` | `cognee_service.py:33` |
| CONFIG-1 | LOW | 7/14 env vars mismatched between Docker and docs | Various |
| WARN-3 | LOW | Health check uses `/settings` instead of `/health` | `rag.ts:143` |
| QUALITY-1 | LOW | No dedicated MerchantNode, ABNNode, or LocationNode types | `models.py` |
| NOTE-1 | INFO | Init scripts only run on fresh PostgreSQL volumes | `docker-compose.yml:32-34` |
| INFO-3 | INFO | Auth intentionally disabled for single-user deployment | `docker-compose.yml:87-88` |

### Recommendations

1. **Align embedding configuration:** Either update `cognee_service.py` and `seed.py` to use `text-embedding-3-small` (1536 dims) matching Docker, or revert Docker to `fastembed`. The seed script MUST use the same embedding model as the running container.

2. **Align dataset names:** Consolidate on one naming scheme. Either update `cognee_client.ts` to use `categorizer`/`gst_rules` or update `seed.py` to use `bank_transactions`/`gst_rulings`.

3. **Add request timeouts:** Add `AbortSignal.timeout(10000)` (or similar) to all fetch calls in `cognee_client.ts`.

4. **Add Docker healthcheck for Cognee:**
   ```yaml
   healthcheck:
     test: ["CMD", "curl", "-f", "http://localhost:8000/api/v1/health"]
     interval: 10s
     timeout: 5s
     retries: 10
     start_period: 60s
   ```

5. **Add `depends_on` with health condition:** Update server service to wait for Cognee:
   ```yaml
   depends_on:
     cognee:
       condition: service_healthy
     postgres:
       condition: service_healthy
   ```

6. **Surface Cognee errors:** Change `console.warn` in `cognee_client.ts` to either throw errors or return result objects indicating success/failure, so callers can handle failures appropriately.

7. **Update COGNEE_INTEGRATION.md** to reflect the actual Docker configuration (embedding model, LLM provider, database name, access control settings).
