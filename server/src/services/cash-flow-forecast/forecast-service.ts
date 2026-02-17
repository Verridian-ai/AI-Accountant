/**
 * Cash Flow Forecast Module — CashFlowForecastService class
 *
 * DB operations for generating, persisting, comparing, and
 * updating cash flow forecasts. Delegates math to projections.ts.
 */

import { db, transactions, cashFlowForecasts, cashFlowForecastPeriods } from '../../schema.js';
import { eq, and, gte, lte, desc, sql, type SQL } from 'drizzle-orm';
import crypto from 'crypto';
import type { ForecastOptions, ForecastPeriodResult, AccuracyMetrics, ForecastComparison } from './types.js';
import { projectPeriods } from './projections.js';

type HistoricalTransaction = Pick<typeof transactions.$inferSelect, 'date' | 'amount' | 'category'>;

export class CashFlowForecastService {
  async generateForecast(userId: string, accountId: string | null, options: ForecastOptions) {
    const now = new Date().toISOString();
    const forecastId = crypto.randomUUID();
    const confidence = options.confidenceLevel ?? 0.85;

    const start = new Date(options.startDate);
    const historyStart = new Date(start);
    historyStart.setMonth(historyStart.getMonth() - 24);
    const historyStartStr = historyStart.toISOString().slice(0, 10);
    const historyEnd = new Date(start);
    historyEnd.setDate(historyEnd.getDate() - 1);
    const historyEndStr = historyEnd.toISOString().slice(0, 10);

    const conditions: SQL<unknown>[] = [
      eq(transactions.userId, userId),
      gte(transactions.date, historyStartStr),
      lte(transactions.date, historyEndStr),
    ];
    if (accountId) {
      conditions.push(eq(transactions.accountId, accountId));
    }

    const historicalTx = await db
      .select({ date: transactions.date, amount: transactions.amount, category: transactions.category })
      .from(transactions)
      .where(and(...conditions))
      .all();

    const periodData = this._aggregateTransactionsByPeriod(historicalTx, options.granularity);

    const periods = projectPeriods(periodData, options.type, options.granularity, {
      startDate: options.startDate, endDate: options.endDate, confidenceLevel: confidence,
    });

    let categoryBreakdowns: Map<string, Record<string, number>> | undefined;
    if (options.categoryBreakdown) {
      categoryBreakdowns = this._buildCategoryBreakdowns(historicalTx, options.granularity, periods);
    }

    await db.insert(cashFlowForecasts).values({
      id: forecastId, userId, accountId,
      name: `${options.type} forecast (${options.granularity})`,
      forecastType: options.type, startDate: options.startDate, endDate: options.endDate,
      granularity: options.granularity, confidenceLevel: confidence,
      parameters: JSON.stringify({
        historyStart: historyStartStr, historyEnd: historyEndStr,
        transactionCount: historicalTx.length, periodsAnalyzed: periodData.size,
        categoryBreakdown: options.categoryBreakdown ?? false,
      }),
      status: 'active', createdAt: now, updatedAt: now,
    });

    for (const period of periods) {
      const breakdown = categoryBreakdowns?.get(period.periodStart);
      await db.insert(cashFlowForecastPeriods).values({
        id: crypto.randomUUID(), forecastId,
        periodStart: period.periodStart, periodEnd: period.periodEnd,
        predictedInflow: period.predictedInflow, predictedOutflow: period.predictedOutflow,
        predictedNet: period.predictedNet, confidenceLower: period.confidenceLower,
        confidenceUpper: period.confidenceUpper,
        breakdown: breakdown ? JSON.stringify(breakdown) : null, createdAt: now,
      });
    }

    return {
      id: forecastId, userId, accountId, forecastType: options.type,
      startDate: options.startDate, endDate: options.endDate,
      granularity: options.granularity, confidenceLevel: confidence, status: 'active', periods,
    };
  }

