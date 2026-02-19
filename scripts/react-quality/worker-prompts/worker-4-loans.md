# Worker 4 — Loans + Banking Products + Transfers + Market + Forecasting

You are worker-4-loans on the react-quality agent team.

## YOUR FILE OWNERSHIP (never touch files outside these paths)
```
client/src/features/loans/
client/src/features/banking-products/
client/src/features/transfers/
client/src/features/market/
client/src/features/forecasting/
```

## STEP 1 — Read your instructions
Read these files before touching any code:
- `scripts/react-quality/rules-reference.md` — all fix patterns with code examples
- `scripts/react-quality/react-doctor-full-report.txt` — grep for your file paths to find exact line numbers

## STEP 2 — Run react-doctor on your directories
```bash
cd "C:/Users/Danie/Desktop/CBA Statements Parse/client"
npx -y react-doctor@latest src/features/loans/ src/features/banking-products/ src/features/transfers/ src/features/market/ src/features/forecasting/ --verbose 2>&1
```

## STEP 3 — Fix each file, applying ALL applicable rules

Work file-by-file. After every 5 files: `npx tsc --noEmit` → must be 0 errors.

### High-priority files in your domain:
**loans/**
- `LoanDashboard.tsx` — (fetch-in-useEffect already fixed) check for remaining issues
- `LoanComparisonPanel.tsx` — form labels (6×), excessive useState (2 components), array key
- `RateScenarios.tsx` — form labels (3×)... wait actually already in another worker? No, this is loans — your file
- `RefinanceAnalysis.tsx` — array key (2×), large component
- `BorrowingCapacity.tsx` — array key, excessive useState
- `HomeLoanCalculator.tsx` — excessive useState
- `PersonalLoanCalculator.tsx` — excessive useState
- `CarFinanceCalculator.tsx` — excessive useState
- `RateScenarios.tsx` — array key (2×)
**banking-products/**
- `LoanComparison.tsx` — form labels (6×), excessive useState
- `RateAlertManager.tsx` — form labels (3×), excessive useState, multiple setState
- `ProductExplorer.tsx` — form labels (3×), array key, excessive useState
- `SavingsCalculator.tsx` — form labels (4×), excessive useState
- `RateTracker.tsx` — array key (2×), multiple setState in useEffect
- `BestRates.tsx` — inline render functions (2×), array key, excessive useState, multiple setState
- `ProductComparison.tsx` — multiple setState in useEffect
**transfers/**
- `TransferConfirmation.tsx` — array key (2×)
- `MoneyFlowDiagram.tsx` — array key (2×)
- `NetPositionCalculator.tsx` — form labels (4×), excessive useState
**market/**
- `RateDecisionTracker.tsx` — form labels (3×), array key, excessive useState, recharts lazy-load
- `PriceTracker.tsx` — array key, excessive useState, recharts lazy-load
- `SentimentDashboard.tsx` — array key, excessive useState
- `EconomicCalendar.tsx` — array key, excessive useState
- `EconomicIndicators.tsx` — excessive useState, recharts lazy-load
- `MarketBriefing.tsx` — form labels (2×), array key, excessive useState
- `MarketAlerts.tsx` — form labels (4×), excessive useState
- `MarketDashboard.tsx` — excessive useState
**forecasting/**
- `ForecastDashboard.tsx` — form labels (3×), excessive useState
- `ScenarioComparer.tsx` — form label, array key (3×), recharts lazy-load
- `AccuracyPanel.tsx` — array key, useEffect→event handler

### recharts lazy-load pattern for this domain:
Files with direct recharts imports: RateDecisionTracker, PriceTracker, EconomicIndicators, ScenarioComparer.

For each, extract the recharts JSX into a sibling `*Chart.tsx` file and lazy-load it:
```tsx
// RateDecisionTrackerChart.tsx (new file with recharts code)
import { LineChart, ... } from 'recharts';
export function RateDecisionTrackerChart(props) { ... }

// RateDecisionTracker.tsx (updated)
const RateDecisionTrackerChart = lazy(() => import('./RateDecisionTrackerChart'));
// Wrap usage: <Suspense fallback={<ChartSkeleton />}><RateDecisionTrackerChart /></Suspense>
```

## STEP 4 — Final check
```bash
cd "C:/Users/Danie/Desktop/CBA Statements Parse/client"
npx tsc --noEmit
npx -y react-doctor@latest src/features/loans/ src/features/banking-products/ src/features/transfers/ src/features/market/ src/features/forecasting/ --verbose 2>&1 | tail -20
```

## STEP 5 — Commit
```bash
cd "C:/Users/Danie/Desktop/CBA Statements Parse"
git add client/src/features/loans/ client/src/features/banking-products/ client/src/features/transfers/ client/src/features/market/ client/src/features/forecasting/
git commit -m "fix(react-quality): worker-4 loans/banking/market — all warnings resolved"
```

## STEP 6 — Report done
Send message to lead: `DONE: worker-4-loans — [N] files fixed, TSC clean`
Then mark your task as completed using TaskUpdate.
