/**
 * Cash Flow Forecast Service
 * Multi-model cash flow forecasting engine with linear regression,
 * seasonal decomposition, and ML-weighted ensemble methods.
 */

import { db, transactions, cashFlowForecasts, cashFlowForecastPeriods } from '../schema.js';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import crypto from 'crypto';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ForecastOptions {
  type: 'linear' | 'seasonal' | 'ml_weighted';
  startDate: string;
  endDate: string;
  granularity: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  confidenceLevel?: number;
  categoryBreakdown?: boolean;
}

export interface ForecastPeriodResult {
  periodStart: string;
  periodEnd: string;
  predictedInflow: number;
  predictedOutflow: number;
  predictedNet: number;
  confidenceLower: number;
  confidenceUpper: number;
  breakdown?: Record<string, number>;
}

export interface AccuracyMetrics {
  mae: number;
  rmse: number;
  mape: number;
  directionAccuracy: number;
  periodsEvaluated: number;
}

export interface ForecastComparison {
  forecasts: Array<{ id: string; type: string; accuracy: AccuracyMetrics }>;
  recommendation: string;
  periodDeltas: Array<{ period: string; values: Record<string, number> }>;
}

// ============================================================================
// CASH FLOW FORECAST SERVICE
// ============================================================================

export class CashFlowForecastService {

  // --------------------------------------------------------------------------
  // Public Methods
  // --------------------------------------------------------------------------

  /**
   * Generate a forecast from historical transactions.
   * Fetches 12-24 months of data, runs the selected model, persists results.
   */
  async generateForecast(
    userId: string,
    accountId: string | null,
    options: ForecastOptions
  ) {
    const now = new Date().toISOString();
    const forecastId = crypto.randomUUID();
    const confidence = options.confidenceLevel ?? 0.85;

    // Determine how far back to look for historical data (up to 24 months before startDate)
    const start = new Date(options.startDate);
    const historyStart = new Date(start);
    historyStart.setMonth(historyStart.getMonth() - 24);
    const historyStartStr = historyStart.toISOString().slice(0, 10);
    // Historical end is the day before the forecast start
    const historyEnd = new Date(start);
    historyEnd.setDate(historyEnd.getDate() - 1);
    const historyEndStr = historyEnd.toISOString().slice(0, 10);

    // Fetch historical transactions
    const conditions = [
      eq(transactions.userId, userId),
      gte(transactions.date, historyStartStr),
      lte(transactions.date, historyEndStr),
    ];
    if (accountId) {
      conditions.push(eq(transactions.accountId, accountId));
    }

    const historicalTx = await db
      .select({
        date: transactions.date,
        amount: transactions.amount,
        category: transactions.category,
      })
      .from(transactions)
      .where(and(...conditions))
      .all();

    // Aggregate into periods
    const periodData = this._aggregateTransactionsByPeriod(historicalTx, options.granularity);

    // Project future periods
    const periods = this.projectPeriods(periodData, options.type, options.granularity, {
      startDate: options.startDate,
      endDate: options.endDate,
      confidenceLevel: confidence,
    });

    // Build category breakdown if requested
    let categoryBreakdowns: Map<string, Record<string, number>> | undefined;
    if (options.categoryBreakdown) {
      categoryBreakdowns = this._buildCategoryBreakdowns(historicalTx, options.granularity, periods);
    }

    // Persist the forecast
    await db.insert(cashFlowForecasts).values({
      id: forecastId,
      userId,
      accountId,
      name: `${options.type} forecast (${options.granularity})`,
      forecastType: options.type,
      startDate: options.startDate,
      endDate: options.endDate,
      granularity: options.granularity,
      confidenceLevel: confidence,
      parameters: JSON.stringify({
        historyStart: historyStartStr,
        historyEnd: historyEndStr,
        transactionCount: historicalTx.length,
        periodsAnalyzed: periodData.size,
        categoryBreakdown: options.categoryBreakdown ?? false,
      }),
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });

    // Persist each period
    for (const period of periods) {
      const breakdown = categoryBreakdowns?.get(period.periodStart);
      await db.insert(cashFlowForecastPeriods).values({
        id: crypto.randomUUID(),
        forecastId,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        predictedInflow: period.predictedInflow,
        predictedOutflow: period.predictedOutflow,
        predictedNet: period.predictedNet,
        confidenceLower: period.confidenceLower,
        confidenceUpper: period.confidenceUpper,
        breakdown: breakdown ? JSON.stringify(breakdown) : null,
        createdAt: now,
      });
    }

    return {
      id: forecastId,
      userId,
      accountId,
      forecastType: options.type,
      startDate: options.startDate,
      endDate: options.endDate,
      granularity: options.granularity,
      confidenceLevel: confidence,
      status: 'active',
      periods,
    };
  }

