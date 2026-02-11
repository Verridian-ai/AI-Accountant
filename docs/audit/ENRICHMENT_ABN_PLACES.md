# Audit Report: ABN + Places Enrichment Pipeline

**Auditor:** Teammate 7 — ABN + Places Enrichment Engineer
**Date:** 2026-02-11
**Scope:** Enrichment pipeline, ABN lookup integration, Google Places/Geocoding integration, caching, rate limiting, idempotent merchant enrichment
**Status:** READ-ONLY audit — no files modified

---

## Executive Summary

The enrichment pipeline has a solid three-stage architecture (Merchant Intelligence → Rule-based GST → DB+Cognee persistence) with dual-persistence design. However, several critical gaps exist:

1. **ABN lookup is simulated** — the `lookup_abn` tool handler uses heuristics, not the real ABR API. No `RAPIDAPI_KEY`, `ABNLOOKUP_GUID`, or `GOOGLE_MAPS_API_KEY` env vars are referenced anywhere in the codebase.
2. **Google Places adapter does not exist** — no Places/Geocoding integration whatsoever.
3. **No dedicated enrichment adapter files** — `server/src/services/enrichment/abn.ts` and `server/src/services/enrichment/places.ts` do not exist.
4. **No merchant-level caching** — repeated enrichment of the same merchant description will re-invoke the Claude agent each time. The orchestrator cache exists but is not wired to the enrichment service.
5. **Rate limiting is absent** for external API calls (currently moot since no external APIs are called).
6. **Type mismatch** between `MerchantIntelligenceOutput.results` and what `enrichment.ts` destructures.

---

## 1. Enrichment Pipeline Architecture

### File: `server/src/services/enrichment.ts` (304 lines)

**Three-stage flow:**

| Stage | Description | Implementation |
|-------|-------------|----------------|
| 1. Merchant Intelligence | Claude agent resolves abbreviated names → canonical names, GST status | `enrichment.ts:109-135` via `MerchantIntelligenceAgent.invoke()` |
| 2. Category fallback | Match against `merchantMemory` patterns if stage 1 didn't resolve | `enrichment.ts:150-159` (in-memory pattern matching) |
| 3. GST calculation | Rule-based `inferGstCategory()` using category → GST mapping | `enrichment.ts:163-169` (non-AI, uses `calculateGstFromInclusive`) |

**Entry points (3 routes + 2 pipeline integrations):**
- `POST /api/enrichment/run` → `enrichmentService.enrichUncategorized()` (`routes/pipeline.ts:140-157`)
- `POST /api/enrichment/batch` → `enrichmentService.enrichTransactions()` (`routes/pipeline.ts:163-186`)
- `POST /api/enrichment/merchant-resolve` → direct `orchestrator.invoke('merchant_intelligence', ...)` (`routes/pipeline.ts:355-392`)
- `services/pipeline.ts:524-530` — agent path calls `enrichmentService.enrichTransactions()` for uncategorized after parsing
- `services/pipeline.ts:899-906` — legacy path calls `enrichmentService.enrichTransactions()` after categorization

### Finding 1.1: Type Mismatch in Enrichment Results Destructuring

**Severity: HIGH**

`enrichment.ts:101-107` expects merchant results with shape:
```ts
{ transactionId: number; canonicalName: string; gstRegistered: boolean;
  defaultCategory: string; confidence: number; }
```

But `MerchantIntelligenceOutput` (`claude/types.ts:288-308`) defines results as:
```ts
{ transactionId: number; abbreviatedName: string; canonicalName: string;
  abn?: string; gstRegistered: boolean; industry?: string;
  defaultCategory: string; confidence: number; source: 'cognee' | 'online' | 'pattern' | 'unknown'; }
```

The enrichment service uses `.canonicalName` and `.defaultCategory` which exist on both, but **it ignores `abn` and `industry`** — these fields are never persisted to the `transactions` table from enrichment (only stored in `merchantMemory` via `newMappings`). This means ABN data gathered by the agent is partially lost for individual transactions.

