# R02: Cognee Capabilities & Configuration Research

## Agent: R02 — Cognee Capabilities & Config Researcher
## Date: 2026-02-12
## Status: Complete

---

## 1. Current State — Enabled Features & Configuration

### 1.1 Docker Compose Environment Variables (Cognee Service)

The Cognee service (`cba-cognee`) is configured with the following environment variables in `docker-compose.yml`:

| Variable | Value | Purpose |
|---|---|---|
| `HOST` | `0.0.0.0` | Bind address |
| `ENVIRONMENT` | `local` | Environment mode |
| `DEBUG` | `false` | Debug logging |
| `LOG_LEVEL` | `INFO` | Log verbosity |
| `CORS_ALLOWED_ORIGINS` | `*` | CORS policy (wide open) |
| **LLM** | | |
| `LLM_PROVIDER` | `custom` | Custom LLM provider |
| `LLM_MODEL` | `openrouter/google/gemini-3-flash-preview` | LLM model via OpenRouter |
| `LLM_ENDPOINT` | `https://openrouter.ai/api/v1` | LLM API endpoint |
| `LLM_API_KEY` | `${VITE_OPENROUTER_API_KEY}` | API key from env |
| `LLM_MAX_TOKENS` | `16384` | Max token budget |
| **Embeddings** | | |
| `EMBEDDING_PROVIDER` | `openai` | Embedding provider |
| `EMBEDDING_MODEL` | `text-embedding-3-small` | OpenAI embedding model |
| `EMBEDDING_DIMENSIONS` | `1536` | Embedding vector size |
| `EMBEDDING_MAX_TOKENS` | `8191` | Max tokens per embedding |
| `EMBEDDING_API_KEY` | `${VITE_OPENROUTER_API_KEY}` | Routed through OpenRouter |
| `EMBEDDING_ENDPOINT` | `https://openrouter.ai/api/v1` | Embedding API endpoint |
| **Database** | | |
| `DB_PROVIDER` | `postgres` | Relational backend |
| `DB_HOST` | `postgres` | Docker service name |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `cognee_db` | Cognee's dedicated database |
| `DB_USERNAME` | `${POSTGRES_USER:-app_user}` | DB user |
| `DB_PASSWORD` | `${POSTGRES_PASSWORD}` | DB password |
| **Vector Store** | | |
| `VECTOR_DB_PROVIDER` | `pgvector` | pgvector on shared PostgreSQL |
| `VECTOR_DB_URL` | `postgresql://...@postgres:5432/cognee_db` | Full connection string |
| **Graph Store** | | |
| `GRAPH_DATABASE_PROVIDER` | `kuzu` | Embedded Kuzu graph DB |
| **Security** | | |
| `REQUIRE_AUTHENTICATION` | `false` | Auth disabled |
| `ENABLE_BACKEND_ACCESS_CONTROL` | `false` | Multi-user isolation disabled |
| `ACCEPT_LOCAL_FILE_PATH` | `true` | Allow local file paths |
| `ALLOW_HTTP_REQUESTS` | `true` | Allow HTTP requests |
| `TELEMETRY_DISABLED` | `1` | Telemetry off |

**Resource limits**: 2 CPUs, 4GB RAM.
**Volume**: `cognee-data:/app/.cognee_system` (Kuzu graph DB + local state)
**Health check**: HTTP GET to `http://localhost:8000/api/v1/settings` every 30s.

### 1.2 CogneeClient Class (`cognee_client.ts`)

The `CogneeClient` class is the **single source of truth** for all Cognee HTTP calls. Both `rag.ts` and `cognee-tools.ts` delegate to it.

**Auth flow**:
- Username/password login via `/api/v1/auth/login` (form-encoded)
- JWT token cached for 50 minutes (refreshed 5 min before expiry)
- Graceful degradation: if auth fails, tries requests without auth headers
- Default credentials: `admin@cognee-cba.dev` / `CbaAdmin2026`

