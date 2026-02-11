# RAG + Tooling Integration Audit (T6)

**Auditor:** Teammate 6 — RAG + Tooling Integration Engineer
**Date:** 2026-02-11
**Scope:** Cognee tool schemas, local RAG pipeline (dense/sparse/fusion/reranking), tool-use loop behavior, bounded loops, retrieval quality
**Status:** COMPLETE

---

## Executive Summary

The codebase contains **three parallel RAG pathways** that are almost entirely disconnected from each other:

| Pathway | Files | Used in Production? |
|---------|-------|---------------------|
| **1. Cognee via `cogneeTools`** | `claude/cognee-tools.ts` | Yes — all 7 Claude agents use it |
| **2. Cognee via `ragService`** | `services/rag.ts` | Yes — chat endpoint + pipeline indexing |
| **3. Cognee via `cogneeClient`** | `services/cognee_client.ts` | Yes — pipeline + enrichment |
| **4. Local RAG pipeline** | `rag/search/`, `rag/reranking/`, `rag/chunking/`, `rag/citations/`, `rag/namespace-manager.ts` | **NO — 100% dead code** |

The local RAG pipeline (~3,500 lines) is never imported or called by any route, agent, or service. It is architecturally sound but completely disconnected.

**Critical Findings: 5** | **High Findings: 6** | **Medium Findings: 8** | **Low Findings: 4**

---

## 1. Cognee Tool Schemas Audit (`cognee-tools.ts`)

### 1.1 CogneeTools Class — Schema Issues

**[CRITICAL] C1: No input validation on `search()` or `index()` parameters**
`cognee-tools.ts:32-62` — The `search()` method accepts arbitrary `query: string` and `dataset: string` with zero validation. No length bounds, no sanitization.

- `query` could be megabytes of text, causing Cognee to OOM
- `dataset` could contain path traversal characters or SQL injection patterns
- The `index()` method at `:67-88` accepts unbounded `data: string[]` — a 10,000-element array with 1MB strings each would be sent in batches of 50, but each batch could still be enormous

**[HIGH] H1: JSON body for `/api/v1/add` — protocol mismatch with Cognee API**
`cognee-tools.ts:72-79` — Sends JSON body `{ data: batch, dataset_name: ... }`, but the Cognee `/api/v1/add` endpoint expects **multipart form data** with `UploadFile`.

- `rag.ts:47-78` correctly uses `FormData` with `Blob` for the same endpoint
- `cognee_client.ts:251-264` also uses JSON — same bug
- This means `cogneeTools.index()` silently fails (Cognee returns 422 Unprocessable Entity) and the agent gets no error feedback

**[MEDIUM] M1: No request timeouts on any Cognee HTTP call**
`cognee-tools.ts:34-43`, `:72-84`, `:95-107` — All three methods use bare `fetch()` with no `AbortSignal.timeout()`. If Cognee hangs, these calls hang forever, blocking the agent loop.

- Contrast with `rag.ts:143` which correctly uses `AbortSignal.timeout(5000)` on health check
- But `rag.ts:18,58` also has no timeout on data operations

**[MEDIUM] M2: Search query field name mismatch**
`cognee-tools.ts:38` uses `query_text` and `query_type: 'INSIGHTS'`
`rag.ts:125` uses `query` and `search_type: 'GRAPH_COMPLETION'`

Both target the same Cognee `/api/v1/search` endpoint but use different field names and query types. At least one is wrong and silently returning empty results.

### 1.2 `CogneeToolConfig` — Defaults

`cognee-tools.ts:16-20`:
- `searchTopK: 5` — reasonable
- `indexBatchSize: 50` — reasonable
- `datasetPrefix: ''` — no prefix applied by default, which means agents write to bare dataset names like `bank_transactions`, `merchant_mappings`, etc.

No issues with defaults themselves, but the lack of a `maxPayloadSize` config means unbounded payloads.

---

## 2. Local RAG Pipeline Audit (`rag/` directory)

### 2.1 Connection Status — DEAD CODE

**[CRITICAL] C2: Entire local RAG pipeline is dead code — never imported**

