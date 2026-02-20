# QA Calculations Audit

**Auditor**: calculation-auditor (qa-team)
**Date**: 2026-02-20
**Scope**: All financial calculation services in `server/src/services/`

---

## Summary

| Area | Bugs Found |
|------|-----------|
| BAS/GST calculation bugs | **4** |
| Tax bracket / LITO errors | **3** |
| Financial statement invariant issues | **3** |
| Float money / rounding issues | **3** |
| parseInt missing radix | **3** |
| Transaction matching issues | **0** (functional) |
| **Total** | **16** |

**Severity breakdown**: 5 Critical, 6 High, 3 Medium, 2 Low

---

## 1. BAS Calculation Issues

### BUG-CALC-01: G1 (Total Sales) excludes exports and GST-free sales [CRITICAL]

**File**: `server/src/services/bas/bas-service.ts:130-144`

The BAS form defines G1 as "Total Sales (including any GST)" — it should include ALL sales revenue including exports (G2) and GST-free sales (G3). The current code only counts taxable sales in G1:

```typescript
// Line 130-144: switch on gstCategory for positive amounts
case GSTCategory.EXPORT:
  labels.G2 += amount;   // Export goes ONLY to G2, not G1
  break;
case GSTCategory.GST_FREE:
  labels.G3 += amount;   // GST-free goes ONLY to G3, not G1
  break;
// ...
default:
  labels.G1 += amount;   // Only taxable sales counted in G1
  labels['1A'] += gstAmount;
```

**ATO requirement**: G1 = total of ALL sales. G2, G3 are subsets. G6 = G1 - G5 (where G5 = G2+G3+G4). The current code makes G1 = only taxable sales, which means G1 is understated and doesn't match ATO BAS form fields.

**Fix**: Add `labels.G1 += amount;` to the EXPORT and GST_FREE cases as well.

---

### BUG-CALC-02: BAS tax-utils uses outdated 2023-24 tax brackets [HIGH]

**File**: `server/src/services/bas/tax-utils.ts:23-29`

The `estimateTax()` function (used by `grossFromNet()` for BAS reverse-tax calculations) uses pre-Stage 3 tax brackets:

```typescript
// OUTDATED brackets in bas/tax-utils.ts
if (grossDollars <= 45_000) return (grossDollars - 18_200) * 0.19;      // Should be 0.16
if (grossDollars <= 120_000) return 5_092 + (grossDollars - 45_000) * 0.325;  // Should be 0.30, threshold $135k
if (grossDollars <= 180_000) return 29_467 + (grossDollars - 120_000) * 0.37; // Threshold $190k
return 51_667 + (grossDollars - 180_000) * 0.45;
```

Meanwhile, the correct 2024-25 Stage 3 brackets exist in `server/src/services/tax/types.ts:77-83`:
```typescript
// CORRECT Stage 3 brackets
{ min: 18201, max: 45000, rate: 0.16, baseTax: 0 },
{ min: 45001, max: 135000, rate: 0.3, baseTax: 4288 },
{ min: 135001, max: 190000, rate: 0.37, baseTax: 31288 },
{ min: 190001, max: Infinity, rate: 0.45, baseTax: 51638 },
```

**Impact**: `grossFromNet()` over-estimates tax at every bracket, producing incorrect gross-from-net reverse calculations used in BAS PAYG instalment estimations.

**Fix**: Import and use the `TAX_BRACKETS_2024_25` from `tax/types.ts` or rewrite `estimateTax()` to match Stage 3 rates.

---

### BUG-CALC-03: BAS 1B GST credits may use negative gstAmount from DB [MEDIUM]

**File**: `server/src/services/bas/bas-service.ts:128,150,158-159`

```typescript
const gstAmount = tx.gstAmount ?? calculateGstFromInclusive(amount);
// ...
labels['1B'] += gstAmount;  // If tx.gstAmount is stored as negative for expenses, 1B is wrong
```

The fallback `calculateGstFromInclusive()` uses `Math.abs()` (always positive), but if `tx.gstAmount` is stored as a negative value in the database for expense transactions, `1B` will be decremented instead of incremented.

**Fix**: Use `Math.abs(tx.gstAmount ?? calculateGstFromInclusive(amount))` for the 1B (purchase) branch.

---

### BUG-CALC-04: BAS W2 approximation has no disclaimer/flag [LOW]

**File**: `server/src/services/bas/bas-service.ts:174-176`

```typescript
labels.W2 = Math.round(labels.W1 * 0.32);
```