**Methods implemented**:

| Method | Endpoint | Description |
|---|---|---|
| `add(data, dataset)` | `POST /api/v1/add` | Multipart FormData upload |
| `search(query, dataset, topK, searchType)` | `POST /api/v1/search` | JSON body search |
| `searchRich(query, dataset, topK, searchType)` | `POST /api/v1/search` | Returns rich results with metadata |
| `cognify(datasets, background, customPrompt)` | `POST /api/v1/cognify` | Build knowledge graph |
| `addAndCognify(data, dataset, background)` | add + cognify | Convenience combo |
| `listDatasets()` | `GET /api/v1/datasets` | List all datasets |
| `getDatasetStatus()` | `GET /api/v1/datasets/status` | Processing status |
| `getDatasetGraph(datasetId)` | `GET /api/v1/datasets/:id/graph` | Get graph nodes/edges |
| `createDataset(name)` | `POST /api/v1/datasets` | Create dataset explicitly |
| `isHealthy()` | `GET /` | Health check |

**Domain-specific methods**:
- `addStatementData()` — Formats statement metadata → `bank_formats` dataset
- `addTransaction()` — Formats transaction → `bank_transactions` dataset
- `searchSimilarTransactions()` — CHUNKS search on `bank_transactions`
- `getCategoryPatterns()` — GRAPH_COMPLETION on `bank_transactions`
- `traceAccountFlows()` — GRAPH_COMPLETION_COT on `transfer_patterns`
- `getGSTRuling()` — RAG_COMPLETION on `gst_rules`
- `addCorrection()` — Adds correction text to `bank_transactions`
- `storeMerchantMapping()` — Stores merchant→canonical mapping in `merchant_mappings`
- `lookupMerchant()` — CHUNKS_LEXICAL lookup on `merchant_mappings`
- `updateMerchantFromCorrection()` — Learns from user edits
- `batchLookupMerchants()` — Sequential batch merchant lookups

**FINANCIAL_COGNIFY_PROMPT** (custom prompt used during cognify):
```
Extract financial entities: merchant names, transaction categories,
ABN numbers, GST registration status, payment methods, account references,
recurring transaction patterns, and financial relationships between entities.
Identify temporal patterns like weekly/monthly/quarterly transactions.
```

**Timeouts**: 30s for standard requests, 5 minutes for cognify operations.

### 1.3 CogneeTools Class (`cognee-tools.ts`)

Thin wrapper around `cogneeClient` adding:
- **Dataset prefix support** (`datasetPrefix` config option)
- **Batch chunking** (50-item batches for indexing)
- **Canonical dataset name registry** (`COGNEE_DATASETS`)

**COGNEE_DATASETS registry**:
```
financial_insights, transaction_patterns, merchant_data,
tax_strategies, tax_rulings, deduction_patterns,
loan_products, interest_rates,
economic_indicators, rba_data,
budget_patterns, spending_insights
```

**Domain helpers**:
- `indexTaxStrategies()` → `tax_strategies` dataset
- `searchTaxRulings()` → RAG_COMPLETION on `tax_rulings`
- `searchEconomicData()` → CHUNKS on `economic_indicators`

### 1.4 Active Cognee Usage Across Agents