Grep across the entire `server/src/` tree shows:
- `hybridSearchEngine`, `hybridSearch`, `semanticSearch`, `keywordSearch` — **zero imports** outside `rag/search/index.ts`
- `rerankerPipeline`, `crossEncoderReranker`, `financialBooster` — **zero imports** outside `rag/reranking/index.ts`
- `TransactionChunker`, `createTransactionChunker` — **zero imports** outside `rag/chunking/index.ts`
- `citationManager`, `CitationManager` — **zero imports** outside `rag/citations/index.ts`
- `namespaceManager`, `NamespaceManager` — **zero imports** outside `rag/namespace-manager.ts`

No route handler, no agent, no pipeline step, no background job imports anything from `rag/`. All RAG goes through Cognee REST API via `ragService`, `cogneeTools`, or `cogneeClient`.

### 2.2 Dense Search (`rag/search/dense-search.ts`)

Despite being dead code, the implementation quality is auditable:

**[HIGH] H2: Embedding model dimension mismatch with Docker/Cognee**
`dense-search.ts:60-65` — Hardcodes `BAAI/bge-small-en-v1.5` (384 dimensions).
`namespace-manager.ts:63-68` — Also hardcodes `BAAI/bge-small-en-v1.5` (384 dims).
But Docker's Cognee is configured with `text-embedding-3-small` (1536 dimensions). If the local pipeline were ever activated alongside Cognee, stored embeddings would be incompatible.

**[MEDIUM] M3: Python subprocess embedding generation — fragile**
`dense-search.ts:92-160` — Calls `venv/Scripts/python.exe` (Windows path!) via `child_process.spawn`. In Docker (Linux), this path doesn't exist. The fallback at `:166-191` produces random hash-based embeddings that would make semantic search useless.

**[LOW] L1: In-memory cosine similarity scan — O(N) per query**
`dense-search.ts:224-354` — Fetches chunks in batches of 500, computes cosine similarity in JS for each. With 5000 chunks this is ~5000 float multiplications per query. Not a bug, but won't scale. The comment at `:223` acknowledges this.

### 2.3 Sparse Search (`rag/search/sparse-search.ts`)

**[HIGH] H3: SQLite FTS5 — incompatible with PostgreSQL deployment**
`sparse-search.ts:68-120` — Creates `sqlite_master` queries and `CREATE VIRTUAL TABLE ... USING fts5(...)`. The production database is PostgreSQL. These queries would fail immediately if the pipeline were activated.

- Trigger syntax at `:93-112` is SQLite-specific
- BM25 function at `:299` is FTS5-specific

The fallback LIKE search at `:415-523` would work on PG but has poor performance.

**[MEDIUM] M4: Filter conditions built but not all applied in FTS5 path**
`sparse-search.ts:306-329` — Builds `filterConditions` and `filterParams` arrays but never uses them in the actual SQL execution at `:337`. The comment at `:336` acknowledges this: "In production, you'd want to properly parameterize this." The namespace, category, account, date, and minScore filters are constructed but discarded.

### 2.4 Fusion (`rag/search/fusion.ts`)

Well-implemented RRF with `k=60`, dense weight `0.6`, sparse weight `0.4`. No issues found. The `fuseWithWeights()` method correctly normalizes weights. Score normalization utility function is correct.

### 2.5 Hybrid Search Engine (`rag/search/index.ts`)

**[MEDIUM] M5: `searchFinancial()` hardcodes equal weights**
`search/index.ts:396-404` — Financial search uses `denseWeight: 0.5, sparseWeight: 0.5` but this is overridable via `options` spread. Not a bug but the default differs from the standard 0.6/0.4 without documented justification.

Parallel execution of dense + sparse search at `:247-250` is correct. Error handling gracefully degrades each retriever independently.

### 2.6 Cross-Encoder Reranking (`rag/reranking/cross-encoder.ts`)

**[MEDIUM] M6: Python subprocess path hardcoded to Windows**
`cross-encoder.ts:102` — `path.resolve(__dirname, '../../../../venv/Scripts/python.exe')` — Windows-only path, won't work in Docker Linux container.

**[LOW] L2: No Cohere API key configured by default**
`cross-encoder.ts:479-481` — `cohereApiKey: process.env.COHERE_API_KEY` — if not set, both local and Cohere fallback chains produce empty results, making the reranker a no-op.

### 2.7 Financial Domain Boost (`rag/reranking/financial-boost.ts`)

