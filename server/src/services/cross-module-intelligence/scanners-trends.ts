// ============================================================================
// TREND SCANNERS — trend alignments + spending patterns
// ============================================================================

import { db, transactions } from '../../schema.js';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { buildInsight } from './insight-helpers.js';
import type { CrossModuleInsight, TimeRange } from './types.js';

/**
 * Find aligned trends across modules (revenue growth, expense tracking).
 */
export async function scanTrendAlignments(
  userId: string,
  timeRange: TimeRange,
): Promise<CrossModuleInsight[]> {
  const insights: CrossModuleInsight[] = [];

  try {
    const monthlyTx: Array<{
      month: string;
      totalIncome: number;
      totalExpense: number;
      total_income?: number;
      total_expense?: number;
    }> = await db
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

    const incomes = monthlyTx.map((m) => Number(m.totalIncome ?? m.total_income ?? 0));
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
    const expenses = monthlyTx.map((m) => Number(m.totalExpense ?? m.total_expense ?? 0));
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

/**
 * Identify notable spending patterns across accounts and time.
 */
export async function scanSpendingPatterns(
  userId: string,
  timeRange: TimeRange,
): Promise<CrossModuleInsight[]> {
  const insights: CrossModuleInsight[] = [];

  try {
    const categoryMonthly: Array<{ category: string | null; month: string; total: number }> =
      await db
        .select({
          category: transactions.category,
          month: sql`substr(${transactions.date}, 1, 7)`,
          total: sql`sum(abs(${transactions.amount}))`,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            sql`${transactions.amount} < 0`,
            gte(transactions.date, timeRange.start),
            lte(transactions.date, timeRange.end),
            sql`${transactions.category} IS NOT NULL`,
          ),
        )
        .groupBy(transactions.category, sql`substr(${transactions.date}, 1, 7)`)
        .orderBy(transactions.category, sql`substr(${transactions.date}, 1, 7)`)
        .all();

    // Group by category
    const categoryMap = new Map<string, number[]>();
    for (const row of categoryMonthly) {
      const cat = row.category;
      if (!cat) continue;
      if (!categoryMap.has(cat)) categoryMap.set(cat, []);
      categoryMap.get(cat)!.push(Number(row.total ?? 0));
    }

    // Detect spending spikes per category
    for (const [category, totals] of categoryMap) {
      if (totals.length < 3) continue;

      const recent = totals.slice(-2);
      const earlier = totals.slice(0, -2);
      const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
      const earlierAvg =
        earlier.length > 0 ? earlier.reduce((a, b) => a + b, 0) / earlier.length : 0;

      if (earlierAvg > 0 && recentAvg > earlierAvg * 1.5 && recentAvg > 10000) {
        const increasePercent = ((recentAvg - earlierAvg) / earlierAvg) * 100;
        insights.push(
          buildInsight(
            'spending_pattern',
            `Spending spike in "${category}"`,
            `Recent spending ($${(recentAvg / 100).toFixed(2)}/month avg) is ${increasePercent.toFixed(0)}% above earlier average ($${(earlierAvg / 100).toFixed(2)}/month).`,
            {
              category,
              recentAvg: Math.round(recentAvg),
              earlierAvg: Math.round(earlierAvg),
              increasePercent: Math.round(increasePercent),
            },
            ['transactions', 'analytics'],
            0.7,
            increasePercent > 200 ? 'warning' : 'suggestion',
            userId,
            timeRange,
          ),
        );
      }
    }

    // Account concentration
    const accountSpend: Array<{ accountId: string | null; total: number }> = await db
      .select({
        accountId: transactions.accountId,
        total: sql`sum(abs(${transactions.amount}))`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          sql`${transactions.amount} < 0`,
          gte(transactions.date, timeRange.start),
          lte(transactions.date, timeRange.end),
          sql`${transactions.accountId} IS NOT NULL`,
        ),
      )
      .groupBy(transactions.accountId)
      .all();

    if (accountSpend.length >= 2) {
      const totals = accountSpend.map((a) => Number(a.total ?? 0));
      const grandTotal = totals.reduce((a, b) => a + b, 0);
      const maxSpend = Math.max(...totals);

      if (grandTotal > 0 && maxSpend / grandTotal > 0.85) {
        insights.push(
          buildInsight(
            'spending_pattern',
            'High account concentration in spending',
            `Over ${((maxSpend / grandTotal) * 100).toFixed(0)}% of spending flows through a single account. Consider diversifying for better tracking.`,
            {
              accountBreakdown: accountSpend.map((a) => ({
                accountId: a.accountId,
                total: Number(a.total ?? 0),
              })),
            },
            ['accounts', 'transactions'],
            0.6,
            'info',
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
