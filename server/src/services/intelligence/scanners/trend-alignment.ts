/**
 * Cross-Module Intelligence — Trend Alignment Scanner
 *
 * Finds aligned trends across modules (revenue growth, expense tracking).
 */

import { db, transactions } from '../../../schema.js';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import type { CrossModuleInsight, TimeRange } from '../types.js';
import { buildInsight } from '../helpers.js';

export async function scanTrendAlignments(
  userId: string,
  timeRange: TimeRange,
): Promise<CrossModuleInsight[]> {
  const insights: CrossModuleInsight[] = [];

  try {
    const monthlyTx: any[] = await (db as any)
      .select({
        month: sql`substr(${transactions.date}, 1, 7)`,
        totalIncome: sql`sum(case when ${transactions.amount} > 0 then ${transactions.amount} else 0 end)`,
        totalExpense: sql`sum(case when ${transactions.amount} < 0 then abs(${transactions.amount}) else 0 end)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          gte(transactions.date, timeRange.start),
          lte(transactions.date, timeRange.end),
        ),
      )
      .groupBy(sql`substr(${transactions.date}, 1, 7)`)
      .orderBy(sql`substr(${transactions.date}, 1, 7)`)
      .all();

    if (monthlyTx.length < 3) return insights;

    const incomes = monthlyTx.map((m: any) => Number(m.totalIncome ?? m.total_income ?? 0));
    let growthMonths = 0;
    for (let i = 1; i < incomes.length; i++) {
      if (incomes[i] > incomes[i - 1]) growthMonths++;
    }

    if (growthMonths >= Math.max(2, incomes.length * 0.6)) {
      const growthRate =
        incomes.length >= 2 && incomes[0] > 0
          ? ((incomes[incomes.length - 1] - incomes[0]) / incomes[0]) * 100
          : 0;

      insights.push(
        buildInsight(
          'trend_alignment',
          'Revenue growth trend detected',
          `Income trending upward for ${growthMonths} of ${incomes.length - 1} months (${growthRate.toFixed(1)}% overall growth).`,
          {
            growthMonths,
            totalMonths: incomes.length,
            growthRate: Math.round(growthRate * 100) / 100,
          },
          ['transactions', 'analytics'],
          Math.min(0.6 + growthMonths * 0.05, 0.95),
          'info',
          userId,
          timeRange,
        ),
      );
    }

    // Expense outpacing income
    const expenses = monthlyTx.map((m: any) => Number(m.totalExpense ?? m.total_expense ?? 0));
    if (incomes.length >= 3 && expenses.length >= 3) {
      const incomeGrowth =
        incomes[0] > 0 ? (incomes[incomes.length - 1] - incomes[0]) / incomes[0] : 0;
      const expenseGrowth =
        expenses[0] > 0 ? (expenses[expenses.length - 1] - expenses[0]) / expenses[0] : 0;

      if (expenseGrowth > incomeGrowth + 0.1 && expenseGrowth > 0.1) {
        insights.push(
          buildInsight(
            'trend_alignment',
            'Expenses growing faster than income',
            `Expense growth (${(expenseGrowth * 100).toFixed(1)}%) outpacing income growth (${(incomeGrowth * 100).toFixed(1)}%).`,
            {
              incomeGrowth: Math.round(incomeGrowth * 10000) / 100,
              expenseGrowth: Math.round(expenseGrowth * 10000) / 100,
            },
            ['transactions', 'analytics', 'forecasting'],
            0.75,
            'warning',
            userId,
            timeRange,
          ),
        );
      }
    }
  } catch {
    /* scanner failure */
  }

  return insights;
}
