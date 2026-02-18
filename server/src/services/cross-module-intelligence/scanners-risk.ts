// ============================================================================
// RISK SCANNERS — anomaly cascades + compliance risks
// ============================================================================

import { db, transactions, basPeriods, reconciliationAlerts } from '../../schema.js';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { buildInsight } from './insight-helpers.js';
import type { CrossModuleInsight, TimeRange } from './types.js';
import type { ReconciliationAlertRow, BasPeriodRow } from './db-types.js';

/**
 * Detect anomalies that cascade across modules.
 */
export async function scanAnomalyCascades(
  userId: string,
  timeRange: TimeRange,
): Promise<CrossModuleInsight[]> {
  const insights: CrossModuleInsight[] = [];

  try {
    const alerts: ReconciliationAlertRow[] = await db
      .select()
      .from(reconciliationAlerts)
      .where(
        and(
          eq(reconciliationAlerts.userId, userId),
          gte(reconciliationAlerts.createdAt, timeRange.start),
          eq(reconciliationAlerts.isResolved, false),
        ),
      )
      .all();

    if (alerts.length === 0) return insights;

    const overdueBasPeriods: BasPeriodRow[] = await db
      .select()
      .from(basPeriods)
      .where(and(eq(basPeriods.userId, userId), eq(basPeriods.status, 'overdue')))
      .all();

    const lowConfResult = await db
      .select({ count: sql`count(*)` })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          gte(transactions.date, timeRange.start),
          lte(transactions.date, timeRange.end),
          lte(transactions.confidenceScore, 0.5),
        ),
      )
      .get();

    const lowConfCount = Number(lowConfResult?.count ?? 0);

    if (alerts.length >= 2 || (alerts.length >= 1 && overdueBasPeriods.length > 0)) {
      const modules = ['anomaly_detection', 'transactions'];
      if (overdueBasPeriods.length > 0) modules.push('bas');

      insights.push(
        buildInsight(
          'anomaly_cascade',
          `Cascading anomalies detected across ${modules.length} modules`,
          `${alerts.length} unresolved reconciliation alerts${overdueBasPeriods.length > 0 ? `, ${overdueBasPeriods.length} overdue BAS periods` : ''}${lowConfCount > 0 ? `, ${lowConfCount} low-confidence transactions` : ''}. These may be related issues requiring coordinated investigation.`,
          {
            alertCount: alerts.length,
            overdueBasCount: overdueBasPeriods.length,
            lowConfidenceTxCount: lowConfCount,
            alertTypes: alerts.map(
              (a) => a.alertType ?? (a as Record<string, unknown>)['alert_type'],
            ),
          },
          modules,
          Math.min(0.5 + alerts.length * 0.1 + overdueBasPeriods.length * 0.15, 0.95),
          alerts.length >= 3 || overdueBasPeriods.length >= 2 ? 'critical' : 'warning',
          userId,
          timeRange,
        ),
      );
    }
  } catch {
    /* scanner failure */
  }

  return insights;
}

/**
 * Identify compliance risks from cross-module signals.
 */
export async function scanComplianceRisks(
  userId: string,
  timeRange: TimeRange,
): Promise<CrossModuleInsight[]> {
  const insights: CrossModuleInsight[] = [];

  try {
    const overdueBasRows: BasPeriodRow[] = await db
      .select()
      .from(basPeriods)
      .where(and(eq(basPeriods.userId, userId), eq(basPeriods.status, 'overdue')))
      .all();

    const uncatResult = await db
      .select({ count: sql`count(*)` })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          gte(transactions.date, timeRange.start),
          lte(transactions.date, timeRange.end),
          sql`${transactions.category} IS NULL`,
        ),
      )
      .get();
    const uncategorizedCount = Number(uncatResult?.count ?? 0);

    const missingGstResult = await db
      .select({ count: sql`count(*)` })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.gstApplicable, true),
          gte(transactions.date, timeRange.start),
          lte(transactions.date, timeRange.end),
          sql`(${transactions.gstAmount} IS NULL OR ${transactions.gstAmount} = 0)`,
        ),
      )
      .get();
    const missingGstCount = Number(missingGstResult?.count ?? 0);

    const riskFactors: string[] = [];
    const modules = ['compliance'];

    if (overdueBasRows.length > 0) {
      riskFactors.push(`${overdueBasRows.length} overdue BAS period(s)`);
      modules.push('bas');
    }
    if (uncategorizedCount > 10) {
      riskFactors.push(`${uncategorizedCount} uncategorized transactions`);
      modules.push('transactions');
    }
    if (missingGstCount > 5) {
      riskFactors.push(`${missingGstCount} transactions missing GST amounts`);
      if (!modules.includes('transactions')) modules.push('transactions');
      modules.push('tax');
    }

    if (riskFactors.length >= 2) {
      insights.push(
        buildInsight(
          'compliance_risk',
          `Compliance risk: ${riskFactors.length} factors identified`,
          `Risk factors: ${riskFactors.join('; ')}. Addressing these reduces ATO audit risk.`,
          {
            overdueBasCount: overdueBasRows.length,
            uncategorizedTxCount: uncategorizedCount,
            missingGstCount,
            riskFactors,
          },
          modules,
          Math.min(0.6 + riskFactors.length * 0.1, 0.95),
          overdueBasRows.length > 0 && (uncategorizedCount > 20 || missingGstCount > 10)
            ? 'critical'
            : 'warning',
          userId,
          timeRange,
          'Review and address each compliance risk factor: categorize transactions, calculate GST amounts, and lodge overdue BAS.',
        ),
      );
    }
  } catch {
    /* scanner failure */
  }

  return insights;
}
