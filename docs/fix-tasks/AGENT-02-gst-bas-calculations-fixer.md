# Agent-02: GST & BAS Calculations Fixer

**Your role**: Fix all BAS/GST calculation bugs and tax bracket issues.
**Working directory**: `/mnt/c/Users/Danie/Desktop/CBA Statements Parse`
**After every file change**: Run `cd server && npx tsc --noEmit` — must stay at 0 errors.

---

## FIX 1 (CRITICAL): G1 Total Sales excludes exports and GST-free sales

**File**: `server/src/services/bas/bas-service.ts`
**Lines**: ~130-144

**Problem**: The ATO BAS form defines G1 as "Total Sales (including ALL types)". Exports (G2) and GST-free sales (G3) are SUBSETS of G1 — but the current code only adds taxable sales to G1, making G1 incorrect.

**Current broken code**:
```typescript
case GSTCategory.EXPORT:
  labels.G2 += amount;   // Export goes ONLY to G2, missing from G1
  break;
case GSTCategory.GST_FREE:
  labels.G3 += amount;   // GST-free goes ONLY to G3, missing from G1
  break;
// ...
default:
  labels.G1 += amount;   // Only taxable sales in G1
  labels['1A'] += gstAmount;
```

**Fix**: Add `labels.G1 += amount;` to EXPORT and GST_FREE cases:
```typescript
case GSTCategory.EXPORT:
  labels.G1 += amount;   // ADD THIS — G2 is a subset of G1
  labels.G2 += amount;
  break;
case GSTCategory.GST_FREE:
  labels.G1 += amount;   // ADD THIS — G3 is a subset of G1
  labels.G3 += amount;
  break;
```

**IMPORTANT**: Taxable sales should ALSO count in G1. Check if the `default` case already does this — if so, leave it. The G6 formula is: `G6 = G1 - G5` where `G5 = G2 + G3 + G4`. So G1 must include all of them.

---

## FIX 2 (MEDIUM): 1B GST credits sign issue

**File**: `server/src/services/bas/bas-service.ts`
**Lines**: ~128, 150, 158-159

**Problem**: `tx.gstAmount` stored as a negative value for expenses will DECREMENT 1B instead of incrementing it.

**Current code** (somewhere in the expense/purchase branch):
```typescript
const gstAmount = tx.gstAmount ?? calculateGstFromInclusive(amount);
// ...
labels['1B'] += gstAmount;  // Wrong if gstAmount is negative
```

**Fix**: Force absolute value for 1B:
```typescript
const gstAmount = Math.abs(tx.gstAmount ?? calculateGstFromInclusive(amount));
// ...
labels['1B'] += gstAmount;
```

Search for all `labels['1B'] +=` occurrences and ensure they use `Math.abs()`.

---

## FIX 3 (HIGH): Outdated 2023-24 tax brackets in bas/tax-utils.ts

**File**: `server/src/services/bas/tax-utils.ts`
**Lines**: ~23-29

**Problem**: `estimateTax()` uses pre-Stage 3 tax brackets. Stage 3 cuts took effect 1 July 2024.

**Current broken code**:
```typescript
if (grossDollars <= 45_000) return (grossDollars - 18_200) * 0.19;
if (grossDollars <= 120_000) return 5_092 + (grossDollars - 45_000) * 0.325;
if (grossDollars <= 180_000) return 29_467 + (grossDollars - 120_000) * 0.37;
return 51_667 + (grossDollars - 180_000) * 0.45;
```

**Correct 2024-25 Stage 3 brackets** (from `server/src/services/tax/types.ts:77-83`):
- $0-$18,200: Tax-free
- $18,201-$45,000: 16%
- $45,001-$135,000: 30%
- $135,001-$190,000: 37%
- $190,001+: 45%

**Fix**:
```typescript
export function estimateTax(grossDollars: number): number {
  if (grossDollars <= 18_200) return 0;
  if (grossDollars <= 45_000) return (grossDollars - 18_200) * 0.16;
  if (grossDollars <= 135_000) return 4_288 + (grossDollars - 45_000) * 0.30;
  if (grossDollars <= 190_000) return 31_288 + (grossDollars - 135_000) * 0.37;
  return 51_638 + (grossDollars - 190_000) * 0.45;
}
```

---

## FIX 4 (CRITICAL): LITO uses single 5% rate instead of two-tier reduction

**File**: `server/src/services/tax/gst-calculator.ts`
**Lines**: ~44-51

**Problem**: LITO phase-out is TWO rates (5 cents/$ then 1.5 cents/$), but the code only applies 5 cents all the way through, causing LITO to hit $0 at ~$51,500 instead of $66,667.

**ATO 2024-25 LITO rules**:
- $0 to $37,500: full $700
- $37,501 to $45,000: reduces by 5 cents per $1 above $37,500
- $45,001 to $66,667: reduces by 1.5 cents per $1 above $45,000
- Above $66,667: nil

**Current broken code**:
```typescript
export function calculateLITO(taxableIncome: number): number {
  if (taxableIncome <= 37500) return 700;
  if (taxableIncome < 66833) {
    return Math.max(0, 700 - (taxableIncome - 37500) * 0.05);  // WRONG — single rate
  }
  return 0;
}
```

**Fix**:
```typescript
export function calculateLITO(taxableIncome: number): number {
  if (taxableIncome <= 37_500) return 700;
  if (taxableIncome <= 45_000) return Math.max(0, 700 - (taxableIncome - 37_500) * 0.05);
  if (taxableIncome <= 66_667) return Math.max(0, 325 - (taxableIncome - 45_000) * 0.015);
  return 0;
}
```

Note: At $45,000: `700 - (45000-37500)*0.05 = 700 - 375 = 325`. So the second tier starts at $325.

---

## FIX 5 (MEDIUM): parseInt without radix 10 (5 occurrences)

Per CLAUDE.md rule #9: All parseInt() calls MUST have radix 10.

**File**: `server/src/services/bas/quarter-utils.ts` — line ~10
```typescript
// BROKEN:
parseInt(financialYear.split('-')[0])
// FIX:
parseInt(financialYear.split('-')[0], 10)
```

**File**: `server/src/services/budgets/utils.ts` — lines ~29, 30, 42, 43
```typescript
// BROKEN:
parseInt(yearStr)
parseInt(qStr)
parseInt(yearStr)
parseInt(monthStr)
// FIX: add , 10 to each
parseInt(yearStr, 10)
parseInt(qStr, 10)
parseInt(yearStr, 10)
parseInt(monthStr, 10)
```

---

## VERIFICATION

```bash
cd server && npx tsc --noEmit
```

Then commit:
```bash
git add server/src/services/bas/bas-service.ts
git add server/src/services/bas/tax-utils.ts
git add server/src/services/bas/quarter-utils.ts
git add server/src/services/tax/gst-calculator.ts
git add server/src/services/budgets/utils.ts
git commit -m "fix(bas): G1 total sales, 1B sign, LITO two-tier, Stage 3 brackets, parseInt radix"
```
