/**
 * BAS (Business Activity Statement) Service
 * TypeScript service for Australian BAS calculations and management
 */

import { db, transactions, basPeriods, accounts } from '../../schema.js';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import crypto from 'crypto';
import { GSTCategory } from './types.js';
import type { BASLabels, BASResult } from './types.js';
import { getQuarterDates, calculateGstFromInclusive } from './quarter-utils.js';
import { getAvailableQuarters } from './available-quarters.js';
import {
  saveBASCalculation as _saveBASCalculation,
  getSavedBASCalculation,
  updatePeriodStatus,
  getTaxCodes,
  batchUpdateGSTCategories,
} from './bas-persistence.js';
import { selectOne, insert } from '../../db/typed-queries.js';

/**
 * BAS Service class
 */
export class BASService {
  /**
   * Get or create a BAS period
   */
  async getOrCreatePeriod(
    userId: string,
    financialYear: string,
    quarter: number,
    accountingMethod: string = 'accrual',
  ): Promise<typeof basPeriods.$inferSelect> {
    const existing = await selectOne(
      db,
      basPeriods,
      and(
        eq(basPeriods.userId, userId),
        eq(basPeriods.financialYear, financialYear),
        eq(basPeriods.quarter, quarter)
      )
    );

    if (existing) return existing;

    const dates = getQuarterDates(financialYear, quarter);
    const now = new Date().toISOString();

    const newPeriod: typeof basPeriods.$inferInsert = {
      id: crypto.randomUUID(),
      userId,
      financialYear,
      quarter,
      startDate: dates.startDate,
      endDate: dates.endDate,
      lodgementDue: dates.lodgementDue,
      status: 'draft',
      accountingMethod,
      createdAt: now,
      updatedAt: now,
    };

    await insert(db, basPeriods, newPeriod);
    return newPeriod as typeof basPeriods.$inferSelect;
  }

  /** Get all BAS periods for a user */
  async getUserPeriods(userId: string): Promise<Array<typeof basPeriods.$inferSelect>> {
    const results: Array<typeof basPeriods.$inferSelect> = await db
      .select()
      .from(basPeriods)
      .where(eq(basPeriods.userId, userId))
      .orderBy(sql`${basPeriods.financialYear} DESC, ${basPeriods.quarter} DESC`)
      .all();
    return results;
  }

  /** Calculate BAS for a quarter */
  async calculateBAS(
    userId: string,
    financialYear: string,
    quarter: number,
    _accountingMethod: string = 'accrual',
  ): Promise<BASResult> {
    const dates = getQuarterDates(financialYear, quarter);

    const quarterTransactions = await db
      .select({
        id: transactions.id,
        amount: transactions.amount,
        gstCategory: transactions.gstCategory,
        gstAmount: transactions.gstAmount,
        date: transactions.date,
      })
      .from(transactions)
      .leftJoin(accounts, eq(transactions.accountId, accounts.id))
      .where(
        and(
          eq(transactions.userId, userId),
          gte(transactions.date, dates.startDate),
          lte(transactions.date, dates.endDate),
          eq(transactions.isTransfer, false),
          sql`(${transactions.accountId} IS NULL OR ${accounts.ownershipTag} IS NULL OR ${accounts.ownershipTag} != 'personal')`,
        ),
      )
      .all();

    const labels: BASLabels = {
      G1: 0, G2: 0, G3: 0, G10: 0, G11: 0,
      '1A': 0, '1B': 0, W1: 0, W2: 0, '5A': 0, '7C': 0, '7D': 0,
    };

    for (const tx of quarterTransactions) {
      const amount = tx.amount;
      const gstCategory = (tx.gstCategory as GSTCategory) || GSTCategory.TAXABLE_10;
      const gstAmount = tx.gstAmount ?? calculateGstFromInclusive(amount);

      if (amount > 0) {
        switch (gstCategory) {
          case GSTCategory.EXPORT: labels.G2 += amount; break;
          case GSTCategory.GST_FREE: labels.G3 += amount; break;
          case GSTCategory.INPUT_TAXED: case GSTCategory.PRIVATE: break;
          default: labels.G1 += amount; labels['1A'] += gstAmount;
        }
      } else {
        const absAmount = Math.abs(amount);
        switch (gstCategory) {
          case GSTCategory.CAPITAL: labels.G10 += absAmount; labels['1B'] += gstAmount; break;
          case GSTCategory.INPUT_TAXED: case GSTCategory.PRIVATE: break;
          case GSTCategory.GST_FREE: break;
          default: labels.G11 += absAmount; labels['1B'] += gstAmount;
        }
      }
    }

    const netGst = labels['1A'] - labels['1B'];
    const fuelTaxCredits = labels['7C'] + labels['7D'];
    const totalPayable = netGst + labels.W2 + labels['5A'] - fuelTaxCredits;

    return {
      period: {
        financialYear, quarter,
        startDate: dates.startDate, endDate: dates.endDate, lodgementDue: dates.lodgementDue,
      },
      labels, netGst, fuelTaxCredits, totalPayable,
      isRefund: totalPayable < 0,
      transactionCount: quarterTransactions.length,
    };
  }

  /** Save BAS calculation */
  async saveBASCalculation(userId: string, financialYear: string, quarter: number, result: BASResult) {
    const period = await this.getOrCreatePeriod(userId, financialYear, quarter);
    return _saveBASCalculation(period.id, result);
  }

  /** Get saved BAS calculation */
  async getSavedBASCalculation(userId: string, financialYear: string, quarter: number) {
    return getSavedBASCalculation(userId, financialYear, quarter);
  }

  /** Update BAS period status */
  async updatePeriodStatus(periodId: string, status: 'draft' | 'ready' | 'lodged' | 'amended', lodgementDate?: string) {
    return updatePeriodStatus(periodId, status, lodgementDate);
  }

  /** Get tax codes */
  async getTaxCodes() { return getTaxCodes(); }

  /** Batch update GST categories for transactions */
  async batchUpdateGSTCategories(updates: Array<{ transactionId: string; gstCategory: GSTCategory; gstAmount: number }>) {
    return batchUpdateGSTCategories(updates);
  }

  /** Get available quarters for a user (based on transaction dates) */
  async getAvailableQuarters(userId: string): Promise<Array<{ financialYear: string; quarter: number }>> {
    return getAvailableQuarters(userId);
  }
}

export const basService = new BASService();