**Reference:** `enrichment.ts:147-148` — only uses `canonicalName` for `merchantNormalized`, ignores ABN.

### Finding 1.2: Sequential Transaction Fetching

**Severity: MEDIUM (Performance)**

`enrichment.ts:79-82` fetches transactions one-by-one in a loop:
```ts
for (const id of transactionIds) {
  const tx = await db.select().from(transactions).where(eq(transactions.id, id)).get();
  if (tx) txList.push(tx);
}
```

This should use a single `WHERE id IN (...)` query for batch efficiency.

### Finding 1.3: Feature Flag Gating

**Severity: INFO**

The merchant intelligence agent only runs when `USE_CLAUDE_AGENTS=true` AND `AGENT_MERCHANT_INTELLIGENCE=true` (or unset, defaults to true when master is on). See `config.ts:80-89`.

Currently `.env.example` has `USE_CLAUDE_AGENTS=false`, so the entire Stage 1 is skipped by default, falling through to the pattern-matching fallback at Stage 2.

---

## 2. ABN Lookup Integration

### File: `server/src/utils/abn.ts` (234 lines)

**What exists:**
- `validateABN(abn)` — full ATO checksum algorithm implementation (`abn.ts:26-70`)
- `formatABN(abn)` — standard spacing `XX XXX XXX XXX` (`abn.ts:78-82`)
- `normalizeABN(abn)` — strip to 11 digits (`abn.ts:90-94`)
- `ENTITY_TYPES` constant — individual, sole trader, partnership, company, trust, SMSF (`abn.ts:99-130`)
- `BAS_FREQUENCIES` constant — monthly, quarterly, annually (`abn.ts:135-151`)
- `COMMON_ANZSIC_CODES` — ~25 common industry classification codes (`abn.ts:157-203`)
- Helper validators: `validateEntityType`, `validateBasFrequency`, `validateAnzsicCode`, `validateTaxAgentNumber`

**What does NOT exist:**
- **No ABR API client** — No HTTP client for `https://abr.business.gov.au/json/`
- **No RapidAPI ABN adapter** — No code references `RAPIDAPI_KEY` or `RAPIDAPI_ABN_HOST`
- **No `ABNLOOKUP_GUID` usage** — The env var is referenced nowhere in the codebase

### Finding 2.1: `lookup_abn` Tool is a Simulation

**Severity: CRITICAL**

`merchant-intelligence.ts:236-259` — The `lookup_abn` tool handler is explicitly documented as a simulation:
```ts
// ABR API simulation — in production, call https://abr.business.gov.au/json/
// For now, use heuristics based on known patterns
```

It returns `abnFound: false` always and guesses GST status from business name patterns (checking for "pty ltd", "ltd", "group", "australia", "holdings").

**Impact:** No real ABN verification ever occurs. GST registration status is entirely guessed. For an accounting application, this is a significant accuracy gap.

### Finding 2.2: ABN Test Coverage is Good

**Severity: INFO (Positive)**

`server/src/utils/abn.test.ts` (139 lines) has comprehensive tests:
- Valid ABN checksums (ATO, with/without spaces, extra whitespace)
- Invalid ABN checksums (bad checksum, all zeros, wrong digit count, letters)
- Format and normalize functions
- Entity type, BAS frequency, ANZSIC code, tax agent number validators

All test cases are well-structured with Vitest.

### Finding 2.3: `abn.ts` Utilities Are Not Used by Enrichment

**Severity: MEDIUM**

The `validateABN`, `formatABN`, `normalizeABN` functions from `abn.ts` are **never imported or called** by the enrichment pipeline or the merchant intelligence agent. The agent's `lookup_abn` tool doesn't validate ABN format — it just returns heuristic guesses. If a real ABN API were wired in, the validation utilities should be used to validate returned ABNs.

---

## 3. Google Places / Geocoding Integration

### Finding 3.1: No Google Places Integration Exists

**Severity: CRITICAL (if required)**

