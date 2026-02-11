# T4: Accuracy Invariants & Reconciliation Audit

**Auditor:** Accuracy Invariants & Reconciliation Engineer
**Date:** 2026-02-11
**Status:** Complete
**Scope:** Financial accuracy invariants, GST/BAS consistency, reconciliation logic, duplicate prevention, transfer detection

---

## Executive Summary

The system has **foundational accuracy controls** but contains several **critical gaps** that undermine the "numbers can't be wrong" contract. The most serious issues are:

1. **No enforced balance invariant** (`opening + sum(tx) = closing`) — metadata is stored but never validated
2. **Duplicate GST calculation functions** with inconsistent signatures across pipeline, enrichment, and BAS modules
3. **No transaction-level duplicate prevention** on reprocess — only statement-level (file hash) dedup exists
4. **Python and TypeScript BAS implementations diverge** in GST-free category lists and BAS label G1 semantics
5. **Transfer detection runs but does not prevent double-counting retroactively** — already-categorized income/expense is not recalculated after transfers are detected

---

## 1. Balance Invariant: `opening + sum(tx) = closing`

### Finding: NOT ENFORCED

**Expected invariant:** For each statement, `opening_balance + sum(transaction.amount for all tx in statement) == closing_balance`.

**What exists:**
- `statements` table has `opening_balance` and `closing_balance` columns (`schema.ts:187-188`)
- `computeStatementMetadata()` (`pipeline.ts:50-63`) computes these values
- `account-reconciler.ts:274-305` has a `check_running_balance` tool handler that performs the check
- `reconciliation_agent.py:90-120` has a `verify_balance_totals` tool that checks `opening + sum(tx) == closing`
- `index.ts:1156-1168` checks balance continuity between consecutive statements

**Critical gaps:**

| Gap | Location | Severity |
|-----|----------|----------|
| `computeStatementMetadata()` sets `openingBalance` from AI-detected info OR first transaction's `balance_cents` — these may differ | `pipeline.ts:59` | **CRITICAL** |
| `closingBalance` set from last transaction's `balance_cents` — only valid if transactions are sorted by date AND balance field is populated | `pipeline.ts:60` | **CRITICAL** |
| Claude agent path sets `openingBalance` from `rawData.transactions[0]?.balance_cents` (first parsed tx, not necessarily sorted by date) | `pipeline.ts:540-541` | **CRITICAL** |
| No code path ever **enforces** or **validates** that `opening + sum(tx) = closing` at insert time | Entire pipeline | **CRITICAL** |
| Reconciler agent tools exist but are never called automatically after parsing — they require manual invocation | `account-reconciler.ts` | HIGH |
| Balance continuity check (`index.ts:1156-1168`) only runs on the `/api/reconciliation/health` endpoint — not during pipeline processing | `index.ts` | HIGH |

**Recommendation:** Add a post-insert validation step in `pipeline.ts` that computes `sum(tx.amount)` for all inserted transactions and compares against `closingBalance - openingBalance`. Flag discrepancies as `reconciliation_alerts`.

---

## 2. Duplicate Transaction Prevention

### Finding: PARTIAL — Statement-level only, no transaction-level dedup on reprocess

**What exists:**

| Layer | Mechanism | Location | Effective? |
|-------|-----------|----------|------------|
| Statement upload | SHA-256 file hash → `statements.hash` UNIQUE constraint | `index.ts:488-498`, `schema.ts:177` | YES |
| Upload queue | Hash-based duplicate check | `queue.ts:845-848` | YES |
| Anomaly detection | Same-day + same-amount flagging (display only, not prevention) | `index.ts:3990-4012` | Display only |
| Vision dedup | Boundary dedup in vision batched parsing | `ai.ts:189-202` | Partial |
| Reconciler agent | `find_duplicates` tool (O(n^2) comparison) | `account-reconciler.ts:153-202` | Manual only |

**Critical gaps:**

| Gap | Severity |
|-----|----------|
| If the same PDF is re-uploaded with a single byte changed (e.g., metadata), a new hash is computed and **all transactions are inserted again** | **CRITICAL** |
| No unique constraint on `(statementId, date, description, amount)` or similar composite key on the `transactions` table | **CRITICAL** |
| Pipeline does not check for existing transactions with matching `(date, amount, description)` before inserting | HIGH |
| `account-reconciler.ts:174-178` duplicate detection only checks exact match on `(amount, date, description)` — no fuzzy matching for slight description variations | MEDIUM |

