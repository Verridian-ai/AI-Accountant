/**
 * CDR Cognee Indexer — Incremental & Data Holder Indexing
 *
 * Methods for indexing a single data holder and for incremental
 * (since-timestamp) re-indexing of recently updated products.
 */

import { eq, gt } from 'drizzle-orm';
import {
  db,
  cdrProducts,
  cdrLendingRates,
  cdrDepositRates,
  cdrFees,
  cdrFeatures,
  cdrDataHolders,
} from '../../schema.js';
import type {
  CdrProduct,
  CdrDataHolder,
  CdrLendingRate,
  CdrDepositRate,
  CdrFee,
  CdrFeature,
} from '../../db/cdr-schema.js';
import { logger } from '../../lib/logger.js';
import { cogneeTools, COGNEE_DATASETS } from '../claude/cognee-tools.js';
import type { CdrIndexResult } from './types.js';

/**
 * Index all products for a single data holder.
 */
export async function indexDataHolder(dataHolderId: string): Promise<CdrIndexResult> {
  const start = Date.now();
  const allErrors: string[] = [];

  const products = (await db
    .select()
    .from(cdrProducts)
    .where(eq(cdrProducts.dataHolderId, dataHolderId))
    .all()) as CdrProduct[];

  if (!products?.length) {
    return {
      productsIndexed: 0,
      ratesIndexed: 0,
      knowledgeDocsIndexed: 0,
      errors: [],
      durationMs: Date.now() - start,
    };
  }

  const holder = (await db
    .select()
    .from(cdrDataHolders)
    .where(eq(cdrDataHolders.id, dataHolderId))
    .get()) as CdrDataHolder | undefined;
  const holderName = holder?.brandName ?? dataHolderId;

  const productTexts: string[] = [];
  const rateTexts: string[] = [];
  const knowledgeTexts: string[] = [];

  for (const product of products) {
    const pid = product.id;

    productTexts.push(
      `Product: ${product.name}. Bank: ${holderName}. Category: ${product.productCategory}. ${product.description ?? ''}`.trim(),
    );

    const lRates = (await db
      .select()
      .from(cdrLendingRates)
      .where(eq(cdrLendingRates.productId, pid))
      .all()) as CdrLendingRate[];
    for (const lr of lRates) {
      const ratePercent = ((lr.rate ?? 0) * 100).toFixed(2);
      rateTexts.push(
        `Lending Rate: ${product.name} (${holderName}). Type: ${lr.lendingRateType}. Rate: ${ratePercent}%.`,
      );
    }

    const dRates = (await db
      .select()
      .from(cdrDepositRates)
      .where(eq(cdrDepositRates.productId, pid))
      .all()) as CdrDepositRate[];
    for (const dr of dRates) {
      const ratePercent = ((dr.rate ?? 0) * 100).toFixed(2);
      rateTexts.push(
        `Deposit Rate: ${product.name} (${holderName}). Type: ${dr.depositRateType}. Rate: ${ratePercent}%.`,
      );
    }

    const fees = (await db
      .select()
      .from(cdrFees)
      .where(eq(cdrFees.productId, pid))
      .all()) as CdrFee[];
    const features = (await db
      .select()
      .from(cdrFeatures)
      .where(eq(cdrFeatures.productId, pid))
      .all()) as CdrFeature[];

    const lendingSummary = lRates
      .map((lr) => `${lr.lendingRateType}: ${((lr.rate ?? 0) * 100).toFixed(2)}%`)
      .join('; ');
    const depositSummary = dRates
      .map((dr) => `${dr.depositRateType}: ${((dr.rate ?? 0) * 100).toFixed(2)}%`)
      .join('; ');
    const feeSummary = fees
      .map((f) => `${f.name}: ${f.amount ? `$${f.amount}` : 'varies'}`)
      .join('; ');
    const featureSummary = features.map((f) => f.featureType).join('; ');

    let doc = `Banking Product: ${product.name} by ${holderName}. Category: ${product.productCategory}. `;
    if (product.description) doc += `${product.description}. `;
    if (lendingSummary) doc += `Lending Rates: ${lendingSummary}. `;
    if (depositSummary) doc += `Deposit Rates: ${depositSummary}. `;
    if (feeSummary) doc += `Fees: ${feeSummary}. `;
    if (featureSummary) doc += `Features: ${featureSummary}. `;

    knowledgeTexts.push(doc.trim());
  }

  try {
    if (productTexts.length) await cogneeTools.index(productTexts, COGNEE_DATASETS.cdrProducts);
  } catch (err: unknown) {
    allErrors.push(`Product indexing: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    if (rateTexts.length) await cogneeTools.index(rateTexts, COGNEE_DATASETS.cdrRates);
  } catch (err: unknown) {
    allErrors.push(`Rate indexing: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    if (knowledgeTexts.length)
      await cogneeTools.index(knowledgeTexts, COGNEE_DATASETS.bankingProductKnowledge);
  } catch (err: unknown) {
    allErrors.push(`Knowledge indexing: ${err instanceof Error ? err.message : String(err)}`);
  }

  return {
    productsIndexed: productTexts.length,
    ratesIndexed: rateTexts.length,
    knowledgeDocsIndexed: knowledgeTexts.length,
    errors: allErrors,
    durationMs: Date.now() - start,
  };
}

/**
 * Incremental index: only re-index products updated since a given timestamp.
 */
export async function incrementalIndex(since: string): Promise<CdrIndexResult> {
  const start = Date.now();
  const allErrors: string[] = [];

  logger.info(`[CDR-Indexer] Incremental index for products updated since ${since}`);

  const updatedProducts = (await db
    .select()
    .from(cdrProducts)
    .where(gt(cdrProducts.updatedAt, since))
    .all()) as CdrProduct[];

  if (!updatedProducts?.length) {
    logger.info('[CDR-Indexer] No updated products found');
    return {
      productsIndexed: 0,
      ratesIndexed: 0,
      knowledgeDocsIndexed: 0,
      errors: [],
      durationMs: Date.now() - start,
    };
  }

  const productTexts: string[] = [];
  const rateTexts: string[] = [];
  const knowledgeTexts: string[] = [];

  for (const product of updatedProducts) {
    const pid = product.id;

    let holderName = product.brandName ?? product.brand ?? '';
    if (!holderName && product.dataHolderId) {
      const holder = (await db
        .select()
        .from(cdrDataHolders)
        .where(eq(cdrDataHolders.id, product.dataHolderId))
        .get()) as CdrDataHolder | undefined;
      holderName = holder?.brandName ?? product.dataHolderId ?? '';
    }

    productTexts.push(
      `Product: ${product.name}. Bank: ${holderName}. Category: ${product.productCategory}. ${product.description ?? ''}`.trim(),
    );

    const lRates = (await db
      .select()
      .from(cdrLendingRates)
      .where(eq(cdrLendingRates.productId, pid))
      .all()) as CdrLendingRate[];
    for (const lr of lRates) {
      const ratePercent = ((lr.rate ?? 0) * 100).toFixed(2);
      rateTexts.push(
        `Lending Rate: ${product.name} (${holderName}). Type: ${lr.lendingRateType}. Rate: ${ratePercent}%.` +
          (lr.comparisonRate ? ` Comparison: ${(lr.comparisonRate * 100).toFixed(2)}%.` : '') +
          (lr.repaymentType ? ` Repayment: ${lr.repaymentType}.` : ''),
      );
    }

    const dRates = (await db
      .select()
      .from(cdrDepositRates)
      .where(eq(cdrDepositRates.productId, pid))
      .all()) as CdrDepositRate[];
    for (const dr of dRates) {
      const ratePercent = ((dr.rate ?? 0) * 100).toFixed(2);
      rateTexts.push(
        `Deposit Rate: ${product.name} (${holderName}). Type: ${dr.depositRateType}. Rate: ${ratePercent}%.`,
      );
    }

    const fees = (await db
      .select()
      .from(cdrFees)
      .where(eq(cdrFees.productId, pid))
      .all()) as CdrFee[];
    const features = (await db
      .select()
      .from(cdrFeatures)
      .where(eq(cdrFeatures.productId, pid))
      .all()) as CdrFeature[];

    const lendingSummary = lRates
      .map((lr) => `${lr.lendingRateType}: ${((lr.rate ?? 0) * 100).toFixed(2)}%`)
      .join('; ');
    const depositSummary = dRates
      .map((dr) => `${dr.depositRateType}: ${((dr.rate ?? 0) * 100).toFixed(2)}%`)
      .join('; ');
    const feeSummary = fees
      .map((f) => `${f.name}: ${f.amount ? `$${f.amount}` : 'varies'}`)
      .join('; ');
    const featureSummary = features.map((f) => f.featureType).join('; ');

    let doc = `Banking Product: ${product.name} by ${holderName}. Category: ${product.productCategory}. `;
    if (product.description) doc += `${product.description}. `;
    if (lendingSummary) doc += `Lending Rates: ${lendingSummary}. `;
    if (depositSummary) doc += `Deposit Rates: ${depositSummary}. `;
    if (feeSummary) doc += `Fees: ${feeSummary}. `;
    if (featureSummary) doc += `Features: ${featureSummary}. `;

    knowledgeTexts.push(doc.trim());
  }

  try {
    if (productTexts.length) await cogneeTools.index(productTexts, COGNEE_DATASETS.cdrProducts);
  } catch (err: unknown) {
    allErrors.push(
      `Incremental product indexing: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  try {
    if (rateTexts.length) await cogneeTools.index(rateTexts, COGNEE_DATASETS.cdrRates);
  } catch (err: unknown) {
    allErrors.push(
      `Incremental rate indexing: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  try {
    if (knowledgeTexts.length)
      await cogneeTools.index(knowledgeTexts, COGNEE_DATASETS.bankingProductKnowledge);
  } catch (err: unknown) {
    allErrors.push(
      `Incremental knowledge indexing: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const datasetsToUpdate = [
    ...(productTexts.length ? [COGNEE_DATASETS.cdrProducts] : []),
    ...(rateTexts.length ? [COGNEE_DATASETS.cdrRates] : []),
    ...(knowledgeTexts.length ? [COGNEE_DATASETS.bankingProductKnowledge] : []),
  ];

  for (const dataset of datasetsToUpdate) {
    try {
      await cogneeTools.cognify(dataset);
    } catch (err: unknown) {
      allErrors.push(
        `Incremental cognify ${dataset}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  const durationMs = Date.now() - start;
  logger.info(
    `[CDR-Indexer] Incremental: ${productTexts.length} products, ${rateTexts.length} rates, ${knowledgeTexts.length} knowledge docs in ${durationMs}ms`,
  );

  return {
    productsIndexed: productTexts.length,
    ratesIndexed: rateTexts.length,
    knowledgeDocsIndexed: knowledgeTexts.length,
    errors: allErrors,
    durationMs,
  };
}
