# Agent-04: GST Report Response Shape & Display Fixer

**Your role**: Fix the GST Summary crash, hardcoded sparklines, missing export wiring, and silent error catches.
**Working directory**: `/mnt/c/Users/Danie/Desktop/CBA Statements Parse`
**After every server file change**: Run `cd server && npx tsc --noEmit`.
**After every client file change**: Run `cd client && npx tsc --noEmit`.

---

## FIX 1 (CRITICAL): GST Summary server response missing `breakdown` field — crashes client

**Server file**: `server/src/routes/tax.ts`
**Lines**: ~94-136

**Problem**: Server returns:
```json
{ "gstCollected": N, "gstCredits": N, "netGST": N, "transactionsClassified": N, "transactionsNeedReview": N }
```

But the client's `GSTSummaryData` type (in `client/src/features/gst/types.ts:30-44`) expects:
```json
{
  "gstCollected": N, "gstCredits": N, "netGST": N,
  "breakdown": {
    "taxable": { "sales": N, "purchases": N },
    "gstFree": { "sales": N, "purchases": N },
    "inputTaxed": N, "capital": N, "private": N
  },
  "transactionsClassified": N,
  "transactionsNeedReview": N,
  "previousPeriodNetGST": N
}
```

`GSTSummary.tsx` at line ~110 tries to render `data.breakdown.taxable.sales` — this crashes with `TypeError: Cannot read properties of undefined (reading 'taxable')`.

**Fix approach**: Add the missing fields to the server response. Read the route handler carefully.

First READ `server/src/routes/tax.ts` lines 94-136 to understand what's already being queried. Then add breakdown calculation:

```typescript
// In the GST summary route handler, add breakdown data:

// Query breakdown by GST category for sales (credits/income)
const salesBreakdown = await db.select({
  gstCategory: transactions.gstCategory,
  total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
}).from(transactions)
.where(and(
  eq(transactions.userId, userId),
  eq(transactions.type, 'credit'),
  isNotNull(transactions.gstCategory),
  // add date filter if applicable
))
.groupBy(transactions.gstCategory)
.all();

// Query breakdown for purchases (debits)
const purchaseBreakdown = await db.select({
  gstCategory: transactions.gstCategory,
  total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
}).from(transactions)
.where(and(
  eq(transactions.userId, userId),
  eq(transactions.type, 'debit'),
  isNotNull(transactions.gstCategory),
))
.groupBy(transactions.gstCategory)
.all();

// Build breakdown object
const toMap = (rows: Array<{gstCategory: string | null, total: number}>) =>
  Object.fromEntries(rows.map(r => [r.gstCategory, r.total]));

const salesMap = toMap(salesBreakdown);
const purchaseMap = toMap(purchaseBreakdown);

// Previous period net GST
const prevPeriod = await getPreviousPeriodGST(userId, startDate, endDate);

return c.json({
  gstCollected,
  gstCredits,
  netGST,
  breakdown: {
    taxable: {
      sales: salesMap['TAXABLE'] ?? 0,
      purchases: purchaseMap['TAXABLE'] ?? 0,
    },
    gstFree: {
      sales: salesMap['GST_FREE'] ?? 0,
      purchases: purchaseMap['GST_FREE'] ?? 0,
    },
    inputTaxed: salesMap['INPUT_TAXED'] ?? purchaseMap['INPUT_TAXED'] ?? 0,
    capital: purchaseMap['CAPITAL'] ?? 0,
    private: purchaseMap['PRIVATE'] ?? 0,
  },
  transactionsClassified,
  transactionsNeedReview,
  previousPeriodNetGST: prevPeriod,
});
```

**Alternative (simpler) fix**: If adding the breakdown DB queries is complex, add null-safe defaults to the CLIENT component instead:

**Client file**: `client/src/features/gst/components/GSTSummary.tsx`
**Lines**: ~108-120 (wherever `data.breakdown.taxable.sales` is accessed)

Add optional chaining and fallbacks:
```typescript
// BEFORE (crashes):
data.breakdown.taxable.sales

// AFTER (safe):
data.breakdown?.taxable?.sales ?? 0
```

Do BOTH: add the breakdown field to the server response AND add null guards in the client.

