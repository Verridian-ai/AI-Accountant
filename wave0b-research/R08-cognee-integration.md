# R08: Cognee Integration Plan — Waves 1–10

## 1. Current Cognee State

### 1.1 CogneeClient Methods (cognee_client.ts — 953 lines)

The `CogneeClient` class is the **single source of truth** for all Cognee HTTP communication.

| Method | HTTP | Endpoint | Purpose |
|--------|------|----------|---------|
| `getAuthToken()` | POST | `/api/v1/auth/login` | JWT auth with cached token (50 min TTL) |
| `add(data, dataset)` | POST | `/api/v1/add` | Multipart FormData — adds text data to dataset |
| `search(query, dataset, topK, searchType)` | POST | `/api/v1/search` | JSON body search — returns `string[]` |
| `searchRich(query, dataset, topK, searchType)` | POST | `/api/v1/search` | Rich search — returns `CogneeSearchResult[]` |
| `cognify(datasets, background, customPrompt)` | POST | `/api/v1/cognify` | Build knowledge graph (requires `datasets` array!) |
| `addAndCognify(data, dataset, background)` | — | Convenience | add() then cognify() |
| `listDatasets()` | GET | `/api/v1/datasets` | List all datasets |
| `getDatasetStatus()` | GET | `/api/v1/datasets/status` | Processing status |
| `getDatasetGraph(datasetId)` | GET | `/api/v1/datasets/:id/graph` | Get knowledge graph |
| `createDataset(name)` | POST | `/api/v1/datasets` | Explicit dataset creation |
| `isHealthy()` | GET | `/` | Health check |
| `submitFeedback(data)` | POST | `/api/v1/feedback` | Submit feedback (Wave 16) |
| `triggerMemify(data)` | POST | `/api/v1/memify` | Memory consolidation (Wave 16) |
| `createDataPoint(datasetName, schema)` | POST | `/api/v1/datasets/:name/data_points` | DataPoint CRUD (Wave 16) |
| `getDataPoints(datasetName)` | GET | `/api/v1/datasets/:name/data_points` | DataPoint CRUD (Wave 16) |
| `deleteDataPoint(datasetName, dpId)` | DELETE | `/api/v1/datasets/:name/data_points/:id` | DataPoint CRUD (Wave 16) |
| `applyOntology(datasetName, ontology)` | POST | `/api/v1/datasets/:name/ontology` | Ontology CRUD (Wave 16) |
| `getOntology(datasetName)` | GET | `/api/v1/datasets/:name/ontology` | Ontology CRUD (Wave 16) |
| `getNodeSets(datasetName)` | GET | `/api/v1/datasets/:name/node_sets` | NodeSet CRUD (Wave 16) |
| `createNodeSet(datasetName, nodeSet)` | POST | `/api/v1/datasets/:name/node_sets` | NodeSet CRUD (Wave 16) |
| `deleteNodeSet(datasetName, nodeSetId)` | DELETE | `/api/v1/datasets/:name/node_sets/:id` | NodeSet CRUD (Wave 16) |
| `temporalSearch(query, options)` | — | Wrapper | Time-enriched search (Wave 17) |
| `temporalCognify(dataset, options)` | — | Wrapper | Temporal-aware cognify (Wave 17) |
| `crossDatasetSearch(query, datasets, options)` | — | Parallel | Multi-dataset search (Wave 17) |

**Domain-specific convenience methods:**
- `addStatementData()`, `addTransaction()`, `searchSimilarTransactions()`, `getCategoryPatterns()`
- `traceAccountFlows()`, `getGSTRuling()`, `addCorrection()`
- `storeMerchantMapping()`, `lookupMerchant()`, `batchLookupMerchants()`, `updateMerchantFromCorrection()`

### 1.2 Authentication Model

**Current: Single admin user — NO per-user isolation**

```
COGNEE_USERNAME = 'admin@cognee-cba.dev'
COGNEE_PASSWORD = 'CbaAdmin2026'
```

- All API calls use a single cached JWT token
- Token refresh: 5 minutes before expiry, auto-re-login
- `authHeaders()` returns `{ Authorization: Bearer ${token} }` for ALL requests regardless of originating user
- Graceful degradation: if auth fails, tries without auth headers

### 1.3 Docker Environment Variables (Cognee Service)

