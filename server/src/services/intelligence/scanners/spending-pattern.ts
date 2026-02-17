/**
 * Cross-Module Intelligence — Spending Pattern Scanner
 *
 * Identifies notable spending patterns across accounts and time,
 * including category spending spikes and account concentration.
 */

import { db, transactions } from '../../../schema.js';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import type { CrossModuleInsight, TimeRange } from '../types.js';
import { buildInsight } from '../helpers.js';

export async function scanSpendingPatterns(
  userId: string,
  timeRange: TimeRange,
): Promise<CrossModuleInsight[]> {
  const insights: CrossModuleInsight[] = [];

  try {
    // Spending by category per month
    const categoryMonthly: any[] = await (db as any)
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

    // Group by category -> totals array
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

    // Account concentration -- one account dominates spending
    const accountSpend: any[] = await (db as any)
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
      const totals = accountSpend.map((a: any) => Number(a.total ?? 0));
      const grandTotal = totals.reduce((a, b) => a + b, 0);
      const maxSpend = Math.max(...totals);

      if (grandTotal > 0 && maxSpend / grandTotal > 0.85) {
        insights.push(
          buildInsight(
            'spending_pattern',
            'High account concentration in spending',
            `Over ${((maxSpend / grandTotal) * 100).toFixed(0)}% of spending flows through a single account. Consider diversifying for better tracking.`,
            {
              accountBreakdown: accountSpend.map((a: any) => ({
                accountId: a.accountId ?? a.account_id,
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