Well-designed boost system with:
- Merchant match: 0.3 boost with exact/partial/fuzzy tiers
- Category match: 0.2 boost
- Recency: 0.2 max with linear decay (30–365 days)
- Amount range: 0.15 boost
- Account match: 0.15 boost
- Combined weight: 50% original + 50% boosted

Context extraction from natural language queries (amount ranges, merchants, categories) is sophisticated. No issues found in the logic.

### 2.8 Chunking (`rag/chunking/index.ts`)

Five chunk types with appropriate token targets:
- Single transaction: 100-200 tokens
- Transaction group: 300-500 tokens
- Temporal window: 500-800 tokens
- Category summary: 200-300 tokens
- Account context: 400-600 tokens

**[LOW] L3: Token estimation uses 4 chars/token heuristic**
`chunking/index.ts:141-143` — `Math.ceil(text.length / 4)` — rough approximation that can be 30% off for financial text with numbers and special characters.

**[LOW] L4: Overlap not implemented**
`chunking/index.ts:874-879` — `applyOverlap()` is a no-op stub that returns chunks unchanged despite `enableOverlap: true` being the default config.

### 2.9 Citations (`rag/citations/index.ts`)

Comprehensive citation system with:
- Source verification (chunk still exists)
- Feedback tracking (wasHelpful)
- Orphan cleanup
- Deep links to transactions/accounts
- Batch N+1 query prevention (`:326-369`)

**[MEDIUM] M7: Snippet extraction is naive**
`citations/index.ts:688-709` — `extractSnippet()` takes the first N characters or sentences from the chunk. It doesn't use the `answerText` parameter to find the most relevant portion, despite accepting it. The semantic overlap opportunity is wasted.

### 2.10 Namespace Manager (`rag/namespace-manager.ts`)

Multi-tenant isolation model with per-user namespaces. Document deduplication via content hash. Proper cascading deletes (namespace → documents → chunks → citations).

**[HIGH] H4: `getNamespace()` bypasses multi-tenant isolation**
`namespace-manager.ts:161-169` — Does NOT filter by userId. The docstring at `:159` warns "does not enforce multi-tenant isolation" and recommends `getNamespaceForUser()`, but internal methods like `updateNamespace()` at `:207` and `deleteNamespace()` at `:245` both use the non-isolated `getNamespace()`.

---

## 3. Base Agent Tool-Use Loop (`base-agent.ts`)

### 3.1 Bounded Loop

**Loop ceiling:** `maxIterations = budget.maxToolCalls + 2` (`base-agent.ts:57`)

Per-agent budgets from `config.ts`:

| Agent | maxToolCalls | maxIterations | maxOutputTokens |
|-------|-------------|---------------|-----------------|
| statement_parser | 10 | 12 | 8,000 |
| transaction_categorizer | 5 | 7 | 8,000 |
| gst_calculator | 8 | 10 | 4,000 |
| account_reconciler | 8 | 10 | 4,000 |
| budget_analyzer | 8 | 10 | 8,000 |
| cross_account_tracer | 6 | 8 | 4,000 |
| merchant_intelligence | 15 | 17 | 8,000 |

The loop is properly bounded. Both iteration count AND tool call count are checked.

### 3.2 Tool Error Propagation

**[HIGH] H5: Tool errors don't break the loop — silently continue**
`base-agent.ts:138-148` — When a tool handler throws, the error is caught and returned as `is_error: true` with error message to the LLM. The LLM then decides whether to retry. This is correct for agentic behavior BUT:

- There's no error counter — a tool that always fails will consume the entire tool budget
- The LLM could repeatedly retry the same failing tool (e.g., Cognee down → search fails → LLM retries search → fails again)
- No circuit breaker integration at the tool level (the `AgentCircuitBreaker` in `retry.ts` is only used at the API call level for `retryWithBackoff`)

### 3.3 Stop Condition Bug

**[HIGH] H6: Mixed tool_use + text with `stop_reason: 'end_turn'` drops tool calls**
`base-agent.ts:83-101` — When the response contains BOTH `tool_use` blocks AND text, and `stop_reason` is `end_turn`:

```typescript
if (toolUseBlocks.length === 0 || response.stop_reason === 'end_turn') {
    // ... extract text ...
    if (toolUseBlocks.length === 0) {
        // Only return here if no tool calls
        const parsed = this.parseJsonOutput(textBlock.text);
        return { ...parsed, usage };
    }
}
```