  /**
   * Generate per-period predictions from historical period data.
   */
  projectPeriods(
    periodData: Map<string, { inflow: number; outflow: number }>,
    model: 'linear' | 'seasonal' | 'ml_weighted',
    granularity: string,
    opts: { startDate: string; endDate: string; confidenceLevel: number }
  ): ForecastPeriodResult[] {
    // Sort historical periods chronologically
    const sortedKeys = Array.from(periodData.keys()).sort();
    const inflowSeries = sortedKeys.map(k => periodData.get(k)!.inflow);
    const outflowSeries = sortedKeys.map(k => periodData.get(k)!.outflow);
    const netSeries = inflowSeries.map((v, i) => v - outflowSeries[i]);

    // Generate future period boundaries
    const futurePeriods = this._generatePeriodBoundaries(opts.startDate, opts.endDate, granularity);

    // Calculate standard deviation of net series for confidence bands
    const netMean = netSeries.length > 0
      ? netSeries.reduce((s, v) => s + v, 0) / netSeries.length
      : 0;
    const netVariance = netSeries.length > 1
      ? netSeries.reduce((s, v) => s + (v - netMean) ** 2, 0) / (netSeries.length - 1)
      : 0;
    const netStdDev = Math.sqrt(netVariance);

    const results: ForecastPeriodResult[] = [];
    const n = sortedKeys.length;

    for (let i = 0; i < futurePeriods.length; i++) {
      const idx = n + i; // prediction index beyond historical data
      let predictedInflow: number;
      let predictedOutflow: number;
      let predictedNet: number;

      switch (model) {
        case 'linear': {
          const inflowReg = this._linearRegression(inflowSeries);
          const outflowReg = this._linearRegression(outflowSeries);
          predictedInflow = Math.max(0, inflowReg.intercept + inflowReg.slope * idx);
          predictedOutflow = Math.max(0, outflowReg.intercept + outflowReg.slope * idx);
          predictedNet = predictedInflow - predictedOutflow;
          break;
        }
        case 'seasonal': {
          const periodLen = this._getPeriodLength(granularity);
          const inflowDecomp = this._seasonalDecompose(inflowSeries, periodLen);
          const outflowDecomp = this._seasonalDecompose(outflowSeries, periodLen);

          // Extrapolate trend via linear regression on the trend component
          const inflowTrendReg = this._linearRegression(inflowDecomp.trend);
          const outflowTrendReg = this._linearRegression(outflowDecomp.trend);

          const trendInflow = inflowTrendReg.intercept + inflowTrendReg.slope * idx;
          const trendOutflow = outflowTrendReg.intercept + outflowTrendReg.slope * idx;

          // Apply seasonal index for the corresponding position in the cycle
          const seasonalIdx = idx % periodLen;
          const seasonalInflow = inflowDecomp.seasonal[seasonalIdx] ?? 0;
          const seasonalOutflow = outflowDecomp.seasonal[seasonalIdx] ?? 0;

          predictedInflow = Math.max(0, trendInflow + seasonalInflow);
          predictedOutflow = Math.max(0, trendOutflow + seasonalOutflow);
          predictedNet = predictedInflow - predictedOutflow;
          break;
        }
        case 'ml_weighted': {
          // Weighted ensemble: linear (0.3) + seasonal (0.5) + recent trend (0.2)
          const periodLen = this._getPeriodLength(granularity);

          // Linear component
          const inflowReg = this._linearRegression(inflowSeries);
          const outflowReg = this._linearRegression(outflowSeries);
          const linearInflow = inflowReg.intercept + inflowReg.slope * idx;
          const linearOutflow = outflowReg.intercept + outflowReg.slope * idx;

          // Seasonal component
          const inflowDecomp = this._seasonalDecompose(inflowSeries, periodLen);
          const outflowDecomp = this._seasonalDecompose(outflowSeries, periodLen);
          const inflowTrendReg = this._linearRegression(inflowDecomp.trend);
          const outflowTrendReg = this._linearRegression(outflowDecomp.trend);
          const seasonalIdx = idx % periodLen;
          const seasonalInflow = (inflowTrendReg.intercept + inflowTrendReg.slope * idx)
            + (inflowDecomp.seasonal[seasonalIdx] ?? 0);
          const seasonalOutflow = (outflowTrendReg.intercept + outflowTrendReg.slope * idx)
            + (outflowDecomp.seasonal[seasonalIdx] ?? 0);

          // Recent trend component (last 3 periods average change)
          const recentInflow = this._recentTrendPredict(inflowSeries, idx);
          const recentOutflow = this._recentTrendPredict(outflowSeries, idx);

          // Weighted blend
          predictedInflow = Math.max(0, 0.3 * linearInflow + 0.5 * seasonalInflow + 0.2 * recentInflow);
          predictedOutflow = Math.max(0, 0.3 * linearOutflow + 0.5 * seasonalOutflow + 0.2 * recentOutflow);
          predictedNet = predictedInflow - predictedOutflow;
          break;
        }
        default:
          predictedInflow = 0;
          predictedOutflow = 0;
          predictedNet = 0;
      }

      const { lower, upper } = this._calculateConfidenceBands(
        predictedNet,
        netStdDev,
        opts.confidenceLevel
      );

      results.push({
        periodStart: futurePeriods[i].start,
        periodEnd: futurePeriods[i].end,
        predictedInflow: Math.round(predictedInflow),
        predictedOutflow: Math.round(predictedOutflow),
        predictedNet: Math.round(predictedNet),
        confidenceLower: Math.round(lower),
        confidenceUpper: Math.round(upper),
      });
    }

    return results;
  }

