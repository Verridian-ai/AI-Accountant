/**
 * Budget generation from historical data — delegates to parent BudgetService.
 */
import { BudgetService } from '../budgets.js';

const _svc = new BudgetService();

/**
 * Generate budget lines from historical transaction data.
 * Looks back `lookbackMonths` months and produces category averages.
 */
export async function generateFromHistory(
  userId: string,
  periodStart: string,
  periodEnd: string,
  lookbackMonths: number,
  budgetId?: string,
) {
  // Delegate to the BudgetService instance method
  return _svc.generateFromHistory(userId, periodStart, periodEnd, lookbackMonths, budgetId);
}
