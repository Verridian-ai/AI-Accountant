/**
 * Cognee Client — Advanced Search Operations
 *
 * Specialized search operations extracted from search.ts for file-size compliance:
 * - searchAcrossTenants: admin cross-tenant search
 * - searchWithNodeSets: NodeSet-scoped search (F5)
 */

import { logger } from '../../lib/logger.js';
import { REQUEST_TIMEOUT_MS, type CogneeSearchType, type CogneeSearchResult } from './types.js';
import type { AuthState } from './auth.js';
import { buildAuthHeaders } from './auth.js';
import { applyTenantPrefix } from './tenant.js';
import { crossDatasetSearch, parseSearchResult } from './search.js';

/**
 * Search across multiple tenants' datasets (admin-only).
 * Combines datasets from all specified tenants and runs a single search.
 */
export async function searchAcrossTenants(
  state: AuthState,
  query: string,
  datasets: string[],
  tenantIds: string[],
  options?: {
    searchType?: CogneeSearchType;
    topK?: number;
  },
  userId?: string,
): Promise<CogneeSearchResult[]> {
  const { getTenantDatasetName } = await import('./tenant.js');
  const allDatasets = tenantIds.flatMap((tid) =>
    datasets.map((ds) => getTenantDatasetName(tid, ds)),
  );
  return crossDatasetSearch(
    state,
    query,
    allDatasets,
    {
      searchType: options?.searchType ?? 'CHUNKS',
      topK: options?.topK ?? 5,
    },
    userId,
  );
}

/**
 * F5: Search with NodeSet scoping (3-dimensional filtering)
 *
 * Scoped search that only retrieves results from nodes tagged with specific NodeSets.
 * Enables queries like:
 * - "Q3 only" → nodeSets: ['Q3']
 * - "Account 123456 work expenses" → nodeSets: ['account_123456', 'work-related']
 * - "FY2024-25 GST transactions" → nodeSets: ['FY2024-25', 'gst_applicable']
 *
 * @param query - Search query text
 * @param dataset - Dataset to search
 * @param nodeSets - Array of NodeSet tags to scope the search
 * @param topK - Number of results (default: 5)
 * @param searchType - Cognee search type (default: GRAPH_COMPLETION)
 * @param userId - Optional user ID for auth
 * @param tenantId - Optional tenant ID for dataset prefixing
 */
export async function searchWithNodeSets(
  state: AuthState,
  query: string,
  dataset: string,
  nodeSets: string[],
  topK: number = 5,
  searchType: CogneeSearchType = 'GRAPH_COMPLETION',
  userId?: string,
  tenantId?: string,
): Promise<CogneeSearchResult[]> {
  try {
    const prefixedDataset = applyTenantPrefix(dataset, tenantId);
    const auth = await buildAuthHeaders(state, userId);
    const res = await fetch(`${state.baseUrl}/api/v1/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify({
        query,
        search_type: searchType,
        datasets: [prefixedDataset],
        top_k: topK,
        node_sets: nodeSets,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.warn(`[CogneeClient] SearchWithNodeSets failed: ${res.status} ${body}`);
      return [];
    }
    const data = await res.json();
    if (Array.isArray(data)) {
      return data.map((item: unknown) => parseSearchResult(item));
    }
    return [];
  } catch (err) {
    logger.warn({ err: err }, '[CogneeClient] SearchWithNodeSets error:');
    return [];
  }
}