  /**
   * Compare predicted vs actual for periods that have actual data.
   * Returns MAE, RMSE, MAPE, and direction accuracy.
   */
  async calculateAccuracy(forecastId: string): Promise<AccuracyMetrics> {
    const periods = await db
      .select()
      .from(cashFlowForecastPeriods)
      .where(eq(cashFlowForecastPeriods.forecastId, forecastId))
      .all();

    // Only evaluate periods with actual data
    const evaluated = periods.filter((p: any) => p.actualNet !== null && p.actualNet !== undefined);

    if (evaluated.length === 0) {
      return { mae: 0, rmse: 0, mape: 0, directionAccuracy: 0, periodsEvaluated: 0 };
    }

    let sumAbsError = 0;
    let sumSquaredError = 0;
    let sumAbsPctError = 0;
    let directionCorrect = 0;

    for (const p of evaluated as any[]) {
      const predicted = p.predictedNet;
      const actual = p.actualNet;
      const error = predicted - actual;

      sumAbsError += Math.abs(error);
      sumSquaredError += error ** 2;

      if (actual !== 0) {
        sumAbsPctError += Math.abs(error / actual);
      }

      // Direction accuracy: both positive, both negative, or both zero
      if ((predicted >= 0 && actual >= 0) || (predicted < 0 && actual < 0)) {
        directionCorrect++;
      }
    }

    const n = evaluated.length;
    const accuracy: AccuracyMetrics = {
      mae: Math.round(sumAbsError / n),
      rmse: Math.round(Math.sqrt(sumSquaredError / n)),
      mape: parseFloat(((sumAbsPctError / n) * 100).toFixed(2)),
      directionAccuracy: parseFloat((directionCorrect / n).toFixed(4)),
      periodsEvaluated: n,
    };

    // Persist accuracy score to the forecast
    const overallScore = Math.max(0, 1 - accuracy.mape / 100);
    await db
      .update(cashFlowForecasts)
      .set({
        accuracyScore: parseFloat(overallScore.toFixed(4)),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(cashFlowForecasts.id, forecastId));

    return accuracy;
  }

  /**
   * Side-by-side comparison of multiple forecasts with accuracy rankings.
   */
  async compareForecasts(forecastIds: string[]): Promise<ForecastComparison> {
    const forecastResults: ForecastComparison['forecasts'] = [];
    const allPeriodData = new Map<string, Record<string, number>>();

    for (const fid of forecastIds) {
      const forecast = await db
        .select()
        .from(cashFlowForecasts)
        .where(eq(cashFlowForecasts.id, fid))
        .get();
      if (!forecast) continue;

      const accuracy = await this.calculateAccuracy(fid);
      forecastResults.push({
        id: fid,
        type: (forecast as any).forecastType,
        accuracy,
      });

      // Collect period data for deltas
      const periods = await db
        .select()
        .from(cashFlowForecastPeriods)
        .where(eq(cashFlowForecastPeriods.forecastId, fid))
        .orderBy(sql`${cashFlowForecastPeriods.periodStart} ASC`)
        .all();

      for (const p of periods as any[]) {
        const key = p.periodStart;
        if (!allPeriodData.has(key)) {
          allPeriodData.set(key, {});
        }
        allPeriodData.get(key)![fid] = p.predictedNet;
      }
    }

    // Build period deltas
    const periodDeltas = Array.from(allPeriodData.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, values]) => ({ period, values }));

