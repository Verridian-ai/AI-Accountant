# Agent 2: Reporting Engine Builder

## Role
Build the core financial reporting engine service with P&L, Balance Sheet, Cash Flow, Trial Balance generation, period comparison, snapshot persistence, and KPI calculation.

## Priority: WAVE 13 (After Agent 1 completes schema)

## Wait Condition
Check for `.agent-done-W13-01` marker file before starting.

## Files to CREATE

### 1. `server/src/services/financial-reports.ts`
**Purpose**: Core reporting engine generating standard financial statements from transaction data
**Pattern**: Follow `server/src/services/bas.ts` (service class with Drizzle queries, returns typed objects)

- [ ] Create `FinancialReportService` class with the following methods:

#### `generateProfitAndLoss(userId: string, periodStart: string, periodEnd: string, accountId?: string): Promise<ProfitAndLossReport>`
  - Query transactions within date range, grouped by category
  - Revenue categories (from `categories.ts`): Salary/Wages, Business Revenue, Investment Income, Government Payments, Other Income
  - Expense categories: all remaining non-transfer categories
  - Calculate: `grossRevenue`, `totalExpenses`, `netProfitOrLoss`, `grossMargin`
  - Group expenses by category with subtotals
  - Include transaction count per category
  - Support optional `accountId` filter for per-account P&L

#### `generateBalanceSheet(userId: string, asAtDate: string): Promise<BalanceSheetReport>`
  - Assets: sum of positive account balances (from `accounts` table `currentBalance`)
  - Liabilities: sum of negative account balances (credit cards, loans)
  - Equity: Assets - Liabilities
  - Include `ownerEquityEvents` from schema (drawings, contributions)
  - Must satisfy: Assets = Liabilities + Equity (balance equation check)
  - Return `isBalanced: boolean` flag

#### `generateCashFlow(userId: string, periodStart: string, periodEnd: string): Promise<CashFlowReport>`
  - Operating: categorized transactions (revenue inflows - expense outflows)
  - Investing: asset purchases, investment transactions (filter by category)
  - Financing: loan repayments, owner contributions/drawings, credit card payments
  - Calculate: `netCashFromOperations`, `netCashFromInvesting`, `netCashFromFinancing`, `netCashChange`
  - Opening balance from first day, closing balance from last day

#### `generateTrialBalance(userId: string, asAtDate: string): Promise<TrialBalanceReport>`
  - List all chart of accounts entries (from `chartOfAccounts` table in schema.ts line 674)
  - For each account: sum debits, sum credits, net balance
  - Total debits must equal total credits
  - Return `isBalanced: boolean` flag and `difference: number`

#### `comparePeriods(userId: string, currentStart: string, currentEnd: string, priorStart: string, priorEnd: string, reportType: string): Promise<PeriodComparison>`
  - Generate same report type for both periods
  - Calculate variance: `amount`, `percent`, `direction` ('increase'|'decrease'|'unchanged')
  - Per-category comparison with highlights for significant changes (>10% variance)
  - Return `significantChanges: Array<{ category, currentAmount, priorAmount, variancePercent }>`

#### `createSnapshot(templateId: string, reportData: any): Promise<string>`
  - Persist report to `report_snapshots` table
  - Store full JSON payload in `data` column
  - Return snapshot ID

#### `getKPIs(userId: string, period: string): Promise<KPIMetrics>`
  - Calculate and upsert into `kpi_metrics` table:
    - `gross_margin`: (revenue - COGS) / revenue * 100
    - `net_margin`: net profit / revenue * 100
    - `current_ratio`: current assets / current liabilities
    - `expense_ratio`: total expenses / total revenue * 100
    - `revenue_growth`: (current revenue - prior revenue) / prior revenue * 100
    - `operating_cash_flow`: net cash from operations
    - `savings_rate`: (income - expenses) / income * 100
  - Compare to previous period for `trend_direction` and `previous_value`
  - Return array of `{ metricName, value, target, trend, previousValue }`

### 2. Type definitions at top of file:
```typescript
export interface ProfitAndLossReport {
  periodStart: string;
  periodEnd: string;
  revenue: CategoryGroup[];
  expenses: CategoryGroup[];
  grossRevenue: number;
  totalExpenses: number;
  netProfitOrLoss: number;
  grossMargin: number;
}

export interface CategoryGroup {
  category: string;
  amount: number;
  transactionCount: number;
  subcategories?: CategoryGroup[];
}

export interface BalanceSheetReport {
  asAtDate: string;
  assets: BalanceSheetSection;
  liabilities: BalanceSheetSection;
  equity: BalanceSheetSection;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  isBalanced: boolean;
}

export interface CashFlowReport {
  periodStart: string;
  periodEnd: string;
  operating: CashFlowSection;
  investing: CashFlowSection;
  financing: CashFlowSection;
  netCashChange: number;
  openingBalance: number;
  closingBalance: number;
}

export interface TrialBalanceReport {
  asAtDate: string;
  entries: TrialBalanceEntry[];
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
  difference: number;
}

export interface PeriodComparison {
  reportType: string;
  currentPeriod: { start: string; end: string; data: any };
  priorPeriod: { start: string; end: string; data: any };
  variances: CategoryVariance[];
  significantChanges: CategoryVariance[];
}

export interface KPIMetrics {
  period: string;
  metrics: Array<{
    metricName: string;
    value: number;
    target: number | null;
    trend: 'up' | 'down' | 'stable';
    previousValue: number | null;
  }>;
}
```

## Files to MODIFY

### 3. `server/src/schema.ts`
- [ ] Verify the 8 new tables from Agent 1 are present and importable (read-only check, do NOT modify)

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `FinancialReportService` can be instantiated without errors
- [ ] P&L generation sums revenue and expenses correctly (revenue - expenses = net profit)
- [ ] Balance sheet satisfies: Assets = Liabilities + Equity
- [ ] Trial balance satisfies: Total Debits = Total Credits
- [ ] KPI calculation returns 7 metrics with trend directions
- [ ] Create marker file: `.agent-done-W13-02`

## Dependencies
- **Requires**: Agent 1 (`.agent-done-W13-01`) -- schema tables must exist
- **Reuses**: schema.ts (transactions, accounts, chartOfAccounts, ownerEquityEvents, reportSnapshots, kpiMetrics), categories.ts