**Recommendation:** Add a composite unique index or hash-based dedup check before transaction insertion:
```
hash = SHA256(statementId + date + description + amount)
```
Or at minimum, query for existing transactions with same `(accountId, date, amount, description)` before insert.

---

## 3. GST Calculation Consistency

### Finding: THREE SEPARATE `calculateGstFromInclusive` IMPLEMENTATIONS with subtle differences

**Implementation comparison:**

| Location | Function | Formula | Uses `Math.abs`? | Default rate |
|----------|----------|---------|------------------|-------------|
| `bas.ts:124-127` | `calculateGstFromInclusive(amountCents, gstRate=0.10)` | `Math.round(Math.abs(amountCents) * gstRate / (1 + gstRate))` | YES | 0.10 |
| `pipeline.ts:25-27` | `calculateGstAmount(amountCents)` | `Math.round(Math.abs(amountCents) * GST_RATE / (1 + GST_RATE))` | YES | 0.10 (hardcoded) |
| `gst_rules.py:147-163` | `calculate_gst_from_inclusive(amount_cents, gst_rate=0.10)` | `round(abs(amount_cents) * gst_rate / (1 + gst_rate))` | YES | 0.10 |

**Result:** All three implementations use the **same formula** and produce the **same results** for the same inputs. The formula `amount * rate / (1 + rate)` is mathematically correct for extracting GST from a GST-inclusive amount.

**However, usage is inconsistent:**

| Issue | Location | Severity |
|-------|----------|----------|
| `pipeline.ts` defines its own `calculateGstAmount()` instead of importing from `bas.ts` — code duplication | `pipeline.ts:25-27` vs `bas.ts:124-127` | MEDIUM |
| `bas.ts:240` falls back to `calculateGstFromInclusive(amount)` when `tx.gstAmount` is null/0 — but this ignores GST category (could compute GST for GST-free items) | `bas.ts:240` | **CRITICAL** |
| `enrichment.ts:50` and `enrichment.ts:165` both call `calculateGstFromInclusive()` correctly with amount, but the import path goes through `bas.ts` while pipeline uses its own copy | Various | LOW |

**Critical BAS bug at `bas.ts:240`:**
```typescript
const gstAmount = tx.gstAmount || calculateGstFromInclusive(amount);
```
This line means: if a transaction has `gstAmount = 0` (which is correct for GST-free items), the `||` operator treats `0` as falsy and **recalculates GST as if it were taxable**. This corrupts BAS labels 1A and 1B for GST-free transactions that have `gstCategory` set but `gstAmount = 0`.

**Fix:** Change to `tx.gstAmount ?? calculateGstFromInclusive(amount)` (nullish coalescing).

---

## 4. BAS Label Calculation: TypeScript vs Python Cross-Check

### Finding: DIVERGENT — Category lists and G1 semantics differ

**GST-free category comparison:**

| TS `enrichment.ts:28-34` GST_FREE_CATEGORIES | TS `pipeline.ts:30-36` GST_FREE_CATEGORIES | Python `gst_rules.py:54-96` GST_FREE_PATTERNS |
|------|------|------|
| Government & Tax | Government & Tax | (no pattern) |
| Internal Transfer | Internal Transfer | (no pattern) |
| Transfer | Transfer | (no pattern) |
| Interest & Dividends | Interest & Dividends | (no pattern) |
| Loan/Liability Payment | Loan/Liability Payment | (no pattern) |
| Superannuation | Superannuation | (no pattern) |
| Insurance | Insurance | (no pattern) |
| Medical & Health | Medical & Health | medical patterns |
| Education & Childcare | Education & Childcare | education patterns |
| Donations & Charity | Donations & Charity | charity patterns |
| Employment Income | Employment Income | (no pattern) |
| Salary & Wages | Salary & Wages | (no pattern) |

**Key divergences:**

| Issue | TS behavior | Python behavior | Severity |
|-------|-------------|-----------------|----------|
| GST-free detection method | Category name lookup (Set membership) | Regex pattern matching on description | HIGH |
| Fresh food (Woolworths, Coles, Aldi) | NOT GST-free | GST-free | **CRITICAL** |
| Water/sewerage | NOT GST-free | GST-free | MEDIUM |
| Insurance | GST-free (set membership) | NOT explicitly matched (defaults to taxable_10) | HIGH |
| Superannuation | GST-free (set membership) | NOT explicitly matched (defaults to taxable_10) | HIGH |
| Interest & Dividends | Both GST-free AND input-taxed (in both sets!) | Input-taxed patterns take priority | **CRITICAL** |

