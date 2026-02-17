/**
 * Cash flow forecast projections — math engine for period projection.
 *
 * Called by forecast-service.ts as:
 *   projectPeriods(periodData, options.type, options.granularity, { startDate, endDate, confidenceLevel })
 *
 * Where periodData is a Map<string, { inflow: number; outflow: number }>.
 */
import type { ForecastPeriodResult } from './types.js';

interface ProjectionOptions {
  startDate: string;
  endDate: string;
  confidenceLevel: number;
}

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

  // Convert map values to arrays for aggregation
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
