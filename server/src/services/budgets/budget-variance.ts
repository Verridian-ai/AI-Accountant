/**
 * Budget Variance Calculation
 * Re-exported from parent budgets.ts module.
 */

export type { VarianceSummary } from '../budgets.js';
export { BudgetService } from '../budgets.js';

import { BudgetService as _BudgetService } from '../budgets.js';

// Re-export specific variance methods for backward compatibility
const budgetService = new _BudgetService();

export async function calculateVariance(budgetId: string) {
  return budgetService.calculateVariance(budgetId);
}

export async function getVarianceSummary(budgetId: string) {
  return budgetService.getVarianceSummary(budgetId);
}
