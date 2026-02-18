// ============================================================================
// MODULE METRICS — Time-series metric fetchers per module
// ============================================================================

import {
  db,
  transactions,
  taxYearSummary,
  basCalculations,
  kpiMetrics,
  forecastScenarios,
  forecastPeriods,
} from '../../schema.js';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import type { TimeRange } from './types.js';
import type {
  TaxYearSummaryRow,
  BasCalculationRow,
  KpiMetricRow,
  ForecastScenarioRow,
  ForecastPeriodRow,
} from './db-types.js';

/**
 * Fetch time-series metrics from a specific module for correlation analysis.
 */
export async function getModuleMetrics(
  userId: string,
  module: string,
  timeRange: TimeRange,
): Promise<Record<string, number[]>> {
  const metrics: Record<string, number[]> = {};

  try {
    switch (module) {
      case 'transactions': {
        interface TxMonthlyMetric {
          month: string;
          totalIncome: number;
          totalExpense: number;
          netFlow: number;
          txCount: number;
          avgAmount: number;
          total_income?: number;
          total_expense?: number;
          net_flow?: number;
          tx_count?: number;
          avg_amount?: number;
        }
        const monthly: TxMonthlyMetric[] = await db
          .select({
            month: sql`substr(${transactions.date}, 1, 7)`,
            totalIncome: sql`sum(case when ${transactions.amount} > 0 then ${transactions.amount} else 0 end)`,
            totalExpense: sql`sum(case when ${transactions.amount} < 0 then abs(${transactions.amount}) else 0 end)`,
            netFlow: sql`sum(${transactions.amount})`,
            txCount: sql`count(*)`,
            avgAmount: sql`avg(abs(${transactions.amount}))`,
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
          .orderBy(sql`substr(${transactions.date}, 1, 7)`)
          .all();

        metrics['income'] = monthly.map((m) => Number(m.totalIncome ?? m.total_income ?? 0));
        metrics['expense'] = monthly.map((m) => Number(m.totalExpense ?? m.total_expense ?? 0));
        metrics['net_flow'] = monthly.map((m) => Number(m.netFlow ?? m.net_flow ?? 0));
        metrics['tx_count'] = monthly.map((m) => Number(m.txCount ?? m.tx_count ?? 0));
        metrics['avg_amount'] = monthly.map((m) => Number(m.avgAmount ?? m.avg_amount ?? 0));
        break;
      }

      case 'tax': {
        const summaries: TaxYearSummaryRow[] = await db
          .select()
          .from(taxYearSummary)
          .where(eq(taxYearSummary.userId, userId))
          .orderBy(taxYearSummary.taxYear)
          .all();

        metrics['gross_income'] = summaries.map((s) => Number(s.grossIncome ?? 0));
        metrics['total_deductions'] = summaries.map((s) => Number(s.totalDeductions ?? 0));
        metrics['net_tax'] = summaries.map((s) => Number(s.netTax ?? 0));
        metrics['taxable_income'] = summaries.map((s) => Number(s.taxableIncome ?? 0));
        break;
      }

      case 'bas': {
        const basRows: BasCalculationRow[] = await db.select().from(basCalculations).all();

        metrics['gst_collected'] = basRows.map((b) => Number(b.labelG1 ?? 0));
        metrics['gst_paid'] = basRows.map((b) => Number(b.labelG11 ?? 0));
        metrics['amount_owing'] = basRows.map((b) => Number(b.amountOwing ?? 0));
        break;
      }

      case 'analytics': {
        const kpis: KpiMetricRow[] = await db
          .select()
          .from(kpiMetrics)
          .where(
            and(
              eq(kpiMetrics.userId, userId),
              gte(kpiMetrics.period, timeRange.start.slice(0, 7)),
              lte(kpiMetrics.period, timeRange.end.slice(0, 7)),
            ),
          )
          .orderBy(kpiMetrics.period)
          .all();

        const metricGroups = new Map<string, number[]>();
        for (const kpi of kpis) {
          const name = kpi.metricName;
          if (!metricGroups.has(name)) metricGroups.set(name, []);
          metricGroups.get(name)!.push(Number(kpi.metricValue ?? 0));
        }
        for (const [name, values] of metricGroups) {
          metrics[name] = values;
        }
        break;
      }

      case 'forecasting': {
        const scenarios: ForecastScenarioRow[] = await db
          .select()
          .from(forecastScenarios)
          .where(eq(forecastScenarios.userId, userId))
          .all();

        for (const sc of scenarios) {
          const periods: ForecastPeriodRow[] = await db
            .select()
            .from(forecastPeriods)
            .where(eq(forecastPeriods.scenarioId, sc.id))
            .all();

          metrics[`forecast_${sc.name ?? 'unnamed'}`] = periods.map((p) =>
            Number(p.forecastAmount ?? 0),
          );
        }
        break;
      }

      default:
        break;
    }
  } catch {
    /* module metrics unavailable */
  }

  return metrics;
}