```yaml
# Current docker-compose.yml — Cognee container
- HOST=0.0.0.0
- ENVIRONMENT=local
- CORS_ALLOWED_ORIGINS=*
- LLM_PROVIDER=custom
- LLM_MODEL=openrouter/google/gemini-3-flash-preview
- LLM_ENDPOINT=https://openrouter.ai/api/v1
- LLM_API_KEY=${VITE_OPENROUTER_API_KEY}
- LLM_MAX_TOKENS=16384
- EMBEDDING_PROVIDER=openai
- EMBEDDING_MODEL=text-embedding-3-small
- EMBEDDING_DIMENSIONS=1536
- EMBEDDING_MAX_TOKENS=8191
- EMBEDDING_API_KEY=${VITE_OPENROUTER_API_KEY}
- EMBEDDING_ENDPOINT=https://openrouter.ai/api/v1
- DB_PROVIDER=postgres
- DB_HOST=postgres
- DB_PORT=5432
- DB_NAME=cognee_db
- DB_USERNAME=${POSTGRES_USER:-app_user}
- DB_PASSWORD=${POSTGRES_PASSWORD}
- VECTOR_DB_PROVIDER=pgvector
- VECTOR_DB_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/cognee_db
- GRAPH_DATABASE_PROVIDER=kuzu
- REQUIRE_AUTHENTICATION=false          # ← CRITICAL: Disabled
- ENABLE_BACKEND_ACCESS_CONTROL=false   # ← CRITICAL: Disabled
- ACCEPT_LOCAL_FILE_PATH=true
- ALLOW_HTTP_REQUESTS=true
- TELEMETRY_DISABLED=1
```

**Missing env vars** (needed for Wave 3):
- `CACHING=true`
- `CACHE_BACKEND=redis`
- `CACHE_HOST=redis`
- `CACHE_PORT=6379`

### 1.4 CogneeTools (cognee-tools.ts — 671 lines)

Wrapper layer used by Claude agents. Key features:

- **`COGNEE_DATASETS` constant**: Registry of 27 named datasets across all domains
- **`datasetPrefix` config**: Already supports prefixing — currently empty string
- **`prefixDataset()`**: Private method that adds `${config.datasetPrefix}_${dataset}` when prefix non-empty
- **Domain-specific indexing**: 15+ index methods (tax, inventory, assets, OCR, matching, reporting, etc.)
- **Domain-specific search**: 15+ search methods with type-appropriate search types
- **Wave 16 additions**: `searchWithDataPoint()`, `searchWithOntology()`, `submitSearchFeedback()`, `exploreGraph()`
- **Wave 17 additions**: `temporalSearch()`, `crossModuleSearch()`, `searchTimeline()`, `indexCrossModuleInsight()`
- **Module→Dataset mapping**: `_moduleToDataset()` maps 12 logical modules to dataset names

### 1.5 Existing Cognee Datasets (27 total)

| # | Dataset Name | Domain | Search Type | Wave |
|---|-------------|--------|-------------|------|
| 1 | `financial_insights` | Core | GRAPH_COMPLETION | Original |
| 2 | `transaction_patterns` | Core | GRAPH_COMPLETION | Original |
| 3 | `merchant_data` | Core | CHUNKS_LEXICAL | Original |
| 4 | `tax_strategies` | Tax | GRAPH_COMPLETION | W11 |
| 5 | `tax_rulings` | Tax | RAG_COMPLETION | W11 |
| 6 | `deduction_patterns` | Tax | CHUNKS | W11 |
| 7 | `loan_products` | Loans | CHUNKS_LEXICAL | W11 |
| 8 | `interest_rates` | Loans | CHUNKS | W11 |
| 9 | `economic_indicators` | Economy | CHUNKS | W11 |
| 10 | `rba_data` | Economy | CHUNKS | W11 |
| 11 | `budget_patterns` | Budget | GRAPH_COMPLETION | W11 |
| 12 | `spending_insights` | Budget | CHUNKS | W11 |
| 13 | `inventory_catalog` | Inventory | CHUNKS | W11 |
| 14 | `stock_movements` | Inventory | GRAPH_COMPLETION | W11 |
| 15 | `recon_patterns` | Reconciliation | GRAPH_COMPLETION | W11 |
| 16 | `asset_register` | Fixed Assets | CHUNKS | W12 |
| 17 | `depreciation_schedules` | Fixed Assets | CHUNKS_LEXICAL | W12 |
| 18 | `entity_hierarchy` | Multi-Entity | GRAPH_COMPLETION | W12 |
| 19 | `consolidation_patterns` | Multi-Entity | GRAPH_COMPLETION | W12 |
| 20 | `ocr_extractions` | OCR | CHUNKS_LEXICAL | W14 |
| 21 | `matching_patterns` | Payment Match | GRAPH_COMPLETION | W14 |
| 22 | `datapoint_schemas` | Knowledge | CHUNKS | W16 |
| 23 | `ontology_definitions` | Knowledge | GRAPH_COMPLETION | W16 |
| 24 | `feedback_history` | Knowledge | CHUNKS | W16 |
| 25 | `temporal_patterns` | Intelligence | GRAPH_COMPLETION | W17 |
| 26 | `cross_module_insights` | Intelligence | GRAPH_COMPLETION | W17 |
| 27 | `module_relationships` | Intelligence | GRAPH_COMPLETION | W17 |