| Agent | Dataset(s) Used | Search Type | Operations |
|---|---|---|---|
| `transaction-categorizer` | `bank_transactions`, `merchant_mappings` | CHUNKS | search + store mappings |
| `gst-calculator` | `gst_rules` | GRAPH_COMPLETION | search |
| `statement-parser` | (multiple) | GRAPH_COMPLETION | search |
| `budget-analyzer` | `financial_insights` | GRAPH_COMPLETION | search |
| `cross-account-tracer` | `transfer_patterns` | GRAPH_COMPLETION | search |
| `account-reconciler` | `reconciliation_patterns` | GRAPH_COMPLETION | search |
| `merchant-intelligence` | `merchant_mappings` | CHUNKS_LEXICAL | search + index |
| `tax-strategy` | `tax_rulings` | GRAPH_COMPLETION, CHUNKS | search |
| `financial-planner` | (multiple) | RAG_COMPLETION | search |
| `personal-tax-claims` | `tax_rulings` | CHUNKS_LEXICAL | search |
| `payroll-agent` | (multiple) | CHUNKS_LEXICAL | search + index |
| `rag.ts` (wrapper) | `bank_transactions` | CHUNKS, GRAPH_SUMMARY_COMPLETION | search + add + cognify |
| `pipeline.ts` | `bank_formats` | — | addStatementData |
| `enrichment.ts` | `merchant_mappings` | — | storeMerchantMapping + cognify |

### 1.5 Supported Search Types (14 total)

The `CogneeSearchType` union in `cognee_client.ts` defines:

| Search Type | Currently Used? | Speed | LLM Call? | Use Case |
|---|---|---|---|---|
| `CHUNKS` | **Yes** | Fast (~50-200ms) | No | Vector similarity for transaction matching |
| `CHUNKS_LEXICAL` | **Yes** | Fast | No | Keyword matching for merchant/product names |
| `GRAPH_COMPLETION` | **Yes** | Slow (~1-3s) | Yes | Graph-aware Q&A with LLM reasoning |
| `RAG_COMPLETION` | **Yes** | Medium | Yes | Retrieve-then-generate (text-only RAG) |
| `GRAPH_SUMMARY_COMPLETION` | **Yes** | Medium | Yes | Graph + summary context for chat |
| `GRAPH_COMPLETION_COT` | **Yes** | Slow | Yes | Chain-of-thought over graph (account flows) |
| `SUMMARIES` | No | Fast | No | Pre-computed summary retrieval |
| `TRIPLET_COMPLETION` | No | Medium | Yes | Triplet-based completion |
| `CYPHER` | No | Fast | No | Direct Cypher query execution |
| `NATURAL_LANGUAGE` | No | Medium | Yes | Natural language → Cypher → results |
| `GRAPH_COMPLETION_CONTEXT_EXTENSION` | No | Slow | Yes | Iterative context expansion |
| `FEELING_LUCKY` | No | Varies | Yes | Auto-selects best search mode |
| `TEMPORAL` | No | Medium | Yes | Time-aware queries (needs temporal cognify) |
| `CODING_RULES` | No | Fast | No | Code rule associations (needs memify) |

**Additional search types from docs not in client**:
- `FEEDBACK` — Stores user feedback on recent interactions (scores graph relationships)
- `CODE` — Code-focused retrieval for indexed codebases

---

## 2. Multi-User Gap — Disabled Features & Needed Changes

### 2.1 Current State

Both multi-user isolation flags are **disabled**:
```yaml
REQUIRE_AUTHENTICATION=false
ENABLE_BACKEND_ACCESS_CONTROL=false
```

This means:
- **No user isolation** — All data is in a shared global pool
- **No dataset-level permissions** — Any request can read/write any dataset
- **No per-user search scoping** — Searches return results across all datasets
- **No ownership tracking** — Datasets have no owner attribution
- **Auth still works** — The client logs in with hardcoded credentials, but it's cosmetic

### 2.2 What Multi-User Mode Provides (from docs)

When `ENABLE_BACKEND_ACCESS_CONTROL=true`:
- **Isolated Search**: Strictly scoped to datasets the authenticated user has read access to
- **Granular Management**: Add/remove documents scoped at dataset level
- **Automatic Routing**: System determines which database/schema to connect to per dataset
- **Dataset Database Handlers**: Pluggable classes that map datasets to per-tenant graph/vector backends
- **Permission System**: ACLs with read/write/admin roles per dataset per user

### 2.3 Changes Needed for Per-User Dataset Isolation