  async calculateAccuracy(forecastId: string): Promise<AccuracyMetrics> {
    const periods = await db.select().from(cashFlowForecastPeriods)
      .where(eq(cashFlowForecastPeriods.forecastId, forecastId)).all();

    type PeriodWithActual = typeof cashFlowForecastPeriods.$inferSelect & { actualNet: number };
    const evaluated = periods.filter(
      (p: typeof cashFlowForecastPeriods.$inferSelect): p is PeriodWithActual =>
        p.actualNet !== null && p.actualNet !== undefined
    );
    if (evaluated.length === 0) {
      return { mae: 0, rmse: 0, mape: 0, directionAccuracy: 0, periodsEvaluated: 0 };
    }

    let sumAbsError = 0, sumSquaredError = 0, sumAbsPctError = 0, directionCorrect = 0;
    for (const p of evaluated) {
      const error = p.predictedNet - p.actualNet;
      sumAbsError += Math.abs(error);
      sumSquaredError += error ** 2;
      if (p.actualNet !== 0) sumAbsPctError += Math.abs(error / p.actualNet);
      if ((p.predictedNet >= 0 && p.actualNet >= 0) || (p.predictedNet < 0 && p.actualNet < 0)) directionCorrect++;
    }

    const n = evaluated.length;
    const accuracy: AccuracyMetrics = {
      mae: Math.round(sumAbsError / n), rmse: Math.round(Math.sqrt(sumSquaredError / n)),
      mape: parseFloat(((sumAbsPctError / n) * 100).toFixed(2)),
      directionAccuracy: parseFloat((directionCorrect / n).toFixed(4)), periodsEvaluated: n,
    };

    const overallScore = Math.max(0, 1 - accuracy.mape / 100);
    await db.update(cashFlowForecasts)
      .set({ accuracyScore: parseFloat(overallScore.toFixed(4)), updatedAt: new Date().toISOString() })
      .where(eq(cashFlowForecasts.id, forecastId));

    return accuracy;
  }

  async compareForecasts(forecastIds: string[]): Promise<ForecastComparison> {
    const forecastResults: ForecastComparison['forecasts'] = [];
    const allPeriodData = new Map<string, Record<string, number>>();

    for (const fid of forecastIds) {
      const forecast = await db.select().from(cashFlowForecasts).where(eq(cashFlowForecasts.id, fid)).get();
      if (!forecast) continue;
      const accuracy = await this.calculateAccuracy(fid);
      forecastResults.push({ id: fid, type: forecast.forecastType, accuracy });

      const periods = await db.select().from(cashFlowForecastPeriods)
        .where(eq(cashFlowForecastPeriods.forecastId, fid))
        .orderBy(sql`${cashFlowForecastPeriods.periodStart} ASC`).all();

      for (const p of periods) {
        if (!allPeriodData.has(p.periodStart)) allPeriodData.set(p.periodStart, {});
        allPeriodData.get(p.periodStart)![fid] = p.predictedNet;
      }
    }

    const periodDeltas = Array.from(allPeriodData.entries())
      .sort(([a], [b]) => a.localeCompare(b)).map(([period, values]) => ({ period, values }));

    let recommendation = 'Insufficient data to recommend a model.';
    const evaluated = forecastResults.filter((f) => f.accuracy.periodsEvaluated > 0);
    if (evaluated.length > 0) {
      evaluated.sort((a, b) => a.accuracy.mape - b.accuracy.mape);
      recommendation = `Recommend '${evaluated[0].type}' model (forecast ${evaluated[0].id}) with MAPE ${evaluated[0].accuracy.mape}%.`;
    }

    return { forecasts: forecastResults, recommendation, periodDeltas };
  }

  async updateActuals(forecastId: string) {
    const forecast = await db.select().from(cashFlowForecasts).where(eq(cashFlowForecasts.id, forecastId)).get();
    if (!forecast) throw new Error(`Forecast not found: ${forecastId}`);

    const periods = await db.select().from(cashFlowForecastPeriods)
      .where(eq(cashFlowForecastPeriods.forecastId, forecastId)).all();

    const today = new Date().toISOString().slice(0, 10);
    let updatedCount = 0;

    for (const period of periods) {
      if (period.periodEnd > today) continue;
      const conditions: SQL<unknown>[] = [
        eq(transactions.userId, forecast.userId),
        gte(transactions.date, period.periodStart), lte(transactions.date, period.periodEnd),
      ];
      if (forecast.accountId) conditions.push(eq(transactions.accountId, forecast.accountId));

      const txns = await db.select({ amount: transactions.amount }).from(transactions).where(and(...conditions)).all();
      let actualInflow = 0, actualOutflow = 0;
      for (const tx of txns) {
        if (tx.amount >= 0) actualInflow += tx.amount;
        else actualOutflow += Math.abs(tx.amount);
      }
      const actualNet = actualInflow - actualOutflow;
      const variance = actualNet - period.predictedNet;
      const variancePct = period.predictedNet !== 0
        ? parseFloat(((variance / Math.abs(period.predictedNet)) * 100).toFixed(2)) : 0;

      await db.update(cashFlowForecastPeriods)
        .set({ actualInflow, actualOutflow, actualNet, variance, variancePct })
        .where(eq(cashFlowForecastPeriods.id, period.id));
      updatedCount++;
    }

    await db.update(cashFlowForecasts)
      .set({ updatedAt: new Date().toISOString() }).where(eq(cashFlowForecasts.id, forecastId));
    return { forecastId, periodsUpdated: updatedCount };
  }

