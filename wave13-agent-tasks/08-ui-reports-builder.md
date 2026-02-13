# Agent 8: UI Reports Builder

## Role
Build 7 React components for the financial reports feature: dashboard, P&L, Balance Sheet, Cash Flow, Trial Balance, Period Comparison, and KPI Dashboard.

## Priority: WAVE 13 (After Agent 7 completes API routes)

## Wait Condition
Check for `.agent-done-W13-07` marker file before starting.

## Context
- UI library: shadcn/ui at `client/src/components/ui/` (Card, Tabs, Button, Input, Select, Badge, Table)
- Icons: lucide-react (FileText, TrendingUp, TrendingDown, BarChart3, PieChart, DollarSign, ArrowUpDown)
- Existing pattern: `client/src/features/tax/components/TaxDashboard.tsx` (imports, state, fetch, render)
- API layer: `client/src/api.ts` -- add new `reportsApi` object
- No `reports/` feature folder exists yet -- must create it

## Files to MODIFY

### 1. `client/src/api.ts`
- [ ] Add TypeScript interfaces for report types at top of file:
```typescript
export interface ProfitAndLossReport {
  periodStart: string; periodEnd: string;
  revenue: CategoryGroup[]; expenses: CategoryGroup[];
  grossRevenue: number; totalExpenses: number;
  netProfitOrLoss: number; grossMargin: number;
}
export interface CategoryGroup { category: string; amount: number; transactionCount: number; }
export interface BalanceSheetReport {
  asAtDate: string;
  totalAssets: number; totalLiabilities: number; totalEquity: number;
  isBalanced: boolean;
  assets: any; liabilities: any; equity: any;
}
export interface CashFlowReport {
  periodStart: string; periodEnd: string;
  operating: any; investing: any; financing: any;
  netCashChange: number; openingBalance: number; closingBalance: number;
}
export interface TrialBalanceReport {
  asAtDate: string; entries: any[];
  totalDebits: number; totalCredits: number;
  isBalanced: boolean; difference: number;
}
export interface KPIMetric {
  metricName: string; value: number; target: number | null;
  trend: 'up' | 'down' | 'stable'; previousValue: number | null;
}
```

- [ ] Add new `reportsApi` object (after existing api objects):
```typescript
export const reportsApi = {
  fetchPnL: (periodStart: string, periodEnd: string, accountId?: string) =>
    fetch(`${API_URL}/reports/pnl?userId=default&periodStart=${periodStart}&periodEnd=${periodEnd}${accountId ? `&accountId=${accountId}` : ''}`,
      { headers: getAuthHeaders() }).then(r => r.json()) as Promise<ProfitAndLossReport>,

  fetchBalanceSheet: (asAtDate: string) =>
    fetch(`${API_URL}/reports/balance-sheet?userId=default&asAtDate=${asAtDate}`,
      { headers: getAuthHeaders() }).then(r => r.json()) as Promise<BalanceSheetReport>,

  fetchCashFlow: (periodStart: string, periodEnd: string) =>
    fetch(`${API_URL}/reports/cash-flow?userId=default&periodStart=${periodStart}&periodEnd=${periodEnd}`,
      { headers: getAuthHeaders() }).then(r => r.json()) as Promise<CashFlowReport>,

  fetchTrialBalance: (asAtDate: string) =>
    fetch(`${API_URL}/reports/trial-balance?userId=default&asAtDate=${asAtDate}`,
      { headers: getAuthHeaders() }).then(r => r.json()) as Promise<TrialBalanceReport>,

  comparePeriods: (currentStart: string, currentEnd: string, priorStart: string, priorEnd: string, reportType: string) =>
    fetch(`${API_URL}/reports/compare?userId=default&currentStart=${currentStart}&currentEnd=${currentEnd}&priorStart=${priorStart}&priorEnd=${priorEnd}&reportType=${reportType}`,
      { headers: getAuthHeaders() }).then(r => r.json()),

  fetchKPIs: (period: string) =>
    fetch(`${API_URL}/reports/kpis?userId=default&period=${period}`,
      { headers: getAuthHeaders() }).then(r => r.json()),

  fetchKPIHistory: (metricName: string, periods: string[]) =>
    fetch(`${API_URL}/kpis/default/history?metricName=${metricName}&periods=${periods.join(',')}`,
      { headers: getAuthHeaders() }).then(r => r.json()),
};
```

### 2. `client/src/App.tsx`
- [ ] Add import: `import { ReportsDashboard } from './features/reports/components/ReportsDashboard';`
- [ ] Add "Reports" tab to navigation (use FileText icon from lucide-react)
- [ ] Add route rendering `<ReportsDashboard />` when Reports tab is active

