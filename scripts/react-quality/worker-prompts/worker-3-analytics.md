# Worker 3 — Analytics + Accounts + Budgets + Reconciliation

You are worker-3-analytics on the react-quality agent team.

## YOUR FILE OWNERSHIP (never touch files outside these paths)
```
client/src/features/analytics/
client/src/features/accounts/
client/src/features/budgets/
client/src/features/reconciliation/
```

## STEP 1 — Read your instructions
Read these files before touching any code:
- `scripts/react-quality/rules-reference.md` — all fix patterns with code examples
- `scripts/react-quality/react-doctor-full-report.txt` — grep for your file paths to find exact line numbers

## STEP 2 — Run react-doctor on your directories
```bash
cd "C:/Users/Danie/Desktop/CBA Statements Parse/client"
npx -y react-doctor@latest src/features/analytics/ src/features/accounts/ src/features/budgets/ src/features/reconciliation/ --verbose 2>&1
```

## STEP 3 — Fix each file, applying ALL applicable rules

Work file-by-file. After every 5 files: `npx tsc --noEmit` → must be 0 errors.

### High-priority files in your domain:
**analytics/**
- `CategoryBreakdown.tsx` — array key (2×), excessive useState
- `CashFlowForecast.tsx` — array key (4×), excessive useState, large component
- `SpendingTrends.tsx` — array key (3×), excessive useState
- `MoneyFlowSankey.tsx` — array key (2×), form labels (2×), excessive useState, recharts lazy-load
- `WealthProjection.tsx` — array key, excessive useState, multiple setState
- `DebtReductionPlanner.tsx` — form label, inline render functions (3×), array key (2×), excessive useState
- `AnomalyDetection.tsx` — excessive useState
- `BudgetVsActual.tsx` — form label, autoFocus, excessive useState, multiple setState
- `BudgetProjections.tsx` — multiple setState in useEffect
- `BillAlerts.tsx` — multiple setState in useEffect
- `MonthlyTrendChart.tsx` — array key
- `ForecastDashboard.tsx` — excessive useState
- `CategoryChart.tsx` — array key
- `MarketDashboard.tsx` — recharts lazy-load
- `InventoryValuation/InventoryValuation.tsx` — recharts lazy-load, excessive useState
**accounts/**
- `AccountManager.tsx` — form labels (3×), array key, excessive useState
- `AccountsOverview.tsx` — keyboard handler, role, array key
- `AccountSwitcher.tsx` — keyboard handler, role
- `AccountHoverCard.tsx` — array key
- `AccountSummaryCards.tsx` — array key
- `AccountSetupWizard.tsx` — form labels (5×), excessive useState
- `AccountBalanceTimeline/AccountBalanceTimeline.tsx` — array key (2×), excessive useState
**budgets/**
- `BudgetsDashboard.tsx` — form labels (4×), array key, excessive useState, multiple setState
- `ForecastScenarios.tsx` — form labels (7×), keyboard handler, role, array key (2×), excessive useState
- `BudgetEditor.tsx` — autoFocus, excessive useState
- `VarianceView.tsx` — array key (3×)
- `ScenarioComparison.tsx` — array key (3×)
**reconciliation/**
- `ReconDashboard.tsx` — excessive useState
- `ReconMatchingWorkspace.tsx` — excessive useState
- `ReconRulesManager.tsx` — excessive useState
- `ReconMatchSuggestions.tsx` — array key

## STEP 4 — Final check
```bash
cd "C:/Users/Danie/Desktop/CBA Statements Parse/client"
npx tsc --noEmit
npx -y react-doctor@latest src/features/analytics/ src/features/accounts/ src/features/budgets/ src/features/reconciliation/ --verbose 2>&1 | tail -20
```

## STEP 5 — Commit
```bash
cd "C:/Users/Danie/Desktop/CBA Statements Parse"
git add client/src/features/analytics/ client/src/features/accounts/ client/src/features/budgets/ client/src/features/reconciliation/
git commit -m "fix(react-quality): worker-3 analytics/accounts/budgets/recon — all warnings resolved"
```

## STEP 6 — Report done
Send message to lead: `DONE: worker-3-analytics — [N] files fixed, TSC clean`
Then mark your task as completed using TaskUpdate.
