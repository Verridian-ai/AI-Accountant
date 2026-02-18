/**
 * Cross-Module Intelligence — Tax Opportunity Scanner
 *
 * Discovers tax optimization opportunities from cross-module data
 * (low deduction ratios, EOFY planning reminders).
 */

import { db, transactions, taxYearSummary } from '../../../schema.js';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import type { CrossModuleInsight, TimeRange } from '../types.js';
import { buildInsight } from '../helpers.js';

export async function scanTaxOpportunities(
  userId: string,
  timeRange: TimeRange,
): Promise<CrossModuleInsight[]> {
  const insights: CrossModuleInsight[] = [];

  try {
    const taxSummaries = await db
      .select()
      .from(taxYearSummary)
      .where(eq(taxYearSummary.userId, userId))
      .orderBy(desc(taxYearSummary.taxYear))
      .all();

    if (taxSummaries.length === 0) return insights;

    const latestTax = taxSummaries[0];
    const grossIncome = latestTax.grossIncome ?? latestTax.gross_income ?? 0;
    const totalDeductions = latestTax.totalDeductions ?? latestTax.total_deductions ?? 0;
    const deductionRatio = grossIncome > 0 ? totalDeductions / grossIncome : 0;

    // Low deduction ratio for businesses earning > $50k
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