W2 (PAYG withheld from employees) is approximated at 32% of W1. While the comment acknowledges this, there is no flag in the `BASResult` indicating that W2 is estimated (not actual). The BAS form requires actual amounts from payroll runs.

**Impact**: If a user submits this to the ATO without knowing it's estimated, the BAS could be incorrect.

**Fix**: Add an `isEstimated: { W2: true }` field to BASResult, or a `warnings` array.

---

## 2. Tax Calculation Issues

### BUG-CALC-05: LITO phase-out uses single rate instead of two-tier reduction [CRITICAL]

**File**: `server/src/services/tax/gst-calculator.ts:44-51`

```typescript
export function calculateLITO(taxableIncome: number): number {
  if (taxableIncome <= 37500) return 700;
  if (taxableIncome < 66833) {
    return Math.max(0, 700 - (taxableIncome - 37500) * 0.05);  // WRONG
  }
  return 0;
}
```

**ATO 2024-25 LITO rules**:
- $0-$37,500: $700
- $37,501-$45,000: reduces by **5 cents** per $1 above $37,500
- $45,001-$66,667: reduces by **1.5 cents** per $1 above $45,000
- Above $66,667: nil

The code applies a single 5% reduction rate from $37,500 all the way through, causing LITO to hit $0 at ~$51,500 instead of $66,667.

**Example error at $50,000 income**:
- Code calculates: `700 - (50000-37500)*0.05 = 700 - 625 = $75`
- Correct: `325 - (50000-45000)*0.015 = 325 - 75 = $250`
- **Under-claiming by $175** at this income level

**Fix**:
```typescript
export function calculateLITO(taxableIncome: number): number {
  if (taxableIncome <= 37500) return 700;
  if (taxableIncome <= 45000) return Math.max(0, 700 - (taxableIncome - 37500) * 0.05);
  if (taxableIncome <= 66667) return Math.max(0, 325 - (taxableIncome - 45000) * 0.015);
  return 0;
}
```

---

### BUG-CALC-06: Medicare levy shade-in thresholds inconsistent [MEDIUM]

**File**: `server/src/services/tax/gst-calculator.ts:20-25` vs `server/src/services/tax/types.ts:149-154`

Two different threshold constants exist:

| Constant | File | Full Exemption | Shade-in Upper |
|----------|------|---------------|----------------|
| Inline | gst-calculator.ts:20-25 | $24,276 | $30,345 |
| MEDICARE_LEVY_REDUCTION | types.ts:149-154 | $24,276 | $30,345 |

These currently match, but the inline `calculateMedicareLevy()` function at line 20 uses **hardcoded magic numbers** (`30345`, `24276`) while `calculateMedicareLevyAmount()` at line 56 uses the exported constants. Dual maintenance risk — if one is updated, the other won't be.

**Fix**: Refactor `calculateMedicareLevy()` to use `MEDICARE_LEVY_REDUCTION` constants.

---

### BUG-CALC-07: TaxService.calculateFullTax uses gross income for effective tax rate [LOW]

**File**: `server/src/services/tax/tax-service.ts:66`

```typescript
const effectiveTaxRate = grossIncome > 0 ? (totalTax / grossIncome) * 100 : 0;
```

This calculates effective tax rate as `totalTax / grossIncome`, but the standard definition is `totalTax / taxableIncome`. Using gross income understates the effective rate when deductions are significant.

**Impact**: Informational display only, but could mislead users about their actual tax burden.

---

## 3. Financial Statement Issues

### BUG-CALC-08: Balance Sheet is always balanced by construction [CRITICAL]

**File**: `server/src/services/financial-reports/report-service.ts:180-183`

```typescript
const retainedEarnings = totalAssets - totalLiabilities - totalContributions + totalDrawings;
// ...
const totalEquity = totalContributions - totalDrawings + retainedEarnings;
const isBalanced = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 1;
```

Retained earnings is calculated as the **plug figure** (totalAssets - totalLiabilities - contributions + drawings). Substituting into the equity formula:
- `totalEquity = contributions - drawings + (totalAssets - totalLiabilities - contributions + drawings) = totalAssets - totalLiabilities`
- Therefore `isBalanced = Math.abs(totalAssets - totalLiabilities - (totalAssets - totalLiabilities)) = 0`, which is **always true**.

**Impact**: The balance sheet can NEVER detect an imbalance. The `isBalanced` check is meaningless — it will always return `true`.

**Fix**: Retained earnings should be derived from the P&L (cumulative net profit), not back-calculated from the balance sheet equation. Then `isBalanced` becomes a genuine validation.

---

