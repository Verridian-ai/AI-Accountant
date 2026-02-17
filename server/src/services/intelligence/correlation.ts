/**
 * Cross-Module Intelligence — Correlation Helpers
 *
 * Pearson correlation coefficient with t-distribution p-value approximation
 * and per-module metric retrieval for correlation analysis.
 */

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

/**
 * Pearson correlation coefficient with t-distribution p-value approximation.
 * Formula: r = sum((xi-xbar)(yi-ybar)) / sqrt(sum(xi-xbar)^2 * sum(yi-ybar)^2)
 * P-value from t = r*sqrt(n-2)/sqrt(1-r^2), using t-distribution CDF.
 */
export function calculatePearsonCorrelation(
  x: number[],
  y: number[],
): { coefficient: number; pValue: number } {
  const n = Math.min(x.length, y.length);
  if (n < 3) return { coefficient: 0, pValue: 1 };

  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;

  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    sumXY += dx * dy;
    sumX2 += dx * dx;
    sumY2 += dy * dy;
  }

  if (sumX2 === 0 || sumY2 === 0) return { coefficient: 0, pValue: 1 };

  const r = sumXY / Math.sqrt(sumX2 * sumY2);
  const rSquared = r * r;

  // t-statistic: t = r * sqrt(n-2) / sqrt(1 - r^2)
  const df = n - 2;
  const t = (r * Math.sqrt(df)) / Math.sqrt(1 - rSquared + 1e-15);

  // Approximate two-tailed p-value
  const pValue = tDistPValue(Math.abs(t), df);

  return {
    coefficient: Math.round(r * 1e10) / 1e10,
    pValue: Math.round(pValue * 1e10) / 1e10,
  };
}

/**
 * Approximate two-tailed p-value from t-distribution.
 * Uses normal approximation for large df, beta function series for small df.
 */
function tDistPValue(t: number, df: number): number {
  if (df > 100) {
    // Normal approximation (Abramowitz & Stegun 26.2.17)
    const x = t / Math.sqrt(2);
    const ax = Math.abs(x);
    const tVal = 1 / (1 + 0.3275911 * ax);
    const poly =
      ((((1.061405429 * tVal - 1.453152027) * tVal + 1.421413741) * tVal - 0.284496736) * tVal +
        0.254829592) *
      tVal;
    const erf = 1 - poly * Math.exp(-ax * ax);
    const normalCdf = 0.5 * (1 + (x >= 0 ? erf : -erf));
    return 2 * (1 - normalCdf);
  }

  // Regularized incomplete beta: p = I_x(df/2, 1/2) where x = df/(df+t^2)
  const xVal = df / (df + t * t);
  const a = df / 2;
  const b = 0.5;
  const lnBeta = lnGamma(a) + lnGamma(b) - lnGamma(a + b);
  const prefix = Math.exp(a * Math.log(xVal) + b * Math.log(1 - xVal) - lnBeta) / a;

  let term = 1;
  let result = 1;
  for (let k = 1; k <= 200; k++) {
    term *= (xVal * (a + b + k - 1) * (a + k - 1)) / ((a + 2 * k - 1) * (a + 2 * k));
    if (!isFinite(term)) break;
    result += term;
    if (Math.abs(term) < 1e-10) break;
  }

  return Math.min(1, Math.max(0, prefix * result));
}

/** Lanczos approximation of the log-gamma function. */
function lnGamma(z: number): number {
  if (z <= 0) return 0;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];

  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
  }

  z -= 1;
  let x = c[0];
  for (let i = 1; i < 9; i++) {
    x += c[i] / (z + i);
  }
  const t = z + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

/** Fetch time-series metrics from a specific module for correlation analysis. */
export async function getModuleMetrics(
  userId: string,
  module: string,
  timeRange: TimeRange,
): Promise<Record<string, number[]>> {
  const metrics: Record<string, number[]> = {};

  try {
    switch (module) {
      case 'transactions': {
        const monthly: Record<string, unknown>[] = await (db as any)
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

        metrics['income'] = monthly.map((m: Record<string, unknown>) =>
          Number(m.totalIncome ?? m.total_income ?? 0),
        );
        metrics['expense'] = monthly.map((m: Record<string, unknown>) =>
          Number(m.totalExpense ?? m.total_expense ?? 0),
        );
        metrics['net_flow'] = monthly.map((m: Record<string, unknown>) =>
          Number(m.netFlow ?? m.net_flow ?? 0),
        );
        metrics['tx_count'] = monthly.map((m: Record<string, unknown>) =>
          Number(m.txCount ?? m.tx_count ?? 0),
        );
        metrics['avg_amount'] = monthly.map((m: Record<string, unknown>) =>
          Number(m.avgAmount ?? m.avg_amount ?? 0),
        );
        break;
      }

      case 'tax': {
        const summaries: Record<string, unknown>[] = await (db as any)
          .select()
          .from(taxYearSummary)
          .where(eq(taxYearSummary.userId, userId))
          .orderBy(taxYearSummary.taxYear)
          .all();

        metrics['gross_income'] = summaries.map((s: Record<string, unknown>) =>
          Number(s.grossIncome ?? s.gross_income ?? 0),
        );
        metrics['total_deductions'] = summaries.map((s: Record<string, unknown>) =>
          Number(s.totalDeductions ?? s.total_deductions ?? 0),
        );
        metrics['net_tax'] = summaries.map((s: Record<string, unknown>) =>
          Number(s.netTax ?? s.net_tax ?? 0),
        );
        metrics['taxable_income'] = summaries.map((s: Record<string, unknown>) =>
          Number(s.taxableIncome ?? s.taxable_income ?? 0),
        );
        break;
      }

      case 'bas': {
        const basRows: Record<string, unknown>[] = await (db as any)
          .select()
          .from(basCalculations)
          .all();

        metrics['gst_collected'] = basRows.map((b: Record<string, unknown>) =>
          Number(b.labelG1 ?? b.label_g1 ?? 0),
        );
        metrics['gst_paid'] = basRows.map((b: Record<string, unknown>) =>
          Number(b.labelG11 ?? b.label_g11 ?? 0),
        );
        metrics['amount_owing'] = basRows.map((b: Record<string, unknown>) =>
          Number(b.amountOwing ?? b.amount_owing ?? 0),
        );
        break;
      }

      case 'analytics': {
        const kpis: Record<string, unknown>[] = await (db as any)
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
          const name = String(kpi.metricName ?? kpi.metric_name ?? '');
          if (!metricGroups.has(name)) metricGroups.set(name, []);
          metricGroups.get(name)!.push(Number(kpi.metricValue ?? kpi.metric_value ?? 0));
        }
        for (const [name, values] of metricGroups) {
          metrics[name] = values;
        }
        break;
      }

      case 'forecasting': {
        const scenarios: Record<string, unknown>[] = await (db as any)
          .select()
          .from(forecastScenarios)
          .where(eq(forecastScenarios.userId, userId))
          .all();

        for (const sc of scenarios) {
          const scenarioId = String(sc.id ?? '');
          const periods: Record<string, unknown>[] = await (db as any)
            .select()
            .from(forecastPeriods)
            .where(eq(forecastPeriods.scenarioId, scenarioId))
            .all();

          metrics[`forecast_${String(sc.name ?? 'unnamed')}`] = periods.map(
            (p: Record<string, unknown>) => Number(p.forecastAmount ?? p.forecast_amount ?? 0),
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
