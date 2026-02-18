/**
 * Domain Convenience Methods — financial-domain wrappers over add/search.
 *
 * Exposes: addStatementData, addTransaction, searchSimilarTransactions,
 * getCategoryPatterns, traceAccountFlows, getGSTRuling, addCorrection,
 * storeMerchantMapping, lookupMerchant, updateMerchantFromCorrection, batchLookupMerchants.
 *
 * All functions take a CogneeClientContext as the first parameter.
 */

import type { CogneeSearchResult } from './types.js';
import type { CogneeClientContext } from './client-context.js';
import { add, searchRich, search } from './http-primitives.js';

/**
 * Add statement data to Cognee for knowledge graph building.
 */
export async function addStatementData(
  ctx: CogneeClientContext,
  statement: {
    id: string;
    filename: string;
    bankName?: string;
    periodStart?: string;
    periodEnd?: string;
  },
  userId?: string,
  tenantId?: string,
): Promise<void> {
  const text = `Statement: ${statement.filename}, Bank: ${statement.bankName || 'Unknown'}, Period: ${statement.periodStart || 'N/A'} to ${statement.periodEnd || 'N/A'}`;
  await add(ctx, [text], 'bank_formats', userId, tenantId);
}

/**
 * Add a transaction to Cognee for merchant memory and pattern learning.
 */
export async function addTransaction(
  ctx: CogneeClientContext,
  transaction: {
    date: string;
    description: string;
    amount: number;
    category?: string;
    gstApplicable?: boolean;
  },
  userId?: string,
  tenantId?: string,
): Promise<void> {
  const text = `Date: ${transaction.date}, Description: ${transaction.description}, Amount: ${transaction.amount / 100}, Category: ${transaction.category || 'Uncategorized'}, GST: ${transaction.gstApplicable ? 'Yes' : 'No'}`;
  await add(ctx, [text], 'bank_transactions', userId, tenantId);
}

/**
 * Search for similar transactions by description (CHUNKS — fast vector similarity).
 */
export async function searchSimilarTransactions(
  ctx: CogneeClientContext,
  description: string,
  userId?: string,
  tenantId?: string,
): Promise<string[]> {
  return search(ctx, description, 'bank_transactions', 5, 'CHUNKS', userId, tenantId);
}

/**
 * Get category patterns from knowledge graph (GRAPH_COMPLETION — reasoning).
 */
export async function getCategoryPatterns(
  ctx: CogneeClientContext,
  category: string,
  userId?: string,
  tenantId?: string,
): Promise<string[]> {
  return search(
    ctx,
    `category patterns for ${category}`,
    'bank_transactions',
    5,
    'GRAPH_COMPLETION',
    userId,
    tenantId,
  );
}

/**
 * Trace account flows via knowledge graph (GRAPH_COMPLETION_COT — chain-of-thought reasoning).
 */
export async function traceAccountFlows(
  ctx: CogneeClientContext,
  accountId: string,
  userId?: string,
  tenantId?: string,
): Promise<string[]> {
  return search(
    ctx,
    `money flows for account ${accountId}`,
    'transfer_patterns',
    5,
    'GRAPH_COMPLETION_COT',
    userId,
    tenantId,
  );
}

/**
 * Search for GST ruling guidance (RAG_COMPLETION — retrieval-augmented generation).
 */
export async function getGSTRuling(
  ctx: CogneeClientContext,
  transactionType: string,
  userId?: string,
  tenantId?: string,
): Promise<string[]> {
  return search(
    ctx,
    `GST treatment for ${transactionType}`,
    'gst_rules',
    5,
    'RAG_COMPLETION',
    userId,
    tenantId,
  );
}

/**
 * Add a user correction for learning.
 */
export async function addCorrection(
  ctx: CogneeClientContext,
  transactionId: string,
  description: string,
  oldCategory: string,
  newCategory: string,
  userId?: string,
  tenantId?: string,
): Promise<void> {
  const text = `Correction: "${description}" changed from "${oldCategory}" to "${newCategory}" (transaction ${transactionId})`;
  await add(ctx, [text], 'bank_transactions', userId, tenantId);
}

