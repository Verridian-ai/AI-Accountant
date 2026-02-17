/**
 * CDR Cognee Indexer — Product Knowledge Indexing
 *
 * Builds rich product knowledge documents from CDR data (products, rates,
 * fees, features, eligibility) and indexes them into Cognee datasets.
 * Extracted from CdrCogneeIndexer for file-size compliance.
 */

import { eq } from 'drizzle-orm';
import {
  db,
  cdrProducts,
  cdrLendingRates,
  cdrDepositRates,
  cdrFees,
  cdrFeatures,
  cdrEligibility,
  cdrDataHolders,
} from '../../schema.js';
import { cogneeTools, COGNEE_DATASETS } from '../claude/cognee-tools.js';

/**
 * Index individual rates (lending + deposit) into the CDR rates dataset.
 */
export async function indexRates(): Promise<{ count: number; errors: string[] }> {
  const errors: string[] = [];

  try {
    const texts: string[] = [];

    const lendingRates = await db.select().from(cdrLendingRates).all();
    for (const lr of (lendingRates ?? []) as any[]) {
      const product = await db
        .select()
        .from(cdrProducts)
        .where(eq(cdrProducts.id, lr.productId))
        .get();
      const productName = (product as any)?.name ?? lr.productId;
      const bankName = (product as any)?.brandName ?? '';

      const ratePercent = ((lr.rate ?? 0) * 100).toFixed(2);
      const compRatePercent = lr.comparisonRate
        ? (lr.comparisonRate * 100).toFixed(2) + '% comparison'
        : '';

      const text =
        `Lending Rate: ${productName} (${bankName}). ` +
        `Type: ${lr.lendingRateType}. ` +
        `Rate: ${ratePercent}%. ` +
        (compRatePercent ? `${compRatePercent}. ` : '') +
        (lr.repaymentType ? `Repayment: ${lr.repaymentType}. ` : '') +
        (lr.loanPurpose ? `Purpose: ${lr.loanPurpose}. ` : '') +
        (lr.additionalInfo ? `${lr.additionalInfo}. ` : '');

      texts.push(text.trim());
    }

    const depositRates = await db.select().from(cdrDepositRates).all();
    for (const dr of (depositRates ?? []) as any[]) {
      const product = await db
        .select()
        .from(cdrProducts)
        .where(eq(cdrProducts.id, dr.productId))
        .get();
      const productName = (product as any)?.name ?? dr.productId;
      const bankName = (product as any)?.brandName ?? '';

      const ratePercent = ((dr.rate ?? 0) * 100).toFixed(2);

      const text =
        `Deposit Rate: ${productName} (${bankName}). ` +
        `Type: ${dr.depositRateType}. ` +
        `Rate: ${ratePercent}%. ` +
        (dr.additionalInfo ? `${dr.additionalInfo}. ` : '');

      texts.push(text.trim());
    }

    if (texts.length > 0) {
      await cogneeTools.index(texts, COGNEE_DATASETS.cdrRates);
    }

    return { count: texts.length, errors };
  } catch (err: any) {
    errors.push(`Rate indexing failed: ${err.message}`);
    return { count: 0, errors };
  }
}

/**
 * Index rich product knowledge (product + rates + fees + features + eligibility).
 */
export async function indexProductKnowledge(): Promise<{ count: number; errors: string[] }> {
  const errors: string[] = [];

  try {
    const products = await db.select().from(cdrProducts).all();
    if (!products?.length) return { count: 0, errors: [] };

    const texts: string[] = [];

    for (const product of products as any[]) {
      try {
        let holderName = product.brandName ?? product.brand ?? '';
        if (!holderName && product.dataHolderId) {
          const holder = await db
            .select()
            .from(cdrDataHolders)
            .where(eq(cdrDataHolders.id, product.dataHolderId))
            .get();
          holderName = (holder as any)?.brandName ?? '';
        }

        const pid = product.id;

        const lRates = await db
          .select()
          .from(cdrLendingRates)
          .where(eq(cdrLendingRates.productId, pid))
          .all();

        const lendingText = (lRates as any[])
          .map(
            (lr) =>
              `${lr.lendingRateType}: ${((lr.rate ?? 0) * 100).toFixed(2)}%` +
              (lr.comparisonRate ? ` (comparison ${(lr.comparisonRate * 100).toFixed(2)}%)` : '') +
              (lr.repaymentType ? ` [${lr.repaymentType}]` : ''),
          )
          .join('; ');

        const dRates = await db
          .select()
          .from(cdrDepositRates)
          .where(eq(cdrDepositRates.productId, pid))
          .all();

        const depositText = (dRates as any[])
          .map((dr) => `${dr.depositRateType}: ${((dr.rate ?? 0) * 100).toFixed(2)}%`)
          .join('; ');

        const fees = await db.select().from(cdrFees).where(eq(cdrFees.productId, pid)).all();

        const feesText = (fees as any[])
          .map((f) => `${f.name} (${f.feeType}): ${f.amount ? `$${f.amount}` : 'varies'}`)
          .join('; ');

        const features = await db
          .select()
          .from(cdrFeatures)
          .where(eq(cdrFeatures.productId, pid))
          .all();

        const featuresText = (features as any[])
          .map((f) => f.featureType + (f.additionalValue ? `: ${f.additionalValue}` : ''))
          .join('; ');

        const eligibility = await db
          .select()
          .from(cdrEligibility)
          .where(eq(cdrEligibility.productId, pid))
          .all();

        const eligibilityText = (eligibility as any[])
          .map((e) => e.eligibilityType + (e.additionalValue ? `: ${e.additionalValue}` : ''))
          .join('; ');

        let doc =
          `Banking Product: ${product.name} by ${holderName}. ` +
          `Category: ${product.productCategory}. `;

        if (product.description) doc += `${product.description}. `;
        if (lendingText) doc += `Lending Rates: ${lendingText}. `;
        if (depositText) doc += `Deposit Rates: ${depositText}. `;
        if (feesText) doc += `Fees: ${feesText}. `;
        if (featuresText) doc += `Features: ${featuresText}. `;
        if (eligibilityText) doc += `Eligibility: ${eligibilityText}. `;

        texts.push(doc.trim());
      } catch (err: any) {
        errors.push(`Failed to build knowledge for ${product.name}: ${err.message}`);
      }
    }

    if (texts.length > 0) {
      await cogneeTools.index(texts, COGNEE_DATASETS.bankingProductKnowledge);
    }

    return { count: texts.length, errors };
  } catch (err: any) {
    errors.push(`Product knowledge indexing failed: ${err.message}`);
    return { count: 0, errors };
  }
}
