/**
 * Enhanced Budget Service — Internal Helper Functions
 */

import type { RecurringBill } from './types.js';

/** Calculate median of a sorted number array */
export function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  }
  return sorted[mid];
}

/** Simple linear regression: returns { slope, intercept } */
export function linearRegression(xs: number[], ys: number[]): { slope: number; intercept: number } {
  const n = xs.length;
  if (n < 2) return { slope: 0, intercept: ys[0] ?? 0 };

  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += xs[i];
    sumY += ys[i];
    sumXY += xs[i] * ys[i];
    sumX2 += xs[i] * xs[i];
  }

  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n };

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

/** Standard deviation */
export function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/** Detect frequency from an array of sorted ISO date strings */
export function detectFrequency(dates: string[]): RecurringBill['frequency'] | null {
  if (dates.length < 2) return null;

  const intervals: number[] = [];
  for (let i = 1; i < dates.length; i++) {
    const d1 = new Date(dates[i - 1]).getTime();
    const d2 = new Date(dates[i]).getTime();
    intervals.push((d2 - d1) / (1000 * 60 * 60 * 24));
  }

  const avgInterval = intervals.reduce((s, v) => s + v, 0) / intervals.length;
  const cv = stdDev(intervals) / (avgInterval || 1); // coefficient of variation

  // Only classify if relatively regular (CV < 0.4)
  if (cv > 0.4) return null;

  if (avgInterval <= 9) return 'weekly';
  if (avgInterval <= 18) return 'fortnightly';
  if (avgInterval <= 45) return 'monthly';
  if (avgInterval <= 120) return 'quarterly';
  if (avgInterval <= 400) return 'annual';
  return null;
}

/** Add days to a date string */
export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + Math.round(days));
  return d.toISOString().slice(0, 10);
}

/** Frequency to average days */
export function frequencyToDays(freq: RecurringBill['frequency']): number {
  switch (freq) {
    case 'weekly':
      return 7;
    case 'fortnightly':
      return 14;
    case 'monthly':
      return 30.44;
    case 'quarterly':
      return 91.31;
    case 'annual':
      return 365.25;
  }
}
