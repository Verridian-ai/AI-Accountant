/**
 * Cross-Module Intelligence — Compliance Risk Scanner
 *
 * Identifies compliance risks from cross-module signals
 * (overdue BAS, uncategorized transactions, missing GST).
 */

import { db, transactions, basPeriods } from '../../../schema.js';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import type { CrossModuleInsight, TimeRange } from '../types.js';
import { buildInsight } from '../helpers.js';

export async function scanComplianceRisks(
  userId: string,
  timeRange: TimeRange,
): Promise<CrossModuleInsight[]> {
  const insights: CrossModuleInsight[] = [];

  try {
    const overdueBasRows = await db
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
