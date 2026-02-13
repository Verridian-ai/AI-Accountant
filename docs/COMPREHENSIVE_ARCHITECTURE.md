# GoldLedger — Comprehensive Architecture Documentation

> **Version**: 2.0 — February 2026
> **Status**: Definitive Reference — supersedes `AGENT_ARCHITECTURE.md` and `COGNEE_INTEGRATION.md`
> **Source of Truth**: This document reconciles all prior architecture docs against the **current codebase** and **Cognee v0.5.2+ documentation**.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Database Architecture](#2-database-architecture)
3. [Cognee Backend Integration](#3-cognee-backend-integration)
4. [AI Agent System — Fixed Agents](#4-ai-agent-system--fixed-agents)
5. [AI Agent System — Flexible Agents & Claude SDK](#5-ai-agent-system--flexible-agents--claude-sdk)
6. [Cognee Client & Tools Layer](#6-cognee-client--tools-layer)
7. [Data Models & Knowledge Graph Schema](#7-data-models--knowledge-graph-schema)
8. [Multi-Tenant Architecture](#8-multi-tenant-architecture)
9. [Configuration & Environment](#9-configuration--environment)
10. [Deployment & Production Considerations](#10-deployment--production-considerations)
11. [Feature Discovery Matrix](#11-feature-discovery-matrix)
12. [Custom DataPoint Models](#12-custom-datapoint-models)
13. [Custom Pipeline Designs](#13-custom-pipeline-designs)
14. [Search Strategy Matrix](#14-search-strategy-matrix)
15. [Feedback & Learning Loop Design](#15-feedback--learning-loop-design)
16. [Ontology Strategy](#16-ontology-strategy)
17. [Temporal Intelligence Design](#17-temporal-intelligence-design)
18. [Session & Memory Architecture](#18-session--memory-architecture)
19. [Memify Strategy](#19-memify-strategy)
20. [Implementation Roadmap](#20-implementation-roadmap)
21. [ROI Analysis](#21-roi-analysis)
22. [Australian Tax Optimization Engine](#22-australian-tax-optimization-engine) ✅ IMPLEMENTED
23. [Investment & Trading Intelligence](#23-investment--trading-intelligence) 🔮 FUTURE
24. [Financial Product Comparison & Calculators](#24-financial-product-comparison--calculators) ✅ IMPLEMENTED
25. [Advanced AI Architecture & Agent Swarm](#25-advanced-ai-architecture--agent-swarm) 🔮 FUTURE
26. [Multi-Phase Implementation & Compliance](#26-multi-phase-implementation--compliance) ⚡ PARTIAL
27. [Implementation Summary](#27-implementation-summary)

---

## 1. System Overview

GoldLedger is an Australian financial management application that combines traditional accounting (bank statement parsing, transaction categorization, BAS/GST calculations, payroll) with AI-powered agents backed by a knowledge graph memory system.

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        React Frontend (Vite)                        │
│  Transactions · Statements · BAS · Payroll · Analytics · Agent Chat │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTP / SSE
┌──────────────────────────────▼──────────────────────────────────────┐
│                     Hono TypeScript Server                          │
│  ~100 API endpoints · JWT Auth · SSE Events                        │
│                                                                     │
│  ┌─────────────────────┐  ┌──────────────────────────────────────┐ │
│  │  Fixed Claude Agents │  │  Cognee Client (cognee_client.ts)   │ │
│  │  (8 specialists)     │  │  REST HTTP → Cognee Backend         │ │
│  │  base-agent.ts       │  │  Auth · Add · Cognify · Search      │ │
│  │  + cognee-tools.ts   │  │  Merchant Memory · Dataset Mgmt     │ │
│  └──────────┬──────────┘  └──────────────┬───────────────────────┘ │
│             │                             │                         │
│  ┌──────────▼─────────────────────────────▼───────────────────────┐ │
│  │              Orchestrator (routes tasks to agents)              │ │
│  └────────────────────────────────────────────────────────────────┘ │
└──────────┬────────────────────────────────┬────────────────────────┘
           │ SQL                             │ HTTP REST
┌──────────▼──────────┐          ┌──────────▼──────────────────────┐
│  CBA PostgreSQL     │          │  Cognee Backend (FastAPI)       │
│  (Transactional DB) │          │  ┌───────────┐ ┌─────────────┐ │
│  Transactions       │          │  │ Relational │ │   Vector    │ │
│  Accounts           │          │  │ (Postgres) │ │  (PGVector) │ │
│  Statements         │          │  └───────────┘ └─────────────┘ │
│  BAS · GST · Payroll│          │  ┌─────────────────────────────┐ │
│  Categories         │          │  │   Graph Store (Neo4j)       │ │
│  Business Profiles  │          │  │   Knowledge Graph           │ │
└─────────────────────┘          │  │   Entities & Relationships  │ │
                                 │  └─────────────────────────────┘ │
                                 └─────────────────────────────────┘
```

### 1.2 Key Design Principles

1. **Separation of Concerns**: CBA PostgreSQL handles structured transactional data (ACID, SQL-queryable). Cognee handles unstructured knowledge (semantic search, graph reasoning).
2. **Hybrid Agent Architecture**: Fixed TypeScript agents for deterministic financial tasks + flexible Claude Agent SDK agents for open-ended reasoning — both backed by Cognee memory.
3. **Multi-Tenant Isolation**: Each user gets isolated Cognee datasets, knowledge graphs, and vector stores via Dataset Database Handlers and `ENABLE_BACKEND_ACCESS_CONTROL`.
4. **HTTP-First Integration**: The TypeScript server communicates with Cognee exclusively via REST HTTP (`cognee_client.ts`), not Python subprocesses.
5. **Learning Loop**: Agent outputs feed back into Cognee (e.g., merchant categorizations stored as merchant memory), improving future accuracy.

### 1.3 Corrections to Prior Documentation

| Prior Doc Claim | Actual State (Current Code) |
|---|---|
| `AGENT_ARCHITECTURE.md`: 6 agents | **8 agents** — added `merchant_intelligence` and `payroll_agent` |
| `AGENT_ARCHITECTURE.md`: `cognee-tools.ts` uses `runPython()` subprocess | **HTTP REST** via `cogneeClient` singleton (`cognee_client.ts`) |
| `COGNEE_INTEGRATION.md`: Kuzu graph store | **Neo4j** required for multi-tenant (Kuzu is single-tenant only) |
| `COGNEE_INTEGRATION.md`: Python subprocess bridge (`rag.ts`/`rag.py`) | **Direct HTTP** — `cognee_client.ts` calls Cognee REST API |
| `COGNEE_INTEGRATION.md`: fastembed for embeddings | **OpenRouter** `text-embedding-3-small` (1536 dims) via docker-compose |
| `COGNEE_INTEGRATION.md`: `INSIGHTS` search type | **Replaced** — Cognee v0.5.2 uses `GRAPH_COMPLETION`, `RAG_COMPLETION`, etc. |
| `AGENT_ARCHITECTURE.md`: OpenRouter as primary LLM | **Anthropic Claude** (Sonnet/Haiku) for agents; OpenRouter Gemini for Cognee's internal LLM |
| `COGNEE_INTEGRATION.md`: SQLite references | **PostgreSQL** — CBA uses Postgres, Cognee shares the instance |

---

## 2. Database Architecture

### 2.1 Dual-Database Strategy

GoldLedger uses **two logical databases** that can share the same PostgreSQL instance:

| Database | Purpose | Engine | What Lives Here |
|---|---|---|---|
| **CBA PostgreSQL** | Transactional backbone | PostgreSQL 17 | Transactions, accounts, statements, BAS, GST, payroll, categories, business profiles, users |
| **Cognee Stores** | AI memory & knowledge | PostgreSQL (relational + PGVector) + Neo4j (graph) | Document chunks, embeddings, entities, relationships, merchant memory |

### 2.2 Why Keep Both

**CBA PostgreSQL** provides:

- ACID transactions for financial data integrity
- Complex SQL queries (JOINs, aggregations, window functions) for BAS calculations, reconciliation
- Indexed lookups for transaction search, date ranges, account filtering
- Schema enforcement for regulatory compliance (ABN, GST, PAYG)

**Cognee** provides (from `core-concepts-architecture.md`):
> "No single database can handle all aspects of memory."

- **Relational Store**: Document metadata, text chunks, provenance tracking
- **Vector Store** (PGVector): Semantic embeddings for similarity search
- **Graph Store** (Neo4j): Entity-relationship knowledge graph for structural reasoning

### 2.3 Shared PostgreSQL Instance

Both CBA and Cognee's relational + vector stores run on the **same PostgreSQL 17 instance** with PGVector extension:

```yaml
# docker-compose.yml — single postgres service
postgres:
  image: pgvector/pgvector:pg17
  environment:
    POSTGRES_USER: cba_admin
    POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
  volumes:
    - postgres_data:/var/lib/postgresql/data
    - ./server/sql/init.sql:/docker-entrypoint-initdb.d/01-init.sql
    # ... additional migration scripts
```

- **CBA database**: `cba_statements` — all application tables
- **Cognee database**: `cognee_db` — Cognee's relational metadata + PGVector embeddings
- **Neo4j**: Separate container for Cognee's graph store (knowledge graph)

### 2.4 Graph Store: Neo4j (Not Kuzu)

> **⚠️ Critical**: The existing `COGNEE_INTEGRATION.md` references Kuzu. For multi-tenant production, **Neo4j is required**.

From Cognee's `core-concepts-dataset-db-handlers-what-are-they.md`:
> Kuzu is an embedded (in-process) graph database — it stores data in local files. This makes it unsuitable for shared multi-tenant deployments.

Neo4j supports:

- Shared multi-tenant access via labeled subgraphs
- Dataset Database Handlers for per-user graph isolation
- Neo4j Aura (managed cloud) or self-hosted
- Cypher queries for complex graph traversal

```yaml
# docker-compose.yml — Neo4j addition for multi-tenant
neo4j:
  image: neo4j:5-community
  environment:
    NEO4J_AUTH: neo4j/${NEO4J_PASSWORD}
    NEO4J_PLUGINS: '["apoc"]'
  ports:
    - "7474:7474"   # Browser
    - "7687:7687"   # Bolt
  volumes:
    - neo4j_data:/data

# Cognee env vars for Neo4j
cognee:
  environment:
    GRAPH_DATABASE_PROVIDER: neo4j
    GRAPH_DATABASE_URL: bolt://neo4j:7687
    GRAPH_DATABASE_USERNAME: neo4j
    GRAPH_DATABASE_PASSWORD: ${NEO4J_PASSWORD}
```

---

## 3. Cognee Backend Integration

### 3.1 ECL Pipeline (Extract → Cognify → Load)

Cognee transforms raw data into queryable knowledge through three core operations:

```
Raw Data ──► add() ──► cognify() ──► search()
             │           │              │
         Chunk text   Build KG      Query KG
         Store chunks  Extract       Vector similarity
         Create embeds entities      Graph traversal
                      Find rels     Hybrid retrieval
```

| Operation | What It Does | REST Endpoint | Key Parameters |
|---|---|---|---|
| **`add()`** | Ingests raw text/files, chunks them, creates embeddings | `POST /api/v1/add` | `dataset_name`, `node_set[]`, multipart FormData |
| **`cognify()`** | Builds knowledge graph — extracts entities & relationships via LLM | `POST /api/v1/cognify` | `datasets[]`, `run_in_background`, `custom_prompt`, `ontology_file_path` |
| **`search()`** | Queries the knowledge graph with natural language | `POST /api/v1/search` | `query`, `search_type`, `datasets[]`, `top_k` |
| **`memify()`** | Enriches existing graph with derived facts and semantic associations | `POST /api/v1/memify` | `dataset` |

### 3.2 REST API Endpoints

All Cognee HTTP calls go through `server/src/services/cognee_client.ts` — the **single source of truth** for Cognee communication.

#### Authentication

```
POST /api/v1/auth/login
Body: { "username": "...", "password": "..." }
Response: { "access_token": "jwt...", "token_type": "bearer" }
```

The TypeScript client caches JWT tokens for 50 minutes:

```typescript
// cognee_client.ts — token caching
private async authHeaders(): Promise<Record<string, string>> {
  const now = Date.now();
  if (this.authToken && this.tokenExpiry && now < this.tokenExpiry) {
    return { Authorization: `Bearer ${this.authToken}` };
  }
  // Re-login and cache for 50 minutes
  const token = await this.login();
  this.authToken = token;
  this.tokenExpiry = now + 50 * 60 * 1000;
  return { Authorization: `Bearer ${token}` };
}
```

#### Data Ingestion — `add()`

> **⚠️ Critical Protocol**: The `/api/v1/add` endpoint requires **multipart FormData**, NOT JSON.

```typescript
// cognee_client.ts — correct add() implementation
async add(data: string[], datasetName: string): Promise<void> {
  const content = data.join('\n\n');
  const formData = new FormData();
  formData.append(
    'data',
    new Blob([content], { type: 'text/plain' }),
    'dataset.txt'
  );
  formData.append('dataset_name', datasetName);

  await fetch(`${this.baseUrl}/api/v1/add`, {
    method: 'POST',
    headers: { ...auth },  // NO Content-Type — FormData sets boundary
    body: formData,
  });
}
```

#### Knowledge Graph Construction — `cognify()`

> **⚠️ Critical**: The `cognify` endpoint requires a `datasets` array. An empty body returns HTTP 400.

```typescript
// cognee_client.ts — correct cognify() implementation
async cognify(datasets: string[], runInBackground = true): Promise<void> {
  await fetch(`${this.baseUrl}/api/v1/cognify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({
      datasets,
      run_in_background: runInBackground,
      custom_prompt: FINANCIAL_COGNIFY_PROMPT,  // domain-specific entity extraction
    }),
  });
}
```

The `FINANCIAL_COGNIFY_PROMPT` guides entity extraction for financial data:

```typescript
const FINANCIAL_COGNIFY_PROMPT = `Extract financial entities and relationships:
- Merchant names and their canonical forms
- Transaction categories and subcategories
- ABN (Australian Business Numbers) and GST registration status
- Payment methods and patterns
- Account references and relationships
- Recurring transaction patterns
- Financial relationships between entities`;
```

#### Search — `search()`

```typescript
// cognee_client.ts — correct search() implementation
async search(
  query: string,
  dataset: string,
  topK: number = 5,
  searchType: CogneeSearchType = 'GRAPH_COMPLETION'
): Promise<string[]> {
  const res = await fetch(`${this.baseUrl}/api/v1/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({
      query,              // NOT "query_text"
      search_type: searchType,  // NOT "query_type"
      datasets: [dataset],
      top_k: topK,
    }),
  });
  // Parse heterogeneous response shapes
  return results.map(parseSearchResult);
}
```

### 3.3 Search Types

Cognee v0.5.2 supports 14 search types (defined as `CogneeSearchType` in `cognee_client.ts`):

| Search Type | Use Case | How It Works |
|---|---|---|
| `GRAPH_COMPLETION` | **Default** — best for most queries | Graph traversal + LLM completion |
| `RAG_COMPLETION` | Traditional RAG | Vector retrieval + LLM generation |
| `CHUNKS` | Raw text retrieval | Returns matching text chunks |
| `CHUNKS_LEXICAL` | Keyword-based search | BM25/lexical matching on chunks |
| `SUMMARIES` | Document summaries | Returns pre-computed summaries |
| `GRAPH_SUMMARY_COMPLETION` | Graph + summaries | Combines graph context with summaries |
| `GRAPH_COMPLETION_COT` | Chain-of-thought reasoning | Graph traversal with step-by-step reasoning |
| `GRAPH_COMPLETION_CONTEXT_EXTENSION` | Extended context | Graph traversal with expanded context window |
| `TRIPLET_COMPLETION` | Entity-relationship queries | Returns subject-predicate-object triples |
| `NATURAL_LANGUAGE` | Plain language answers | Converts graph data to natural language |
| `TEMPORAL` | Time-aware queries | Filters by temporal relationships |
| `FEEDBACK` | Quality improvement | Uses feedback loop for better results |
| `CODE` | Code-specific search | Optimized for source code |
| `FEELING_LUCKY` | Quick single result | Returns best single match |

### 3.4 NodeSets — Tagging & Grouping

NodeSets are tags that travel through the entire `add → cognify → search` pipeline:

```typescript
// Tag data at ingestion time
await cogneeClient.add(statementData, 'bank_statements');  // dataset = implicit grouping

// In Python (Cognee native):
await cognee.add("transaction data", node_set=["Q1_2026", "CBA_account"])
await cognee.cognify()
results = await cognee.search("spending patterns", node_set=["Q1_2026"])
```

NodeSets enable:

- Filtering search results to specific time periods, accounts, or categories
- Grouping related data across datasets
- Scoped cognify operations on tagged subsets

### 3.5 Ontologies — Financial Entity Validation

Cognee supports RDF/OWL ontologies for entity type validation during `cognify()`:

```python
# Using FIBO (Financial Industry Business Ontology) subset
await cognee.cognify(
    datasets=["bank_transactions"],
    ontology_file_path="fibo_subset.owl"  # validates entity types against FIBO
)
```

For GoldLedger, a custom financial ontology can enforce:

- Merchant entities have ABN, GST status, industry classification
- Transaction entities have amount, date, category, GST treatment
- Account entities have BSB, account number, institution
- Payroll entities have employee, PAYG rate, super guarantee rate

---

## 4. AI Agent System — Fixed Agents

### 4.1 Architecture Overview

The fixed agent system consists of **8 specialized TypeScript agents** built on a common `ClaudeAgent<TInput, TOutput>` base class. Each agent:

- Has a **domain-specific system prompt** with Australian financial expertise
- Defines **typed tools** (Anthropic tool-use format) for its domain
- Implements **tool handlers** that call parsers, Cognee, or business logic
- Returns **structured JSON output** matching its typed output contract
- Runs an **agentic tool-use loop** — Claude decides which tools to call and when to stop

```
┌─────────────────────────────────────────────────────────┐
│                  ClaudeAgent<TInput, TOutput>            │
│                    (base-agent.ts)                       │
│                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ System      │  │ Tool         │  │ Agentic Loop  │  │
│  │ Prompt      │  │ Definitions  │  │ (iterations)  │  │
│  └─────────────┘  └──────────────┘  └───────────────┘  │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ Tool        │  │ Token        │  │ Circuit       │  │
│  │ Handlers    │  │ Tracking     │  │ Breaker       │  │
│  └─────────────┘  └──────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────┘
         ▲           ▲           ▲           ▲
    ┌────┴───┐  ┌────┴───┐  ┌───┴────┐  ┌───┴────┐
    │Statement│  │Transact│  │  GST   │  │Account │  ... (8 total)
    │ Parser  │  │Categor.│  │ Calc   │  │Reconcil│
    └────────┘  └────────┘  └────────┘  └────────┘
```

### 4.2 Base Agent Framework (`base-agent.ts`)

**File**: `server/src/services/claude/base-agent.ts` (216 lines)

The abstract `ClaudeAgent` class implements the core agentic loop:

```typescript
abstract class ClaudeAgent<TInput, TOutput> {
  protected abstract systemPrompt: string;
  protected abstract tools: Anthropic.Tool[];
  protected abstract toolHandlers: Map<string, (input: Record<string, unknown>) => Promise<unknown>>;

  async invoke(input: TInput): Promise<TOutput & { usage: TokenUsage }> {
    // 1. Format input as user message
    // 2. Call client.messages.create() with system prompt + tools
    // 3. Loop: if stop_reason === 'tool_use':
    //    a. Execute each tool call via toolHandlers
    //    b. Feed tool results back as tool_result messages
    //    c. Call client.messages.create() again
    // 4. When stop_reason === 'end_turn': parse JSON from final text
    // 5. Track token usage throughout
    // 6. Return typed output + usage stats
  }
}
```

**Key behaviors**:

- **Max iterations**: Configurable loop limit prevents runaway tool calls
- **Token budget enforcement**: Checks `AGENT_TOKEN_BUDGETS[agentType]` before each API call
- **Per-tool circuit breaker**: Tools that fail 3 times are automatically skipped for the remainder of the invocation
- **JSON parsing**: Handles markdown code fences (`\`\`\`json ... \`\`\``) in Claude's output
- **Singleton client**: Uses `getClient()` from `client.ts` (shared Anthropic SDK instance)

### 4.3 Token Budgets & Model Selection (`config.ts`)

**File**: `server/src/services/claude/config.ts` (97 lines)

Each agent has independent token limits and model assignment:

| Agent | Model | Max Input Tokens | Max Output Tokens | Max Tool Calls |
|---|---|---|---|---|
| `statement_parser` | Sonnet | 100,000 | 8,000 | 10 |
| `transaction_categorizer` | Haiku | 50,000 | 4,000 | 15 |
| `gst_calculator` | Sonnet | 50,000 | 4,000 | 8 |
| `account_reconciler` | Haiku | 80,000 | 4,000 | 10 |
| `budget_analyzer` | Sonnet | 100,000 | 8,000 | 12 |
| `cross_account_tracer` | Haiku | 80,000 | 4,000 | 10 |
| `merchant_intelligence` | Haiku | 30,000 | 2,000 | 8 |
| `payroll_agent` | Sonnet | 80,000 | 6,000 | 10 |

**Model selection rationale**:

- **Sonnet** (claude-sonnet-4-5-20250929): Complex reasoning tasks — statement parsing, GST calculations, budget analysis, payroll
- **Haiku**: Simpler pattern-matching tasks — categorization, reconciliation, cross-account tracing, merchant lookup

### 4.4 Retry & Circuit Breaker (`retry.ts`)

**File**: `server/src/services/claude/retry.ts` (105 lines)

#### Retry with Exponential Backoff

```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  // Retries on: rate_limit_error, overloaded_error, api_error
  // Exponential backoff: delay = initialDelayMs * backoffMultiplier^attempt
  // Jitter: ±25% randomization to prevent thundering herd
}
```

Default config: `maxRetries=3`, `initialDelayMs=1000`, `maxDelayMs=30000`, `backoffMultiplier=2`

#### Agent Circuit Breaker

```typescript
class AgentCircuitBreaker {
  // States: closed (normal) → open (failing) → half-open (testing)
  // failureThreshold: 5 consecutive failures → open
  // recoveryTimeMs: 60,000ms (1 min) → half-open
  // On success in half-open → closed
}
```

### 4.5 Feature Flags (`config.ts`)

```bash
# Master switch — enables/disables all Claude agents
USE_CLAUDE_AGENTS=true

# Per-agent toggles (all default to true when master is on)
AGENT_STATEMENT_PARSER=true
AGENT_TRANSACTION_CATEGORIZER=true
AGENT_GST_CALCULATOR=true
AGENT_ACCOUNT_RECONCILER=true
AGENT_BUDGET_ANALYZER=true
AGENT_CROSS_ACCOUNT_TRACER=true
AGENT_MERCHANT_INTELLIGENCE=true
AGENT_PAYROLL_AGENT=true
```

Checked at runtime via:

```typescript
function isClaudeAgentsEnabled(): boolean  // checks USE_CLAUDE_AGENTS
function isAgentEnabled(agentType: AgentType): boolean  // checks AGENT_<TYPE>
```

### 4.6 Agent Specifications

All agents live in `server/src/services/claude/agents/`. Each extends `ClaudeAgent<TInput, TOutput>`.

#### 4.6.1 StatementParserAgent (`statement-parser.ts`)

**Purpose**: Extracts structured transaction data from bank statement PDFs.

**Tools**:

| Tool | Handler | Description |
|---|---|---|
| `detect_bank` | `parserRegistry.detectBank()` | Identifies bank from text (CBA, ANZ, Westpac, NAB, etc.) |
| `parse_with_bank_parser` | `parserRegistry.getParser(bankId).parse()` | Extracts transactions using bank-specific parser |
| `extract_account_info` | `parser.extractAccountInfo()` | Gets BSB, account number, account type |
| `validate_transactions` | Local validation logic | Cross-checks dates, detects duplicates |
| `search_cognee` | `cogneeTools.search()` | Searches historical parsing patterns |

**I/O Contract**:

```typescript
interface StatementParserInput {
  rawText: string;
  fileName: string;
  mimeType?: string;
}
interface StatementParserOutput {
  transactions: ParsedTransaction[];
  accountInfo: AccountInfo;
  bankId: string;
  confidence: number;
  warnings: string[];
}
```

#### 4.6.2 TransactionCategorizerAgent (`transaction-categorizer.ts`)

**Purpose**: Categorizes transactions using merchant memory, Cognee context, and Claude reasoning. Supports batch processing.

**Tools**:

| Tool | Handler | Description |
|---|---|---|
| `lookup_merchant_memory` | In-memory pattern matching | Checks cached merchant→category mappings |
| `search_similar_transactions` | `cogneeTools.search(desc, 'bank_transactions', 'CHUNKS')` | Finds similar past transactions via Cognee |
| `get_category_taxonomy` | Returns `CATEGORY_TAXONOMY` array | 50+ categories (Revenue, COGS, Expenses, System) |
| `batch_categorize` | Rule-based pre-categorization | Pattern matching for POS, loans, ATM, merchants |

**Learning Loop**: After categorization, high-confidence results (≥0.8) are stored back to Cognee via `cogneeClient.storeMerchantMapping()`, creating a feedback loop that improves future accuracy.

**Business-Specific Rules** (hardcoded for Amica Beauty):

- POS deposits → Sales Revenue
- ATM/Cash withdrawals → Cost of Goods Sold (stock purchases)
- Afterpay → Cost of Goods Sold (shop supplies)
- Known employees: Bree Perry, Christina Josevski, J Driscoll, A Fleuren, etc.
- Bizloan/BizLend/Bizcap deposits → Loan Repayment (NOT business income)

#### 4.6.3 GSTCalculatorAgent (`gst-calculator.ts`)

**Purpose**: Calculates GST obligations for BAS reporting using ATO rules.

**I/O Contract**:

```typescript
interface GSTCalculatorInput {
  transactions: TransactionForGST[];
  period: { startDate: string; endDate: string };
  businessProfile: BusinessProfile;
}
interface GSTCalculatorOutput {
  gstCollected: number;      // 1A on BAS
  gstPaid: number;           // 1B on BAS
  netGST: number;            // 1A - 1B
  adjustments: GSTAdjustment[];
  warnings: string[];
}
```

#### 4.6.4 AccountReconcilerAgent (`account-reconciler.ts`)

**Purpose**: Reconciles bank statements against internal records, identifies discrepancies.

#### 4.6.5 BudgetAnalyzerAgent (`budget-analyzer.ts`)

**Purpose**: Analyzes spending patterns, generates budget recommendations, identifies anomalies.

#### 4.6.6 CrossAccountTracerAgent (`cross-account-tracer.ts`)

**Purpose**: Traces money flows across multiple bank accounts, identifies inter-account transfers.

#### 4.6.7 MerchantIntelligenceAgent (`merchant-intelligence.ts`)

**Purpose**: Resolves abbreviated bank descriptions to canonical merchant names, enriches with ABN/GST/industry data.

**Tools**:

| Tool | Handler | Description |
|---|---|---|
| `search_cognee_merchant` | `cogneeTools.search(name, 'merchant_mappings', 'CHUNKS_LEXICAL')` | Lexical search for merchant patterns |
| `lookup_abn` | ABN lookup logic | Resolves Australian Business Numbers |
| `store_merchant_mapping` | `cogneeClient.storeMerchantMapping()` | Persists new merchant→canonical mappings |
| `batch_resolve` | Pattern matching | Batch resolves multiple merchants at once |

#### 4.6.8 PayrollAgent (`payroll-agent.ts`)

**Purpose**: Detects wage payments from bank transactions, calculates PAYG withholding using ATO tax tables, manages wage payment ledger.

**Built-in Pattern Detection**:

```typescript
const WAGE_PATTERNS = [
  /\bSALARY\b/i, /\bWAGES?\b/i, /\bPAYROLL\b/i,
  /\bADP\b/i, /\bMYOB\s*PAYROLL\b/i, /\bXERO\s*PAYROLL\b/i,
  /\bKEYPAY\b/i, /\bEMPLOYMENT\s*HERO\b/i,
  /\bSUPER(?:ANNUATION)?\s*(?:GUARANTEE|CONTRIB)/i,
];
const KNOWN_EMPLOYEES = {
  'bree perry': { fullName: 'Bree Perry', tfnDeclared: true },
  'christina': { fullName: 'Christina', tfnDeclared: true },
  'josevski': { fullName: 'Josevski', tfnDeclared: true },
};
```

**I/O Contract**:

```typescript
interface PayrollAgentInput {
  transactions: TransactionForPayroll[];
  existingEmployees?: EmployeeRecord[];
  period: { startDate: string; endDate: string };
}
interface PayrollAgentOutput {
  wagePayments: WagePaymentDetection[];
  totalGrossWages: number;
  totalPAYG: number;
  totalSuper: number;
  employees: EmployeeSummary[];
  warnings: string[];
}
```

---

## 5. AI Agent System — Flexible Agents & Claude Agent SDK

### 5.1 Hybrid Architecture Concept

The hybrid architecture combines two agent paradigms:

| Paradigm | Implementation | Best For | Memory Access |
|---|---|---|---|
| **Fixed Agents** | TypeScript `ClaudeAgent<T,U>` subclasses | Deterministic financial tasks with known I/O contracts | SQL (CBA DB) + Cognee search |
| **Flexible Agents** | Claude Agent SDK (Python) with MCP tools | Open-ended reasoning, multi-step planning, conversational AI | Full Cognee ECL pipeline + sessions |

```
User Request (Agent Chat)
        │
        ▼
┌───────────────────┐
│   Orchestrator     │
│   (TypeScript)     │
│                    │
│  Analyzes intent   │
│  Routes to agent   │
└───┬───────────┬───┘
    │           │
    ▼           ▼
┌────────┐  ┌──────────────────────┐
│ Fixed  │  │ Flexible Agent       │
│ Agent  │  │ (Claude Agent SDK)   │
│ (TS)   │  │ + Cognee MCP Tools   │
│        │  │ + Session Memory     │
└────────┘  └──────────────────────┘
```

**Routing Logic**:

- Structured tasks (parse statement, categorize, calculate GST) → Fixed agents
- Open-ended queries ("analyze my spending trends", "what should I budget for Q2?") → Flexible agents
- Tasks requiring multi-agent coordination → Orchestrator chains fixed + flexible

### 5.2 Claude Agent SDK Integration (Python)

From the official `integrations-claude-agent-sdk.md` documentation:

#### Installation

```bash
pip install cognee-integration-claude
```

#### Basic Usage — Memory-Enabled Agent

```python
from claude_agent_sdk import (
    create_sdk_mcp_server,
    ClaudeAgentOptions,
    ClaudeSDKClient,
)
from cognee_integration_claude import add_tool, search_tool

async def main():
    # Create MCP server with Cognee memory tools
    server = create_sdk_mcp_server(
        name="memory-tools",
        version="1.0.0",
        tools=[add_tool, search_tool]
    )

    options = ClaudeAgentOptions(
        mcp_servers={"tools": server},
        allowed_tools=["mcp__tools__add_tool", "mcp__tools__search_tool"],
    )

    # Agent can now store and retrieve knowledge
    async with ClaudeSDKClient(options=options) as client:
        await client.query("Remember: Acme Corp, healthcare, $1.2M contract")
        # Later...
        await client.query("What do you know about Acme Corp?")
```

#### Sessionized Tools — Per-User Memory Isolation

```python
from cognee_integration_claude import get_sessionized_cognee_tools

# Each user gets isolated memory via session_id
tools = get_sessionized_cognee_tools(session_id="user_123_chat_456")

server = create_sdk_mcp_server(
    name="user-memory",
    version="1.0.0",
    tools=tools  # add_tool and search_tool scoped to this session
)
```

**Key properties of sessionized tools**:

- Memory persists across agent instances via session IDs
- Each session maintains its own conversational context
- Cross-session knowledge sharing via shared Cognee datasets
- Session cleanup via Cognee's prune operations

### 5.3 Cognee MCP Server

**File**: `cognee-repo/cognee-mcp/src/server.py` (926 lines)

The MCP server provides 7 tools accessible via stdio, SSE, or HTTP transport:

| MCP Tool | Description | Cognee Operation |
|---|---|---|
| `cognify` | Transform raw data into knowledge graph | `add()` + `cognify()` |
| `search` | Query knowledge graph | `search()` |
| `save_interaction` | Store user-assistant exchanges | `add()` with interaction format |
| `list_data` | List available datasets | `list_datasets()` |
| `delete` | Remove specific data | `delete()` |
| `prune` | Clear all memory | `prune_data()` + `prune_system()` |
| `cognify_status` | Check pipeline status | `get_pipeline_status()` |

**Background Task Pattern**: Long-running operations use `asyncio.create_task()`:

```python
# server.py — non-blocking cognify
async def cognify_tool(data: str, dataset_name: str):
    await client.add(data, dataset_name)
    asyncio.create_task(client.cognify([dataset_name]))  # returns immediately
    return "Data added. Knowledge graph building in background."
```

**Dual Mode Operation**:

- **Direct mode**: Imports and calls `cognee` Python package directly (default)
- **API mode**: Connects to running Cognee FastAPI server via `--api-url` flag

```bash
# Direct mode (default)
python -m cognee_mcp

# API mode (connects to Cognee container)
python -m cognee_mcp --api-url http://localhost:8000
```

### 5.4 Sessions & Conversational Memory

From `guides-sessions.md`:

Sessions provide conversational context within a single chat thread. They are **orthogonal to multi-tenancy**:

- **Multi-tenancy** = data isolation between users (EBAC + permissions)
- **Sessions** = conversational context within a single user's chat

```python
# Session-aware search — maintains conversation context
results = await cognee.search(
    "What did we discuss about Q1 spending?",
    session_id="chat_abc123",
    datasets=["user_42_transactions"]
)

# Save interaction for future context
await cognee.add(
    f"User asked: {user_message}\nAssistant replied: {assistant_response}",
    dataset_name="user_42_conversations"
)
```

**Cache Adapter Configuration** (required for sessions):

- **Redis** (recommended for production): Shared state across server instances
- **Filesystem** (development): Local file-based caching

### 5.5 Feedback System

From `guides-feedback-system.md`:

The feedback system improves search quality over time:

```python
# Search with feedback enabled
results = await cognee.search(
    "categorize this transaction",
    query_type=SearchType.FEEDBACK,
    save_interaction=True  # stores query + results for learning
)
```

This creates a feedback loop: user corrections → stored as interactions → improve future search relevance.

---

## 6. Cognee Client & Tools Layer

### 6.1 TypeScript Cognee Client (`cognee_client.ts`)

**File**: `server/src/services/cognee_client.ts` (636 lines)

This is the **single source of truth** for all Cognee HTTP communication from the TypeScript server. It is a singleton exported as `cogneeClient`.

#### Configuration

```typescript
const COGNEE_API_URL = process.env.COGNEE_API_URL || 'http://localhost:9010';
const COGNEE_USERNAME = process.env.COGNEE_USERNAME || 'admin@cognee-cba.dev';
const COGNEE_PASSWORD = process.env.COGNEE_PASSWORD || 'CbaAdmin2026';
const REQUEST_TIMEOUT_MS = 30_000;
```

#### Core Methods

| Method | Endpoint | Description |
|---|---|---|
| `login()` | `POST /api/v1/auth/login` | Authenticates, returns JWT token |
| `add(data, dataset)` | `POST /api/v1/add` | Ingests data via multipart FormData |
| `cognify(datasets, bg)` | `POST /api/v1/cognify` | Builds knowledge graph |
| `search(query, dataset, topK, type)` | `POST /api/v1/search` | Queries knowledge graph |
| `searchRich(query, dataset, topK, type)` | `POST /api/v1/search` | Returns `CogneeSearchResult[]` with metadata |
| `addAndCognify(data, dataset)` | `add()` + `cognify()` | Convenience: ingest + build in one call |
| `isHealthy()` | `GET /api/v1/health` | Health check |

#### Domain-Specific Methods

| Method | Description |
|---|---|
| `addStatementData(text, bankId, accountId)` | Ingests bank statement text into `bank_statements` dataset |
| `addTransaction(tx)` | Ingests single transaction into `bank_transactions` dataset |
| `searchSimilarTransactions(desc, amount)` | Finds similar past transactions via `CHUNKS` search |
| `getCategoryPatterns(category)` | Gets patterns for a specific category |
| `traceAccountFlows(accountId)` | Traces money flows for an account |
| `getGSTRuling(description)` | Gets GST ruling for a transaction type |
| `addCorrection(original, corrected)` | Stores user corrections for learning |

#### Merchant Memory System

The merchant memory system enables the learning loop between agents and Cognee:

```typescript
// Store a new merchant mapping
await cogneeClient.storeMerchantMapping(
  'WOOLWORTHS 1234',           // abbreviated (bank description)
  'Woolworths Group Limited',   // canonical name
  '88000014675',               // ABN (optional)
  true,                        // GST registered
  'Retail - Groceries',        // industry (optional)
  'Groceries'                  // default category
);

// Look up a single merchant
const result = await cogneeClient.lookupMerchant('WOOLWORTHS 1234');
// Returns: { found: true, canonical: 'Woolworths Group Limited', category: 'Groceries', ... }

// Batch lookup for efficiency
const results = await cogneeClient.batchLookupMerchants([
  'WOOLWORTHS 1234', 'SHELL COLES EXP', 'BUNNINGS 0042'
]);

// Update from user correction
await cogneeClient.updateMerchantFromCorrection(
  'AFTERPAY PURCHASE',
  'Cost of Goods Sold',  // corrected category
  true                   // GST applicable
);
```

#### Dataset Management

```typescript
// List all datasets
const datasets = await cogneeClient.listDatasets();

// Create a new dataset
await cogneeClient.createDataset('user_42_transactions');

// Check dataset status (cognify progress)
const status = await cogneeClient.getDatasetStatus('bank_statements');

// Get dataset graph (knowledge graph visualization data)
const graph = await cogneeClient.getDatasetGraph('merchant_mappings');
```

#### Response Parsing

Cognee returns heterogeneous response shapes. The client handles all variants:

```typescript
function parseSearchResult(item: unknown): string {
  // Handles: string | { text } | { content } | { chunk_text } | { summary } | { answer }
  if (typeof item === 'string') return item;
  if (item?.text) return item.text;
  if (item?.content) return item.content;
  if (item?.chunk_text) return item.chunk_text;
  if (item?.summary) return item.summary;
  if (item?.answer) return item.answer;
  return JSON.stringify(item);
}
```

### 6.2 CogneeTools Wrapper (`cognee-tools.ts`)

**File**: `server/src/services/claude/cognee-tools.ts` (81 lines)

A thin wrapper around `cogneeClient` that adds dataset-prefix support and batch chunking for agent use:

```typescript
class CogneeTools {
  private config: CogneeToolConfig;  // searchTopK=5, indexBatchSize=50, datasetPrefix=''

  async search(query: string, dataset: string, searchType?: CogneeSearchType): Promise<string[]> {
    return cogneeClient.search(query, this.prefixDataset(dataset), this.config.searchTopK, searchType);
  }

  async index(data: string[], dataset: string): Promise<void> {
    // Batch chunking: splits large arrays into indexBatchSize chunks
    for (let i = 0; i < data.length; i += this.config.indexBatchSize) {
      const batch = data.slice(i, i + this.config.indexBatchSize);
      await cogneeClient.add(batch, this.prefixDataset(dataset));
    }
  }

  async cognify(dataset: string): Promise<void> {
    await cogneeClient.cognify([this.prefixDataset(dataset)], true);
  }

  async indexAndCognify(data: string[], dataset: string): Promise<void> {
    await this.index(data, dataset);
    await this.cognify(dataset);
  }

  private prefixDataset(dataset: string): string {
    return this.config.datasetPrefix
      ? `${this.config.datasetPrefix}_${dataset}`
      : dataset;
  }
}

export const cogneeTools = new CogneeTools();  // singleton, default config
```

**Dataset Prefix** enables per-user namespace isolation:

```typescript
// For user 42:
const userTools = new CogneeTools({ datasetPrefix: 'user_42' });
await userTools.search('spending', 'transactions');
// Actually searches: 'user_42_transactions'
```

---

## 7. Data Models & Knowledge Graph Schema

### 7.1 Cognee DataPoints

From `core-concepts-datapoints.md`:

> DataPoint is the base class for all nodes in Cognee's knowledge graph. Every entity, chunk, and relationship extends DataPoint.

```python
from cognee.infrastructure.engine import DataPoint

class DataPoint:
    id: UUID                    # Unique identifier
    updated_at: datetime        # Last modification timestamp
    topological_rank: int       # Position in graph hierarchy
    metadata: dict              # Arbitrary key-value metadata
    _metadata: dict             # Internal Cognee metadata
```

### 7.2 Custom Financial Data Models

From `guides-custom-data-models.md`, custom models extend `DataPoint` for domain-specific entities:

```python
from cognee.infrastructure.engine import DataPoint
from pydantic import BaseModel
from typing import Optional
from datetime import date

class Merchant(DataPoint):
    """A merchant entity in the knowledge graph."""
    abbreviated_name: str       # Bank description (e.g., "WOOLWORTHS 1234")
    canonical_name: str         # Full name (e.g., "Woolworths Group Limited")
    abn: Optional[str]          # Australian Business Number
    gst_registered: bool        # GST registration status
    industry: Optional[str]     # Industry classification
    default_category: str       # Default transaction category

class Transaction(DataPoint):
    """A financial transaction entity."""
    date: date
    description: str
    amount: float               # In cents (positive = credit, negative = debit)
    category: Optional[str]
    gst_category: Optional[str] # taxable_10, gst_free, input_taxed, capital, private
    merchant: Optional[str]     # Link to Merchant entity
    account_id: str

class BankAccount(DataPoint):
    """A bank account entity."""
    bsb: str
    account_number: str
    account_name: str
    institution: str            # CBA, ANZ, Westpac, etc.
    account_type: str           # savings, transaction, business

class Employee(DataPoint):
    """An employee entity for payroll tracking."""
    full_name: str
    tfn_declared: bool
    employment_type: str        # full_time, part_time, casual
    pay_frequency: str          # weekly, fortnightly, monthly

class GSTRuling(DataPoint):
    """A GST ruling for a transaction type."""
    transaction_type: str
    gst_treatment: str          # taxable_10, gst_free, input_taxed
    ato_reference: Optional[str]
    notes: str
```

### 7.3 Knowledge Graph Schema

The knowledge graph captures relationships between financial entities:

```
┌──────────┐    categorized_as    ┌──────────┐
│Transaction├─────────────────────►│ Category │
└─────┬────┘                      └──────────┘
      │
      │ paid_to                   ┌──────────┐
      ├──────────────────────────►│ Merchant │
      │                           └─────┬────┘
      │                                 │ has_abn
      │ from_account                    ▼
      │                           ┌──────────┐
      ├──────────────────────────►│   ABN    │
      │                           └──────────┘
      │ gst_treatment
      │                           ┌──────────┐
      └──────────────────────────►│GSTRuling │
                                  └──────────┘

┌──────────┐    employs           ┌──────────┐
│ Business ├─────────────────────►│ Employee │
└─────┬────┘                      └─────┬────┘
      │                                 │
      │ has_account                     │ receives_wage
      ▼                                 ▼
┌──────────┐                      ┌──────────┐
│  Account │◄─────────────────────┤WagePaymt │
└──────────┘    paid_from         └──────────┘
```

### 7.4 Dataset Organization

Each dataset in Cognee serves a specific purpose:

| Dataset Name | Contents | Used By | Search Types |
|---|---|---|---|
| `bank_statements` | Raw statement text, parsed chunks | StatementParser | `CHUNKS`, `GRAPH_COMPLETION` |
| `bank_transactions` | Individual transaction records | TransactionCategorizer, CrossAccountTracer | `CHUNKS`, `CHUNKS_LEXICAL` |
| `merchant_mappings` | Merchant→canonical name mappings | MerchantIntelligence, TransactionCategorizer | `CHUNKS_LEXICAL` |
| `gst_rulings` | GST treatment rules and ATO references | GSTCalculator | `GRAPH_COMPLETION` |
| `payroll_patterns` | Wage payment patterns, employee data | PayrollAgent | `GRAPH_COMPLETION` |
| `budget_history` | Historical spending patterns | BudgetAnalyzer | `GRAPH_COMPLETION`, `TEMPORAL` |
| `account_flows` | Inter-account transfer patterns | CrossAccountTracer | `GRAPH_COMPLETION` |
| `user_corrections` | User feedback and corrections | All agents (learning loop) | `FEEDBACK` |

### 7.5 Temporal Knowledge

From `guides-time-awareness.md`:

Temporal cognify adds time-aware relationships to the knowledge graph:

```python
# Build time-aware knowledge graph
await cognee.cognify(
    datasets=["bank_transactions"],
    temporal_cognify=True  # adds temporal edges between entities
)

# Query with temporal awareness
results = await cognee.search(
    "spending trends over the last 3 months",
    query_type=SearchType.TEMPORAL,
    datasets=["bank_transactions"]
)
```

This enables queries like:

- "How has spending at Woolworths changed over time?"
- "When did the business start paying Bree Perry?"
- "What's the trend in GST obligations quarter over quarter?"

---

## 8. Multi-Tenant Architecture

### 8.1 Overview

Multi-tenancy ensures each user's financial data is completely isolated in Cognee's knowledge graph, vector store, and relational metadata.

```
┌─────────────────────────────────────────────────────┐
│                    Cognee Backend                     │
│                                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │  User A      │  │  User B      │  │  User C      │ │
│  │  Datasets    │  │  Datasets    │  │  Datasets    │ │
│  │  ┌─────────┐ │  │  ┌─────────┐ │  │  ┌─────────┐ │ │
│  │  │ txns    │ │  │  │ txns    │ │  │  │ txns    │ │ │
│  │  │ merch   │ │  │  │ merch   │ │  │  │ merch   │ │ │
│  │  │ stmts   │ │  │  │ stmts   │ │  │  │ stmts   │ │ │
│  │  └─────────┘ │  │  └─────────┘ │  │  └─────────┘ │ │
│  └─────────────┘  └─────────────┘  └─────────────┘ │
│                                                      │
│  Dataset Database Handlers route to correct stores   │
└─────────────────────────────────────────────────────┘
```

### 8.2 Enabling Multi-Tenant Mode

From `core-concepts-multi-user-overview.md`:

```yaml
# docker-compose.yml — Cognee service environment
cognee:
  environment:
    # Master switch for multi-tenancy (default since v0.5.0)
    ENABLE_BACKEND_ACCESS_CONTROL: "true"
    # Enforce authentication on all HTTP endpoints
    REQUIRE_AUTHENTICATION: "true"
```

When `ENABLE_BACKEND_ACCESS_CONTROL=true`:

- Authentication becomes mandatory (even if `REQUIRE_AUTHENTICATION=false`)
- Data isolation is enforced at the user + dataset level
- Automatic database routing per request via Dataset Database Handlers
- All `search`, `add`, `cognify` operations are scoped to the authenticated user's datasets

### 8.3 Dataset Database Handlers

From `core-concepts-dataset-db-handlers-what-are-they.md`:

Dataset Database Handlers automatically route database operations to the correct store based on the authenticated user and dataset:

```
Request (User A, dataset "transactions")
    │
    ▼
┌──────────────────────────┐
│ Dataset Database Handler  │
│                           │
│ 1. Identify user (JWT)    │
│ 2. Identify dataset       │
│ 3. Route to correct:      │
│    - Graph partition       │
│    - Vector namespace      │
│    - Relational schema     │
└──────────────────────────┘
```

**For Neo4j** (graph store): Uses labeled subgraphs per user+dataset
**For PGVector** (vector store): Uses schema/namespace isolation per user+dataset
**For PostgreSQL** (relational): Uses schema isolation per user+dataset

### 8.4 Permission System

From `core-concepts-permissions-overview.md`:

The permission hierarchy: **Users → Datasets → Data**

```
Tenant (Organization)
  └── User
       └── Dataset (with ACL)
            └── Data (documents, chunks, entities)
```

**ACL Permissions** (from `core-concepts-permissions-acl.md`):

- `read` — Query data in the dataset
- `write` — Add data to the dataset
- `delete` — Remove data from the dataset
- `share` — Grant access to other users

### 8.5 User Registration Flow

When a new user signs up for GoldLedger, the system must provision Cognee resources:

```
1. User signs up via GoldLedger frontend
   │
   ▼
2. GoldLedger server creates user in CBA PostgreSQL
   │
   ▼
3. GoldLedger server calls Cognee REST API:
   a. POST /api/v1/auth/register — Create Cognee user
   b. Create default datasets:
      - {user_prefix}_bank_statements
      - {user_prefix}_bank_transactions
      - {user_prefix}_merchant_mappings
      - {user_prefix}_gst_rulings
      - {user_prefix}_payroll_patterns
      - {user_prefix}_budget_history
      - {user_prefix}_account_flows
      - {user_prefix}_user_corrections
   │
   ▼
4. Configure CogneeTools with user's dataset prefix:
   const userTools = new CogneeTools({ datasetPrefix: `user_${userId}` });
   │
   ▼
5. User can now use Agent Chat with isolated knowledge graph
```

### 8.6 Per-User Agent Configuration

Each user's agent invocations should use prefixed datasets:

```typescript
// In the orchestrator, when routing to an agent:
async function invokeAgentForUser(userId: string, agentType: AgentType, input: unknown) {
  // Create user-scoped CogneeTools
  const userCogneeTools = new CogneeTools({
    datasetPrefix: `user_${userId}`,
    searchTopK: 5,
    indexBatchSize: 50,
  });

  // Agent uses user-scoped tools — all dataset operations are isolated
  const agent = createAgent(agentType, userCogneeTools);
  return agent.invoke(input);
}
```

### 8.7 Service Account vs Per-User Auth

Two approaches for Cognee authentication:

| Approach | How It Works | Pros | Cons |
|---|---|---|---|
| **Service Account** | Single admin account + dataset prefixing | Simple, one token | Relies on prefix convention for isolation |
| **Per-User Auth** | Each user gets Cognee credentials, tokens per request | True RBAC isolation | More complex token management |

**Current implementation**: Service account (`admin@cognee-cba.dev`) with dataset prefixing via `CogneeTools.datasetPrefix`.

**Recommended for production**: Per-user auth with Cognee's built-in EBAC (Entity-Based Access Control) for true isolation.

---

## 9. Configuration & Environment

### 9.1 Docker Compose Services

**File**: `docker-compose.yml` (211 lines)

The application runs 4 services (5 with Neo4j for multi-tenant):

| Service | Image | Port | Purpose |
|---|---|---|---|
| `postgres` | `pgvector/pgvector:pg17` | 5432 | CBA transactional DB + Cognee relational/vector stores |
| `cognee` | Built from `cognee-repo/` | 8000 (internal) | Cognee FastAPI backend |
| `server` | Built from `server/` | 3001 | Hono TypeScript API server |
| `client` | Built from `client/` | 80 (nginx) | React frontend |
| `neo4j` | `neo4j:5-community` | 7474, 7687 | Knowledge graph store (add for multi-tenant) |

### 9.2 Environment Variables — Complete Reference

#### Cognee Backend

```bash
# LLM Configuration
LLM_PROVIDER=custom
LLM_API_KEY=${OPENROUTER_API_KEY}
LLM_ENDPOINT=https://openrouter.ai/api/v1
LLM_MODEL=google/gemini-2.5-flash-preview    # Cognee's internal LLM for entity extraction
LLM_TEMPERATURE=0

# Embedding Configuration
EMBEDDING_PROVIDER=custom
EMBEDDING_API_KEY=${OPENROUTER_API_KEY}
EMBEDDING_ENDPOINT=https://openrouter.ai/api/v1
EMBEDDING_MODEL=openai/text-embedding-3-small
EMBEDDING_DIMENSIONS=1536

# Database Configuration
DB_PROVIDER=postgres
DB_HOST=postgres
DB_PORT=5432
DB_NAME=cognee_db
DB_USERNAME=cba_admin
DB_PASSWORD=${POSTGRES_PASSWORD}

# Vector Store
VECTOR_DB_PROVIDER=pgvector
VECTOR_DB_URL=postgresql://cba_admin:${POSTGRES_PASSWORD}@postgres:5432/cognee_db

# Graph Store (current: kuzu — change to neo4j for multi-tenant)
GRAPH_DATABASE_PROVIDER=kuzu                    # → change to: neo4j
# GRAPH_DATABASE_URL=bolt://neo4j:7687          # uncomment for neo4j
# GRAPH_DATABASE_USERNAME=neo4j                  # uncomment for neo4j
# GRAPH_DATABASE_PASSWORD=${NEO4J_PASSWORD}       # uncomment for neo4j

# Multi-Tenant (currently disabled — enable for production)
ENABLE_BACKEND_ACCESS_CONTROL=false             # → change to: true
REQUIRE_AUTHENTICATION=false                    # → change to: true

# Structured Output
STRUCTURED_OUTPUT_BACKEND=outlines
```

#### Hono Server

```bash
# Database
DATABASE_URL=postgresql://cba_admin:${POSTGRES_PASSWORD}@postgres:5432/cba_statements
JWT_SECRET=${JWT_SECRET}

# Claude Agents
USE_CLAUDE_AGENTS=true
CLAUDE_MODEL=claude-sonnet-4-5-20250929
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}

# Cognee Integration
USE_COGNEE=true
COGNEE_API_URL=http://cognee:8000               # internal Docker network
COGNEE_USERNAME=admin@cognee-cba.dev
COGNEE_PASSWORD=CbaAdmin2026

# Per-Agent Feature Flags (all default true)
AGENT_STATEMENT_PARSER=true
AGENT_TRANSACTION_CATEGORIZER=true
AGENT_GST_CALCULATOR=true
AGENT_ACCOUNT_RECONCILER=true
AGENT_BUDGET_ANALYZER=true
AGENT_CROSS_ACCOUNT_TRACER=true
AGENT_MERCHANT_INTELLIGENCE=true
AGENT_PAYROLL_AGENT=true
```

### 9.3 Required Changes for Multi-Tenant Production

| Current Setting | Production Setting | Why |
|---|---|---|
| `GRAPH_DATABASE_PROVIDER=kuzu` | `GRAPH_DATABASE_PROVIDER=neo4j` | Kuzu is embedded/single-tenant; Neo4j supports shared multi-tenant |
| `ENABLE_BACKEND_ACCESS_CONTROL=false` | `ENABLE_BACKEND_ACCESS_CONTROL=true` | Enables per-user data isolation |
| `REQUIRE_AUTHENTICATION=false` | `REQUIRE_AUTHENTICATION=true` | Enforces auth on all Cognee endpoints |
| Single `cogneeClient` instance | Per-user auth tokens or dataset prefixing | Ensures data isolation |
| No Neo4j service | Add `neo4j` service to docker-compose | Required for graph store |
| Default Cognee admin credentials | Unique admin + per-user credentials | Security |

### 9.4 SQL Migrations

The PostgreSQL container runs initialization scripts on first boot:

```yaml
volumes:
  - ./server/sql/init.sql:/docker-entrypoint-initdb.d/01-init.sql
  - ./server/sql/add-transfers.sql:/docker-entrypoint-initdb.d/02-add-transfers.sql
  - ./server/sql/add-business-profiles.sql:/docker-entrypoint-initdb.d/03-add-business-profiles.sql
  # ... additional migration scripts
```

These create the CBA application tables (transactions, accounts, statements, etc.) in the `cba_statements` database. Cognee's tables are created automatically in the `cognee_db` database.

---

## 10. Deployment & Production Considerations

### 10.1 Production Architecture

```text
                        ┌─────────────────┐
                        │   Load Balancer  │
                        │  (nginx / ALB)   │
                        └────────┬────────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │             │
              ┌─────▼─────┐ ┌───▼───┐  ┌─────▼─────┐
              │  Client    │ │Server │  │  Server   │
              │  (CDN/S3)  │ │ (1)   │  │  (N)      │
              └────────────┘ └───┬───┘  └─────┬─────┘
                                 │            │
                    ┌────────────┼────────────┘
                    │            │
         ┌──────────▼──┐  ┌─────▼──────┐  ┌──────────┐
         │  PostgreSQL  │  │   Cognee   │  │  Neo4j   │
         │  + PGVector  │  │  Backend   │  │  Cluster │
         │  (Primary +  │  │  (N pods)  │  │          │
         │   Replica)   │  └────────────┘  └──────────┘
         └──────────────┘
```

**Key production changes from development:**

| Component | Development | Production |
| --- | --- | --- |
| Client | Vite dev server | Static build → CDN (S3 + CloudFront) or nginx |
| Server | Single instance | 2+ instances behind load balancer |
| PostgreSQL | Single container | Managed service (RDS/Cloud SQL) with read replicas |
| Cognee | Single container | 2+ pods with shared storage config |
| Neo4j | Single container | Neo4j Aura (managed) or self-hosted cluster |
| Redis | Not present | Add for session cache, rate limiting, job queues |

### 10.2 Security

#### Credential Management

**Never store secrets in docker-compose.yml or code.** Use:

- **Docker Secrets** (Swarm mode) or **Kubernetes Secrets** for container orchestration
- **AWS Secrets Manager / GCP Secret Manager / Azure Key Vault** for cloud deployments
- **`.env` files** only for local development (never committed to git)

Secrets to manage:

```text
POSTGRES_PASSWORD          # Database master password
JWT_SECRET                 # Hono server JWT signing key
ANTHROPIC_API_KEY          # Claude API key
OPENROUTER_API_KEY         # LLM/embedding provider key
COGNEE_PASSWORD            # Cognee admin password
NEO4J_PASSWORD             # Neo4j auth (when added)
```

#### Network Isolation

```text
┌─────────────────────────────────────────────┐
│              Public Subnet                   │
│  ┌──────────┐  ┌──────────┐                 │
│  │  Client   │  │   ALB    │                 │
│  └──────────┘  └────┬─────┘                 │
└──────────────────────┼──────────────────────┘
                       │
┌──────────────────────┼──────────────────────┐
│              Private Subnet                  │
│  ┌──────────┐  ┌─────▼─────┐  ┌──────────┐ │
│  │  Cognee   │  │  Server   │  │  Neo4j   │ │
│  └──────────┘  └───────────┘  └──────────┘ │
│  ┌──────────┐  ┌───────────┐               │
│  │PostgreSQL │  │   Redis   │               │
│  └──────────┘  └───────────┘               │
└─────────────────────────────────────────────┘
```

- **PostgreSQL, Neo4j, Redis, Cognee**: Private subnet only — no public internet access
- **Server (Hono)**: Private subnet, accessible only via load balancer
- **Client**: Static assets served from CDN; no server-side rendering
- **All inter-service communication**: Over private network (Docker network or VPC)

#### API Security Checklist

- [ ] Rate limiting on all public endpoints (especially `/api/auth/login`, `/api/agents/*`)
- [ ] CORS configured to allow only the production frontend domain
- [ ] HTTPS enforced (TLS termination at load balancer)
- [ ] JWT tokens with short expiry (15 min access + refresh token rotation)
- [ ] Input validation on all endpoints (Zod schemas already in place)
- [ ] SQL injection prevention (parameterized queries via Drizzle ORM)
- [ ] Cognee admin credentials rotated and unique per environment

### 10.3 Scaling

#### Horizontal Scaling — Hono Server

The Hono server is stateless (JWT auth, no server-side sessions), so it scales horizontally:

```text
Load Balancer (round-robin)
    ├── Server Instance 1  ──► PostgreSQL (shared)
    ├── Server Instance 2  ──► Cognee Backend (shared)
    └── Server Instance N  ──► Neo4j (shared)
```

**Considerations:**

- SSE connections (`/api/events`) require sticky sessions or a pub/sub layer (Redis)
- Agent invocations are CPU-light but I/O-heavy (waiting on Claude API + Cognee API)
- Each server instance maintains its own `cogneeClient` singleton with JWT token caching

#### Horizontal Scaling — Cognee Backend

Cognee's FastAPI backend can run multiple replicas if:

- All replicas share the same PostgreSQL, PGVector, and Neo4j connections
- File storage (if used for `add()` uploads) is on shared volume (EFS/NFS) or object storage
- Background `cognify()` tasks use a shared task queue (Redis/Celery) to avoid duplicate processing

#### Database Scaling

| Database | Scaling Strategy |
| --- | --- |
| PostgreSQL (CBA) | Read replicas for analytics queries; primary for writes |
| PostgreSQL (Cognee) | Same instance as CBA; scales with it |
| PGVector | Scales with PostgreSQL; consider HNSW index tuning for large vector collections |
| Neo4j | Neo4j Aura auto-scales; self-hosted uses causal clustering (3+ cores) |

#### Token Budget & Cost Control

Claude API costs scale with usage. The agent framework already has per-agent token budgets:

```typescript
// From config.ts — current token budgets
AGENT_TOKEN_BUDGETS = {
  statement_parser:        { maxInputTokens: 100000, maxOutputTokens: 8000 },
  transaction_categorizer: { maxInputTokens: 50000,  maxOutputTokens: 4000 },
  gst_calculator:          { maxInputTokens: 30000,  maxOutputTokens: 4000 },
  account_reconciler:      { maxInputTokens: 80000,  maxOutputTokens: 8000 },
  budget_analyzer:         { maxInputTokens: 60000,  maxOutputTokens: 8000 },
  cross_account_tracer:    { maxInputTokens: 80000,  maxOutputTokens: 8000 },
  merchant_intelligence:   { maxInputTokens: 30000,  maxOutputTokens: 4000 },
  payroll_agent:           { maxInputTokens: 50000,  maxOutputTokens: 4000 },
};
```

**Production recommendations:**

- Add per-user daily/monthly token quotas
- Log all agent invocations with token counts for cost attribution
- Use Haiku for simple tasks (categorization, GST lookup) and Sonnet for complex tasks (statement parsing, reconciliation)
- Cache Cognee search results to reduce redundant LLM calls during `cognify()`

### 10.4 Monitoring & Observability

#### Health Checks

| Service | Endpoint | Expected |
| --- | --- | --- |
| Hono Server | `GET /api/health` | `{ status: "ok" }` |
| Cognee Backend | `GET /api/v1/health` | `200 OK` |
| PostgreSQL | `pg_isready -h postgres -p 5432` | Exit code 0 |
| Neo4j | `GET :7474` (browser) or bolt handshake | Connection accepted |

#### Key Metrics to Monitor

**Application-level:**

- Agent invocation count, latency, and error rate (per agent type)
- Token usage per agent invocation (input + output)
- Cognee `add()` / `cognify()` / `search()` latency and error rate
- SSE connection count (`/api/events`)
- JWT auth failures and rate limit hits

**Infrastructure-level:**

- PostgreSQL: connection pool utilization, query latency, replication lag
- PGVector: index size, search latency (p50, p95, p99)
- Neo4j: heap usage, page cache hit ratio, query latency
- Container CPU/memory per service
- Disk usage (PostgreSQL data, Neo4j data, Cognee file storage)

#### Logging Strategy

```text
Hono Server  ──► structured JSON logs ──► log aggregator (CloudWatch / Datadog / ELK)
Cognee       ──► Python logging        ──► same aggregator
PostgreSQL   ──► pg_stat_statements    ──► slow query alerts
Neo4j        ──► query.log             ──► same aggregator
```

**Recommended log fields for agent invocations:**

```json
{
  "timestamp": "2026-02-12T10:30:00Z",
  "agent_type": "transaction_categorizer",
  "user_id": "user_42",
  "input_tokens": 12500,
  "output_tokens": 1800,
  "tool_calls": 3,
  "cognee_searches": 2,
  "latency_ms": 4200,
  "status": "success",
  "model": "claude-sonnet-4-5-20250929"
}
```

### 10.5 Backup & Recovery

| Component | Backup Strategy | RPO | RTO |
| --- | --- | --- | --- |
| PostgreSQL (CBA + Cognee) | Automated daily snapshots + WAL archiving | 1 hour | 30 min |
| Neo4j | `neo4j-admin dump` daily + transaction log backup | 1 hour | 1 hour |
| Cognee file storage | Object storage versioning (S3) or volume snapshots | 24 hours | 1 hour |
| Application config | Git repository (docker-compose, env templates) | Real-time | 5 min |

**Disaster recovery procedure:**

1. Restore PostgreSQL from latest snapshot + replay WAL logs
2. Restore Neo4j from latest dump
3. Redeploy application containers from CI/CD pipeline
4. Cognee will rebuild indexes automatically on first `cognify()` call
5. Verify health checks pass on all services

### 10.6 Cost Estimation

Approximate monthly costs for a small production deployment (10-50 users):

| Component | Service | Estimated Cost |
| --- | --- | --- |
| PostgreSQL + PGVector | AWS RDS db.t3.medium | ~$70/month |
| Neo4j | Neo4j Aura Free/Pro | $0–$65/month |
| Hono Server (2 instances) | ECS Fargate or EC2 t3.small | ~$30/month |
| Cognee Backend (2 instances) | ECS Fargate or EC2 t3.medium | ~$60/month |
| Claude API (Sonnet) | Per-token pricing | ~$50–200/month (usage-dependent) |
| OpenRouter (embeddings) | Per-token pricing | ~$10–30/month |
| Load Balancer | ALB | ~$20/month |
| Redis | ElastiCache t3.micro | ~$15/month |
| **Total** | | **~$255–490/month** |

**Cost optimization tips:**

- Use Haiku ($0.25/MTok input) instead of Sonnet ($3/MTok input) for simple agents
- Cache Cognee search results to reduce embedding API calls
- Use reserved instances for predictable database workloads
- Set per-user token quotas to prevent runaway costs
- Monitor and alert on daily spend thresholds

---

## 11. Feature Discovery Matrix

> Every Cognee feature mapped to a CBA use case with implementation complexity, priority, and expected impact.

### 11.1 Core Operations

| Cognee Feature | CBA Use Case | Priority | Complexity | Impact |
|---|---|---|---|---|
| `cognee.add()` with `dataset` | Ingest statements, transactions, merchant data into isolated datasets | P0 | Low | Foundation — all data enters through this |
| `cognee.add()` with `node_set` | Tag data: `["transactions", "Q3_2025"]`, `["merchants", "gst_registered"]` | P1 | Low | Filtered search by financial period or entity type |
| `cognee.cognify()` with `custom_prompt` | Financial entity extraction (merchants, ABNs, GST status) | P0 | Low | Already in `cognee_client.ts:53-57` via `FINANCIAL_COGNIFY_PROMPT` |
| `cognee.cognify()` with `temporal_cognify=True` | Time-aware knowledge graph for BAS quarters, FY boundaries | P1 | Medium | Temporal queries: "spending trend Q1 vs Q2" |
| `cognee.cognify()` with `ontology_file_path` | Ground entities to FIBO financial ontology | P2 | High | Canonical entity resolution, reduces ambiguity |
| `cognee.cognify()` with `incremental_loading=True` | Only process new/changed statements on re-upload | P1 | Low | 60-80% reduction in re-processing time |
| `cognee.search()` with `session_id` | Conversational memory per user chat session | P1 | Medium | "What was my biggest expense?" → "Break that down by month" |
| `cognee.search()` with `save_interaction=True` | Audit trail of all AI-generated answers | P1 | Low | Compliance requirement for financial advice |
| `cognee.search()` with `datasets` filter | Scope search to user's own data (multi-tenant) | P0 | Low | Data isolation — critical for production |
| `cognee.search()` with `node_type=NodeSet, node_name=[...]` | Filter by financial period or entity type | P1 | Low | Precision: only Q3 transactions, only GST-registered merchants |
| `cognee.search()` with `only_context=True` | Raw context without LLM generation (for agent tool use) | P1 | Low | Faster, cheaper agent tool calls |
| `cognee.search()` with `use_combined_context=True` | Cross-dataset search (transactions + merchants + GST rules) | P1 | Low | Holistic answers spanning multiple knowledge domains |
| `cognee.memify()` | Derive spending rules, merchant associations, GST patterns | P2 | Medium | "Derived: Woolworths = Groceries, always GST" |

### 11.2 Search Types for Financial Use Cases

| Search Type | CBA Use Case | When to Use | Speed | Cost |
|---|---|---|---|---|
| `GRAPH_COMPLETION` | Category pattern reasoning, financial analysis | Default for complex questions | Medium | High (LLM) |
| `RAG_COMPLETION` | GST ruling lookup, ATO compliance guidance | When graph structure isn't needed | Medium | High (LLM) |
| `CHUNKS` | Similar transaction lookup by description | Fast vector similarity for merchant matching | Fast | Low |
| `CHUNKS_LEXICAL` | Exact merchant name lookup | Keyword matching for known merchants | Fast | Low |
| `SUMMARIES` | Statement period summaries | Pre-computed summaries of datasets | Fast | Low |
| `GRAPH_COMPLETION_COT` | Account flow tracing, transfer chain analysis | Complex multi-hop reasoning | Slow | High |
| `GRAPH_COMPLETION_CONTEXT_EXTENSION` | Deep financial analysis with iterative context | When initial context is insufficient | Slow | Very High |
| `GRAPH_SUMMARY_COMPLETION` | Quick financial overview with graph awareness | Summary + graph structure | Medium | Medium |
| `NATURAL_LANGUAGE` | User free-text queries → Cypher | Advanced users querying the graph | Medium | Medium |
| `CYPHER` | Direct graph queries for reporting | Programmatic graph access for dashboards | Fast | Low |
| `TEMPORAL` | Time-based financial queries (BAS periods, FY) | "Show spending for July-September 2025" | Medium | Medium |
| `FEEDBACK` | Retrieve past interactions for learning | Continuous improvement from user corrections | Fast | Low |
| `CODING_RULES` | Derived categorization rules from memify | Auto-generated rules from patterns | Fast | Low |
| `FEELING_LUCKY` | Auto-select best search type | When query intent is ambiguous | Varies | Varies |

### 11.3 Advanced Features

| Feature | CBA Use Case | Priority | Complexity | Impact |
|---|---|---|---|---|
| **Custom DataPoints** | `MerchantDataPoint`, `TransactionDataPoint`, `GSTEntityDataPoint` | P0 | Medium | Structured financial entities in graph with indexed fields |
| **Custom Tasks** | `classify_gst_task`, `resolve_merchant_task`, `detect_recurring_task` | P1 | Medium | Domain-specific processing in cognify pipeline |
| **Custom Pipelines** | `financial_cognify_pipeline`, `merchant_resolution_pipeline` | P1 | Medium | Chain custom tasks for financial processing |
| **Ontology (OWL/RDF)** | Australian Financial Ontology (FIBO subset) | P2 | High | Ground entities to canonical financial vocabulary |
| **NodeSets** | Tag by period (`FY2025_Q1`), type (`gst_registered`), source (`cba_statement`) | P1 | Low | Granular filtering without separate datasets |
| **Memify** | Derive spending rules, merchant→category associations | P2 | Medium | System learns patterns: "Shell = Fuel, always GST" |
| **Feedback System** | Store user corrections, retrieve for learning | P1 | Low | Closes the learning loop |
| **Sessions** | Per-user conversational memory with Redis cache | P1 | Medium | Natural follow-up questions in financial chat |
| **Multi-tenant EBAC** | Per-user data isolation with `ENABLE_BACKEND_ACCESS_CONTROL=true` | P0 | Medium | Production requirement |
| **Dataset DB Handlers** | Per-user database routing (PGVector, Neo4j) | P2 | High | Physical database isolation for enterprise |
| **`LLMGateway.acreate_structured_output()`** | Direct structured LLM calls for custom tasks | P1 | Low | Pydantic-validated output for entity extraction |
| **Incremental Loading** | Skip already-processed statements on re-cognify | P1 | Low | Major performance improvement |

### 11.4 Integration Changes Required to `cognee_client.ts`

| Change | Current State (line ref) | Target | Complexity |
|---|---|---|---|
| Per-user auth tokens | Single admin token (`line 16-17`) | Token per user OR service account with dataset scoping | Medium |
| `node_set` support in `add()` | Not supported (`line 515-535`) | Add `node_set` parameter to FormData | Low |
| `session_id` in `search()` | Not supported (`line 555-587`) | Add `session_id` to search JSON body | Low |
| `save_interaction` in `search()` | Not supported | Add `save_interaction: true` to search body | Low |
| `temporal_cognify` in `cognify()` | Not supported (`line 347-384`) | Add `temporal_cognify: true` to cognify body | Low |
| `incremental_loading` in `cognify()` | Not supported | Add `incremental_loading: true` to cognify body | Low |
| `only_context` in `search()` | Not supported | Add `only_context: true` for agent tool calls | Low |
| Multi-dataset `search()` | Single dataset (`line 569`) | Support multiple datasets for cross-domain search | Low |
| `FEEDBACK` search type | Not in type union (`line 29-43`) | Add `'FEEDBACK'` to `CogneeSearchType` | Low |
| User registration flow | Not implemented | New method: `registerUser(email, password, tenantId)` | Medium |
| Dataset permission management | Not implemented | New methods: `grantAccess()`, `revokeAccess()` | Medium |

### 11.5 Integration Changes Required to `cognee-tools.ts`

| Change | Current State (line ref) | Target | Complexity |
|---|---|---|---|
| Per-user dataset prefix | Static `datasetPrefix` (`line 14`) | Dynamic prefix from user context: `user_{uuid}_` | Low |
| Session-aware search | No session support | Pass `sessionId` through to `cogneeClient.search()` | Low |
| NodeSet-filtered search | Not supported | New method: `searchWithNodeSet(query, dataset, nodeNames)` | Low |
| Feedback tool | Not implemented | New method: `saveFeedback(query, response, rating)` | Low |
| Temporal search | Not implemented | New method: `searchTemporal(query, dataset, dateRange)` | Low |

### 11.6 Agent-Level Enhancements

| Agent | Enhancement | Integration Point |
|---|---|---|
| `TransactionCategorizerAgent` | Use `FEEDBACK` search to learn from past corrections | New `check_past_corrections` tool handler |
| `TransactionCategorizerAgent` | Use `node_set` filtering for period-specific patterns | `search_similar_transactions` → add `node_name` param |
| `MerchantIntelligenceAgent` | Two-phase lookup: fast `CHUNKS_LEXICAL` → `GRAPH_COMPLETION` fallback | `search_cognee_merchant` tool handler |
| `GSTCalculatorAgent` | Use `TEMPORAL` search for quarter-specific rules | New `search_temporal_gst_rules` tool |
| `GSTCalculatorAgent` | Use `save_interaction=True` for audit trail | All GST calculations saved as interactions |
| `BudgetAnalyzerAgent` | Use `GRAPH_COMPLETION_COT` for trend analysis | Chain-of-thought over spending graph |
| `CrossAccountTracerAgent` | Use `GRAPH_COMPLETION_CONTEXT_EXTENSION` | Iterative context expansion for multi-hop transfers |
| `PayrollAgent` | Use `TEMPORAL` search for FY/quarter wage totals | Time-bounded payroll queries |
| **All Agents** | Accept `userId` for multi-tenant dataset scoping | `CogneeToolConfig` gets `userId` field |

---

## 12. Custom DataPoint Models

> Pydantic models inheriting from Cognee's `DataPoint` base class, designed for the Australian financial domain. These models define the **structured entities** that live in the knowledge graph with vector-indexed fields for semantic search.

### 12.1 DataPoint Architecture

From `guides-custom-data-models.md`:

```python
from cognee.infrastructure.engine import DataPoint
from pydantic import Field
from typing import Optional, List
from datetime import date

# Every DataPoint:
# - Gets a UUID automatically
# - Becomes a node in the knowledge graph
# - Has metadata.index_fields for vector embedding
# - Can reference other DataPoints (→ graph edges)
# - Is stored in relational + vector + graph stores simultaneously
```

### 12.2 Financial DataPoint Models

#### MerchantDataPoint

```python
class MerchantDataPoint(DataPoint):
    """Canonical merchant entity in the knowledge graph."""
    canonical_name: str = Field(description="Normalized merchant name (e.g., 'Woolworths Group')")
    raw_names: List[str] = Field(default_factory=list, description="All raw description variants seen")
    abn: Optional[str] = Field(default=None, description="Australian Business Number")
    gst_registered: bool = Field(default=True, description="Whether merchant charges GST")
    industry: Optional[str] = Field(default=None, description="ANZSIC industry classification")
    default_category: str = Field(description="Most common transaction category")
    default_gst_category: str = Field(default="gst_free", description="Default GST treatment")
    confidence: float = Field(default=0.5, description="Categorization confidence 0.0-1.0")
    transaction_count: int = Field(default=0, description="Number of transactions seen")

    class Config:
        metadata = {
            "index_fields": ["canonical_name", "industry", "default_category"],
            "type": "MerchantDataPoint"
        }
```

#### TransactionDataPoint

```python
class TransactionDataPoint(DataPoint):
    """Individual financial transaction in the knowledge graph."""
    transaction_date: date = Field(description="Transaction date")
    description: str = Field(description="Raw bank statement description")
    amount: float = Field(description="Transaction amount (negative=debit, positive=credit)")
    category: str = Field(description="Assigned category")
    gst_category: str = Field(description="GST treatment: taxable_10, gst_free, input_taxed, bas_excluded")
    gst_amount: Optional[float] = Field(default=None, description="Calculated GST component")
    merchant: Optional[MerchantDataPoint] = Field(default=None, description="Resolved merchant → graph edge")
    account_id: Optional[str] = Field(default=None, description="Source bank account")
    bas_quarter: Optional[str] = Field(default=None, description="BAS quarter: e.g., 'Q1_FY2025'")
    is_recurring: bool = Field(default=False, description="Part of a recurring pattern")

    class Config:
        metadata = {
            "index_fields": ["description", "category", "gst_category"],
            "type": "TransactionDataPoint"
        }
```

#### GSTEntityDataPoint

```python
class GSTEntityDataPoint(DataPoint):
    """GST classification entity for BAS reporting."""
    entity_type: str = Field(description="'supply' | 'acquisition' | 'adjustment'")
    gst_treatment: str = Field(description="taxable_10 | gst_free | input_taxed | bas_excluded | capital")
    bas_label: str = Field(description="BAS field: G1, G2, G3, G10, G11, 1A, 1B, W1, W2")
    description: str = Field(description="Human-readable description of this GST treatment")
    ato_reference: Optional[str] = Field(default=None, description="ATO ruling reference")
    applies_to_categories: List[str] = Field(default_factory=list, description="Categories this treatment applies to")

    class Config:
        metadata = {
            "index_fields": ["entity_type", "gst_treatment", "bas_label", "description"],
            "type": "GSTEntityDataPoint"
        }
```

#### BankStatementDataPoint

```python
class BankStatementDataPoint(DataPoint):
    """Bank statement metadata in the knowledge graph."""
    bank_name: str = Field(default="Commonwealth Bank", description="Issuing bank")
    account_number: str = Field(description="Account number (masked)")
    account_type: str = Field(description="'transaction' | 'savings' | 'credit'")
    period_start: date = Field(description="Statement period start")
    period_end: date = Field(description="Statement period end")
    opening_balance: float = Field(description="Opening balance")
    closing_balance: float = Field(description="Closing balance")
    transaction_count: int = Field(description="Number of transactions in statement")
    transactions: List[TransactionDataPoint] = Field(default_factory=list, description="→ graph edges to transactions")

    class Config:
        metadata = {
            "index_fields": ["account_number", "account_type"],
            "type": "BankStatementDataPoint"
        }
```

#### RecurringPatternDataPoint

```python
class RecurringPatternDataPoint(DataPoint):
    """Detected recurring transaction pattern."""
    merchant: MerchantDataPoint = Field(description="→ graph edge to merchant")
    frequency: str = Field(description="'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'annual'")
    typical_amount: float = Field(description="Average transaction amount")
    amount_variance: float = Field(default=0.0, description="Allowed variance from typical amount")
    category: str = Field(description="Transaction category")
    last_seen: date = Field(description="Most recent occurrence")
    occurrence_count: int = Field(default=0, description="Times this pattern has been seen")

    class Config:
        metadata = {
            "index_fields": ["frequency", "category"],
            "type": "RecurringPatternDataPoint"
        }
```

### 12.3 Inserting Custom DataPoints

Custom DataPoints are inserted directly into the knowledge graph using `cognee.add_data_points()`:

```python
import cognee

# Create merchant entity
woolworths = MerchantDataPoint(
    canonical_name="Woolworths Group",
    raw_names=["WOOLWORTHS 1234", "WOW METRO SYDNEY", "WOOLWORTHS ONLINE"],
    abn="88000014675",
    gst_registered=True,
    industry="Supermarkets and Grocery Stores",
    default_category="Groceries & Supermarket",
    default_gst_category="taxable_10",
    confidence=0.98,
    transaction_count=47
)

# Insert into graph — creates node + vector embedding for index_fields
await cognee.add_data_points([woolworths], dataset_name="user_abc123_merchants")
```

### 12.4 Graph Relationships (Edges)

When a DataPoint field references another DataPoint, Cognee automatically creates a **graph edge**:

```
TransactionDataPoint --[merchant]--> MerchantDataPoint
BankStatementDataPoint --[transactions]--> TransactionDataPoint
RecurringPatternDataPoint --[merchant]--> MerchantDataPoint
```

This enables graph traversal queries like:

- "Find all transactions linked to GST-registered merchants" → traverse `merchant` edge, filter `gst_registered=True`
- "Show recurring patterns for this statement period" → traverse `transactions` → `merchant` → `RecurringPatternDataPoint`

### 12.5 TypeScript Integration

The TypeScript `cognee_client.ts` calls the REST API to insert DataPoints:

```typescript
// New method to add to cognee_client.ts
async addDataPoints(dataPoints: FinancialDataPoint[], dataset: string): Promise<void> {
  await this.ensureAuthenticated();
  const response = await fetch(`${this.baseUrl}/api/v1/add/data_points`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${this.authToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      data_points: dataPoints,
      dataset_name: dataset
    })
  });
  if (!response.ok) throw new Error(`Failed to add data points: ${response.statusText}`);
}
```

---

## 13. Custom Pipeline Designs

> Financial-specific pipelines that chain custom tasks for domain-specific processing. Built using Cognee's `Task` and `run_pipeline()` primitives.

### 13.1 Pipeline Architecture

From `core-concepts-pipelines.md` and `core-concepts-tasks.md`:

```python
from cognee.modules.pipelines import Task, run_pipeline

# A Task wraps any Python callable (sync or async)
# A Pipeline chains Tasks, passing output of one as input to the next
# run_pipeline(tasks, data, datasets) executes the chain
```

### 13.2 Financial Cognify Pipeline

Replaces the default `cognify()` pipeline with financial-domain-specific processing:

```python
from cognee.modules.pipelines import Task, run_pipeline
from cognee.infrastructure.llm import LLMGateway

async def extract_financial_entities(text_chunks: list[str]) -> list[dict]:
    """Custom entity extraction focused on Australian financial entities."""
    gateway = LLMGateway()
    results = []
    for chunk in text_chunks:
        entities = await gateway.acreate_structured_output(
            prompt=f"""Extract financial entities from this bank statement text:
            {chunk}

            Extract: merchant names, ABNs, amounts, dates, GST indicators,
            payment methods, account references, BAS-relevant categories.""",
            output_model=FinancialEntityExtraction  # Pydantic model
        )
        results.append(entities)
    return results

async def classify_gst_treatment(entities: list[dict]) -> list[dict]:
    """Classify each transaction's GST treatment based on ATO rules."""
    for entity in entities:
        entity["gst_category"] = await determine_gst_category(
            category=entity.get("category"),
            merchant_gst_registered=entity.get("gst_registered", True),
            amount=entity.get("amount", 0)
        )
    return entities

async def create_financial_datapoints(entities: list[dict]) -> list[DataPoint]:
    """Convert extracted entities into typed DataPoints for the graph."""
    datapoints = []
    for entity in entities:
        if entity["type"] == "merchant":
            datapoints.append(MerchantDataPoint(**entity))
        elif entity["type"] == "transaction":
            datapoints.append(TransactionDataPoint(**entity))
    return datapoints

# Assemble the pipeline
financial_cognify_pipeline = [
    Task(extract_financial_entities),
    Task(classify_gst_treatment),
    Task(create_financial_datapoints),
]

# Execute
await run_pipeline(financial_cognify_pipeline, data=raw_chunks, datasets=["user_abc_statements"])
```

### 13.3 Merchant Resolution Pipeline

Resolves raw bank statement descriptions to canonical merchant entities:

```python
async def strip_payment_processor(description: str) -> str:
    """Remove payment processor prefixes (Square, Stripe, PayPal, Afterpay)."""
    prefixes = ["SQ *", "STRIPE*", "PAYPAL *", "SP * ", "AFTPY*", "AFTERPAY*"]
    for prefix in prefixes:
        if description.upper().startswith(prefix):
            return description[len(prefix):].strip()
    return description

async def lookup_known_merchant(clean_description: str) -> Optional[MerchantDataPoint]:
    """Search Cognee graph for existing merchant match."""
    results = await cognee.search(
        search_type="CHUNKS_LEXICAL",
        query=clean_description,
        datasets=["merchants"]
    )
    if results and results[0].score > 0.85:
        return results[0]
    return None

async def resolve_via_graph(clean_description: str) -> Optional[MerchantDataPoint]:
    """Fall back to graph reasoning for fuzzy merchant resolution."""
    results = await cognee.search(
        search_type="GRAPH_COMPLETION",
        query=f"What merchant does '{clean_description}' refer to?",
        datasets=["merchants"]
    )
    return results[0] if results else None

async def store_new_merchant(description: str, resolved: dict) -> MerchantDataPoint:
    """Create and store a new merchant DataPoint if not found."""
    merchant = MerchantDataPoint(
        canonical_name=resolved["name"],
        raw_names=[description],
        default_category=resolved.get("category", "Uncategorized"),
        confidence=0.6
    )
    await cognee.add_data_points([merchant], dataset_name="merchants")
    return merchant

merchant_resolution_pipeline = [
    Task(strip_payment_processor),
    Task(lookup_known_merchant),
    Task(resolve_via_graph),       # Only runs if lookup returns None
    Task(store_new_merchant),      # Only runs for new merchants
]
```

### 13.4 Pattern Learning Pipeline

Learns from user corrections to improve future categorization:

```python
async def collect_corrections(dataset: str) -> list[dict]:
    """Retrieve recent user corrections from feedback store."""
    return await cognee.search(
        search_type="FEEDBACK",
        query="recent corrections",
        datasets=[dataset],
        params={"last_k": 50}
    )

async def derive_rules(corrections: list[dict]) -> list[dict]:
    """Analyze corrections to derive categorization rules."""
    gateway = LLMGateway()
    rules = await gateway.acreate_structured_output(
        prompt=f"""Analyze these user corrections and derive categorization rules:
        {corrections}

        For each pattern, output:
        - merchant_pattern: regex or keyword
        - correct_category: the category the user chose
        - correct_gst_category: the GST treatment
        - confidence: how confident we are in this rule""",
        output_model=CategorizationRuleSet
    )
    return rules

async def update_merchant_memory(rules: list[dict]) -> None:
    """Update merchant DataPoints with learned rules."""
    for rule in rules:
        existing = await cognee.search(
            search_type="CHUNKS_LEXICAL",
            query=rule["merchant_pattern"],
            datasets=["merchants"]
        )
        if existing:
            # Update confidence and category
            existing[0].default_category = rule["correct_category"]
            existing[0].confidence = min(existing[0].confidence + 0.1, 1.0)
            await cognee.add_data_points([existing[0]], dataset_name="merchants")

pattern_learning_pipeline = [
    Task(collect_corrections),
    Task(derive_rules),
    Task(update_merchant_memory),
]
```

### 13.5 Pipeline Registration

Pipelines are registered in the Cognee MCP server or called via REST API:

```python
# In cognee-mcp/src/server.py — register custom pipeline
@server.tool()
async def run_financial_pipeline(pipeline_name: str, dataset: str) -> str:
    """Run a named financial pipeline."""
    pipelines = {
        "financial_cognify": financial_cognify_pipeline,
        "merchant_resolution": merchant_resolution_pipeline,
        "pattern_learning": pattern_learning_pipeline,
    }
    pipeline = pipelines.get(pipeline_name)
    if not pipeline:
        return f"Unknown pipeline: {pipeline_name}"

    data = await cognee.search(search_type="CHUNKS", query="*", datasets=[dataset])
    await run_pipeline(pipeline, data=data, datasets=[dataset])
    return f"Pipeline '{pipeline_name}' completed on dataset '{dataset}'"
```

---

## 14. Search Strategy Matrix

> Detailed mapping of which Cognee `SearchType` to use for each financial query pattern, with exact API call examples.

### 14.1 Decision Tree

```text
User Query
  ├─ "What category is this merchant?" ──────────► CHUNKS_LEXICAL (fast, exact match)
  │     └─ No match? ────────────────────────────► GRAPH_COMPLETION (reasoning fallback)
  ├─ "Show my spending for Q3 2025" ─────────────► TEMPORAL (time-bounded)
  ├─ "Why was this categorized as X?" ───────────► FEEDBACK (past interactions)
  ├─ "Trace this transfer chain" ────────────────► GRAPH_COMPLETION_COT (multi-hop)
  ├─ "Summarize this statement" ─────────────────► SUMMARIES (pre-computed)
  ├─ "What's the GST treatment for rent?" ───────► RAG_COMPLETION (ATO rules)
  ├─ "Find similar transactions" ────────────────► CHUNKS (vector similarity)
  ├─ "Show all Woolworths transactions" ─────────► CYPHER (direct graph query)
  ├─ "What are my spending rules?" ──────────────► CODING_RULES (memify-derived)
  └─ Ambiguous / conversational ─────────────────► FEELING_LUCKY (auto-select)
```

### 14.2 Search Type API Examples

#### CHUNKS — Fast Vector Similarity (Agent Tool Calls)

```python
# Best for: merchant matching, similar transaction lookup
# Speed: Fast | Cost: Low (no LLM) | Use: agent tool handlers
results = await cognee.search(
    search_type="CHUNKS",
    query="WOOLWORTHS 1234 SYDNEY",
    datasets=["user_abc_merchants"],
    only_context=True  # Raw results, no LLM generation
)
# Returns: list of similar text chunks with similarity scores
```

#### CHUNKS_LEXICAL — Keyword Matching

```python
# Best for: exact merchant name lookup, known entity search
# Speed: Fast | Cost: Low | Use: first-pass merchant resolution
results = await cognee.search(
    search_type="CHUNKS_LEXICAL",
    query="Woolworths",
    datasets=["user_abc_merchants"]
)
```

#### GRAPH_COMPLETION — Default Reasoning

```python
# Best for: complex financial questions requiring graph structure
# Speed: Medium | Cost: High (LLM) | Use: user-facing answers
results = await cognee.search(
    search_type="GRAPH_COMPLETION",
    query="What are my largest recurring expenses and their GST treatment?",
    datasets=["user_abc_transactions", "user_abc_merchants"],
    session_id="user_abc_chat_001",      # Conversational memory
    save_interaction=True                 # Audit trail
)
```

#### GRAPH_COMPLETION_COT — Chain-of-Thought Reasoning

```python
# Best for: multi-hop queries (transfer tracing, account flow analysis)
# Speed: Slow | Cost: High | Use: CrossAccountTracerAgent, BudgetAnalyzerAgent
results = await cognee.search(
    search_type="GRAPH_COMPLETION_COT",
    query="Trace the flow of funds from savings account to business expenses in January 2025",
    datasets=["user_abc_transactions"]
)
```

#### TEMPORAL — Time-Bounded Queries

```python
# Best for: BAS quarter queries, FY comparisons, trend analysis
# Speed: Medium | Cost: Medium | Use: GSTCalculatorAgent, PayrollAgent
results = await cognee.search(
    search_type="TEMPORAL",
    query="Total GST-claimable expenses for Q2 FY2025 (October-December 2024)",
    datasets=["user_abc_transactions"]
)
```

#### FEEDBACK — Learning from Past Interactions

```python
# Best for: retrieving past corrections, improving accuracy
# Speed: Fast | Cost: Low | Use: TransactionCategorizerAgent learning loop
results = await cognee.search(
    search_type="FEEDBACK",
    query="corrections for merchant categorization",
    datasets=["user_abc_feedback"],
    params={"last_k": 20}  # Last 20 interactions
)
```

#### RAG_COMPLETION — Document-Based Answers

```python
# Best for: ATO ruling lookups, compliance guidance, GST rules
# Speed: Medium | Cost: High (LLM) | Use: GSTCalculatorAgent
results = await cognee.search(
    search_type="RAG_COMPLETION",
    query="What is the GST treatment for commercial rent payments in Australia?",
    datasets=["gst_rules", "ato_rulings"]
)
```

#### CYPHER — Direct Graph Queries

```python
# Best for: programmatic reporting, dashboard data, bulk queries
# Speed: Fast | Cost: Low | Use: reporting endpoints, dashboards
results = await cognee.search(
    search_type="CYPHER",
    query="MATCH (t:TransactionDataPoint)-[:merchant]->(m:MerchantDataPoint) WHERE m.gst_registered = true RETURN m.canonical_name, SUM(t.amount) AS total ORDER BY total DESC LIMIT 10",
    datasets=["user_abc_transactions"]
)
```

### 14.3 Two-Phase Search Pattern

For maximum accuracy with minimum cost, use a **two-phase search**:

```typescript
// In cognee-tools.ts — enhanced search method
async searchTwoPhase(query: string, dataset: string): Promise<SearchResult> {
  // Phase 1: Fast lexical/vector search (low cost)
  const fastResults = await this.cogneeClient.search(
    query, dataset, 'CHUNKS', { only_context: true }
  );

  // If high-confidence match found, return immediately
  if (fastResults.length > 0 && fastResults[0].score > 0.9) {
    return fastResults[0];
  }

  // Phase 2: Graph reasoning fallback (higher cost, higher accuracy)
  const graphResults = await this.cogneeClient.search(
    query, dataset, 'GRAPH_COMPLETION', { only_context: true }
  );

  return graphResults[0] ?? null;
}
```

### 14.4 Agent-to-SearchType Mapping

| Agent | Primary SearchType | Secondary SearchType | Rationale |
|---|---|---|---|
| `TransactionCategorizerAgent` | `CHUNKS` | `FEEDBACK` | Fast similarity + learn from corrections |
| `MerchantIntelligenceAgent` | `CHUNKS_LEXICAL` | `GRAPH_COMPLETION` | Exact match first, reasoning fallback |
| `GSTCalculatorAgent` | `RAG_COMPLETION` | `TEMPORAL` | ATO rules + quarter-specific data |
| `BudgetAnalyzerAgent` | `GRAPH_COMPLETION_COT` | `TEMPORAL` | Trend reasoning + time-bounded |
| `CrossAccountTracerAgent` | `GRAPH_COMPLETION_CONTEXT_EXTENSION` | `CYPHER` | Multi-hop + direct graph |
| `PayrollAgent` | `TEMPORAL` | `RAG_COMPLETION` | FY/quarter wages + ATO PAYG rules |
| `AccountReconcilerAgent` | `CYPHER` | `GRAPH_COMPLETION` | Bulk matching + reasoning |
| `StatementParserAgent` | `CHUNKS` | `SUMMARIES` | Similar statements + period summaries |

---

## 15. Feedback & Learning Loop Design

> How the system improves with every transaction processed. User corrections feed back into Cognee's knowledge graph, making future categorizations more accurate.

### 15.1 Learning Loop Architecture

```text
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│  User Reviews │────►│  Correction  │────►│  save_interaction │
│  Transaction  │     │  Submitted   │     │  (Cognee API)     │
└──────────────┘     └──────────────┘     └────────┬─────────┘
                                                    │
                                                    ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│  Higher       │◄────│  Merchant    │◄────│  Feedback Store   │
│  Confidence   │     │  Memory      │     │  (Graph + Vector)  │
│  Next Time    │     │  Updated     │     │                    │
└──────────────┘     └──────────────┘     └──────────────────┘
```

### 15.2 Correction Flow

**Step 1: User submits correction**

```typescript
// Frontend: user changes category from "Office Supplies" to "Software & Subscriptions"
const correction = {
  transactionId: "txn_abc123",
  originalCategory: "Office Supplies",
  correctedCategory: "Software & Subscriptions",
  originalGstCategory: "taxable_10",
  correctedGstCategory: "taxable_10",  // unchanged
  merchantDescription: "ADOBE CREATIVE CLD",
  reason: "This is a software subscription, not office supplies"
};
```

**Step 2: Store correction as interaction in Cognee**

```typescript
// In cognee_client.ts — new method
async saveCorrection(correction: TransactionCorrection, dataset: string): Promise<void> {
  await this.ensureAuthenticated();
  // Use save_interaction to store in feedback graph
  await fetch(`${this.baseUrl}/api/v1/search`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${this.authToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: `User corrected "${correction.merchantDescription}" from "${correction.originalCategory}" to "${correction.correctedCategory}". Reason: ${correction.reason}`,
      search_type: 'GRAPH_COMPLETION',
      datasets: [dataset],
      save_interaction: true  // ← This stores the correction in Cognee's feedback graph
    })
  });
}
```

**Step 3: Retrieve corrections for learning**

```typescript
// In TransactionCategorizerAgent — check_past_corrections tool handler
async checkPastCorrections(merchantDescription: string, dataset: string): Promise<Correction[]> {
  const results = await this.cogneeClient.search(
    `corrections for merchant "${merchantDescription}"`,
    dataset,
    'FEEDBACK',
    { last_k: 10 }
  );
  return results.map(r => parseCorrection(r));
}
```

**Step 4: Update merchant memory with learned pattern**

```typescript
// After categorization, if confidence is high, reinforce the pattern
if (categorization.confidence > 0.85) {
  await this.cogneeClient.storeMerchantMapping(
    merchantDescription,
    categorization.category,
    categorization.gstCategory,
    dataset
  );
}
```

### 15.3 Confidence Score Evolution

The system tracks confidence per merchant-category mapping:

| Event | Confidence Change | Example |
|---|---|---|
| First categorization (AI guess) | Start at 0.5 | "ADOBE CREATIVE CLD" → "Office Supplies" (0.5) |
| User confirms (no correction) | +0.1 | Confidence → 0.6 |
| User corrects | Reset to 0.7 for new category | "Software & Subscriptions" (0.7) |
| Same correction seen 3+ times | +0.1 per occurrence | Confidence → 0.9 |
| Reaches 0.95+ | Auto-categorize without AI | No LLM call needed |

### 15.4 Feedback-Driven Agent Behavior

```typescript
// In TransactionCategorizerAgent — modified categorization flow
async categorizeTransaction(transaction: Transaction): Promise<Categorization> {
  // 1. Check merchant memory (fast, no LLM)
  const merchantMatch = await this.tools.search(
    transaction.description, `${this.userId}_merchants`, 'CHUNKS_LEXICAL'
  );

  if (merchantMatch && merchantMatch.confidence > 0.95) {
    // Auto-categorize — no LLM needed
    return { category: merchantMatch.category, confidence: merchantMatch.confidence, source: 'memory' };
  }

  // 2. Check past corrections (fast, no LLM)
  const corrections = await this.tools.search(
    transaction.description, `${this.userId}_feedback`, 'FEEDBACK'
  );

  if (corrections.length > 0) {
    // Apply most recent correction pattern
    return { category: corrections[0].correctedCategory, confidence: 0.8, source: 'feedback' };
  }

  // 3. Fall back to AI reasoning (slower, costs LLM tokens)
  const aiResult = await this.tools.search(
    transaction.description, `${this.userId}_transactions`, 'GRAPH_COMPLETION'
  );

  return { category: aiResult.category, confidence: 0.5, source: 'ai' };
}
```

### 15.5 Metrics & Monitoring

Track learning effectiveness:

| Metric | Target | How to Measure |
|---|---|---|
| Auto-categorization rate | >80% after 3 months | % of transactions categorized from memory (confidence >0.95) |
| Correction rate | <5% after 3 months | % of transactions user corrects |
| Average confidence | >0.85 | Mean confidence across all categorizations |
| LLM calls per transaction | <0.3 | Ratio of LLM-required categorizations to total |
| Time to auto-categorize | <100ms | Latency for memory-based categorization |

---

## 16. Ontology Strategy

> Using OWL/RDF ontologies to ground financial entities to canonical vocabularies, reducing ambiguity and enabling standardized reasoning across the knowledge graph.

### 16.1 Why Ontologies for Financial Data

Without an ontology, Cognee's entity extraction produces **ungrounded entities** — the same concept may appear as "GST", "Goods and Services Tax", "10% tax", or "G1 amount". An ontology provides:

- **Canonical names**: "GST" always maps to `fibo:GoodsAndServicesTax`
- **Hierarchical relationships**: "Groceries" `is_a` "Business Expense" `is_a` "Deductible Expense"
- **Constraint validation**: A `bas_excluded` transaction cannot have a `gst_amount > 0`
- **Cross-entity reasoning**: "Woolworths" `is_a` "Supermarket" `is_a` "GST-Registered Retailer"

### 16.2 Australian Financial Ontology (FIBO Subset)

We define a lightweight OWL ontology based on FIBO (Financial Industry Business Ontology) tailored for Australian SMB accounting:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
         xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#"
         xmlns:owl="http://www.w3.org/2002/07/owl#"
         xmlns:gl="http://goldledger.app/ontology#">

  <!-- Top-level classes -->
  <owl:Class rdf:about="gl:FinancialTransaction"/>
  <owl:Class rdf:about="gl:Merchant"/>
  <owl:Class rdf:about="gl:GSTTreatment"/>
  <owl:Class rdf:about="gl:ExpenseCategory"/>
  <owl:Class rdf:about="gl:BASField"/>
  <owl:Class rdf:about="gl:FinancialPeriod"/>

  <!-- GST Treatment hierarchy -->
  <owl:Class rdf:about="gl:Taxable10">
    <rdfs:subClassOf rdf:resource="gl:GSTTreatment"/>
    <rdfs:label>Taxable Supply (10% GST)</rdfs:label>
    <gl:basField>G1</gl:basField>
  </owl:Class>
  <owl:Class rdf:about="gl:GSTFree">
    <rdfs:subClassOf rdf:resource="gl:GSTTreatment"/>
    <rdfs:label>GST-Free Supply</rdfs:label>
    <gl:basField>G3</gl:basField>
  </owl:Class>
  <owl:Class rdf:about="gl:InputTaxed">
    <rdfs:subClassOf rdf:resource="gl:GSTTreatment"/>
    <rdfs:label>Input Taxed (No GST Credit)</rdfs:label>
    <gl:basField>G10</gl:basField>
  </owl:Class>
  <owl:Class rdf:about="gl:BASExcluded">
    <rdfs:subClassOf rdf:resource="gl:GSTTreatment"/>
    <rdfs:label>BAS Excluded (Wages, Transfers, etc.)</rdfs:label>
  </owl:Class>

  <!-- Expense Category hierarchy -->
  <owl:Class rdf:about="gl:BusinessExpense">
    <rdfs:subClassOf rdf:resource="gl:ExpenseCategory"/>
  </owl:Class>
  <owl:Class rdf:about="gl:GroceriesAndSupermarket">
    <rdfs:subClassOf rdf:resource="gl:BusinessExpense"/>
    <gl:defaultGSTTreatment rdf:resource="gl:Taxable10"/>
  </owl:Class>
  <owl:Class rdf:about="gl:Rent">
    <rdfs:subClassOf rdf:resource="gl:BusinessExpense"/>
    <gl:defaultGSTTreatment rdf:resource="gl:Taxable10"/>
  </owl:Class>
  <owl:Class rdf:about="gl:WagesAndSalaries">
    <rdfs:subClassOf rdf:resource="gl:BusinessExpense"/>
    <gl:defaultGSTTreatment rdf:resource="gl:BASExcluded"/>
  </owl:Class>
  <owl:Class rdf:about="gl:BankFees">
    <rdfs:subClassOf rdf:resource="gl:BusinessExpense"/>
    <gl:defaultGSTTreatment rdf:resource="gl:InputTaxed"/>
  </owl:Class>

  <!-- Merchant classification -->
  <owl:Class rdf:about="gl:Supermarket">
    <rdfs:subClassOf rdf:resource="gl:Merchant"/>
    <gl:defaultCategory rdf:resource="gl:GroceriesAndSupermarket"/>
    <gl:typicallyGSTRegistered>true</gl:typicallyGSTRegistered>
  </owl:Class>

  <!-- Financial Period hierarchy (Australian) -->
  <owl:Class rdf:about="gl:FinancialYear">
    <rdfs:subClassOf rdf:resource="gl:FinancialPeriod"/>
    <rdfs:comment>Australian FY: July 1 to June 30</rdfs:comment>
  </owl:Class>
  <owl:Class rdf:about="gl:BASQuarter">
    <rdfs:subClassOf rdf:resource="gl:FinancialPeriod"/>
    <rdfs:comment>Q1=Jul-Sep, Q2=Oct-Dec, Q3=Jan-Mar, Q4=Apr-Jun</rdfs:comment>
  </owl:Class>
</rdf:RDF>
```

### 16.3 Cognee Integration

```python
import cognee
from cognee.infrastructure.ontology import RDFLibOntologyResolver

# Configure ontology for cognify
cognee.config.set_ontology_config({
    "ontology_file_path": "./ontologies/goldledger-financial.owl",
    "resolver": RDFLibOntologyResolver
})

# Cognify with ontology grounding
await cognee.cognify(
    datasets=["user_abc_transactions"],
    ontology_file_path="./ontologies/goldledger-financial.owl"
)
# Entities are now grounded to canonical ontology classes
# "Woolworths" → gl:Supermarket → gl:GroceriesAndSupermarket → gl:Taxable10
```

### 16.4 Benefits for GoldLedger

| Benefit | Without Ontology | With Ontology |
|---|---|---|
| Merchant classification | AI guesses each time | Grounded to `gl:Supermarket` → auto-category |
| GST treatment | Rule-based lookup table | Inherited from ontology hierarchy |
| BAS field mapping | Hardcoded in `gst-calculator.ts` | Derived from `gl:basField` property |
| New category addition | Code change required | Add OWL class, re-cognify |
| Cross-user consistency | Each user's graph may differ | All users share canonical vocabulary |

---

## 17. Temporal Intelligence Design

> Time-aware knowledge graphs that understand Australian financial calendars — BAS quarters, financial years, and seasonal patterns.

### 17.1 Australian Financial Calendar

```text
Financial Year (FY2025): July 1, 2024 → June 30, 2025

BAS Quarters:
  Q1: July 1 – September 30    (BAS due: October 28)
  Q2: October 1 – December 31  (BAS due: February 28)
  Q3: January 1 – March 31     (BAS due: April 28)
  Q4: April 1 – June 30        (BAS due: August 28)

Key Dates:
  - PAYG withholding: aligned with pay periods
  - Super guarantee: due 28 days after quarter end
  - Tax return: due October 31 (or later with tax agent)
```

### 17.2 Temporal Cognify

Enable time-aware knowledge graph construction:

```python
import cognee

# Cognify with temporal awareness
await cognee.cognify(
    datasets=["user_abc_transactions"],
    temporal_cognify=True  # ← Adds temporal nodes and edges to graph
)

# This creates:
# - Temporal nodes: FY2025, Q1_FY2025, Q2_FY2025, etc.
# - Temporal edges: transaction --[occurred_in]--> Q1_FY2025
# - Temporal ordering: Q1_FY2025 --[followed_by]--> Q2_FY2025
```

### 17.3 Temporal Search Queries

```python
# Query 1: BAS quarter totals
results = await cognee.search(
    search_type="TEMPORAL",
    query="Total GST collected and paid for Q2 FY2025 (October-December 2024)",
    datasets=["user_abc_transactions"]
)

# Query 2: Year-over-year comparison
results = await cognee.search(
    search_type="TEMPORAL",
    query="Compare business expenses between Q1 FY2024 and Q1 FY2025",
    datasets=["user_abc_transactions"]
)

# Query 3: Seasonal pattern detection
results = await cognee.search(
    search_type="TEMPORAL",
    query="What months have the highest COGS spending?",
    datasets=["user_abc_transactions"]
)
```

### 17.4 NodeSet Tagging for Financial Periods

Use NodeSets to tag data by financial period for efficient filtering:

```python
# When adding transactions, tag with period NodeSets
await cognee.add(
    data=q2_transactions,
    dataset_name="user_abc_transactions",
    node_set=["Q2_FY2025", "BAS_Oct_Dec_2024", "transactions"]
)

# Search scoped to a specific period
results = await cognee.search(
    search_type="GRAPH_COMPLETION",
    query="What are the deductible expenses?",
    datasets=["user_abc_transactions"],
    node_type="NodeSet",
    node_name=["Q2_FY2025"]  # Only search within this quarter
)
```

### 17.5 Agent Integration

```typescript
// In GSTCalculatorAgent — temporal GST query tool
const tools = [{
  name: 'search_temporal_gst',
  description: 'Search for GST data within a specific BAS quarter',
  input_schema: {
    type: 'object',
    properties: {
      quarter: { type: 'string', description: 'BAS quarter e.g. Q2_FY2025' },
      query: { type: 'string', description: 'GST-related query' }
    },
    required: ['quarter', 'query']
  }
}];

// Tool handler
async handleSearchTemporalGST(input: { quarter: string; query: string }) {
  return await this.cogneeTools.search(
    input.query,
    `${this.userId}_transactions`,
    'TEMPORAL',
    { node_name: [input.quarter] }
  );
}
```

### 17.6 Temporal Graph Structure

```text
                    ┌─────────┐
                    │  FY2025  │
                    └────┬────┘
          ┌──────────┬───┴───┬──────────┐
     ┌────▼───┐ ┌───▼────┐ ┌▼───────┐ ┌▼───────┐
     │Q1 Jul- │ │Q2 Oct- │ │Q3 Jan- │ │Q4 Apr- │
     │Sep 2024│ │Dec 2024│ │Mar 2025│ │Jun 2025│
     └───┬────┘ └───┬────┘ └───┬────┘ └───┬────┘
         │          │          │          │
    [occurred_in]  [occurred_in]          │
         │          │                     │
    ┌────▼────┐ ┌──▼──────┐         ┌───▼─────┐
    │Txn: Rent│ │Txn: Fuel│   ...   │Txn: Wage│
    │$2,200   │ │$85.50   │         │$3,500   │
    └─────────┘ └─────────┘         └─────────┘
```

---

## 18. Session & Memory Architecture

> Per-user conversational memory using Cognee sessions, enabling natural follow-up questions and cross-agent context sharing.

### 18.1 Session Concepts

From `guides-sessions.md` and `core-concepts-sessions-and-caching.md`:

- **Session**: A conversational context identified by `session_id`, storing query-response pairs
- **Cache Adapter**: Backend storage for session data (Redis for production, Filesystem for dev)
- **Session Scope**: Sessions are per-user, per-conversation — not shared between users
- **Session Lifetime**: Configurable TTL; financial chat sessions should expire after 24 hours of inactivity

### 18.2 Session ID Convention

```text
Format: user_{userId}_chat_{chatSessionId}

Examples:
  user_abc123_chat_550e8400    — User abc123's chat session
  user_abc123_chat_6ba7b810    — Same user, different conversation
  user_def456_chat_550e8400    — Different user (isolated)
```

### 18.3 Cache Adapter Configuration

```python
# Production: Redis cache adapter
import cognee
cognee.config.set_cache_config({
    "adapter": "redis",
    "redis_url": "redis://redis:6379/0",
    "ttl": 86400  # 24 hours
})

# Development: Filesystem cache adapter
cognee.config.set_cache_config({
    "adapter": "filesystem",
    "cache_dir": "./.cognee_cache",
    "ttl": 3600  # 1 hour for dev
})
```

```yaml
# docker-compose.yml — Redis for session cache
redis:
  image: redis:7-alpine
  ports:
    - "6379:6379"
  volumes:
    - redis_data:/data
  command: redis-server --appendonly yes

cognee:
  environment:
    CACHE_ADAPTER: redis
    REDIS_URL: redis://redis:6379/0
```

### 18.4 Session-Aware Search

```python
# First query in a conversation
results = await cognee.search(
    search_type="GRAPH_COMPLETION",
    query="What were my biggest expenses last quarter?",
    datasets=["user_abc_transactions"],
    session_id="user_abc_chat_550e8400",
    save_interaction=True
)
# Response: "Your biggest expenses were: Rent ($6,600), COGS ($4,200), Wages ($10,500)"

# Follow-up query — session provides context
results = await cognee.search(
    search_type="GRAPH_COMPLETION",
    query="Break down the COGS by merchant",  # ← Knows "COGS" refers to previous answer
    datasets=["user_abc_transactions"],
    session_id="user_abc_chat_550e8400",  # Same session
    save_interaction=True
)
# Response: "COGS breakdown: Woolworths ($1,800), Priceline ($1,200), Afterpay purchases ($1,200)"
```

### 18.5 TypeScript Integration

```typescript
// Enhanced CogneeToolConfig with session support
interface CogneeToolConfig {
  searchTopK: number;
  indexBatchSize: number;
  datasetPrefix: string;
  userId: string;          // ← New: for multi-tenant dataset scoping
  sessionId?: string;      // ← New: for conversational memory
}

// Enhanced search method in cognee-tools.ts
async search(
  query: string,
  dataset: string,
  searchType: CogneeSearchType = 'GRAPH_COMPLETION',
  options?: {
    sessionId?: string;
    saveInteraction?: boolean;
    onlyContext?: boolean;
    nodeNames?: string[];
  }
): Promise<SearchResult[]> {
  const prefixedDataset = this.prefixDataset(dataset);
  return await this.cogneeClient.searchRich(query, prefixedDataset, searchType, {
    session_id: options?.sessionId ?? this.config.sessionId,
    save_interaction: options?.saveInteraction ?? false,
    only_context: options?.onlyContext ?? false,
    node_name: options?.nodeNames
  });
}
```

### 18.6 Cross-Agent Memory Sharing

Agents within the same user session can share context:

```text
User: "Parse this statement"
  → StatementParserAgent (session: user_abc_chat_001)
    → Stores: "Parsed 47 transactions from CBA statement, period Jan-Mar 2025"

User: "Categorize the transactions"
  → TransactionCategorizerAgent (session: user_abc_chat_001)  ← Same session
    → Retrieves: Previous parsing context
    → Knows: 47 transactions, CBA, Jan-Mar 2025

User: "Calculate GST for this quarter"
  → GSTCalculatorAgent (session: user_abc_chat_001)  ← Same session
    → Retrieves: Parsing + categorization context
    → Knows: Q3 FY2025, categories already assigned
```

### 18.7 Session Cleanup

```typescript
// Periodic cleanup of expired sessions
async cleanupExpiredSessions(): Promise<void> {
  // Redis handles TTL-based expiration automatically
  // For filesystem cache, run periodic cleanup:
  const expiredSessions = await this.cogneeClient.listSessions({
    olderThan: Date.now() - 24 * 60 * 60 * 1000  // 24 hours
  });
  for (const session of expiredSessions) {
    await this.cogneeClient.deleteSession(session.id);
  }
}
```

---

## 19. Memify Strategy

> Using Cognee's `memify()` to derive higher-order facts from the knowledge graph — spending rules, merchant associations, GST patterns, and categorization heuristics that the system "learns" from accumulated data.

### 19.1 What is Memify?

From `core-concepts-memify.md`:

> `memify()` is a post-cognify enrichment step that creates **derived facts** from existing graph structures. It analyzes patterns across nodes and edges to produce new knowledge that wasn't explicitly stated in the source data.

```python
import cognee

# Step 1: Data is already cognified
await cognee.cognify(datasets=["user_abc_transactions"])

# Step 2: Memify derives patterns from the graph
await cognee.memify(datasets=["user_abc_transactions"])

# Step 3: Query derived rules
rules = await cognee.search(
    search_type="CODING_RULES",
    query="categorization rules for this user",
    datasets=["user_abc_transactions"]
)
```

### 19.2 Financial Derived Facts

Memify analyzes the transaction graph and produces rules like:

| Derived Fact | Source Pattern | Confidence |
|---|---|---|
| "Woolworths → Groceries & Supermarket, always GST" | 47 transactions, all categorized as Groceries, all taxable_10 | 0.98 |
| "Shell → Fuel & Vehicle, always GST" | 12 transactions, all Fuel, all taxable_10 | 0.95 |
| "NAB LOAN → Loan Repayment, BAS excluded" | 6 transactions, all Loan Repayment, all bas_excluded | 0.92 |
| "Rent is paid monthly, ~$2,200" | 6 transactions, monthly frequency, $2,200 ± $0 | 0.99 |
| "Afterpay purchases are typically COGS" | 15 transactions, 13 categorized as COGS | 0.87 |
| "Bank fees are input-taxed (no GST credit)" | 8 transactions, all input_taxed | 0.95 |

### 19.3 Using Derived Rules in Agents

```typescript
// In TransactionCategorizerAgent — check derived rules before AI reasoning
async categorizeWithRules(transaction: Transaction): Promise<Categorization> {
  // 1. Check memify-derived rules (fastest, no LLM)
  const rules = await this.cogneeTools.search(
    transaction.description,
    `${this.userId}_transactions`,
    'CODING_RULES',
    { onlyContext: true }
  );

  if (rules.length > 0 && rules[0].confidence > 0.9) {
    return {
      category: rules[0].category,
      gstCategory: rules[0].gstCategory,
      confidence: rules[0].confidence,
      source: 'memify_rule'
    };
  }

  // 2. Fall back to merchant memory, feedback, then AI (see Section 15.4)
  return await this.categorizeTransaction(transaction);
}
```

### 19.4 Memify Schedule

Memify is computationally expensive — run it periodically, not on every transaction:

| Trigger | Frequency | Scope |
|---|---|---|
| After bulk statement upload | On-demand | User's transaction dataset |
| Nightly batch job | Daily at 2 AM AEST | All active users |
| After 50+ new transactions | Threshold-based | User's transaction dataset |
| User requests "learn from my data" | On-demand | User's full dataset |

```typescript
// In orchestrator.ts — trigger memify after bulk processing
async processStatement(input: StatementParserInput): Promise<void> {
  const parsed = await this.invoke('statement_parser', input);
  const categorized = await this.invoke('transaction_categorizer', parsed);
  const gstCalculated = await this.invoke('gst_calculator', categorized);

  // After full pipeline, trigger memify to learn patterns
  if (parsed.transactions.length > 20) {
    await this.cogneeClient.memify(input.userId, input.dataset);
  }
}
```

### 19.5 Memify + Feedback Synergy

Memify and the feedback loop (Section 15) work together:

```text
1. User uploads statement → cognify → initial categorization (AI, confidence 0.5)
2. User corrects 5 transactions → save_interaction (feedback store)
3. Memify runs → analyzes corrections + existing patterns → derives rules
4. Next statement upload → CODING_RULES search finds derived rules → auto-categorize (confidence 0.9+)
5. User confirms (no corrections) → confidence increases → rule becomes permanent
```

This creates a **virtuous cycle**: more data → better rules → fewer corrections → higher confidence → less LLM usage → lower cost.

---

## 20. Implementation Roadmap

> Phased plan for implementing advanced Cognee features, ordered by priority, dependency, and business impact.

### 20.1 Phase 1 — Foundation (P0, Weeks 1-3)

**Goal**: Multi-tenant data isolation and structured financial entities in the knowledge graph.

| Task | Files Changed | Effort | Dependencies |
|---|---|---|---|
| Enable `ENABLE_BACKEND_ACCESS_CONTROL=true` | `docker-compose.yml` | 1 day | None |
| Switch graph store from Kuzu to Neo4j | `docker-compose.yml`, Cognee env vars | 1 day | None |
| Add `FEEDBACK` to `CogneeSearchType` union | `cognee_client.ts:29-43` | 1 hour | None |
| Add `node_set` support to `add()` | `cognee_client.ts:515-535` | 2 hours | None |
| Add `session_id`, `save_interaction`, `only_context` to `searchRich()` | `cognee_client.ts:555-587` | 4 hours | None |
| Add `temporal_cognify`, `incremental_loading` to `cognify()` | `cognee_client.ts:347-384` | 2 hours | None |
| Add `userId` to `CogneeToolConfig` | `cognee-tools.ts:5-18` | 1 hour | None |
| Dynamic dataset prefix from user context | `cognee-tools.ts:14` | 2 hours | userId in config |
| Create Python DataPoint models (Section 12) | New: `cognee-repo/models/financial.py` | 2 days | None |
| User registration → Cognee user creation flow | `cognee_client.ts` (new method) | 1 day | EBAC enabled |
| Add `addDataPoints()` REST method | `cognee_client.ts` (new method) | 4 hours | DataPoint models |

**Phase 1 Deliverables**:

- ✅ Multi-tenant data isolation working
- ✅ Per-user dataset namespacing
- ✅ Custom financial DataPoints in graph
- ✅ Enhanced search with sessions, feedback, temporal support

### 20.2 Phase 2 — Intelligence (P1, Weeks 4-6)

**Goal**: Feedback loop, temporal awareness, and session-based conversational memory.

| Task | Files Changed | Effort | Dependencies |
|---|---|---|---|
| Add Redis to docker-compose for session cache | `docker-compose.yml` | 2 hours | None |
| Implement `saveCorrection()` method | `cognee_client.ts` (new method) | 4 hours | Phase 1 search enhancements |
| Add `check_past_corrections` tool to TransactionCategorizerAgent | `transaction-categorizer.ts` | 1 day | saveCorrection |
| Implement two-phase search in `cognee-tools.ts` | `cognee-tools.ts` (new method) | 4 hours | Phase 1 search |
| Add `search_temporal_gst` tool to GSTCalculatorAgent | `gst-calculator.ts` | 1 day | temporal_cognify |
| Enable `incremental_loading=True` for re-uploads | `cognee_client.ts` cognify method | 2 hours | Phase 1 |
| Add NodeSet tagging for financial periods | `cognee_client.ts` add method | 4 hours | node_set support |
| Implement session-aware search in all agents | All 8 agent files | 2 days | Redis, session support |
| Confidence score tracking per merchant | `cognee_client.ts`, `transaction-categorizer.ts` | 1 day | Feedback system |
| Add `save_interaction=True` to GST calculations | `gst-calculator.ts` | 2 hours | Phase 1 search |

**Phase 2 Deliverables**:

- ✅ System learns from user corrections
- ✅ Time-aware queries for BAS quarters
- ✅ Conversational memory in agent chat
- ✅ Incremental processing (60-80% faster re-uploads)

### 20.3 Phase 3 — Advanced (P2, Weeks 7-10)

**Goal**: Ontology grounding, memify-derived rules, and advanced pipelines.

| Task | Files Changed | Effort | Dependencies |
|---|---|---|---|
| Create Australian Financial Ontology (OWL file) | New: `ontologies/goldledger-financial.owl` | 3 days | None |
| Integrate ontology with cognify | Cognee config, `cognee_client.ts` | 1 day | OWL file |
| Implement `memify()` REST endpoint call | `cognee_client.ts` (new method) | 4 hours | None |
| Add memify trigger after bulk processing | `orchestrator.ts` | 2 hours | memify method |
| Implement `CODING_RULES` search in categorizer | `transaction-categorizer.ts` | 4 hours | memify |
| Create merchant resolution pipeline (Python) | New: `cognee-repo/pipelines/merchant.py` | 2 days | DataPoint models |
| Create pattern learning pipeline (Python) | New: `cognee-repo/pipelines/learning.py` | 2 days | Feedback system |
| Register custom pipelines in MCP server | `cognee-repo/cognee-mcp/src/server.py` | 1 day | Pipelines |
| Add `GRAPH_COMPLETION_COT` to CrossAccountTracerAgent | `cross-account-tracer.ts` (if exists) | 4 hours | Phase 1 search |
| Dataset Database Handlers for enterprise isolation | Cognee config, Neo4j setup | 2 days | Neo4j running |

**Phase 3 Deliverables**:

- ✅ Ontology-grounded entities (canonical vocabulary)
- ✅ Auto-derived categorization rules (memify)
- ✅ Custom financial pipelines
- ✅ Enterprise-grade database isolation

### 20.4 Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Neo4j migration breaks existing graph data | Medium | High | Export/import with Cognee's built-in migration tools; test in staging first |
| EBAC breaks existing single-user workflows | Low | High | Feature flag: `MULTI_TENANT_ENABLED` env var; gradual rollout |
| Memify produces incorrect rules | Medium | Medium | Confidence threshold (>0.9) before auto-applying; human review for new rules |
| Redis session data loss | Low | Low | Redis AOF persistence; sessions are ephemeral by design |
| Ontology maintenance overhead | Medium | Low | Start with minimal ontology; expand based on actual entity extraction errors |
| LLM cost increase from new search types | Medium | Medium | Two-phase search pattern; `only_context=True` for agent tools; token budgets |

---

## 21. ROI Analysis

> Quantified return on investment for each implementation phase — accuracy gains, speed improvements, cost savings, and infrastructure costs.

### 21.1 Current State Baseline

| Metric | Current Value | Source |
| --- | --- | --- |
| Transaction categorization accuracy | ~60-70% | AI-only, no memory, no feedback |
| GST classification accuracy | ~75% | Rule-based + AI, no ontology grounding |
| Average categorization latency | ~2-4 seconds | LLM call per transaction |
| LLM calls per transaction | 1.0 | Every transaction requires AI reasoning |
| Manual corrections per 100 transactions | ~30-40 | No learning from past corrections |
| Re-upload processing time | 100% (full reprocess) | No incremental loading |
| Multi-user support | None | Single-tenant, single-user |

### 21.2 Phase 1 ROI — Foundation (Weeks 1-3)

**Investment**: ~2 weeks developer effort + Neo4j infrastructure (~$50/month)

| Metric | Before | After Phase 1 | Improvement |
| --- | --- | --- | --- |
| Multi-user support | None | Full isolation | ∞ (new capability) |
| Data isolation | None | Per-user datasets + EBAC | ∞ (new capability) |
| Categorization accuracy | 60-70% | 70-80% | +10-15% (merchant memory) |
| Graph query richness | Basic text search | 14 search types available | 14× more query options |
| Custom entity types | Generic text chunks | 5 financial DataPoint models | Structured financial graph |

**Phase 1 Monthly Cost**:

| Component | Cost |
| --- | --- |
| Neo4j (managed, starter) | $65/month |
| PGVector (existing PostgreSQL) | $0 (included) |
| Developer time (one-off) | ~80 hours |
| **Total recurring** | **~$65/month** |

### 21.3 Phase 2 ROI — Intelligence (Weeks 4-6)

**Investment**: ~3 weeks developer effort + Redis (~$15/month)

| Metric | After Phase 1 | After Phase 2 | Improvement |
| --- | --- | --- | --- |
| Categorization accuracy | 70-80% | 85-92% | +12-15% (feedback loop) |
| GST classification accuracy | 75% | 88-93% | +13-18% (temporal + feedback) |
| Manual corrections per 100 txns | 20-30 | 8-15 | 50-60% reduction |
| LLM calls per transaction | 1.0 | 0.4-0.6 | 40-60% reduction |
| Re-upload processing time | 100% | 20-40% | 60-80% faster |
| Conversational context | None | Full session memory | New capability |
| BAS quarter queries | Manual date filtering | Automatic temporal search | New capability |

**Phase 2 Monthly Cost**:

| Component | Cost |
| --- | --- |
| Redis (session cache) | $15/month |
| Reduced LLM usage (40-60% fewer calls) | -$30 to -$60/month savings |
| Developer time (one-off) | ~120 hours |
| **Net recurring change** | **-$15 to -$45/month** (net savings) |

### 21.4 Phase 3 ROI — Advanced (Weeks 7-10)

**Investment**: ~4 weeks developer effort + ontology maintenance

| Metric | After Phase 2 | After Phase 3 | Improvement |
| --- | --- | --- | --- |
| Categorization accuracy | 85-92% | 95-98% | +5-10% (memify rules + ontology) |
| GST classification accuracy | 88-93% | 96-99% | +6-8% (ontology grounding) |
| Manual corrections per 100 txns | 8-15 | 2-5 | 67-75% further reduction |
| LLM calls per transaction | 0.4-0.6 | 0.1-0.3 | 50-70% further reduction |
| Auto-categorization rate | 40-60% | 85-95% | Memify-derived rules |
| New merchant resolution | AI guess | Pipeline + graph lookup | Structured, auditable |
| Cross-user vocabulary | Inconsistent | Canonical ontology | Standardized |

**Phase 3 Monthly Cost**:

| Component | Cost |
| --- | --- |
| Ontology maintenance | ~4 hours/quarter |
| Further reduced LLM usage | -$20 to -$40/month additional savings |
| Custom pipeline compute | ~$10/month |
| Developer time (one-off) | ~160 hours |
| **Net recurring change** | **-$10 to -$30/month** (further savings) |

### 21.5 Cumulative ROI Summary

| Metric | Current | After All Phases | Total Improvement |
| --- | --- | --- | --- |
| **Categorization accuracy** | 60-70% | 95-98% | +28-38 percentage points |
| **GST accuracy** | 75% | 96-99% | +21-24 percentage points |
| **Manual corrections / 100 txns** | 30-40 | 2-5 | 88-95% reduction |
| **LLM calls per transaction** | 1.0 | 0.1-0.3 | 70-90% reduction |
| **Processing speed (re-upload)** | 100% | 20-40% | 60-80% faster |
| **Multi-tenant support** | None | Full EBAC isolation | New capability |
| **Conversational memory** | None | Session-based | New capability |
| **Temporal intelligence** | None | BAS quarter-aware | New capability |

### 21.6 Cost-Benefit Analysis (10-User Scenario)

**Monthly Infrastructure Costs (All Phases Complete)**:

| Component | Monthly Cost |
| --- | --- |
| Neo4j (managed) | $65 |
| Redis (session cache) | $15 |
| PostgreSQL + PGVector (existing) | $0 |
| Custom pipeline compute | $10 |
| **Total infrastructure** | **$90/month** |

**Monthly LLM Cost Savings (10 users, ~500 txns/user/month)**:

| Scenario | LLM Calls/Month | Cost @ $0.003/call | Savings |
| --- | --- | --- | --- |
| Current (1.0 calls/txn) | 5,000 | $15.00 | — |
| After all phases (0.2 calls/txn) | 1,000 | $3.00 | $12.00/month |

**Break-Even Analysis**:

| Item | Value |
| --- | --- |
| Total developer investment | ~360 hours (~$36,000 at $100/hr) |
| Monthly infrastructure cost | $90 |
| Monthly LLM savings | $12 |
| Monthly value of accuracy improvement | $200-500 (reduced manual review time) |
| Monthly value of multi-tenant | $500-2,000 (enables SaaS revenue) |
| **Estimated break-even** | **3-6 months after launch** |

### 21.7 Key ROI Drivers

1. **Memify + Feedback Loop** — The single highest-ROI feature. Each correction makes the system permanently smarter, compounding over time. After 3 months of usage, expect 90%+ auto-categorization with no LLM calls.

2. **Two-Phase Search** — Reduces average search latency from ~2s (graph completion) to ~200ms (lexical hit) for 70%+ of queries, with graph fallback only when needed.

3. **Incremental Loading** — Eliminates redundant processing. A user re-uploading a statement with 5 new transactions processes only those 5, not all 200.

4. **Ontology Grounding** — Eliminates the "vocabulary drift" problem where the same merchant gets categorized differently across sessions. Canonical vocabulary ensures consistency.

5. **Multi-Tenant Isolation** — Transforms from a single-user tool to a SaaS platform. The infrastructure cost per additional user is near-zero (shared Neo4j + PGVector with dataset-level isolation).

---

## 22. Australian Tax Optimization Engine

> Multi-entity tax strategy, ATO-compliant deduction maximization, personal tax claims detection, and financial planning — all running on local Docker infrastructure.

> **📊 Implementation Status: ✅ IMPLEMENTED by Agent 1 (tax-agents-builder)**
>
> | Aspect | Status | File(s) |
> |--------|--------|---------|
> | Tax Return Engine | ✅ Created | `server/src/services/tax-return.ts` — 5 entity-specific calculators (sole trader, personal, company, trust, partnership) |
> | Tax Optimizer | ✅ Created | `server/src/services/tax-optimizer.ts` — 10 built-in strategy templates |
> | TaxStrategyAgent | ✅ Created | `server/src/services/claude/agents/tax-strategy.ts` (Sonnet 4.5, 100K input, 15 tools) |
> | PersonalTaxClaimsAgent | ✅ Created | `server/src/services/claude/agents/personal-tax-claims.ts` (Haiku 4.5, 50K input) |
> | FinancialPlannerAgent | ✅ Created | `server/src/services/claude/agents/financial-planner.ts` (Sonnet 4.5, 50K input) |
> | Agent Registration | ✅ Updated | `types.ts` AgentType union + `config.ts` token budgets (11 agents total) |
>
> **Completed**: Agent 1 created 5 files and modified `types.ts` and `config.ts`. Follows `payroll-agent.ts` pattern. Schema migration `0012_tax_return_platform.sql` created by Agent 2.

### 22.1 Multi-Entity Tax Strategy Agent

Create `TaxStrategyAgent` (`server/src/services/claude/agents/tax-strategy.ts`) extending `ClaudeAgent<TaxStrategyInput, TaxStrategyOutput>`.

**Supported Entity Types**:

| Entity Type | Tax Rate | Key Features |
| --- | --- | --- |
| **Individual** | Marginal rates (0-45%) + Medicare 2% | Personal deductions, offsets, HELP/HECS |
| **Company (Base Rate)** | 25% (aggregated turnover <$50M) | Franking credits, Division 7A loans |
| **Company (Standard)** | 30% | Full corporate rate, no base rate concessions |
| **Family Trust** | Distributed at beneficiary rates | Streaming rules, capital gains, franked dividends |
| **Unit Trust** | Distributed at unit holder rates | Fixed entitlements, CGT discount flow-through |
| **Partnership** | Distributed at partner rates | Distribution statements, partner salary |
| **SMSF (Accumulation)** | 15% | Contribution caps ($30K concessional, $120K non-concessional) |
| **SMSF (Pension)** | 0% | Pension phase, minimum drawdown requirements |

**Agent Registration** (additions to existing codebase):

```typescript
// types.ts — Add to AgentType union (line 10-18)
export type AgentType =
  | 'statement_parser'
  | 'transaction_categorizer'
  | 'gst_calculator'
  | 'account_reconciler'
  | 'budget_analyzer'
  | 'cross_account_tracer'
  | 'merchant_intelligence'
  | 'payroll_agent'
  | 'tax_strategy'          // ← NEW
  | 'personal_tax_claims'   // ← NEW
  | 'financial_planner';    // ← NEW

// config.ts — Add to AGENT_TOKEN_BUDGETS
tax_strategy: {
  maxInputTokens: 100_000,  // Complex multi-entity reasoning
  maxOutputTokens: 16_000,  // Detailed strategy reports
  maxToolCalls: 15,
  warningThresholdPercent: 80,
},
personal_tax_claims: {
  maxInputTokens: 50_000,
  maxOutputTokens: 8_000,
  maxToolCalls: 10,
  warningThresholdPercent: 80,
},
financial_planner: {
  maxInputTokens: 50_000,
  maxOutputTokens: 12_000,
  maxToolCalls: 12,
  warningThresholdPercent: 80,
},

// config.ts — Add to AGENT_MODELS
tax_strategy: 'claude-sonnet-4-5-20250929',       // Accuracy-critical
personal_tax_claims: 'claude-haiku-4-5-20251001',  // High-volume scanning
financial_planner: 'claude-sonnet-4-5-20250929',   // Complex projections
```

**TaxStrategyAgent Tools**:

| Tool | Description | Cognee Search Type |
| --- | --- | --- |
| `search_ato_rulings` | Query ATO public rulings, tax determinations, practice statements | `GRAPH_COMPLETION` |
| `calculate_entity_tax` | Compute tax liability with marginal rates, offsets, levies | Local computation |
| `identify_deduction_opportunities` | Scan transactions for missed deductions | `CHUNKS_LEXICAL` → `GRAPH_COMPLETION` |
| `optimize_structure` | Suggest entity structure changes for tax splitting | `GRAPH_COMPLETION_COT` |
| `calculate_cgt_strategies` | CGT optimization (50% discount, SBC, rollover relief) | `GRAPH_COMPLETION` |
| `check_division_7a` | Detect Division 7A loan compliance issues | `CYPHER` |

### 22.2 ATO Tax Brackets (FY 2024-25 & 2025-26)

```typescript
// Individual tax brackets — FY 2024-25 (Stage 3 tax cuts applied)
const INDIVIDUAL_TAX_BRACKETS_FY2025 = [
  { min: 0,       max: 18_200,   rate: 0,     base: 0 },
  { min: 18_201,  max: 45_000,   rate: 0.16,  base: 0 },
  { min: 45_001,  max: 135_000,  rate: 0.30,  base: 4_288 },
  { min: 135_001, max: 190_000,  rate: 0.37,  base: 31_288 },
  { min: 190_001, max: Infinity, rate: 0.45,  base: 51_638 },
];

// FY 2025-26 (same as 2024-25 unless legislated otherwise)
const INDIVIDUAL_TAX_BRACKETS_FY2026 = INDIVIDUAL_TAX_BRACKETS_FY2025;

// Medicare levy: 2% of taxable income (above threshold)
const MEDICARE_LEVY = {
  rate: 0.02,
  thresholds: {
    'FY2024-25': { single: 26_000, family: 43_846, perChild: 4_027 },
    'FY2025-26': { single: 27_222, family: 45_907, perChild: 4_216 },
  }
};

// Company tax rates
const COMPANY_TAX_RATES = {
  base_rate_entity: 0.25,  // Aggregated turnover < $50M + ≤80% passive income
  standard: 0.30,
};

// SMSF tax rates
const SMSF_TAX_RATES = {
  accumulation: 0.15,
  pension: 0.00,
  cgt_discount: 1/3,  // 33.33% discount (not 50% like individuals)
};

// Capital Gains Tax
const CGT_RULES = {
  individual_discount: 0.50,     // 50% discount for assets held >12 months
  smsf_discount: 1/3,           // 33.33% discount
  company_discount: 0,           // No CGT discount for companies
  trust_discount: 0.50,          // Flows through to individual beneficiaries
  small_business_concessions: {
    active_asset_reduction: 0.50, // 50% active asset reduction
    retirement_exemption: 500_000, // Lifetime cap
    rollover_period_years: 2,
    fifteen_year_exemption: true,  // Complete exemption if held 15+ years
  }
};
```

### 22.3 Personal Tax Claims Maximization

Create `PersonalTaxClaimsAgent` (`server/src/services/claude/agents/personal-tax-claims.ts`) — scans all transactions and identifies claimable deductions.

**Deduction Categories Detected**:

| Category | Detection Pattern | ATO Substantiation |
| --- | --- | --- |
| **Work-related car** | Fuel, tolls, parking near work locations | Logbook (5,000+ km) or cents/km (≤5,000 km @ $0.88/km FY25) |
| **Work-related travel** | Flights, hotels, meals during work travel | Receipts + travel diary (6+ consecutive nights) |
| **Work-related clothing** | Uniforms, protective gear, laundry | Receipts; laundry ≤$150 no receipts needed |
| **Self-education** | Course fees, textbooks, stationery | Must relate to current employment |
| **Home office** | Internet, electricity, furniture, phone | Fixed rate $0.67/hr (FY25) or actual cost method |
| **Investment interest** | Loan interest on investment properties/shares | Loan statements, must be income-producing |
| **Rental property** | Repairs, insurance, management fees, depreciation | Receipts + depreciation schedule |
| **Charitable donations** | Donations to DGR-endorsed charities | Receipts for donations ≥$2 |
| **Income protection** | Insurance premiums | Policy documents |
| **Professional subscriptions** | Industry memberships, journals | Receipts |

**Database Schema Addition**:

```sql
-- Add claim_type to transactions table
ALTER TABLE transactions ADD COLUMN claim_type VARCHAR(50);
-- Values: 'work_related', 'investment', 'home_office', 'self_education',
--         'charitable', 'medical', 'income_protection', 'rental_property', NULL

ALTER TABLE transactions ADD COLUMN claim_amount DECIMAL(12,2);
ALTER TABLE transactions ADD COLUMN claim_method VARCHAR(30);
-- Values: 'logbook', 'cents_per_km', 'fixed_rate', 'actual_cost', NULL

ALTER TABLE transactions ADD COLUMN substantiation_status VARCHAR(20) DEFAULT 'pending';
-- Values: 'pending', 'substantiated', 'needs_receipt', 'ineligible'
```

**Agent Tool — Transaction Scanning**:

```typescript
// PersonalTaxClaimsAgent tool handler
async handleIdentifyDeductions(input: { financialYear: string }): Promise<DeductionReport> {
  // 1. Fetch all transactions for the FY
  const transactions = await this.db.getTransactionsByFY(input.financialYear);

  // 2. Search Cognee for ATO deduction rules
  const rules = await this.cogneeTools.search(
    'ATO deduction rules for individuals',
    `ato_rulings`,
    'GRAPH_COMPLETION',
    { onlyContext: true }
  );

  // 3. Scan each transaction against deduction patterns
  // 4. Return categorized deductions with substantiation requirements
  return {
    totalClaimable: 4_850.00,
    categories: [
      { type: 'home_office', amount: 2_010.00, method: 'fixed_rate', hours: 3000 },
      { type: 'work_related_car', amount: 1_540.00, method: 'cents_per_km', km: 1750 },
      { type: 'self_education', amount: 800.00, receipts: 'required' },
      { type: 'charitable', amount: 500.00, receipts: 'available' },
    ],
    needsSubstantiation: ['self_education'],
    disclaimer: 'General tax information only. Consult a registered tax agent.'
  };
}
```

### 22.4 Budget & Savings Strategy Engine

Create `FinancialPlannerAgent` (`server/src/services/claude/agents/financial-planner.ts`).

**Capabilities**:

| Feature | Description | Data Source |
| --- | --- | --- |
| Cash flow analysis | Income vs expenses, surplus/deficit | Transaction history |
| Budget generation | Personalized budgets by category | Spending patterns + goals |
| Emergency fund target | 3-6 months of essential expenses | Expense categorization |
| Debt repayment strategy | Avalanche (highest interest) vs snowball (smallest balance) | Loan transactions |
| Investment allocation | Risk-profiled recommendations (conservative/balanced/growth) | Income surplus |
| Wealth projection | 5/10/20 year compound growth models | Current savings rate |

**Tools**:

```typescript
const financialPlannerTools = [
  {
    name: 'analyze_cash_flow',
    description: 'Analyze income vs expenses over a period, identify surplus/deficit',
    input_schema: {
      type: 'object',
      properties: {
        period: { type: 'string', description: 'e.g. "last_3_months", "FY2025"' },
        userId: { type: 'string' }
      },
      required: ['period', 'userId']
    }
  },
  {
    name: 'recommend_savings_allocation',
    description: 'Recommend how to allocate surplus: emergency fund → debt → investments',
    input_schema: {
      type: 'object',
      properties: {
        monthlySurplus: { type: 'number' },
        existingEmergencyFund: { type: 'number' },
        debts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              balance: { type: 'number' },
              interestRate: { type: 'number' },
              minimumPayment: { type: 'number' }
            }
          }
        }
      },
      required: ['monthlySurplus']
    }
  },
  {
    name: 'calculate_compound_growth',
    description: 'Model investment returns over time with configurable risk profiles',
    input_schema: {
      type: 'object',
      properties: {
        initialAmount: { type: 'number' },
        monthlyContribution: { type: 'number' },
        years: { type: 'number' },
        riskProfile: { type: 'string', enum: ['conservative', 'balanced', 'growth', 'aggressive'] }
      },
      required: ['initialAmount', 'monthlyContribution', 'years', 'riskProfile']
    }
  },
  {
    name: 'optimize_debt_repayment',
    description: 'Calculate optimal debt repayment order (avalanche vs snowball)',
    input_schema: {
      type: 'object',
      properties: {
        strategy: { type: 'string', enum: ['avalanche', 'snowball'] },
        extraMonthlyPayment: { type: 'number' },
        debts: { type: 'array' }
      },
      required: ['strategy', 'debts']
    }
  }
];
```

**Expected Return Assumptions** (used in projections):

| Risk Profile | Annual Return | Volatility | Typical Allocation |
| --- | --- | --- | --- |
| Conservative | 4-5% | Low | 70% bonds, 20% shares, 10% cash |
| Balanced | 6-7% | Medium | 40% bonds, 50% shares, 10% property |
| Growth | 8-10% | High | 10% bonds, 70% shares, 20% property |
| Aggressive | 10-12% | Very High | 0% bonds, 80% shares, 10% property, 10% alternatives |

### 22.5 Cognee ATO Rulings Dataset

Seed Cognee with ATO public rulings for knowledge graph-powered tax advice:

```python
import cognee

# Seed ATO rulings into Cognee (one-time, update quarterly)
ato_sources = [
    "ato_public_rulings/*.pdf",       # TR 2024/1, TR 2024/2, etc.
    "ato_tax_determinations/*.pdf",    # TD 2024/1, etc.
    "ato_practice_statements/*.pdf",   # PS LA 2024/1, etc.
    "ato_fact_sheets/*.txt",           # Simplified guidance
]

for source in ato_sources:
    await cognee.add(
        data=source,
        dataset_name="ato_rulings",
        node_set=["ato", "tax_law", "australia"]
    )

# Cognify with financial ontology for entity grounding
await cognee.cognify(
    datasets=["ato_rulings"],
    ontology_file_path="./ontologies/goldledger-financial.owl",
    custom_prompt="""Extract: ruling IDs, entity types (individual/company/trust/SMSF),
    deduction categories, conditions, thresholds, effective dates, and cross-references
    to other rulings. Preserve exact dollar amounts and percentage rates."""
)

# Memify to derive cross-ruling patterns
await cognee.memify(datasets=["ato_rulings"])
```

**ATO Ruling DataPoint Model**:

```python
from cognee.infrastructure.engine import DataPoint

class ATORulingDataPoint(DataPoint):
    ruling_id: str           # e.g. "TR 2024/1"
    ruling_type: str         # "public_ruling", "tax_determination", "practice_statement"
    entity_types: list[str]  # ["individual", "company", "trust"]
    topic: str               # "home_office_deductions"
    effective_from: str      # "2024-07-01"
    effective_to: str        # "ongoing" or specific date
    key_thresholds: dict     # {"fixed_rate_per_hour": 0.67, "max_hours": null}
    conditions: list[str]    # ["Must have dedicated workspace", "Records required"]
    supersedes: str | None   # Previous ruling ID if applicable

    class Config:
        metadata = {"index_fields": ["ruling_id", "topic", "entity_types"]}
```

### 22.6 Docker Infrastructure for Tax Services

All tax optimization services run locally in Docker:

```yaml
# docker-compose.yml — additions for tax optimization
services:
  # ATO rulings scraper (runs on schedule)
  ato-scraper:
    build:
      context: ./services/ato-scraper
      dockerfile: Dockerfile
    container_name: cba-ato-scraper
    environment:
      - COGNEE_API_URL=http://cognee:8000
      - SCRAPE_SCHEDULE=0 0 1 */3 *  # Quarterly on 1st of month
    volumes:
      - ato-rulings-data:/data/rulings
    networks:
      - cba-network
    depends_on:
      cognee:
        condition: service_healthy

volumes:
  ato-rulings-data:
    driver: local
```

**Scraper Architecture**:

```text
┌─────────────────────────────────────────────────────┐
│                  Local Docker Stack                   │
│                                                       │
│  ┌──────────────┐    ┌──────────────┐                │
│  │ ATO Scraper  │───▶│   Cognee     │                │
│  │ (quarterly)  │    │ Knowledge    │                │
│  │              │    │ Graph        │                │
│  │ Sources:     │    │              │                │
│  │ • ato.gov.au │    │ Datasets:    │                │
│  │ • austlii    │    │ • ato_rulings│                │
│  │ • legislation│    │ • tax_law    │                │
│  └──────────────┘    └──────┬───────┘                │
│                             │                         │
│                    ┌────────▼────────┐                │
│                    │  Tax Strategy   │                │
│                    │  Agent (Claude) │                │
│                    │                 │                │
│                    │ Tools:          │                │
│                    │ • search_ato    │                │
│                    │ • calc_tax      │                │
│                    │ • find_deduct   │                │
│                    └─────────────────┘                │
└─────────────────────────────────────────────────────┘
```

---

## 23. Investment & Trading Intelligence

> Autonomous multi-model trading agent swarm for ASX equities, crypto, and macro analysis — with Cognee-powered market memory and all infrastructure running on local Docker.

> **📊 Implementation Status: 🔮 FUTURE (Part B) — NOT IMPLEMENTED**
>
> | Aspect | Current State | Target State |
> |--------|--------------|--------------|
> | Trading Agents | Do not exist | 5-agent swarm (MarketAnalyst, NewsIntelligence, TechnicalAnalyst, RiskManager, Execution) |
> | Market Data | No market data feeds | ASX, crypto, macro data via paid APIs |
> | Redis Message Bus | Redis added to Docker stack (by Agent 2) | Full pub/sub agent coordination |
> | Cognee Market Memory | Not configured | market_signals, trading_decisions, portfolio_state datasets |
>
> **Architecture Hooks Only**: Redis service added to Docker stack, `AgentType` union is extensible for new agent types. Trading agent swarm is documented but **NOT built** in this phase. See `docs/Curretn Claudecode plan.md` PART B (lines 790-860). Requires AFSL consideration for client fund management. Estimated 4-6 weeks additional development.

### 23.1 Autonomous Trading Agent Swarm

A **multi-model agent swarm** where each agent specializes in a different aspect of market analysis and execution. Agents communicate through a shared Cognee knowledge graph and a Redis-backed message bus.

**Agent Roster**:

| Agent | Model | Role | Token Budget | Max Tools |
| --- | --- | --- | --- | --- |
| `MarketAnalystAgent` | Claude Opus 4 | Macro analysis, sector trends, fundamental valuation | 200K input / 16K output | 20 |
| `NewsIntelligenceAgent` | Gemini 2.0 Flash Thinking | Real-time news parsing, sentiment scoring, event detection | 100K input / 8K output | 15 |
| `TechnicalAnalystAgent` | Claude Sonnet 4.5 | Chart patterns, indicators (RSI, MACD, Bollinger), support/resistance | 100K input / 12K output | 15 |
| `RiskManagerAgent` | Claude Sonnet 4.5 | Position sizing, stop-loss, portfolio risk, correlation analysis | 80K input / 8K output | 10 |
| `ExecutionAgent` | Kimi k1.5 | Order placement, execution timing, slippage minimization | 50K input / 4K output | 8 |

**Agent Registration** (additions to `types.ts`):

```typescript
// Add to AgentType union
export type AgentType =
  // ... existing agents ...
  | 'market_analyst'
  | 'news_intelligence'
  | 'technical_analyst'
  | 'risk_manager'
  | 'execution_agent';

// config.ts — AGENT_TOKEN_BUDGETS additions
market_analyst: {
  maxInputTokens: 200_000,
  maxOutputTokens: 16_000,
  maxToolCalls: 20,
  warningThresholdPercent: 80,
},
news_intelligence: {
  maxInputTokens: 100_000,
  maxOutputTokens: 8_000,
  maxToolCalls: 15,
  warningThresholdPercent: 80,
},
technical_analyst: {
  maxInputTokens: 100_000,
  maxOutputTokens: 12_000,
  maxToolCalls: 15,
  warningThresholdPercent: 80,
},
risk_manager: {
  maxInputTokens: 80_000,
  maxOutputTokens: 8_000,
  maxToolCalls: 10,
  warningThresholdPercent: 80,
},
execution_agent: {
  maxInputTokens: 50_000,
  maxOutputTokens: 4_000,
  maxToolCalls: 8,
  warningThresholdPercent: 80,
},

// config.ts — AGENT_MODELS additions (multi-model strategy)
market_analyst: 'claude-opus-4-20250514',            // Deep reasoning for macro
news_intelligence: 'gemini-2.0-flash-thinking-exp',  // Fast real-time parsing
technical_analyst: 'claude-sonnet-4-5-20250929',     // Pattern recognition
risk_manager: 'claude-sonnet-4-5-20250929',          // Risk calculations
execution_agent: 'kimi-k1.5',                        // Execution optimization
```

**Swarm Communication Pattern**:

```text
┌─────────────────────────────────────────────────────────────┐
│                    Trading Agent Swarm                        │
│                                                               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │   Market      │    │    News      │    │  Technical   │   │
│  │   Analyst     │    │ Intelligence │    │   Analyst    │   │
│  │  (Opus 4)     │    │ (Gemini 2.0) │    │ (Sonnet 4.5) │   │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘   │
│         │                   │                    │            │
│         └───────────────────┼────────────────────┘            │
│                             │                                 │
│                    ┌────────▼────────┐                        │
│                    │  Redis Message  │                        │
│                    │  Bus + Cognee   │                        │
│                    │  Knowledge Graph│                        │
│                    └────────┬────────┘                        │
│                             │                                 │
│              ┌──────────────┼──────────────┐                  │
│              │                             │                  │
│     ┌────────▼────────┐          ┌────────▼────────┐         │
│     │  Risk Manager   │          │   Execution     │         │
│     │  (Sonnet 4.5)   │──────────▶   Agent         │         │
│     │  Gate: approve/  │          │  (Kimi k1.5)   │         │
│     │  reject/resize   │          │  Place orders   │         │
│     └─────────────────┘          └─────────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

### 23.2 Data Sources & Market Integration

All data feeds run as local Docker services with scheduled ingestion into Cognee.

**Data Source Matrix**:

| Source | Type | Update Frequency | Docker Service | Cognee Dataset |
| --- | --- | --- | --- | --- |
| **ASX Market Data** | Equity prices, volumes, indices | 15-min delayed (free) or real-time (paid) | `market-data` | `asx_market` |
| **CommSec API** | Portfolio, watchlist, order execution | Real-time | `market-data` | `commsec_portfolio` |
| **CoinGecko API** | Crypto prices, market cap, volume | 5-minute intervals | `market-data` | `crypto_market` |
| **Reuters/AFP** | Financial news, corporate actions | 15-minute polling | `news-feeds` | `market_news` |
| **AFR/SMH** | Australian financial news | 30-minute polling | `news-feeds` | `au_financial_news` |
| **RBA** | Cash rate, monetary policy, statements | Daily | `news-feeds` | `rba_data` |
| **ABS** | CPI, employment, GDP, trade balance | Monthly/quarterly | `news-feeds` | `economic_indicators` |
| **ASX Announcements** | Company announcements, earnings | Real-time via RSS | `news-feeds` | `asx_announcements` |
| **Reddit/X (Twitter)** | Social sentiment, retail trends | 10-minute polling | `news-feeds` | `social_sentiment` |

**Market Data Service**:

```typescript
// services/market-data/src/index.ts
interface MarketDataConfig {
  asx: {
    apiKey: string;
    baseUrl: 'https://www.asx.com.au/asx/1/share';
    pollIntervalMs: 900_000;  // 15 minutes
    watchlist: string[];       // ['CBA.AX', 'BHP.AX', 'CSL.AX', ...]
  };
  crypto: {
    baseUrl: 'https://api.coingecko.com/api/v3';
    pollIntervalMs: 300_000;  // 5 minutes
    coins: string[];           // ['bitcoin', 'ethereum', 'solana', ...]
  };
  commsec: {
    baseUrl: 'https://api.commsec.com.au/v1';
    clientId: string;
    pollIntervalMs: 60_000;   // 1 minute for portfolio
  };
}

// Ingest into Cognee on each poll cycle
async function ingestMarketData(data: MarketSnapshot): Promise<void> {
  await cogneeClient.add(
    JSON.stringify(data),
    `${data.source}_${data.date}`,
    [data.source, 'market_data', data.date]
  );
  // Cognify only on significant events (>2% move, volume spike)
  if (data.isSignificant) {
    await cogneeClient.cognify(`${data.source}_${data.date}`);
  }
}
```

### 23.3 Cognee Integration for Trading

Store all market intelligence in Cognee's knowledge graph for cross-domain reasoning.

**Knowledge Graph Entity Relationships**:

```text
Company ──[listed_on]──▶ Exchange (ASX, NASDAQ)
   │                          │
   ├──[in_sector]──▶ Sector ──[influenced_by]──▶ Economic Indicator
   │                                                    │
   ├──[mentioned_in]──▶ News Event ──[impacts]──▶ Price Movement
   │                          │
   ├──[has_earnings]──▶ Earnings Report ──[beats/misses]──▶ Consensus
   │
   └──[correlated_with]──▶ Company (peer correlation)
```

**Cognee Dataset Strategy**:

| Dataset | Content | Cognify Strategy | Search Types Used |
| --- | --- | --- | --- |
| `asx_market` | Price/volume snapshots | Cognify on >2% moves | `TEMPORAL`, `GRAPH_COMPLETION` |
| `crypto_market` | Crypto OHLCV data | Cognify on >5% moves | `TEMPORAL`, `CHUNKS` |
| `market_news` | Reuters, AFP, AFR articles | Always cognify (entity extraction) | `RAG_COMPLETION`, `CHUNKS_LEXICAL` |
| `asx_announcements` | Company announcements | Always cognify | `GRAPH_COMPLETION`, `CYPHER` |
| `trade_history` | Executed trades + outcomes | Cognify + memify (pattern learning) | `TEMPORAL`, `FEEDBACK` |
| `social_sentiment` | Reddit/X posts | Cognify with sentiment scoring | `RAG_COMPLETION`, `CHUNKS` |
| `economic_indicators` | RBA, ABS data | Cognify with temporal tags | `TEMPORAL`, `GRAPH_COMPLETION` |

**Trading Pattern Memory (Memify)**:

```python
import cognee

# After each trade is closed (win or loss), memify the pattern
async def learn_from_trade(trade: CompletedTrade):
    # Store trade outcome
    await cognee.add(
        data=trade.to_json(),
        dataset_name="trade_history",
        node_set=["trades", trade.asset_class, trade.strategy]
    )
    await cognee.cognify(datasets=["trade_history"])

    # Memify to derive cross-trade patterns
    # e.g., "Momentum trades on BHP after RBA rate decisions have 72% win rate"
    await cognee.memify(datasets=["trade_history"])

# Query learned patterns before new trades
async def check_historical_patterns(signal: TradeSignal) -> list:
    return await cognee.search(
        query_type="TEMPORAL",
        query_text=f"Historical outcomes for {signal.strategy} on {signal.ticker} "
                   f"when {signal.catalyst}",
        datasets=["trade_history"]
    )
```

### 23.4 Trading Strategies & Risk Controls

**Strategy Matrix**:

| Strategy | Asset Class | Timeframe | Entry Signal | Exit Signal | Risk Per Trade |
| --- | --- | --- | --- | --- | --- |
| **Momentum** | ASX equities | 1-4 weeks | RSI >70 + volume spike + positive news | RSI <30 or trailing stop 8% | 2% of portfolio |
| **Mean Reversion** | ASX equities | 1-5 days | RSI <30 + no negative news | Return to 20-day SMA | 1.5% of portfolio |
| **Dividend Capture** | ASX equities | 2-5 days | 3 days before ex-div, yield >4% | 1 day after ex-div | 3% of portfolio |
| **Sector Rotation** | ASX sectors | 1-3 months | Macro shift (RBA, CPI) + sector momentum | Sector underperformance vs ASX200 | 5% of portfolio |
| **Crypto Arbitrage** | BTC, ETH, SOL | Minutes-hours | >0.5% spread across exchanges | Spread closes | 1% of portfolio |
| **Crypto Momentum** | Top 20 coins | 1-7 days | 24h volume >2x average + breakout | Trailing stop 10% | 2% of portfolio |
| **DCA (Dollar Cost Average)** | BTC, ETH | Weekly | Scheduled (every Monday) | Long-term hold | Fixed $ amount |

**Risk Controls** (enforced by `RiskManagerAgent`):

```typescript
interface RiskControls {
  // Per-trade limits
  maxPositionSizePercent: 5;        // Max 5% of portfolio in single position
  maxLossPerTradePercent: 2;        // Stop-loss at 2% portfolio value
  requiredRiskRewardRatio: 2;       // Minimum 2:1 reward:risk

  // Daily limits
  maxDailyLossPercent: 5;           // Circuit breaker: halt trading at 5% daily loss
  maxDailyTrades: 10;               // Prevent overtrading
  maxDailyExposurePercent: 30;      // Max 30% of portfolio deployed in a day

  // Portfolio limits
  maxSectorConcentration: 0.25;     // Max 25% in any single sector
  maxCorrelatedPositions: 3;        // Max 3 highly correlated positions
  maxCryptoAllocation: 0.10;        // Max 10% in crypto
  minCashReserve: 0.20;             // Always keep 20% in cash

  // Circuit breakers
  consecutiveLossHalt: 3;           // Pause after 3 consecutive losses
  weeklyLossHaltPercent: 8;         // Pause for week if 8% weekly loss
  volatilityHalt: {                 // Pause during extreme volatility
    vixThreshold: 35,               // VIX > 35
    asxMovePercent: 3,              // ASX200 moves >3% in a session
  };
}
```

### 23.5 Predictive Analytics & Pattern Recognition

Leverage Cognee's knowledge graph for multi-signal predictive analysis.

**Signal Pipeline**:

```text
Raw Data → Cognee Add → Cognify (entity extraction) → Memify (pattern derivation)
                                                              │
                                                              ▼
                                                    Pattern Library
                                                    ┌─────────────────────┐
                                                    │ "RBA rate cut →     │
                                                    │  bank stocks +2.3%  │
                                                    │  within 5 days"     │
                                                    │                     │
                                                    │ "BHP earnings beat  │
                                                    │  → mining sector    │
                                                    │  +1.8% next week"   │
                                                    │                     │
                                                    │ "Bitcoin >$100K →   │
                                                    │  altcoin rally 72%  │
                                                    │  probability"       │
                                                    └─────────────────────┘
```

**Predictive Queries** (using Cognee search types):

| Query Type | Use Case | Example |
| --- | --- | --- |
| `TEMPORAL` | Historical correlation | "What happened to CBA stock after the last 5 RBA rate decisions?" |
| `GRAPH_COMPLETION` | Entity-based prediction | "Which ASX sectors benefit when AUD weakens against USD?" |
| `RAG_COMPLETION` | News-driven signals | "Summarize all news about BHP in the last 7 days and assess sentiment" |
| `FEEDBACK` | Strategy performance | "What is the win rate of momentum trades on mining stocks?" |
| `CYPHER` | Complex graph queries | "MATCH (c:Company)-[:in_sector]->(s:Sector) WHERE s.name='Mining' RETURN c.ticker, c.pe_ratio ORDER BY c.pe_ratio" |
| `GRAPH_COMPLETION_COT` | Multi-step reasoning | "If RBA cuts rates and AUD falls, which stocks benefit most considering current sector positioning?" |

**Anomaly Detection**:

```typescript
// Detect unusual patterns that may signal trading opportunities
interface AnomalyDetector {
  // Volume anomaly: >3x average daily volume
  volumeSpike(ticker: string, threshold: number): Promise<boolean>;

  // Price anomaly: >2 standard deviations from 20-day mean
  priceAnomaly(ticker: string, stdDevThreshold: number): Promise<boolean>;

  // Sentiment anomaly: sudden shift in news/social sentiment
  sentimentShift(ticker: string, window: '1h' | '4h' | '24h'): Promise<SentimentDelta>;

  // Correlation break: historically correlated assets diverging
  correlationBreak(tickerA: string, tickerB: string, threshold: number): Promise<boolean>;
}
```

### 23.6 Docker Infrastructure for Trading Services

```yaml
# docker-compose.yml — additions for trading intelligence
services:
  # Redis for agent message bus + caching
  redis:
    image: redis:7-alpine
    container_name: cba-redis
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes --maxmemory 512mb --maxmemory-policy allkeys-lru
    networks:
      - cba-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3

  # Market data aggregator
  market-data:
    build:
      context: ./services/market-data
      dockerfile: Dockerfile
    container_name: cba-market-data
    environment:
      - COGNEE_API_URL=http://cognee:8000
      - REDIS_URL=redis://redis:6379
      - ASX_API_KEY=${ASX_API_KEY:-}
      - COINGECKO_API_KEY=${COINGECKO_API_KEY:-}
      - COMMSEC_CLIENT_ID=${COMMSEC_CLIENT_ID:-}
      - COMMSEC_CLIENT_SECRET=${COMMSEC_CLIENT_SECRET:-}
    networks:
      - cba-network
    depends_on:
      redis:
        condition: service_healthy
      cognee:
        condition: service_healthy

  # News & sentiment feeds
  news-feeds:
    build:
      context: ./services/news-feeds
      dockerfile: Dockerfile
    container_name: cba-news-feeds
    environment:
      - COGNEE_API_URL=http://cognee:8000
      - REDIS_URL=redis://redis:6379
      - NEWS_POLL_INTERVAL_MS=900000
      - SOCIAL_POLL_INTERVAL_MS=600000
    networks:
      - cba-network
    depends_on:
      redis:
        condition: service_healthy
      cognee:
        condition: service_healthy

volumes:
  redis-data:
    driver: local
```

---

## 24. Financial Product Comparison & Calculators

> Loan comparison engine, rate aggregation from Australian comparison sites, economic data feeds, and financial calculators — all running on local Docker.

> **📊 Implementation Status: ✅ IMPLEMENTED by Agent 5 (loan-comparison-builder)**
>
> | Aspect | Status | File(s) |
> |--------|--------|---------|
> | Loan Calculators | ✅ Created | `server/src/services/loan-calculator.ts` — 6 calculator methods (home, car 3-way, personal, business, refinance, borrowing capacity) |
> | Economic Data | ✅ Created | `server/src/services/economic-data.ts` — RBA/ABS feeds, 24hr/7day cache in `economic_data_cache` table |
> | LoanComparisonAgent | 🔮 Future | `loan-comparison.ts` extending ClaudeAgent (documented but agent not built in Phase 1) |
> | Rate Aggregation | ✅ Built-in | RBA cash rate, lending rates, CPI, unemployment via public APIs |
>
> **Completed**: Agent 5 created `loan-calculator.ts` and `economic-data.ts` as pure services. PMT formula, APRA 3% buffer, ATO novated lease residual schedule all built-in. No agent dependency required.

### 24.1 Loan Calculators & Rate Aggregation

Create `LoanComparisonAgent` (`server/src/services/claude/agents/loan-comparison.ts`) extending `ClaudeAgent<LoanComparisonInput, LoanComparisonOutput>`.

**Agent Registration**:

```typescript
// Add to AgentType union
| 'loan_comparison';

// config.ts — AGENT_TOKEN_BUDGETS
loan_comparison: {
  maxInputTokens: 80_000,
  maxOutputTokens: 12_000,
  maxToolCalls: 12,
  warningThresholdPercent: 80,
},

// config.ts — AGENT_MODELS
loan_comparison: 'claude-sonnet-4-5-20250929',
```

**Loan Types Supported**:

| Loan Type | Key Parameters | Comparison Metrics |
| --- | --- | --- |
| **Home Loan (Owner-Occupied)** | Principal, LVR, fixed/variable, offset, redraw | Comparison rate, total interest, monthly repayment |
| **Home Loan (Investment)** | Principal, LVR, interest-only period, negative gearing | After-tax cost, cash flow impact, depreciation benefit |
| **Car Loan** | Amount, term, balloon payment, secured/unsecured | Total cost, effective rate, residual value |
| **Personal Loan** | Amount, term, secured/unsecured, purpose | Total interest, comparison rate, early repayment fees |
| **Business Loan** | Amount, term, security, turnover requirements | Effective rate, establishment fees, ongoing fees |
| **SMSF Loan (LRBA)** | Property value, LVR (max 80%), bare trust structure | Compliance cost, total interest, fund cash flow |

**Rate Aggregation Sources** (scraped into Cognee):

| Source | Products | Update Frequency | Method |
| --- | --- | --- | --- |
| **Canstar** | Home, personal, car, business loans | Daily | Web scraping |
| **RateCity** | Home loans, savings accounts, credit cards | Daily | Web scraping |
| **Finder** | All financial products | Daily | Web scraping / API |
| **Mozo** | Home loans, personal loans | Daily | Web scraping |
| **RBA Indicator Rates** | Official cash rate, standard variable rate | Monthly | RSS / API |

**Loan Calculator Tools**:

```typescript
const loanComparisonTools = [
  {
    name: 'calculate_loan_repayment',
    description: 'Calculate monthly repayment, total interest, and comparison rate',
    input_schema: {
      type: 'object',
      properties: {
        principal: { type: 'number', description: 'Loan amount in AUD' },
        annualRate: { type: 'number', description: 'Annual interest rate (e.g., 0.0629)' },
        termYears: { type: 'number' },
        type: { type: 'string', enum: ['principal_and_interest', 'interest_only'] },
        interestOnlyYears: { type: 'number', description: 'IO period (if applicable)' },
        offsetBalance: { type: 'number', description: 'Offset account balance' },
        extraRepayment: { type: 'number', description: 'Extra monthly repayment' },
      },
      required: ['principal', 'annualRate', 'termYears', 'type']
    }
  },
  {
    name: 'compare_loan_products',
    description: 'Compare multiple loan products from aggregated rates',
    input_schema: {
      type: 'object',
      properties: {
        loanType: { type: 'string', enum: ['home_owner', 'home_investment', 'car', 'personal', 'business'] },
        principal: { type: 'number' },
        lvr: { type: 'number', description: 'Loan-to-value ratio (e.g., 0.80)' },
        fixedOrVariable: { type: 'string', enum: ['fixed', 'variable', 'split'] },
        topN: { type: 'number', description: 'Number of top products to return', default: 5 },
      },
      required: ['loanType', 'principal']
    }
  },
  {
    name: 'calculate_refinance_savings',
    description: 'Calculate potential savings from refinancing current loan',
    input_schema: {
      type: 'object',
      properties: {
        currentBalance: { type: 'number' },
        currentRate: { type: 'number' },
        currentTermRemainingYears: { type: 'number' },
        newRate: { type: 'number' },
        switchingCosts: { type: 'number', description: 'Discharge + application fees' },
      },
      required: ['currentBalance', 'currentRate', 'currentTermRemainingYears', 'newRate']
    }
  },
  {
    name: 'calculate_borrowing_capacity',
    description: 'Estimate maximum borrowing capacity based on income and expenses',
    input_schema: {
      type: 'object',
      properties: {
        grossAnnualIncome: { type: 'number' },
        otherIncome: { type: 'number' },
        monthlyExpenses: { type: 'number' },
        existingDebtRepayments: { type: 'number' },
        dependents: { type: 'number' },
        assessmentRate: { type: 'number', description: 'Buffer rate (typically +3%)', default: 0.03 },
      },
      required: ['grossAnnualIncome', 'monthlyExpenses']
    }
  }
];
```

**Cognee Integration for Loan Products**:

```python
# Seed loan product data into Cognee (daily update)
await cognee.add(
    data=aggregated_loan_products_json,
    dataset_name="loan_products",
    node_set=["loans", "rates", "australia"]
)
await cognee.cognify(
    datasets=["loan_products"],
    custom_prompt="""Extract: lender name, product name, interest rate (advertised and comparison),
    loan type, LVR tiers, fees (application, ongoing, discharge), features (offset, redraw,
    extra repayments), eligibility criteria, and special offers."""
)
```

### 24.2 Economic Data Feeds

Aggregate Australian and global economic indicators into Cognee for macro-aware financial advice.

**Economic Indicator Matrix**:

| Indicator | Source | Frequency | Impact On | Cognee Dataset |
| --- | --- | --- | --- | --- |
| **RBA Cash Rate** | RBA | 8x/year (board meetings) | Loan rates, savings rates, AUD | `rba_data` |
| **CPI (Inflation)** | ABS | Quarterly | Real returns, wage growth, RBA decisions | `economic_indicators` |
| **Unemployment Rate** | ABS | Monthly | Consumer spending, loan defaults | `economic_indicators` |
| **GDP Growth** | ABS | Quarterly | Market sentiment, sector performance | `economic_indicators` |
| **Housing Prices** | CoreLogic/ABS | Monthly | Property investment, LVR calculations | `economic_indicators` |
| **AUD/USD Exchange** | RBA | Daily | Import costs, international investments | `economic_indicators` |
| **ASX 200 Index** | ASX | Real-time | Portfolio benchmarking | `asx_market` |
| **Bond Yields (10Y)** | RBA | Daily | Fixed rate pricing, risk-free rate | `economic_indicators` |
| **Wage Price Index** | ABS | Quarterly | Income projections, tax planning | `economic_indicators` |
| **Building Approvals** | ABS | Monthly | Construction sector, property supply | `economic_indicators` |

**Economic Data DataPoint Model**:

```python
from cognee.infrastructure.engine import DataPoint

class EconomicIndicatorDataPoint(DataPoint):
    indicator_name: str        # e.g., "rba_cash_rate"
    value: float               # e.g., 4.35
    previous_value: float      # e.g., 4.35
    change: float              # e.g., 0.0
    unit: str                  # "percent", "index", "aud", "ratio"
    period: str                # "2025-Q4", "2025-12", "2025-12-10"
    source: str                # "RBA", "ABS", "CoreLogic"
    release_date: str          # "2025-12-15"
    next_release: str          # "2026-03-15"
    market_expectation: float | None  # Consensus forecast

    class Config:
        metadata = {"index_fields": ["indicator_name", "period", "source"]}
```

**Temporal Queries for Economic Context**:

```typescript
// Example: Get economic context for financial planning advice
const economicContext = await cogneeClient.search(
  'TEMPORAL',
  'RBA cash rate changes and CPI trend over last 12 months',
  ['rba_data', 'economic_indicators']
);

// Example: Correlate economic indicators with loan rate movements
const rateCorrelation = await cogneeClient.search(
  'GRAPH_COMPLETION',
  'How do RBA rate changes affect average home loan variable rates within 30 days?',
  ['rba_data', 'loan_products']
);
```

### 24.3 Docker Infrastructure for Financial Products

```yaml
# docker-compose.yml — additions for financial product services
services:
  # Rate scraper (daily updates from comparison sites)
  rate-scraper:
    build:
      context: ./services/rate-scraper
      dockerfile: Dockerfile
    container_name: cba-rate-scraper
    environment:
      - COGNEE_API_URL=http://cognee:8000
      - SCRAPE_SCHEDULE=0 6 * * *  # Daily at 6 AM AEST
      - SOURCES=canstar,ratecity,finder,mozo
    volumes:
      - rate-data:/data/rates
    networks:
      - cba-network
    depends_on:
      cognee:
        condition: service_healthy

  # Economic data aggregator
  economic-data:
    build:
      context: ./services/economic-data
      dockerfile: Dockerfile
    container_name: cba-economic-data
    environment:
      - COGNEE_API_URL=http://cognee:8000
      - RBA_RSS_URL=https://www.rba.gov.au/rss/rss-cb-exchange-rates.xml
      - ABS_API_URL=https://api.data.abs.gov.au
      - POLL_INTERVAL_MS=3600000  # Hourly
    networks:
      - cba-network
    depends_on:
      cognee:
        condition: service_healthy

volumes:
  rate-data:
    driver: local
```

---

## 25. Advanced AI Architecture & Agent Swarm

> Multi-model strategy, agent swarm coordination patterns, Cognee knowledge architecture, and custom pipelines for the complete GoldLedger platform.

> **📊 Implementation Status: 🔮 FUTURE (Part B) — NOT IMPLEMENTED**
>
> | Aspect | Current State | Target State |
> |--------|--------------|--------------|
> | Model Selection | All agents use Claude Sonnet 4.5 or Haiku 4.5 via `config.ts` AGENT_MODELS | Multi-model: Claude Opus 4, Sonnet 4.5, Haiku 4.5, Gemini 2.0 Flash, GPT-4o Mini |
> | Agent Swarm | Sequential agent invocation via orchestrator | Redis pub/sub coordination, parallel execution, consensus voting |
> | Cognee Pipelines | Default cognify pipeline | Custom pipelines per domain (tax, trading, financial planning) |
> | Knowledge Architecture | Single dataset per agent | Hierarchical datasets with cross-domain linking |
>
> **Architecture Hooks Only**: Current implementation uses Claude Sonnet 4.5 + Haiku 4.5 only (11 agents total after Agent 1 additions). Multi-model swarm coordination is documented but **NOT built**. Requires OpenRouter integration for non-Anthropic models. See Section 25.1-25.4 for future design. Estimated 6-8 weeks additional development.

### 25.1 Model Selection Strategy

**Complete Model Assignment Matrix**:

| Agent | Primary Model | Fallback Model | Rationale | Est. Cost/1K Calls |
| --- | --- | --- | --- | --- |
| `statement_parser` | Claude Sonnet 4.5 | Claude Haiku 4.5 | Structured extraction, high accuracy needed | $2.40 |
| `transaction_categorizer` | Claude Haiku 4.5 | GPT-4o Mini | High volume, pattern matching | $0.80 |
| `gst_calculator` | Claude Haiku 4.5 | Claude Haiku 4.5 | Rule-based, fast | $0.60 |
| `account_reconciler` | Claude Sonnet 4.5 | Claude Haiku 4.5 | Cross-account reasoning | $3.00 |
| `budget_analyzer` | Claude Sonnet 4.5 | Claude Haiku 4.5 | Trend analysis, projections | $2.40 |
| `cross_account_tracer` | Claude Sonnet 4.5 | Claude Haiku 4.5 | Multi-hop graph reasoning | $3.60 |
| `merchant_intelligence` | Claude Haiku 4.5 | GPT-4o Mini | Entity resolution, fast | $0.80 |
| `payroll_agent` | Claude Sonnet 4.5 | Claude Haiku 4.5 | ATO compliance critical | $2.40 |
| `tax_strategy` | Claude Sonnet 4.5 | Claude Opus 4 | Complex multi-entity reasoning | $4.80 |
| `personal_tax_claims` | Claude Haiku 4.5 | Claude Haiku 4.5 | High volume scanning | $0.80 |
| `financial_planner` | Claude Sonnet 4.5 | Claude Sonnet 4.5 | Projection accuracy | $3.00 |
| `loan_comparison` | Claude Sonnet 4.5 | Claude Haiku 4.5 | Product comparison | $2.40 |
| `market_analyst` | Claude Opus 4 | Claude Sonnet 4.5 | Deep macro reasoning | $15.00 |
| `news_intelligence` | Gemini 2.0 Flash Thinking | Claude Haiku 4.5 | Speed + large context | $1.20 |
| `technical_analyst` | Claude Sonnet 4.5 | GPT-4o | Pattern recognition | $3.00 |
| `risk_manager` | Claude Sonnet 4.5 | Claude Sonnet 4.5 | No fallback compromise on risk | $3.00 |
| `execution_agent` | Kimi k1.5 | Claude Haiku 4.5 | Execution speed | $0.60 |

**Model Routing Logic**:

```typescript
// server/src/services/claude/model-router.ts
interface ModelRouter {
  // Select model based on task complexity and budget
  selectModel(agent: AgentType, context: TaskContext): ModelSelection;

  // Fallback on rate limit or error
  getFallback(agent: AgentType, error: Error): ModelSelection;

  // Cost tracking
  trackUsage(agent: AgentType, model: string, tokens: TokenUsage): void;

  // Budget enforcement
  checkBudget(agent: AgentType): { allowed: boolean; remainingBudget: number };
}

interface ModelSelection {
  model: string;
  maxTokens: number;
  temperature: number;
  reason: 'primary' | 'fallback_rate_limit' | 'fallback_error' | 'budget_downgrade';
}

// Automatic downgrade when approaching budget limits
function selectModel(agent: AgentType, context: TaskContext): ModelSelection {
  const budget = getBudgetRemaining(agent);
  const config = AGENT_MODELS[agent];

  if (budget < config.costPerCall * 10) {
    // Less than 10 calls worth of budget — downgrade to cheaper model
    return { model: config.fallback, reason: 'budget_downgrade', ...defaults };
  }

  if (context.complexity === 'simple' && config.fastModel) {
    // Simple tasks can use cheaper model
    return { model: config.fastModel, reason: 'primary', ...defaults };
  }

  return { model: config.primary, reason: 'primary', ...defaults };
}
```

### 25.2 Agent Swarm Coordination Patterns

Four coordination patterns for multi-agent workflows:

**Pattern 1: Hierarchical (Orchestrator → Workers)**

```text
┌─────────────────────────────────┐
│     Orchestrator Agent          │
│     (Claude Sonnet 4.5)         │
│                                 │
│  Decomposes task → assigns      │
│  to specialist agents           │
└──────────┬──────────────────────┘
           │
    ┌──────┼──────┬──────────┐
    ▼      ▼      ▼          ▼
 Agent A  Agent B  Agent C  Agent D
 (parse)  (calc)   (search) (report)
```

Use case: BAS preparation (orchestrator coordinates parser → categorizer → GST calc → BAS report).

**Pattern 2: Consensus (Multiple Agents Vote)**

```typescript
// Multiple agents analyze the same data, majority vote wins
async function consensusAnalysis(data: MarketData): Promise<TradeDecision> {
  const [macro, technical, sentiment] = await Promise.all([
    marketAnalystAgent.analyze(data),
    technicalAnalystAgent.analyze(data),
    newsIntelligenceAgent.analyze(data),
  ]);

  const votes = [macro.signal, technical.signal, sentiment.signal];
  const buyVotes = votes.filter(v => v === 'BUY').length;
  const sellVotes = votes.filter(v => v === 'SELL').length;

  if (buyVotes >= 2) return { action: 'BUY', confidence: buyVotes / 3 };
  if (sellVotes >= 2) return { action: 'SELL', confidence: sellVotes / 3 };
  return { action: 'HOLD', confidence: 0.5 };
}
```

Use case: Trading decisions (3 analysts must agree before execution).

**Pattern 3: Sequential Pipeline**

```text
Input → [Parser] → [Categorizer] → [GST Calc] → [Tax Claims] → [Planner] → Output
         Each agent enriches the data before passing to the next
```

Use case: End-to-end statement processing with tax optimization.

**Pattern 4: Parallel Fan-Out / Fan-In**

```typescript
// Fan out to multiple agents, aggregate results
async function comprehensiveAnalysis(userId: string): Promise<FinancialReport> {
  // Fan out — all agents run in parallel
  const [tax, budget, loans, investments] = await Promise.all([
    taxStrategyAgent.run({ userId, financialYear: 'FY2025' }),
    financialPlannerAgent.run({ userId, period: 'last_12_months' }),
    loanComparisonAgent.run({ userId, checkRefinance: true }),
    marketAnalystAgent.run({ userId, portfolio: true }),
  ]);

  // Fan in — combine into unified report
  return {
    taxOptimization: tax,
    budgetAnalysis: budget,
    loanRecommendations: loans,
    investmentOutlook: investments,
    generatedAt: new Date().toISOString(),
  };
}
```

Use case: Monthly financial health report.

### 25.3 Cognee Knowledge Architecture

**Complete Dataset Registry**:

| Dataset | Source | Size Estimate | Cognify Frequency | Memify | Primary Search Types |
| --- | --- | --- | --- | --- | --- |
| `user_{id}_transactions` | Bank statements | 500-5K records/user | On upload | Monthly | `CHUNKS_LEXICAL`, `GRAPH_COMPLETION` |
| `user_{id}_merchants` | Merchant intelligence | 50-500/user | On new merchant | Quarterly | `GRAPH_COMPLETION`, `FEEDBACK` |
| `ato_rulings` | ATO scraper | ~2,000 rulings | Quarterly | Quarterly | `GRAPH_COMPLETION`, `RAG_COMPLETION` |
| `loan_products` | Rate scraper | ~500 products | Daily | Weekly | `RAG_COMPLETION`, `CHUNKS` |
| `asx_market` | Market data service | ~200 tickers/day | On >2% move | Weekly | `TEMPORAL`, `GRAPH_COMPLETION` |
| `crypto_market` | CoinGecko | ~50 coins/5min | On >5% move | Weekly | `TEMPORAL`, `CHUNKS` |
| `market_news` | News feeds | ~100 articles/day | Always | Daily | `RAG_COMPLETION`, `CHUNKS_LEXICAL` |
| `asx_announcements` | ASX RSS | ~50/day | Always | Weekly | `GRAPH_COMPLETION`, `CYPHER` |
| `trade_history` | Execution agent | Per trade | Always | Per trade | `TEMPORAL`, `FEEDBACK` |
| `social_sentiment` | Reddit/X | ~500 posts/day | Hourly batch | Daily | `RAG_COMPLETION`, `CHUNKS` |
| `economic_indicators` | RBA/ABS | ~20 indicators | On release | Monthly | `TEMPORAL`, `GRAPH_COMPLETION` |
| `rba_data` | RBA | 8 decisions/year | On release | On release | `TEMPORAL`, `GRAPH_COMPLETION` |

**Knowledge Graph Schema** (Neo4j/Kuzu):

```text
(:User)-[:OWNS]->(:Account)-[:HAS_TRANSACTION]->(:Transaction)
(:Transaction)-[:AT_MERCHANT]->(:Merchant)-[:IN_CATEGORY]->(:Category)
(:Transaction)-[:HAS_GST]->(:GSTEntry)-[:FOR_BAS_PERIOD]->(:BASPeriod)
(:Transaction)-[:CLAIMED_AS]->(:TaxDeduction)-[:UNDER_RULING]->(:ATORuling)
(:User)-[:HAS_ENTITY]->(:TaxEntity)-[:FILED]->(:TaxReturn)
(:Company)-[:LISTED_ON]->(:Exchange)-[:IN_SECTOR]->(:Sector)
(:Company)-[:MENTIONED_IN]->(:NewsArticle)-[:HAS_SENTIMENT]->(:Sentiment)
(:Trade)-[:ON_ASSET]->(:Asset)-[:CORRELATED_WITH]->(:Asset)
(:Trade)-[:USED_STRATEGY]->(:Strategy)-[:HAS_PERFORMANCE]->(:StrategyMetrics)
(:LoanProduct)-[:FROM_LENDER]->(:Lender)-[:HAS_RATE]->(:InterestRate)
(:EconomicIndicator)-[:RELEASED_BY]->(:Source)-[:IMPACTS]->(:Sector)
```

### 25.4 Custom Pipelines

**Pipeline 1: FinancialEntityPipeline**

```python
from cognee.modules.pipelines import Pipeline, Task

class FinancialEntityPipeline(Pipeline):
    """Extract financial entities from bank statements and link to knowledge graph."""

    def get_tasks(self) -> list[Task]:
        return [
            Task(name="chunk_statements", fn=self.chunk_by_transaction),
            Task(name="extract_entities", fn=self.extract_financial_entities),
            Task(name="resolve_merchants", fn=self.resolve_merchant_identity),
            Task(name="classify_gst", fn=self.classify_gst_status),
            Task(name="link_to_graph", fn=self.create_graph_relationships),
            Task(name="detect_patterns", fn=self.detect_spending_patterns),
        ]

    async def extract_financial_entities(self, chunks):
        """Custom entity extraction tuned for Australian financial data."""
        # Recognizes: ABN, ACN, BSB, account numbers, ATO references,
        # Medicare numbers, TFN patterns (redacted), superannuation funds
        pass

    async def resolve_merchant_identity(self, entities):
        """Normalize merchant names using Cognee's existing merchant memory."""
        # "WOOLWORTHS 1234 SYDNEY" → "Woolworths Group Ltd"
        # Uses GRAPH_COMPLETION to find existing merchant nodes
        pass
```

**Pipeline 2: TaxRulingPipeline**

```python
class TaxRulingPipeline(Pipeline):
    """Process ATO rulings into structured knowledge graph nodes."""

    def get_tasks(self) -> list[Task]:
        return [
            Task(name="parse_ruling", fn=self.parse_ruling_pdf),
            Task(name="extract_thresholds", fn=self.extract_dollar_thresholds),
            Task(name="extract_conditions", fn=self.extract_eligibility_conditions),
            Task(name="link_entity_types", fn=self.link_to_entity_types),
            Task(name="detect_superseded", fn=self.detect_superseded_rulings),
            Task(name="create_ruling_node", fn=self.create_ato_ruling_datapoint),
        ]
```

**Pipeline 3: NewsEventPipeline**

```python
class NewsEventPipeline(Pipeline):
    """Process financial news into actionable trading signals."""

    def get_tasks(self) -> list[Task]:
        return [
            Task(name="parse_article", fn=self.parse_news_article),
            Task(name="extract_entities", fn=self.extract_companies_and_people),
            Task(name="score_sentiment", fn=self.score_sentiment),
            Task(name="detect_events", fn=self.detect_market_events),
            Task(name="link_to_assets", fn=self.link_to_tracked_assets),
            Task(name="generate_signal", fn=self.generate_trade_signal),
        ]

    async def detect_market_events(self, article):
        """Classify news into event types that impact markets."""
        # Event types: earnings_beat, earnings_miss, rba_decision,
        # merger_acquisition, regulatory_action, ceo_change,
        # dividend_announcement, profit_warning, capital_raising
        pass
```

---

## 26. Multi-Phase Implementation & Compliance

> Implementation priorities, compliance guardrails, success metrics, technical debt considerations, and the complete local Docker architecture.

> **📊 Implementation Status: ⚡ PARTIAL — Phase 1 & 2 Complete, Remaining In Progress**
>
> | Phase | Status | Detail |
> |-------|--------|--------|
> | Phase 1: Tax Optimization | ✅ IMPLEMENTED | Agent 1: tax-return.ts, tax-optimizer.ts, 3 agents. Agent 2: migration 0012, Docker Redis |
> | Phase 2: Loan Calculators | ✅ IMPLEMENTED | Agent 5: loan-calculator.ts, economic-data.ts |
> | Phase 3: Trading Intelligence | 🔮 FUTURE | Part B — architecture hooks only (Redis added) |
> | Docker Stack | ⚡ PARTIAL | 5 services (postgres, cognee, server, client, redis) — target is 11 |
> | Database Schema | ✅ MIGRATED | 5 new tables + 4 ALTER columns via migration `0012_tax_return_platform.sql` |
> | API Routes | ⚡ PENDING | Agent 7: ~28 new endpoints to wire in `index.ts` |
> | Frontend | ⚡ PENDING | Agent 8: 15+ new React components, loans/ feature folder, entity tabs |
> | Owner Equity & Budget | ⚡ PENDING | Agent 6: owner-equity.ts, budget-enhanced.ts |
> | Verification | ⚡ PENDING | Agent 9: 20-point checklist |
>
> **Agent Teams Orchestration**: 10 agents in 5 waves via `launch-goldledger-team.sh`. See `docs/Curretn Claudecode plan.md` for detailed 12-phase breakdown. All 12 PART A phases mapped to architecture sections §22-§24.

### 26.1 Implementation Priorities

**Phase 1: Tax Optimization (Weeks 1-2) — Immediate**

| Task | Effort | Dependencies | Deliverable |
| --- | --- | --- | --- |
| Create `TaxStrategyAgent` | 3 days | None | `tax-strategy.ts` |
| Create `PersonalTaxClaimsAgent` | 2 days | None | `personal-tax-claims.ts` |
| Create `FinancialPlannerAgent` | 3 days | None | `financial-planner.ts` |
| ATO tax bracket engine | 2 days | None | Tax calculation utilities |
| Seed ATO rulings into Cognee | 2 days | ATO scraper Docker service | `ato_rulings` dataset |
| Add `claim_type` columns to DB | 0.5 days | None | Migration script |
| Integration tests | 2 days | All above | Test suite |

**Phase 2: Financial Products (Weeks 3-6) — Short-term**

| Task | Effort | Dependencies | Deliverable |
| --- | --- | --- | --- |
| Create `LoanComparisonAgent` | 3 days | None | `loan-comparison.ts` |
| Rate scraper Docker service | 5 days | Canstar/RateCity access | `rate-scraper` service |
| Economic data feed service | 3 days | RBA/ABS APIs | `economic-data` service |
| Loan calculator tools | 3 days | None | Calculator functions |
| Cognee loan product dataset | 2 days | Rate scraper | `loan_products` dataset |
| UI: Loan comparison page | 5 days | LoanComparisonAgent | React components |

**Phase 3: Trading Intelligence (Weeks 7-16) — Medium-term**

| Task | Effort | Dependencies | Deliverable |
| --- | --- | --- | --- |
| Create 5 trading agents | 10 days | Multi-model routing | Agent implementations |
| Market data Docker service | 5 days | ASX/CoinGecko APIs | `market-data` service |
| News feeds Docker service | 5 days | News source access | `news-feeds` service |
| Redis message bus | 2 days | None | Redis service + pub/sub |
| Trading strategy engine | 8 days | All trading agents | Strategy executor |
| Risk control system | 5 days | RiskManagerAgent | Circuit breakers |
| Cognee trading datasets | 5 days | Market/news services | 7 datasets |
| Backtesting framework | 8 days | Trade history | Backtester |
| UI: Trading dashboard | 10 days | All trading services | React components |

**Phase 4: Advanced AI (Weeks 17-24) — Long-term**

| Task | Effort | Dependencies | Deliverable |
| --- | --- | --- | --- |
| Model router implementation | 3 days | None | `model-router.ts` |
| Agent swarm coordinator | 5 days | Model router | Swarm patterns |
| Custom Cognee pipelines | 8 days | All datasets | 3 pipelines |
| Memify optimization | 3 days | Trade history | Pattern learning |
| Performance monitoring | 5 days | All agents | Metrics dashboard |
| Multi-tenant production hardening | 8 days | All services | EBAC, isolation |

### 26.2 Compliance & Risk Management

**Tax Optimization Guardrails**:

| Rule | Implementation | Enforcement |
| --- | --- | --- |
| ATO-compliant advice only | All tax agents cite specific ATO rulings | Cognee `GRAPH_COMPLETION` with ruling references |
| Disclaimer on every response | System prompt mandates disclaimer | Post-processing check |
| No aggressive tax avoidance | Flag Part IVA (anti-avoidance) risks | Keyword detection + Cognee ruling search |
| Substantiation requirements | Always list required documentation | Per-deduction-category rules |
| Entity structure warnings | Warn about compliance costs and risks | Agent system prompt |
| Professional referral | Recommend registered tax agent for complex matters | Confidence threshold (<80% → refer) |

**Trading Risk Guardrails**:

| Rule | Implementation | Enforcement |
| --- | --- | --- |
| Position size limits | Max 5% per position, 30% daily exposure | `RiskManagerAgent` gate |
| Stop-loss mandatory | Every trade must have stop-loss before execution | `ExecutionAgent` pre-check |
| Circuit breakers | 5% daily loss, 8% weekly loss, 3 consecutive losses | Redis-tracked counters |
| ASIC compliance | No unlicensed financial advice | Disclaimer + "general information only" |
| Paper trading first | All strategies must pass 30-day paper trade | Backtesting framework |
| Audit trail | Every trade decision logged with reasoning | PostgreSQL + Cognee |
| No margin trading | Spot only, no leveraged positions | `ExecutionAgent` validation |

**Data Privacy & Security**:

```typescript
// All financial data stays local (Docker volumes)
const PRIVACY_CONTROLS = {
  // No data leaves the local Docker network
  dataResidency: 'local_docker_only',

  // PII handling
  tfnHandling: 'never_stored',           // Tax File Numbers never persisted
  bankAccountNumbers: 'encrypted_at_rest', // AES-256 in PostgreSQL
  transactionData: 'user_isolated',       // Per-user Cognee datasets

  // API key security
  apiKeys: 'docker_secrets',              // Not in environment variables
  modelApiKeys: 'rotated_monthly',        // Anthropic, Google, OpenRouter

  // Audit
  accessLogging: true,                    // All API calls logged
  dataRetention: '7_years',              // ATO requirement
  exportFormat: 'encrypted_zip',          // User data export
};
```

### 26.3 Success Metrics

**Tax Optimization Metrics**:

| Metric | Target | Measurement |
| --- | --- | --- |
| Deduction capture rate | >95% of eligible deductions identified | Compare agent output vs manual tax return |
| Tax savings per user | >$500/year average | Before/after comparison |
| ATO ruling citation accuracy | >99% (no incorrect ruling references) | Spot-check against ATO database |
| Substantiation completeness | 100% of claims have required docs listed | Automated check |
| User correction rate | <5% of categorizations need manual override | Track user edits post-agent |
| Processing time | <30 seconds for full FY deduction scan | Performance monitoring |

**Trading Intelligence Metrics**:

| Metric | Target | Measurement |
| --- | --- | --- |
| Sharpe ratio | >1.5 (risk-adjusted returns) | Rolling 12-month calculation |
| Win rate | >55% of trades profitable | Trade history analysis |
| Max drawdown | <15% from peak | Portfolio tracking |
| Alpha vs ASX200 | >3% annualized | Benchmark comparison |
| Signal latency | <5 minutes from news to signal | Timestamp tracking |
| Risk control compliance | 100% of trades within limits | Automated audit |
| Paper trade validation | 30 days profitable before live | Backtesting framework |

**Platform Metrics**:

| Metric | Target | Measurement |
| --- | --- | --- |
| Agent response time (p95) | <10 seconds | APM monitoring |
| Cognee search latency (p95) | <2 seconds | Cognee metrics |
| System uptime | >99.5% | Docker health checks |
| Knowledge graph freshness | <1 hour for market data, <24h for rulings | Ingestion timestamps |
| Monthly active users | Growth >10% MoM | Analytics |
| Cost per user per month | <$15 (API + infrastructure) | Cost tracking |

### 26.4 Technical Debt & Considerations

| Consideration | Risk | Mitigation |
| --- | --- | --- |
| **ATO ruling dataset** | No official API; web scraping may break | Build resilient scraper with fallback to manual PDF upload; cache aggressively |
| **Market data costs** | Real-time ASX quotes require paid subscription ($500-2K/month) | Start with 15-min delayed (free); upgrade when trading volume justifies cost |
| **Trading API limits** | CommSec API has rate limits; may need multiple accounts | Implement request queuing; consider multiple broker APIs (Interactive Brokers, SelfWealth) |
| **Model costs** | Claude Opus 4 is ~$15/1M input tokens | Use Opus only for MarketAnalystAgent; cache responses; use Haiku for high-volume tasks |
| **Regulatory (AFSL)** | Trading bots managing client funds may require AFSL | Start as "general information only" tool; no automated execution without user confirmation |
| **Cognee scaling** | Large datasets (market data) may slow cognify | Selective cognify (only significant events); partition by date; use Neo4j for production |
| **Multi-model routing** | Different model APIs have different rate limits and formats | Abstract behind ModelRouter; implement per-provider rate limiting and retry logic |
| **Data freshness** | Stale market data leads to bad trading decisions | Health checks on all data feeds; alert on >30min staleness; circuit breaker on stale data |
| **Backtesting bias** | Overfitting to historical data | Walk-forward analysis; out-of-sample testing; paper trade validation period |
| **Docker resource limits** | All services on one machine may exhaust RAM/CPU | Set resource limits per container; monitor with cAdvisor; scale to Docker Swarm if needed |

### 26.5 Complete Local Docker Architecture

The **entire platform** runs on local Docker. No cloud services required (except LLM API calls).

```yaml
# docker-compose.yml — COMPLETE GoldLedger stack
version: '3.8'

services:
  # ─── Core Infrastructure ───────────────────────────────
  postgres:
    image: pgvector/pgvector:pg17
    container_name: cba-postgres
    environment:
      POSTGRES_DB: cba_statements
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - cba-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  neo4j:
    image: neo4j:5-community
    container_name: cba-neo4j
    environment:
      NEO4J_AUTH: neo4j/${NEO4J_PASSWORD}
      NEO4J_PLUGINS: '["apoc"]'
    ports:
      - "7474:7474"
      - "7687:7687"
    volumes:
      - neo4j-data:/data
    networks:
      - cba-network
    healthcheck:
      test: ["CMD", "neo4j", "status"]
      interval: 15s
      timeout: 10s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: cba-redis
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes --maxmemory 512mb
    networks:
      - cba-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3

  # ─── AI & Knowledge Graph ──────────────────────────────
  cognee:
    build:
      context: ./cognee-repo
      dockerfile: Dockerfile
    container_name: cba-cognee
    environment:
      - LLM_API_KEY=${ANTHROPIC_API_KEY}
      - LLM_MODEL=claude-sonnet-4-5-20250929
      - LLM_PROVIDER=anthropic
      - EMBEDDING_MODEL=text-embedding-3-small
      - EMBEDDING_PROVIDER=openai
      - EMBEDDING_API_KEY=${OPENAI_API_KEY}
      - GRAPH_DATABASE_PROVIDER=neo4j
      - GRAPH_DATABASE_URL=bolt://neo4j:7687
      - GRAPH_DATABASE_USERNAME=neo4j
      - GRAPH_DATABASE_PASSWORD=${NEO4J_PASSWORD}
      - VECTOR_DB_PROVIDER=pgvector
      - VECTOR_DB_URL=postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/cba_statements
      - RELATIONAL_DB_PROVIDER=postgres
      - RELATIONAL_DB_URL=postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/cba_statements
      - ENABLE_BACKEND_ACCESS_CONTROL=true
      - REQUIRE_AUTHENTICATION=true
    ports:
      - "8000:8000"
    networks:
      - cba-network
    depends_on:
      postgres:
        condition: service_healthy
      neo4j:
        condition: service_healthy

  # ─── Application ───────────────────────────────────────
  server:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: cba-server
    environment:
      - DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/cba_statements
      - COGNEE_API_URL=http://cognee:8000
      - REDIS_URL=redis://redis:6379
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
      - GOOGLE_AI_API_KEY=${GOOGLE_AI_API_KEY}
    ports:
      - "3001:3001"
    networks:
      - cba-network
    depends_on:
      postgres:
        condition: service_healthy
      cognee:
        condition: service_healthy
      redis:
        condition: service_healthy

  client:
    build:
      context: ./client
      dockerfile: Dockerfile
    container_name: cba-client
    ports:
      - "80:80"
    networks:
      - cba-network
    depends_on:
      - server

  # ─── Data Services ─────────────────────────────────────
  ato-scraper:
    build:
      context: ./services/ato-scraper
      dockerfile: Dockerfile
    container_name: cba-ato-scraper
    environment:
      - COGNEE_API_URL=http://cognee:8000
      - SCRAPE_SCHEDULE=0 0 1 */3 *
    volumes:
      - ato-rulings-data:/data/rulings
    networks:
      - cba-network
    depends_on:
      cognee:
        condition: service_healthy

  rate-scraper:
    build:
      context: ./services/rate-scraper
      dockerfile: Dockerfile
    container_name: cba-rate-scraper
    environment:
      - COGNEE_API_URL=http://cognee:8000
      - SCRAPE_SCHEDULE=0 6 * * *
    volumes:
      - rate-data:/data/rates
    networks:
      - cba-network
    depends_on:
      cognee:
        condition: service_healthy

  market-data:
    build:
      context: ./services/market-data
      dockerfile: Dockerfile
    container_name: cba-market-data
    environment:
      - COGNEE_API_URL=http://cognee:8000
      - REDIS_URL=redis://redis:6379
      - ASX_API_KEY=${ASX_API_KEY:-}
      - COINGECKO_API_KEY=${COINGECKO_API_KEY:-}
    networks:
      - cba-network
    depends_on:
      redis:
        condition: service_healthy
      cognee:
        condition: service_healthy

  news-feeds:
    build:
      context: ./services/news-feeds
      dockerfile: Dockerfile
    container_name: cba-news-feeds
    environment:
      - COGNEE_API_URL=http://cognee:8000
      - REDIS_URL=redis://redis:6379
    networks:
      - cba-network
    depends_on:
      redis:
        condition: service_healthy
      cognee:
        condition: service_healthy

  economic-data:
    build:
      context: ./services/economic-data
      dockerfile: Dockerfile
    container_name: cba-economic-data
    environment:
      - COGNEE_API_URL=http://cognee:8000
      - RBA_RSS_URL=https://www.rba.gov.au/rss/rss-cb-exchange-rates.xml
      - ABS_API_URL=https://api.data.abs.gov.au
    networks:
      - cba-network
    depends_on:
      cognee:
        condition: service_healthy

# ─── Volumes ───────────────────────────────────────────
volumes:
  postgres-data:
    driver: local
  neo4j-data:
    driver: local
  redis-data:
    driver: local
  ato-rulings-data:
    driver: local
  rate-data:
    driver: local

# ─── Network ──────────────────────────────────────────
networks:
  cba-network:
    driver: bridge
```

**Resource Estimates** (minimum for development):

| Service | RAM | CPU | Disk |
| --- | --- | --- | --- |
| PostgreSQL + pgvector | 1 GB | 1 core | 5 GB |
| Neo4j | 2 GB | 1 core | 2 GB |
| Redis | 512 MB | 0.5 core | 1 GB |
| Cognee | 2 GB | 2 cores | 1 GB |
| Server (Node.js + Python) | 1 GB | 1 core | 500 MB |
| Client (nginx) | 128 MB | 0.25 core | 100 MB |
| ATO Scraper | 256 MB | 0.25 core | 500 MB |
| Rate Scraper | 256 MB | 0.25 core | 200 MB |
| Market Data | 512 MB | 0.5 core | 500 MB |
| News Feeds | 512 MB | 0.5 core | 500 MB |
| Economic Data | 256 MB | 0.25 core | 200 MB |
| **Total** | **~8.5 GB** | **~7.5 cores** | **~10.5 GB** |

---

## 27. Implementation Summary

> Agent Teams session — 2026-02-12. 10 agents orchestrated in 5 waves to implement PART A of the GoldLedger financial intelligence platform.

### Completed in This Session

| Component | Agent | Files Created | Files Modified |
|-----------|-------|---------------|----------------|
| Tax Return Engine | Agent 1 (tax-agents-builder) | `tax-return.ts`, `tax-optimizer.ts`, `tax-strategy.ts`, `personal-tax-claims.ts`, `financial-planner.ts` | `types.ts`, `config.ts` |
| Docker + Schema | Agent 2 (docker-schema-agent) | `0012_tax_return_platform.sql` | `docker-compose.yml`, `schema.ts`, `postgres-schema.ts` |
| Schema Verification | Agent 3 (schema-verifier) | — | `schema.ts`, `postgres-schema.ts` |
| Cognee Datasets | Agent 4 (cognee-dataset-agent) | — | `cognee-tools.ts` |
| Loan Calculators | Agent 5 (loan-comparison-builder) | `loan-calculator.ts`, `economic-data.ts` | — |
| Owner Equity + Budget | Agent 6 (equity-budget-builder) | `owner-equity.ts`, `budget-enhanced.ts` | — |
| API Routes | Agent 7 (api-routes-agent) | — | `index.ts` |
| UI Components | Agent 8 (frontend-builder) | 15+ React components | `api.ts`, `App.tsx`, `TaxDashboard.tsx` |
| Testing | Agent 9 (verification-agent) | — | — |
| Documentation | Agent 10 (documentation-agent) | — | `COMPREHENSIVE_ARCHITECTURE.md` |

### Architecture Section Status Map

| Section | Title | Status | Agent(s) |
|---------|-------|--------|----------|
| §1-§21 | Core Platform (DB, Cognee, Agents, Config, Deployment) | ✅ Pre-existing | — |
| §22 | Australian Tax Optimization Engine | ✅ IMPLEMENTED | Agent 1, Agent 2 |
| §23 | Investment & Trading Intelligence | 🔮 FUTURE (Part B) | — |
| §24 | Financial Product Comparison & Calculators | ✅ IMPLEMENTED | Agent 5 |
| §25 | Advanced AI Architecture & Agent Swarm | 🔮 FUTURE (Part B) | — |
| §26 | Multi-Phase Implementation & Compliance | ⚡ PARTIAL | All agents |

### Plan Phases Cross-Reference

All 12 phases from PART A of `docs/Curretn Claudecode plan.md` are reflected in this architecture document:

| Plan Phase | Arch Section | Status |
|------------|--------------|--------|
| Phase 1: Schema & Migration | §22.3, §22.1 | ✅ Agent 2 — `0012_tax_return_platform.sql` |
| Phase 2: Tax Engine | §22.2 | ✅ Agent 1 — `tax-return.ts` |
| Phase 3: Tax Optimizer | §22.1, §22.3 | ✅ Agent 1 — `tax-optimizer.ts`, 3 agents |
| Phase 4: Loan Calculators | §24.1 | ✅ Agent 5 — `loan-calculator.ts` |
| Phase 5: Economic Data | §24.1 | ✅ Agent 5 — `economic-data.ts` |
| Phase 6: Owner Equity | §22.1 | ⚡ Agent 6 — `owner-equity.ts` |
| Phase 7: Budgeting | §22.4 | ⚡ Agent 6 — `budget-enhanced.ts` |
| Phase 8: API Routes | All sections | ⚡ Agent 7 — ~28 endpoints in `index.ts` |
| Phase 9: Client API | All sections | ⚡ Agent 8 — `api.ts` TypeScript interfaces |
| Phase 10: Tax UI | §22.1, §22.3 | ⚡ Agent 8 — entity tabs, deduction UI |
| Phase 11: Loan UI | §24.1 | ⚡ Agent 8 — loan calculators frontend |
| Phase 12: Analytics UI | §22.4 | ⚡ Agent 8 — projections, bill alerts |
| PART B: Future | §23, §25 | 🔮 Not in scope |

---

*Document generated: 2026-02-12*
*Covers: GoldLedger v1.0 + Cognee v0.5.2 + Claude Agent SDK*
*Source of truth for: AI agent architecture, Cognee integration, multi-tenant configuration, deployment, tax optimization, trading intelligence, financial products, advanced AI features*
