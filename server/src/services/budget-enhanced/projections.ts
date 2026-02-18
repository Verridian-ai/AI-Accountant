/**
 * Enhanced Budget — Revenue/Expense Projections
 *
 * Linear regression-based projections for income and expenses.
 * Extracted from EnhancedBudgetService for file-size compliance.
 */

import { db, transactions, accounts } from '../../schema.js';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import type { RevenueProjection, ProjectionResult } from './types.js';
import { linearRegression, stdDev } from './helpers.js';

/**
 * Project a time series (income or expense) for a given number of months.
 */
export async function projectTimeSeries(
  userId: string,
  entityType: string,
  months: number,
  type: 'income' | 'expense',
): Promise<ProjectionResult> {
  const lookbackMonths = 12;
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - lookbackMonths);

  const amountFilter =
    type === 'income' ? sql`${transactions.amount} > 0` : sql`${transactions.amount} < 0`;

  const ownershipFilter =
    entityType === 'personal'
      ? sql`(${accounts.ownershipTag} IS NULL OR ${accounts.ownershipTag} = 'personal')`
      : sql`(${accounts.ownershipTag} IS NULL OR ${accounts.ownershipTag} != 'personal')`;

  const rows = await db
    .select({
      month: sql<string>`SUBSTRING(${transactions.date}, 1, 7)`,
      total: sql<number>`SUM(ABS(${transactions.amount}))`,
    })
    .from(transactions)
    .leftJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.date, startDate.toISOString().slice(0, 10)),
        lte(transactions.date, endDate.toISOString().slice(0, 10)),
        amountFilter,
        ownershipFilter,
      ),
    )
    .groupBy(sql`SUBSTRING(${transactions.date}, 1, 7)`)
    .orderBy(sql`SUBSTRING(${transactions.date}, 1, 7)`)
    .all();

  const monthlyValues = (rows as { month: string; total: number }[]).map((r, i) => ({
    index: i,
    month: r.month as string,
    total: Number(r.total),
  }));

  if (monthlyValues.length === 0) {
    return {
      entityType,
      monthsProjected: months,
      projections: [],
      averageMonthly: 0,
      growthRate: 0,
    };
  }

  const xs = monthlyValues.map((v) => v.index);
  const ys = monthlyValues.map((v) => v.total);
  const { slope, intercept } = linearRegression(xs, ys);
  const sd = stdDev(ys);
  const avgMonthly = Math.round(ys.reduce((s, v) => s + v, 0) / ys.length);
  const growthRate = avgMonthly > 0 ? slope / avgMonthly : 0;

  const projections: RevenueProjection[] = [];
  const lastDate = new Date(endDate);

  for (let i = 1; i <= months; i++) {
    lastDate.setMonth(lastDate.getMonth() + 1);
    const x = monthlyValues.length + i - 1;
    const projected = Math.round(intercept + slope * x);

    projections.push({
      month: lastDate.toISOString().slice(0, 7),
      projected: Math.max(0, projected),
      upperBound: Math.max(0, Math.round(projected + sd)),
      lowerBound: Math.max(0, Math.round(projected - sd)),
    });
  }

  return {
    entityType,
    monthsProjected: months,
    projections,
    averageMonthly: avgMonthly,
    growthRate: Math.round(growthRate * 10000) / 10000,
  };
}