1. **Set `ENABLE_BACKEND_ACCESS_CONTROL=true`** in docker-compose.yml
2. **Set `REQUIRE_AUTHENTICATION=true`** to enforce login
3. **Create users per agent/role** using Cognee's user management API:
   ```python
   from cognee.modules.users.methods import create_user
   agent_user = await create_user("categorizer_agent@goldledger.local", "password")
   ```
4. **Create authorized datasets** per agent:
   ```python
   from cognee.modules.data.methods import create_authorized_dataset
   dataset = await create_authorized_dataset("bank_transactions", agent_user)
   ```
5. **Grant cross-dataset permissions** where agents need shared access:
   ```python
   from cognee.modules.users.permissions.methods import give_permission_on_dataset
   await give_permission_on_dataset(gst_agent_user, categorizer_dataset.id, "read")
   ```
6. **Update CogneeClient auth** to support multiple user credentials (currently hardcoded single admin)
7. **Configure Dataset Database Handlers** if per-dataset DB isolation is desired (optional — can start with shared DB with ACL-only isolation)

### 2.4 Impact Assessment

| Change | Effort | Risk | Benefit |
|---|---|---|---|
| Enable access control | Low (env var) | Medium (may break existing queries) | Dataset isolation |
| Create per-agent users | Medium (API calls + migration) | Low | Agent-level permissions |
| CogneeClient multi-auth | Medium (refactor auth flow) | Medium | Proper token management |
| Dataset Database Handlers | High (custom handler code) | High | Physical DB separation |

---

## 3. Unused Features — Full Capability Inventory

### 3.1 Custom DataPoints (NOT USED)

**What**: Pydantic models inheriting from `DataPoint` that define graph schemas with typed nodes, edges, and index fields.

**Current state**: The `COGNEE_INTEGRATION.md` doc defines 9 detailed DataPoint models (AccountNode, StatementNode, TransactionNode, CategoryNode, GSTRuleNode, PatternNode, BASPeriodNode, CorrectionNode, TransferNode) — but **NONE are implemented**. All data is ingested as plain text strings via the REST API `/api/v1/add`.

**What we're missing**:
- **Typed graph nodes** with specific properties (amount_cents, gst_rate, etc.)
- **Explicit edges** between entities (Transaction → Category, Transaction → Account)
- **Controlled index_fields** — Currently text is chunked generically; DataPoints let you choose exactly which fields get embedded
- **Direct graph manipulation** via `add_data_points()` — bypasses the chunking/LLM extraction pipeline entirely
- **Structured search** — Query typed nodes instead of hoping the LLM extracted entities correctly

**GoldLedger-specific DataPoint models that should exist**:
```python
class MerchantNode(DataPoint):
    abbreviated: str
    canonical: str
    abn: Optional[str]
    gst_registered: bool
    industry: str
    default_category: str
    metadata: dict = {"index_fields": ["abbreviated", "canonical", "industry"]}

class TransactionNode(DataPoint):
    date: str
    description: str
    amount_cents: int
    category: str
    gst_applicable: bool
    belongs_to_merchant: SkipValidation[Any] = None  # → MerchantNode
    metadata: dict = {"index_fields": ["description", "category"]}
```

**Impact**: HIGH. Custom DataPoints would dramatically improve:
- Search accuracy (no more relying on LLM extraction from free text)
- Graph structure quality (explicit edges vs inferred)
- Query performance (typed nodes enable more precise vector search)

### 3.2 Sessions & Caching (NOT USED)

**What**: Conversational memory for search operations. Sessions track (user_id, session_id) → list of {time, question, context, answer} interactions. Enables follow-up questions with contextual awareness.

**Current state**: Redis exists in docker-compose but is NOT connected to Cognee. No caching env vars are set. The `/api/chat` endpoint manages its own conversation context by fetching 50 recent transactions — it doesn't use Cognee sessions.

