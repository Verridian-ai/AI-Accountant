/**
 * Asset Management Agent — Tool Handler Helpers
 *
 * Extracted depreciation method suggestion and write-off eligibility
 * checking logic to keep the main agent file under 300 lines.
 */

import { cogneeTools } from '../cognee-tools.js';
import {
  INSTANT_WRITE_OFF_THRESHOLD,
  SBE_TURNOVER_THRESHOLD,
} from './asset-management-agent.tools.js';

/**
 * Suggest the optimal depreciation method for an asset based on ATO rules.
 */
export async function suggestDepreciationMethod(input: Record<string, unknown>) {
  const assetCategory = input.assetCategory as string;
  const purchasePrice = input.purchasePrice as number;
  const entityType = input.entityType as string;
  const isSmallBusinessEntity = (input.isSmallBusinessEntity as boolean) ?? false;
  const expectedUsefulLife = (input.expectedUsefulLife as number) ?? 10;
  const businessUsePercentage = (input.businessUsePercentage as number) ?? 100;

  let recommendedMethod: string;
  let reason: string;
  let atoReference: string;
  let estimatedFirstYearDeduction: number;

  // ATO decision tree
  if (isSmallBusinessEntity && purchasePrice < INSTANT_WRITE_OFF_THRESHOLD) {
    recommendedMethod = 'instant_write_off';
    reason = `Asset cost ($${(purchasePrice / 100).toFixed(2)}) is under the $20,000 SBE instant write-off threshold. Full deduction in the year of purchase.`;
    atoReference = 'TD 2024/1 — Instant asset write-off for SBEs';
    estimatedFirstYearDeduction = Math.round(purchasePrice * (businessUsePercentage / 100));
  } else if (expectedUsefulLife <= 2) {
    recommendedMethod = 'low_value_pool';
    reason = `Asset WDV will fall below $1,000 within 2 years. Low value pool (37.5% first year, 30% subsequent) is more efficient.`;
    atoReference = 'Div 40 ITAA 1997 s.40-425 — Low value pool';
    estimatedFirstYearDeduction = Math.round(purchasePrice * 0.375 * (businessUsePercentage / 100));
  } else if (entityType === 'company') {
    recommendedMethod = 'diminishing_value';
    reason = `Companies benefit from front-loaded deductions via diminishing value method (200% rate). Higher deductions in early years reduce taxable income faster.`;
    atoReference = 'TR 2024/3 — Effective life, Div 40 s.40-72 DV formula';
    const dvRate = 2 / expectedUsefulLife;
    estimatedFirstYearDeduction = Math.round(
      purchasePrice * dvRate * (businessUsePercentage / 100),
    );
  } else if (expectedUsefulLife > 10) {
    recommendedMethod = 'straight_line';
    reason = `Asset has a long effective life (${expectedUsefulLife} years). Straight-line method provides predictable, even deductions for better budget planning.`;
    atoReference = 'TR 2024/3 — Effective life, Div 40 s.40-70 SL formula';
    estimatedFirstYearDeduction = Math.round(
      (purchasePrice / expectedUsefulLife) * (businessUsePercentage / 100),
    );
  } else {
    recommendedMethod = 'diminishing_value';
    reason = `Diminishing value is the ATO default method for most assets. Provides higher deductions in early years when the asset depreciates fastest.`;
    atoReference = 'TR 2024/3 — Effective life, Div 40 s.40-72 DV formula';
    const dvRate = 2 / expectedUsefulLife;
    estimatedFirstYearDeduction = Math.round(
      purchasePrice * dvRate * (businessUsePercentage / 100),
    );
  }

  // Search Cognee for any domain-specific advice
  let cogneeAdvice: string | null = null;
  try {
    const results = await cogneeTools.search(
      'depreciation method ' + assetCategory,
      'asset_register',
    );
    if (results.length > 0) {
      cogneeAdvice = JSON.stringify(results.slice(0, 3));
    }
  } catch {
    // Cognee unavailable — proceed without RAG
  }

  return {
    recommendedMethod,
    reason,
    atoReference,
    estimatedFirstYearDeduction,
    businessUsePercentage,
    cogneeAdvice,
  };
}