### 1.6 Wave 16 Services (4 services)

| Service | File | Purpose | DB Table |
|---------|------|---------|----------|
| `CogneeDataPointService` | `cognee-datapoints.ts` | CRUD for DataPoint configs; 3 predefined types (FinancialTransaction, BusinessRelationship, TaxEvent) | `datapoint_configs` |
| `CogneeOntologyService` | `cognee-ontologies.ts` | CRUD for ontologies; 3 predefined (Financial, Tax, Relationship); graph validation | `graph_schemas` |
| `CogneeFeedbackService` | `cognee-feedback.ts` | Feedback on search results; accuracy tracking; auto-memify trigger | `cognee_feedback` |
| `CogneeGraphService` | `cognee-graph.ts` | Graph visualization; stats; pruning; BFS subgraph; Fibonacci sphere layout | — (reads from Cognee API) |

### 1.7 Wave 17 Services (4 services)

| Service | File | Purpose | DB Table |
|---------|------|---------|----------|
| `TemporalCognifyService` | `temporal-cognify.ts` | AU FY/BAS logic, time-aware search, timeline generation | `temporal_queries` |
| `CrossModuleIntelligenceService` | `cross-module-intelligence.ts` | 6 scanners, Pearson correlation, anomaly detection | `cross_module_insights` |
| `CogneeSessionService` | `cognee-sessions.ts` | Redis cache, sessions, rate limiting (sliding window sorted sets) | — (Redis only) |
| `IntelligenceSubscriptionService` | `intelligence-subscriptions.ts` | Subscribe to insights, trigger notifications | `intelligence_subscriptions` |

### 1.8 cognee-repo/ Directory

The cloned Cognee repository is present at project root with:
- `Dockerfile` — for building the Cognee container
- `cognee-mcp/` — MCP server source (Dockerfile, pyproject.toml, src/)
- `cognee-frontend/` — Cognee's built-in frontend
- `cognee-starter-kit/` — Example configurations

**The MCP server is NOT currently configured or running.** It exists only as source in the cloned repo.

---

## 2. Wave 3 Multi-User Plan

### 2.1 Overview

Wave 3 is the critical Cognee enablement wave. It transforms the single-admin Cognee setup into a multi-user, session-aware knowledge graph system.

### 2.2 Docker Config Changes

```yaml
# docker-compose.yml — Cognee service — ADDITIONS for Wave 3
- REQUIRE_AUTHENTICATION=true           # was false
- ENABLE_BACKEND_ACCESS_CONTROL=true    # was false
- CACHING=true                          # NEW
- CACHE_BACKEND=redis                   # NEW
- CACHE_HOST=redis                      # NEW (service name)
- CACHE_PORT=6379                       # NEW
```

When `ENABLE_BACKEND_ACCESS_CONTROL=true`:
- Search operations are scoped to datasets the authenticated user has read access to
- Adding/removing documents is scoped at dataset level
- Automatic routing via Dataset Database Handlers to per-user storage

### 2.3 Per-User Dataset Isolation Strategy

**Option A: Dataset Prefix (Recommended — least-effort)**

```typescript
// cognee-tools.ts already supports this:
const tools = new CogneeTools({ datasetPrefix: `user_${userId}` });
// prefixDataset('bank_transactions') → 'user_123_bank_transactions'
```

Pros: Uses existing `prefixDataset()` infrastructure. No Cognee-side config needed.
Cons: Flat namespace — all datasets for all users in same Cognee instance.

**Option B: Per-User Cognee Accounts**

```typescript
// cognee_client.ts — new method
async createUserAccount(userId: string, email: string): Promise<void> {
  await this.adminRequest('POST', '/api/v1/users', {
    username: email,
    password: generateSecurePassword()
  });
}
```

Pros: True access control via Cognee's built-in RBAC.
Cons: More complex — requires managing Cognee user accounts.

**Recommendation**: Use **Option A (prefix)** for Wave 3. It's a 1-line change per consumer. Upgrade to Option B later when user management matures.

### 2.4 CogneeClient Modifications for Wave 3