---

## FIX 2 (MEDIUM): GST sparklines use hardcoded static data

**File**: `client/src/features/gst/components/GSTPage.tsx`
**Lines**: ~248-302

**Problem**: 4 summary cards use hardcoded data arrays instead of real data.

**Current code** (example):
```typescript
<SparklineCard
  title="GST Collected"
  data={[820, 950, 870, 1100, 1050, 1200]}  // ← FAKE DATA
  // ...
/>
```

**Fix**: Replace hardcoded arrays with real monthly GST data from the API. Either:

**Option A** (preferred): Add monthly GST trend to the existing GST summary API response. In `server/src/routes/tax.ts`, add a monthly breakdown query:
```typescript
// Query last 6 months of GST collected
const monthlyGSTCollected = await db.select({
  month: sql<string>`strftime('%Y-%m', ${transactions.date})`,
  total: sql<number>`COALESCE(SUM(${transactions.gstAmount}), 0)`,
}).from(transactions)
.where(and(
  eq(transactions.userId, userId),
  eq(transactions.type, 'credit'),
  isNotNull(transactions.gstAmount),
  gte(transactions.date, sixMonthsAgo),
))
.groupBy(sql`strftime('%Y-%m', ${transactions.date})`)
.orderBy(sql`strftime('%Y-%m', ${transactions.date})`)
.all();
```

Return `monthlyTrends: { collected: number[], credits: number[], free: number[] }` in the response.

**Option B** (simpler): Replace hardcoded data with the summary totals as single-point arrays wrapped in a loading state, using the existing `data.gstCollected` value:
```typescript
// Use real single-point data if trend not available
data={summary ? [summary.gstCollected / 100] : [0]}
```

Choose Option A if the server change is straightforward, Option B if you need to keep it simple.

---

## FIX 3 (MEDIUM): GST Export CSV button has no onClick handler

**File**: `client/src/features/gst/components/GSTSummary.tsx`
**Lines**: ~158

**Problem**: "Export CSV" button is rendered but has no onClick — clicking it does nothing.

**Current code**:
```typescript
<Button>Export CSV</Button>  // ← no onClick!
```

**Fix**: Wire it to the transactions export endpoint which already supports CSV:
```typescript
<Button onClick={handleExportCSV}>Export CSV</Button>
```

Add the handler function in the component:
```typescript
const handleExportCSV = () => {
  const params = new URLSearchParams();
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);
  params.set('format', 'csv');
  params.set('gstOnly', 'true');

  const { getAuthHeaders } = await import('../../../api/client');
  const headers = getAuthHeaders();

  window.open(`/api/transactions/export?${params.toString()}`, '_blank');
};
```

Or simpler — just link to the export endpoint:
```typescript
<a
  href={`/api/transactions/export?format=csv&startDate=${startDate}&endDate=${endDate}`}
  download="gst-transactions.csv"
>
  <Button>Export CSV</Button>
</a>
```

---

## FIX 4 (LOW): Silent error catches return [] instead of 500

**File 1**: `server/src/routes/bas/handlers.ts`
**Lines**: ~303-305 (the drill-down catch block)

**Current broken code**:
```typescript
} catch (error) {
  return c.json([]);  // ← hides the error!
}
```

**Fix**:
```typescript
} catch (error) {
  console.error('[BAS] drill-down error:', error);
  return c.json({ error: 'Failed to load BAS drill-down data' }, 500);
}
```

**File 2**: `server/src/routes/tax-ext/gst-handlers.ts`
**Lines**: ~137-139

Same fix:
```typescript
} catch (error) {
  console.error('[GST] input tax credits error:', error);
  return c.json({ error: 'Failed to load input tax credits' }, 500);
}
```

---

## VERIFICATION

```bash
cd server && npx tsc --noEmit
cd client && npx tsc --noEmit
```

Then commit:
```bash
git add server/src/routes/tax.ts
git add server/src/routes/bas/handlers.ts
git add server/src/routes/tax-ext/gst-handlers.ts
git add client/src/features/gst/components/GSTSummary.tsx
git add client/src/features/gst/components/GSTPage.tsx
git commit -m "fix(gst): summary response breakdown field, sparklines, export button, silent errors"
```