/**
 * Check if an asset qualifies for instant write-off per ATO rules.
 */
export async function checkWriteOffEligibility(input: Record<string, unknown>) {
  const purchasePrice = input.purchasePrice as number;
  const purchaseDate = input.purchaseDate as string;
  const entityType = input.entityType as string;
  const aggregatedTurnover = (input.aggregatedTurnover as number) ?? 0;

  const purchaseDateObj = new Date(purchaseDate);
  const purchaseYear = purchaseDateObj.getFullYear();
  const purchaseMonth = purchaseDateObj.getMonth(); // 0-indexed

  // Determine FY of purchase
  const fyStartYear = purchaseMonth >= 6 ? purchaseYear : purchaseYear - 1;

  let eligible = false;
  let threshold = 0;
  let reason: string;
  let atoReference: string;

  // Temporary full expensing ended 30 June 2023
  if (fyStartYear < 2023) {
    eligible = true;
    threshold = Number.MAX_SAFE_INTEGER;
    reason =
      'Temporary full expensing applied (no cost limit) for assets first used or installed ready for use by 30 June 2023.';
    atoReference = 'Treasury Laws Amendment (2021 Measures No. 2)';
  } else if (fyStartYear === 2023) {
    const isSBE =
      aggregatedTurnover > 0
        ? aggregatedTurnover < SBE_TURNOVER_THRESHOLD
        : entityType === 'sole_trader' || entityType === 'small_business';

    threshold = INSTANT_WRITE_OFF_THRESHOLD;

    if (!isSBE) {
      eligible = false;
      reason = `Instant asset write-off is only available to small business entities (aggregated turnover < $10M). Entity type: ${entityType}.`;
    } else if (purchasePrice >= threshold) {
      eligible = false;
      reason = `Asset cost ($${(purchasePrice / 100).toFixed(2)}) exceeds the $20,000 instant write-off threshold for FY 2023-24.`;
    } else {
      eligible = true;
      reason = `Asset qualifies for instant write-off: cost ($${(purchasePrice / 100).toFixed(2)}) is under $20,000 threshold and entity qualifies as SBE.`;
    }
    atoReference = 'TD 2024/1 — Instant asset write-off';
  } else {
    threshold = INSTANT_WRITE_OFF_THRESHOLD;
    let cogneeThreshold: number | null = null;

    try {
      const results = await cogneeTools.search(
        'instant asset write-off threshold ' + `${fyStartYear}-${String(fyStartYear + 1).slice(2)}`,
        'ato_rulings',
      );
      if (results.length > 0) {
        const thresholdMatch = JSON.stringify(results).match(/\$(\d[\d,]*)/);
        if (thresholdMatch) {
          cogneeThreshold = parseFloat(thresholdMatch[1].replace(/,/g, '')) * 100;
        }
      }
    } catch {
      // Cognee unavailable
    }

    if (cogneeThreshold !== null) {
      threshold = cogneeThreshold;
    }

    const isSBE =
      aggregatedTurnover > 0
        ? aggregatedTurnover < SBE_TURNOVER_THRESHOLD
        : entityType === 'sole_trader' || entityType === 'small_business';

    if (!isSBE) {
      eligible = false;
      reason = `Instant asset write-off is only available to small business entities (aggregated turnover < $10M).`;
    } else if (purchasePrice >= threshold) {
      eligible = false;
      reason = `Asset cost ($${(purchasePrice / 100).toFixed(2)}) exceeds the $${(threshold / 100).toFixed(0)} threshold for FY ${fyStartYear}-${String(fyStartYear + 1).slice(2)}.`;
    } else {
      eligible = true;
      reason = `Asset qualifies for instant write-off: cost under $${(threshold / 100).toFixed(0)} threshold for SBE in FY ${fyStartYear}-${String(fyStartYear + 1).slice(2)}.`;
    }
    atoReference =
      cogneeThreshold !== null
        ? 'ATO — Updated instant write-off threshold (via Cognee)'
        : 'TD 2024/1 — Instant asset write-off (default threshold)';
  }

  return { eligible, threshold, reason, atoReference };
}
