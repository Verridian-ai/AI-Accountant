/**
 * Financial Boost Calculations
 *
 * Individual boost calculation functions for merchant, category,
 * recency, amount, and account matching.
 */

import type {
  FinancialBoostConfig,
  FinancialContext,
  DocumentFinancialMetadata,
  BoostBreakdown,
} from './financial-boost-types.js';

// ============================================================================
// BOOST CALCULATORS
// ============================================================================

export function calculateMerchantBoost(
  metadata: DocumentFinancialMetadata,
  context: FinancialContext,
  config: FinancialBoostConfig,
): number {
  if (!metadata.merchantNormalized || !context.queryMerchants?.length) return 0;

  const docMerchant = metadata.merchantNormalized.toLowerCase();

  for (const queryMerchant of context.queryMerchants) {
    if (docMerchant === queryMerchant) return config.merchantMatchBoost;
    if (docMerchant.includes(queryMerchant) || queryMerchant.includes(docMerchant)) {
      return config.merchantMatchBoost * 0.7;
    }

    const docWords = docMerchant.split(/\s+/);
    const queryWords = queryMerchant.split(/\s+/);
    const overlap = docWords.filter((w) => queryWords.includes(w)).length;
    if (overlap > 0) {
      const overlapRatio = overlap / Math.max(docWords.length, queryWords.length);
      return config.merchantMatchBoost * overlapRatio * 0.5;
    }
  }

  if (context.queryKeywords?.length) {
    for (const keyword of context.queryKeywords) {
      if (docMerchant.includes(keyword)) return config.merchantMatchBoost * 0.3;
    }
  }

  return 0;
}

export function calculateCategoryBoost(
  metadata: DocumentFinancialMetadata,
  context: FinancialContext,
  config: FinancialBoostConfig,
): number {
  if (!metadata.category || !context.queryCategories?.length) return 0;

  const docCategory = metadata.category.toLowerCase();

  for (const queryCategory of context.queryCategories) {
    if (docCategory === queryCategory) return config.categoryMatchBoost;
    if (docCategory.includes(queryCategory) || queryCategory.includes(docCategory)) {
      return config.categoryMatchBoost * 0.7;
    }
  }

  if (context.queryKeywords?.length) {
    for (const keyword of context.queryKeywords) {
      if (docCategory.includes(keyword)) return config.categoryMatchBoost * 0.4;
    }
  }

  return 0;
}

export function calculateRecencyBoost(
  metadata: DocumentFinancialMetadata,
  context: FinancialContext,
  config: FinancialBoostConfig,
): number {
  if (!metadata.dateStart && !metadata.dateEnd) return 0;

  const queryDate = context.queryDate || new Date();
  const docDateStr = metadata.dateEnd || metadata.dateStart;
  if (!docDateStr) return 0;

  const docDate = new Date(docDateStr);
  const daysDiff = Math.abs((queryDate.getTime() - docDate.getTime()) / (1000 * 60 * 60 * 24));

  if (daysDiff <= config.recencyFullBoostDays) return config.maxRecencyBoost;
  if (daysDiff >= config.recencyZeroBoostDays) return 0;

  const range = config.recencyZeroBoostDays - config.recencyFullBoostDays;
  const position = daysDiff - config.recencyFullBoostDays;
  return config.maxRecencyBoost * (1 - position / range);
}

export function calculateAmountBoost(
  metadata: DocumentFinancialMetadata,
  context: FinancialContext,
  config: FinancialBoostConfig,
): number {
  if (!context.queryAmountRange) return 0;

  const amount = metadata.totalAmount ?? metadata.amount;
  if (amount === undefined) return 0;

  const { min, max } = context.queryAmountRange;
  const absAmount = Math.abs(amount);

  if (min !== undefined && max !== undefined) {
    if (absAmount >= min && absAmount <= max) return config.amountRangeBoost;
    const margin = (max - min) * 0.2;
    if (absAmount >= min - margin && absAmount <= max + margin) {
      return config.amountRangeBoost * 0.5;
    }
  } else if (min !== undefined) {
    if (absAmount >= min) return config.amountRangeBoost;
  } else if (max !== undefined) {
    if (absAmount <= max) return config.amountRangeBoost;
  }

  return 0;
}

export function calculateAccountBoost(
  metadata: DocumentFinancialMetadata,
  context: FinancialContext,
  config: FinancialBoostConfig,
): number {
  if (!metadata.accountId || !context.queryAccountIds?.length) return 0;
  return context.queryAccountIds.includes(metadata.accountId) ? config.accountMatchBoost : 0;
}

// ============================================================================
// COMPOSITE
// ============================================================================

export function calculateAllBoosts(
  metadata: DocumentFinancialMetadata | undefined,
  context: FinancialContext,
  config: FinancialBoostConfig,
): BoostBreakdown {
  if (!metadata) {
    return { merchantBoost: 0, categoryBoost: 0, recencyBoost: 0, amountBoost: 0, accountBoost: 0 };
  }

  return {
    merchantBoost: calculateMerchantBoost(metadata, context, config),
    categoryBoost: calculateCategoryBoost(metadata, context, config),
    recencyBoost: calculateRecencyBoost(metadata, context, config),
    amountBoost: calculateAmountBoost(metadata, context, config),
    accountBoost: calculateAccountBoost(metadata, context, config),
  };
}

export function sumBoosts(breakdown: BoostBreakdown): number {
  return (
    breakdown.merchantBoost +
    breakdown.categoryBoost +
    breakdown.recencyBoost +
    breakdown.amountBoost +
    breakdown.accountBoost
  );
}
