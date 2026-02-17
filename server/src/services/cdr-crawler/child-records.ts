/**
 * CDR Open Banking Crawler — Child Record Storage
 *
 * Database operations for product child records: lending rates,
 * deposit rates, fees, features, and eligibility criteria.
 */

import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import {
  db,
  cdrLendingRates,
  cdrDepositRates,
  cdrFees,
  cdrFeatures,
  cdrEligibility,
} from '../../schema.js';
import type { CdrProductDetail } from './types.js';

// ============================================================================
// Public orchestrator
// ============================================================================

export async function replaceChildRecords(
  compositeProductId: string,
  detail: CdrProductDetail,
  now: string,
): Promise<void> {
  await replaceLendingRates(compositeProductId, detail, now);
  await replaceDepositRates(compositeProductId, detail, now);
  await replaceFees(compositeProductId, detail, now);
  await replaceFeatures(compositeProductId, detail, now);
  await replaceEligibility(compositeProductId, detail, now);
}

// ============================================================================
// Lending Rates
// ============================================================================

async function replaceLendingRates(
  compositeProductId: string,
  detail: CdrProductDetail,
  now: string,
): Promise<void> {
  await db.delete(cdrLendingRates).where(eq(cdrLendingRates.productId, compositeProductId)).run();

  if (detail.lendingRates?.length) {
    for (const lr of detail.lendingRates) {
      await db
        .insert(cdrLendingRates)
        .values({
          id: crypto.randomUUID(),
          productId: compositeProductId,
          lendingRateType: lr.lendingRateType,
          rate: parseFloat(lr.rate) || 0,
          comparisonRate: lr.comparisonRate ? parseFloat(lr.comparisonRate) : null,
          calculationFrequency: lr.calculationFrequency ?? null,
          applicationFrequency: lr.applicationFrequency ?? null,
          interestPaymentDue: lr.interestPaymentDue ?? null,
          repaymentType: lr.repaymentType ?? null,
          loanPurpose: lr.loanPurpose ?? null,
          tiers: lr.tiers ? JSON.stringify(lr.tiers) : null,
          additionalValue: lr.additionalValue ?? null,
          additionalInfo: lr.additionalInfo ?? null,
          additionalInfoUri: lr.additionalInfoUri ?? null,
          createdAt: now,
        })
        .run();
    }
  }
}

// ============================================================================
// Deposit Rates
// ============================================================================

async function replaceDepositRates(
  compositeProductId: string,
  detail: CdrProductDetail,
  now: string,
): Promise<void> {
  await db.delete(cdrDepositRates).where(eq(cdrDepositRates.productId, compositeProductId)).run();

  if (detail.depositRates?.length) {
    for (const dr of detail.depositRates) {
      await db
        .insert(cdrDepositRates)
        .values({
          id: crypto.randomUUID(),
          productId: compositeProductId,
          depositRateType: dr.depositRateType,
          rate: parseFloat(dr.rate) || 0,
          calculationFrequency: dr.calculationFrequency ?? null,
          applicationFrequency: dr.applicationFrequency ?? null,
          tiers: dr.tiers ? JSON.stringify(dr.tiers) : null,
          additionalValue: dr.additionalValue ?? null,
          additionalInfo: dr.additionalInfo ?? null,
          additionalInfoUri: dr.additionalInfoUri ?? null,
          createdAt: now,
        })
        .run();
    }
  }
}

// ============================================================================
// Fees
// ============================================================================

async function replaceFees(
  compositeProductId: string,
  detail: CdrProductDetail,
  now: string,
): Promise<void> {
  await db.delete(cdrFees).where(eq(cdrFees.productId, compositeProductId)).run();

  if (detail.fees?.length) {
    for (const fee of detail.fees) {
      await db
        .insert(cdrFees)
        .values({
          id: crypto.randomUUID(),
          productId: compositeProductId,
          name: fee.name,
          feeType: fee.feeType,
          amount: fee.amount ?? null,
          balanceRate: fee.balanceRate ?? null,
          transactionRate: fee.transactionRate ?? null,
          accruedRate: fee.accruedRate ?? null,
          accrualFrequency: fee.accrualFrequency ?? null,
          currency: fee.currency ?? 'AUD',
          additionalValue: fee.additionalValue ?? null,
          additionalInfo: fee.additionalInfo ?? null,
          additionalInfoUri: fee.additionalInfoUri ?? null,
          discounts: fee.discounts ? JSON.stringify(fee.discounts) : null,
          createdAt: now,
        })
        .run();
    }
  }
}

// ============================================================================
// Features
// ============================================================================

async function replaceFeatures(
  compositeProductId: string,
  detail: CdrProductDetail,
  now: string,
): Promise<void> {
  await db.delete(cdrFeatures).where(eq(cdrFeatures.productId, compositeProductId)).run();

  if (detail.features?.length) {
    for (const feat of detail.features) {
      await db
        .insert(cdrFeatures)
        .values({
          id: crypto.randomUUID(),
          productId: compositeProductId,
          featureType: feat.featureType,
          additionalValue: feat.additionalValue ?? null,
          additionalInfo: feat.additionalInfo ?? null,
          additionalInfoUri: feat.additionalInfoUri ?? null,
          isActivated: feat.isActivated ?? true,
          createdAt: now,
        })
        .run();
    }
  }
}

// ============================================================================
// Eligibility
// ============================================================================

async function replaceEligibility(
  compositeProductId: string,
  detail: CdrProductDetail,
  now: string,
): Promise<void> {
  await db.delete(cdrEligibility).where(eq(cdrEligibility.productId, compositeProductId)).run();

  if (detail.eligibility?.length) {
    for (const elig of detail.eligibility) {
      await db
        .insert(cdrEligibility)
        .values({
          id: crypto.randomUUID(),
          productId: compositeProductId,
          eligibilityType: elig.eligibilityType,
          additionalValue: elig.additionalValue ?? null,
          additionalInfo: elig.additionalInfo ?? null,
          additionalInfoUri: elig.additionalInfoUri ?? null,
          createdAt: now,
        })
        .run();
    }
  }
}
