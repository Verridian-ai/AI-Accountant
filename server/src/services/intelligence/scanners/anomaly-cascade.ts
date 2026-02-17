/**
 * Cross-Module Intelligence — Anomaly Cascade Scanner
 *
 * Detects anomalies that cascade across modules.
 * E.g., reconciliation alerts + overdue BAS + low-confidence transactions.
 */

import { db, transactions, basPeriods, reconciliationAlerts } from '../../../schema.js';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import type { CrossModuleInsight, TimeRange } from '../types.js';
import { buildInsight } from '../helpers.js';

export async function scanAnomalyCascades(
  userId: string,
  timeRange: TimeRange,
): Promise<CrossModuleInsight[]> {
  const insights: CrossModuleInsight[] = [];

  try {
    const alerts: any[] = await (db as any)
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

    const overdueBasPeriods: any[] = await (db as any)
      .select()
      .from(basPeriods)
      .where(and(eq(basPeriods.userId, userId), eq(basPeriods.status, 'overdue')))
      .all();

    const lowConfResult = await (db as any)
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
            alertTypes: alerts.map((a: any) => a.alertType ?? a.alert_type),
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