**Missing env vars**:
```yaml
CACHING=true
CACHE_BACKEND=redis
CACHE_HOST=redis
CACHE_PORT=6379
```

**What we're missing**:
- **Conversational chat via Cognee** — "What was that merchant again?" would work with session context
- **Session-scoped search** — `session_id` parameter in search calls
- **Automatic interaction history** — Each Q&A stored and used as context for next query
- **24h TTL** with automatic cleanup

**Impact**: MEDIUM-HIGH. Would dramatically improve the chat experience and enable multi-turn financial conversations.

### 3.3 Feedback System (NOT USED)

**What**: `SearchType.FEEDBACK` lets users rate search results. Feedback scores are applied to knowledge graph relationships to improve future results.

**Current state**: Not implemented. User corrections go through `addCorrection()` which adds plain text — not structured feedback.

**What we're missing**:
- `save_interaction=True` on search calls
- `SearchType.FEEDBACK` calls to record quality ratings
- Batch feedback on multiple interactions (`last_k` parameter)
- Graph relationship scoring based on user satisfaction

**Impact**: MEDIUM. Would create a reinforcement learning loop for search quality.

### 3.4 Temporal Cognify (NOT USED)

**What**: `temporal_cognify=True` flag on cognify builds time-aware event nodes. `SearchType.TEMPORAL` enables queries like "What happened before July 2024?" or "Transactions between Q1 and Q2 2025".

**Current state**: Not used. Transaction dates exist in the data but are just part of the plain text strings.

**What we're missing**:
- Time-aware event extraction from transaction data
- Temporal queries: "Show spending trends before vs after July"
- Date-range filtering at the graph level
- Pattern detection across time periods

**Impact**: HIGH for a financial application. Transaction data is inherently temporal — this is a natural fit for:
- BAS quarter comparisons
- Seasonal spending analysis
- Year-over-year trend analysis

### 3.5 Memify (NOT USED)

**What**: `.memify()` enriches existing knowledge graphs with derived facts. Extracts subgraph chunks and creates rule associations and new edges without re-ingesting data.

**Current state**: Not used.

**What we're missing**:
- Derived rules from transaction patterns (e.g., "Transactions at Woolworths are always grocery category")
- `SearchType.CODING_RULES` for retrieving derived associations
- Incremental enrichment of existing graphs

**Impact**: MEDIUM. Could auto-derive categorization rules from historical patterns.

### 3.6 Ontologies (NOT USED)

**What**: Optional RDF/OWL files that standardize entity types and relationship labels during graph extraction. Cognee validates extracted entities against the ontology and enriches with parent classes.

**Current state**: Not used. Entity extraction relies entirely on the FINANCIAL_COGNIFY_PROMPT.

**What we're missing**:
- **FIBO (Financial Industry Business Ontology)** subset for standardized financial entity types
- Validated entity types (merchant, account, category, gst_treatment)
- Inherited relationships from domain schema
- Consistency in how the LLM names entities

**Impact**: MEDIUM. Would improve entity extraction consistency and align with financial standards.

### 3.7 NodeSets (NOT USED)

**What**: Lightweight tags attached to data during `add()`. Become first-class graph nodes connected with `belongs_to_set` edges. Enable search scoping by tag.

**Current state**: Not used. Data is organized only by dataset name.

**What we're missing**:
- Tag transactions by: account type, financial year, BAS quarter, business vs personal
- Search within tagged subsets: "Find expenses tagged 'business' in FY2024-25"
- Cross-dataset grouping without moving data

**Impact**: LOW-MEDIUM. Useful for multi-dimensional filtering but datasets partially serve this purpose already.

### 3.8 Incremental Loading (NOT USED)

**What**: `cognify(incremental_loading=True)` skips already-processed data. Only new/updated files are processed.

**Current state**: Every cognify call processes all data in the dataset. No incremental flag is passed.

