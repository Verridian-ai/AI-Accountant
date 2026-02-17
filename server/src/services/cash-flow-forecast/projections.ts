/**
 * Cash flow forecast projections — math engine for period projection.
 *
 * Extracted from CashFlowForecastService private methods in the monolith.
 */
import type { ForecastPeriodResult } from './types.js';

interface ProjectionOptions {
  startDate: string;
  endDate: string;
  confidenceLevel: number;
}

// ---------------------------------------------------------------------------
// LINEAR REGRESSION
// ---------------------------------------------------------------------------

/** Standard least-squares linear regression. Data points indexed by position (0, 1, 2...). */
export function linearRegression(dataPoints: number[]): {
  slope: number;
  intercept: number;
  r2: number;
} {
  const n = dataPoints.length;
  if (n === 0) return { slope: 0, intercept: 0, r2: 0 };
  if (n === 1) return { slope: 0, intercept: dataPoints[0], r2: 1 };

  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumXX = 0;
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

  const yMean = sumY / n;
  let ssTot = 0,
    ssRes = 0;
  for (let i = 0; i < n; i++) {
    ssTot += (dataPoints[i] - yMean) ** 2;
    const predicted = intercept + slope * i;
    ssRes += (dataPoints[i] - predicted) ** 2;
  }
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;

  return { slope, intercept, r2 };
}

// ---------------------------------------------------------------------------
// SEASONAL DECOMPOSITION
// ---------------------------------------------------------------------------

/** Classical additive decomposition: Y = Trend + Seasonal + Residual. */
export function seasonalDecompose(
  dataPoints: number[],
  periodLength: number,
): { trend: number[]; seasonal: number[]; residual: number[] } {
  const n = dataPoints.length;

  if (n < periodLength || periodLength < 2) {
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

  // Step 3: Seasonal indices
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

  // Normalize seasonal so it sums to ~0
  const seasonalMean = seasonal.reduce((s, v) => s + v, 0) / periodLength;
  for (let i = 0; i < periodLength; i++) {
    seasonal[i] -= seasonalMean;
  }

  // Step 4: Residual
  const residual = dataPoints.map((v, i) => v - trend[i] - seasonal[i % periodLength]);

  return { trend, seasonal, residual };
}

// ---------------------------------------------------------------------------
// CONFIDENCE BANDS
// ---------------------------------------------------------------------------

/** Z-score based confidence bands. */
export function calculateConfidenceBands(
  predicted: number,
  stdDev: number,
  confidence: number,
): { lower: number; upper: number } {
  const zScores: Record<string, number> = {
    '0.80': 1.28,
    '0.85': 1.44,
    '0.90': 1.645,
    '0.95': 1.96,
    '0.99': 2.576,
  };
  const key = confidence.toFixed(2);
  const z = zScores[key] ?? 1.96;

  return {
    lower: predicted - z * stdDev,
    upper: predicted + z * stdDev,
  };
}

// ---------------------------------------------------------------------------
// RECENT TREND
// ---------------------------------------------------------------------------

/** Predict using recent trend (last 3 periods average rate of change). */
export function recentTrendPredict(series: number[], targetIdx: number): number {
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

// ---------------------------------------------------------------------------
// PERIOD UTILITIES
// ---------------------------------------------------------------------------

/** Get the cycle length for seasonal decomposition based on granularity. */
export function getPeriodLength(granularity: string): number {
  switch (granularity) {
    case 'daily':
      return 30;
    case 'weekly':
      return 52;
    case 'monthly':
      return 12;
    case 'quarterly':
      return 4;
    default:
      return 12;
  }
}

/** Generate period boundary pairs (start, end) between startDate and endDate. */
export function generatePeriodBoundaries(
  startDate: string,
  endDate: string,
  granularity: string,
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
        periodEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
        break;
      case 'quarterly':
        periodEnd = new Date(current.getFullYear(), current.getMonth() + 3, 0);
        break;
      default:
        periodEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
    }

    if (periodEnd > end) periodEnd = end;

    periods.push({
      start: current.toISOString().slice(0, 10),
      end: periodEnd.toISOString().slice(0, 10),
    });

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

// ---------------------------------------------------------------------------
// LEGACY projectPeriods (kept for backward compat)
// ---------------------------------------------------------------------------

/**
 * Project future cash-flow periods from historical aggregated data.
 */
export function projectPeriods(
  historicalData: Map<string, { inflow: number; outflow: number }>,
  _modelType: string,
  granularity: string,
  options: ProjectionOptions,
): ForecastPeriodResult[] {
  if (historicalData.size === 0) return [];

  const values = Array.from(historicalData.values());
  const avgInflow = values.reduce((s, b) => s + b.inflow, 0) / values.length;
  const avgOutflow = values.reduce((s, b) => s + b.outflow, 0) / values.length;
  const avgNet = avgInflow - avgOutflow;

  const start = new Date(options.startDate);
  const end = new Date(options.endDate);
  const results: ForecastPeriodResult[] = [];
  const confidence = options.confidenceLevel;

  const cursor = new Date(start);
  while (cursor < end) {
    const periodStart = cursor.toISOString().slice(0, 10);
    const next = new Date(cursor);

    switch (granularity) {
      case 'daily':
        next.setDate(next.getDate() + 1);
        break;
      case 'weekly':
        next.setDate(next.getDate() + 7);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        break;
      case 'quarterly':
        next.setMonth(next.getMonth() + 3);
        break;
    }

    const periodEnd = next.toISOString().slice(0, 10);
    const margin = (1 - confidence) * Math.abs(avgInflow);

    results.push({
      periodStart,
      periodEnd,
      predictedInflow: Math.round(avgInflow),
      predictedOutflow: Math.round(avgOutflow),
      predictedNet: Math.round(avgNet),
      confidenceLower: Math.round(avgNet - margin),
      confidenceUpper: Math.round(avgNet + margin),
    });

    cursor.setTime(next.getTime());
  }

  return results;
}