```typescript
// New: Per-user auth token management
class CogneeClient {
  // Add userId parameter to all public methods
  async add(data: string[], dataset: string, userId?: string): Promise<void>;
  async search(query: string, dataset: string, topK: number, searchType: CogneeSearchType, userId?: string): Promise<string[]>;

  // New: Session support
  async searchWithSession(query: string, dataset: string, sessionId: string, ...): Promise<string[]>;

  // New: User account management
  async createCogneeUser(email: string, password: string): Promise<{ userId: string }>;
  async getCogneeUserToken(email: string, password: string): Promise<string>;

  // Modified: getAuthToken() to support per-user tokens
  private userTokenCache: Map<string, { token: string; expiresAt: number }>;
  private async getAuthToken(userId?: string): Promise<string>;
}
```

### 2.5 Database Schema (Wave 3)

```sql
-- Migration: docker/migrations/0015_cognee_multi_user.sql
CREATE TABLE IF NOT EXISTS cognee_user_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  cognee_email TEXT NOT NULL,
  cognee_password_hash TEXT NOT NULL, -- encrypted
  cognee_user_id TEXT,
  dataset_prefix TEXT NOT NULL, -- 'user_{userId}'
  is_active INTEGER NOT NULL DEFAULT 1,
  last_sync_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cognee_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_type TEXT NOT NULL, -- 'chat', 'analysis', 'batch'
  cognee_session_id TEXT,
  state TEXT NOT NULL DEFAULT 'active', -- 'active', 'paused', 'expired'
  context_data TEXT, -- JSON: conversation history, active filters
  created_at TEXT NOT NULL,
  last_activity_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
```

### 2.6 Redis-Cognee Bridge

The `CogneeSessionService` (Wave 17) already provides:
- Session lifecycle (create/get/update/destroy/list)
- Query result caching with TTL
- Sliding-window rate limiting

For Wave 3, the bridge needs:
1. Add Cognee cache env vars to docker-compose.yml
2. Update `CogneeSessionService` to store user-scoped session data
3. Pass `session_id` to Cognee search calls for conversational memory
4. Cache Cognee search results with user-scoped keys: `cognee:cache:user_{userId}:{hash}`

### 2.7 Custom DataPoint Models

8 DataPoint models for financial entities:

| DataPoint | Fields | Target Dataset |
|-----------|--------|----------------|
| `TransactionNode` | amount, merchant, category, date, gst_amount, account_id | bank_transactions |
| `AccountNode` | account_number, account_type, balance, bank_name | financial_insights |
| `CategoryNode` | name, parent, tax_deductible, gst_applicable | financial_insights |
| `GSTRuleNode` | rule_type, rate, description, ato_reference | gst_rules |
| `PatternNode` | pattern_type, frequency, amount_range, entities | transaction_patterns |
| `BASPeriodNode` | quarter, financial_year, gst_collected, gst_paid | financial_insights |
| `MerchantNode` | name, abn, industry, gst_registered, default_category | merchant_mappings |
| `DeductionNode` | category, amount, substantiated, ruling_ref | deduction_patterns |

**Note**: Wave 16 already defined 3 predefined DataPoints (FinancialTransaction, BusinessRelationship, TaxEvent). The Wave 3 DataPoints are complementary, not duplicative — they cover different entity types.

---

## 3. Dataset Manifest — All New Datasets by Wave

### 3.1 Existing Datasets (27 — from Waves 11–17, already registered)

See Section 1.5 above.

### 3.2 New Datasets for Waves 1–10 (~15 new)

| # | Dataset Name | Owner Wave | Domain | Search Type | Purpose |
|---|-------------|------------|--------|-------------|---------|
| 1 | `session_memory` | Wave 3 | Session | GRAPH_COMPLETION | Conversational context, user preferences |
| 2 | `user_preferences` | Wave 3 | Session | CHUNKS | Per-user settings, favorite categories |
| 3 | `employee_profiles` | Wave 4 | Payroll | CHUNKS | Employee data for NL queries |
| 4 | `pay_structures` | Wave 4 | Payroll | GRAPH_COMPLETION | Pay rate relationships |
| 5 | `pay_run_history` | Wave 5 | Payroll | CHUNKS | Historical pay run data |
| 6 | `leave_patterns` | Wave 5 | Payroll | GRAPH_COMPLETION | Leave usage patterns |
| 7 | `stp_compliance` | Wave 6 | Payroll | RAG_COMPLETION | STP event data, ATO compliance |
| 8 | `award_rates` | Wave 6 | Payroll | CHUNKS_LEXICAL | Award classification rates |
| 9 | `timesheet_patterns` | Wave 6 | Payroll | GRAPH_COMPLETION | Time/attendance patterns |
| 10 | `customer_profiles` | Wave 7 | Invoicing | CHUNKS | Customer data for NL queries |
| 11 | `invoice_history` | Wave 7 | Invoicing | GRAPH_COMPLETION | Invoice data and relationships |
| 12 | `payment_patterns` | Wave 8 | Invoicing | GRAPH_COMPLETION | Payment behavior, dunning history |
| 13 | `ar_aging_patterns` | Wave 9 | AR | GRAPH_COMPLETION | Aging analysis, late payment patterns |
| 14 | `supplier_profiles` | Wave 10 | AP | CHUNKS | Supplier data for NL queries |
| 15 | `bill_patterns` | Wave 10 | AP | GRAPH_COMPLETION | Bill patterns, payment cycles |

