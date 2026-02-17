/**
 * Financial Reports Module — Type Definitions
 */

export interface ProfitAndLossReport {
  periodStart: string;
  periodEnd: string;
  revenue: CategoryGroup[];
  expenses: CategoryGroup[];
  costOfGoodsSold: CategoryGroup[];
  grossRevenue: number;
  totalCOGS: number;
  grossProfit: number;
  totalExpenses: number;
  netProfitOrLoss: number;
  grossMargin: number;
  transactionCount: number;
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

export interface BalanceSheetSection {
  items: Array<{ name: string; amount: number }>;
  total: number;
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

export interface CashFlowSection {
  items: Array<{ category: string; amount: number }>;
  total: number;
}

export interface TrialBalanceReport {
  asAtDate: string;
  entries: TrialBalanceEntry[];
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
  difference: number;
}

export interface TrialBalanceEntry {
  accountCode: string;
  accountName: string;
  accountType: string;
  debit: number;
  credit: number;
  netBalance: number;
}

export type ReportData = ProfitAndLossReport | BalanceSheetReport | CashFlowReport | TrialBalanceReport;

export interface PeriodComparison {
  reportType: string;
  currentPeriod: { start: string; end: string; data: ReportData };
  priorPeriod: { start: string; end: string; data: ReportData };
  variances: CategoryVariance[];
  significantChanges: CategoryVariance[];
}

export interface CategoryVariance {
  category: string;
  currentAmount: number;
  priorAmount: number;
  varianceAmount: number;
  variancePercent: number;
  direction: 'increase' | 'decrease' | 'unchanged';
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
