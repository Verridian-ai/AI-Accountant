# Agent-10: Pipeline, GST, Medicare, and Miscellaneous Fixes

**Your role**: Fix GST fields in agent-insertion.ts, batch routing, agent-insertion array mismatch, gap analysis stub, W2 estimation flag, Medicare constants deduplication, and vision verification field.
**Working directory**: `/mnt/c/Users/Danie/Desktop/CBA Statements Parse`
**After every file change**: Run `cd server && npx tsc --noEmit` — must stay at 0 errors.

---

## FIX 1 (HIGH): Agent insertion path missing GST fields

**File**: `server/src/services/pipeline/agent-insertion.ts`
**Lines**: ~36-57

**Problem**: When transactions go through the Claude agent path (`handleAgentPathInsertion`), the insert records are missing `gstAmount` and `gstCategory`. This means BAS calculations show $0 GST for these transactions.

**Current broken code** (agent path insert object lacks GST fields):
```typescript
const insertRecord = {
  id: generateId(),
  userId,
  accountId,
  date: tx.date,
  description: tx.description,
  amount: tx.amount,
  type: tx.type,
  category: tx.category,
  gstApplicable: tx.gstApplicable,
  // ← gstAmount and gstCategory are MISSING
};
```

**Fix**: Import and call the GST calculation functions (the same ones used in categorization.ts):

First, READ `server/src/services/pipeline/categorization.ts` to find where `inferGstCategory()` and `calculateGstAmount()` are imported/defined.

Then update agent-insertion.ts:
```typescript
// Add these imports at the top:
import { inferGstCategory, calculateGstAmount } from '../bas/gst-calculator.js';

// In the insert record construction:
const gstCategory = tx.gstCategory ?? inferGstCategory(tx.category, tx.description, userId);
const gstAmount = tx.gstAmount ?? (gstCategory !== 'NOT_APPLICABLE'
  ? calculateGstAmount(tx.amount, gstCategory)
  : 0);

const insertRecord = {
  id: generateId(),
  userId,
  accountId,
  date: tx.date,
  description: tx.description,
  amount: tx.amount,
  type: tx.type,
  category: tx.category,
  gstApplicable: tx.gstApplicable,
  gstCategory,    // ← ADD
  gstAmount,      // ← ADD
};
```

The exact function names may differ — READ categorization.ts to find the correct names before using them.

---

## FIX 2 (MEDIUM): Array index mismatch in agent-insertion pending categorization loop

**File**: `server/src/services/pipeline/agent-insertion.ts`
**Lines**: ~86-101

**Problem**: A loop indexes `categorizations[i]` and `toInsert[i]` in parallel, but if deduplication removed items from one array but not the other, the arrays have different lengths — causing mismatched categorizations (wrong categories applied to wrong transactions).

READ the file to find the exact loop. Look for something like:
```typescript
for (let i = 0; i < toInsert.length; i++) {
  const tx = toInsert[i];
  const cat = categorizations[i];  // ← if toInsert was deduped, i is now misaligned
```

**Fix**: Use a `Map` or zip the arrays BEFORE deduplication:
```typescript
// Build a Map from transaction hash → categorization BEFORE dedup
const catMap = new Map<string, typeof categorizations[0]>();
for (let i = 0; i < transactionsToInsert.length; i++) {
  catMap.set(transactionsToInsert[i].hash ?? i.toString(), categorizations[i]);
}

// Then after dedup:
for (const tx of toInsert) {
  const cat = catMap.get(tx.hash ?? '');
  // use cat for this specific tx
}
```

Or simpler — dedup AFTER zipping:
```typescript
// Zip first, then dedup the zipped pairs
const pairs = transactionsToInsert.map((tx, i) => ({ tx, cat: categorizations[i] }));
const uniquePairs = pairs.filter(pair => !existingHashes.has(pair.tx.hash));
for (const { tx, cat } of uniquePairs) {
  // use cat safely
}
```

---

## FIX 3 (HIGH): parseInt(statementId, 10) on UUID returns 0

**File**: `server/src/services/pipeline/ai-parsing.ts`
**Lines**: ~35-39

**Problem**: `parseInt(statementId, 10)` on a UUID string returns `NaN` which becomes `0`. This passes `0` as the statement ID to the orchestrator.

**Current code**:
```typescript
const numericId = parseInt(statementId, 10);  // ← UUIDs → NaN → 0
await orchestrator.process(numericId, filePath);
```

**Fix**: READ the orchestrator to understand what type it expects. If the orchestrator accepts strings, pass directly:
```typescript
await orchestrator.process(statementId, filePath);  // pass UUID string directly
```

If the orchestrator interface requires a number, READ the orchestrator file to understand why and refactor it to accept string IDs.

---

## FIX 4 (MEDIUM): Gap analysis is a stub

**File**: `server/src/services/statements/statement-service.ts`
**Lines**: ~67-74

