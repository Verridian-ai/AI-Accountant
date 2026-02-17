/**
 * Cognee Client — Data Operations
 *
 * Add data and domain convenience methods:
 * - addData: low-level add via FormData
 * - addStatementData, addTransaction, addCorrection
 * - searchSimilarTransactions, getCategoryPatterns, traceAccountFlows, getGSTRuling
 * - Merchant memory: storeMerchantMapping, lookupMerchant, updateMerchantFromCorrection,
 *   batchLookupMerchants
 */

import { logger } from '../../lib/logger.js';
import { REQUEST_TIMEOUT_MS } from './types.js';
import type { AuthState } from './auth.js';
import { buildAuthHeaders } from './auth.js';
import { applyTenantPrefix } from './tenant.js';
import { search } from './search.js';

// ============================================================================
// Low-level add
// ============================================================================

/**
 * Add text data to a Cognee dataset via multipart FormData.
 */
export async function addData(
  state: AuthState,
  data: string[],
  dataset: string,
  userId?: string,
  tenantId?: string,
): Promise<void> {
  try {
    const prefixedDataset = applyTenantPrefix(dataset, tenantId);
    const content = data.join('\n\n');
    const formData = new FormData();
    formData.append(
      'data',
      new Blob([content], { type: 'text/plain' }),
      `${prefixedDataset}.txt`,
    );
    formData.append('datasetName', prefixedDataset);

    const auth = await buildAuthHeaders(state, userId);
    const res = await fetch(`${state.baseUrl}/api/v1/add`, {
      method: 'POST',
      headers: { ...auth },
      body: formData,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      logger.warn(`[CogneeClient] Add failed: ${res.status}`);
    }
  } catch (err) {
    logger.warn({ err: err }, '[CogneeClient] Add error:');
  }
}

/**
 * F5: Add data with NodeSet tagging (3-dimensional tagging strategy)
 *
 * Enhanced data ingestion that tags data with NodeSets across:
 * - Temporal: FY2024-25, Q1-Q4, YYYY-MM
 * - Categorical: tax_deductions, gst_applicable, gst_free, income, expenses
 * - Account: account_123456
 *
 * NodeSets enable scoped searches like "Q3 only" or "account 123456 only".
 *
 * @param data - Array of text strings to add
 * @param dataset - Dataset name (will be tenant-prefixed)
 * @param nodeSets - Array of NodeSet tags to apply to this data
 * @param userId - Optional user ID for auth
 * @param tenantId - Optional tenant ID for dataset prefixing
 */
export async function addDataWithNodeSets(
  state: AuthState,
  data: string[],
  dataset: string,
  nodeSets: string[],
  userId?: string,
  tenantId?: string,
): Promise<void> {
  try {
    const prefixedDataset = applyTenantPrefix(dataset, tenantId);
    const content = data.join('\n\n');
    const formData = new FormData();
    formData.append(
      'data',
      new Blob([content], { type: 'text/plain' }),
      `${prefixedDataset}.txt`,
    );
    formData.append('datasetName', prefixedDataset);
    formData.append('node_set', JSON.stringify(nodeSets));

    const auth = await buildAuthHeaders(state, userId);
    const res = await fetch(`${state.baseUrl}/api/v1/add`, {
      method: 'POST',
      headers: { ...auth },
      body: formData,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.warn(`[CogneeClient] AddWithNodeSets failed: ${res.status} ${body}`);
    } else {
      logger.info(
        `[CogneeClient] Added data to ${prefixedDataset} with NodeSets: ${nodeSets.join(', ')}`,
      );
    }
  } catch (err) {
    logger.warn({ err: err }, '[CogneeClient] AddWithNodeSets error:');
  }
}

// ============================================================================
// Domain Convenience Methods (with userId passthrough)
// ============================================================================

/**
 * Add statement data to Cognee for knowledge graph building.
 */
export async function addStatementData(
  state: AuthState,
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
  await addData(state, [text], 'bank_formats', userId, tenantId);
}

/**
 * Add a transaction to Cognee for merchant memory and pattern learning.
 */
export async function addTransaction(
  state: AuthState,
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
  await addData(state, [text], 'bank_transactions', userId, tenantId);
}

/**
 * Search for similar transactions by description.
 * Uses CHUNKS for fast vector similarity (no LLM call needed).
 */
export async function searchSimilarTransactions(
  state: AuthState,
  description: string,
  userId?: string,
  tenantId?: string,
): Promise<string[]> {
  return search(state, description, 'bank_transactions', 5, 'CHUNKS', userId, tenantId);
}

/**
 * Get category patterns from knowledge graph.
 * Uses GRAPH_COMPLETION for reasoning about patterns.
 */
export async function getCategoryPatterns(
  state: AuthState,
  category: string,
  userId?: string,
  tenantId?: string,
): Promise<string[]> {
  return search(
    state,
    `category patterns for ${category}`,
    'bank_transactions',
    5,
    'GRAPH_COMPLETION',
    userId,
    tenantId,
  );
}

/**
 * Trace account flows via knowledge graph.
 * Uses GRAPH_COMPLETION_COT for chain-of-thought reasoning over flows.
 */
export async function traceAccountFlows(
  state: AuthState,
  accountId: string,
  userId?: string,
  tenantId?: string,
): Promise<string[]> {
  return search(
    state,
    `money flows for account ${accountId}`,
    'transfer_patterns',
    5,
    'GRAPH_COMPLETION_COT',
    userId,
    tenantId,
  );
}

/**
 * Search for GST ruling guidance.
 * Uses RAG_COMPLETION for retrieval-augmented generation.
 */
export async function getGSTRuling(
  state: AuthState,
  transactionType: string,
  userId?: string,
  tenantId?: string,
): Promise<string[]> {
  return search(
    state,
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
  state: AuthState,
  transactionId: string,
  description: string,
  oldCategory: string,
  newCategory: string,
  userId?: string,
  tenantId?: string,
): Promise<void> {
  const text = `Correction: "${description}" changed from "${oldCategory}" to "${newCategory}" (transaction ${transactionId})`;
  await addData(state, [text], 'bank_transactions', userId, tenantId);
}

// Re-export merchant memory functions for backward compatibility
export {
  storeMerchantMapping,
  lookupMerchant,
  updateMerchantFromCorrection,
  batchLookupMerchants,
} from './merchant-memory.js';