**BAS Label G1 semantics:**

| Implementation | G1 includes | Notes |
|----------------|-------------|-------|
| TS `bas.ts:245-258` | Only taxable_10 income (default case) | G2 (exports) and G3 (GST-free) are separate; INPUT_TAXED and PRIVATE are excluded |
| Python `gst_rules.py:416-427` | Same — only taxable income goes to G1 | Matches TS logic |
| Python `bas_agent.py:449-462` `calculate_bas_summary` tool | **ALL positive amounts** go to `total_sales` / `label_G1` | **DIVERGES** — treats all income as G1 |

**Critical:** The `calculate_bas_summary` tool in `bas_agent.py:449-462` does a naive `sum(amount for tx if amount > 0)` for G1, ignoring GST categories entirely. This would overstate G1 if any income is GST-free or input-taxed.

**Net GST formula comparison (consistent):**
- TS `bas.ts:282`: `netGst = labels['1A'] - labels['1B']`
- Python `gst_rules.py:460`: `net_gst = self.labels["1A"] - self.labels["1B"]`
- Both: `totalPayable = netGst + W2 + 5A - fuelTaxCredits` ✓

---

## 5. Transfer Detection & Double-Counting

### Finding: TRANSFERS DETECTED BUT NOT RETROACTIVELY EXCLUDED

**Transfer detection algorithm** (`detector.ts:102-169`):

| Criterion | Weight | Notes |
|-----------|--------|-------|
| Exact amount match | +0.40 | Required (null returned if beyond tolerance) |
| Amount within $5 tolerance | +0.30 | Alternative to exact match |
| Same day | +0.25 | Date proximity scoring |
| Next day | +0.20 | |
| 2-3 days apart | +0.10 | Max window: 3 days |
| Both have transfer keywords | +0.20 | |
| One has transfer keyword | +0.10 | |
| Credit references source account (last 4 digits) | +0.15 | |
| Debit references target account | +0.15 | |
| Same bank | +0.10 | |
| Credit card payment | +0.15 | |
| Owner contribution (personal→business) | +0.10 | |
| **Minimum confidence** | **0.60** | Below this, match is rejected |

**Persistence** (`persistence.ts:22-83`):
- Creates `transfer_links` record
- Sets `isTransfer = true` on both transactions
- Sets `category = 'Transfer'` on both transactions

**BAS exclusion** (`bas.ts:218`):
```typescript
eq(transactions.isTransfer, false), // Exclude transfers
```
✓ This correctly excludes transfers from BAS calculation.

**Tax exclusion** (`tax.ts:1033`):
```typescript
eq(transactions.isTransfer, false),
```
✓ This correctly excludes transfers from tax calculation.

**Gap — Timing problem:**

| Issue | Location | Severity |
|-------|----------|----------|
| Transfer detection runs **after** transaction insertion in pipeline (`pipeline.ts:797-876`) | `pipeline.ts` | MEDIUM |
| If BAS/tax is calculated between insertion and transfer detection, transfers are counted as income/expense | Race condition | MEDIUM |
| If transfer detection fails (non-fatal error, `pipeline.ts:873`), transactions remain as income/expense permanently | `pipeline.ts:873` | HIGH |
| Transfer detection runs on **all** user transactions every time a new statement is processed — O(n^2) per account pair | `pipeline.ts:801-832` | MEDIUM (perf) |
| `detector.ts` uses `number` for `id` type but `transactions.id` in schema is `text` (UUID string) — type mismatch in `TransferCandidate` | `detector.ts:13` vs `schema.ts:204` | HIGH |

**Type mismatch detail:** `TransferCandidate.id` is `number` but transaction IDs are UUID strings. The pipeline at `pipeline.ts:811-819` maps `t.id` directly, and `persistence.ts:30-31` does `String(match.sourceTransaction.id)`. This works at runtime but is semantically wrong and could cause issues with equality checks.

---

## 6. Tolerance Rules

### Finding: IMPLICIT, NOT DOCUMENTED OR CONFIGURABLE

**Current tolerances found:**

