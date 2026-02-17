/**
 * Anomaly Detection Module — AnomalyDetectionService class
 *
 * Multi-strategy engine for detecting unusual financial patterns.
 */

import { db, transactions, anomalyAlerts } from '../../schema.js';
import { eq, and, gte, lte } from 'drizzle-orm';
import crypto from 'crypto';
import type {
  AnomalyDetectorType,
  AnomalyScanOptions,
  AnomalyAlertResult,
  AlertFilters,
  AlertStats,
} from './types.js';
import { AlertManagement } from './alert-management.js';
import { SEVERITY_RANK } from './types.js';
import { calculateStats, fuzzyAmountMatch, merchantSimilarity, daysBetween } from './utils.js';
import { detectCategoryDrift, detectScheduleDeviation } from './db-detectors.js';

export class AnomalyDetectionService {
  async scanTransactions(
    userId: string,
    options: AnomalyScanOptions,
  ): Promise<AnomalyAlertResult[]> {
    const conditions: any[] = [eq(transactions.userId, userId)];
    if (options.accountId) conditions.push(eq(transactions.accountId, options.accountId));
    if (options.dateFrom) conditions.push(gte(transactions.date, options.dateFrom));
    if (options.dateTo) conditions.push(lte(transactions.date, options.dateTo));

    const txns: any[] = await db
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
      if (fn) alerts.push(...(await fn()));
    }

