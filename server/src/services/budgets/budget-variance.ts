/**
 * Budget Variance Calculation — self-contained implementation.
 */
import { db, budgets, budgetLines, budgetVsActual, transactions } from '../../schema.js';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import crypto from 'crypto';
import type { VarianceSummary } from './types.js';
import { getPeriodDateRange } from './utils.js';

export type { VarianceSummary } from './types.js';

export async function calculateVariance(budgetId: string) {
  const budget = await db.select().from(budgets).where(eq(budgets.id, budgetId)).get();
  if (!budget) throw new Error(`Budget not found: ${budgetId}`);

  const lines = await db.select().from(budgetLines).where(eq(budgetLines.budgetId, budgetId)).all();

  type VarianceResult = Record<string, unknown> & {
    budgetLine: { category: string; budgetedAmount: number };
    actualAmount: number;
  };
  const results: VarianceResult[] = [];

  for (const line of lines) {
    // Determine date range for this budget line's period
    const { startDate, endDate } = getPeriodDateRange(line.period);

    // Query actual transactions matching category + period
    const actualResult = await db
      .select({
        totalAmount: sql<number>`COALESCE(SUM(ABS(${transactions.amount})), 0)`,
        txCount: sql<number>`COUNT(*)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, budget.userId),
          eq(transactions.category, line.category),
          gte(transactions.date, startDate),
          lte(transactions.date, endDate),
        ),
      )
      .get();

    const actualAmount = Number(actualResult?.totalAmount ?? 0);
    const varianceAmount = actualAmount - line.budgetedAmount;
    const variancePercent =
      line.budgetedAmount !== 0 ? (varianceAmount / Math.abs(line.budgetedAmount)) * 100 : 0;

    const now = new Date().toISOString();

    // Check for existing budget_vs_actual row for this line
    const existing = await db
      .select()
      .from(budgetVsActual)
      .where(eq(budgetVsActual.budgetLineId, line.id))
      .get();

    const record = {
      actualAmount,
      varianceAmount,
      variancePercent,
      transactionCount: Number(actualResult?.txCount ?? 0),
      lastCalculated: now,
    };

    if (existing) {
      await db.update(budgetVsActual).set(record).where(eq(budgetVsActual.id, existing.id));
      results.push({ ...existing, ...record, budgetLine: line } as VarianceResult);
    } else {
      const newRecord = {
        id: crypto.randomUUID(),
        budgetLineId: line.id,
        ...record,
      };
      await db.insert(budgetVsActual).values(newRecord);
      results.push({ ...newRecord, budgetLine: line } as VarianceResult);
    }
  }

  return results;
}

export async function getVarianceSummary(budgetId: string): Promise<VarianceSummary> {
  // Ensure variance is calculated
  const varianceRows = await calculateVariance(budgetId);

  let totalBudgeted = 0;
  let totalActual = 0;
  const categoryVariances: Array<{
    category: string;
    budgeted: number;
    actual: number;
    variance: number;
    percent: number;
  }> = [];

  // Aggregate by category
  const categoryMap = new Map<string, { budgeted: number; actual: number }>();

  for (const row of varianceRows) {
    const cat = row.budgetLine.category;
    const existing = categoryMap.get(cat) ?? { budgeted: 0, actual: 0 };
    categoryMap.set(cat, {
      budgeted: existing.budgeted + row.budgetLine.budgetedAmount,
      actual: existing.actual + row.actualAmount,
    });
  }

  for (const [category, data] of categoryMap) {
    const variance = data.actual - data.budgeted;
    const percent = data.budgeted !== 0 ? (variance / Math.abs(data.budgeted)) * 100 : 0;
    totalBudgeted += data.budgeted;
    totalActual += data.actual;
    categoryVariances.push({
      category,
      budgeted: data.budgeted,
      actual: data.actual,
      variance,
      percent,
    });
  }

  const totalVariance = totalActual - totalBudgeted;

  // Classify categories
  const overBudgetCategories = categoryVariances
    .filter((c) => c.variance > 0)
    .map((c) => ({ category: c.category, variance: c.variance, percent: c.percent }))
    .sort((a, b) => b.variance - a.variance);

  const underBudgetCategories = categoryVariances
    .filter((c) => c.variance < 0)
    .map((c) => ({ category: c.category, variance: c.variance, percent: c.percent }))
    .sort((a, b) => a.variance - b.variance);

  // Top 5 largest absolute variances
  const topVariances = [...categoryVariances]
    .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
    .slice(0, 5)
    .map((c) => ({
      category: c.category,
      budgeted: c.budgeted,
      actual: c.actual,
      variance: c.variance,
    }));

  // Health: on_track if |totalVariance| < 10% of totalBudgeted
  let health: 'on_track' | 'over_budget' | 'under_budget';
  if (totalBudgeted === 0) {
    health = 'on_track';
  } else if (Math.abs(totalVariance) < Math.abs(totalBudgeted) * 0.1) {
    health = 'on_track';
  } else if (totalActual > totalBudgeted) {
    health = 'over_budget';
  } else {
    health = 'under_budget';
  }

  return {
    totalBudgeted,
    totalActual,
    totalVariance,
    overBudgetCategories,
    underBudgetCategories,
    topVariances,
    health,
  };
}