### 3.3 Dataset Naming Convention

```
{prefix}{domain}_{entity_type}
```

With Wave 3 multi-user prefix:
```
user_{userId}_{domain}_{entity_type}
# e.g., user_abc123_employee_profiles
```

### 3.4 Total Dataset Count After Wave 10

- **Existing**: 27 datasets (Waves 11–17, already built)
- **New**: 15 datasets (Waves 3–10)
- **Total**: 42 named dataset patterns

### 3.5 Dataset → Search Type Rationale

| Search Type | When to Use | Example Datasets |
|-------------|------------|------------------|
| `CHUNKS` | Fast vector similarity, time-series data, simple lookups | employee_profiles, pay_run_history, award_rates, customer_profiles, supplier_profiles |
| `CHUNKS_LEXICAL` | Exact keyword matching (names, ABNs, SKUs) | award_rates (exact classification names) |
| `GRAPH_COMPLETION` | Relationship-aware reasoning, pattern analysis | pay_structures, leave_patterns, invoice_history, payment_patterns, bill_patterns |
| `RAG_COMPLETION` | Document retrieval with LLM-generated answers | stp_compliance (ATO rulings/guidance) |
| `GRAPH_SUMMARY_COMPLETION` | Summarization over graph data | ar_aging_patterns |

---

## 4. Wave 16 Compatibility Analysis

### 4.1 What Wave 16 Already Built

| Component | Status | Impact on Waves 1–10 |
|-----------|--------|---------------------|
| **DataPoint CRUD** (cognee-datapoints.ts) | ✅ Fully built | Wave 3 DataPoints extend, don't conflict |
| **Ontology CRUD** (cognee-ontologies.ts) | ✅ Fully built | New waves can create domain-specific ontologies |
| **Feedback system** (cognee-feedback.ts) | ✅ Fully built | Reusable for all new datasets |
| **Graph visualization** (cognee-graph.ts) | ✅ Fully built | Works with any dataset — no changes needed |
| **3 predefined DataPoints** | ✅ Seeded per-user | Complementary to Wave 3's 8 new DataPoints |
| **3 predefined ontologies** | ✅ Seeded per-user | May need extension for payroll/invoicing domains |
| **16 API routes** under `/api/knowledge/` | ✅ Working | Reusable for new DataPoint types |
| **7 UI components** | ✅ Working | GraphExplorer works with any dataset |
| **CogneeClient extensions** | ✅ 10 new methods | All compatible with prefix-based isolation |

### 4.2 Multi-User Impact on Wave 16

**Critical finding**: Wave 16 services use `userId` parameter in their methods:
- `CogneeDataPointService.defineDataPoint(userId, config)` — ✅ Already user-scoped
- `CogneeOntologyService.defineOntology(userId, definition)` — ✅ Already user-scoped
- `CogneeFeedbackService.submitFeedback(userId, feedback)` — ✅ Already user-scoped

**However**, the underlying `cogneeClient` calls do NOT pass userId:
```typescript
// cognee-datapoints.ts line 142
await this._sendToCognee(config.datasetName, config.schemaDefinition);
// → cogneeClient.add([schemaText], datasetName) — NO userId, NO prefix
```

**Wave 3 fix needed**: All Wave 16 services must be updated to use prefixed dataset names when calling cogneeClient. Options:
1. Pass `userId` through to `cogneeClient` and apply prefix there
2. Apply prefix in the Wave 16 services before calling `cogneeClient`
3. Use the `CogneeTools` wrapper (which already has prefix support) instead of direct `cogneeClient` calls

**Recommendation**: Option 3 — refactor Wave 16 services to use `CogneeTools` with user-scoped prefix, maintaining `cogneeClient` as the low-level HTTP layer.

### 4.3 New Ontologies Needed for Waves 4–10

| Ontology | Wave | Node Types | Edge Types |
|----------|------|-----------|------------|
| **Payroll** | Wave 4 | Employee, PayCategory, PayStructure, SuperFund | EMPLOYED_BY, PAID_VIA, CONTRIBUTES_TO |
| **Leave** | Wave 5 | LeaveType, LeaveBalance, PayRun | ACCRUED_IN, TAKEN_FROM, PROCESSED_IN |
| **Compliance** | Wave 6 | STPEvent, Award, Timesheet | REPORTED_TO, GOVERNED_BY, LOGGED_IN |
| **Customer** | Wave 7 | Customer, Invoice, Payment | BILLED_TO, PAID_BY, CREDITED_TO |
| **Subscription** | Wave 8 | RecurringInvoice, Subscription, DunningSequence | GENERATES, SUBSCRIBED_TO, REMINDED_BY |
| **Supplier** | Wave 10 | Supplier, Bill, PurchaseOrder | SUPPLIED_BY, ORDERED_FROM, RECEIVED_FROM |