- No `GOOGLE_MAPS_API_KEY` env var referenced anywhere in the codebase
- No files at `server/src/services/enrichment/places.ts`
- No Google Places, Geocoding, or Maps API calls anywhere in server code
- The grep for "places" and "geocod" across `server/src/` returned zero relevant results
- All "google" references are for `google/gemini-3-flash-preview` (LLM model) or Google Cloud metadata

**Impact:** Merchant enrichment cannot resolve physical locations, addresses, business hours, or verify merchant existence via Google Places. This would be valuable for:
- Verifying merchant legitimacy
- Location-based category inference (e.g., restaurant vs. retail)
- Address enrichment for receipt matching

---

## 4. Caching Assessment

### Finding 4.1: No Merchant-Level Enrichment Cache

**Severity: HIGH**

The enrichment pipeline has **no caching layer** for merchant lookups. If the same merchant (e.g., "WOOLWORTHS 1234 SYDNEY") appears in 50 transactions across multiple statements, the enrichment pipeline will:
1. Invoke the Claude agent 50 times (if processing in separate batches)
2. Hit the Cognee search API 50 times
3. Attempt to store duplicate merchant mappings (mitigated by existence check at `enrichment.ts:226-235`)

**Existing caching infrastructure (not used by enrichment):**

| Cache | Location | Used By |
|-------|----------|---------|
| `AgentResponseCache` (LRU + TTL) | `orchestrator/cache.ts` | Python orchestrator agents only |
| `merchantMemory` DB table | `schema.ts:257-268` | Pattern matching fallback (Stage 2) — but NOT consulted before invoking Stage 1 agent |
| Claude client singleton | `claude/client.ts:13` | Anthropic SDK instance reuse |

The `merchantMemory` table acts as a soft cache: if a merchant pattern already exists, Stage 2 (fallback) will find it. But Stage 1 (Claude agent) still fires unconditionally when enabled, wasting API calls.

### Finding 4.2: Orchestrator Cache Not Wired to Enrichment

**Severity: MEDIUM**

The orchestrator's `AgentResponseCache` (`orchestrator/cache.ts`) supports:
- LRU eviction
- TTL expiry (default config)
- Per-agent-type clearing
- SHA256-based cache keys
- 5-minute periodic cleanup

However, the enrichment service instantiates its own `MerchantIntelligenceAgent` directly (`enrichment.ts:60`) and calls `this.merchantAgent.invoke()` — it does NOT go through the orchestrator, so the cache is never consulted.

Only the `POST /api/enrichment/merchant-resolve` route (`pipeline.ts:369`) uses the orchestrator and would benefit from caching.

---

## 5. Rate Limiting & Retry/Backoff

### Finding 5.1: Retry Infrastructure Exists for Claude API

**Severity: INFO (Positive)**

`claude/retry.ts` provides:
- `retryWithBackoff()` — exponential backoff with jitter (1s initial, 2x multiplier, 30s max, 3 retries)
- `AgentCircuitBreaker` — 5 failures trips, 60s recovery window
- Retryable errors: `rate_limit_error`, `overloaded_error`, `api_error`

The `base-agent.ts:62` wraps all Claude API calls through `retryWithBackoff()`.

### Finding 5.2: No Rate Limiting for External API Calls

**Severity: MEDIUM (currently moot)**

Since ABN lookup and Google Places APIs are not actually called, there is no rate limiting implementation. When these adapters are built, they will need:
- ABR API: Throttle to avoid 429s (ABR has undocumented limits)
- RapidAPI ABN: Respect `X-RateLimit-*` headers
- Google Places: Per-second and per-day quotas based on billing plan

### Finding 5.3: No Quota/Cost Tracking

**Severity: MEDIUM**

No mechanism tracks:
- Claude API token spending per enrichment batch
- Cognee API call volume
- (Future) ABR/Places API call counts

The `TokenUsage` interface exists (`types.ts:46-50`) and `base-agent.ts` tracks tokens, but usage data is returned inline and not persisted or aggregated.