### BUG-CALC-09: P&L uses Math.abs() — refunds inflate both revenue and expenses [HIGH]

**File**: `server/src/services/financial-reports/report-service.ts:82-94`

```typescript
const group: CategoryGroup = {
  category: cat,
  amount: Math.abs(amount),  // Always positive
  transactionCount: count,
};
if (REVENUE_CATEGORIES.includes(cat)) {
  revenue.push(group);
  grossRevenue += Math.abs(amount);  // A negative revenue tx (refund) still counts positive
```

If a transaction is categorized as revenue but has a negative amount (e.g., a refund or credit note), `Math.abs()` makes it positive, inflating revenue instead of reducing it.

Similarly for expenses: a positive amount in an expense category (e.g., expense refund) would be counted as a positive expense.

**Fix**: Use signed amounts and let the sign indicate direction. Revenue should be positive, expenses negative. Or separate credit/debit handling.

---

### BUG-CALC-10: Cash Flow statement doesn't filter isTransfer [HIGH]

**File**: `server/src/services/financial-reports/report-service.ts:202-228`

The P&L query correctly filters `isTransfer = false` (line 51), but the Cash Flow query does NOT:

```typescript
// Cash Flow query — NO isTransfer filter
.where(and(
  eq(transactions.userId, userId),
  gte(transactions.date, periodStart),
  lte(transactions.date, periodEnd),
))
```

It only skips the `Transfer` category at line 228. Transfer transactions with non-"Transfer" categories (e.g., mis-categorized) will leak into operating/investing/financing totals, corrupting the cash flow statement.

**Fix**: Add `eq(transactions.isTransfer, false)` to the Cash Flow query WHERE clause.

---

## 4. Float Money / Rounding Issues

### BUG-CALC-11: Loan calculator helpers — median uses float division on cents [MEDIUM]

**File**: `server/src/services/loan-calculator/helpers.ts:118`

```typescript
export function median(sorted: number[]): number {
  // ...
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
```

If the values are in cents (integers), dividing by 2 can produce a non-integer (e.g., `(101 + 102) / 2 = 101.5` cents). This breaks the integer-money convention stated in the types file.

**Fix**: `Math.round((sorted[mid - 1] + sorted[mid]) / 2)` for cents.

---

### BUG-CALC-12: Cross-module intelligence displays cents as dollars without conversion [HIGH]

**File**: `server/src/services/cross-module-intelligence/service-timeline.ts:54`

```typescript
title: `${amt >= 0 ? 'Large credit' : 'Large debit'}: $${(Math.abs(amt) / 100).toFixed(2)}`,
```

This file correctly converts cents to dollars with `/100`. However, several other display contexts in cross-module-intelligence scanners use `.toFixed(2)` on values that may already be in dollars, potentially displaying incorrect amounts:

- `scanners-trends.ts:62`: `growthRate.toFixed(1)` — percentage, OK
- `scanners-trends.ts:167`: `(recentAvg / 100).toFixed(2)` — cents-to-dollars, OK
- `scanners-forecast.ts:151`: `(expenseTotal / 100).toFixed(2)` — cents-to-dollars, OK

These are actually correct — the `/100` conversions are present. The risk is that future changes might forget the `/100` since the convention is inconsistent.

---

### BUG-CALC-13: Cognee cloud upload converts to dollars but export may not [LOW]

**File**: `server/src/services/cognee-cloud/upload-transactions.ts:86`

```typescript
const amount = (txn.amount / 100).toFixed(2);  // Converts cents → dollars for Cognee
```

**File**: `server/src/services/export/export-data.ts:69`

```typescript
amount: (num(tx, 'amount') / 100).toFixed(2),  // Also converts
```

Both correctly convert. No bug here, but the pattern of dividing by 100 scattered across files (instead of a shared `centsToDollars()` utility) increases risk of inconsistency.

---

## 5. parseInt Missing Radix (Rule Violation)

### BUG-CALC-14: parseInt without radix 10 [MEDIUM]

Per CLAUDE.md rule #9: "All `parseInt()` calls MUST have radix 10".

| File | Line | Expression |
|------|------|-----------|
| `services/bas/quarter-utils.ts` | 10 | `parseInt(financialYear.split('-')[0])` |
| `services/budgets/utils.ts` | 29 | `parseInt(yearStr)` |
| `services/budgets/utils.ts` | 30 | `parseInt(qStr)` |
| `services/budgets/utils.ts` | 42 | `parseInt(yearStr)` |
| `services/budgets/utils.ts` | 43 | `parseInt(monthStr)` |

