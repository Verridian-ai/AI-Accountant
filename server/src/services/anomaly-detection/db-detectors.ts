/**
 * Anomaly Detection Module — Database-dependent Detectors
 *
 * Detectors that query the database directly: category drift and schedule deviation.
 */

import { db, transactions } from '../../schema.js';
import { eq, and, gte } from 'drizzle-orm';
import crypto from 'crypto';
import type { AnomalyAlertResult } from './types.js';
import { categoryProportions, findRecurringPatterns, daysBetween } from './utils.js';

export async function detectCategoryDrift(
  userId: string,
  months = 6,
): Promise<AnomalyAlertResult[]> {
  const alerts: AnomalyAlertResult[] = [];
  const now = new Date();
  const halfwayDate = new Date(now);
  halfwayDate.setMonth(halfwayDate.getMonth() - Math.floor(months / 2));
  const startDate = new Date(now);
  startDate.setMonth(startDate.getMonth() - months);

  const allTxns: any[] = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.date, startDate.toISOString().slice(0, 10)),
      ),
    )
    .all();
  if (allTxns.length < 20) return alerts;

  const halfwayStr = halfwayDate.toISOString().slice(0, 10);
  const historical = allTxns.filter((t: any) => t.date < halfwayStr);
  const recent = allTxns.filter((t: any) => t.date >= halfwayStr);
  if (historical.length < 5 || recent.length < 5) return alerts;

  const histProportions = categoryProportions(historical);
  const recentProportions = categoryProportions(recent);
  const allCategories = new Set([
    ...Object.keys(histProportions),
    ...Object.keys(recentProportions),
  ]);

  for (const cat of allCategories) {
    const histPct = histProportions[cat] ?? 0;
    const recentPct = recentProportions[cat] ?? 0;
    const drift = Math.abs(recentPct - histPct);
    if (drift > 15) {
      const direction = recentPct > histPct ? 'increased' : 'decreased';
      alerts.push({
        id: crypto.randomUUID(),
        alertType: 'category_drift',
        severity: drift > 30 ? 'high' : 'medium',
        title: `Spending drift in ${cat}`,
        description: `${cat} spending has ${direction} from ${histPct.toFixed(1)}% to ${recentPct.toFixed(1)}% of total (${drift.toFixed(1)}% shift over ${months} months).`,
        details: {
          category: cat,
          historicalPct: Math.round(histPct * 10) / 10,
          recentPct: Math.round(recentPct * 10) / 10,
          driftPct: Math.round(drift * 10) / 10,
          direction,
          months,
        },
      });
    }
  }
  return alerts;
}

export async function detectScheduleDeviation(userId: string): Promise<AnomalyAlertResult[]> {
  const alerts: AnomalyAlertResult[] = [];
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 12);

  const txns: any[] = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.date, cutoff.toISOString().slice(0, 10)),
      ),
    )
    .orderBy(transactions.date)
    .all();

  const patterns = findRecurringPatterns(txns);
  const now = new Date();
  const nowStr = now.toISOString().slice(0, 10);

  for (const pattern of patterns) {
    const expectedDate = new Date(pattern.nextExpected);
    const dpd = daysBetween(pattern.nextExpected, nowStr);
    if (dpd > pattern.intervalDays * 0.5 && expectedDate < now) {
      alerts.push({
        id: crypto.randomUUID(),
        alertType: 'schedule_deviation',
        severity: 'high',
        title: `Missed recurring payment: ${pattern.merchant}`,
        description: `Expected ~$${(pattern.averageAmount / 100).toFixed(2)} around ${pattern.nextExpected}, now ${dpd} days overdue.`,
        details: {
          merchant: pattern.merchant,
          expectedDate: pattern.nextExpected,
          daysPastDue: dpd,
          averageAmount: pattern.averageAmount,
          intervalDays: pattern.intervalDays,
        },
      });
    }
    const lastTx = txns
      .filter(
        (t: any) =>
          (t.merchantNormalized ?? t.description ?? '').toLowerCase().trim() ===
          pattern.merchant.toLowerCase(),
      )
      .pop();
    if (lastTx) {
      const latestAbs = Math.abs(lastTx.amount);
      const pctChange =
        pattern.averageAmount > 0
          ? Math.abs(latestAbs - pattern.averageAmount) / pattern.averageAmount
          : 0;
      if (pctChange > 0.1) {
        alerts.push({
          id: crypto.randomUUID(),
          alertType: 'schedule_deviation',
          severity: 'medium',
          title: `Amount change for ${pattern.merchant}`,
          description: `Latest payment $${(latestAbs / 100).toFixed(2)} differs from average $${(pattern.averageAmount / 100).toFixed(2)} (${(pctChange * 100).toFixed(0)}% change).`,
          details: {
            merchant: pattern.merchant,
            latestAmount: lastTx.amount,
            averageAmount: pattern.averageAmount,
            pctChange: Math.round(pctChange * 1000) / 10,
          },
          transactionId: lastTx.id,
          accountId: lastTx.accountId,
        });
      }
    }
  }
  return alerts;
}
