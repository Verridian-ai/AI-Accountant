/**
 * Cross-Module Intelligence — Forecast Deviation Scanner
 *
 * Finds when forecasts diverge from actual transaction data.
 */

import { db, transactions, forecastScenarios, forecastPeriods } from '../../../schema.js';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import type { CrossModuleInsight, TimeRange } from '../types.js';
import { buildInsight } from '../helpers.js';

export async function scanForecastDeviations(
  userId: string,
  timeRange: TimeRange,
): Promise<CrossModuleInsight[]> {
  const insights: CrossModuleInsight[] = [];

  try {
    const scenarios: any[] = await (db as any)
      .select()
      .from(forecastScenarios)
      .where(and(eq(forecastScenarios.userId, userId), eq(forecastScenarios.status, 'active')))
      .all();

    if (scenarios.length === 0) return insights;

    for (const scenario of scenarios) {
      const periods: any[] = await (db as any)
        .select()
        .from(forecastPeriods)
        .where(eq(forecastPeriods.scenarioId, scenario.id))
        .all();

      if (periods.length === 0) continue;

      const actuals: any[] = await (db as any)
        .select({
          month: sql`substr(${transactions.date}, 1, 7)`,
          total: sql`sum(${transactions.amount})`,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            gte(transactions.date, timeRange.start),
            lte(transactions.date, timeRange.end),
          ),
        )
        .groupBy(sql`substr(${transactions.date}, 1, 7)`)
        .all();

      const actualMap = new Map(actuals.map((a: any) => [a.month, Number(a.total ?? 0)]));
      let deviations = 0;
      let totalDeviation = 0;

      for (const period of periods) {
        const forecastAmt = period.forecastAmount ?? period.forecast_amount ?? 0;
        const actual = actualMap.get(period.period);
        if (actual == null || forecastAmt === 0) continue;

        const deviation = Math.abs((actual - forecastAmt) / forecastAmt);
        if (deviation > 0.25) {
          deviations++;
          totalDeviation += deviation;
        }
      }

      if (deviations >= 2) {
        const avgDeviation = totalDeviation / deviations;
        insights.push(
          buildInsight(
            'forecast_deviation',
            `Forecast "${scenario.name}" diverging from reality`,
            `${deviations} periods show >25% deviation (avg ${(avgDeviation * 100).toFixed(1)}% off). Consider updating assumptions.`,
            {
              scenarioId: scenario.id,
              scenarioName: scenario.name,
              deviationCount: deviations,
              averageDeviation: Math.round(avgDeviation * 10000) / 100,
            },
            ['forecasting', 'transactions'],
            Math.min(0.6 + deviations * 0.08, 0.95),
            avgDeviation > 0.5 ? 'warning' : 'suggestion',
            userId,
            timeRange,
            'Review forecast assumptions and update the scenario with current data.',
          ),
        );
      }
    }
  } catch {
    /* scanner failure */
  }

  return insights;
}