**What we're missing**:
- Efficient re-cognification as datasets grow
- Avoiding redundant LLM calls on already-processed chunks
- Faster pipeline for appending new transactions

**Impact**: HIGH for cost/performance. Currently each cognify potentially re-processes everything.

### 3.9 Custom Pipelines & Tasks (NOT USED)

**What**: Cognee's cognify pipeline is composed of 6 ordered Tasks. You can create custom extraction and enrichment tasks.

**Current state**: Only the default pipeline is used.

**What we're missing**:
- Custom financial entity extraction task
- Custom merchant deduplication task
- Custom GST classification task in the pipeline

**Impact**: MEDIUM. Would allow tighter integration between Cognee's pipeline and GoldLedger's domain logic.

### 3.10 Graph Visualization (NOT USED)

**What**: `visualize_graph()` renders interactive HTML files with nodes, edges, colors, and tooltips. Requires Python SDK access.

**Current state**: `getDatasetGraph()` method exists in CogneeClient but is **never called** anywhere in the codebase. The REST API endpoint `GET /api/v1/datasets/:id/graph` returns `{ nodes, edges }` JSON.

**What we're missing**:
- Client-side graph visualization component
- Interactive knowledge graph explorer
- Visual representation of merchant→category→GST relationships

**Impact**: HIGH for user experience. See Section 4 below.

### 3.11 Natural Language & Cypher Queries (NOT USED)

**What**: `NATURAL_LANGUAGE` search converts plain English to Cypher queries. `CYPHER` executes Cypher directly.

**Current state**: Not used.

**What we're missing**:
- Ad-hoc graph queries: "Show all merchants connected to category 'Advertising'"
- Power-user graph exploration
- Direct Kuzu/graph DB access through Cognee

**Impact**: LOW-MEDIUM. Useful for advanced users and debugging but not critical.

### 3.12 FEELING_LUCKY Auto-Mode (NOT USED)

**What**: LLM automatically selects the best search mode for a given query.

**Current state**: Search types are hardcoded per agent/use case.

**Impact**: LOW. Current hardcoded type selection is appropriate and more predictable.

### 3.13 S3 Storage (NOT USED)

**What**: Cognee can ingest from S3 URIs directly.

**Current state**: All data is uploaded via FormData.

**Impact**: LOW. Not needed for current architecture.

---

## 4. Graph Visualization API — Endpoints for 3D Graph Rendering

### 4.1 Existing Graph API

The `getDatasetGraph()` method in `cognee_client.ts` calls:
```
GET /api/v1/datasets/{datasetId}/graph
```

Response format (normalized by client):
```typescript
{
  nodes: unknown[];  // Could be { id, type, properties, ... }
  edges: unknown[];  // Could be { source, target, type, weight, ... }
}
```

The client normalizes the response, handling both `nodes`/`edges` and `vertices`/`links` key names.

### 4.2 Graph Data Structure (Kuzu Backend)

Since Cognee uses Kuzu (embedded graph DB), the graph contains:
- **Nodes**: Entity (name, type), EntityType, DocumentChunk (text), TextSummary (text), Document (name), NodeSet
- **Edges**: Relationships with labels like `categorized_as`, `belongs_to`, `matches_pattern`, plus `has_items`, `belongs_to_set`
- **Properties**: Each node/edge can have arbitrary properties including `weight`, `relationship_type`, `type`

### 4.3 What's Needed for 3D Visualization

To render a 3D force-directed graph (e.g., using Three.js + three-forcegraph):

1. **API endpoint** on the CBA server that calls `cogneeClient.getDatasetGraph()` for each dataset
2. **Data transformation** to convert Cognee's graph format to the visualization library's expected format:
   ```typescript
   // Three-forcegraph expects:
   {
     nodes: [{ id, name, type, color, size, ... }],
     links: [{ source, target, label, weight, ... }]
   }
   ```