---

## 6. Idempotent Merchant Enrichment

### Finding 6.1: Merchant Mapping Storage is Partially Idempotent

**Severity: MEDIUM**

`enrichment.ts:213-277` — `storeMerchantMapping()` checks for existing patterns before insert:
```ts
const existing = await db.select().from(merchantMemory)
  .where(and(
    eq(merchantMemory.userId, userId),
    eq(merchantMemory.merchantPattern, mapping.abbreviatedName.toLowerCase())
  )).get();
```

If found, it updates `timesUsed` and `lastUsed` (upsert pattern). This is idempotent for the local DB.

**However**, the Cognee `storeMerchantMapping()` call at `enrichment.ts:266-273` is NOT idempotent — it always appends new data to the `merchant_mappings` dataset without checking for duplicates. Over time, Cognee will accumulate duplicate merchant mapping entries.

### Finding 6.2: Transaction Enrichment is Not Idempotent

**Severity: HIGH**

`enrichTransactions()` (`enrichment.ts:69-208`) does not check if a transaction has already been enriched. If called twice with the same IDs:
- `merchantNormalized` gets overwritten (harmless if same value)
- `gstCategory` and `gstAmount` get recalculated and overwritten
- `category` is only set if `!tx.category` (`enrichment.ts:182`), so user-confirmed categories are preserved — **good**
- But `gstCategory`/`gstAmount` have no such guard — a user-corrected GST category could be overwritten

There is no `enrichmentStatus` field on the `transactions` table to track whether a transaction has been enriched, preventing re-enrichment of already-processed records.

---

## 7. MerchantIntelligenceAgent Tool Interaction

### File: `server/src/services/claude/agents/merchant-intelligence.ts` (360 lines)

**6 tools defined:**

| Tool | Handler | External API? | Status |
|------|---------|---------------|--------|
| `search_cognee_merchant` | Searches Cognee `merchant_mappings` dataset | Cognee REST | Working (if Cognee running) |
| `resolve_merchant_name` | Pattern matches against `KNOWN_MERCHANTS` (17 entries) + strips payment prefixes | None | Working (local only) |
| `lookup_abn` | **Simulated** — heuristic guess from business name | None (should be ABR) | STUB |
| `infer_category` | Rule-based category inference from name/industry/amount | None | Working (local only) |
| `store_merchant_mapping` | Stores to Cognee via `cogneeTools.index()` | Cognee REST | Working (if Cognee running) |
| `batch_resolve` | Batch version of `resolve_merchant_name` | None | Working (local only) |

### Finding 7.1: Known Merchant List is Small and Hardcoded

**Severity: MEDIUM**

`merchant-intelligence.ts:18-37` has only 17 merchant patterns. This covers major Australian retailers but misses thousands of common merchants. The agent relies on Claude's general knowledge to resolve unknown merchants, which is non-deterministic.

### Finding 7.2: Payment Processor Prefix Stripping is Incomplete

**Severity: LOW**

`merchant-intelligence.ts:40-44` handles Square (`SQ *`), Stripe (`STRIPE`), and PayPal (`PAYPAL *`). Missing common prefixes:
- `EFTPOS` / `VISA DEBIT` / `VISA PURCHASE`
- `BPAY` / `BPAY REF:`
- `DIRECT DEBIT` / `DIRECT CREDIT`
- `ATM` / `CASH WDL`
- `*` prefix (common in CBA statements for card transactions)

### Finding 7.3: Agent Model is Haiku

**Severity: INFO**

`config.ts:63` assigns `claude-haiku-4-5-20251001` to merchant intelligence. Haiku is faster/cheaper but less capable at merchant name resolution than Sonnet. For a batch of unfamiliar merchants, this may produce lower-quality canonical names.

### Finding 7.4: Token Budget is Generous

**Severity: INFO**

`config.ts:47-52`:
- `maxInputTokens: 50_000`
- `maxOutputTokens: 8_000`
- `maxToolCalls: 15`

