export interface CategoryGroup {
  category: string;
  amount: number;
  transactionCount: number;
  subcategories?: CategoryGroup[];
}

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

export interface ConsolidatedReport {
  period: string;
  startDate: string;
  endDate: string;
  summary: {
    totalIncome: number;
    totalExpenses: number;
    netFlow: number;
    transactionCount: number;
    transferCount: number;
  };
  gst: {
    gstTransactionCount: number;
    totalGSTCollected: number;
    totalGSTPaid: number;
    estimatedGSTPayable: number;
  };
  categories: Array<{
    category: string;
    income: number;
    expenses: number;
    count: number;
    net: number;
  }>;
}

export interface SupportedBank {
  bankId: string;
  bankName: string;
  displayName: string;
}