    const seen = new Set<string>();
    alerts = alerts.filter((a) => {
      const key = `${a.alertType}:${a.title}:${a.transactionId ?? ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (options.severityThreshold) {
      const minRank = SEVERITY_RANK[options.severityThreshold] ?? 1;
      alerts = alerts.filter((a) => (SEVERITY_RANK[a.severity] ?? 0) >= minRank);
    }
    alerts.sort((a, b) => (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0));

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

  async detectDuplicatePayments(txns: any[]): Promise<AnomalyAlertResult[]> {
    const alerts: AnomalyAlertResult[] = [];
    for (let i = 0; i < txns.length; i++) {
      for (let j = i + 1; j < txns.length; j++) {
        const a = txns[i],
          b = txns[j];
        if (a.amount >= 0 || b.amount >= 0) continue;
        if (!fuzzyAmountMatch(a.amount, b.amount, 1)) continue;
        const daysDiff = daysBetween(a.date, b.date);
        if (daysDiff > 3) continue;
        const merchantSim = merchantSimilarity(
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

  async detectAmountAnomalies(txns: any[], category?: string): Promise<AnomalyAlertResult[]> {
    const alerts: AnomalyAlertResult[] = [];
    const grouped = new Map<string, any[]>();
    for (const tx of txns) {
      const cat = category ?? tx.category ?? 'uncategorized';
      if (category && tx.category !== category) continue;
      const list = grouped.get(cat) ?? [];
      list.push(tx);
      grouped.set(cat, list);
    }
    for (const [cat, catTxns] of grouped) {
      if (catTxns.length < 5) continue;
      const amounts = catTxns.map((t: any) => Math.abs(t.amount));
      const stats = calculateStats(amounts);
      if (stats.stdDev === 0) continue;
      for (const tx of catTxns) {
        const absAmount = Math.abs(tx.amount);
        const zScore = (absAmount - stats.mean) / stats.stdDev;
        if (zScore > 3) {
          alerts.push({
            id: crypto.randomUUID(),
            alertType: 'amount_anomaly',
            severity: zScore > 5 ? 'critical' : 'high',
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

  async detectVelocitySpikes(txns: any[], windowDays = 7): Promise<AnomalyAlertResult[]> {
    const alerts: AnomalyAlertResult[] = [];
    if (txns.length < 10) return alerts;

    const dateGroups = new Map<string, any[]>();
    for (const tx of txns) {
      const list = dateGroups.get(tx.date) ?? [];
      list.push(tx);
      dateGroups.set(tx.date, list);
    }
    const sortedDates = [...dateGroups.keys()].sort();
    if (sortedDates.length < windowDays * 2) return alerts;

    const windowCounts: number[] = [];
    for (let i = 0; i <= sortedDates.length - windowDays; i++) {
      let count = 0;
      for (let j = i; j < i + windowDays && j < sortedDates.length; j++)
        count += dateGroups.get(sortedDates[j])?.length ?? 0;
      windowCounts.push(count);
    }
    if (windowCounts.length === 0) return alerts;
    const avgCount = windowCounts.reduce((s, c) => s + c, 0) / windowCounts.length;

    for (let i = 0; i < windowCounts.length; i++) {
      const ratio = avgCount > 0 ? windowCounts[i] / avgCount : 0;
      if (ratio > 2) {
        const windowStart = sortedDates[i];
        const windowEnd = sortedDates[Math.min(i + windowDays - 1, sortedDates.length - 1)];
        alerts.push({
          id: crypto.randomUUID(),
          alertType: 'velocity_spike',
          severity: ratio > 3 ? 'high' : 'medium',
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

    const txnsWithTime = txns.filter((t: any) => t.date && t.date.includes('T'));
    for (let i = 1; i < txnsWithTime.length; i++) {
      const diffMin =
        (new Date(txnsWithTime[i].date).getTime() - new Date(txnsWithTime[i - 1].date).getTime()) /
        60000;
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

  async detectCategoryDrift(userId: string, months = 6): Promise<AnomalyAlertResult[]> {
    return detectCategoryDrift(userId, months);
  }

  async detectUnusualMerchant(txns: any[]): Promise<AnomalyAlertResult[]> {
    const alerts: AnomalyAlertResult[] = [];
    const merchantCounts = new Map<string, number>();
    const merchantTxnMap = new Map<string, any[]>();

    for (const tx of txns) {
      const merchant = (tx.merchantNormalized ?? tx.description ?? '').toLowerCase().trim();
      if (!merchant) continue;
      merchantCounts.set(merchant, (merchantCounts.get(merchant) ?? 0) + 1);
      const list = merchantTxnMap.get(merchant) ?? [];
      list.push(tx);
      merchantTxnMap.set(merchant, list);
    }

    for (const [merchant, count] of merchantCounts) {
      const merchantTxList = merchantTxnMap.get(merchant) ?? [];
      if (count === 1) {
        const tx = merchantTxList[0];
        const absAmount = Math.abs(tx.amount);
        alerts.push({
          id: crypto.randomUUID(),
          alertType: 'unusual_merchant',
          severity: absAmount > 50000 ? 'medium' : 'low',
          title:
            absAmount > 50000
              ? `First-time high-value merchant: ${merchant}`
              : `New merchant: ${merchant}`,
          description:
            absAmount > 50000
              ? `First transaction of $${(absAmount / 100).toFixed(2)} with ${merchant}.`
              : `First-time transaction with ${merchant} for $${(absAmount / 100).toFixed(2)}.`,
          details: { merchant, amount: tx.amount, date: tx.date },
          transactionId: tx.id,
          accountId: tx.accountId,
        });
      } else if (count >= 3) {
        const amounts = merchantTxList.map((t: any) => Math.abs(t.amount));
        const stats = calculateStats(amounts);
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

  async detectScheduleDeviation(userId: string): Promise<AnomalyAlertResult[]> {
    return detectScheduleDeviation(userId);
  }

  private _alerts = new AlertManagement();

  async getAlerts(userId: string, filters?: AlertFilters): Promise<any[]> {
    return this._alerts.getAlerts(userId, filters);
  }

  async acknowledgeAlert(alertId: string): Promise<void> {
    return this._alerts.acknowledgeAlert(alertId);
  }

  async resolveAlert(alertId: string, resolvedBy: string): Promise<void> {
    return this._alerts.resolveAlert(alertId, resolvedBy);
  }

  async dismissAlert(alertId: string, reason: string): Promise<void> {
    return this._alerts.dismissAlert(alertId, reason);
  }

  async getAlertStats(userId: string): Promise<AlertStats> {
    return this._alerts.getAlertStats(userId);
  }
}
