# Agent-03: Financial Statements Calculation Fixer

**Your role**: Fix critical bugs in P&L, Balance Sheet, Cash Flow, and Tax calculations.
**Working directory**: `/mnt/c/Users/Danie/Desktop/CBA Statements Parse`
**After every file change**: Run `cd server && npx tsc --noEmit` — must stay at 0 errors.

---

## FIX 1 (CRITICAL): Balance Sheet always balanced — isBalanced is meaningless

**File**: `server/src/services/financial-reports/report-service.ts`
**Lines**: ~180-196

**Problem**: `retainedEarnings` is calculated as a plug figure (the algebraic remainder to make the sheet balance). This means `isBalanced` is ALWAYS true — it can never detect real imbalances.

**Current broken code**:
```typescript
// retainedEarnings is a PLUG — always makes the equation true
const retainedEarnings = totalAssets - totalLiabilities - totalContributions + totalDrawings;
const totalEquity = totalContributions - totalDrawings + retainedEarnings;
// totalEquity = contributions - drawings + (totalAssets - totalLiabilities - contributions + drawings)
// totalEquity = totalAssets - totalLiabilities  ← always true!
const isBalanced = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 1;
// isBalanced is ALWAYS true
```

**Fix**: Derive retained earnings from the cumulative P&L net profit (sum of income - expenses from all past transactions up to the period end):

```typescript
// Calculate cumulative retained earnings from all historical P&L transactions
const historicalPnL = await db
  .select({
    total: sql<number>`COALESCE(SUM(CASE
      WHEN ${transactions.type} = 'credit' THEN ${transactions.amount}
      ELSE -${transactions.amount}
    END), 0)`,
  })
  .from(transactions)
  .where(
    and(
      eq(transactions.userId, userId),
      lte(transactions.date, periodEnd),
      eq(transactions.isTransfer, false),
    )
  )
  .get();

const retainedEarnings = historicalPnL?.total ?? 0;

const totalEquity = totalContributions - totalDrawings + retainedEarnings;
const isBalanced = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 1;
```

You will need to import `sql`, `lte`, `and` from drizzle-orm if not already imported. Also import `transactions` from the schema.

---

## FIX 2 (HIGH): P&L uses Math.abs() — refunds inflate both revenue and expenses

**File**: `server/src/services/financial-reports/report-service.ts`
**Lines**: ~82-94

**Problem**: `Math.abs(amount)` makes refunds (negative revenue) appear as positive revenue, inflating total revenue.

**Current broken code**:
```typescript
const group: CategoryGroup = {
  category: cat,
  amount: Math.abs(amount),   // WRONG — refund becomes positive revenue
  transactionCount: count,
};
if (REVENUE_CATEGORIES.includes(cat)) {
  revenue.push(group);
  grossRevenue += Math.abs(amount);  // WRONG
```

**Fix**: Use signed amounts. Revenue transactions have positive amounts, expenses have negative (or revenue = credit, expenses = debit — check the data model):

Read the actual query to understand what sign convention is used for `amount`. Then:

```typescript
// Use the actual signed amount — do NOT wrap in Math.abs()
const group: CategoryGroup = {
  category: cat,
  amount: amount,    // ← remove Math.abs()
  transactionCount: count,
};
if (REVENUE_CATEGORIES.includes(cat)) {
  revenue.push(group);
  grossRevenue += amount;   // ← remove Math.abs()
```

If the P&L summary needs absolute values for display, that should be handled in the client, not the server.

**Note**: Check whether `amount` here is already signed (positive for credits, negative for debits) or always positive. Look at the SQL query above this block to understand the `amount` field sign convention.

---

## FIX 3 (HIGH): Cash Flow statement includes transfer transactions

**File**: `server/src/services/financial-reports/report-service.ts`
**Lines**: ~202-228

**Problem**: The cash flow query has no `isTransfer = false` filter. The P&L query has this filter (line 51) but the cash flow query does NOT.

**Current broken code** (cash flow query WHERE clause):
```typescript
.where(and(
  eq(transactions.userId, userId),
  gte(transactions.date, periodStart),
  lte(transactions.date, periodEnd),
  // ← NO isTransfer filter!
))
```

**Fix**: Add `eq(transactions.isTransfer, false)` to the WHERE clause:
```typescript
.where(and(
  eq(transactions.userId, userId),
  gte(transactions.date, periodStart),
  lte(transactions.date, periodEnd),
  eq(transactions.isTransfer, false),  // ← ADD THIS
))
```

You may need to import `eq` from drizzle-orm if not already done. Also check that `transactions.isTransfer` exists in the schema — it should be a boolean column.

---

## FIX 4 (LOW): Effective tax rate base uses gross income instead of taxable income

**File**: `server/src/services/tax/tax-service.ts`
**Lines**: ~66

**Problem**: Effective tax rate should be `totalTax / taxableIncome`, not `totalTax / grossIncome`. Using gross income understates the effective rate.

**Current code**:
```typescript
const effectiveTaxRate = grossIncome > 0 ? (totalTax / grossIncome) * 100 : 0;
```

**Fix**:
```typescript
const effectiveTaxRate = taxableIncome > 0 ? (totalTax / taxableIncome) * 100 : 0;
```

Make sure `taxableIncome` is in scope at that line. If not, look for where `taxableIncome` is calculated in the same function and use that variable.

---

## FIX 5 (MEDIUM): Loan calculator median — float division on integer cents

**File**: `server/src/services/loan-calculator/helpers.ts`
**Lines**: ~118

**Problem**: Median of an even-length array divides two adjacent integers, which can produce a non-integer (violates integer-money convention).

**Current code**:
```typescript
return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
```

**Fix**:
```typescript
return sorted.length % 2 !== 0
  ? sorted[mid]
  : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
```

---

## VERIFICATION

```bash
cd server && npx tsc --noEmit
```

Then commit:
```bash
git add server/src/services/financial-reports/report-service.ts
git add server/src/services/tax/tax-service.ts
git add server/src/services/loan-calculator/helpers.ts
git commit -m "fix(reports): balance sheet retained earnings, P&L sign, cash flow isTransfer filter"
```