For merchant resolution this is adequate — a batch of ~50 merchants with 5 tool calls each would exceed the limit, but the agent likely batches internally.

---

## 8. Dual Persistence Verification

### Finding 8.1: Dual Write is Implemented

**Severity: INFO (Positive)**

`enrichment.ts:213-277` performs dual persistence:
1. **Local DB** → `merchantMemory` table (upsert via existence check)
2. **Cognee** → `cogneeClient.storeMerchantMapping()` (append to `merchant_mappings` dataset)

`cognee_client.ts:103-124` formats both a human-readable text and a JSON blob, then adds both to the `merchant_mappings` dataset.

### Finding 8.2: Cognee Writes Silently Swallow Errors

**Severity: MEDIUM**

Both `cognee_client.ts:253-263` (`add` method) and `enrichment.ts:274-276` catch errors and only `console.warn`. If Cognee is down, merchant mappings are stored locally but the Cognee knowledge graph falls behind with no retry mechanism or reconciliation.

### Finding 8.3: No Consistency Check Between DB and Cognee

**Severity: MEDIUM**

There is no mechanism to verify that local `merchantMemory` records match what's stored in Cognee. If one write succeeds and the other fails, the two stores can drift apart indefinitely.

---

## 9. Missing Infrastructure Summary

| Component | Status | Priority |
|-----------|--------|----------|
| ABR API client (`ABNLOOKUP_GUID`) | **NOT IMPLEMENTED** — stub only | HIGH |
| RapidAPI ABN adapter (`RAPIDAPI_KEY`) | **NOT IMPLEMENTED** | HIGH |
| Google Places adapter (`GOOGLE_MAPS_API_KEY`) | **NOT IMPLEMENTED** | MEDIUM |
| Enrichment adapter files (`enrichment/abn.ts`, `enrichment/places.ts`) | **DO NOT EXIST** | HIGH |
| Merchant-level cache for enrichment | **NOT IMPLEMENTED** | HIGH |
| Rate limiting for external APIs | **NOT IMPLEMENTED** (moot) | MEDIUM |
| API quota/cost tracking | **NOT IMPLEMENTED** | MEDIUM |
| Enrichment idempotency guard on transactions | **NOT IMPLEMENTED** | HIGH |
| Cognee duplicate prevention | **NOT IMPLEMENTED** | MEDIUM |
| DB↔Cognee consistency reconciliation | **NOT IMPLEMENTED** | LOW |

---

## 10. Recommendations (Prioritized)

1. **Implement ABR API client** at `server/src/services/enrichment/abn.ts` using either `ABNLOOKUP_GUID` (official API) or RapidAPI adapter. Wire into `lookup_abn` tool handler. Use `abn.ts` validation on returned ABNs.

2. **Add enrichment status tracking** — Add an `enrichment_status` column to `transactions` table to prevent re-enrichment and enable idempotency.

3. **Implement merchant-level cache** — Before invoking Stage 1 agent, check `merchantMemory` for the normalized description. Skip agent invocation for known merchants.

4. **Wire enrichment through orchestrator** — Use the orchestrator's `AgentResponseCache` instead of direct agent invocation for deduplication benefits.

5. **Add Cognee deduplication** — Check for existing merchant mapping in Cognee before adding (or use a deterministic key).

6. **Implement Google Places adapter** at `server/src/services/enrichment/places.ts` for merchant verification and location enrichment.

7. **Add rate limiting wrappers** for all external API calls with configurable quotas.

8. **Batch DB queries** — Replace sequential transaction fetching in `enrichTransactions()` with `WHERE id IN (...)`.

9. **Persist ABN to transactions** — The `abn` field from `MerchantIntelligenceOutput` is available but not written to the transaction record.

10. **Add env vars to `.env.example`** — `RAPIDAPI_KEY`, `RAPIDAPI_ABN_HOST`, `ABNLOOKUP_GUID`, `GOOGLE_MAPS_API_KEY` are not present in the current `.env.example`.
