/**
 * Enhanced Budget Service — Type Definitions
 */

export interface BudgetCategoryEntry {
  category: string;
  average: number; // cents per month
  median: number; // cents per month
  min: number; // cents per month
  max: number; // cents per month
  recommended: number; // cents per month (adjusted)
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface SmartBudget {
  entityType: string;
  monthsAnalyzed: number;
  totalMonthlyBudget: number; // cents
  categories: BudgetCategoryEntry[];
  generatedAt: string;
}

export interface RecurringBill {
  merchant: string;
  averageAmount: number; // cents
  lastAmount: number; // cents
  frequency: 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'annual';
  nextDueDate: string; // ISO date
  lastPaidDate: string; // ISO date
  status: 'current' | 'overdue' | 'amount_changed';
  amountChangePercent?: number;
  occurrenceCount: number;
}

export interface RevenueProjection {
  month: string; // YYYY-MM
  projected: number; // cents
  upperBound: number; // cents (+ 1 std dev)
  lowerBound: number; // cents (- 1 std dev)
}

export interface ProjectionResult {
  entityType: string;
  monthsProjected: number;
  projections: RevenueProjection[];
  averageMonthly: number; // cents
  growthRate: number; // monthly percentage
}

export interface WealthProjectionParams {
  currentSavings: number; // cents
  monthlyContribution: number; // cents
  inflationRate?: number; // decimal, default 0.03
}

export interface WealthProjectionResult {
  profiles: Array<{
    name: string;
    annualReturn: number; // decimal
    projections: Array<{
      years: number;
      nominalValue: number; // cents
      realValue: number; // cents (inflation-adjusted)
    }>;
  }>;
}

export interface DebtInfo {
  name: string;
  balance: number; // cents
  rate: number; // annual decimal
  minPayment: number; // cents per month
}

export interface DebtStrategyResult {
  avalanche: {
    totalInterest: number; // cents
    payoffMonths: number;
    order: string[];
  };
  snowball: {
    totalInterest: number; // cents
    payoffMonths: number;
    order: string[];
  };
  interestSaved: number; // cents (snowball - avalanche)
  recommendation: string;
}
