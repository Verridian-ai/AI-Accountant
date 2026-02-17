/**
 * BAS persistence operations — self-contained implementation.
 *
 * bas-service.ts calls:
 *   _saveBASCalculation(periodId, result)       — 2 args
 *   getSavedBASCalculation(userId, fy, quarter)  — 3 args
 *   updatePeriodStatus(periodId, status, date?)  — 2-3 args
 *   getTaxCodes()                                — 0 args
 *   batchUpdateGSTCategories(updates)            — 1 arg
 */
import { db, basCalculations, basPeriods, transactions, taxCodes } from '../../schema.js';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import { GSTCategory } from './types.js';
import type { BASResult } from './types.js';

export async function saveBASCalculation(periodId: string, result: BASResult) {
  const now = new Date().toISOString();

  // Check for existing calculation
  const existing = await db
    .select()
    .from(basCalculations)
    .where(eq(basCalculations.basPeriodId, periodId))
    .get();

  const calculationData = {
    labelG1: result.labels.G1,
    labelG2: result.labels.G2,
    labelG3: result.labels.G3,
    labelG10: result.labels.G10,
    labelG11: result.labels.G11,
    label1A: result.labels['1A'],
    label1B: result.labels['1B'],
    labelW1: result.labels.W1,
    labelW2: result.labels.W2,
    label5A: result.labels['5A'],
    label7C: result.labels['7C'],
    label7D: result.labels['7D'],
    netGst: result.netGst,
    fuelTaxCredit: result.fuelTaxCredits,
    totalPayable: result.totalPayable,
    calculationNotes: JSON.stringify({
      transactionCount: result.transactionCount,
      calculatedAt: now,
    }),
    updatedAt: now,
  };

  if (existing) {
    await db
      .update(basCalculations)
      .set(calculationData)
      .where(eq(basCalculations.id, existing.id));
    return { ...existing, ...calculationData };
  } else {
    const newCalc = {
      id: crypto.randomUUID(),
      basPeriodId: periodId,
      ...calculationData,
      createdAt: now,
    };
    await db.insert(basCalculations).values(newCalc);
    return newCalc;
  }
}

export async function getSavedBASCalculation(
  userId: string,
  financialYear: string,
  quarter: number,
) {
  const period = await db
    .select()
    .from(basPeriods)
    .where(
      and(
        eq(basPeriods.userId, userId),
        eq(basPeriods.financialYear, financialYear),
        eq(basPeriods.quarter, quarter),
      ),
    )
    .get();

  if (!period) return null;

  const calculation = await db
    .select()
    .from(basCalculations)
    .where(eq(basCalculations.basPeriodId, period.id))
    .get();

  return calculation ? { period, calculation } : null;
}

export async function updatePeriodStatus(
  periodId: string,
  status: 'draft' | 'ready' | 'lodged' | 'amended',
  lodgementDate?: string,
) {
  const updateData = {
    status,
    updatedAt: new Date().toISOString(),
    ...(lodgementDate ? { lodgementDate } : {}),
  };

  await db.update(basPeriods).set(updateData).where(eq(basPeriods.id, periodId));
}

export async function getTaxCodes() {
  return db.select().from(taxCodes).all();
}

export async function batchUpdateGSTCategories(
  updates: Array<{
    transactionId: string;
    gstCategory: GSTCategory;
    gstAmount: number;
  }>,
) {
  for (const update of updates) {
    await db
      .update(transactions)
      .set({
        gstCategory: update.gstCategory,
        gstAmount: update.gstAmount,
        isEdited: true,
      })
      .where(eq(transactions.id, update.transactionId));
  }
}