/**
 * Store a merchant mapping in Cognee for future reference.
 */
export async function storeMerchantMapping(
  ctx: CogneeClientContext,
  abbreviated: string,
  canonical: string,
  abn?: string,
  gstRegistered?: boolean,
  industry?: string,
  defaultCategory?: string,
  userId?: string,
  tenantId?: string,
): Promise<void> {
  const mappingData = JSON.stringify({
    type: 'merchant_mapping',
    abbreviated,
    canonical,
    abn: abn || null,
    gstRegistered: gstRegistered ?? true,
    industry: industry || 'Unknown',
    defaultCategory: defaultCategory || 'General Expenses',
    lastVerified: new Date().toISOString(),
  });

  const text = `Merchant: "${abbreviated}" → "${canonical}", ABN: ${abn || 'N/A'}, GST: ${gstRegistered ? 'Yes' : 'No'}, Industry: ${industry || 'Unknown'}, Category: ${defaultCategory || 'General'}`;
  await add(ctx, [text, mappingData], 'merchant_mappings', userId, tenantId);
}

/**
 * Look up a previously mapped merchant (CHUNKS_LEXICAL — fast keyword matching).
 */
export async function lookupMerchant(
  ctx: CogneeClientContext,
  abbreviated: string,
  userId?: string,
  tenantId?: string,
): Promise<{
  found: boolean;
  canonical?: string;
  abn?: string;
  gstRegistered?: boolean;
  industry?: string;
  defaultCategory?: string;
}> {
  const results: CogneeSearchResult[] = await searchRich(
    ctx,
    `merchant mapping for "${abbreviated}"`,
    'merchant_mappings',
    5,
    'CHUNKS_LEXICAL',
    userId,
    tenantId,
  );

  if (results.length === 0) {
    return { found: false };
  }

  for (const result of results) {
    try {
      const parsed = JSON.parse(result.text);
      if (parsed.type === 'merchant_mapping') {
        return {
          found: true,
          canonical: parsed.canonical,
          abn: parsed.abn,
          gstRegistered: parsed.gstRegistered,
          industry: parsed.industry,
          defaultCategory: parsed.defaultCategory,
        };
      }
    } catch {
      if (
        result.text.includes(abbreviated) ||
        result.text.toLowerCase().includes(abbreviated.toLowerCase())
      ) {
        return { found: true };
      }
    }
  }

  return { found: results.length > 0 };
}

/**
 * Update merchant mapping from a user correction — learns from edits.
 */
export async function updateMerchantFromCorrection(
  ctx: CogneeClientContext,
  transactionId: string,
  description: string,
  correctedCategory: string,
  correctedMerchant?: string,
  userId?: string,
  tenantId?: string,
): Promise<void> {
  const correctionText = `Merchant correction: "${description}" → Category: "${correctedCategory}"${correctedMerchant ? `, Merchant: "${correctedMerchant}"` : ''}`;
  await add(ctx, [correctionText], 'merchant_mappings', userId, tenantId);

  const correctionData = JSON.stringify({
    type: 'merchant_correction',
    transactionId,
    originalDescription: description,
    correctedCategory,
    correctedMerchant: correctedMerchant || null,
    timestamp: new Date().toISOString(),
  });
  await add(ctx, [correctionData], 'merchant_corrections', userId, tenantId);
}

/**
 * Batch enrich uncategorized merchants through Cognee.
 */
export async function batchLookupMerchants(
  ctx: CogneeClientContext,
  descriptions: string[],
  userId?: string,
  tenantId?: string,
): Promise<
  Array<{
    description: string;
    found: boolean;
    canonical?: string;
    category?: string;
    gstRegistered?: boolean;
  }>
> {
  const results: Array<{
    description: string;
    found: boolean;
    canonical?: string;
    category?: string;
    gstRegistered?: boolean;
  }> = [];

  for (const desc of descriptions) {
    const lookup = await lookupMerchant(ctx, desc, userId, tenantId);
    results.push({
      description: desc,
      found: lookup.found,
      canonical: lookup.canonical,
      category: lookup.defaultCategory,
      gstRegistered: lookup.gstRegistered,
    });
  }

  return results;
}
