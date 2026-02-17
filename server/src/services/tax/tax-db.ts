/**
 * Tax Database Operations
 * All database CRUD operations for deductions, CGT assets, CGT events,
 * tax year summaries, and transaction-based tax calculations
 */

import {
  db,
  deductions,
  cgtAssets,
  cgtEvents,
  taxYearSummary,
  transactions,
  accounts,
} from '../../schema.js';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import crypto from 'crypto';

import type { TaxCalculationResult } from './types.js';
import { getFinancialYearDates } from './income-tax.js';

/**
 * Save a deduction record
 */
export async function saveDeduction(
  userId: string,
  taxYear: string,
  category: string,
  description: string,
  amountCents: number,
  calculationMethod?: string,
  calculationDetails?: object,
) {
  const now = new Date().toISOString();

  const newDeduction = {
    id: crypto.randomUUID(),
    userId,
    taxYear,
    category,
    description,
    amount: amountCents,
    calculationMethod,
    calculationDetails: calculationDetails ? JSON.stringify(calculationDetails) : null,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(deductions).values(newDeduction);
  return newDeduction;
}

/**
 * Get deductions for a tax year
 */
export async function getDeductions(userId: string, taxYear: string) {
  return db
    .select()
    .from(deductions)
    .where(and(eq(deductions.userId, userId), eq(deductions.taxYear, taxYear)))
    .all();
}

/**
 * Save a CGT asset
 */
export async function saveCGTAsset(
  userId: string,
  assetName: string,
  assetType: string,
  acquisitionDate: string,
  acquisitionCostCents: number,
  incidentalCostsCents: number = 0,
  quantity: number = 1,
) {
  const now = new Date().toISOString();

  const newAsset = {
    id: crypto.randomUUID(),
    userId,
    assetName,
    assetType,
    acquisitionDate,
    acquisitionCost: acquisitionCostCents,
    acquisitionCostsIncidental: incidentalCostsCents,
    quantity,
    status: 'held',
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(cgtAssets).values(newAsset);
  return newAsset;
}

/**
 * Record a CGT disposal event
 */
export async function recordCGTDisposal(
  assetId: string,
  userId: string,
  taxYear: string,
  disposalDate: string,
  disposalProceedsCents: number,
  disposalCostsCents: number = 0,
  quantityDisposed: number = 1,
) {
  const now = new Date().toISOString();

  // Get asset
  const asset = await db.select().from(cgtAssets).where(eq(cgtAssets.id, assetId)).get();

  if (!asset) {
    throw new Error('Asset not found');
  }

  // Calculate cost base for disposed quantity
  const disposalRatio = quantityDisposed / (asset.quantity || 1);
  const costBase = Math.round(
    ((asset.acquisitionCost || 0) + (asset.acquisitionCostsIncidental || 0)) * disposalRatio,
  );

  // Calculate gain/loss
  const proceeds = disposalProceedsCents - disposalCostsCents;
  const grossGain = proceeds > costBase ? proceeds - costBase : 0;
  const capitalLoss = proceeds < costBase ? costBase - proceeds : 0;

  // Check discount eligibility
  const acqDate = new Date(asset.acquisitionDate);
  const dispDate = new Date(disposalDate);
  const holdingDays = Math.floor((dispDate.getTime() - acqDate.getTime()) / (1000 * 60 * 60 * 24));
  const discountApplied = holdingDays >= 365 && grossGain > 0;
  const discountAmount = discountApplied ? Math.round(grossGain * 0.5) : 0;
  const netGain = grossGain - discountAmount;

  const newEvent = {
    id: crypto.randomUUID(),
    assetId,
    userId,
    taxYear,
    disposalDate,
    disposalProceeds: disposalProceedsCents,
    disposalCosts: disposalCostsCents,
    quantityDisposed,
    costBaseUsed: costBase,
    capitalGainGross: grossGain,
    discountApplied,
    discountAmount,
    capitalGainNet: netGain,
    capitalLoss,
    createdAt: now,
  };

  await db.insert(cgtEvents).values(newEvent);

  // Update asset status
  const newQuantity = (asset.quantity || 1) - quantityDisposed;
  await db
    .update(cgtAssets)
    .set({
      quantity: newQuantity,
      status: newQuantity <= 0 ? 'disposed' : 'partial',
      updatedAt: now,
    })
    .where(eq(cgtAssets.id, assetId));

  return newEvent;
}

/**
 * Get tax year summary
 */
export async function getTaxYearSummary(userId: string, taxYear: string) {
  return db
    .select()
    .from(taxYearSummary)
    .where(and(eq(taxYearSummary.userId, userId), eq(taxYearSummary.taxYear, taxYear)))
    .get();
}

/**
 * Save/update tax year summary
 */
export async function saveTaxYearSummary(
  userId: string,
  taxYear: string,
  summaryData: Partial<typeof taxYearSummary.$inferInsert>,
) {
  const now = new Date().toISOString();
  const existing = await getTaxYearSummary(userId, taxYear);

  if (existing) {
    await db
      .update(taxYearSummary)
      .set({ ...summaryData, updatedAt: now })
      .where(eq(taxYearSummary.id, existing.id));
    return { ...existing, ...summaryData };
  } else {
    const newSummary = {
      id: crypto.randomUUID(),
      userId,
      taxYear,
      ...summaryData,
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(taxYearSummary).values(newSummary);
    return newSummary;
  }
}

/**
 * Calculate tax from transactions for a year
 */
export async function calculateFromTransactions(
  userId: string,
  taxYear: string,
  calculateFullTaxFn: (grossIncome: number, totalDeductions: number) => TaxCalculationResult,
) {
  const dates = getFinancialYearDates(taxYear);

  // Get transactions for the year, excluding personal accounts and transfers
  const yearTransactions = await db
    .select({
      id: transactions.id,
      amount: transactions.amount,
      date: transactions.date,
    })
    .from(transactions)
    .leftJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.date, dates.start),
        lte(transactions.date, dates.end),
        eq(transactions.isTransfer, false),
        // Exclude transactions from personal accounts
        sql`(${transactions.accountId} IS NULL OR ${accounts.ownershipTag} IS NULL OR ${accounts.ownershipTag} != 'personal')`,
      ),
    )
    .all();

  // Calculate income and expenses
  let totalIncome = 0;
  let totalExpenses = 0;

  for (const tx of yearTransactions) {
    if (tx.amount > 0) {
      totalIncome += tx.amount;
    } else {
      totalExpenses += Math.abs(tx.amount);
    }
  }

  // Get saved deductions
  const savedDeductions = await getDeductions(userId, taxYear);
  const totalDeductions = savedDeductions.reduce(
    (sum: number, d: typeof deductions.$inferSelect) => sum + d.amount,
    0,
  );

  // Calculate tax
  const result = calculateFullTaxFn(totalIncome / 100, (totalDeductions + totalExpenses) / 100);

  return {
    transactionCount: yearTransactions.length,
    totalIncome: totalIncome / 100,
    totalExpenses: totalExpenses / 100,
    savedDeductions: totalDeductions / 100,
    ...result,
  };
}