These ontologies can be created using the existing `CogneeOntologyService.defineOntology()` — no new infrastructure needed.

### 4.4 New DataPoint Types Needed

In addition to Wave 3's 8 financial DataPoints and Wave 16's 3 predefined types:

| DataPoint Type | Wave | Fields |
|----------------|------|--------|
| `EmployeeProfile` | Wave 4 | name, position, employment_type, start_date, pay_rate |
| `PayRunRecord` | Wave 5 | period, total_gross, total_tax, total_super, employee_count |
| `STPEvent` | Wave 6 | event_type, period, status, total_amounts |
| `CustomerProfile` | Wave 7 | business_name, abn, payment_terms, total_invoiced |
| `InvoiceRecord` | Wave 7 | number, customer, amount, gst, status, due_date |
| `SupplierProfile` | Wave 10 | business_name, abn, payment_terms, total_billed |

These use the existing `CogneeDataPointService.defineDataPoint()` — no infrastructure changes.

---

## 5. Client Modifications by Wave

### 5.1 Wave 1: No Cognee Changes

- Enhance `ragService.searchMulti()` for agent-specific context
- Intent-aware dataset selection (tax query → search `tax_strategies` + `tax_rulings`)
- **No new datasets, no client modifications**

### 5.2 Wave 2: Minor Cognee Indexing

```typescript
// cognee-tools.ts — Add method
async indexAgentDecision(decision: {
  agentType: string;
  query: string;
  reasoning: string;
  result: string;
}): Promise<void> {
  const text = `Agent ${decision.agentType}: Query "${decision.query}". ` +
    `Reasoning: ${decision.reasoning}. Result: ${decision.result}`;
  await this.index([text], COGNEE_DATASETS.financialInsights);
}
```

- Index confirmed mutations into `transaction_patterns` for learning
- Store agent decision reasoning in `financial_insights`

### 5.3 Wave 3: Major CogneeClient Overhaul

**cognee_client.ts modifications:**

1. **Per-user token cache**:
```typescript
private userTokenCache = new Map<string, { token: string; expiresAt: number }>();

private async getAuthToken(userId?: string): Promise<string> {
  // If no userId, use admin token (backward compat)
  // If userId, look up cognee_user_accounts table → get credentials → login
}
```

2. **Dataset prefix in all methods**:
```typescript
async add(data: string[], dataset: string, userId?: string): Promise<void> {
  const prefixedDataset = userId ? `user_${userId}_${dataset}` : dataset;
  // ... existing logic with prefixedDataset
}
```

3. **Session-aware search**:
```typescript
async searchWithSession(
  query: string,
  dataset: string,
  sessionId: string,
  topK?: number,
  searchType?: CogneeSearchType
): Promise<CogneeSearchResult[]> {
  // Include session_id in request body for Cognee session memory
  const body = {
    query,
    search_type: searchType,
    datasets: [dataset],
    top_k: topK,
    session_id: sessionId, // ← NEW: Cognee uses this for context
  };
  // ...
}
```

4. **User account management**:
```typescript
async createCogneeUser(email: string, password: string): Promise<string>;
async deleteCogneeUser(cogneeUserId: string): Promise<void>;
```

**cognee-tools.ts modifications:**

1. Constructor accepts `userId` and auto-sets prefix:
```typescript
constructor(config: Partial<CogneeToolConfig> & { userId?: string } = {}) {
  this.config = {
    ...DEFAULT_CONFIG,
    ...config,
    datasetPrefix: config.userId ? `user_${config.userId}` : (config.datasetPrefix || ''),
  };
}
```

2. All agent invocations must instantiate `CogneeTools` with userId:
```typescript
// In orchestrator or agent base
const tools = new CogneeTools({ userId: context.userId });
```

### 5.4 Wave 4: Payroll Datasets

**cognee-tools.ts — Add to COGNEE_DATASETS:**
```typescript
// Payroll domain (Wave 4)
employeeProfiles: 'employee_profiles',
payStructures: 'pay_structures',
```

**cognee-tools.ts — Add methods:**
```typescript
async indexEmployeeProfile(employee: { name: string; position: string; ... }): Promise<void>;
async searchEmployees(query: string): Promise<string[]>;
async indexPayStructure(structure: { ... }): Promise<void>;
async searchPayStructures(query: string): Promise<string[]>;
```

