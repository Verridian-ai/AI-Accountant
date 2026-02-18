// ============================================================================
// FORECAST & TAX SCANNERS — forecast deviations + tax opportunities
// ============================================================================

import {
  db,
  transactions,
  forecastScenarios,
  forecastPeriods,
  taxYearSummary,
} from '../../schema.js';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';
import { buildInsight } from './insight-helpers.js';
import type { CrossModuleInsight, TimeRange } from './types.js';
import type { ForecastScenarioRow, ForecastPeriodRow, TaxYearSummaryRow } from './db-types.js';

/**
 * Find when forecasts diverge from actual data.
 */
export async function scanForecastDeviations(
  userId: string,
  timeRange: TimeRange,
): Promise<CrossModuleInsight[]> {
  const insights: CrossModuleInsight[] = [];

  try {
    const scenarios: ForecastScenarioRow[] = await db
      .select()
      .from(forecastScenarios)
      .where(and(eq(forecastScenarios.userId, userId), eq(forecastScenarios.status, 'active')))
      .all();

    if (scenarios.length === 0) return insights;

    for (const scenario of scenarios) {
      const periods: ForecastPeriodRow[] = await db
        .select()
        .from(forecastPeriods)
        .where(eq(forecastPeriods.scenarioId, scenario.id))
        .all();

      if (periods.length === 0) continue;

      const actuals: Array<{ month: string; total: number }> = await db
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

      const actualMap = new Map(actuals.map((a) => [a.month, Number(a.total ?? 0)]));
      let deviations = 0;
      let totalDeviation = 0;

      for (const period of periods) {
        const forecastAmt = period.forecastAmount ?? 0;
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

/**
 * Discover tax optimization opportunities from cross-module data.
 */
export async function scanTaxOpportunities(
  userId: string,
  timeRange: TimeRange,
): Promise<CrossModuleInsight[]> {
  const insights: CrossModuleInsight[] = [];

  try {
    const taxSummaries: TaxYearSummaryRow[] = await db
      .select()
      .from(taxYearSummary)
      .where(eq(taxYearSummary.userId, userId))
      .orderBy(desc(taxYearSummary.taxYear))
      .all();

    if (taxSummaries.length === 0) return insights;

    const latestTax = taxSummaries[0];
    const grossIncome = latestTax.grossIncome ?? 0;
    const totalDeductions = latestTax.totalDeductions ?? 0;
    const deductionRatio = grossIncome > 0 ? totalDeductions / grossIncome : 0;

    if (deductionRatio < 0.15 && grossIncome > 5000000) {
      const expenseResult = await db
        .select({ total: sql`sum(abs(${transactions.amount}))` })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            sql`${transactions.amount} < 0`,
            gte(transactions.date, timeRange.start),
            lte(transactions.date, timeRange.end),
          ),
        )
        .get();

      const expenseTotal = Number(expenseResult?.total ?? 0);

      if (expenseTotal > totalDeductions * 1.5) {
        insights.push(
          buildInsight(
            'tax_opportunity',
            'Potential unclaimed deductions detected',
            `Deduction ratio (${(deductionRatio * 100).toFixed(1)}%) is below typical benchmarks. Expenses ($${(expenseTotal / 100).toFixed(2)}) exceed claimed deductions ($${(totalDeductions / 100).toFixed(2)}).`,
            {
              deductionRatio: Math.round(deductionRatio * 10000) / 100,
              grossIncome,
              totalDeductions,
              totalExpenses: expenseTotal,
            },
            ['tax', 'transactions'],
            0.7,
            'suggestion',
            userId,
            timeRange,
            'Review uncategorized expenses for potential business deductions including depreciation, home office, and vehicle claims.',
          ),
        );
      }
    }

    // EOFY approaching (April-June)
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    if (currentMonth >= 4 && currentMonth <= 6) {
      insights.push(
        buildInsight(
          'tax_opportunity',
          'EOFY approaching — time for tax planning',
          'The Australian financial year ends June 30. Review deductions, prepay expenses, and manage capital gains/losses.',
          {
            daysUntilEofy: Math.ceil(
              (new Date(now.getFullYear(), 5, 30).getTime() - now.getTime()) / 86_400_000,
            ),
            currentMonth,
          },
          ['tax', 'compliance', 'transactions'],
          0.85,
          'suggestion',
          userId,
          timeRange,
          'Prepay insurance/subscriptions, purchase needed assets, defer income where legal, and gather deduction evidence.',
        ),
      );
    }
  } catch {
    /* scanner failure */
  }

  return insights;
}