| Tolerance | Value | Location | Context |
|-----------|-------|----------|---------|
| Transfer amount tolerance | $5.00 (500 cents) | `detector.ts:51` | Default, configurable via constructor |
| Transfer date window | 3 days | `detector.ts:49` | Default, configurable |
| Transfer minimum confidence | 0.60 | `detector.ts:53` | Default, configurable |
| Running balance check tolerance | 1 cent | `account-reconciler.ts:293` | Hardcoded: `Math.abs(runningBalance - tx.balance) > 1` |
| Reconciliation balance tolerance | $0.01 | `reconciliation_agent.py:118` | Hardcoded: `abs(discrepancy) < 0.01` |
| Duplicate detection: same day + same amount (expenses only) | Exact match | `index.ts:3999` | Only flags expenses, ignores income duplicates |
| Vision verification discrepancy threshold | 10% tx count difference → `needsReview`; 20% → warning | `pipeline.ts:615-617` | Count-based, not amount-based |

**Missing tolerances:**
- No rounding tolerance for GST calculations (uses `Math.round` to nearest cent)
- No tolerance for bank fees or charges that might cause balance drift
- No tolerance for pending/held transactions that appear on one statement but not another
- No configurable tolerance for BAS label cross-checks

---

## 7. GST/BAS Numbers: DB-Derived Only?

### Finding: MOSTLY YES, but with Cognee-adjacent risks

**Confirmed DB-derived:**
- `bas.ts:205-226`: BAS calculation queries `transactions` table directly with date range and account filters
- `tax.ts:1016-1069`: Tax calculation queries `transactions` table directly
- `enrichment.ts:40-52`: `inferGstCategory()` is a pure function (no Cognee dependency)
- `gst-calculator.ts`: All GST tools use `calculateGstFromInclusive()` from `bas.ts`

**Cognee involvement (non-numeric):**
- `enrichment.ts:266-273`: Stores merchant mappings in Cognee for semantic search — this is metadata, not financial calculations
- `account-reconciler.ts:307-312`: Has a `search_historical_patterns` tool that queries Cognee — used for pattern matching, not number computation
- `bas_agent.py:81`: System prompt mentions using `search_transaction_memory` — could influence categorization decisions

**Verdict:** Financial numbers (GST amounts, BAS labels, tax calculations) are **deterministically computed from DB rows**. Cognee is used only for merchant name resolution and categorization hints, which then influence which GST category is assigned. The categorization itself can change financial outcomes (taxable vs GST-free), so Cognee indirectly affects numbers through the categorization pathway.

---

## 8. Comprehensive Invariant Suite

### Invariant 1: Balance Continuity
```
For consecutive statements S1, S2 on the same account (ordered by periodStartDate):
  S1.closingBalance == S2.openingBalance
```
**Status:** Checked at `/api/reconciliation/health` (`index.ts:1156-1168`). NOT enforced at insert time.

### Invariant 2: Statement Transaction Sum
```
For each statement S with non-null opening and closing balances:
  S.openingBalance + SUM(tx.amount for tx in S.transactions) == S.closingBalance
```
**Status:** NOT CHECKED ANYWHERE IN PIPELINE. Only available via manual reconciler agent invocation.

### Invariant 3: No Duplicate Transactions on Reprocess
```
For each (accountId, date, description, amount) tuple:
  COUNT(transactions) == 1  [or known legitimate duplicates flagged]
```
**Status:** NOT ENFORCED. Only statement-level file hash dedup exists.

### Invariant 4: Transfer Neutrality
```
For each transfer link:
  source.amount + target.amount == 0  (within tolerance)
  source.isTransfer == true AND target.isTransfer == true
  Neither source nor target is included in BAS/tax calculations
```
**Status:** PARTIALLY ENFORCED. `isTransfer` flag is set; BAS/tax queries exclude `isTransfer=true`. Amount matching within $5 tolerance. But type mismatch (number vs string IDs) is a latent risk.

### Invariant 5: GST Consistency
```
For each transaction with gstCategory = 'taxable_10':
  gstAmount == Math.round(Math.abs(amount) * 0.10 / 1.10)
For each transaction with gstCategory in ('gst_free', 'input_taxed', 'private'):
  gstAmount == 0
```
**Status:** NOT ENFORCED. The `bas.ts:240` bug (`||` vs `??`) violates this for GST-free items with `gstAmount=0`.