### 5.5 Wave 5: Pay Run Datasets

```typescript
// Payroll domain (Wave 5)
payRunHistory: 'pay_run_history',
leavePatterns: 'leave_patterns',
```

```typescript
async indexPayRun(payRun: { ... }): Promise<void>;
async searchPayRunHistory(query: string): Promise<string[]>;
async indexLeavePattern(pattern: { ... }): Promise<void>;
async searchLeavePatterns(query: string): Promise<string[]>;
```

### 5.6 Wave 6: STP & Compliance Datasets

```typescript
// Payroll domain (Wave 6)
stpCompliance: 'stp_compliance',
awardRates: 'award_rates',
timesheetPatterns: 'timesheet_patterns',
```

```typescript
async indexSTPEvent(event: { ... }): Promise<void>;
async searchSTPCompliance(query: string): Promise<string[]>;
async indexAwardRate(rate: { ... }): Promise<void>;
async searchAwardRates(query: string): Promise<string[]>;
async indexTimesheetPattern(pattern: { ... }): Promise<void>;
```

### 5.7 Wave 7: Customer & Invoice Datasets

```typescript
// Invoicing domain (Wave 7)
customerProfiles: 'customer_profiles',
invoiceHistory: 'invoice_history',
```

```typescript
async indexCustomerProfile(customer: { ... }): Promise<void>;
async searchCustomers(query: string): Promise<string[]>;
async indexInvoice(invoice: { ... }): Promise<void>;
async searchInvoiceHistory(query: string): Promise<string[]>;
```

### 5.8 Wave 8: Payment Patterns Dataset

```typescript
// Invoicing domain (Wave 8)
paymentPatterns: 'payment_patterns',
```

```typescript
async indexPaymentPattern(pattern: { ... }): Promise<void>;
async searchPaymentPatterns(query: string): Promise<string[]>;
```

### 5.9 Wave 9: AR Aging Dataset

```typescript
// AR domain (Wave 9)
arAgingPatterns: 'ar_aging_patterns',
```

```typescript
async indexARAgingData(aging: { ... }): Promise<void>;
async searchARPatterns(query: string): Promise<string[]>;
```

### 5.10 Wave 10: Supplier & AP Datasets

```typescript
// AP domain (Wave 10)
supplierProfiles: 'supplier_profiles',
billPatterns: 'bill_patterns',
```

```typescript
async indexSupplierProfile(supplier: { ... }): Promise<void>;
async searchSuppliers(query: string): Promise<string[]>;
async indexBillPattern(pattern: { ... }): Promise<void>;
async searchBillPatterns(query: string): Promise<string[]>;
```

---

## 6. Docker Config Changes Summary

### 6.1 Wave 3 Changes (Critical)

```yaml
# docker-compose.yml — Cognee service — REPLACE these lines:
- REQUIRE_AUTHENTICATION=true           # was false
- ENABLE_BACKEND_ACCESS_CONTROL=true    # was false

# ADD these lines:
- CACHING=true
- CACHE_BACKEND=redis
- CACHE_HOST=redis
- CACHE_PORT=6379
```

### 6.2 Cognee depends_on Update

```yaml
cognee:
  depends_on:
    postgres:
      condition: service_healthy
    redis:                              # ← ADD: Cognee now needs Redis
      condition: service_healthy
```

### 6.3 No Other Docker Changes Needed for Waves 1–10

The existing 5-service stack (postgres, redis, cognee, server, client) is sufficient. No new containers needed.

---

## 7. Module → Dataset Mapping Updates

The `_moduleToDataset()` mapping in cognee-tools.ts needs expansion for Waves 4–10:

```typescript
private _moduleToDataset(module: string): string {
  const mapping: Record<string, string> = {
    // Existing (Waves 11-17)
    'transactions': COGNEE_DATASETS.transactionPatterns,
    'forecasting': COGNEE_DATASETS.budgetPatterns,
    'compliance': COGNEE_DATASETS.complianceRulings,
    'anomaly_detection': COGNEE_DATASETS.transactionPatterns,
    'tax': COGNEE_DATASETS.taxStrategies,
    'knowledge': COGNEE_DATASETS.financialInsights,
    'merchant': COGNEE_DATASETS.merchantData,
    'assets': COGNEE_DATASETS.assetRegister,
    'inventory': COGNEE_DATASETS.inventoryCatalog,
    'recon': COGNEE_DATASETS.reconPatterns,
    'ocr': COGNEE_DATASETS.ocrExtractions,
    'matching': COGNEE_DATASETS.matchingPatterns,
    // NEW: Waves 4-10
    'payroll': COGNEE_DATASETS.employeeProfiles,
    'employees': COGNEE_DATASETS.employeeProfiles,
    'payruns': COGNEE_DATASETS.payRunHistory,
    'leave': COGNEE_DATASETS.leavePatterns,
    'stp': COGNEE_DATASETS.stpCompliance,
    'timesheets': COGNEE_DATASETS.timesheetPatterns,
    'customers': COGNEE_DATASETS.customerProfiles,
    'invoicing': COGNEE_DATASETS.invoiceHistory,
    'payments': COGNEE_DATASETS.paymentPatterns,
    'ar': COGNEE_DATASETS.arAgingPatterns,
    'suppliers': COGNEE_DATASETS.supplierProfiles,
    'bills': COGNEE_DATASETS.billPatterns,
  };
  return mapping[module] ?? COGNEE_DATASETS.financialInsights;
}
```

