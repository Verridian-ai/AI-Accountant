import type { Transaction } from '../../../../api/index.js';

export interface SankeyNode {
  name: string;
}

export interface SankeyLink {
  source: number;
  target: number;
  value: number;
}

export interface FlowSummary {
  totalIncome: number;
  totalExpenses: number;
  netCashFlow: number;
  largestIncomeSource: { name: string; amount: number };
  largestExpenseCategory: { name: string; amount: number };
  savingsRate: number;
  /** Monthly income values for the past 6 months (for sparklines) */
  monthlyIncome: number[];
  /** Monthly expense values for the past 6 months (for sparklines) */
  monthlyExpenses: number[];
  /** Monthly net cash flow for the past 6 months (for sparklines) */
  monthlyCashFlow: number[];
}

export interface MoneyFlowData {
  nodes: SankeyNode[];
  links: SankeyLink[];
  summary: FlowSummary;
  transactions: Transaction[];
  loading: boolean;
  error: string | null;
}
