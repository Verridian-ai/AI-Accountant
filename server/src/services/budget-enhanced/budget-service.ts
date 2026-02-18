/**
 * Enhanced Budget Service — Service Class
 *
 * Smart budgeting with entity awareness, projections, and wealth modeling.
 *
 * Features:
 *   - Smart budget generation from historical transaction data
 *   - Recurring bill pattern detection + overdue alerts
 *   - Revenue & expense projections (linear regression)
 *   - Wealth projection (compound growth, 4 risk profiles)
 *   - Debt repayment strategy comparison (avalanche vs snowball)
 */

import { db, transactions, accounts } from '../../schema.js';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import type {
  BudgetCategoryEntry,
  SmartBudget,
  RecurringBill,
  ProjectionResult,
  WealthProjectionParams,
  WealthProjectionResult,
  DebtInfo,
  DebtStrategyResult,
} from './types.js';
import { median } from './helpers.js';
import {
  calculateWealthProjection,
  compareDebtStrategies as compareDebtStrategiesImpl,
} from './financial-calculators.js';
import { detectBillPatterns as detectBillPatternsImpl } from './bill-detection.js';
import { projectTimeSeries } from './projections.js';

export class EnhancedBudgetService {
  /**
   * Generate a smart budget based on historical transaction data.
   */
  async generateSmartBudget(
    userId: string,
    entityType: string = 'sole_trader',
    months: number = 6,
  ): Promise<SmartBudget> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const ownershipFilter =
      entityType === 'personal'
        ? sql`(${accounts.ownershipTag} IS NULL OR ${accounts.ownershipTag} = 'personal')`
        : sql`(${accounts.ownershipTag} IS NULL OR ${accounts.ownershipTag} != 'personal')`;

    const rows = await db
      .select({
        category: transactions.category,
        month: sql<string>`SUBSTRING(${transactions.date}, 1, 7)`,
        total: sql<number>`SUM(ABS(${transactions.amount}))`,
      })
      .from(transactions)
      .leftJoin(accounts, eq(transactions.accountId, accounts.id))
      .where(
        and(
          eq(transactions.userId, userId),
          gte(transactions.date, startDate.toISOString().slice(0, 10)),
          lte(transactions.date, endDate.toISOString().slice(0, 10)),
          sql`${transactions.amount} < 0`,
          sql`${transactions.category} IS NOT NULL`,
          ownershipFilter,
        ),
      )
      .groupBy(transactions.category, sql`SUBSTRING(${transactions.date}, 1, 7)`)
      .all();

    const categoryMonthly = new Map<string, number[]>();
    for (const row of rows as { category: string; month: string; total: number }[]) {
      const cat = row.category ?? 'Uncategorized';
      if (!categoryMonthly.has(cat)) categoryMonthly.set(cat, []);
      categoryMonthly.get(cat)!.push(Number(row.total));
    }

    const categories: BudgetCategoryEntry[] = [];
    for (const [category, monthlyTotals] of categoryMonthly) {
      const sorted = [...monthlyTotals].sort((a, b) => a - b);
      const avg = Math.round(sorted.reduce((s, v) => s + v, 0) / sorted.length);
      const med = median(sorted);
      const min = sorted[0] ?? 0;
      const max = sorted[sorted.length - 1] ?? 0;

      const halfIdx = Math.floor(sorted.length / 2);
      const firstHalfAvg = sorted.slice(0, halfIdx).reduce((s, v) => s + v, 0) / (halfIdx || 1);
      const secondHalfAvg =
        sorted.slice(halfIdx).reduce((s, v) => s + v, 0) / (sorted.length - halfIdx || 1);
      const changeRatio = firstHalfAvg > 0 ? (secondHalfAvg - firstHalfAvg) / firstHalfAvg : 0;

      let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
      if (changeRatio > 0.1) trend = 'increasing';
      else if (changeRatio < -0.1) trend = 'decreasing';

      let recommended = med;
      if (trend === 'increasing') {
        recommended = Math.round(med * 1.1);
      }

      const currentMonth = new Date().getMonth() + 1;
      if (currentMonth >= 10 && currentMonth <= 12) {
        recommended = Math.round(recommended * 1.05);
      }

      categories.push({ category, average: avg, median: med, min, max, recommended, trend });
    }

    categories.sort((a, b) => b.recommended - a.recommended);
    const totalMonthlyBudget = categories.reduce((s, c) => s + c.recommended, 0);

    return {
      entityType,
      monthsAnalyzed: months,
      totalMonthlyBudget,
      categories,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Detect recurring bill patterns from transaction history.
   */
  async detectBillPatterns(userId: string): Promise<RecurringBill[]> {
    return detectBillPatternsImpl(userId);
  }

  async projectRevenue(
    userId: string,
    entityType: string = 'sole_trader',
    months: number = 6,
  ): Promise<ProjectionResult> {
    return projectTimeSeries(userId, entityType, months, 'income');
  }

  async projectExpenses(
    userId: string,
    entityType: string = 'sole_trader',
    months: number = 6,
  ): Promise<ProjectionResult> {
    return projectTimeSeries(userId, entityType, months, 'expense');
  }

  calculateWealthProjection(params: WealthProjectionParams): WealthProjectionResult {
    return calculateWealthProjection(params);
  }

  compareDebtStrategies(debts: DebtInfo[], extraMonthlyPayment: number): DebtStrategyResult {
    return compareDebtStrategiesImpl(debts, extraMonthlyPayment);
  }
}
