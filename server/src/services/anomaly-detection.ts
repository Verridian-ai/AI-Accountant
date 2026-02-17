/**
 * Anomaly Detection Service — Wave 15
 * Multi-strategy engine for detecting unusual financial patterns:
 *   - Duplicate payments
 *   - Statistical amount outliers
 *   - Transaction velocity spikes
 *   - Category spending drift
 *   - Unusual merchants
 *   - Recurring schedule deviations
 */

import { db, transactions, anomalyAlerts } from '../schema.js';
import { eq, and, gte, lte, desc, sql, type SQL } from 'drizzle-orm';
import crypto from 'crypto';

type TransactionRow = typeof transactions.$inferSelect;
type AnomalyAlertRow = typeof anomalyAlerts.$inferSelect;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AnomalyDetectorType =
  | 'duplicates'
  | 'amounts'
  | 'velocity'
  | 'category_drift'
  | 'merchant'
  | 'schedule';

export interface AnomalyScanOptions {
  accountId?: string;
  dateFrom?: string;
  dateTo?: string;
  detectors: AnomalyDetectorType[];
  severityThreshold?: 'low' | 'medium' | 'high';
}

export interface AnomalyAlertResult {
  id: string;
  alertType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  details: Record<string, unknown>;
  transactionId?: string;
  accountId?: string | null;
}

