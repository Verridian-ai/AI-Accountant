// ============================================================================
// Unified Timeline Generation — extracted from CrossModuleIntelligenceService
// ============================================================================

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
import type {
  TransactionRow,
  BasPeriodRow,
  TaxYearSummaryRow,
  ReconciliationAlertRow,
  KpiMetricRow,
} from './db-types.js';

/**
 * Generate a unified timeline of events across modules.
 */
export async function generateTimeline(
  userId: string,
  timeRange: TimeRange,
): Promise<TimelineEntry[]> {
  const entries: TimelineEntry[] = [];

  // 1. Significant transactions (|amount| > $500)
  try {
    const txRows: TransactionRow[] = await db
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
          metadata: { category: tx.category, accountId: tx.accountId },
        });
      }
    }
  } catch {
    /* skip */
  }

  // 2. BAS events
  try {
    const basRows: BasPeriodRow[] = await db
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
        date: bp.endDate,
        module: 'bas',
        eventType: status === 'lodged' ? 'bas_lodged' : 'bas_period',
        title: `BAS Q${bp.quarter} ${bp.financialYear}: ${status}`,
        description: `BAS period ${bp.startDate} to ${bp.endDate}`,
        severity: status === 'overdue' ? 'critical' : status === 'draft' ? 'suggestion' : 'info',
        metadata: { periodType: bp.periodType, status },
      });
    }
  } catch {
    /* skip */
  }

  // 3. Tax year summaries
  try {
    const taxRows: TaxYearSummaryRow[] = await db
      .select()
      .from(taxYearSummary)
      .where(eq(taxYearSummary.userId, userId))
      .all();

    for (const ts of taxRows) {
      entries.push({
        date: ts.calculatedAt ?? timeRange.end,
        module: 'tax',
        eventType: 'tax_calculation',
        title: `Tax year ${ts.taxYear}: $${((ts.netTax ?? 0) / 100).toFixed(2)} net tax`,
        description: `Gross income: $${((ts.grossIncome ?? 0) / 100).toFixed(2)}, Deductions: $${((ts.totalDeductions ?? 0) / 100).toFixed(2)}`,
        severity: 'info',
        amount: ts.netTax ?? 0,
        metadata: { taxYear: ts.taxYear },
      });
    }
  } catch {
    /* skip */
  }

  // 4. Reconciliation alerts
  try {
    const alertRows: ReconciliationAlertRow[] = await db
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
        date: al.createdAt,
        module: 'anomaly_detection',
        eventType: 'reconciliation_alert',
        title: `Reconciliation alert: ${al.alertType}`,
        description: al.description,
        severity: 'warning',
        amount: al.difference ?? undefined,
        metadata: {
          accountId: al.accountId,
          isResolved: Boolean(al.isResolved),
        },
      });
    }
  } catch {
    /* skip */
  }

  // 5. KPI deviations
  try {
    const kpiRows: KpiMetricRow[] = await db
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
      const metricName = kpi.metricName;
      const metricValue = kpi.metricValue;
      const targetValue = kpi.targetValue;
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
