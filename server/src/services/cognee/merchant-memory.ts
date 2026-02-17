/**
 * Cognee Client — Merchant Memory Functions
 *
 * Merchant name normalization and pattern learning:
 * - storeMerchantMapping: save a merchant→category mapping
 * - lookupMerchant: find canonical name + category for a transaction
 * - updateMerchantFromCorrection: learn from user corrections
 * - batchLookupMerchants: bulk merchant lookups
 */

import { logger } from '../../lib/logger.js';
import type { AuthState } from './auth.js';
import { addData } from './data-ops.js';
import { search } from './search.js';

/**
 * Store a merchant mapping for future categorization.
 */
export async function storeMerchantMapping(
  state: AuthState,
  merchant: string,
  category: string,
  userId?: string,
  tenantId?: string,
): Promise<void> {
  const text = `Merchant: "${merchant}" → Category: "${category}"`;
  await addData(state, [text], 'merchant_data', userId, tenantId);
  logger.info(`[MerchantMemory] Stored mapping: ${merchant} → ${category}`);
}

/**
 * Look up a merchant's canonical name and category from learned patterns.
 */
export async function lookupMerchant(
  state: AuthState,
  rawDescription: string,
  userId?: string,
  tenantId?: string,
): Promise<{ canonicalName?: string; category?: string } | null> {
  try {
    const results = await search(
      state,
      rawDescription,
      'merchant_data',
      3,
      'CHUNKS_LEXICAL',
      userId,
      tenantId,
    );

    if (results.length === 0) return null;

    // Parse first result: "Merchant: \"X\" → Category: \"Y\""
    const match = results[0].match(/Merchant:\s*"([^"]+)"\s*→\s*Category:\s*"([^"]+)"/);
    if (!match) return null;

    return {
      canonicalName: match[1],
      category: match[2],
    };
  } catch (err) {
    logger.warn({ err: err }, '[MerchantMemory] Lookup error:');
    return null;
  }
}

/**
 * Update merchant memory from a user correction.
 * Stores the correction and triggers memify for pattern learning.
 */
export async function updateMerchantFromCorrection(
  state: AuthState,
  rawDescription: string,
  oldCategory: string,
  newCategory: string,
  userId?: string,
  tenantId?: string,
): Promise<void> {
  const text = `Correction: "${rawDescription}" changed from "${oldCategory}" to "${newCategory}"`;
  await addData(state, [text], 'merchant_data', userId, tenantId);
  logger.info(`[MerchantMemory] Stored correction: ${rawDescription} → ${newCategory}`);
}

/**
 * Batch lookup multiple merchants at once.
 * Returns a map of rawDescription → { canonicalName, category }.
 */
export async function batchLookupMerchants(
  state: AuthState,
  descriptions: string[],
  userId?: string,
  tenantId?: string,
): Promise<Map<string, { canonicalName?: string; category?: string }>> {
  const results = new Map<string, { canonicalName?: string; category?: string }>();

  for (const desc of descriptions) {
    const lookup = await lookupMerchant(state, desc, userId, tenantId);
    if (lookup) {
      results.set(desc, lookup);
    }
  }

  return results;
}
