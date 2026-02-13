# Agent 8: UI Components Builder

## Role
Build all new React frontend components for tax returns, loan calculators, and enhanced analytics.

## Priority: WAVE 4 (After Agent 7 completes API routes)

## Wait Condition
Check for `.agent-done-07` marker file before starting.

## Context
- UI library: shadcn/ui at `client/src/components/ui/` (Card, Tabs, Button, Input, Select, Badge, Switch, Progress)
- Icons: lucide-react (Calculator, Building2, TrendingUp, Receipt, PiggyBank, etc.)
- Existing pattern: `client/src/features/tax/components/TaxDashboard.tsx` (line 1-12 for imports)
- API layer: `client/src/api.ts` — taxApi (line 913), analyticsApi (line 1196)
- No `loans/` feature folder exists yet — must create it

## Files to MODIFY

### 1. `client/src/api.ts`

- [ ] Add 10 new methods to `taxApi` object (line 913): fetchSoleTraderReturn, fetchPersonalReturn, fetchCompanyReturn, fetchTrustReturn, generateStrategies, fetchStrategies, updateStrategyStatus, scanEquity, fetchEquitySummary, confirmEquityEvent
- [ ] Add new `loanApi` object (after analyticsApi) with 5 methods: calculateHomeLoan, calculateCarFinance, calculatePersonalLoan, calculateRefinanceSavings, calculateBorrowingCapacity
- [ ] Add new `economicApi` object with 3 methods: fetchRates, fetchCPI, fetchIndicators
- [ ] Add 6 new methods to `analyticsApi` object (line 1196): generateBudget, fetchBillAlerts, projectRevenue, projectExpenses, calculateWealthProjection, compareDebtStrategies
- [ ] Add TypeScript interfaces for all return types at top of file (SoleTraderReturn, PersonalReturn, CompanyReturn, TrustReturn, TaxStrategy, EquityEvent, EquitySummary, HomeLoanResult, CarFinanceComparison, etc.)

### 2. `client/src/features/tax/components/TaxDashboard.tsx`
**Reference**: `docs/Curretn Claudecode plan.md` lines 650-718

- [ ] Restructure with entity tabs (Sole Trader | Personal | Company | Trust), cross-cutting tabs (Tax Optimizer | Deductions | Capital Gains | Depreciation), FY year selector, and import/render new components

### 3. `client/src/App.tsx` + `client/src/features/analytics/components/`

- [ ] Add "Loans" nav tab + route to App.tsx; Add "Projections" and "Bill Alerts" tabs to AnalyticsDashboard.tsx
- [ ] Enhance BudgetVsActual.tsx (prior period column, entity filter, spending hints) and SpendingTrends.tsx (AI hints panel, entity filtering)

## Files to CREATE

- [ ] Create 7 tax components in `client/src/features/tax/components/`: SoleTraderReturn.tsx (P&L, equity, tax calc), PersonalReturn.tsx (income, deductions, PAYG, refund), CompanyReturn.tsx (revenue, base rate, franking), TrustReturn.tsx (distributions, Section 100A), TaxOptimizerPanel.tsx (strategy cards), OwnerEquityPanel.tsx (contributions, confirm/reject), TaxReturnSummaryCard.tsx (reusable stat card)

- [ ] Create `client/src/features/loans/` directory with 5 components: LoanDashboard.tsx (tabbed: Home | Car | Personal | Compare), HomeLoanCalculator.tsx (inputs, amortization chart, offset), CarFinanceCalculator.tsx (3-way comparison), PersonalLoanCalculator.tsx (comparison rate, early repayment), LoanComparisonPanel.tsx (side-by-side scenarios)

- [ ] Create 3 analytics components in `client/src/features/analytics/components/`: BudgetProjections.tsx (revenue/expense charts, confidence bands), BillAlerts.tsx (upcoming, overdue, amount changes), WealthProjection.tsx (compound growth, 4 risk profiles, timeline)

## Component Pattern (follow TaxDashboard.tsx):
```tsx
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { taxApi } from '@/api';

export function SoleTraderReturn({ year }: { year: string }) {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<SoleTraderReturnData | null>(null);
    // ... fetch on mount, render cards
}
```

## Verification
- [ ] `cd client && npx tsc --noEmit` passes clean
- [ ] All new components render without errors
- [ ] Navigation to /loans works
- [ ] Entity tabs in TaxDashboard switch correctly
- [ ] Create marker file: `.agent-done-08`

## Dependencies
- **Requires**: Agent 7 (`.agent-done-07`) — API routes must exist for type-safe client
- **IMPORTANT**: Only this agent modifies client/src/api.ts and client/src/App.tsx
