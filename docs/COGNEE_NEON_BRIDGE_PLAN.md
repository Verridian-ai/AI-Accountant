# Cognee + Neon Bridge Architecture Plan

> **Author**: Cognee-Neon Bridge Architect
> **Date**: 2026-02-17
> **Status**: READY FOR IMPLEMENTATION
> **Dependencies**: [NEON_INTEGRATION_PLAN.md](./NEON_INTEGRATION_PLAN.md) (complete), [DATA_MASKING_PLAN.md](./DATA_MASKING_PLAN.md) (complete)
> **Scope**: All 10 Cognee features (F1-F10) × split-database architecture (Neon + local PG)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Cognee Database Requirements](#2-cognee-database-requirements)
3. [Data Flow Architecture](#3-data-flow-architecture)
4. [Agent-Cognee-Neon Wiring](#4-agent-cognee-neon-wiring)
5. [Session Isolation Architecture](#5-session-isolation-architecture)
6. [Search with Masked Data](#6-search-with-masked-data)
7. [MCP Server Updates (F9)](#7-mcp-server-updates-f9)
8. [Docker Compose Changes](#8-docker-compose-changes)
9. [F1-F10 Impact Assessment](#9-f1-f10-impact-assessment)
10. [Implementation Sequence](#10-implementation-sequence)

---

## 1. Executive Summary

This plan defines how Cognee's full feature set (F1-F10) operates in a split-database architecture where:

- **Neon Cloud** hosts 128 accounting tables (transactions, accounts, invoices, payroll, compliance, etc.)
- **Local PostgreSQL** (pgvector:pg17) hosts 13 Cognee/AI tables + all Cognee internal tables (`cognee_db`)
- **Cognee service** connects ONLY to local PG (`cognee_db`) — no direct Neon access
- **Server** connects to BOTH databases and bridges them via REST API calls to Cognee

### Key Architectural Insight

The existing architecture already has a clean separation boundary. The Hono server talks to Cognee exclusively through HTTP REST API calls via `cognee_client.ts`. Cognee never touches the app database directly. This means the Neon migration requires **zero changes to the Cognee service itself** — all bridge logic lives in the server.

### What Changes

| Component | Change Required | Reason |
|-----------|----------------|--------|
| `cognee_client.ts` | None | Already talks to Cognee via HTTP only |
| `cognee-tools.ts` | Add `PiiRedactor` pre-processing | Defense-in-depth before indexing |
| `rag.ts` | Read from Neon → redact → index via HTTP | Data source moves to Neon |
| `cognee-sessions.ts` | None | Already Redis-only |
| `cognee-datapoints.ts` | Switch `db` → `cogneeDb` | Table lives on local PG |
| `cognee-ontologies.ts` | Switch `db` → `cogneeDb` | Table lives on local PG |
| `cognee-feedback.ts` | Switch `db` → `cogneeDb` | Table lives on local PG |
| `cognee-graph.ts` | None | Already HTTP-only to Cognee |
| `cross-module-intelligence.ts` | Import both `db` + `cogneeDb` | Reads Neon, writes local PG |
| `temporal-cognify.ts` | Import both `db` + `cogneeDb` | Reads Neon, writes local PG |
| 26 Claude agents | None (data flow is transparent) | Agents use CogneeTools which handles routing |
| Cognee Docker service | None | Still points to local PG `cognee_db` |

---

## 2. Cognee Database Requirements

### 2.1 What Stays on Local PG

Cognee requires local PostgreSQL for three critical reasons:

1. **pgvector for embeddings**: Cognee stores 1536-dimensional text-embedding-3-small vectors. Cross-network vector similarity search would add 10-50ms latency per query, unacceptable for real-time chat.

2. **Kuzu graph store**: Cognee's embedded graph database writes to local filesystem (`/app/.cognee_system`). It cannot be moved to a remote database.

3. **High-throughput cognify operations**: During cognify, Cognee performs thousands of embedding lookups, graph writes, and entity extractions. These must be local.

### 2.2 Local PG Tables (13 tables in `ai_accountant` database)

| Table | Purpose | Why Local |
|-------|---------|-----------|
| `cognee_user_accounts` | Cognee auth tokens per user | Synced with Cognee service lifecycle |
| `cognee_sessions` | Session state for F7 | Ephemeral, high-frequency reads |
| `datapoint_configs` | F1 DataPoint definitions | Cognee schema management |
| `graph_schemas` | F2 ontology definitions | Cognee graph schema |
| `cognee_feedback` | F4 search feedback loop | Feeds memify rules |
| `rag_namespaces` | RAG namespace metadata | Vector index management |
| `rag_chunks` | Text chunks + pgvector embeddings | Requires pgvector extension |
| `rag_documents` | RAG document tracking | Links to rag_chunks |
| `rag_citations` | RAG citation tracking | Links to rag_chunks |
| `temporal_queries` | F17 temporal search cache | High-frequency cache |
| `cross_module_insights` | F17 cross-module results | AI-generated, writes from scanners |
| `intelligence_subscriptions` | F17 notification triggers | Event-driven, local processing |
| `module_connections` | F17 module relationship metadata | Seeded configuration |

### 2.3 Cognee's Own Database (`cognee_db`)

Cognee manages its own database internally. These tables are created by Cognee's own migrations and are never touched by the server code:

- Vector embedding tables (pgvector)
- Graph node/edge tables (managed via Kuzu API)
- Dataset metadata tables
- Internal auth tables
- Cache tables

**No changes needed** — Cognee continues using `postgres:5432/cognee_db` as before.

### 2.4 Tables that Move to Neon (Reference)

All 128 accounting tables move to Neon as specified in `NEON_INTEGRATION_PLAN.md` Section 4.2. The server reads from Neon for all business data and indexes selected data into Cognee through the HTTP API.

---

## 3. Data Flow Architecture

### 3.1 Complete Data Flow Diagram

```
                              ┌─────────────────────┐
                              │    Neon Cloud        │
                              │    (Production)      │
                              │                      │
                              │  128 accounting      │
                              │  tables              │
                              └──────────┬───────────┘
                                         │
                              ┌──────────┼───────────────────────────────┐
                              │          │  Neon AI Branch               │
                              │          │  (Masked - Nightly Fork)      │
                              │          │                               │
                              │  anon.anonymize_database()               │
                              │  110 PII columns masked                  │
                              │  ±10% noise on financial amounts         │
                              └──────────┬───────────────────────────────┘
                                         │
                                    SQL reads (masked)
                                         │
                              ┌──────────▼───────────┐
                              │    Hono Server       │
                              │    (Node.js)         │
                              │                      │
                              │  ┌────────────────┐  │
                              │  │ PiiRedactor    │  │  ◀── Layer 2: Application-layer
                              │  │ (defense-in-   │  │      regex scrub of free-text
                              │  │  depth)        │  │
                              │  └───────┬────────┘  │
                              │          │           │
                              │  ┌───────▼────────┐  │
                              │  │ cogneeClient   │  │  ◀── HTTP POST to Cognee
                              │  │ .add()         │  │      (multipart FormData)
                              │  │ .cognify()     │  │
                              │  │ .search()      │  │
                              │  └───────┬────────┘  │
                              │          │           │
                              └──────────┼───────────┘
                                         │
                               HTTP REST API
                               (port 8000)
                                         │
                              ┌──────────▼───────────┐
                              │    Cognee Service    │
                              │    (:8000)           │
                              │                      │
                              │  Entity extraction   │
                              │  Graph building      │
                              │  Embedding creation  │
                              │                      │
                              │    ┌─────────────┐   │
                              │    │ cognee_db   │   │  ◀── Local PG (pgvector)
                              │    │ (local PG)  │   │      Embeddings + graph
                              │    └─────────────┘   │
                              │                      │
                              │    ┌─────────────┐   │
                              │    │ Kuzu Graph  │   │  ◀── Embedded graph DB
                              │    │ (filesystem)│   │      /app/.cognee_system
                              │    └─────────────┘   │
                              └──────────────────────┘

 ┌─────────────────┐
 │  Redis (:6379)  │
 │                 │
 │ • PII token map │  ◀── Ephemeral re-identification tokens (1h TTL)
 │ • Cognee cache  │  ◀── Session state, query cache
 │ • Rate limiting │  ◀── Per-user rate limits
 └─────────────────┘
```

### 3.2 Data Flow: Transaction Indexing (RAG Pipeline)

The most common Cognee operation — indexing transactions — follows this path:

```typescript
// Current flow (rag.ts):
//   db.select(transactions) → format → cogneeClient.add() → cogneeClient.cognify()
//
// New flow (rag.ts with Neon + masking):
//   neonDb.select(transactions)     ← Read from Neon (or masked branch for AI)
//     → PiiRedactor.redactBatch()   ← Strip residual free-text PII
//     → cogneeClient.add()          ← HTTP POST to Cognee (unchanged)
//     → cogneeClient.cognify()      ← HTTP POST to Cognee (unchanged)
```

**Updated `rag.ts` indexTransactions()**:

```typescript
import { db } from '../schema.js';  // → Neon (accounting data)
import { PiiRedactor } from './pii-redactor.js';

async indexTransactions(transactions: unknown[], userId?: string) {
  if (!USE_COGNEE) return null;

  const redactor = new PiiRedactor();

  // Format transactions to text lines
  const lines = (transactions as Array<Record<string, unknown>>).map(
    (tx) =>
      `Date: ${tx.date}, Description: ${tx.description}, Amount: $${(Number(tx.amount) / 100).toFixed(2)}, Category: ${tx.category}`,
  );

  // Layer 2: Application-layer PII scrub (defense-in-depth)
  const { redactedTexts, combinedMap } = redactor.redactBatch(lines);

  logger.info(`[RAG] Indexing ${lines.length} transactions (${combinedMap.size} PII tokens redacted)`);

  try {
    if (userId) {
      const tools = CogneeTools.forUser(userId);
      await tools.indexAndCognify(redactedTexts, 'bank_transactions');
    } else {
      await cogneeClient.add(redactedTexts, 'bank_transactions');
      await cogneeClient.cognify(['bank_transactions'], true);
    }

    // Store token map for potential re-identification (1h TTL)
    if (combinedMap.size > 0) {
      await piiTokenStore.store(`rag:${Date.now()}`, combinedMap);
    }

    return { status: 'ok' };
  } catch (err) {
    logger.error('[RAG] Cognee indexing failed', err);
    return null;
  }
}
```

### 3.3 Data Flow: Search + Re-identification

```
User Query                    Agent Response
    │                              ▲
    ▼                              │
PiiRedactor.redact(query)     PiiRedactor.reidentify(response, tokenMap)
    │                              ▲
    ▼                              │
cogneeClient.search()    →   CogneeSearchResult[]
    │                              │
    ▼                              │
Cognee Service             Cognee returns masked entities
(searches graph +          (e.g., "PERSON_TOKEN_a1b2 paid $500")
 vector embeddings)
```

### 3.4 Data Flow: Cross-Module Intelligence

Services that need both Neon (accounting) and local PG (AI results):

```typescript
// cross-module-intelligence.ts (updated for dual-DB)
import { db } from '../schema.js';        // → Neon (accounting data)
import { cogneeDb } from '../schema.js';  // → Local PG (AI results)
import { crossModuleInsights } from '../schema.js';

async function runCorrelationScanner(userId: string) {
  // Step 1: Read accounting data from Neon
  const transactions = await db.select().from(transactionsTable)
    .where(eq(transactionsTable.userId, userId))
    .limit(500);

  // Step 2: Search Cognee knowledge graph (HTTP API)
  const patterns = await cogneeClient.search(
    'spending patterns and anomalies',
    'bank_transactions', 10, 'GRAPH_COMPLETION'
  );

  // Step 3: Compute Pearson correlation (in-memory)
  const correlation = computeCorrelation(transactions, patterns);

  // Step 4: Write insight to local PG (not Neon)
  await cogneeDb.insert(crossModuleInsights).values({
    id: crypto.randomUUID(),
    userId,
    insightType: 'correlation',
    title: `Spending correlation: ${correlation.label}`,
    description: correlation.summary,
    confidence: correlation.r,
    modules: JSON.stringify(['transactions', 'forecasting']),
    createdAt: new Date().toISOString(),
  });
}
```

---

## 4. Agent-Cognee-Neon Wiring

### 4.1 Architecture: Why Agents Don't Need Changes

All 26 Claude agents interact with Cognee through a single abstraction layer:

```
Claude Agents (26)
    │
    ▼
CogneeTools class (cognee-tools.ts)
    │
    ▼
CogneeClient class (cognee_client.ts)
    │
    ▼
Cognee REST API (:8000)
```

The agents never make direct database queries for Cognee operations. They call methods like:
- `tools.search(query, dataset, searchType)`
- `tools.index(data, dataset)`
- `tools.temporalSearch(query, timeRange)`
- `tools.crossModuleSearch(query, modules)`

All of these route through `cognee_client.ts` HTTP calls. Since Cognee's database connection is unchanged (still local PG), **no agent code needs modification**.

### 4.2 Agent Categories by Data Access Pattern

| Pattern | Agents | Reads From | Writes To | Bridge Code |
|---------|--------|-----------|-----------|-------------|
| **Read Neon, Search Cognee** | categorizer, merchant-intel, gst-calc, tax-strategy, financial-planner, cross-account-tracer, budget-analyzer | Neon (`db`) | Cognee (HTTP) | None needed — CogneeTools handles |
| **Read Neon, Write Local PG** | forecasting, compliance-monitoring | Neon (`db`) | Local PG (`cogneeDb`) | Import `cogneeDb` for insight storage |
| **Cognee-only** | cdr_product, ocr_processing, payment_matching | Cognee (HTTP) | Cognee (HTTP) | None needed |
| **Read Local PG only** | tenant_routing | Local PG (`cogneeDb`) | Local PG (`cogneeDb`) | Switch to `cogneeDb` import |
| **Orchestrator** | orchestrator, intent-router | Both | Both | Import both `db` + `cogneeDb` |

### 4.3 CogneeTools Enhancement: PII-Safe Indexing

Add PII redaction as a default middleware in CogneeTools:

```typescript
// cognee-tools.ts — new method wrapping existing index()
export class CogneeTools {
  private redactor: PiiRedactor;

  constructor(config?: Partial<CogneeToolConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.redactor = new PiiRedactor();
  }

  /**
   * PII-safe index: redact free-text PII before sending to Cognee.
   * Replaces direct index() calls for any data sourced from Neon.
   */
  async safeIndex(data: string[], datasetName: string, sessionId?: string): Promise<void> {
    const { redactedTexts, combinedMap } = this.redactor.redactBatch(data);

    if (combinedMap.size > 0) {
      logger.info(`[CogneeTools] Redacted ${combinedMap.size} PII tokens before indexing`);
      // Store in Redis for re-identification
      await piiTokenStore.store(`idx:${datasetName}:${Date.now()}`, combinedMap);
    }

    // Delegate to existing index() (which calls cogneeClient.add)
    await this.index(redactedTexts, datasetName);
  }

  /**
   * PII-safe search: redact query, search Cognee, re-identify results.
   */
  async safeSearch(
    query: string,
    datasetName: string,
    searchType: CogneeSearchType = 'CHUNKS',
    sessionId?: string,
  ): Promise<CogneeSearchResult[]> {
    // Redact PII from query
    const { redactedText, tokenMap } = this.redactor.redact(query);

    // Search Cognee with redacted query
    const results = await this.search(redactedText, datasetName, searchType, sessionId);

    // Re-identify any tokens in results
    if (tokenMap.size > 0) {
      return results.map(r => ({
        ...r,
        text: this.redactor.reidentify(r.text, tokenMap),
      }));
    }

    return results;
  }
}
```

### 4.4 Agent Buildtools Updates

The Vercel AI SDK agents (merchant-intelligence, financial-planner, budget-analyzer, tax-strategy, transaction-categorizer) receive tools via `buildTools()`. These tools internally use `CogneeTools`. The only change needed is to use `safeIndex()` / `safeSearch()` instead of `index()` / `search()` when handling Neon-sourced data.

**Example** — `merchant-intelligence.ts` tool update:

```typescript
// Before:
search_merchant_knowledge: tool({
  execute: async ({ query }) => {
    const results = await cogneeTools.search(query, 'merchant_data', 'CHUNKS_LEXICAL');
    return results;
  },
}),

// After (PII-safe):
search_merchant_knowledge: tool({
  execute: async ({ query }) => {
    const results = await cogneeTools.safeSearch(query, 'merchant_data', 'CHUNKS_LEXICAL', sessionId);
    return results;
  },
}),
```

---

## 5. Session Isolation Architecture

### 5.1 Three Isolation Dimensions

The system provides three independent isolation dimensions:

```
┌─────────────────────────────────────────────────────────────────────┐
│                     ISOLATION ARCHITECTURE                          │
│                                                                     │
│  Dimension 1: TENANT ISOLATION (Wave 23)                           │
│  ├── Cognee datasets: tenant_{tenantId}_{datasetName}              │
│  ├── Neon: Row-Level Security or separate branches per tenant      │
│  └── Redis: cognee:tenant:{tenantId}:*                             │
│                                                                     │
│  Dimension 2: USER ISOLATION (Wave 3)                              │
│  ├── Cognee datasets: user_{userId}_{datasetName}                  │
│  ├── Cognee sessions: per-user token, per-user search history      │
│  └── Redis: cognee:user:{userId}:*                                 │
│                                                                     │
│  Dimension 3: SESSION ISOLATION (F7)                               │
│  ├── Cognee session ID: conversational memory within single chat   │
│  ├── PII token map: pii:tokens:{sessionId} (1h TTL)               │
│  └── Redis: cognee:session:{sessionId}:*                           │
│                                                                     │
│  Composed: tenant_T1/user_U1/session_S1 = fully isolated view     │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.2 Neon Branching × Cognee Sessions

Neon branches provide database-level isolation. Combined with Cognee's per-user dataset prefixing:

```
Neon Main (Production)
  │
  ├── ai-operations branch (masked, nightly fork)
  │     └── Server reads masked data for Cognee indexing
  │         └── CogneeTools.forUser(userId).safeIndex(maskedData, dataset)
  │             └── Cognee stores in: user_{userId}_bank_transactions
  │
  ├── dev/feature-xxx branch (developer testing)
  │     └── Developer's own data, unmasked
  │
  └── staging branch (pre-production, weekly fork)
        └── Test data, masked
```

### 5.3 Session Flow: Chat with Cognee Memory (F7)

```typescript
// Full session flow with Neon + masking + Cognee sessions
async function handleChatWithSession(
  query: string,
  userId: string,
  tenantId: string,
  chatSessionId: string,
) {
  const redactor = new PiiRedactor();
  const tokenStore = new RedisPiiTokenStore();

  // 1. Get or create Cognee session (F7)
  const cogneeSession = await cogneeSessionService.getOrCreateCogneeSession(
    userId, chatSessionId
  );

  // 2. Redact user query (PII protection)
  const { redactedText: safeQuery, tokenMap } = redactor.redact(query);
  await tokenStore.store(chatSessionId, tokenMap);

  // 3. Multi-search Cognee with session context
  const tools = CogneeTools.forTenant(tenantId).forUser(userId);
  const [chunks, graphResults] = await Promise.all([
    tools.safeSearch(safeQuery, 'bank_transactions', 'CHUNKS', cogneeSession.id),
    tools.safeSearch(safeQuery, 'bank_transactions', 'GRAPH_SUMMARY_COMPLETION', cogneeSession.id),
  ]);

  // 4. Read recent transactions from Neon for context
  const recentTx = await db.select().from(transactions)
    .where(and(
      eq(transactions.userId, userId),
      eq(transactions.tenantId, tenantId),
    ))
    .orderBy(desc(transactions.date))
    .limit(50);

  // 5. Build LLM prompt with Cognee results + Neon data
  const prompt = buildChatPrompt(safeQuery, chunks, graphResults, recentTx);

  // 6. Call LLM (query already redacted, Neon data goes through as amounts/categories)
  const llmResponse = await callClaudeAgent(prompt);

  // 7. Re-identify tokens in response
  const storedTokens = await tokenStore.retrieve(chatSessionId);
  const finalAnswer = storedTokens
    ? redactor.reidentify(llmResponse, storedTokens)
    : llmResponse;

  // 8. Record conversation turn (F7 session memory)
  await cogneeSessionService.addConversationTurn(cogneeSession.id, {
    query: safeQuery,  // Store redacted query (not raw)
    response: llmResponse,  // Store raw LLM response (may have tokens)
    timestamp: new Date().toISOString(),
  });

  return { answer: finalAnswer };
}
```

### 5.4 Tenant Composition with Neon Branches

For multi-tenant deployments, each tenant can have its own Neon branch:

| Deployment Mode | Neon Branches | Cognee Datasets |
|----------------|---------------|-----------------|
| **Single-tenant** | 1 main + 1 ai-operations | Direct dataset names |
| **Multi-tenant (shared)** | 1 main + 1 ai-operations | `tenant_{id}_` prefix |
| **Multi-tenant (isolated)** | 1 main per tenant + 1 ai-ops per tenant | `tenant_{id}_` prefix + separate branches |

For the initial implementation, use **multi-tenant (shared)** mode — one Neon database with row-level tenant filtering, and Cognee dataset prefixing for AI isolation.

---

## 6. Search with Masked Data

### 6.1 The Masking-Search Challenge

When Cognee indexes masked data, its knowledge graph contains anonymized entities (e.g., "Supplier-XYZ Pty Ltd" instead of "Smith & Jones Accounting"). This creates two challenges:

1. **Query matching**: User searches for "Smith & Jones" but Cognee only knows "Supplier-XYZ"
2. **Response readability**: Cognee returns "Supplier-XYZ had 12 invoices" — user needs real name

### 6.2 Solution: Dual-Layer Search Strategy

```
User Query: "Show invoices from Smith & Jones"
                    │
                    ▼
        ┌───────────────────┐
        │ PiiRedactor.redact│  → "Show invoices from PERSON_TOKEN_a1b2"
        │ (tokenize names)  │     tokenMap: { PERSON_TOKEN_a1b2: "Smith & Jones" }
        └────────┬──────────┘
                 │
         ┌───────▼───────┐
         │ Search Layer 1│  Cognee search (CHUNKS_LEXICAL) on masked data
         │ (structural)  │  → Finds invoices by amount, date, category patterns
         └───────┬───────┘
                 │
         ┌───────▼───────┐
         │ Search Layer 2│  Neon direct query (SQL) on production data
         │ (identity)    │  → SELECT * FROM invoices WHERE supplier ILIKE '%Smith%Jones%'
         └───────┬───────┘
                 │
         ┌───────▼───────┐
         │ Merge + Rank  │  Combine Cognee insights with Neon identity
         │               │  Cognee: pattern analysis, graph relationships
         │               │  Neon: exact records with real names
         └───────┬───────┘
                 │
                 ▼
         Response to user: Real names from Neon + AI insights from Cognee
```

### 6.3 Implementation: Hybrid Search in CogneeTools

```typescript
/**
 * Hybrid search: combines Cognee AI search with Neon identity lookup.
 *
 * For user-facing queries that reference specific entities (people, businesses),
 * Cognee's masked graph provides pattern/relationship insights while Neon
 * provides the real identity resolution.
 */
async hybridSearch(
  query: string,
  userId: string,
  tenantId?: string,
): Promise<{ cogneeInsights: CogneeSearchResult[]; neonRecords: unknown[] }> {
  const redactor = new PiiRedactor();
  const { redactedText, tokenMap } = redactor.redact(query);

  // Parallel: Cognee AI search + Neon SQL search
  const [cogneeResults, neonResults] = await Promise.all([
    // Cognee: structural/pattern search on masked data
    this.search(redactedText, 'bank_transactions', 'GRAPH_COMPLETION'),

    // Neon: identity search on production data (server has direct access)
    this.searchNeonDirect(query, userId, tenantId),
  ]);

  // Re-identify any tokens in Cognee results
  const enrichedCognee = cogneeResults.map(r => ({
    ...r,
    text: tokenMap.size > 0 ? redactor.reidentify(r.text, tokenMap) : r.text,
  }));

  return { cogneeInsights: enrichedCognee, neonRecords: neonResults };
}

/**
 * Direct Neon query for identity resolution.
 * Searches across key tables for entity name matches.
 */
private async searchNeonDirect(
  query: string,
  userId: string,
  tenantId?: string,
): Promise<unknown[]> {
  // Extract entity names from query using simple NLP
  const searchTerms = query.split(/\s+/).filter(w => w.length > 3);

  const results = await db.select().from(transactionsTable)
    .where(and(
      eq(transactionsTable.userId, userId),
      sql`description ILIKE ${`%${searchTerms.join('%')}%`}`,
    ))
    .limit(20);

  return results;
}
```

### 6.4 Search Type Routing by Context

Different search types work differently with masked data:

| Search Type | Masking Impact | Strategy |
|-------------|---------------|----------|
| `CHUNKS` | Low — vector similarity works on semantic meaning | Use directly on masked data |
| `CHUNKS_LEXICAL` | High — keyword match fails on fake names | Supplement with Neon SQL search |
| `GRAPH_COMPLETION` | Medium — graph structure preserved, entity names masked | Use for pattern analysis, not identity |
| `GRAPH_SUMMARY_COMPLETION` | Medium — summaries reference masked names | Post-process with re-identification |
| `RAG_COMPLETION` | Medium — LLM may reference masked entities | Post-process with re-identification |
| `TEMPORAL` | Low — temporal patterns independent of names | Use directly |
| `CYPHER` | Low — graph traversal by structure, not names | Use directly |

---

## 7. MCP Server Updates (F9)

### 7.1 Current MCP Design (F9)

The Cognee MCP Server (Feature F9) is planned as a sidecar with 11 tools:

```
MCP Tools (11):
├── search_knowledge      — Search Cognee graph
├── index_document        — Add document to Cognee
├── cognify_dataset       — Trigger cognify
├── search_temporal       — Temporal search (F17)
├── search_cross_module   — Cross-module search (F17)
├── manage_datapoints     — DataPoint CRUD (F1)
├── apply_ontology        — Apply ontology (F2)
├── submit_feedback       — Search feedback (F4)
├── explore_graph         — Graph exploration (F16)
├── manage_sessions       — Session CRUD (F7)
└── admin_datasets        — Dataset management
```

### 7.2 Neon-Aware MCP Changes

Each MCP tool needs awareness of the dual-database architecture:

```typescript
// MCP Tool: search_knowledge (updated)
{
  name: 'search_knowledge',
  description: 'Search Cognee knowledge graph with optional Neon identity resolution',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      dataset: { type: 'string' },
      searchType: { type: 'string', enum: SEARCH_TYPES },
      includeNeonIdentity: { type: 'boolean', default: false },
      // New: whether to also search Neon for real entity names
    },
  },
  execute: async (input) => {
    if (input.includeNeonIdentity) {
      return cogneeTools.hybridSearch(input.query, userId, tenantId);
    }
    return cogneeTools.safeSearch(input.query, input.dataset, input.searchType);
  },
}

// MCP Tool: index_document (updated with PII redaction)
{
  name: 'index_document',
  description: 'Add document to Cognee with automatic PII redaction',
  inputSchema: {
    type: 'object',
    properties: {
      content: { type: 'string' },
      dataset: { type: 'string' },
      skipRedaction: { type: 'boolean', default: false },
      // skipRedaction only for pre-masked data (from Neon AI branch)
    },
  },
  execute: async (input) => {
    if (input.skipRedaction) {
      return cogneeTools.index([input.content], input.dataset);
    }
    return cogneeTools.safeIndex([input.content], input.dataset);
  },
}
```

### 7.3 MCP Environment Variables

```bash
# MCP Server environment (in docker-compose.yml)
MCP_COGNEE_URL=http://cognee:8000
MCP_NEON_URL=${NEON_DATABASE_URL}        # For identity resolution
MCP_LOCAL_PG_URL=${LOCAL_PG_URL}         # For local Cognee tables
MCP_REDIS_URL=redis://redis:6379         # For PII token store
MCP_PII_REDACTION=true                   # Enable automatic PII redaction
```

---

## 8. Docker Compose Changes

### 8.1 Service-Level Changes Summary

| Service | Change | Details |
|---------|--------|---------|
| `neon-proxy` | NEW | Added by Neon architect (see NEON_INTEGRATION_PLAN.md Section 3.1) |
| `postgres` | MODIFIED | Remove Neon-targeted migration volumes; keep only Cognee + local tables |
| `cognee` | UNCHANGED | Still connects to `postgres:5432/cognee_db` |
| `redis` | UNCHANGED | Same configuration |
| `server` | MODIFIED | Add Neon + masking env vars |
| `client` | UNCHANGED | No backend awareness |

### 8.2 Updated `postgres` Service

The local PG service is simplified — it only hosts Cognee tables and the 13 local AI tables:

```yaml
  postgres:
    image: pgvector/pgvector:pg17
    container_name: cba-postgres
    restart: unless-stopped
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-app_user}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB:-ai_accountant}
    volumes:
      - postgres-data:/var/lib/postgresql/data
      # Cognee DB initialization (unchanged)
      - ./docker/init-cognee-db.sql:/docker-entrypoint-initdb.d/02-extensions.sql:ro
      - ./docker/init-cognee-db.sh:/docker-entrypoint-initdb.d/03-cognee-db.sh:ro
      # NEW: Only local AI tables (replaces 31 migration files)
      - ./docker/migrations/local-pg-init.sql:/docker-entrypoint-initdb.d/04-local-tables.sql:ro
      # Cognee-specific migrations
      - ./docker/migrations/0015_cognee_multi_user.sql:/docker-entrypoint-initdb.d/05-cognee-users.sql:ro
      - ./docker/migrations/0028_cognee_datapoints.sql:/docker-entrypoint-initdb.d/06-cognee-datapoints.sql:ro
      - ./docker/migrations/0029_temporal_intelligence.sql:/docker-entrypoint-initdb.d/07-temporal.sql:ro
    networks:
      - cba-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-app_user} -d ${POSTGRES_DB:-ai_accountant}"]
      interval: 5s
      timeout: 5s
      retries: 15
      start_period: 30s
```

### 8.3 Updated `server` Environment

```yaml
  server:
    environment:
      # ... existing vars (PORT, NODE_ENV, JWT, AI keys, Claude) ...

      # === Database: Neon (primary accounting) ===
      - USE_NEON=${USE_NEON:-false}
      - NEON_DATABASE_URL=${NEON_DATABASE_URL:-}
      - NEON_API_KEY=${NEON_API_KEY:-}
      - NEON_PROJECT_ID=${NEON_PROJECT_ID:-}
      - NEON_BRANCH_ID=${NEON_BRANCH_ID:-main}

      # === Database: Neon AI Branch (masked data for Cognee indexing) ===
      - NEON_AI_BRANCH_URL=${NEON_AI_BRANCH_URL:-}
      - MASKED_DATABASE_URL=${NEON_AI_BRANCH_URL:-}
      - COGNEE_USE_MASKED_BRANCH=${COGNEE_USE_MASKED_BRANCH:-true}

      # === Database: Local PG (Cognee/AI tables) ===
      - LOCAL_PG_URL=postgresql://${POSTGRES_USER:-app_user}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-ai_accountant}

      # === Database: Fallback (single-DB mode when USE_NEON=false) ===
      - DATABASE_URL=postgresql://${POSTGRES_USER:-app_user}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-ai_accountant}
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_NAME=${POSTGRES_DB:-ai_accountant}
      - DB_USER=${POSTGRES_USER:-app_user}
      - DB_PASSWORD=${POSTGRES_PASSWORD}
      - DB_SSL=false

      # === Cognee (unchanged) ===
      - USE_COGNEE=${USE_COGNEE:-true}
      - COGNEE_API_URL=http://cognee:8000

      # === PII Redaction ===
      - PII_REDACTION_ENABLED=${PII_REDACTION_ENABLED:-true}
      - PII_TOKEN_TTL_SECONDS=${PII_TOKEN_TTL_SECONDS:-3600}

      # === Redis ===
      - REDIS_URL=redis://redis:6379

    depends_on:
      postgres:
        condition: service_healthy
      neon-proxy:
        condition: service_healthy
```

### 8.4 Cognee Service (UNCHANGED)

```yaml
  cognee:
    # COMPLETELY UNCHANGED — still connects to local postgres
    environment:
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_NAME=cognee_db
      - VECTOR_DB_URL=postgresql://${POSTGRES_USER:-app_user}:${POSTGRES_PASSWORD}@postgres:5432/cognee_db
      # ... all other vars identical ...
```

---

## 9. F1-F10 Impact Assessment

### Feature Impact Matrix

| ID | Feature | Files Affected | Change Type | Effort |
|----|---------|---------------|-------------|--------|
| **F1** | Custom DataPoint Models | `cognee-datapoints.ts` | `db` → `cogneeDb` import | Low |
| **F2** | Custom Ontologies | `cognee-ontologies.ts` | `db` → `cogneeDb` import | Low |
| **F3** | Custom Pipelines & Tasks | `cognee_client.ts` | None — HTTP API only | None |
| **F4** | Memify Enrichment Rules | `cognee-feedback.ts` | `db` → `cogneeDb` import | Low |
| **F5** | NodeSet Tagging Strategy | `cognee_client.ts` | None — HTTP API only | None |
| **F6** | All 14 Search Types | `cognee-tools.ts` | Add `safeSearch()` wrapper | Medium |
| **F7** | Sessions with Redis | `cognee-sessions.ts` | None — already Redis-only | None |
| **F8** | Multi-Tenant RBAC | `cognee-tools.ts` | Tenant prefix unchanged, add Neon branch routing | Medium |
| **F9** | MCP Server | New sidecar service | Add dual-DB awareness to 11 tools | High |
| **F10** | Agent-Cognee Wiring | 26 agent files | Use `safeSearch`/`safeIndex` | Medium |

### Detailed F1-F10 Analysis

#### F1: Custom DataPoint Models (10 Pydantic classes)

**Impact**: LOW. DataPoint configs are stored in `datapoint_configs` table (local PG). The Pydantic models are sent to Cognee via HTTP as JSON schemas. No Neon interaction.

**Change**: `cognee-datapoints.ts` line 1 — change `import { db }` to `import { cogneeDb as db }`.

#### F2: Custom Ontologies (RDF/OWL Australian finance)

**Impact**: LOW. Ontology definitions stored in `graph_schemas` (local PG). Applied to Cognee via HTTP `cogneeClient.applyOntology()`.

**Change**: `cognee-ontologies.ts` line 1 — change `import { db }` to `import { cogneeDb as db }`.

#### F3: Custom Pipelines & Tasks (5 custom tasks)

**Impact**: NONE. Custom pipeline tasks run inside Cognee's Python environment. They receive data that has already been indexed via HTTP. No database access from pipeline tasks.

#### F4: Memify Enrichment Rules (5 rules)

**Impact**: LOW. Feedback stored in `cognee_feedback` (local PG). Memify triggered via `cogneeClient.memify()` HTTP call.

**Change**: `cognee-feedback.ts` — change `import { db }` to `import { cogneeDb as db }`.

#### F5: NodeSet Tagging Strategy (3-dimensional)

**Impact**: NONE. NodeSet operations are HTTP-only via `cogneeClient.createNodeSet()`, `cogneeClient.tagNodes()`. No direct DB access.

#### F6: All 14 Search Types (smart selection)

**Impact**: MEDIUM. The smart search type selection logic in `cognee-tools.ts` needs to account for masked data:

- `CHUNKS` and `TEMPORAL`: Work well on masked data (semantic similarity preserved)
- `CHUNKS_LEXICAL`: Degraded on masked data (keyword matching on fake names). Must supplement with Neon SQL for identity-based searches.
- `GRAPH_COMPLETION` and `RAG_COMPLETION`: Work on graph structure but return masked entity names. Must post-process with re-identification.

**New search routing logic**:

```typescript
// In CogneeTools — smart type selection with masking awareness
selectSearchType(intent: string, hasMaskedData: boolean): CogneeSearchType {
  if (intent === 'entity_lookup' && hasMaskedData) {
    // Use CHUNKS (semantic) instead of CHUNKS_LEXICAL (keyword)
    // Supplement with Neon SQL for identity resolution
    return 'CHUNKS';
  }
  // ... existing selection logic unchanged ...
}
```

#### F7: Sessions with Redis

**Impact**: NONE. `cognee-sessions.ts` is entirely Redis-based. It stores session state, conversation turns, and query cache in Redis. No PostgreSQL dependency.

The session service already handles:
- Cognee session creation/retrieval
- Conversation turn storage (max 20)
- Query result caching
- Rate limiting

All unchanged by the Neon migration.

#### F8: Multi-Tenant RBAC (full isolation)

**Impact**: MEDIUM. Multi-tenant isolation has two components:

1. **Cognee dataset prefix**: `tenant_{tenantId}_{datasetName}` — unchanged, handled by `cognee_client.ts`
2. **Database isolation**: Currently same PG for all tenants. With Neon, options are:
   - **Shared branch** (recommended for now): Single Neon database, RLS or application-level tenant filtering
   - **Per-tenant branches** (future): Each tenant gets their own Neon branch

**For AI operations**: The masked AI branch already contains all tenants' data (masked). Cognee's dataset prefix provides AI-level isolation. No additional changes needed.

#### F9: MCP Server (sidecar, 11 tools)

**Impact**: HIGH. The MCP server is a new service that will need dual-database awareness. See Section 7 for detailed MCP changes.

Key additions:
- `includeNeonIdentity` parameter on search tools
- PII redaction on index tools
- Dual connection configuration
- Session-aware PII token management

#### F10: Agent-Cognee Wiring (ALL 26 agents)

**Impact**: MEDIUM (but distributed). Each agent's tools need to use `safeSearch()`/`safeIndex()` instead of direct `search()`/`index()`. This is a mechanical change since all agents use `CogneeTools`.

**Migration approach**: Update `CogneeTools` default behavior to always use PII-safe methods when `PII_REDACTION_ENABLED=true`. This makes the change transparent to agents:

```typescript
// In CogneeTools constructor:
constructor(config?: Partial<CogneeToolConfig>) {
  this.config = { ...DEFAULT_CONFIG, ...config };
  this.piiEnabled = process.env.PII_REDACTION_ENABLED === 'true';
  if (this.piiEnabled) {
    this.redactor = new PiiRedactor();
  }
}

// Override search() to auto-redact when PII is enabled:
async search(query: string, dataset: string, type: CogneeSearchType, sessionId?: string) {
  if (this.piiEnabled) {
    return this.safeSearch(query, dataset, type, sessionId);
  }
  // ... existing implementation ...
}
```

This makes F10 effectively **zero changes to agent files** — the behavior change is in the shared CogneeTools layer.

---

## 10. Implementation Sequence

### Phase 1: Foundation (Day 1-2)

- [ ] Create `server/src/services/pii-redactor.ts` (from DATA_MASKING_PLAN.md Section 4)
- [ ] Create `server/src/services/pii-token-store.ts` (Redis-backed token store)
- [ ] Add `safeIndex()` and `safeSearch()` to `CogneeTools` class
- [ ] Add PII auto-enable flag to `CogneeTools` constructor
- [ ] Unit tests for PiiRedactor with Australian PII patterns

### Phase 2: Database Split (Day 3-4)

- [ ] Update `schema.ts` to export `cogneeDb` (from NEON_INTEGRATION_PLAN.md Section 5.4)
- [ ] Change 5 Cognee service files from `db` → `cogneeDb` import:
  - `cognee-datapoints.ts`
  - `cognee-ontologies.ts`
  - `cognee-feedback.ts`
  - `temporal-cognify.ts` (partial — also reads from Neon)
  - `cross-module-intelligence.ts` (dual import)
- [ ] Change RAG files to dual import:
  - `rag.ts` — use Neon for reading, local PG unchanged
  - `rag/namespace-manager.ts` — `cogneeDb`
  - `rag/search/sparse-search.ts` — `cogneeDb`
  - `rag/citations/index.ts` — `cogneeDb`
- [ ] Verify `tsc --noEmit` passes

### Phase 3: PII Integration (Day 5-6)

- [ ] Wire PiiRedactor into `rag.ts` `indexTransactions()`
- [ ] Wire PiiRedactor into `cognee-tools.ts` agent indexing paths
- [ ] Wire PiiRedactor into chat handler (`/api/chat`)
- [ ] Wire PiiRedactor into OCR processing pipeline
- [ ] Integration test: index → search → re-identify round trip

### Phase 4: Neon AI Branch Setup (Day 7-8)

- [ ] Create Neon `ai-operations` branch (from NEON_INTEGRATION_PLAN.md Section 7)
- [ ] Apply masking rules (from DATA_MASKING_PLAN.md Section 2)
- [ ] Configure `NEON_AI_BRANCH_URL` in server
- [ ] Wire masked branch reads into RAG indexing pipeline
- [ ] Verify Cognee can index masked data and return useful search results

### Phase 5: Agent Testing (Day 9-10)

- [ ] Test each agent category (see Section 4.2) with dual-database setup
- [ ] Verify hybrid search works (Cognee AI + Neon identity)
- [ ] Verify multi-tenant isolation with dataset prefixes
- [ ] Verify session isolation with PII token maps
- [ ] Performance benchmark: search latency with masked vs unmasked data

### Phase 6: MCP Server (Day 11-14)

- [ ] Build MCP sidecar service with dual-database configuration
- [ ] Implement 11 tools with Neon-awareness (Section 7.2)
- [ ] Test MCP tools with PII redaction enabled
- [ ] Docker compose integration for MCP service

### Rollback Plan

At any phase, revert to single-database mode:

```bash
# Set USE_NEON=false in .env
# All services fall back to local PG for everything
# PiiRedactor becomes a no-op (no masked branch to read from)
# CogneeTools uses direct search/index (no safe* variants needed)
```

---

## Appendix A: File Change Summary

### Files Modified

| File | Change | LOC Delta |
|------|--------|-----------|
| `server/src/schema.ts` | Add `cogneeDb` export | +10 |
| `server/src/services/cognee-datapoints.ts` | `db` → `cogneeDb` | +1 |
| `server/src/services/cognee-ontologies.ts` | `db` → `cogneeDb` | +1 |
| `server/src/services/cognee-feedback.ts` | `db` → `cogneeDb` | +1 |
| `server/src/services/rag.ts` | Add PiiRedactor, dual import | +30 |
| `server/src/services/rag/namespace-manager.ts` | `db` → `cogneeDb` | +1 |
| `server/src/services/rag/search/sparse-search.ts` | `db` → `cogneeDb` | +1 |
| `server/src/services/rag/citations/index.ts` | `db` → `cogneeDb` | +1 |
| `server/src/services/temporal-cognify.ts` | Dual import | +5 |
| `server/src/services/cross-module-intelligence.ts` | Dual import | +10 |
| `server/src/services/intelligence-subscriptions.ts` | `db` → `cogneeDb` | +1 |
| `server/src/services/claude/cognee-tools.ts` | Add safeIndex, safeSearch, PII auto-enable | +80 |

### Files Created

| File | Purpose | LOC |
|------|---------|-----|
| `server/src/services/pii-redactor.ts` | PII detection + tokenization | ~120 |
| `server/src/services/pii-token-store.ts` | Redis-backed token map | ~60 |
| `server/src/services/cognee-pii-pipeline.ts` | Pipeline wrapper for safe Cognee ops | ~80 |
| `docker/migrations/local-pg-init.sql` | 13 local PG tables only | ~200 |

### Files Unchanged

| File | Reason |
|------|--------|
| `server/src/services/cognee_client.ts` | Already HTTP-only, no DB access |
| `server/src/services/cognee-sessions.ts` | Already Redis-only |
| `server/src/services/cognee-graph.ts` | Already HTTP-only to Cognee |
| `server/src/services/cognee/datasets.ts` | Already uses abstract auth pattern |
| All 26 agent files | CogneeTools abstraction handles changes transparently |
| `docker-compose.yml` cognee service | Still points to local PG |

## Appendix B: Environment Variable Reference

```bash
# === Neon (from NEON_INTEGRATION_PLAN.md) ===
USE_NEON=true                           # Master switch
NEON_DATABASE_URL=postgresql://...      # Production branch
NEON_AI_BRANCH_URL=postgresql://...     # Masked branch for AI
NEON_API_KEY=neon_api_key_xxx           # Branch management API
NEON_PROJECT_ID=proj_xxx                # Neon project
NEON_BRANCH_ID=main                     # Current branch

# === Local PG (unchanged) ===
LOCAL_PG_URL=postgresql://...@postgres:5432/ai_accountant
COGNEE_DATABASE_URL=postgresql://...@postgres:5432/cognee_db

# === PII Redaction (new) ===
PII_REDACTION_ENABLED=true              # Auto-redact in CogneeTools
PII_TOKEN_TTL_SECONDS=3600              # Redis token TTL (1 hour)
COGNEE_USE_MASKED_BRANCH=true           # Use AI branch for indexing

# === Cognee (unchanged) ===
USE_COGNEE=true
COGNEE_API_URL=http://cognee:8000

# === Redis (unchanged) ===
REDIS_URL=redis://redis:6379
```

## Appendix C: Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Cognee search quality degrades with masked data | Medium | Medium | Dual-layer search (Section 6.2) + CHUNKS semantic search unaffected |
| PiiRedactor false positives (masks non-PII) | Medium | Low | Allowlist common financial terms; tune patterns; monitor redaction stats |
| PiiRedactor false negatives (misses PII) | Low | High | Defense-in-depth: DB masking catches what regex misses |
| Cross-network latency Neon → Server | Low | Medium | Neon in ap-southeast-2 (Sydney); <10ms typical |
| Redis token store memory pressure | Low | Low | 1h TTL; LRU eviction; monitor with `redis-cli info memory` |
| Neon branch sync delay (nightly fork) | Medium | Low | Data is ≤24h stale for AI; acceptable for pattern analysis |
| Agent behavior change with PII-safe methods | Low | Medium | CogneeTools auto-enable is transparent; integration tests verify |