### Invariant 6: BAS Label Consistency
```
labels['1A'] == SUM(gstAmount for income tx in quarter where gstCategory='taxable_10')
labels['1B'] == SUM(gstAmount for expense tx in quarter where gstCategory in ('taxable_10', 'capital'))
netGst == labels['1A'] - labels['1B']
totalPayable == netGst + labels['W2'] + labels['5A'] - labels['7C'] - labels['7D']
```
**Status:** Correctly implemented in `bas.ts:229-300`. The `bas.ts:240` bug could corrupt 1A/1B if individual transactions have incorrect `gstAmount`.

### Invariant 7: Idempotent Enrichment
```
Running enrichmentService.enrichTransactions() on already-enriched transactions
should not change gstAmount or gstCategory if isEdited=true
```
**Status:** NOT CHECKED. `enrichment.ts:172-189` updates transactions without checking `isEdited` flag for GST fields. User edits could be overwritten.

---

## 9. Summary of Findings by Severity

### CRITICAL

| # | Finding | Location |
|---|---------|----------|
| C1 | `bas.ts:240` uses `||` instead of `??` — treats `gstAmount=0` as falsy, recalculates GST for GST-free items | `bas.ts:240` |
| C2 | No transaction-level duplicate prevention on reprocess | `pipeline.ts` (missing) |
| C3 | `computeStatementMetadata()` opening/closing balance may not match actual parsed opening/closing | `pipeline.ts:50-63` |
| C4 | Claude agent path uses unsorted transaction array for opening/closing balance | `pipeline.ts:540-541` |
| C5 | Python `calculate_bas_summary` ignores GST categories for G1 — counts all income as taxable sales | `bas_agent.py:449-462` |
| C6 | `Interest & Dividends` is in BOTH `GST_FREE_CATEGORIES` and `INPUT_TAXED_CATEGORIES` in enrichment.ts — `input_taxed` check runs first so it wins, but this is confusing and fragile | `enrichment.ts:28-38` |

### HIGH

| # | Finding | Location |
|---|---------|----------|
| H1 | Balance invariant (`opening + sum(tx) = closing`) never validated in pipeline | `pipeline.ts` (missing) |
| H2 | Reconciler agent tools exist but never auto-invoked after parsing | `account-reconciler.ts` |
| H3 | Transfer detection failure is non-fatal — transactions remain as income/expense | `pipeline.ts:873` |
| H4 | `TransferCandidate.id` is `number` but actual IDs are UUID strings | `detector.ts:13` |
| H5 | Enrichment can overwrite user-edited GST fields (doesn't check `isEdited`) | `enrichment.ts:172-189` |
| H6 | Python `gst_rules.py` classifies insurance as taxable_10 (default); TS classifies as gst_free | Divergent |
| H7 | Python `gst_rules.py` classifies superannuation as taxable_10 (default); TS classifies as gst_free | Divergent |
| H8 | Fresh food (supermarkets) classified as GST-free in Python but NOT in TS | Divergent |

### MEDIUM

| # | Finding | Location |
|---|---------|----------|
| M1 | `pipeline.ts` has its own `calculateGstAmount()` instead of importing from `bas.ts` | `pipeline.ts:25-27` |
| M2 | Transfer detection runs on ALL user transactions every new statement — O(n^2) scaling | `pipeline.ts:801-832` |
| M3 | Duplicate anomaly detection only checks expenses (amount < 0), ignores income | `index.ts:3999` |
| M4 | Tolerance values are hardcoded across multiple files — no central configuration | Various |
| M5 | `pipeline.ts:42-47` has a different `inferGstCategory()` signature (takes `gstApplicable` boolean) vs `enrichment.ts:40` (takes `category, amount`) | Inconsistent |

---

## 10. Recommendations (Prioritized)

1. **FIX C1 IMMEDIATELY:** Change `bas.ts:240` from `||` to `??` to prevent GST miscalculation
2. **Add Invariant 2 check** after transaction insertion in pipeline — reject or alert if balance doesn't reconcile
3. **Add transaction-level dedup** via composite hash check before insert
4. **Sort transactions by date** before computing opening/closing balance in both pipeline paths
5. **Unify GST-free category lists** between Python and TypeScript — create a shared JSON or config file
6. **Check `isEdited` flag** in enrichment before overwriting GST fields
7. **Fix Python `calculate_bas_summary`** to respect GST categories for G1
8. **Add type safety** for `TransferCandidate.id` — change to `string` to match schema
9. **Centralize tolerance configuration** into a single config module
10. **Auto-invoke reconciler** after pipeline completion — at minimum, run balance check