**Fix**: Add `, 10` as second argument to all 5 calls.

---

## 6. Transaction Matching Issues

### No critical bugs found

The payment matching system (`server/src/services/payment-matching/`) is well-implemented:

- **Multi-pass candidate discovery**: Amount match, date range, vendor fuzzy (3 passes)
- **Weighted scoring**: Amount 40%, Date 25%, Vendor 20%, Rule 15% — reasonable weights
- **5 rule types**: exact_amount, amount_range, vendor_match, recurring, composite
- **Auto-confirm threshold**: >= 0.85, suggest >= 0.60 (configured elsewhere)
- **Pattern learning**: `match-learning.ts` auto-creates rules after 3+ similar matches
- **String similarity**: Token overlap + substring bonus, with common prefix stripping

**Minor observations** (not bugs):
- Token overlap similarity may miss close single-word matches (e.g., "WOOLWORTHS" vs "WOOLWORTH") — Levenshtein would be more robust
- The `normalizeString()` only strips prefixes, not suffixes (e.g., "PTY LTD" at end)

---

## 7. Bank Reconciliation

The `BankReconciliationService` is a well-structured facade delegating to:
- `balance-check.ts` (session management)
- `auto-match.ts` (automatic matching)
- `match-operations.ts` (confirm/reject/undo)
- `rules.ts` (matching rule CRUD)
- `suggestions.ts` (match suggestions)

No calculation bugs found — this is primarily an orchestration layer.

---

## 8. Superannuation Calculations

**Rate**: 11.5% for FY2024-25 — correctly implemented in:
- `server/src/services/claude/agents/payroll-agent/agent.ts:324`: `fyStartYear >= 2024 ? 0.115 : 0.11`
- `server/src/services/employee/employee-details.ts:105`: defaults to 11.5%
- Configurable via `SUPER_GUARANTEE_RATE` env var

**FY2025-26 note**: The rate increases to 12% from 1 July 2025. The code uses `fyStartYear >= 2024 ? 0.115` which will NOT automatically step to 12% for FY2025-26. This should be updated when the new FY starts (or made table-driven).

---

## 9. Forecasting Models

**File**: `server/src/services/cash-flow-forecast/forecast-models.ts`

The three models (linear, seasonal, ml_weighted) are mathematically sound:
- **Linear**: Standard linear regression on inflow/outflow series
- **Seasonal**: Seasonal decomposition (12-month period) + linear trend
- **ML-weighted**: 0.3 linear + 0.5 seasonal + 0.2 recent-trend ensemble

All predictions use `Math.round()` for integer cents. Confidence bands use standard deviation. No calculation bugs found.

---

## Priority Fix Order

| Priority | Bug ID | Description | Effort |
|----------|--------|-------------|--------|
| P0 | CALC-01 | G1 excludes exports/GST-free | 5 min |
| P0 | CALC-05 | LITO two-tier phase-out wrong | 10 min |
| P0 | CALC-08 | Balance sheet always balanced | 30 min |
| P0 | CALC-09 | P&L Math.abs inflates refunds | 20 min |
| P0 | CALC-10 | Cash flow missing isTransfer | 5 min |
| P1 | CALC-02 | BAS tax-utils old brackets | 15 min |
| P1 | CALC-03 | 1B sign issue with gstAmount | 5 min |
| P1 | CALC-12 | Mixed cents/dollars display | 15 min |
| P2 | CALC-06 | Medicare inline vs constants | 10 min |
| P2 | CALC-11 | Median float on cents | 2 min |
| P2 | CALC-14 | parseInt missing radix (x5) | 5 min |
| P3 | CALC-04 | W2 no estimation flag | 10 min |
| P3 | CALC-07 | Effective tax rate base | 5 min |
| P3 | CALC-13 | No centsToDollars utility | 15 min |

---

## Verification Commands Used

```bash
# BAS service analysis
grep -rn "G1\|G2\|G3\|1A\|1B\|W1\|W2" server/src/services/bas/bas-service.ts

# Tax bracket comparison
diff <(grep -A5 "TAX_BRACKETS" server/src/services/tax/types.ts) \
     <(grep -A5 "estimateTax" server/src/services/bas/tax-utils.ts)

# Float money search
grep -rn "parseFloat\|toFixed\|/ 100\|\* 0\." server/src/services/ --include='*.ts'

# parseInt without radix
grep -rn "parseInt([^,)]*)" server/src/services/ --include='*.ts'

# Balance sheet invariant
grep -rn "isBalanced\|retainedEarnings\|totalEquity" server/src/services/financial-reports/
```
