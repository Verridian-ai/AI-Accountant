/**
 * Enhanced Budget — Bill Pattern Detection
 *
 * Detects recurring bill patterns from transaction history.
 * Extracted from EnhancedBudgetService for file-size compliance.
 */

import { db, transactions } from '../../schema.js';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import type { RecurringBill } from './types.js';
import { stdDev, detectFrequency, addDays, frequencyToDays } from './helpers.js';

/**
 * Detect recurring bill patterns from transaction history.
 */
export async function detectBillPatterns(userId: string): Promise<RecurringBill[]> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 12);

  const rows = await db
    .select({
      merchant: sql<string>`COALESCE(${transactions.merchantNormalized}, ${transactions.description})`,
      date: transactions.date,
      amount: transactions.amount,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.date, startDate.toISOString().slice(0, 10)),
        lte(transactions.date, endDate.toISOString().slice(0, 10)),
        sql`${transactions.amount} < 0`,
      ),
    )
    .orderBy(
      sql`COALESCE(${transactions.merchantNormalized}, ${transactions.description}), ${transactions.date}`,
    )
    .all();

  const merchantTxs = new Map<string, Array<{ date: string; amount: number }>>();
  for (const row of rows as any[]) {
    const merchant = row.merchant ?? 'Unknown';
    if (!merchantTxs.has(merchant)) merchantTxs.set(merchant, []);
    merchantTxs.get(merchant)!.push({ date: row.date, amount: Math.abs(row.amount) });
  }

  const bills: RecurringBill[] = [];
  const today = new Date().toISOString().slice(0, 10);

  for (const [merchant, txs] of merchantTxs) {
    if (txs.length < 2) continue;

    txs.sort((a, b) => a.date.localeCompare(b.date));
    const dates = txs.map((t) => t.date);
    const amounts = txs.map((t) => t.amount);

    const avgAmount = Math.round(amounts.reduce((s, v) => s + v, 0) / amounts.length);
    const amountDeviation = stdDev(amounts) / (avgAmount || 1);
    if (amountDeviation > 0.5) continue;

    const frequency = detectFrequency(dates);
    if (!frequency) continue;

    const lastDate = dates[dates.length - 1];
    const lastAmount = amounts[amounts.length - 1];
    const avgDays = frequencyToDays(frequency);
    const nextDueDate = addDays(lastDate, avgDays);

    let status: RecurringBill['status'] = 'current';
    let amountChangePercent: number | undefined;

    if (nextDueDate < today) {
      status = 'overdue';
    }

    const lastVsAvgChange = Math.abs(lastAmount - avgAmount) / (avgAmount || 1);
    if (lastVsAvgChange > 0.1) {
      status = 'amount_changed';
      amountChangePercent = Math.round(lastVsAvgChange * 100);
    }

    bills.push({
      merchant,
      averageAmount: avgAmount,
      lastAmount,
      frequency,
      nextDueDate,
      lastPaidDate: lastDate,
      status,
      amountChangePercent,
      occurrenceCount: txs.length,
    });
  }

  bills.sort((a, b) => {
    if (a.status === 'overdue' && b.status !== 'overdue') return -1;
    if (b.status === 'overdue' && a.status !== 'overdue') return 1;
    return a.nextDueDate.localeCompare(b.nextDueDate);
  });

  return bills;
}
