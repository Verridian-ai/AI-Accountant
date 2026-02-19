# Worker 1 — Transactions + AP + Matching

You are worker-1-transactions on the react-quality agent team.

## YOUR FILE OWNERSHIP (never touch files outside these paths)
```
client/src/features/transactions/
client/src/features/ap/
client/src/features/matching/
```

## STEP 1 — Read your instructions
Read these files before touching any code:
- `scripts/react-quality/rules-reference.md` — all fix patterns with code examples
- `scripts/react-quality/react-doctor-full-report.txt` — grep for your file paths to find exact line numbers

## STEP 2 — Run react-doctor on your directories
```bash
cd "C:/Users/Danie/Desktop/CBA Statements Parse/client"
npx -y react-doctor@latest src/features/transactions/ src/features/ap/ src/features/matching/ --verbose 2>&1
```
Note all warnings with file:line references.

## STEP 3 — Fix each file, applying ALL applicable rules

Work file-by-file. For each file:
1. Read the file
2. Apply all relevant rules from rules-reference.md
3. Save the edit
4. After every 5 files: `cd "C:/Users/Danie/Desktop/CBA Statements Parse/client" && npx tsc --noEmit` → must be 0 errors

### High-priority files in your domain:
- `TransactionTable/TransactionTable.tsx` — form labels (7×), array index keys, excessive useState, large component
- `TransactionTable/columns/transactionColumns.tsx` — keyboard handler, role, array key
- `CategorySelect.tsx` — combobox aria-controls, keyboard handlers, role
- `SplitTransactionModal.tsx` — form label, keyboard handler, role, component size
- `SplitModal.tsx` (nested) — form labels (3×), array key
- `PendingCategorizationReview.tsx` — excessive useState, keyboard handler, form label, array key
- `LedgerFilters.tsx` — form labels (6×), default prop []
- `LedgerTableColumns/LedgerTableColumns.tsx` — keyboard handler, role
- `AuditTrailViewer.tsx` — form labels (4×), excessive useState
- `MerchantMemoryManager.tsx` — excessive useState, useEffect→event handler, array key (2×)
- `AdminTransactionsView.tsx` — array index key, stale closure setState
- `BillEntry.tsx` — form labels (6×), array key, excessive useState, multiple setState
- `BillApproval.tsx` — form labels (2×), array key (2×), multiple setState
- `POReceiving.tsx` — form label, array key, excessive useState
- `PurchaseOrderEditor.tsx` — form labels (4×), useEffect→event handler
- `SupplierPaymentRun.tsx` — form labels (3×)
- `AutoMatchView.tsx` — excessive useState, form labels (2×), keyboard handler, array key
- `MatchReviewPanel.tsx` — excessive useState, multiple setState in useEffect, array key
- `RuleManager.tsx` — form labels (10×), array key, excessive useState
- `MatchStatistics.tsx` — array key (2×)
- `LoadingSkeleton.tsx` — array key (2×)
- `LedgerSkeleton.tsx` — array key (2×)
- `LedgerFooter.tsx` — array key
- `InvoiceList.tsx` (invoicing, NOT your domain — skip)

## STEP 4 — Final check on your directories
```bash
cd "C:/Users/Danie/Desktop/CBA Statements Parse/client"
npx tsc --noEmit
npx -y react-doctor@latest src/features/transactions/ src/features/ap/ src/features/matching/ --verbose 2>&1 | tail -20
```
Target: 0 TSC errors. React-doctor warnings in your directories: < 5.

## STEP 5 — Commit
```bash
cd "C:/Users/Danie/Desktop/CBA Statements Parse"
git add client/src/features/transactions/ client/src/features/ap/ client/src/features/matching/
git commit -m "fix(react-quality): worker-1 transactions/ap/matching — all warnings resolved"
```

## STEP 6 — Report done
Send message to lead: `DONE: worker-1-transactions — [N] files fixed, TSC clean`
Then mark your task as completed using TaskUpdate.