export interface AlertFilters {
  status?: string;
  severity?: string;
  alertType?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface AlertStats {
  total: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  byStatus: Record<string, number>;
  trend: 'increasing' | 'stable' | 'decreasing';
}

export interface RecurringPattern {
  merchant: string;
  averageAmount: number;
  intervalDays: number;
  lastOccurrence: string;
  nextExpected: string;
}

interface DescriptiveStats {
  mean: number;
  stdDev: number;
  median: number;
  q1: number;
  q3: number;
}

const SEVERITY_RANK: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class AnomalyDetectionService {
  // -----------------------------------------------------------------------
  // Public — Scanning
  // -----------------------------------------------------------------------

  /** Run selected detectors against a user's transactions, persist new alerts. */
  async scanTransactions(
    userId: string,
    options: AnomalyScanOptions,
  ): Promise<AnomalyAlertResult[]> {
    const conditions: (SQL | undefined)[] = [eq(transactions.userId, userId)];
    if (options.accountId) conditions.push(eq(transactions.accountId, options.accountId));
    if (options.dateFrom) conditions.push(gte(transactions.date, options.dateFrom));
    if (options.dateTo) conditions.push(lte(transactions.date, options.dateTo));

    const txns: TransactionRow[] = await db
      .select()
      .from(transactions)
      .where(and(...conditions))
      .orderBy(transactions.date)
      .all();

    let alerts: AnomalyAlertResult[] = [];

    const detectorMap: Record<AnomalyDetectorType, () => Promise<AnomalyAlertResult[]>> = {
      duplicates: () => this.detectDuplicatePayments(txns),
      amounts: () => this.detectAmountAnomalies(txns),
      velocity: () => this.detectVelocitySpikes(txns),
      category_drift: () => this.detectCategoryDrift(userId),
      merchant: () => this.detectUnusualMerchant(txns),
      schedule: () => this.detectScheduleDeviation(userId),
    };

    for (const detector of options.detectors) {
      const fn = detectorMap[detector];
      if (fn) {
        const results = await fn();
        alerts.push(...results);
      }
    }

    // De-duplicate by title+transactionId
    const seen = new Set<string>();
    alerts = alerts.filter((a) => {
      const key = `${a.alertType}:${a.title}:${a.transactionId ?? ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Filter by severity threshold
    if (options.severityThreshold) {
      const minRank = SEVERITY_RANK[options.severityThreshold] ?? 1;
      alerts = alerts.filter((a) => (SEVERITY_RANK[a.severity] ?? 0) >= minRank);
    }

    // Sort by severity descending
    alerts.sort((a, b) => (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0));

    // Persist to DB
    for (const alert of alerts) {
      await db
        .insert(anomalyAlerts)
        .values({
          id: alert.id,
          userId,
          accountId: alert.accountId ?? null,
          transactionId: alert.transactionId ?? null,
          alertType: alert.alertType,
          severity: alert.severity,
          title: alert.title,
          description: alert.description,
          details: JSON.stringify(alert.details),
          status: 'open',
          createdAt: new Date().toISOString(),
        })
        .run();
    }

    return alerts;
  }

  // -----------------------------------------------------------------------
  // Detector 1 — Duplicate Payments
  // -----------------------------------------------------------------------

  async detectDuplicatePayments(txns: TransactionRow[]): Promise<AnomalyAlertResult[]> {
    const alerts: AnomalyAlertResult[] = [];

    for (let i = 0; i < txns.length; i++) {
      for (let j = i + 1; j < txns.length; j++) {
        const a = txns[i];
        const b = txns[j];

        // Only compare debits (negative amounts)
        if (a.amount >= 0 || b.amount >= 0) continue;
        if (!this._fuzzyAmountMatch(a.amount, b.amount, 1)) continue;

        const daysDiff = this._daysBetween(a.date, b.date);
        if (daysDiff > 3) continue;

        const merchantSim = this._merchantSimilarity(
          a.merchantNormalized ?? a.description,
          b.merchantNormalized ?? b.description,
        );
        if (merchantSim < 0.6) continue;

        const severity = daysDiff <= 1 && merchantSim > 0.9 ? 'high' : 'medium';
        const merchantName = a.merchantNormalized ?? a.description;

        alerts.push({
          id: crypto.randomUUID(),
          alertType: 'duplicate_payment',
          severity,
          title: `Possible duplicate payment: ${merchantName}`,
          description: `Two payments of $${Math.abs(a.amount / 100).toFixed(2)} to ${merchantName} within ${daysDiff} day(s).`,
          details: {
            transactionA: a.id,
            transactionB: b.id,
            amount: a.amount,
            daysBetween: daysDiff,
            merchantSimilarity: merchantSim,
          },
          transactionId: a.id,
          accountId: a.accountId,
        });
      }
    }

    return alerts;
  }

  // -----------------------------------------------------------------------
  // Detector 2 — Amount Anomalies (z-score per category)
  // -----------------------------------------------------------------------

  async detectAmountAnomalies(txns: TransactionRow[], category?: string): Promise<AnomalyAlertResult[]> {
    const alerts: AnomalyAlertResult[] = [];

    // Group by category
    const grouped = new Map<string, TransactionRow[]>();
    for (const tx of txns) {
      const cat = category ?? tx.category ?? 'uncategorized';
      if (category && tx.category !== category) continue;
      const list = grouped.get(cat) ?? [];
      list.push(tx);
      grouped.set(cat, list);
    }

    for (const [cat, catTxns] of grouped) {
      if (catTxns.length < 5) continue; // need enough data

      const amounts = catTxns.map((t) => Math.abs(t.amount));
      const stats = this._calculateStats(amounts);
      if (stats.stdDev === 0) continue;

      for (const tx of catTxns) {
        const absAmount = Math.abs(tx.amount);
        const zScore = (absAmount - stats.mean) / stats.stdDev;

        if (zScore > 3) {
          const severity = zScore > 5 ? 'critical' : 'high';
          alerts.push({
            id: crypto.randomUUID(),
            alertType: 'amount_anomaly',
            severity,
            title: `Unusual amount in ${cat}`,
            description: `Transaction of $${(absAmount / 100).toFixed(2)} is ${zScore.toFixed(1)} standard deviations from the ${cat} average of $${(stats.mean / 100).toFixed(2)}.`,
            details: {
              category: cat,
              amount: tx.amount,
              zScore: Math.round(zScore * 100) / 100,
              categoryMean: stats.mean,
              categoryStdDev: stats.stdDev,
            },
            transactionId: tx.id,
            accountId: tx.accountId,
          });
        }
      }
    }

    return alerts;
  }

  // -----------------------------------------------------------------------
  // Detector 3 — Velocity Spikes
  // -----------------------------------------------------------------------

  async detectVelocitySpikes(txns: TransactionRow[], windowDays = 7): Promise<AnomalyAlertResult[]> {
    const alerts: AnomalyAlertResult[] = [];
    if (txns.length < 10) return alerts;

    // --- Window-based frequency detection ---
    const dateGroups = new Map<string, TransactionRow[]>();
    for (const tx of txns) {
      const list = dateGroups.get(tx.date) ?? [];
      list.push(tx);
      dateGroups.set(tx.date, list);
    }

    const sortedDates = [...dateGroups.keys()].sort();
    if (sortedDates.length < windowDays * 2) return alerts;

    // Calculate rolling averages
    const windowCounts: number[] = [];
    for (let i = 0; i <= sortedDates.length - windowDays; i++) {
      let count = 0;
      for (let j = i; j < i + windowDays && j < sortedDates.length; j++) {
        count += dateGroups.get(sortedDates[j])?.length ?? 0;
      }
      windowCounts.push(count);
    }

    if (windowCounts.length === 0) return alerts;

    const avgCount = windowCounts.reduce((s, c) => s + c, 0) / windowCounts.length;

    for (let i = 0; i < windowCounts.length; i++) {
      const ratio = avgCount > 0 ? windowCounts[i] / avgCount : 0;
      if (ratio > 2) {
        const severity = ratio > 3 ? 'high' : 'medium';
        const windowStart = sortedDates[i];
        const windowEnd = sortedDates[Math.min(i + windowDays - 1, sortedDates.length - 1)];

        alerts.push({
          id: crypto.randomUUID(),
          alertType: 'velocity_spike',
          severity,
          title: `Transaction velocity spike: ${windowStart} to ${windowEnd}`,
          description: `${windowCounts[i]} transactions in ${windowDays}-day window, ${ratio.toFixed(1)}x the rolling average of ${avgCount.toFixed(1)}.`,
          details: {
            windowStart,
            windowEnd,
            count: windowCounts[i],
            rollingAverage: Math.round(avgCount * 10) / 10,
            ratio: Math.round(ratio * 10) / 10,
          },
        });
      }
    }

    // --- Rapid successive transactions (<5 min apart) ---
    const txnsWithTime = txns.filter((t) => t.date && t.date.includes('T'));
    for (let i = 1; i < txnsWithTime.length; i++) {
      const prev = new Date(txnsWithTime[i - 1].date).getTime();
      const curr = new Date(txnsWithTime[i].date).getTime();
      const diffMin = (curr - prev) / 60000;

      if (diffMin >= 0 && diffMin < 5 && !isNaN(diffMin)) {
        alerts.push({
          id: crypto.randomUUID(),
          alertType: 'rapid_transactions',
          severity: 'medium',
          title: 'Rapid successive transactions',
          description: `Two transactions ${diffMin.toFixed(0)} minutes apart on ${txnsWithTime[i].date}.`,
          details: {
            transactionA: txnsWithTime[i - 1].id,
            transactionB: txnsWithTime[i].id,
            minutesApart: Math.round(diffMin),
          },
          transactionId: txnsWithTime[i].id,
          accountId: txnsWithTime[i].accountId,
        });
      }
    }

    return alerts;
  }

  // -----------------------------------------------------------------------
  // Detector 4 — Category Drift
  // -----------------------------------------------------------------------

  async detectCategoryDrift(userId: string, months = 6): Promise<AnomalyAlertResult[]> {
    const alerts: AnomalyAlertResult[] = [];

    const now = new Date();
    const halfwayDate = new Date(now);
    halfwayDate.setMonth(halfwayDate.getMonth() - Math.floor(months / 2));
    const startDate = new Date(now);
    startDate.setMonth(startDate.getMonth() - months);

    const allTxns: TransactionRow[] = await db
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

    // Split into historical and recent halves
    const historical = allTxns.filter((t) => t.date < halfwayStr);
    const recent = allTxns.filter((t) => t.date >= halfwayStr);

    if (historical.length < 5 || recent.length < 5) return alerts;

    const histProportions = this._categoryProportions(historical);
    const recentProportions = this._categoryProportions(recent);

    const allCategories = new Set([
      ...Object.keys(histProportions),
      ...Object.keys(recentProportions),
    ]);

    for (const cat of allCategories) {
      const histPct = histProportions[cat] ?? 0;
      const recentPct = recentProportions[cat] ?? 0;
      const drift = Math.abs(recentPct - histPct);

      if (drift > 15) {
        const severity = drift > 30 ? 'high' : 'medium';
        const direction = recentPct > histPct ? 'increased' : 'decreased';

        alerts.push({
          id: crypto.randomUUID(),
          alertType: 'category_drift',
          severity,
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

  // -----------------------------------------------------------------------
  // Detector 5 — Unusual Merchant
  // -----------------------------------------------------------------------

  async detectUnusualMerchant(txns: TransactionRow[]): Promise<AnomalyAlertResult[]> {
    const alerts: AnomalyAlertResult[] = [];

    // Count merchant occurrences
    const merchantCounts = new Map<string, number>();
    const merchantTxns = new Map<string, TransactionRow[]>();

    for (const tx of txns) {
      const merchant = (tx.merchantNormalized ?? tx.description ?? '').toLowerCase().trim();
      if (!merchant) continue;
      merchantCounts.set(merchant, (merchantCounts.get(merchant) ?? 0) + 1);
      const list = merchantTxns.get(merchant) ?? [];
      list.push(tx);
      merchantTxns.set(merchant, list);
    }

    for (const [merchant, count] of merchantCounts) {
      const merchantTxList = merchantTxns.get(merchant) ?? [];

      if (count === 1) {
        const tx = merchantTxList[0];
        const absAmount = Math.abs(tx.amount);

        if (absAmount > 50000) {
          // >$500 (amounts in cents)
          alerts.push({
            id: crypto.randomUUID(),
            alertType: 'unusual_merchant',
            severity: 'medium',
            title: `First-time high-value merchant: ${merchant}`,
            description: `First transaction of $${(absAmount / 100).toFixed(2)} with ${merchant}.`,
            details: {
              merchant,
              amount: tx.amount,
              date: tx.date,
            },
            transactionId: tx.id,
            accountId: tx.accountId,
          });
        } else {
          alerts.push({
            id: crypto.randomUUID(),
            alertType: 'unusual_merchant',
            severity: 'low',
            title: `New merchant: ${merchant}`,
            description: `First-time transaction with ${merchant} for $${(absAmount / 100).toFixed(2)}.`,
            details: { merchant, amount: tx.amount, date: tx.date },
            transactionId: tx.id,
            accountId: tx.accountId,
          });
        }
      } else if (count >= 3) {
        // Check for pattern change in recurring merchant
        const amounts = merchantTxList.map((t) => Math.abs(t.amount));
        const stats = this._calculateStats(amounts);
        if (stats.stdDev === 0) continue;

        const latest = merchantTxList[merchantTxList.length - 1];
        const latestAbs = Math.abs(latest.amount);
        const zScore = (latestAbs - stats.mean) / stats.stdDev;

        if (zScore > 2) {
          alerts.push({
            id: crypto.randomUUID(),
            alertType: 'unusual_merchant',
            severity: 'medium',
            title: `Changed pattern for ${merchant}`,
            description: `Latest amount $${(latestAbs / 100).toFixed(2)} deviates from typical $${(stats.mean / 100).toFixed(2)} (${zScore.toFixed(1)}σ).`,
            details: {
              merchant,
              latestAmount: latest.amount,
              typicalAmount: stats.mean,
              zScore: Math.round(zScore * 100) / 100,
            },
            transactionId: latest.id,
            accountId: latest.accountId,
          });
        }
      }
    }

    return alerts;
  }

  // -----------------------------------------------------------------------
  // Detector 6 — Schedule Deviation
  // -----------------------------------------------------------------------

  async detectScheduleDeviation(userId: string): Promise<AnomalyAlertResult[]> {
    const alerts: AnomalyAlertResult[] = [];

    // Fetch last 12 months of transactions
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 12);

    const txns: TransactionRow[] = await db
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

    const patterns = this._findRecurringPatterns(txns);

    const now = new Date();
    const nowStr = now.toISOString().slice(0, 10);

    for (const pattern of patterns) {
      const expectedDate = new Date(pattern.nextExpected);
      const daysPastDue = this._daysBetween(pattern.nextExpected, nowStr);

      if (daysPastDue > pattern.intervalDays * 0.5 && expectedDate < now) {
        // Missed payment — past due by >50% of the interval
        alerts.push({
          id: crypto.randomUUID(),
          alertType: 'schedule_deviation',
          severity: 'high',
          title: `Missed recurring payment: ${pattern.merchant}`,
          description: `Expected ~$${(pattern.averageAmount / 100).toFixed(2)} around ${pattern.nextExpected}, now ${daysPastDue} days overdue.`,
          details: {
            merchant: pattern.merchant,
            expectedDate: pattern.nextExpected,
            daysPastDue,
            averageAmount: pattern.averageAmount,
            intervalDays: pattern.intervalDays,
          },
        });
      }

      // Check if latest occurrence had a significant amount change
      const lastTx = txns
        .filter(
          (t) =>
            (t.merchantNormalized ?? t.description ?? '').toLowerCase().trim() ===
            pattern.merchant.toLowerCase(),
        )
        .pop();

      if (lastTx) {
        const latestAbs = Math.abs(lastTx.amount);
        const avgAbs = pattern.averageAmount;
        const pctChange = avgAbs > 0 ? Math.abs(latestAbs - avgAbs) / avgAbs : 0;

        if (pctChange > 0.1) {
          alerts.push({
            id: crypto.randomUUID(),
            alertType: 'schedule_deviation',
            severity: 'medium',
            title: `Amount change for ${pattern.merchant}`,
            description: `Latest payment $${(latestAbs / 100).toFixed(2)} differs from average $${(avgAbs / 100).toFixed(2)} (${(pctChange * 100).toFixed(0)}% change).`,
            details: {
              merchant: pattern.merchant,
              latestAmount: lastTx.amount,
              averageAmount: avgAbs,
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

  // -----------------------------------------------------------------------
  // Public — Alert CRUD
  // -----------------------------------------------------------------------

  async getAlerts(userId: string, filters?: AlertFilters): Promise<AnomalyAlertRow[]> {
    const conditions: (SQL | undefined)[] = [eq(anomalyAlerts.userId, userId)];

    if (filters?.status) conditions.push(eq(anomalyAlerts.status, filters.status));
    if (filters?.severity) conditions.push(eq(anomalyAlerts.severity, filters.severity));
    if (filters?.alertType) conditions.push(eq(anomalyAlerts.alertType, filters.alertType));
    if (filters?.dateFrom) conditions.push(gte(anomalyAlerts.createdAt, filters.dateFrom));
    if (filters?.dateTo) conditions.push(lte(anomalyAlerts.createdAt, filters.dateTo));

    return db
      .select()
      .from(anomalyAlerts)
      .where(and(...conditions))
      .orderBy(desc(anomalyAlerts.createdAt))
      .all();
  }

  async acknowledgeAlert(alertId: string): Promise<void> {
    await db
      .update(anomalyAlerts)
      .set({ status: 'acknowledged' })
      .where(eq(anomalyAlerts.id, alertId))
      .run();
  }

  async resolveAlert(alertId: string, resolvedBy: string): Promise<void> {
    await db
      .update(anomalyAlerts)
      .set({
        status: 'resolved',
        resolvedBy,
        resolvedAt: new Date().toISOString(),
      })
      .where(eq(anomalyAlerts.id, alertId))
      .run();
  }

  async dismissAlert(alertId: string, reason: string): Promise<void> {
    await db
      .update(anomalyAlerts)
      .set({
        status: 'dismissed',
        resolvedBy: reason,
      })
      .where(eq(anomalyAlerts.id, alertId))
      .run();
  }

  async getAlertStats(userId: string): Promise<AlertStats> {
    const allAlerts: AnomalyAlertRow[] = await db
      .select()
      .from(anomalyAlerts)
      .where(eq(anomalyAlerts.userId, userId))
      .all();

    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const byStatus: Record<string, number> = {};

    for (const alert of allAlerts) {
      byType[alert.alertType] = (byType[alert.alertType] ?? 0) + 1;
      bySeverity[alert.severity] = (bySeverity[alert.severity] ?? 0) + 1;
      byStatus[alert.status] = (byStatus[alert.status] ?? 0) + 1;
    }

    // Trend: compare last 30 days vs previous 30 days
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const thirtyStr = thirtyDaysAgo.toISOString();
    const sixtyStr = sixtyDaysAgo.toISOString();

    const recentCount = allAlerts.filter((a) => a.createdAt >= thirtyStr).length;
    const priorCount = allAlerts.filter(
      (a) => a.createdAt >= sixtyStr && a.createdAt < thirtyStr,
    ).length;

    let trend: 'increasing' | 'stable' | 'decreasing' = 'stable';
    if (recentCount > priorCount * 1.2) trend = 'increasing';
    else if (recentCount < priorCount * 0.8) trend = 'decreasing';

    return {
      total: allAlerts.length,
      byType,
      bySeverity,
      byStatus,
      trend,
    };
  }

  // -----------------------------------------------------------------------
  // Private Helpers
  // -----------------------------------------------------------------------

  private _calculateStats(values: number[]): DescriptiveStats {
    if (values.length === 0) {
      return { mean: 0, stdDev: 0, median: 0, q1: 0, q3: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;

    const mean = sorted.reduce((s, v) => s + v, 0) / n;
    const variance = sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
    const stdDev = Math.sqrt(variance);

    const median =
      n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];

    const q1Idx = Math.floor(n * 0.25);
    const q3Idx = Math.floor(n * 0.75);
    const q1 = sorted[q1Idx] ?? 0;
    const q3 = sorted[Math.min(q3Idx, n - 1)] ?? 0;

    return { mean, stdDev, median, q1, q3 };
  }

  private _findRecurringPatterns(txns: TransactionRow[]): RecurringPattern[] {
    const merchantGroups = new Map<string, TransactionRow[]>();

    for (const tx of txns) {
      const merchant = (tx.merchantNormalized ?? tx.description ?? '').toLowerCase().trim();
      if (!merchant) continue;
      const list = merchantGroups.get(merchant) ?? [];
      list.push(tx);
      merchantGroups.set(merchant, list);
    }

    const patterns: RecurringPattern[] = [];

    for (const [merchant, group] of merchantGroups) {
      if (group.length < 3) continue; // need at least 3 occurrences

      // Sort by date
      group.sort((a, b) => a.date.localeCompare(b.date));

      // Calculate intervals between consecutive transactions
      const intervals: number[] = [];
      for (let i = 1; i < group.length; i++) {
        const days = this._daysBetween(group[i - 1].date, group[i].date);
        if (days > 0) intervals.push(days);
      }

      if (intervals.length < 2) continue;

      const avgInterval = intervals.reduce((s, d) => s + d, 0) / intervals.length;

      // Check regularity: coefficient of variation < 0.3 means fairly regular
      const intervalStats = this._calculateStats(intervals);
      const cv = intervalStats.mean > 0 ? intervalStats.stdDev / intervalStats.mean : Infinity;

      if (cv > 0.4 || avgInterval < 5 || avgInterval > 120) continue;

      const amounts = group.map((t) => Math.abs(t.amount));
      const avgAmount = amounts.reduce((s: number, a: number) => s + a, 0) / amounts.length;

      const lastDate = group[group.length - 1].date;
      const nextExpected = new Date(lastDate);
      nextExpected.setDate(nextExpected.getDate() + Math.round(avgInterval));

      patterns.push({
        merchant,
        averageAmount: Math.round(avgAmount),
        intervalDays: Math.round(avgInterval),
        lastOccurrence: lastDate,
        nextExpected: nextExpected.toISOString().slice(0, 10),
      });
    }

    return patterns;
  }

  private _fuzzyAmountMatch(a: number, b: number, tolerancePct: number): boolean {
    if (a === b) return true;
    const absA = Math.abs(a);
    const absB = Math.abs(b);
    const maxAbs = Math.max(absA, absB);
    if (maxAbs === 0) return true;
    return (Math.abs(absA - absB) / maxAbs) * 100 <= tolerancePct;
  }

  private _merchantSimilarity(a: string, b: string): number {
    const normA = a
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim();
    const normB = b
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim();

    if (normA === normB) return 1.0;
    if (!normA || !normB) return 0.0;

    // Token overlap
    const tokensA = new Set(normA.split(/\s+/));
    const tokensB = new Set(normB.split(/\s+/));

    let overlap = 0;
    for (const t of tokensA) {
      if (tokensB.has(t)) overlap++;
    }

    const tokenScore = overlap / Math.max(tokensA.size, tokensB.size);

    // Levenshtein-based character similarity
    const editDist = this._levenshtein(normA, normB);
    const maxLen = Math.max(normA.length, normB.length);
    const charScore = maxLen > 0 ? 1 - editDist / maxLen : 1;

    // Weighted combination: tokens matter more for merchant names
    return tokenScore * 0.6 + charScore * 0.4;
  }

  private _levenshtein(a: string, b: string): number {
    const m = a.length;
    const n = b.length;

    // Optimise for common cases
    if (m === 0) return n;
    if (n === 0) return m;

    // Use single-row DP for memory efficiency
    let prev = Array.from({ length: n + 1 }, (_, i) => i);
    let curr = new Array<number>(n + 1);

    for (let i = 1; i <= m; i++) {
      curr[0] = i;
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      }
      [prev, curr] = [curr, prev];
    }

    return prev[n];
  }

  private _daysBetween(dateA: string, dateB: string): number {
    const a = new Date(dateA.slice(0, 10)).getTime();
    const b = new Date(dateB.slice(0, 10)).getTime();
    return Math.abs(Math.round((b - a) / 86400000));
  }

  private _categoryProportions(txns: TransactionRow[]): Record<string, number> {
    const totals: Record<string, number> = {};
    let grandTotal = 0;

    for (const tx of txns) {
      const cat = tx.category ?? 'uncategorized';
      const abs = Math.abs(tx.amount);
      totals[cat] = (totals[cat] ?? 0) + abs;
      grandTotal += abs;
    }

    const proportions: Record<string, number> = {};
    if (grandTotal > 0) {
      for (const [cat, total] of Object.entries(totals)) {
        proportions[cat] = (total / grandTotal) * 100;
      }
    }

    return proportions;
  }
}
