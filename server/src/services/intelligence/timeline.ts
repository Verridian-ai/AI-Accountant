/**
 * Cross-Module Intelligence — Unified Timeline Generator
 *
 * Aggregates significant events from transactions, BAS, tax,
 * reconciliation alerts, and KPI deviations into a unified timeline.
 */

import {
  db,
  transactions,
  basPeriods,
  taxYearSummary,
  reconciliationAlerts,
  kpiMetrics,
} from '../../schema.js';
import { eq, and, desc, gte, lte } from 'drizzle-orm';
import type { TimelineEntry, TimeRange } from './types.js';

export async function generateTimeline(
  userId: string,
  timeRange: TimeRange,
): Promise<TimelineEntry[]> {
  const entries: TimelineEntry[] = [];

  // 1. Significant transactions (|amount| > $500)
  try {
    const txRows: any[] = await (db as any)
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          gte(transactions.date, timeRange.start),
          lte(transactions.date, timeRange.end),
        ),
      )
      .orderBy(desc(transactions.date))
      .all();

    for (const tx of txRows) {
      const amt = tx.amount ?? 0;
      if (Math.abs(amt) >= 50000) {
        entries.push({
          date: tx.date,
          module: 'transactions',
          eventType: amt >= 0 ? 'large_credit' : 'large_debit',
          title: `${amt >= 0 ? 'Large credit' : 'Large debit'}: $${(Math.abs(amt) / 100).toFixed(2)}`,
          description: tx.description ?? 'Unknown transaction',
          severity: Math.abs(amt) >= 500000 ? 'warning' : 'info',
          amount: amt,
          metadata: { category: tx.category, accountId: tx.accountId ?? tx.account_id },
        });
      }
    }
  } catch {
    /* skip */
  }

  // 2. BAS events
  try {
    const basRows: any[] = await (db as any)
      .select()
      .from(basPeriods)
      .where(
        and(
          eq(basPeriods.userId, userId),
          gte(basPeriods.startDate, timeRange.start),
          lte(basPeriods.endDate, timeRange.end),
        ),
      )
      .all();

    for (const bp of basRows) {
      const status = bp.status;
      entries.push({
        date: bp.endDate ?? bp.end_date,
        module: 'bas',
        eventType: status === 'lodged' ? 'bas_lodged' : 'bas_period',
        title: `BAS Q${bp.quarter} ${bp.financialYear ?? bp.financial_year}: ${status}`,
        description: `BAS period ${bp.startDate ?? bp.start_date} to ${bp.endDate ?? bp.end_date}`,
        severity: status === 'overdue' ? 'critical' : status === 'draft' ? 'suggestion' : 'info',
        metadata: { periodType: bp.periodType ?? bp.period_type, status },
      });
    }
  } catch {
    /* skip */
  }

  // 3. Tax year summaries
  try {
    const taxRows: any[] = await (db as any)
      .select()
      .from(taxYearSummary)
      .where(eq(taxYearSummary.userId, userId))
      .all();

    for (const ts of taxRows) {
      entries.push({
        date: ts.calculatedAt ?? ts.calculated_at ?? timeRange.end,
        module: 'tax',
        eventType: 'tax_calculation',
        title: `Tax year ${ts.taxYear ?? ts.tax_year}: $${((ts.netTax ?? ts.net_tax ?? 0) / 100).toFixed(2)} net tax`,
        description: `Gross income: $${((ts.grossIncome ?? ts.gross_income ?? 0) / 100).toFixed(2)}, Deductions: $${((ts.totalDeductions ?? ts.total_deductions ?? 0) / 100).toFixed(2)}`,
        severity: 'info',
        amount: ts.netTax ?? ts.net_tax ?? 0,
        metadata: { taxYear: ts.taxYear ?? ts.tax_year },
      });
    }
  } catch {
    /* skip */
  }

  // 4. Reconciliation alerts
  try {
    const alertRows: any[] = await (db as any)
      .select()
      .from(reconciliationAlerts)
      .where(
        and(
          eq(reconciliationAlerts.userId, userId),
          gte(reconciliationAlerts.createdAt, timeRange.start),
        ),
      )
      .all();

    for (const al of alertRows) {
      entries.push({
        date: al.createdAt ?? al.created_at,
        module: 'anomaly_detection',
        eventType: 'reconciliation_alert',
        title: `Reconciliation alert: ${al.alertType ?? al.alert_type}`,
        description: al.description,
        severity: 'warning',
        amount: al.difference,
        metadata: {
          accountId: al.accountId ?? al.account_id,
          isResolved: Boolean(al.isResolved ?? al.is_resolved),
        },
      });
    }
  } catch {
    /* skip */
  }

  // 5. KPI deviations
  try {
    const kpiRows: any[] = await (db as any)
      .select()
      .from(kpiMetrics)
      .where(
        and(
          eq(kpiMetrics.userId, userId),
          gte(kpiMetrics.period, timeRange.start.slice(0, 7)),
          lte(kpiMetrics.period, timeRange.end.slice(0, 7)),
        ),
      )
      .all();

    for (const kpi of kpiRows) {
      const metricName = kpi.metricName ?? kpi.metric_name;
      const metricValue = kpi.metricValue ?? kpi.metric_value;
      const targetValue = kpi.targetValue ?? kpi.target_value;
      if (targetValue && Math.abs(metricValue - targetValue) / Math.abs(targetValue) > 0.2) {
        entries.push({
          date: kpi.period + '-01',
          module: 'analytics',
          eventType: 'kpi_deviation',
          title: `KPI deviation: ${metricName}`,
          description: `Value ${metricValue} vs target ${targetValue}`,
          severity: 'suggestion',
          metadata: { metricName, metricValue, targetValue },
        });
      }
    }
  } catch {
    /* skip */
  }

  entries.sort((a, b) => a.date.localeCompare(b.date));
  return entries;
}