## Files to CREATE

### 3. `client/src/features/reports/components/ReportsDashboard.tsx`
**Purpose**: Tabbed dashboard containing all report types
- [ ] Tabs: P&L | Balance Sheet | Cash Flow | Trial Balance | Comparison | KPIs
- [ ] Shared date range picker (periodStart/periodEnd) at top
- [ ] Financial year selector dropdown (FY2024, FY2025, FY2026)
- [ ] Account filter dropdown (from accounts API)
- [ ] Render corresponding report component based on active tab

### 4. `client/src/features/reports/components/ProfitAndLoss.tsx`
**Purpose**: P&L statement with revenue/expense breakdown
- [ ] Fetch via `reportsApi.fetchPnL()`
- [ ] Revenue section: table with category, amount, transaction count, percent of total
- [ ] Expense section: same table structure
- [ ] Summary bar: Gross Revenue | Total Expenses | Net Profit/Loss | Gross Margin %
- [ ] Color coding: green for positive net profit, red for loss
- [ ] Neumorphic card layout with `neu-raised` class

### 5. `client/src/features/reports/components/BalanceSheet.tsx`
**Purpose**: Balance sheet with assets/liabilities/equity
- [ ] Fetch via `reportsApi.fetchBalanceSheet()`
- [ ] Three columns: Assets | Liabilities | Equity
- [ ] Each column lists items with amounts
- [ ] Footer row showing totals
- [ ] Balance check indicator: green checkmark if balanced, red warning if not
- [ ] `isBalanced` boolean controls the indicator

### 6. `client/src/features/reports/components/CashFlow.tsx`
**Purpose**: Cash flow statement with three sections
- [ ] Fetch via `reportsApi.fetchCashFlow()`
- [ ] Three sections: Operating | Investing | Financing
- [ ] Each section: list of inflows (green) and outflows (red) with net subtotal
- [ ] Summary: Opening Balance + Net Cash Change = Closing Balance
- [ ] Waterfall chart showing flow from opening to closing (using nested divs with Tailwind, no charting library required)

### 7. `client/src/features/reports/components/TrialBalance.tsx`
**Purpose**: Trial balance with debit/credit columns
- [ ] Fetch via `reportsApi.fetchTrialBalance()`
- [ ] Table: Account Name | Debit | Credit | Net Balance
- [ ] Footer: Total Debits | Total Credits | Difference
- [ ] Balance indicator same as BalanceSheet
- [ ] Sortable columns using TanStack Table if available, otherwise plain table

### 8. `client/src/features/reports/components/PeriodComparison.tsx`
**Purpose**: Side-by-side period comparison with variance highlighting
- [ ] Two date range pickers: Current Period and Prior Period
- [ ] Report type selector (P&L, Balance Sheet, Cash Flow)
- [ ] Fetch via `reportsApi.comparePeriods()`
- [ ] Table: Category | Current | Prior | Variance $ | Variance %
- [ ] Highlight rows with variance > 10% in amber, > 25% in red
- [ ] Top significant changes summary cards at top

### 9. `client/src/features/reports/components/KPIDashboard.tsx`
**Purpose**: KPI metrics with trend indicators
- [ ] Fetch via `reportsApi.fetchKPIs()`
- [ ] Grid of metric cards (2-3 per row)
- [ ] Each card: metric name, value, trend arrow (TrendingUp/TrendingDown/ArrowUpDown), previous value, target
- [ ] Color: green for improving trends, red for declining, neutral for stable
- [ ] Period selector to view historical KPIs

## Component Pattern (follow TaxDashboard.tsx):
```tsx
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { reportsApi } from '@/api';
import type { ProfitAndLossReport } from '@/api';

export function ProfitAndLoss({ periodStart, periodEnd, accountId }: Props) {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<ProfitAndLossReport | null>(null);

    useEffect(() => {
        if (!periodStart || !periodEnd) return;
        setLoading(true);
        reportsApi.fetchPnL(periodStart, periodEnd, accountId)
            .then(setData)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [periodStart, periodEnd, accountId]);
    // ... render cards
}
```

## Verification
- [ ] `cd client && npx tsc --noEmit` passes clean
- [ ] All 7 components render without errors
- [ ] Navigation to Reports tab works
- [ ] Tab switching loads correct report type
- [ ] Neumorphic styling matches existing components (dark theme, gold accents)
- [ ] Create marker file: `.agent-done-W13-08`

## Dependencies
- **Requires**: Agent 7 (`.agent-done-W13-07`) -- API routes must exist
- **IMPORTANT**: Only this agent creates files in `client/src/features/reports/`
- **Coordinate with**: Agent 9 on client/src/App.tsx modifications (both may add navigation tabs)
