/**
 * Budget types — defined locally (no circular dependency on parent monolith).
 */

export interface CreateBudgetParams {
  name: string;
  budgetType: 'annual' | 'quarterly' | 'monthly' | 'project';
  periodStart: string;
  periodEnd: string;
  accountId?: string;
  autoGenerate?: boolean;
  lookbackMonths?: number;
}

export interface CreateBudgetLineParams {
  category: string;
  subcategory?: string;
  period: string;
  budgetedAmount: number;
  notes?: string;
}

export interface VarianceSummary {
  totalBudgeted: number;
  totalActual: number;
  totalVariance: number;
  overBudgetCategories: Array<{ category: string; variance: number; percent: number }>;
  underBudgetCategories: Array<{ category: string; variance: number; percent: number }>;
  topVariances: Array<{ category: string; budgeted: number; actual: number; variance: number }>;
  health: 'on_track' | 'over_budget' | 'under_budget';
}