  async getForecasts(userId: string, status?: string) {
    const conditions: SQL<unknown>[] = [eq(cashFlowForecasts.userId, userId)];
    if (status) conditions.push(eq(cashFlowForecasts.status, status));

    const forecasts = await db.select().from(cashFlowForecasts)
      .where(and(...conditions)).orderBy(desc(cashFlowForecasts.createdAt)).all();

    return forecasts.map((f: typeof cashFlowForecasts.$inferSelect) => ({
      ...f, parameters: typeof f.parameters === 'string' ? JSON.parse(f.parameters) : f.parameters,
    }));
  }

  async getForecastById(forecastId: string) {
    const forecast = await db.select().from(cashFlowForecasts).where(eq(cashFlowForecasts.id, forecastId)).get();
    if (!forecast) return null;

    const periods = await db.select().from(cashFlowForecastPeriods)
      .where(eq(cashFlowForecastPeriods.forecastId, forecastId))
      .orderBy(sql`${cashFlowForecastPeriods.periodStart} ASC`).all();

    return {
      ...forecast,
      parameters: typeof forecast.parameters === 'string'
        ? JSON.parse(forecast.parameters) : forecast.parameters,
      periods: periods.map((p: typeof cashFlowForecastPeriods.$inferSelect) => ({
        ...p, breakdown: typeof p.breakdown === 'string' ? JSON.parse(p.breakdown) : p.breakdown,
      })),
    };
  }

  async archiveForecast(forecastId: string) {
    await db.update(cashFlowForecasts)
      .set({ status: 'archived', updatedAt: new Date().toISOString() })
      .where(eq(cashFlowForecasts.id, forecastId));
    return { forecastId, status: 'archived' };
  }

  _aggregateTransactionsByPeriod(
    txns: HistoricalTransaction[], granularity: string,
  ): Map<string, { inflow: number; outflow: number }> {
    const result = new Map<string, { inflow: number; outflow: number }>();
    for (const tx of txns) {
      const key = this._dateToPeriodKey(tx.date, granularity);
      if (!result.has(key)) result.set(key, { inflow: 0, outflow: 0 });
      const bucket = result.get(key)!;
      if (tx.amount >= 0) bucket.inflow += tx.amount;
      else bucket.outflow += Math.abs(tx.amount);
    }
    return result;
  }

  private _dateToPeriodKey(dateStr: string, granularity: string): string {
    const d = new Date(dateStr);
    const year = d.getFullYear();
    const month = d.getMonth();

    switch (granularity) {
      case 'daily': return dateStr.slice(0, 10);
      case 'weekly': {
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d);
        monday.setDate(diff);
        return `${monday.getFullYear()}-W${String(Math.ceil((monday.getDate() + new Date(monday.getFullYear(), monday.getMonth(), 1).getDay()) / 7)).padStart(2, '0')}`;
      }
      case 'monthly': return `${year}-${String(month + 1).padStart(2, '0')}`;
      case 'quarterly': {
        const q = Math.floor(month / 3) + 1;
        return `${year}-Q${q}`;
      }
      default: return `${year}-${String(month + 1).padStart(2, '0')}`;
    }
  }

  private _buildCategoryBreakdowns(
    txns: HistoricalTransaction[], granularity: string, futurePeriods: ForecastPeriodResult[],
  ): Map<string, Record<string, number>> {
    const catPeriods = new Map<string, Map<string, number>>();
    for (const tx of txns) {
      const cat = tx.category ?? 'Uncategorized';
      const key = this._dateToPeriodKey(tx.date, granularity);
      if (!catPeriods.has(cat)) catPeriods.set(cat, new Map());
      const map = catPeriods.get(cat)!;
      map.set(key, (map.get(key) ?? 0) + tx.amount);
    }

    const result = new Map<string, Record<string, number>>();
    for (const period of futurePeriods) {
      const breakdown: Record<string, number> = {};
      for (const [cat, periodMap] of catPeriods) {
        const values = Array.from(periodMap.values());
        const avg = values.length > 0 ? Math.round(values.reduce((s, v) => s + v, 0) / values.length) : 0;
        if (avg !== 0) breakdown[cat] = avg;
      }
      result.set(period.periodStart, breakdown);
    }
    return result;
  }
}
