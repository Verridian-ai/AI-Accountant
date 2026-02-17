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
  budgetId: string,
) {
  // generateFromHistory is a private method on BudgetService.
  // Access it via bracket notation with unknown intermediate cast.
  const svc = _svc as unknown as Record<string, Function>;
  return svc.generateFromHistory(userId, periodStart, periodEnd, lookbackMonths, budgetId);
}