Line 98 correctly prevents returning when there are tool_use blocks. BUT lines 83-96 still execute the text extraction branch. The tool_use blocks ARE then processed below at line 113. However, the logic flow is confusing and fragile — if the condition at line 83 is `end_turn` but there ARE tool blocks, we fall through to process them. The text block extracted at line 84-86 is discarded. This works but is error-prone for future maintenance.

### 3.4 Input Token Budget — NOT enforced

`config.ts` defines `maxInputTokens` per agent (e.g., 50,000 for categorizer), but `base-agent.ts` never checks input token usage against this budget. Only `outputTokens` are capped via `max_tokens` in the API call, and `toolCalls` are budget-checked. Input token accumulation across loop iterations is tracked but never compared to `maxInputTokens`.

---

## 4. Categorizer Loop Verification

### 4.1 Workflow (`transaction-categorizer.ts`)

1. **get_category_taxonomy** (`:82-88`) → Returns static list of 35 categories. Correct.
2. **lookup_merchant_memory** (`:46-60`, handler at `:125-141`) → In-memory search of `existingMerchantMemory` from input. Uses substring matching. Correct.
3. **search_similar_transactions** (`:62-79`, handler at `:145-148`) → Calls `cogneeTools.search(description, 'bank_transactions')`. Returns Cognee results.
4. **batch_categorize** (`:89-110`, handler at `:157-189`) → Rule-based pre-categorization with hardcoded patterns (Woolworths→Groceries, etc.).

### 4.2 Learning Loop — INCOMPLETE

**[CRITICAL] C3: Categorizer does NOT store new mappings back to Cognee**
The categorizer's `toolHandlers` map has no `store_merchant_mapping` or equivalent tool. After categorizing a transaction, the result is returned but not persisted to Cognee. The merchant intelligence agent (`merchant-intelligence.ts:297-312`) DOES store mappings, but the categorizer doesn't call it.

This means the "search → categorize → store mapping → improved next run" loop is broken at the "store" step for the categorizer agent. Only the merchant intelligence agent completes the learning cycle.

### 4.3 Merchant Memory Source

`transaction-categorizer.ts:201-203` — `this.merchantMemory = input.existingMerchantMemory || []`. The memory comes from the caller (pipeline), not from Cognee. If the pipeline doesn't pass historical mappings, the agent has no memory.

---

## 5. RAG for Context Only — Accuracy Contract

### 5.1 Chat Endpoint (`index.ts:928-955`)

```typescript
const ragResults = await ragService.search(query, settings.modelChat);
ragContext = JSON.stringify(ragResults.results);
const combinedContext = {
    recentTransactions: context,  // 50 recent transactions
    semanticSearchResults: ragContext
};
const answer = await aiService.generateInsight(query, combinedContext, settings.modelChat);
```

RAG results are passed as `semanticSearchResults` context to the AI. The AI generates a natural language answer. RAG is NOT used for computing totals — it provides conversational context only. **Contract satisfied for chat.**

### 5.2 Agent Tools

All agent tool handlers that use `cogneeTools.search()` return search results as context for the LLM to reason over:
- `transaction-categorizer.ts:147` — search results feed into categorization reasoning
- `merchant-intelligence.ts:169-173` — search results inform merchant resolution
- `gst-calculator.ts:551` — GST rulings provide context, not computation
- `budget-analyzer.ts:344` — insights search provides context
- `account-reconciler.ts:310` — pattern search provides context
- `cross-account-tracer.ts:288` — transfer pattern search provides context

**No agent uses RAG results to compute financial totals.** All computations are done by the agent's own logic or by the LLM's reasoning. **Contract satisfied for agents.**

---

## 6. cogneeTools vs cogneeClient vs ragService — Duplication Analysis

### 6.1 Three Separate Cognee Clients

| Client | File | Search Field | Query Type | Add Method | Used By |
|--------|------|-------------|------------|------------|---------|
| `cogneeTools` | `claude/cognee-tools.ts` | `query_text` | `INSIGHTS` | JSON body | 7 Claude agents |
| `ragService` | `services/rag.ts` | `query` | `GRAPH_COMPLETION` | Multipart FormData | Chat endpoint, pipeline |
| `cogneeClient` | `services/cognee_client.ts` | `query_text` | `INSIGHTS` | JSON body | Pipeline, enrichment |