**Problem**: `getGapAnalysis()` only returns `{ totalStatements: completedStmts.length }`. It doesn't analyze gaps.

**Current stub**:
```typescript
async getGapAnalysis(userId: string) {
  const completedStmts = ...; // query for completed statements
  return { totalStatements: completedStmts.length };  // ← just a count!
}
```

**Fix**: Implement real gap analysis:
```typescript
async getGapAnalysis(userId: string) {
  // Get all completed statements ordered by date
  const stmts = await db.select({
    id: statements.id,
    periodStart: statements.periodStart,
    periodEnd: statements.periodEnd,
    filename: statements.filename,
  })
  .from(statements)
  .where(and(
    eq(statements.userId, userId),
    eq(statements.parsingStatus, 'COMPLETED'),
    isNotNull(statements.periodStart),
    isNotNull(statements.periodEnd),
  ))
  .orderBy(asc(statements.periodStart))
  .all();

  // Find gaps between consecutive statement periods
  const gaps: Array<{ from: string; to: string; daysMissing: number }> = [];

  for (let i = 1; i < stmts.length; i++) {
    const prevEnd = new Date(stmts[i-1].periodEnd!);
    const currStart = new Date(stmts[i].periodStart!);
    const daysDiff = Math.floor((currStart.getTime() - prevEnd.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff > 1) {  // More than 1 day gap
      gaps.push({
        from: stmts[i-1].periodEnd!,
        to: stmts[i].periodStart!,
        daysMissing: daysDiff - 1,
      });
    }
  }

  return {
    totalStatements: stmts.length,
    gaps,
    coverageFromDate: stmts[0]?.periodStart ?? null,
    coverageToDate: stmts[stmts.length - 1]?.periodEnd ?? null,
    hasGaps: gaps.length > 0,
  };
}
```

You need to import `asc`, `isNotNull`, `and`, `eq` from drizzle-orm and `statements` from the schema.

---

## FIX 5 (MEDIUM): Vision verification stored in wrong field name

**File**: `server/src/services/pipeline/ai-parsing.ts`
**Lines**: ~152-153

**Problem**: Vision verification metadata is stored in `validationErrors` column — misleading name.

**Current code**:
```typescript
.set({ validationErrors: visionVerification })
```

**Fix**: Check the schema for `statements` table. If there's a more appropriate column (e.g., `verificationData`, `metadata`, `auditData`), use that instead. If `validationErrors` is the only available column, at minimum make the stored value clearly structured:
```typescript
.set({ validationErrors: JSON.stringify({
  type: 'vision_verification',
  data: visionVerification,
  timestamp: new Date().toISOString(),
}) })
```

Or add a migration to rename/add the column if appropriate (but don't add migrations without checking with the user first).

---

## FIX 6 (LOW): Medicare levy uses inline magic numbers instead of constants

**File**: `server/src/services/tax/gst-calculator.ts`
**Lines**: ~20-25

**Problem**: `calculateMedicareLevy()` uses hardcoded numbers (`30345`, `24276`) while `calculateMedicareLevyAmount()` uses exported constants `MEDICARE_LEVY_REDUCTION`. This creates dual maintenance risk.

READ the file to see both functions. Then refactor `calculateMedicareLevy()` to use the same constants:

```typescript
// Import or reference the constants from types.ts:
import { MEDICARE_LEVY_REDUCTION } from './types.js';

// Refactor calculateMedicareLevy() to use:
const { fullExemptionThreshold, shadeInUpperThreshold } = MEDICARE_LEVY_REDUCTION;
// instead of hardcoding 24276 and 30345
```

---

## FIX 7 (LOW): W2 estimation has no disclaimer flag in BASResult

**File**: `server/src/services/bas/bas-service.ts`
**Lines**: ~174-176

**Problem**: W2 is approximated at 32% of W1 but there's no flag in the response indicating this is an estimate.

**Current code**:
```typescript
labels.W2 = Math.round(labels.W1 * 0.32);
```

**Fix**: Find the `BASResult` type definition and add a `warnings` or `estimates` field:

```typescript
// In the BAS types file or bas-service.ts:
interface BASResult {
  labels: Record<string, number>;
  warnings?: string[];  // ← ADD
  // ...other fields
}

// Then in the service:
const result: BASResult = {
  labels,
  warnings: labels.W1 > 0
    ? ['W2 (PAYG Withheld) is estimated at 32% of wages. Review with your payroll records.']
    : [],
};
```

---

## VERIFICATION

After all changes:
```bash
cd server && npx tsc --noEmit
```

Commit:
```bash
git add server/src/services/pipeline/agent-insertion.ts
git add server/src/services/pipeline/ai-parsing.ts
git add server/src/services/statements/statement-service.ts
git add server/src/services/tax/gst-calculator.ts
git add server/src/services/bas/bas-service.ts
git commit -m "fix(pipeline): agent-insertion GST fields, array mismatch, gap analysis, W2 flag"
```