---

## 8. Session-Aware Search Design

### 8.1 Architecture

```
User Chat Message
       ↓
Intent Router (Wave 1)
       ↓
Agent Dispatcher (Wave 1)
       ↓ passes userId + sessionId
CogneeTools({ userId, sessionId })
       ↓ applies prefix
CogneeClient.searchWithSession(query, prefixedDataset, sessionId)
       ↓
Cognee API /api/v1/search (with session_id param)
       ↓
Results scoped to user's datasets + enriched by session context
```

### 8.2 Session Lifecycle

1. **Chat session created** → `CogneeSessionService.createSession(userId, 'chat')`
2. **Each message** → session data updated with conversation history
3. **Search calls** include `session_id` for Cognee to maintain conversational context
4. **Session expires** after 30 minutes of inactivity (existing `SESSION_TTL_SECONDS`)
5. **Cache keys** include userId for isolation: `cognee:cache:user_{userId}:{queryHash}`

### 8.3 Rate Limiting Per User

The existing `CogneeSessionService.checkRateLimit()` uses sliding window sorted sets. For multi-user, the operation key should include userId:

```typescript
const rateKey = `user:${userId}:cognee_search`;
const result = await cogneeSessionService.checkRateLimit(rateKey, 100, 3600);
// 100 searches per hour per user
```

---

## 9. Risk Assessment

### 9.1 Wave 3 Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Cognee `ENABLE_BACKEND_ACCESS_CONTROL=true` may break existing admin-only auth | High | Test thoroughly in Docker. Keep fallback to admin auth if per-user fails. |
| Redis-Cognee connection may have compatibility issues | Medium | Cognee v0.5.2 has documented Redis support. Test with cache env vars before committing. |
| Dataset prefix bloat (42 datasets × N users) | Medium | Cognee handles this at scale via pgvector. Monitor PostgreSQL storage. |
| Existing data migration needed | Medium | Write one-time migration script to prefix existing datasets with `user_default_` |

### 9.2 General Cognee Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Cognee API changes between versions | Low | Pin to v0.5.2 in Dockerfile |
| Knowledge graph quality depends on ingestion quality | Medium | Use domain-specific DataPoint prompts per wave |
| Cross-dataset search performance at scale | Low | `crossDatasetSearch()` already parallelizes with `Promise.all()` |

---

## 10. Cognee Integration Summary by Wave

| Wave | Cognee Work | New Datasets | Client Changes | Docker Changes |
|------|------------|--------------|----------------|----------------|
| **1** | Intent-aware dataset selection | 0 | Minor ragService enhancement | None |
| **2** | Index agent decisions/mutations | 0 | 1 new CogneeTools method | None |
| **3** | **Multi-user enablement** | 2 (session_memory, user_preferences) | **Major CogneeClient overhaul** | **4 new env vars, depends_on** |
| **4** | Payroll datasets + DataPoints | 2 (employee_profiles, pay_structures) | 4 new CogneeTools methods | None |
| **5** | Pay run datasets | 2 (pay_run_history, leave_patterns) | 4 new CogneeTools methods | None |
| **6** | STP compliance datasets | 3 (stp_compliance, award_rates, timesheet_patterns) | 5 new CogneeTools methods | None |
| **7** | Customer/invoice datasets + ontology | 2 (customer_profiles, invoice_history) | 4 new CogneeTools methods | None |
| **8** | Payment patterns dataset | 1 (payment_patterns) | 2 new CogneeTools methods | None |
| **9** | AR aging dataset | 1 (ar_aging_patterns) | 2 new CogneeTools methods | None |
| **10** | Supplier/AP datasets + ontology | 2 (supplier_profiles, bill_patterns) | 4 new CogneeTools methods | None |
| **Total** | — | **15 new datasets** | **~30 new methods** | **Wave 3 only** |