    // Recommendation: pick the forecast with lowest MAPE (if evaluated) or lowest MAE
    let recommendation = 'Insufficient data to recommend a model.';
    const evaluated = forecastResults.filter(f => f.accuracy.periodsEvaluated > 0);
    if (evaluated.length > 0) {
      evaluated.sort((a, b) => a.accuracy.mape - b.accuracy.mape);
      recommendation = `Recommend '${evaluated[0].type}' model (forecast ${evaluated[0].id}) with MAPE ${evaluated[0].accuracy.mape}%.`;
    }

    return { forecasts: forecastResults, recommendation, periodDeltas };
  }

  /**
   * Backfill actual values from real transactions for completed periods.
   */
  async updateActuals(forecastId: string) {
    const forecast = await db
      .select()
      .from(cashFlowForecasts)
      .where(eq(cashFlowForecasts.id, forecastId))
      .get();
    if (!forecast) throw new Error(`Forecast not found: ${forecastId}`);

    const periods = await db
      .select()
      .from(cashFlowForecastPeriods)
      .where(eq(cashFlowForecastPeriods.forecastId, forecastId))
      .all();

    const today = new Date().toISOString().slice(0, 10);
    let updatedCount = 0;

    for (const period of periods as any[]) {
      // Only update periods that have ended
      if (period.periodEnd > today) continue;

      // Fetch actual transactions for this period
      const conditions = [
        eq(transactions.userId, (forecast as any).userId),
        gte(transactions.date, period.periodStart),
        lte(transactions.date, period.periodEnd),
      ];
      if ((forecast as any).accountId) {
        conditions.push(eq(transactions.accountId, (forecast as any).accountId));
      }

      const txns = await db
        .select({ amount: transactions.amount })
        .from(transactions)
        .where(and(...conditions))
        .all();

      let actualInflow = 0;
      let actualOutflow = 0;
      for (const tx of txns as any[]) {
        if (tx.amount >= 0) {
          actualInflow += tx.amount;
        } else {
          actualOutflow += Math.abs(tx.amount);
        }
      }
      const actualNet = actualInflow - actualOutflow;
      const variance = actualNet - period.predictedNet;
      const variancePct = period.predictedNet !== 0
        ? parseFloat(((variance / Math.abs(period.predictedNet)) * 100).toFixed(2))
        : 0;

      await db
        .update(cashFlowForecastPeriods)
        .set({ actualInflow, actualOutflow, actualNet, variance, variancePct })
        .where(eq(cashFlowForecastPeriods.id, period.id));

      updatedCount++;
    }

    await db
      .update(cashFlowForecasts)
      .set({ updatedAt: new Date().toISOString() })
      .where(eq(cashFlowForecasts.id, forecastId));

    return { forecastId, periodsUpdated: updatedCount };
  }

  /**
   * List forecasts for a user, optionally filtered by status.
   */
  async getForecasts(userId: string, status?: string) {
    const conditions = [eq(cashFlowForecasts.userId, userId)];
    if (status) {
      conditions.push(eq(cashFlowForecasts.status, status));
    }

    const forecasts = await db
      .select()
      .from(cashFlowForecasts)
      .where(and(...conditions))
      .orderBy(desc(cashFlowForecasts.createdAt))
      .all();

    return forecasts.map((f: any) => ({
      ...f,
      parameters: typeof f.parameters === 'string' ? JSON.parse(f.parameters) : f.parameters,
    }));
  }

  /**
   * Get a single forecast with all its periods.
   */
  async getForecastById(forecastId: string) {
    const forecast = await db
      .select()
      .from(cashFlowForecasts)
      .where(eq(cashFlowForecasts.id, forecastId))
      .get();

    if (!forecast) return null;

    const periods = await db
      .select()
      .from(cashFlowForecastPeriods)
      .where(eq(cashFlowForecastPeriods.forecastId, forecastId))
      .orderBy(sql`${cashFlowForecastPeriods.periodStart} ASC`)
      .all();

    return {
      ...(forecast as any),
      parameters: typeof (forecast as any).parameters === 'string'
        ? JSON.parse((forecast as any).parameters)
        : (forecast as any).parameters,
      periods: (periods as any[]).map(p => ({
        ...p,
        breakdown: typeof p.breakdown === 'string' ? JSON.parse(p.breakdown) : p.breakdown,
      })),
    };
  }

  /**
   * Archive a forecast (set status to 'archived').
   */
  async archiveForecast(forecastId: string) {
    await db
      .update(cashFlowForecasts)
      .set({ status: 'archived', updatedAt: new Date().toISOString() })
      .where(eq(cashFlowForecasts.id, forecastId));

    return { forecastId, status: 'archived' };
  }

  // --------------------------------------------------------------------------
  // Private Helpers
  // --------------------------------------------------------------------------

  /**
   * Standard least-squares linear regression.
   * Data points indexed by position (0, 1, 2...).
   */
  private _linearRegression(dataPoints: number[]): { slope: number; intercept: number; r2: number } {
    const n = dataPoints.length;
    if (n === 0) return { slope: 0, intercept: 0, r2: 0 };
    if (n === 1) return { slope: 0, intercept: dataPoints[0], r2: 1 };

    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += dataPoints[i];
      sumXY += i * dataPoints[i];
      sumXX += i * i;
    }

    const denom = n * sumXX - sumX * sumX;
    if (denom === 0) return { slope: 0, intercept: sumY / n, r2: 0 };

    const slope = (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;

    // R² calculation
    const yMean = sumY / n;
    let ssTot = 0, ssRes = 0;
    for (let i = 0; i < n; i++) {
      ssTot += (dataPoints[i] - yMean) ** 2;
      const predicted = intercept + slope * i;
      ssRes += (dataPoints[i] - predicted) ** 2;
    }
    const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;

    return { slope, intercept, r2 };
  }

  /**
   * Classical additive decomposition: Y = Trend + Seasonal + Residual.
   * Trend via centered moving average, seasonal via average deviation per position.
   */
  private _seasonalDecompose(
    dataPoints: number[],
    periodLength: number
  ): { trend: number[]; seasonal: number[]; residual: number[] } {
    const n = dataPoints.length;

    if (n < periodLength || periodLength < 2) {
      // Not enough data for seasonal decomposition — fall back to flat
      return {
        trend: [...dataPoints],
        seasonal: new Array(periodLength).fill(0),
        residual: new Array(n).fill(0),
      };
    }

    // Step 1: Centered moving average for trend
    const trend: number[] = new Array(n).fill(0);
    const halfWindow = Math.floor(periodLength / 2);

    for (let i = 0; i < n; i++) {
      if (i < halfWindow || i >= n - halfWindow) {
        // At edges, use the raw value as a fallback
        trend[i] = dataPoints[i];
      } else {
        let sum = 0;
        for (let j = i - halfWindow; j <= i + halfWindow; j++) {
          sum += dataPoints[j];
        }
        trend[i] = sum / (2 * halfWindow + 1);
      }
    }

    // Step 2: Detrended series
    const detrended = dataPoints.map((v, i) => v - trend[i]);

    // Step 3: Seasonal indices — average of detrended values at each position in cycle
    const seasonal = new Array(periodLength).fill(0);
    const counts = new Array(periodLength).fill(0);

    for (let i = 0; i < n; i++) {
      const pos = i % periodLength;
      seasonal[pos] += detrended[i];
      counts[pos]++;
    }
    for (let i = 0; i < periodLength; i++) {
      seasonal[i] = counts[i] > 0 ? seasonal[i] / counts[i] : 0;
    }

    // Normalize seasonal so it sums to ~0 (additive decomposition)
    const seasonalMean = seasonal.reduce((s, v) => s + v, 0) / periodLength;
    for (let i = 0; i < periodLength; i++) {
      seasonal[i] -= seasonalMean;
    }

    // Step 4: Residual
    const residual = dataPoints.map((v, i) => v - trend[i] - seasonal[i % periodLength]);

    return { trend, seasonal, residual };
  }

  /**
   * Z-score based confidence bands.
   */
  private _calculateConfidenceBands(
    predicted: number,
    stdDev: number,
    confidence: number
  ): { lower: number; upper: number } {
    // Z-scores for common confidence levels
    const zScores: Record<string, number> = {
      '0.80': 1.28,
      '0.85': 1.44,
      '0.90': 1.645,
      '0.95': 1.96,
      '0.99': 2.576,
    };
    const key = confidence.toFixed(2);
    const z = zScores[key] ?? 1.96; // default to 95% if unlisted

    return {
      lower: predicted - z * stdDev,
      upper: predicted + z * stdDev,
    };
  }

  /**
   * Group transactions by period key. Inflow = positive amounts, outflow = absolute negative amounts.
   * Amounts are in cents (integer).
   */
  _aggregateTransactionsByPeriod(
    txns: any[],
    granularity: string
  ): Map<string, { inflow: number; outflow: number }> {
    const result = new Map<string, { inflow: number; outflow: number }>();

    for (const tx of txns) {
      const key = this._dateToPeriodKey(tx.date, granularity);
      if (!result.has(key)) {
        result.set(key, { inflow: 0, outflow: 0 });
      }
      const bucket = result.get(key)!;
      if (tx.amount >= 0) {
        bucket.inflow += tx.amount;
      } else {
        bucket.outflow += Math.abs(tx.amount);
      }
    }

    return result;
  }

  /**
   * Convert a date string to a period key.
   */
  private _dateToPeriodKey(dateStr: string, granularity: string): string {
    const d = new Date(dateStr);
    const year = d.getFullYear();
    const month = d.getMonth(); // 0-indexed

    switch (granularity) {
      case 'daily':
        return dateStr.slice(0, 10);
      case 'weekly': {
        // ISO week: find the Monday of this week
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d);
        monday.setDate(diff);
        return `${monday.getFullYear()}-W${String(Math.ceil((monday.getDate() + new Date(monday.getFullYear(), monday.getMonth(), 1).getDay()) / 7)).padStart(2, '0')}`;
      }
      case 'monthly':
        return `${year}-${String(month + 1).padStart(2, '0')}`;
      case 'quarterly': {
        const q = Math.floor(month / 3) + 1;
        return `${year}-Q${q}`;
      }
      default:
        return `${year}-${String(month + 1).padStart(2, '0')}`;
    }
  }

  /**
   * Get the cycle length for seasonal decomposition based on granularity.
   */
  private _getPeriodLength(granularity: string): number {
    switch (granularity) {
      case 'daily': return 30;     // ~monthly cycle
      case 'weekly': return 52;    // annual cycle
      case 'monthly': return 12;   // annual cycle
      case 'quarterly': return 4;  // annual cycle
      default: return 12;
    }
  }

  /**
   * Predict using recent trend (last 3 periods average rate of change).
   */
  private _recentTrendPredict(series: number[], targetIdx: number): number {
    const n = series.length;
    if (n === 0) return 0;
    if (n === 1) return series[0];

    const lookback = Math.min(3, n - 1);
    let totalChange = 0;
    for (let i = n - lookback; i < n; i++) {
      totalChange += series[i] - series[i - 1];
    }
    const avgChange = totalChange / lookback;
    const stepsAhead = targetIdx - (n - 1);
    return series[n - 1] + avgChange * stepsAhead;
  }

  /**
   * Generate period boundary pairs (start, end) between startDate and endDate.
   */
  private _generatePeriodBoundaries(
    startDate: string,
    endDate: string,
    granularity: string
  ): Array<{ start: string; end: string }> {
    const periods: Array<{ start: string; end: string }> = [];
    let current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
      let periodEnd: Date;

      switch (granularity) {
        case 'daily':
          periodEnd = new Date(current);
          break;
        case 'weekly':
          periodEnd = new Date(current);
          periodEnd.setDate(periodEnd.getDate() + 6);
          break;
        case 'monthly':
          periodEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0); // last day of month
          break;
        case 'quarterly':
          periodEnd = new Date(current.getFullYear(), current.getMonth() + 3, 0);
          break;
        default:
          periodEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
      }

      // Clamp to endDate
      if (periodEnd > end) periodEnd = end;

      periods.push({
        start: current.toISOString().slice(0, 10),
        end: periodEnd.toISOString().slice(0, 10),
      });

      // Advance to next period
      switch (granularity) {
        case 'daily':
          current.setDate(current.getDate() + 1);
          break;
        case 'weekly':
          current.setDate(current.getDate() + 7);
          break;
        case 'monthly':
          current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
          break;
        case 'quarterly':
          current = new Date(current.getFullYear(), current.getMonth() + 3, 1);
          break;
        default:
          current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
      }
    }

    return periods;
  }

  /**
   * Build per-category net amounts for each forecast period.
   */
  private _buildCategoryBreakdowns(
    txns: any[],
    granularity: string,
    futurePeriods: ForecastPeriodResult[]
  ): Map<string, Record<string, number>> {
    // Group historical transactions by category → period → net amount
    const catPeriods = new Map<string, Map<string, number>>();
    for (const tx of txns) {
      const cat = tx.category ?? 'Uncategorized';
      const key = this._dateToPeriodKey(tx.date, granularity);
      if (!catPeriods.has(cat)) catPeriods.set(cat, new Map());
      const map = catPeriods.get(cat)!;
      map.set(key, (map.get(key) ?? 0) + tx.amount);
    }

    // For each future period, estimate category breakdown from historical averages
    const result = new Map<string, Record<string, number>>();
    for (const period of futurePeriods) {
      const breakdown: Record<string, number> = {};
      for (const [cat, periodMap] of catPeriods) {
        const values = Array.from(periodMap.values());
        const avg = values.length > 0
          ? Math.round(values.reduce((s, v) => s + v, 0) / values.length)
          : 0;
        if (avg !== 0) breakdown[cat] = avg;
      }
      result.set(period.periodStart, breakdown);
    }

    return result;
  }
}
