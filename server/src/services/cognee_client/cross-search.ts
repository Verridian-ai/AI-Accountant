/**
 * Cross-Dataset & Session-Aware Search — Wave 3 multi-dataset and tenant search.
 *
 * Exposes: crossDatasetSearch, searchWithSession, searchAcrossTenants.
 * All functions take a CogneeClientContext as the first parameter.
 */

import type { CogneeSearchType, CogneeSearchResult } from './types.js';
import { REQUEST_TIMEOUT_MS } from './config.js';
import type { CogneeClientContext } from './client-context.js';
import { applyTenantPrefix, applyTenantPrefixToAll, getTenantDatasetName } from './tenant-utils.js';
import { parseSearchResult } from './http-primitives.js';

/**
 * Search across multiple datasets and merge results (Wave 3).
 * Used by market-cognee-indexer and cdr-cognee-indexer for cross-domain queries.
 *
 * When called from searchAcrossTenants, datasets are already prefixed.
 * When called directly, tenantId can be passed to prefix all datasets.
 */
export async function crossDatasetSearch(
  ctx: CogneeClientContext,
  query: string,
  datasets: string[],
  options?: {
    searchType?: CogneeSearchType;
    topK?: number;
    mergeResults?: boolean;
  },
  userId?: string,
  tenantId?: string,
): Promise<CogneeSearchResult[]> {
  const searchType = options?.searchType ?? 'CHUNKS';
  const topK = options?.topK ?? 5;
  const prefixedDatasets = applyTenantPrefixToAll(datasets, tenantId);

  try {
    const auth = await ctx.authHeaders(userId);
    const res = await fetch(`${ctx.baseUrl}/api/v1/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify({
        query,
        search_type: searchType,
        datasets: prefixedDatasets,
        top_k: topK,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[CogneeClient] Cross-dataset search failed: ${res.status}`);
      return [];
    }
    const data = await res.json();
    if (Array.isArray(data)) {
      return data.map((item: unknown) => parseSearchResult(item));
    }
    return [];
  } catch (err) {
    console.warn('[CogneeClient] Cross-dataset search error:', err);
    return [];
  }
}

/**
 * Search with conversational session context (Wave 3).
 * Passes session_id to Cognee for memory-aware retrieval.
 */
export async function searchWithSession(
  ctx: CogneeClientContext,
  query: string,
  dataset: string,
  sessionId: string,
  topK: number = 5,
  searchType: CogneeSearchType = 'CHUNKS',
  userId?: string,
  tenantId?: string,
): Promise<CogneeSearchResult[]> {
  try {
    const prefixedDataset = applyTenantPrefix(dataset, tenantId);
    const auth = await ctx.authHeaders(userId);
    const res = await fetch(`${ctx.baseUrl}/api/v1/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify({
        query,
        search_type: searchType,
        datasets: [prefixedDataset],
        top_k: topK,
        session_id: sessionId,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[CogneeClient] Session search failed: ${res.status}`);
      return [];
    }
    const data = await res.json();
    if (Array.isArray(data)) {
      return data.map((item: unknown) => parseSearchResult(item));
    }
    return [];
  } catch (err) {
    console.warn('[CogneeClient] Session search error:', err);
    return [];
  }
}

/**
 * Search across multiple tenants' datasets (admin-only).
 * Combines datasets from all specified tenants and runs a single search.
 */
export async function searchAcrossTenants(
  ctx: CogneeClientContext,
  query: string,
  datasets: string[],
  tenantIds: string[],
  options?: {
    searchType?: CogneeSearchType;
    topK?: number;
  },
  userId?: string,
): Promise<CogneeSearchResult[]> {
  const allDatasets = tenantIds.flatMap((tid) =>
    datasets.map((ds) => getTenantDatasetName(tid, ds)),
  );
  return crossDatasetSearch(
    ctx,
    query,
    allDatasets,
    {
      searchType: options?.searchType ?? 'CHUNKS',
      topK: options?.topK ?? 5,
    },
    userId,
  );
}