**[CRITICAL] C4: Three clients for the same API with inconsistent protocols**

- **Search field names differ:** `cogneeTools` and `cogneeClient` use `query_text` + `INSIGHTS`. `ragService` uses `query` + `GRAPH_COMPLETION`. Only one can be correct for the actual Cognee API.
- **Add method differs:** `ragService.cogneeAddData()` correctly uses `FormData`. `cogneeTools.index()` and `cogneeClient.add()` use JSON. The Cognee `/api/v1/add` expects `UploadFile` multipart — so the JSON callers silently fail.
- **Top-K differs:** `cogneeTools` uses `searchTopK: 5`, `ragService` uses `top_k: 10`, `cogneeClient` uses `top_k: 5`.

### 6.2 Functional Overlap

`cogneeClient` is a superset of `cogneeTools` for domain operations:
- Both search the same Cognee datasets
- `cogneeClient` adds higher-level methods (`storeMerchantMapping`, `lookupMerchant`, `batchLookupMerchants`)
- `cogneeTools` is simpler and used exclusively by Claude agents
- `ragService` overlaps with both for search/index but uses different protocols

---

## 7. Citation Tracking Accuracy

### 7.1 System Architecture

The citation system in `rag/citations/index.ts` is **dead code** (see C2). It was designed to:
- Record which RAG chunks contributed to each AI answer
- Track relevance and rerank scores
- Link to original transactions and accounts
- Support user feedback (wasHelpful)
- Verify source existence
- Format for UI display

### 7.2 Quality Assessment (if activated)

The implementation is thorough:
- Deduplication via content hash (`:298`)
- Batch N+1 prevention (`:326-369`)
- Orphan cleanup (`:662-679`)
- Deep links to transactions/accounts (`:762-771`)

**[MEDIUM] M8: `extractSnippet()` ignores answer text**
`citations/index.ts:688-709` — The `answerText` parameter is accepted but unused. Snippets are just the first ~200 characters of chunk content, not the most relevant portion to the answer.

---

## 8. Base Agent Loop Bounds and Token Budget

### 8.1 Iteration Bounds — ENFORCED

- `base-agent.ts:57` — `maxIterations = budget.maxToolCalls + 2`
- `base-agent.ts:59` — `while (iterations < maxIterations)` — hard ceiling
- `base-agent.ts:162-164` — Throws on exceeded iterations

### 8.2 Tool Call Budget — ENFORCED

- `base-agent.ts:105-109` — Pre-checks accumulated + pending tool calls against `budget.maxToolCalls`
- Throws before executing if budget would be exceeded

### 8.3 Output Token Budget — ENFORCED

- `base-agent.ts:65` — `max_tokens: budget.maxOutputTokens` — passed to Anthropic API
- Anthropic enforces this server-side

### 8.4 Input Token Budget — NOT ENFORCED

- `base-agent.ts:73` — Input tokens are tracked: `usage.inputTokens += response.usage?.input_tokens ?? 0`
- But `AGENT_TOKEN_BUDGETS[*].maxInputTokens` is never compared against `usage.inputTokens`
- Context window can grow unbounded across iterations (tool results accumulate in `messages`)

---

## 9. Retry and Circuit Breaker (`retry.ts`)

### 9.1 Retry with Backoff

- `retry.ts:13-53` — Exponential backoff with 20% jitter
- Config: 3 retries, 1s initial, 30s max, 2x multiplier
- Only retries `rate_limit_error`, `overloaded_error`, `api_error`
- **Correct:** Non-retryable errors thrown immediately

### 9.2 Circuit Breaker

- `retry.ts:58-104` — Standard 3-state (closed/open/half-open)
- Threshold: 5 failures, 60s recovery
- **Issue:** Only used at the `retryWithBackoff` level in `base-agent.ts:62`. Individual tool calls (Cognee search, index) have no circuit breaker. If Cognee is down, each tool call will independently timeout/fail, consuming the agent's tool budget.

---

## Findings Summary

### Critical (Must Fix)

