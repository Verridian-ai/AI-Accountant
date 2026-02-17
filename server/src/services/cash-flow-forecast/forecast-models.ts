/**
 * Forecast Models — Per-period prediction logic for linear, seasonal, and ml_weighted models.
 */

import type { ForecastPeriodResult } from './types.js';
import {
  linearRegression,
  seasonalDecompose,
  recentTrendPredict,
  calculateConfidenceBands,
  getPeriodLength,
  generatePeriodBoundaries,
} from './projections.js';

/**
 * Generate per-period predictions from historical period data.
 */
export function projectPeriods(
  periodData: Map<string, { inflow: number; outflow: number }>,
  model: 'linear' | 'seasonal' | 'ml_weighted',
  granularity: string,
  opts: { startDate: string; endDate: string; confidenceLevel: number },
): ForecastPeriodResult[] {
  const sortedKeys = Array.from(periodData.keys()).sort();
  const inflowSeries = sortedKeys.map((k) => periodData.get(k)!.inflow);
  const outflowSeries = sortedKeys.map((k) => periodData.get(k)!.outflow);
  const netSeries = inflowSeries.map((v, i) => v - outflowSeries[i]);

  const futurePeriods = generatePeriodBoundaries(opts.startDate, opts.endDate, granularity);

  const netMean =
    netSeries.length > 0 ? netSeries.reduce((s, v) => s + v, 0) / netSeries.length : 0;
  const netVariance =
    netSeries.length > 1
      ? netSeries.reduce((s, v) => s + (v - netMean) ** 2, 0) / (netSeries.length - 1)
      : 0;
  const netStdDev = Math.sqrt(netVariance);

  const results: ForecastPeriodResult[] = [];
  const n = sortedKeys.length;

  for (let i = 0; i < futurePeriods.length; i++) {
    const idx = n + i;
    const { predictedInflow, predictedOutflow, predictedNet } = predictForModel(
      model,
      granularity,
      inflowSeries,
      outflowSeries,
      idx,
    );

    const { lower, upper } = calculateConfidenceBands(
      predictedNet,
      netStdDev,
      opts.confidenceLevel,
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

function predictForModel(
  model: string,
  granularity: string,
  inflowSeries: number[],
  outflowSeries: number[],
  idx: number,
): { predictedInflow: number; predictedOutflow: number; predictedNet: number } {
  switch (model) {
    case 'linear': {
      const inflowReg = linearRegression(inflowSeries);
      const outflowReg = linearRegression(outflowSeries);
      const predictedInflow = Math.max(0, inflowReg.intercept + inflowReg.slope * idx);
      const predictedOutflow = Math.max(0, outflowReg.intercept + outflowReg.slope * idx);
      return {
        predictedInflow,
        predictedOutflow,
        predictedNet: predictedInflow - predictedOutflow,
      };
    }
    case 'seasonal': {
      const periodLen = getPeriodLength(granularity);
      const inflowDecomp = seasonalDecompose(inflowSeries, periodLen);
      const outflowDecomp = seasonalDecompose(outflowSeries, periodLen);
      const inflowTrendReg = linearRegression(inflowDecomp.trend);
      const outflowTrendReg = linearRegression(outflowDecomp.trend);
      const trendInflow = inflowTrendReg.intercept + inflowTrendReg.slope * idx;
      const trendOutflow = outflowTrendReg.intercept + outflowTrendReg.slope * idx;
      const seasonalIdx = idx % periodLen;
      const predictedInflow = Math.max(0, trendInflow + (inflowDecomp.seasonal[seasonalIdx] ?? 0));
      const predictedOutflow = Math.max(
        0,
        trendOutflow + (outflowDecomp.seasonal[seasonalIdx] ?? 0),
      );
      return {
        predictedInflow,
        predictedOutflow,
        predictedNet: predictedInflow - predictedOutflow,
      };
    }
    case 'ml_weighted': {
      const periodLen = getPeriodLength(granularity);
      const inflowReg = linearRegression(inflowSeries);
      const outflowReg = linearRegression(outflowSeries);
      const linearInflow = inflowReg.intercept + inflowReg.slope * idx;
      const linearOutflow = outflowReg.intercept + outflowReg.slope * idx;
      const inflowDecomp = seasonalDecompose(inflowSeries, periodLen);
      const outflowDecomp = seasonalDecompose(outflowSeries, periodLen);
      const inflowTrendReg = linearRegression(inflowDecomp.trend);
      const outflowTrendReg = linearRegression(outflowDecomp.trend);
      const seasonalIdx = idx % periodLen;
      const seasonalInflow =
        inflowTrendReg.intercept +
        inflowTrendReg.slope * idx +
        (inflowDecomp.seasonal[seasonalIdx] ?? 0);
      const seasonalOutflow =
        outflowTrendReg.intercept +
        outflowTrendReg.slope * idx +
        (outflowDecomp.seasonal[seasonalIdx] ?? 0);
      const recentInflow = recentTrendPredict(inflowSeries, idx);
      const recentOutflow = recentTrendPredict(outflowSeries, idx);
      const predictedInflow = Math.max(
        0,
        0.3 * linearInflow + 0.5 * seasonalInflow + 0.2 * recentInflow,
      );
      const predictedOutflow = Math.max(
        0,
        0.3 * linearOutflow + 0.5 * seasonalOutflow + 0.2 * recentOutflow,
      );
      return {
        predictedInflow,
        predictedOutflow,
        predictedNet: predictedInflow - predictedOutflow,
      };
    }
    default:
      return { predictedInflow: 0, predictedOutflow: 0, predictedNet: 0 };
  }
}