3. **Color mapping** from entity types to colors:
   - Merchants → gold (#FFCC00)
   - Categories → blue
   - Transactions → green
   - GST rules → orange
   - Accounts → purple
4. **Multiple dataset support** — Merge graphs from `bank_transactions`, `merchant_mappings`, `gst_rules`, etc.

### 4.4 Python Visualization (Alternative)

Cognee also provides `cognee.api.v1.visualize.visualize.visualize_graph()` which generates interactive HTML files using pyvis/networkx. This is Python-only and not directly usable from the TypeScript server, but could be:
- Called via a Python subprocess
- Or replaced with a client-side JS implementation using the graph API data

---

## 5. Redis Gap — Missing Configuration

### 5.1 Current State

Redis is deployed in `docker-compose.yml`:
```yaml
redis:
  image: redis:7-alpine
  container_name: cba-redis
  ports: ["6379:6379"]
  volumes: [redis-data:/data]
  healthcheck: redis-cli ping
```

The CBA **server** has `REDIS_URL=redis://redis:6379` but uses it only for rate limiting.

The **Cognee service** has **NO Redis connection** configured.

### 5.2 Missing Environment Variables for Cognee

```yaml
# Add to cognee service in docker-compose.yml:
- CACHING=true
- CACHE_BACKEND=redis
- CACHE_HOST=redis
- CACHE_PORT=6379
```

### 5.3 What Redis Would Enable

| Feature | Without Redis | With Redis |
|---|---|---|
| Sessions/Caching | Disabled | Full conversational memory |
| Multi-process coordination | Not supported | Shared locks for Kuzu |
| Session TTL | N/A | 24h auto-expiry |
| Chat context | Manual (fetch 50 transactions) | Automatic Q&A history |
| Feedback tracking | Not possible | Interaction-linked feedback |

### 5.4 Optional Additional Redis Config

```yaml
# Optional but recommended:
- CACHE_USERNAME=           # Redis auth (if needed)
- CACHE_PASSWORD=           # Redis auth (if needed)
# TTL is 86400s (24h) by default, configurable
```

---

## 6. Feature Priority Matrix — Unused Features Ranked by Impact vs Effort

### Priority Legend
- **Impact**: How much this improves GoldLedger's capabilities
- **Effort**: Implementation complexity
- **Dependencies**: What else must be done first

| # | Feature | Impact | Effort | Dependencies | Priority |
|---|---|---|---|---|---|
| 1 | **Redis → Cognee Sessions** | HIGH | LOW | 4 env vars in docker-compose | **P0 — Quick Win** |
| 2 | **Incremental Loading** | HIGH | LOW | Pass `incremental_loading=True` to cognify | **P0 — Quick Win** |
| 3 | **Temporal Cognify** | HIGH | MEDIUM | Run temporal cognify on transaction datasets | **P1 — High Value** |
| 4 | **Custom DataPoints** | HIGH | HIGH | Python models + Python service or API extension | **P1 — High Value** |
| 5 | **Graph Visualization** | HIGH | MEDIUM | Client component + API endpoint + data transform | **P1 — High Value** |
| 6 | **Feedback System** | MEDIUM | LOW | `save_interaction=True` + FEEDBACK search type | **P1 — Quick Win** |
| 7 | **Multi-User Isolation** | MEDIUM | MEDIUM | Enable access control + create users + update auth | **P2 — Foundation** |
| 8 | **Memify (Derived Rules)** | MEDIUM | MEDIUM | Run memify after cognify, add CODING_RULES search | **P2 — Enhancement** |
| 9 | **Ontologies (FIBO)** | MEDIUM | HIGH | Create FIBO subset OWL file + pass to cognify | **P2 — Quality** |
| 10 | **NodeSets** | LOW-MED | LOW | Add node_set tags to add() calls | **P3 — Nice to Have** |
| 11 | **Natural Language / Cypher** | LOW-MED | LOW | Use NATURAL_LANGUAGE/CYPHER search types | **P3 — Power User** |
| 12 | **Custom Pipelines** | MEDIUM | HIGH | Python custom tasks + pipeline config | **P3 — Advanced** |
| 13 | **FEELING_LUCKY** | LOW | LOW | Use search type | **P4 — Optional** |
| 14 | **S3 Storage** | LOW | LOW | Not needed for current arch | **P4 — Not Needed** |

### Recommended Implementation Order

**Wave 1 (Quick Wins — 1-2 days)**:
1. Add 4 Redis env vars to enable Cognee sessions/caching
2. Add `incremental_loading=True` to cognify calls
3. Add `save_interaction=True` to search calls + wire FEEDBACK type

**Wave 2 (High Value — 1 week)**:
4. Implement `getDatasetGraph()` API endpoint + client-side 3D graph component
5. Enable temporal cognify for transaction datasets + add TEMPORAL search type to chat
6. Design and implement Custom DataPoint models (Python service)

**Wave 3 (Foundation — 1 week)**:
7. Enable multi-user isolation + create per-agent users + update CogneeClient auth
8. Run memify after cognify cycles + enable CODING_RULES search
9. Create FIBO financial ontology subset

**Wave 4 (Polish — ongoing)**:
10. Add NodeSet tags for business/personal, FY quarters
11. Enable NATURAL_LANGUAGE/CYPHER for power users
12. Custom pipeline tasks for financial entity extraction

---

## 7. Summary of Key Gaps

### Gap 1: Redis Not Connected to Cognee
- **Status**: Redis deployed but not configured for Cognee
- **Fix**: 4 environment variables
- **Unlocks**: Sessions, caching, feedback, multi-process coordination

### Gap 2: All Data is Plain Text
- **Status**: Transactions ingested as formatted text strings
- **Fix**: Custom DataPoint models + `add_data_points()` or structured API
- **Unlocks**: Typed graph nodes, explicit edges, precise vector search

### Gap 3: No Temporal Awareness
- **Status**: Dates are embedded in text but not structurally queryable
- **Fix**: `temporal_cognify=True` on transaction datasets
- **Unlocks**: Time-range queries, seasonal analysis, BAS period comparisons

### Gap 4: Graph Data Never Exposed to Client
- **Status**: `getDatasetGraph()` exists but is never called
- **Fix**: Server API endpoint + client visualization component
- **Unlocks**: 3D knowledge graph explorer, relationship visualization

### Gap 5: No Feedback Loop
- **Status**: User corrections add text to datasets but don't score graph relationships
- **Fix**: `save_interaction=True` + `SearchType.FEEDBACK`
- **Unlocks**: Self-improving search quality

### Gap 6: Cognify Reprocesses Everything
- **Status**: No incremental loading flag
- **Fix**: Pass `incremental_loading=True`
- **Unlocks**: Faster, cheaper cognify cycles as datasets grow

---

## 8. Cognee API Endpoint Reference (Complete)

| Method | Endpoint | Status in GoldLedger |
|---|---|---|
| `POST /api/v1/auth/login` | **Used** (form-encoded login) |
| `POST /api/v1/add` | **Used** (multipart FormData) |
| `POST /api/v1/cognify` | **Used** (JSON with datasets + custom_prompt) |
| `POST /api/v1/search` | **Used** (JSON with query, search_type, datasets, top_k) |
| `GET /api/v1/datasets` | **Used** (list datasets) |
| `GET /api/v1/datasets/status` | **Used** (dataset status) |
| `GET /api/v1/datasets/:id/graph` | **Implemented but never called** |
| `POST /api/v1/datasets` | **Implemented but never called** |
| `GET /` | **Used** (health check) |
| `GET /api/v1/settings` | **Used** (health check in docker) |
| `POST /api/v1/prune/data` | Not implemented in client |
| `POST /api/v1/prune/system` | Not implemented in client |
| `GET /api/v1/health` | Not used (using `/` instead) |