| ID | Finding | File:Line | Impact |
|----|---------|-----------|--------|
| C1 | No input validation on Cognee tool parameters | `cognee-tools.ts:32,67` | Unbounded payloads can OOM Cognee |
| C2 | Entire local RAG pipeline (~3500 LOC) is dead code | `rag/**/*` | Wasted complexity, confusing architecture |
| C3 | Categorizer doesn't store new mappings — learning loop broken | `transaction-categorizer.ts` (missing store tool) | No continuous improvement from categorization |
| C4 | Three Cognee clients with inconsistent protocols | `cognee-tools.ts`, `rag.ts`, `cognee_client.ts` | Silent failures, wrong query types, JSON vs multipart |

### High

| ID | Finding | File:Line | Impact |
|----|---------|-----------|--------|
| H1 | `cogneeTools.index()` uses JSON body, Cognee expects multipart | `cognee-tools.ts:72-79` | Indexing silently fails for agent tool |
| H2 | Embedding dimension mismatch (384 vs 1536) if local RAG activated | `dense-search.ts:60-65` | Incompatible vector search |
| H3 | FTS5 SQLite syntax incompatible with PostgreSQL | `sparse-search.ts:68-120` | Would crash on PG if activated |
| H4 | `getNamespace()` bypasses multi-tenant isolation | `namespace-manager.ts:161-169` | Cross-tenant data access risk |
| H5 | Tool errors in agent loop have no per-tool circuit breaker | `base-agent.ts:138-148` | Failing tools consume entire budget |
| H6 | Mixed tool_use + text stop condition logic is fragile | `base-agent.ts:83-101` | Maintenance risk, potential future bugs |

### Medium

| ID | Finding | File:Line | Impact |
|----|---------|-----------|--------|
| M1 | No request timeouts on Cognee HTTP calls | `cognee-tools.ts:34,72,95` | Hangs if Cognee unresponsive |
| M2 | Search query field name mismatch (`query_text` vs `query`) | `cognee-tools.ts:38` vs `rag.ts:125` | One client silently gets empty results |
| M3 | Dense search Python path hardcoded to Windows | `dense-search.ts:100` | Won't work in Docker Linux |
| M4 | FTS5 filter conditions built but never applied | `sparse-search.ts:306-337` | Filters silently ignored |
| M5 | Financial search hardcodes equal weights without justification | `search/index.ts:398-399` | Suboptimal retrieval for financial queries |
| M6 | Cross-encoder Python path hardcoded to Windows | `cross-encoder.ts:102` | Won't work in Docker Linux |
| M7 | Citation snippet extraction ignores answer text | `citations/index.ts:688-709` | Suboptimal snippet relevance |
| M8 | Input token budget tracked but never enforced | `base-agent.ts:73` + `config.ts:11-53` | Context can grow unbounded |

### Low

| ID | Finding | File:Line | Impact |
|----|---------|-----------|--------|
| L1 | O(N) cosine similarity scan in dense search | `dense-search.ts:293-310` | Won't scale beyond ~5000 chunks |
| L2 | No Cohere API key means reranker is a no-op | `cross-encoder.ts:479-481` | Reranking stage produces empty results |
| L3 | Token estimation uses 4 chars/token heuristic | `chunking/index.ts:141-143` | ~30% error margin |
| L4 | Chunk overlap is a no-op stub | `chunking/index.ts:874-879` | Config misleading |

---

## Recommendations

### Immediate (Block Production)

1. **Consolidate Cognee clients** — Merge `cogneeTools`, `ragService`, and `cogneeClient` into a single client with correct multipart upload for `/api/v1/add` and consistent search parameters
2. **Add request timeouts** — All Cognee HTTP calls need `AbortSignal.timeout(10000)` minimum
3. **Add input validation** — Max query length (e.g., 10,000 chars), max payload size for indexing

### Short-Term

4. **Fix categorizer learning loop** — Add `store_merchant_mapping` tool to categorizer agent, or call merchant intelligence agent after categorization
5. **Enforce input token budget** — Add check in `base-agent.ts` loop: `if (usage.inputTokens > budget.maxInputTokens) throw`
6. **Add per-tool circuit breaker** — If Cognee search fails 3 times in an agent session, skip further search calls

### Long-Term

7. **Decide local RAG pipeline fate** — Either:
   - (a) Delete the ~3,500 lines of dead code, or
   - (b) Wire it into the application (requires PG-compatible FTS, embedding service, route integration)
8. **If keeping local RAG:** Fix SQLite→PostgreSQL compatibility, Windows→Linux paths, dimension alignment with Cognee embeddings
