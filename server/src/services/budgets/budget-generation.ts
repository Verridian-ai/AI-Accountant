/**
 * Budget generation from historical data — self-contained implementation.
 */
import { db, transactions, budgetLines } from '../../schema.js';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import crypto from 'crypto';
import { getMonthsBetween } from './utils.js';

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
  // Calculate lookback window
  const startDate = new Date(periodStart);
  const lookbackStart = new Date(startDate);
  lookbackStart.setMonth(lookbackStart.getMonth() - lookbackMonths);
  const lookbackStartStr = lookbackStart.toISOString().split('T')[0];
  const lookbackEndStr = startDate.toISOString().split('T')[0];

  // Query historical transactions grouped by category and month
  const historicalData = await db
    .select({
      category: transactions.category,
      month: sql<string>`SUBSTR(${transactions.date}, 1, 7)`,
      totalAmount: sql<number>`SUM(ABS(${transactions.amount}))`,
      txCount: sql<number>`COUNT(*)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.date, lookbackStartStr),
        lte(transactions.date, lookbackEndStr),
        sql`${transactions.category} IS NOT NULL`,
      ),
    )
    .groupBy(transactions.category, sql`SUBSTR(${transactions.date}, 1, 7)`)
    .all();

  // Build category -> month -> amount map
  const categoryMonthMap = new Map<string, Map<string, number>>();
  for (const row of historicalData) {
    const cat = row.category as string;
    if (!categoryMonthMap.has(cat)) {
      categoryMonthMap.set(cat, new Map());
    }
    categoryMonthMap.get(cat)!.set(row.month, Number(row.totalAmount));
  }

  // Calculate averages and seasonal factors per category
  const generatedLines: Record<string, unknown>[] = [];
  const targetMonths = getMonthsBetween(periodStart, periodEnd);

  for (const [category, monthAmounts] of categoryMonthMap) {
    const amounts = Array.from(monthAmounts.values());
    const overallAvg = amounts.reduce((s, v) => s + v, 0) / amounts.length;

    // Seasonal factors: ratio of each calendar month's average to overall average
    const monthFactors = new Map<number, number>();
    const monthSums = new Map<number, { total: number; count: number }>();

    for (const [monthStr, amount] of monthAmounts) {
      const calMonth = parseInt(monthStr.split('-')[1], 10);
      const existing = monthSums.get(calMonth) ?? { total: 0, count: 0 };
      monthSums.set(calMonth, { total: existing.total + amount, count: existing.count + 1 });
    }

    for (const [calMonth, data] of monthSums) {
      const monthAvg = data.total / data.count;
      monthFactors.set(calMonth, overallAvg > 0 ? monthAvg / overallAvg : 1.0);
    }

    // Generate budget lines for each target month
    for (const targetMonth of targetMonths) {
      const calMonth = parseInt(targetMonth.split('-')[1], 10);
      const seasonalFactor = monthFactors.get(calMonth) ?? 1.0;
      const budgetedAmount = Math.round(overallAvg * seasonalFactor);

      const lineData: Record<string, unknown> = {
        id: crypto.randomUUID(),
        category,
        subcategory: null,
        period: targetMonth,
        budgetedAmount,
        notes: `Auto-generated from ${lookbackMonths}mo history (seasonal factor: ${seasonalFactor.toFixed(2)})`,
        createdAt: new Date().toISOString(),
      };

      if (budgetId) {
        lineData.budgetId = budgetId;
        await db.insert(budgetLines).values(lineData);
      }

      generatedLines.push(lineData);
    }
  }

  return generatedLines;
}
