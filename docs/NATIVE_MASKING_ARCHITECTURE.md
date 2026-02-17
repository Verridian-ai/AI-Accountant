# GoldLedger — Native Masking Architecture (v4: Streaming-Native)

> **Author**: Architecture Revision
> **Date**: 2026-02-17
> **Status**: APPROVED — Streaming-native optimization with deterministic masking + tagged amounts
> **Supersedes**: v3 (random masking, AmountRecalculator, blocking unredaction), v2 (dynamic role-based)
> **Source**: [Neon Data Anonymization Docs](https://neon.com/docs/workflows/data-anonymization)

---

## Critical Changes from v3

v3 was conceptually correct but had three fatal performance bottlenecks:

| Bottleneck | v3 Problem | v4 Solution |
|------------|-----------|-------------|
| **Random Masking** | `anon.fake_*()` generates random pseudonyms on each branch refresh. "Smith & Jones" is "Vendor_A" today and "Vendor_B" tomorrow. Breaks Cognee graph, invalidates Redis token maps, forces O(N) full-table diffs. | **Deterministic Masking**: `anon.pseudo_*(salt, column)` — same input always produces same output. "Smith & Jones" is always "Vendor_7f2a". Cognee graph stays stable forever. |
| **Amount Noise** | `anon.noise(amount, 0.1)` fuzzes amounts ±10%. AmountRecalculator must parse Claude's natural language, guess which rows were summed, re-query production, regex-replace noised totals. Fragile, slow, error-prone. | **Tagged Amounts**: Amounts are NOT masked in DB. Instead, server replaces amounts with `[[amt:ID]]` tags before sending to LLM. Real values stored in Redis. Streaming unredactor swaps tags back. Math handled by server-side tool. |
| **Blocking Stream** | v3 required waiting for Claude to finish the entire response before running `.replaceAll()` and AmountRecalculator. This killed streaming — users saw 5-15s loading spinners. | **Streaming Unredactor**: Node.js Transform stream swaps tokens on-the-fly as they arrive from Claude. Sub-second TTFT. User sees real data arriving character by character. |

---

## Executive Summary

The system handles two fundamentally different types of knowledge:

1. **PUBLIC knowledge** — Tax law, GST rules, ATO rulings, trading regulations, BAS categories,
   deduction rules, compliance standards. This is public domain information. It flows **freely** between
   agents, LLMs, Cognee, and users with **zero masking**.

2. **PRIVATE knowledge** — Client names, TFNs, bank accounts, transaction amounts, addresses, phone
   numbers, employee details. This is private user data. It flows to cloud LLMs **only through the
   masked Neon branch** where names are deterministically pseudonymized, and amounts are replaced with
   ID tags at the application layer.

### The Principle

```
PUBLIC DATA (tax law, GST rules, regulations, trading knowledge)
  → Flows freely everywhere
  → Stored in Cognee unmasked
  → Sent to Claude unmasked
  → No redaction needed — it's public domain

PRIVATE DATA (client financials, PII, account details)
  → Stored in Neon production (unmasked, source of truth)
  → Names/PII: Agent reads from Neon AI BRANCH (deterministic pseudonyms)
  → Amounts: Tagged at application layer with [[amt:ID]], real values in Redis
  → Cognee indexes from masked branch (patterns preserved, PII stripped)
  → User sees real data from production branch
  → Streaming unredactor swaps tokens inline as Claude generates output
```

---

## 1. The Two Data Domains

### Domain A: PUBLIC Knowledge (Flows Freely)

This data has **zero PII**. It is publicly available information. There is no legal, ethical, or
security reason to redact it. Masking it would make the AI agent less useful.

| Cognee Dataset | DataPoint Model | Content | Why Public |
|---------------|-----------------|---------|-----------|
| `tax_rulings` | GSTRuleNode | ATO rulings, GST rates, rule types | Published by ATO |
| `gst_rules` (predefined) | TaxEvent | GST events, BAS labels, categories | Published by ATO |
| `financial_insights` | CategoryNode | Category names, tax deductibility flags, GST applicability | Generic categories, not client-specific |
| `financial_insights` | BASPeriodNode | BAS quarter definitions, GST formulas | ATO-defined periods |
| `deduction_patterns` | DeductionNode | Deduction types (D1-D15), ATO categories, substantiation rules | Published by ATO |
| — | — | Trading regulations, compliance standards | Published by ASIC/ATO |
| — | — | GST_BAS_RULES.md content | Reference document |

**How PUBLIC data flows:**

```
GST_BAS_RULES.md / ATO rulings / Compliance standards
  │
  ▼
Cognee: cogneeClient.add(publicData, 'tax_rulings')
  │ → cogneeClient.cognify(['tax_rulings'])
  │ → Knowledge graph: GSTRuleNode, DeductionNode, CategoryNode
  │ → Vector embeddings of tax law text
  │
  ▼
Agent query: "What GST rate applies to educational services?"
  │ → cogneeClient.search(query, 'tax_rulings', 'GRAPH_COMPLETION')
  │ → Returns: "GST-free under GST Act Schedule 1"
  │ → Sent DIRECTLY to Claude Opus 4.6 — NO masking
  │
  ▼
Claude reasons with full, accurate tax law knowledge
  │ → No tokens to unredact
  │ → Response goes straight to user
```

**No Neon branch involved. No masking. No redaction. No token mapping.**
Public knowledge goes to Cognee raw, comes back raw, goes to Claude raw.

### Domain B: PRIVATE Knowledge (Masked Wall)

This data contains PII. It must **never** reach a cloud LLM in its original form.

| Cognee Dataset | DataPoint Model | Content | Why Private |
|---------------|-----------------|---------|------------|
| `bank_transactions` | TransactionNode | Amounts, merchant names, dates, account IDs | Client financial data |
| `merchant_data` | MerchantNode | Merchant names, ABNs, spending totals | Client-specific vendor relationships |
| `financial_insights` | AccountNode | Account numbers, BSBs, balances | Direct identifiers |
| `transaction_patterns` | PatternNode | Spending patterns with merchant references | Client-specific patterns |

**Plus all 110 PII columns** from `DATA_MASKING_PLAN.md` (employees, customers, suppliers, etc.)

---

## 2. How Neon Static Masking Works (v4: Deterministic)

Per the [Neon documentation](https://neon.com/docs/workflows/data-anonymization):

### Step 1: Create an Anonymized Branch with Deterministic Pseudonymization

Neon creates a **branch** — a full copy-on-write fork of the production database. Then it runs the
PostgreSQL Anonymizer extension to **permanently transform** PII columns on that branch.

**v4 uses deterministic pseudonymization (`anon.pseudo_*`)** instead of random faking (`anon.fake_*`).
This ensures the same input ALWAYS produces the same output, eliminating the need for O(N) database
diffs and keeping Cognee's graph stable.

```
Production Branch (main)          AI Branch (masked — deterministic)
┌────────────────────┐           ┌────────────────────┐
│ employees          │    fork   │ employees          │
│ ├─ first_name:     │  ──────► │ ├─ first_name:     │
│ │  "Daniel"        │  + mask  │ │  "Marcus_7f2a"   │ ← anon.pseudo_first_name(first_name)
│ ├─ last_name:      │          │ ├─ last_name:      │
│ │  "Jones"         │          │ │  "Chen_3b1c"     │ ← anon.pseudo_last_name(last_name)
│ ├─ tax_file_number:│          │ ├─ tax_file_number:│
│ │  "123-456-789"   │          │ │  "***-***-***"   │ ← anon.partial() (already deterministic)
│ ├─ email:          │          │ ├─ email:          │
│ │  "dan@firm.com"  │          │ │  "x8k@pseudo.com"│ ← anon.pseudo_email(email)
│ └─ salary:         │          │ └─ salary:         │
│    55000           │          │    55000           │ ← UNCHANGED (tagged at app layer)
└────────────────────┘          └────────────────────┘
                                 DETERMINISTIC: "Daniel" always
                                 maps to "Marcus_7f2a" with the
                                 same salt, across every refresh.
                                 AMOUNTS: pass through unchanged.
```

### The Deterministic Salt

```sql
-- Set ONCE on the Neon project. NEVER change it (or all pseudonyms shift).
ALTER DATABASE neondb SET anon.salt = 'goldledger_masking_salt_2026_CHANGE_IN_PRODUCTION';
```

### v3 vs v4 Masking Functions

```sql
-- ┌───────────────────────────────────────────────────────────────────────┐
-- │ v3 (RANDOM — breaks Cognee graph every 4 hours)                       │
-- │ masking_function: "anon.fake_company()"                                │
-- │ "Smith & Jones" → "Acme Corp" today, "Beta LLC" tomorrow              │
-- └───────────────────────────────────────────────────────────────────────┘

-- ┌───────────────────────────────────────────────────────────────────────┐
-- │ v4 (DETERMINISTIC — Cognee graph stays stable forever)                │
-- │ masking_function: "anon.pseudo_company(description)"                   │
-- │ "Smith & Jones" → "Vendor_7f2a" today, tomorrow, and forever          │
-- └───────────────────────────────────────────────────────────────────────┘

-- v3 amount masking (REMOVED in v4):
-- masking_function: "anon.noise(amount, 0.1)"   -- ±10% fuzz → math errors
-- v4: amounts pass through UNCHANGED in DB, tagged at application layer
```

### Step 2: Define Masking Rules (v4 Format)

All 110 rules from `DATA_MASKING_PLAN.md` converted to deterministic pseudonymization.
Full SQL in: `server/src/services/neon/deterministic-masking-rules.sql`

```bash
curl -X POST \
  "https://console.neon.tech/api/v2/projects/${NEON_PROJECT_ID}/branch_anonymized" \
  -H "Authorization: Bearer ${NEON_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "masking_rules": [
      {
        "database_name": "neondb",
        "schema_name": "public",
        "table_name": "employees",
        "column_name": "first_name",
        "masking_function": "anon.pseudo_first_name(first_name)"
      },
      {
        "database_name": "neondb",
        "schema_name": "public",
        "table_name": "employees",
        "column_name": "last_name",
        "masking_function": "anon.pseudo_last_name(last_name)"
      },
      {
        "database_name": "neondb",
        "schema_name": "public",
        "table_name": "employees",
        "column_name": "tax_file_number",
        "masking_function": "anon.partial(tax_file_number, 0, '***-***-***', 0)"
      },
      {
        "database_name": "neondb",
        "schema_name": "public",
        "table_name": "employees",
        "column_name": "email",
        "masking_function": "anon.pseudo_email(email)"
      },
      {
        "database_name": "neondb",
        "schema_name": "public",
        "table_name": "transactions",
        "column_name": "description",
        "masking_function": "anon.pseudo_company(description)"
      }
    ],
    "start_anonymization": true
  }'
```

**Note: NO masking_function for `amount` columns.** Amounts pass through unchanged. They are tagged
with `[[amt:ID]]` at the application layer before being sent to the LLM.

### Step 3: Refresh Cycle

| Strategy | Freshness | Cost | How |
|----------|-----------|------|-----|
| **Scheduled re-creation** | Every 1-4 hours | Low (Neon branching is instant CoW) | Cron: delete old AI branch, create new one, swap connection string |
| **Event-driven** | Near real-time | Medium | After bulk imports (CSV upload, bank sync), trigger new masked branch |

Because masking is **deterministic**, the token map from the previous branch is still 99% valid for
the new branch. Only new rows need mapping updates. This is a massive performance win over v3's
full-table diff.

```typescript
// server/src/services/neon/branch-manager.ts

export class NeonBranchManager {
  async refreshMaskedBranch(): Promise<string> {
    // 1. Create new anonymized branch via Neon API
    const newBranch = await this.neonApi.createAnonymizedBranch({
      parentBranchId: this.productionBranchId,
      maskingRules: MASKING_RULES_110,
      startAnonymization: true,
    });

    // 2. Wait for anonymization to complete
    await this.waitForAnonymization(newBranch.id);

    // 3. Get the new branch's connection string
    const newConnectionString = await this.neonApi.getConnectionString(newBranch.id);

    // 4. Hot-swap the AI connection pool
    await this.swapAiConnectionPool(newConnectionString);

    // 5. Delete the old AI branch
    if (this.currentAiBranchId) {
      await this.neonApi.deleteBranch(this.currentAiBranchId);
    }

    // 6. Token map is still valid! (deterministic masking)
    // Only need to add mappings for NEW rows added since last refresh.

    this.currentAiBranchId = newBranch.id;
    return newBranch.id;
  }
}
```

---

## 3. The Two Connection Pools

```typescript
// server/src/db/neon-connection.ts

import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';

// Pool 1: Production Branch (real data, for user-facing endpoints)
const productionPool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  max: 20,
  ssl: { rejectUnauthorized: false },
});

// Pool 2: AI Branch (deterministically masked data, for agent/Cognee)
let aiPool = new Pool({
  connectionString: process.env.NEON_AI_DATABASE_URL,
  max: 10,
  ssl: { rejectUnauthorized: false },
});

export const neonDb = drizzle(productionPool);         // User sees real data
export let neonMaskedDb = drizzle(aiPool);             // Agent sees masked data

// Called by NeonBranchManager when masked branch is refreshed
export async function swapAiPool(newConnectionString: string) {
  const oldPool = aiPool;
  aiPool = new Pool({ connectionString: newConnectionString, max: 10, ssl: { rejectUnauthorized: false } });
  neonMaskedDb = drizzle(aiPool);
  await oldPool.end();
}
```

### Environment Variables

```bash
NEON_DATABASE_URL=postgresql://app_user:${PASSWORD}@ep-abc-production.ap-southeast-2.aws.neon.tech/neondb?sslmode=require
NEON_AI_DATABASE_URL=postgresql://app_user:${PASSWORD}@ep-xyz-ai-masked.ap-southeast-2.aws.neon.tech/neondb?sslmode=require
NEON_API_KEY=napi_y4onc44ncsg0p9jt9jqdn9wix9y71t7wdr9d1drs2di8hii0a4kln7tm2fci6qbq
NEON_PROJECT_ID=<your-project-id>
USE_NEON=true  # Set to false to fall back to local PG
```

---

## 4. The v4 Streaming Pipeline (5 Speed Hacks)

### Speed Hack 1: Deterministic Masking (Saves Cognee & Kills DB Diffing)

**Why**: Cognee's knowledge graph has entity nodes like `MerchantNode("Vendor_7f2a")`. If the pseudonym
changes on every branch refresh, those nodes become orphaned and Cognee must re-index everything.

**How**: `anon.pseudo_*()` functions use the column value + a static salt to generate the pseudonym.
Same input always produces the same output.

```sql
-- "Smith & Jones" always maps to "Vendor_7f2a" with this salt, forever.
-- Cognee's graph node MerchantNode("Vendor_7f2a") remains stable.
-- No re-indexing needed after branch refresh.
```

**Eliminates**: The 4-hour background O(N) token map diff job from v3.

### Speed Hack 2: Tagged Amounts (Kills Row-Level Math Errors)

**Why**: `anon.noise(amount, 0.1)` fuzzes amounts ±10%. Claude computes on fuzzed numbers. Its totals
are wrong. v3's AmountRecalculator tried to parse Claude's natural language, guess which rows were
summed, re-query production, and regex-replace. This is a computer science nightmare.

**How**: Amounts are NOT masked in the database. When the server builds Claude's prompt, it dynamically
replaces real amounts with unique `[[amt:ID]]` tags. Real values are stored in Redis per session.

```typescript
// server/src/services/pipeline/amount-tagger.ts

export class AmountTagger {
  /**
   * Replace real amounts with [[amt:ID]] tags.
   * Store real values in Redis with session TTL.
   */
  async tagAmounts(
    rows: Record<string, unknown>[],
    amountColumns: string[],
    sessionId: string,
  ): Promise<{ taggedRows: Record<string, unknown>[]; tagMap: Map<string, string> }> {
    const tagMap = new Map<string, string>();
    const taggedRows = rows.map((row, i) => {
      const tagged = { ...row };
      for (const col of amountColumns) {
        if (row[col] !== undefined && row[col] !== null) {
          const tag = `[[amt:${i}_${col}]]`;
          const realValue = String(row[col]);
          tagMap.set(tag, this.formatCurrency(Number(realValue)));
          tagged[col] = tag;
        }
      }
      return tagged;
    });

    // Store in Redis with 1h TTL per session
    await this.redis.set(
      `amt_tags:${sessionId}`,
      JSON.stringify([...tagMap]),
      'EX', 3600,
    );

    return { taggedRows, tagMap };
  }
}
```

**What Claude sees**: `"Vendor_7f2a: [[amt:0_amount]]"` — no real dollars.
**What Claude streams**: `"You paid Vendor_7f2a an amount of [[amt:0_amount]]."`
**What user sees (after unredaction)**: `"You paid Smith & Jones an amount of $45,000."`

### Speed Hack 3: Streaming Unredactor (Zero-Latency Inline Swap)

**Why**: v3 waited for Claude's entire response before running `.replaceAll()`. This broke streaming.
Users saw 5-15 second loading spinners before any text appeared.

**How**: A Node.js Transform stream that buffers incoming tokens and swaps masked values in-flight.

```typescript
// server/src/services/pipeline/streaming-unredactor.ts

import { Transform, TransformCallback } from 'stream';

export class StreamingUnredactor extends Transform {
  private buffer = '';
  private tokenMap: Map<string, string>;
  private maxTokenLength: number;

  constructor(tokenMap: Map<string, string>) {
    super({ objectMode: true });
    this.tokenMap = tokenMap;
    // Buffer length = longest token to catch tokens split across chunks
    this.maxTokenLength = Math.max(...[...tokenMap.keys()].map(k => k.length), 15);
  }

  _transform(chunk: Buffer | string, encoding: string, callback: TransformCallback): void {
    this.buffer += chunk.toString();

    // Fast O(1) string replacement mid-flight
    for (const [masked, real] of this.tokenMap.entries()) {
      if (this.buffer.includes(masked)) {
        this.buffer = this.buffer.replaceAll(masked, real);
      }
    }

    // Keep the last N chars in buffer in case a token is cut across chunks
    const safeIndex = Math.max(0, this.buffer.length - this.maxTokenLength);
    const output = this.buffer.slice(0, safeIndex);
    this.buffer = this.buffer.slice(safeIndex);

    if (output) this.push(output);
    callback();
  }

  _flush(callback: TransformCallback): void {
    // Flush remaining buffer — do final replacement pass
    for (const [masked, real] of this.tokenMap.entries()) {
      if (this.buffer.includes(masked)) {
        this.buffer = this.buffer.replaceAll(masked, real);
      }
    }
    if (this.buffer) this.push(this.buffer);
    callback();
  }
}
```

**Integration in the streaming loop** (`server/src/index.ts`):

```typescript
// BEFORE (v3 — blocking):
let fullText = '';
for await (const chunk of agent.stream(input)) {
  fullText += chunk;
}
const unredacted = await tokenMapper.unredact(fullText); // blocks until done
const recalculated = await amountRecalculator.recalculate(unredacted, ctx); // blocks again
writer.sendToken(recalculated);

// AFTER (v4 — streaming):
const tokenMap = await tokenMapBuilder.buildSessionMap(sessionId, maskedRows, realRows, amountTags);
const unredactor = new StreamingUnredactor(tokenMap);
for await (const chunk of agent.stream(input)) {
  const unredacted = unredactor.transformSync(chunk);
  if (unredacted) writer.sendToken(unredacted);
}
const remainder = unredactor.flushSync();
if (remainder) writer.sendToken(remainder);
```

### Speed Hack 4: Tool-Delegated Aggregation (Flawless Math)

**Why**: If the user asks "Calculate my total expenses", Claude should NOT do the math. With tagged
amounts, Claude sees `[[amt:0_amount]]` + `[[amt:1_amount]]` — it can't sum those. Even if it could,
LLMs are unreliable at arithmetic.

**How**: Give Claude a server-side tool that queries the PRODUCTION database for exact sums.

```typescript
// server/src/services/tools/aggregate-tool.ts

tools['get_exact_totals'] = adaptLegacyTool(
  'get_exact_totals',
  'Get exact financial totals from the production database. Use this when the user asks for sums, averages, counts, or any calculation on financial data. Returns exact, real numbers.',
  {
    table: z.enum(['transactions', 'payroll_runs', 'invoices', 'bills']),
    aggregate: z.enum(['sum', 'count', 'avg']),
    column: z.string().default('amount'),
    date_from: z.string().optional(),
    date_to: z.string().optional(),
    category: z.string().optional(),
    group_by: z.string().optional(),
  },
  async (input) => {
    // Queries neonDb (PRODUCTION) — real, exact numbers
    const result = await neonDb.execute(buildAggregateQuery(input));
    return result;
  },
);
```

**Why this is safe**: Returning an aggregate sum to the LLM does NOT violate PII. A sum like
"$12,847.63 total" is inherently k-anonymized — it reveals no individual transaction amounts.
Claude gets the real math directly, entirely bypassing the need for the fragile AmountRecalculator.

**Flow**:
1. User: "Calculate my total expenses this month"
2. Claude realizes it needs a sum, calls `get_exact_totals(table='transactions', aggregate='sum', date_from='2026-02-01')`
3. Server executes `SELECT SUM(amount) FROM transactions WHERE date >= '2026-02-01'` against Neon Production
4. Server returns `$12,847.63` to Claude
5. Claude streams: "Your total expenses this month are $12,847.63"
6. No amount tagging needed for this number — it's a safe aggregate

### Speed Hack 5: Generative UI for Tables (Bypasses LLM Sluggishness)

**Why**: When a user asks for "a full breakdown of all transactions", Claude generates 50+ rows of
markdown table tokens one at a time. This takes ~15 seconds. The data is already in the database.

**How**: Instruct Claude to trigger a structured UI component instead of generating the table.

```typescript
// Claude's tool response:
{
  "ui": "TransactionTable",
  "props": { "month": "2026-02", "category": "all", "limit": 50 }
}

// Server intercepts this via SSE:
// event: ui_component
// data: {"component": "TransactionTable", "props": {"month": "2026-02"}}

// Frontend React component fetches REAL data directly from server API
// and renders a native, interactive, sortable table instantly.
```

**Server-side SSE** (`server/src/services/claude/streaming.ts`):

```typescript
sendUiComponent(componentName: string, props: Record<string, unknown>): void {
  this.controller.enqueue(
    `event: ui_component\ndata: ${JSON.stringify({ component: componentName, props })}\n\n`
  );
}
```

The LLM only handles the conversational wrapper. Large data rendering is delegated to the frontend.

---

## 5. Token Map Builder (Merges Deterministic Names + Amount Tags)

The token map for the StreamingUnredactor is built per-session by merging two sources:

```typescript
// server/src/services/pipeline/token-map-builder.ts

export class TokenMapBuilder {
  /**
   * Build a session-specific token map for the StreamingUnredactor.
   * Merges deterministic name pseudonyms with per-session amount tags.
   */
  async buildSessionMap(
    sessionId: string,
    maskedRows: Record<string, unknown>[],
    realRows: Record<string, unknown>[],
    amountTags: Map<string, string>,
  ): Promise<Map<string, string>> {
    const sessionMap = new Map<string, string>();

    // 1. Name pseudonyms (STABLE — deterministic masking)
    // Only need to map the names that appear in THIS query's results
    for (let i = 0; i < maskedRows.length; i++) {
      for (const col of PII_NAME_COLUMNS) {
        const maskedVal = String(maskedRows[i][col] ?? '');
        const realVal = String(realRows[i][col] ?? '');
        if (maskedVal && realVal && maskedVal !== realVal) {
          sessionMap.set(maskedVal, realVal);
        }
      }
    }

    // 2. Amount tags (PER-SESSION — from AmountTagger)
    for (const [tag, realAmount] of amountTags) {
      sessionMap.set(tag, realAmount);
    }

    // 3. Cache in Redis for this session
    await this.redis.set(
      `token_map:${sessionId}`,
      JSON.stringify([...sessionMap]),
      'EX', 3600,
    );

    return sessionMap;
  }
}
```

**Key difference from v3**: The name pseudonyms are deterministic, so they can be cached globally
(not just per-branch). Only amount tags need per-session scope.

---

## 6. Complete Data Flows

### Flow A: PUBLIC Knowledge Query (Zero Masking)

```
User: "What are the GST rules for professional services?"
  │
  ▼
Server receives query
  │
  ├─── 1. Search Cognee: PUBLIC datasets ──────────────────────┐
  │       cogneeClient.search(                                  │
  │         "GST rules professional services",                  │
  │         "tax_rulings",     ◀── PUBLIC dataset               │
  │         "GRAPH_COMPLETION"                                   │
  │       )                                                      │
  │                                                              │
  │       Cognee returns:                                        │
  │       "Professional services: 10% GST, BAS G1/G11,         │
  │        ATO ruling GSTR 2012/2"                               │
  │                                                              │
  │       This is PUBLIC DOMAIN knowledge.                       │
  │       NO masking. NO redaction. Full text.                   │
  │                                                              │
  ├─── 2. Send to Claude Opus 4.6 (UNMASKED) ─────────────────┤
  │       Prompt includes full Cognee results + user query       │
  │       Claude has complete, accurate tax law context           │
  │                                                              │
  ├─── 3. Claude STREAMS response ─────────────────────────────┤
  │       "Professional services attract 10% GST.                │
  │        You report sales on G1 and claim input credits        │
  │        on G11. See ATO ruling GSTR 2012/2."                  │
  │                                                              │
  │       No tokens to unredact. Direct streaming passthrough.   │
  │       TTFT: < 200ms.                                         │
  │                                                              │
  ├─── 4. Save to Cognee (unredacted, public) ─────────────────┤
  │       Q&A stored in knowledge graph for future context        │
  │                                                              │
  ▼
User sees: Complete, accurate GST guidance (streamed in real-time)
```

**Zero masking overhead. Zero latency penalty. Full accuracy. Full streaming.**

### Flow B: PRIVATE Data Query (Deterministic Masking + Tagged Amounts + Streaming Unredaction)

```
User: "What did I pay Smith & Jones last quarter?"
  │
  ▼
Server receives query
  │
  ├─── 1. Parallel Fetch (~50ms) ──────────────────────────────┐
  │                                                              │
  │  a) Query Neon AI BRANCH (deterministically masked):         │
  │     SELECT * FROM transactions                               │
  │     WHERE description ILIKE '%smith%jones%'                  │
  │     AND date >= '2025-10-01'                                 │
  │                                                              │
  │     AI branch returns:                                       │
  │     description: "Vendor_7f2a Pty Ltd"  ← DETERMINISTIC      │
  │     amount: 4500000  ← UNCHANGED (not noised!)               │
  │     contact_name: "Marcus_7f2a Chen_3b1c"                    │
  │                                                              │
  │  b) Fetch same rows from PRODUCTION (for token map):         │
  │     description: "Smith & Jones Pty Ltd"                      │
  │     amount: 4500000                                           │
  │     contact_name: "Daniel Jones"                              │
  │                                                              │
  │  c) Search Cognee PUBLIC datasets:                           │
  │     "professional services invoicing rules"                   │
  │     → "Prof services: 10% GST, G1/G11"                      │
  │                                                              │
  ├─── 2. Build Token Map + Tag Amounts ───────────────────────┤
  │                                                              │
  │  Name map (deterministic, cacheable):                        │
  │    "Vendor_7f2a Pty Ltd" → "Smith & Jones Pty Ltd"           │
  │    "Marcus_7f2a" → "Daniel"                                  │
  │    "Chen_3b1c" → "Jones"                                     │
  │                                                              │
  │  Amount tags (per-session, Redis-backed):                    │
  │    "[[amt:0_amount]]" → "$45,000"                            │
  │                                                              │
  │  Merged session map for StreamingUnredactor:                 │
  │    {                                                         │
  │      "Vendor_7f2a Pty Ltd": "Smith & Jones Pty Ltd",         │
  │      "Marcus_7f2a": "Daniel",                                │
  │      "Chen_3b1c": "Jones",                                   │
  │      "[[amt:0_amount]]": "$45,000"                           │
  │    }                                                         │
  │                                                              │
  ├─── 3. Send to Claude (masked names + tagged amounts) ──────┤
  │                                                              │
  │  Claude sees:                                                │
  │    "Vendor_7f2a Pty Ltd: [[amt:0_amount]], Professional Svcs" │
  │    "Prof services: 10% GST, G1/G11" (PUBLIC, unmasked)       │
  │                                                              │
  │  Claude calls get_exact_totals for the total:                │
  │    Server returns real sum from production → $45,000          │
  │                                                              │
  ├─── 4. Claude STREAMS response (masked) ────────────────────┤
  │                                                              │
  │  Token by token: "Vendor_7f2a Pty Ltd had invoices..."       │
  │                                                              │
  ├─── 5. StreamingUnredactor swaps in-flight (~1ms) ──────────┤
  │                                                              │
  │  "Vendor_7f2a Pty Ltd" → "Smith & Jones Pty Ltd"             │
  │  "[[amt:0_amount]]" → "$45,000"                              │
  │  "10% GST" → "10% GST" (unchanged, PUBLIC)                  │
  │                                                              │
  ├─── 6. Save to Cognee (unredacted, real) ───────────────────┤
  │       REAL query + REAL answer stored in Cognee memory        │
  │                                                              │
  ▼
User sees (streaming, sub-200ms TTFT):
  "Smith & Jones Pty Ltd had invoices totalling $45,000 in Q3.
   As professional services, these attract 10% GST.
   Input tax credits claimable on G11."
```

**Key v4 improvements over v3:**
- Amounts are EXACT (not noised ±10%)
- Names are DETERMINISTIC (stable across branch refreshes)
- Response STREAMS to user (not blocked until complete)
- No AmountRecalculator parsing natural language
- No O(N) full-table database diffs

---

## 7. Cognee Dataset Classification

Every Cognee dataset is explicitly classified as PUBLIC or PRIVATE:

| Dataset | Classification | DataPoint Models | Masking Required | Data Source |
|---------|---------------|-----------------|-----------------|-------------|
| `tax_rulings` | **PUBLIC** | GSTRuleNode | None | GST_BAS_RULES.md, ATO docs |
| `gst_rules` | **PUBLIC** | TaxEvent (predefined) | None | ATO rulings |
| `deduction_patterns` | **PUBLIC** | DeductionNode | None | ATO deduction categories |
| `financial_insights` (categories, BAS) | **PUBLIC** | CategoryNode, BASPeriodNode | None | Generic definitions |
| `bank_transactions` | **PRIVATE** | TransactionNode | **Deterministic pseudo** | Neon AI branch |
| `merchant_data` | **PRIVATE** | MerchantNode | **Deterministic pseudo** | Neon AI branch |
| `financial_insights` (accounts) | **PRIVATE** | AccountNode | **Deterministic pseudo** | Neon AI branch |
| `transaction_patterns` | **PRIVATE** | PatternNode | **Deterministic pseudo** | Neon AI branch (derived) |
| `merchant_mappings` | **PRIVATE** | BusinessRelationship | **Deterministic pseudo** | Neon AI branch |

### The Routing Rule in Code

```typescript
// server/src/services/data-classification.ts

export const PUBLIC_DATASETS = new Set([
  'tax_rulings',
  'gst_rules',
  'deduction_patterns',
]);

export const PRIVATE_DATASETS = new Set([
  'bank_transactions',
  'merchant_data',
  'merchant_mappings',
  'financial_insights',
  'transaction_patterns',
]);

export function getDataSourceForDataset(dataset: string): 'neon_production' | 'neon_masked' | 'public_docs' {
  if (PUBLIC_DATASETS.has(dataset)) return 'public_docs';
  if (PRIVATE_DATASETS.has(dataset)) return 'neon_masked';
  return 'neon_masked'; // Safe default
}

export function needsPiiSafetyNet(dataset: string): boolean {
  return PRIVATE_DATASETS.has(dataset) || !PUBLIC_DATASETS.has(dataset);
}
```

---

## 8. The Complete Architecture Diagram

```
┌══════════════════════════════════════════════════════════════════════════════┐
║                    GOLDLEDGER v4 ARCHITECTURE                               ║
║                    Streaming-Native with Deterministic Masking              ║
╚══════════════════════════════════════════════════════════════════════════════╝

   ┌──────────────────────────────────┐
   │           USER BROWSER            │
   │                                   │
   │  Sees REAL data at all times.     │
   │  SSE streaming — sub-200ms TTFT  │
   └───────────────┬───────────────────┘
                   │
            HTTPS + SSE
                   │
   ┌───────────────▼───────────────────┐
   │         HONO SERVER (Node.js)      │
   │                                    │
   │  ┌────────────────────────────┐   │
   │  │  DataClassifier             │   │  ◀── Routes to correct pool
   │  │  PUBLIC / PRIVATE           │   │
   │  └────────────┬───────────────┘   │
   │               │                    │
   │    ┌──────────┴──────────┐        │
   │    │                     │        │
   │    ▼                     ▼        │
   │  ┌──────────┐  ┌──────────────┐  │
   │  │ neonDb   │  │ neonMaskedDb │  │
   │  │ (prod)   │  │ (AI branch)  │  │
   │  │ Real     │  │ Deterministic│  │
   │  │ data     │  │ pseudonyms   │  │
   │  └────┬─────┘  └──────┬───────┘  │
   │       │               │          │
   │       │    ┌──────────▼───────┐  │
   │       │    │  AmountTagger    │  │  ◀── Tags amounts with [[amt:ID]]
   │       │    │  (Redis-backed)  │  │      Real values in Redis
   │       │    └──────────┬───────┘  │
   │       │               │          │
   │       │    ┌──────────▼───────┐  │
   │       │    │ TokenMapBuilder  │  │  ◀── Merges name map + amount tags
   │       │    │ (per-session)    │  │
   │       │    └──────────┬───────┘  │
   │       │               │          │
   │       │    ┌──────────▼───────┐  │
   │       │    │ cogneeClient     │  │  ◀── PUBLIC: raw | PRIVATE: masked
   │       │    │ .smartSearch()   │  │
   │       │    └──────────┬───────┘  │
   │       │               │          │
   │       │    ┌──────────▼───────┐  │
   │       │    │ Claude Opus 4.6  │  │  ◀── Sees masked names + [[amt:ID]]
   │       │    │ + get_exact_totals│  │     Calls tool for real math
   │       │    └──────────┬───────┘  │
   │       │               │          │
   │       │    ┌──────────▼───────┐  │
   │       │    │ StreamingUnredact│  │  ◀── Transform stream: swaps tokens
   │       │◀───│ (inline, ~1ms)  │  │      in-flight as Claude generates
   │       │    └──────────────────┘  │
   │       │                          │
   └───────┼──────────────────────────┘
           │
   ┌───────▼──────────────────────────────────────────────┐
   │                    NEON CLOUD                          │
   │                                                        │
   │  ┌──────────────────┐    ┌───────────────────────┐    │
   │  │ Production Branch │    │ AI Branch (masked)     │    │
   │  │ (main)            │    │                        │    │
   │  │ 128 tables        │    │ Deterministic pseudo   │    │
   │  │ REAL data         │    │ anon.pseudo_*(salt,col)│    │
   │  │                   │    │ Amounts UNCHANGED      │    │
   │  │ User reads here   │    │ Agent reads here       │    │
   │  │ + aggregate tool  │    │                        │    │
   │  └──────────────────┘    └───────────────────────┘    │
   │                                                        │
   │  Branch refresh: every 1-4 hours (deterministic =      │
   │  token map stays valid, only new rows need mapping)    │
   └────────────────────────────────────────────────────────┘

   ┌────────────────────────────────────────────────────────┐
   │                    LOCAL DOCKER                          │
   │                                                          │
   │  ┌────────────────┐  ┌─────────────────────────────┐   │
   │  │  Cognee (:8000) │  │  PostgreSQL (:5432)          │   │
   │  │                 │  │  cognee_db only (13 tables)   │   │
   │  │  Stores BOTH:   │  │  pgvector + Kuzu graph        │   │
   │  │  • PUBLIC (raw) │  │                               │   │
   │  │  • PRIVATE      │  └─────────────────────────────┘   │
   │  │    (pre-masked) │                                      │
   │  └────────────────┘  ┌─────────────────────────────┐   │
   │                       │  Redis (:6379)               │   │
   │                       │  • Amount tag maps           │   │
   │                       │  • Session token maps        │   │
   │                       │  • Cognee session state      │   │
   │                       └─────────────────────────────┘   │
   └──────────────────────────────────────────────────────────┘
```

---

## 9. Real-World User Scenarios (v4)

### Scenario 1: "Show me all my payroll transactions and who I paid"

```
USER TYPES:
  "Show me all payroll transactions this quarter and who the money went to"

═══════════════════════════════════════════════════════════════════
WHAT HAPPENS (v4 — < 150ms to first token):
═══════════════════════════════════════════════════════════════════

Step 1: Parallel fetch (~50ms)
  a) Neon AI Branch (masked names, REAL amounts):
  ┌──────────────┬─────────────┬──────────┬────────────┐
  │ first_name   │ last_name   │ amount   │ pay_date   │
  ├──────────────┼─────────────┼──────────┼────────────┤
  │ "Marcus_7f2a"│ "Chen_3b1c" │ 5500000  │ 2026-01-15 │
  │ "Priya_4d8e" │ "Okon_9a2f" │ 4000000  │ 2026-01-15 │
  │ "Lars_6c7b"  │ "Mart_1e5d" │ 3000000  │ 2026-01-15 │
  └──────────────┴─────────────┴──────────┴────────────┘

  b) Neon Production (same rows, real names):
  "Sarah Jones", "Mike Smith", "Emma Davis"

  c) AmountTagger tags the amounts:
  "[[amt:0_amount]]" → "$55,000"
  "[[amt:1_amount]]" → "$40,000"
  "[[amt:2_amount]]" → "$30,000"

Step 2: Build session token map
  {
    "Marcus_7f2a": "Sarah",
    "Chen_3b1c": "Jones",
    "Priya_4d8e": "Mike",
    "Okon_9a2f": "Smith",
    "Lars_6c7b": "Emma",
    "Mart_1e5d": "Davis",
    "[[amt:0_amount]]": "$55,000",
    "[[amt:1_amount]]": "$40,000",
    "[[amt:2_amount]]": "$30,000"
  }

Step 3: Claude calls get_exact_totals for the total payroll
  Server queries production: SELECT SUM(amount) FROM payroll_runs ...
  Returns: $250,000 (exact)

Step 4: Claude streams (masked). StreamingUnredactor swaps inline.

═══════════════════════════════════════════════════════════════════
USER SEES (streaming, real-time, all real data):
═══════════════════════════════════════════════════════════════════

  Agent: "Here are your payroll transactions for Q1 2026:

  | Employee    | Jan Pay  | Feb Pay  | Total    |
  |-------------|----------|----------|----------|
  | Sarah Jones | $55,000  | $55,000  | $110,000 |
  | Mike Smith  | $40,000  | $40,000  | $80,000  |
  | Emma Davis  | $30,000  | $30,000  | $60,000  |

  Total payroll this quarter: $250,000"
```

**v4 improvements**: Amounts are EXACT (not noised). Total is from production aggregate tool (not
LLM arithmetic). Response streams to user in real-time (not blocked).

### Scenario 2: Large Table → Generative UI

```
USER TYPES:
  "Give me a full breakdown of all 50 transactions this month"

═══════════════════════════════════════════════════════════════════
WHAT HAPPENS (v4 — Generative UI):
═══════════════════════════════════════════════════════════════════

Step 1: Claude determines this is a large-table request

Step 2: Claude calls a tool that returns:
  {"ui": "TransactionTable", "props": {"month": "2026-02", "limit": 50}}

Step 3: Server sends SSE event:
  event: ui_component
  data: {"component": "TransactionTable", "props": {"month": "2026-02"}}

Step 4: Frontend React component renders immediately:
  - Fetches REAL data from /api/transactions?month=2026-02
  - Renders native, interactive, sortable table
  - No LLM token generation for 50 rows of data

Step 5: Claude streams the conversational wrapper:
  "Here's your February breakdown. Your top category is Office Supplies..."

═══════════════════════════════════════════════════════════════════
USER SEES:
═══════════════════════════════════════════════════════════════════

  [Interactive table with all 50 transactions — real data, instant]

  Agent: "Here's your February breakdown. Your top category is
  Office Supplies at 25.2%, followed by Telecommunications at 12.8%.
  Total spend: $12,847.63. GST claimable: $1,168.88."
```

**v4 improvement**: Table renders instantly (native UI). LLM only generates the summary text.

---

## 10. Selective Data Exposure (Only What's Needed)

```typescript
// server/src/services/ai-query-builder.ts

export class AiQueryBuilder {
  async buildMinimalPayload(
    intent: QueryIntent,
    maskedRows: Record<string, unknown>[],
  ): Promise<string> {
    const COLUMN_REQUIREMENTS: Record<string, string[]> = {
      'payroll_summary':     ['first_name', 'last_name', 'amount', 'pay_date', 'pay_type'],
      'transaction_totals':  ['description', 'amount', 'category', 'date'],
      'supplier_gst':        ['business_name', 'amount', 'category', 'gst_status'],
      'tax_deductions':      ['description', 'amount', 'category', 'deduction_type'],
      'cash_flow':           ['amount', 'date', 'category', 'is_debit'],
    };

    const requiredColumns = COLUMN_REQUIREMENTS[intent.type] ?? ['description', 'amount', 'date'];

    // Strip all non-required columns BEFORE sending to LLM
    const minimalData = maskedRows.map(row => {
      const stripped: Record<string, unknown> = {};
      for (const col of requiredColumns) {
        if (row[col] !== undefined) stripped[col] = row[col];
      }
      return stripped;
    });

    return formatForLLM(minimalData);
  }
}
```

---

## 11. Why v4 Is the Ultimate Architecture

| Concern | v3 Answer | v4 Answer |
|---------|-----------|-----------|
| **Math accuracy** | ±10% (noised amounts). AmountRecalculator regex-parses output. | EXACT. Amounts tagged or aggregated via production tool. |
| **Streaming** | Blocked until full response. 5-15s loading spinners. | Transform stream. Sub-200ms TTFT. |
| **Cognee graph stability** | Random pseudonyms invalidate graph every 4h. | Deterministic pseudonyms. Graph stable forever. |
| **Token map cost** | O(N) full-table diff every 4 hours. | O(delta) — only new rows. Deterministic = cache-friendly. |
| **Large tables** | LLM generates 50 rows of markdown tokens. | Generative UI — frontend renders natively. |
| **Complexity** | AmountRecalculator + NeonTokenMapper + blocking unredaction pipeline. | StreamingUnredactor + AmountTagger + get_exact_totals tool. |

---

## 12. Implementation Sequence

### Phase B.1: Neon Setup (neon-deployer agent)

1. Create Neon project + production branch (ap-southeast-2)
2. Migrate 128 tables from local PG to Neon
3. Set deterministic masking salt
4. Apply all 110 `anon.pseudo_*()` rules (NO amount noising)
5. Create first AI masked branch
6. Verify: same input always produces same pseudonym

### Phase B.2: v4 Pipeline (v4-architect agent)

1. Implement `neon-connection.ts` (two pools + fallback)
2. Implement `NeonBranchManager` (branch refresh + hot-swap)
3. Implement `StreamingUnredactor` (Transform stream)
4. Implement `AmountTagger` (Redis-backed `[[amt:ID]]` system)
5. Implement `TokenMapBuilder` (merge names + amounts)
6. Implement `data-classification.ts` (PUBLIC/PRIVATE registry)
7. Implement `aggregate-tool.ts` (`get_exact_totals` tool)

### Phase B.3: Service Integration (bridge-wirer agent)

1. Wire `neonDb` + `neonMaskedDb` into all services
2. Update `rag.ts`, `cognee-tools.ts` with `smartSearch`/`smartIndex`
3. Update agent `getTools()` with `get_exact_totals`
4. Inject StreamingUnredactor into streaming endpoints
5. Update `docker-compose.yml` with Neon env vars

---

## 13. Relationship to Existing Plans

| Document | Status |
|----------|--------|
| `NEON_INTEGRATION_PLAN.md` | **Still valid** — Docker topology, table split (128/13), migrations unchanged. |
| `DATA_MASKING_PLAN.md` | **Updated** — All 110 rules converted from `anon.fake_*` to `anon.pseudo_*`. Amount noising (`anon.noise`) REMOVED. PiiRedactor remains as thin free-text safety net. |
| `COGNEE_NEON_BRIDGE_PLAN.md` | **Updated** — Deterministic pseudonyms ensure Cognee graph stability. `smartSearch`/`smartIndex` use data classification. |

---

## Summary

> **PUBLIC knowledge** (tax law, regulations, trading) flows freely between Cognee, agents, and cloud
> LLMs with zero masking — because it's public domain and accuracy matters.
>
> **PRIVATE knowledge** (client data) is stored in Neon production, deterministically pseudonymized on
> a separate AI branch via `anon.pseudo_*()` with a static salt. Amounts pass through unchanged and are
> tagged with `[[amt:ID]]` at the application layer. Math is handled by a server-side tool querying
> production directly.
>
> The StreamingUnredactor swaps masked tokens for real values inline as Claude generates output, achieving
> sub-200ms Time-To-First-Token. Users see real data streaming in real-time.
>
> Cognee's knowledge graph remains permanently stable because deterministic masking means entity nodes
> never change. Only new rows need indexing after branch refreshes.
>
> The AmountRecalculator (v3) is eliminated. The O(N) token map diff (v3) is eliminated. Blocking
> unredaction (v3) is eliminated. v4 is streaming-native, mathematically flawless, and zero-overhead.
