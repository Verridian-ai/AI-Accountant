/**
 * Cognee Client — Search Operations
 *
 * Search and query operations against the Cognee knowledge graph:
 * - search (returns plain text strings)
 * - searchRich (returns CogneeSearchResult objects with metadata)
 * - crossDatasetSearch (search across multiple datasets)
 * - searchWithSession (session-aware search)
 * - temporalSearch (date-range-aware search)
 * - parseSearchResult (internal result parser)
 */

import { logger } from '../../lib/logger.js';
import {
  REQUEST_TIMEOUT_MS,
  type CogneeSearchType,
  type CogneeSearchResult,
} from './types.js';
import type { AuthState } from './auth.js';
import { buildAuthHeaders } from './auth.js';
import { applyTenantPrefix, applyTenantPrefixToAll } from './tenant.js';

/**
 * Parse a single search result item from Cognee's response.
 * Cognee returns different shapes depending on search type:
 *  - string (GRAPH_COMPLETION completions)
 *  - { text, ... } (CHUNKS, SUMMARIES)
 *  - { content, ... } (some completion types)
 *  - { document_id, chunk_id, text, score, ... } (CHUNKS with metadata)
 */
export function parseSearchResult(item: unknown): CogneeSearchResult {
  if (typeof item === 'string') {
    return { text: item };
  }

  if (item && typeof item === 'object') {
    const obj = item as Record<string, unknown>;

    // Extract text from common Cognee response fields
    const text =
      (typeof obj.text === 'string' ? obj.text : null) ??
      (typeof obj.content === 'string' ? obj.content : null) ??
      (typeof obj.chunk_text === 'string' ? obj.chunk_text : null) ??
      (typeof obj.summary === 'string' ? obj.summary : null) ??
      (typeof obj.answer === 'string' ? obj.answer : null) ??
      JSON.stringify(item);

    const score = typeof obj.score === 'number' ? obj.score : undefined;

    // Collect metadata fields
    const metadata: Record<string, unknown> = {};
    for (const key of ['document_id', 'chunk_id', 'node_id', 'type', 'source']) {
      if (obj[key] !== undefined) {
        metadata[key] = obj[key];
      }
    }

    return {
      text,
      score,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    };
  }

  return { text: String(item) };
}

/**
 * Search Cognee returning rich result objects with metadata.
 * Properly extracts text from Cognee's structured response objects.
 */
export async function searchRich(
  state: AuthState,
  query: string,
  dataset: string,
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
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      logger.warn(`[CogneeClient] Search failed: ${res.status}`);
      return [];
    }
    const data = await res.json();
    if (Array.isArray(data)) {
      return data.map((item: unknown) => parseSearchResult(item));
    }
    return [];
  } catch (err) {
    logger.warn({ err: err }, '[CogneeClient] Search error:');
    return [];
  }
}

/**
 * Search Cognee with configurable search type.
 * Returns plain text strings for backward compatibility.
 */
export async function search(
  state: AuthState,
  query: string,
  dataset: string,
  topK: number = 5,
  searchType: CogneeSearchType = 'GRAPH_COMPLETION',
  userId?: string,
  tenantId?: string,
): Promise<string[]> {
  const results = await searchRich(state, query, dataset, topK, searchType, userId, tenantId);
  return results.map((r) => r.text);
}

/**
 * Search across multiple datasets and merge results (Wave 3).
 * Used by market-cognee-indexer and cdr-cognee-indexer for cross-domain queries.
 *
 * Note: When called from searchAcrossTenants, datasets are already prefixed.
 * When called directly, tenantId can be passed to prefix all datasets.
 */
export async function crossDatasetSearch(
  state: AuthState,
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
    const auth = await buildAuthHeaders(state, userId);
    const res = await fetch(`${state.baseUrl}/api/v1/search`, {
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
      logger.warn(`[CogneeClient] Cross-dataset search failed: ${res.status}`);
      return [];
    }
    const data = await res.json();
    if (Array.isArray(data)) {
      return data.map((item: unknown) => parseSearchResult(item));
    }
    return [];
  } catch (err) {
    logger.warn({ err: err }, '[CogneeClient] Cross-dataset search error:');
    return [];
  }
}

/**
 * Search with conversational session context (Wave 3).
 * Passes session_id to Cognee for memory-aware retrieval.
 */
export async function searchWithSession(
  state: AuthState,
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
    const auth = await buildAuthHeaders(state, userId);
    const res = await fetch(`${state.baseUrl}/api/v1/search`, {
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
      logger.warn(`[CogneeClient] Session search failed: ${res.status}`);
      return [];
    }
    const data = await res.json();
    if (Array.isArray(data)) {
      return data.map((item: unknown) => parseSearchResult(item));
    }
    return [];
  } catch (err) {
    logger.warn({ err: err }, '[CogneeClient] Session search error:');
    return [];
  }
}

/**
 * Temporal-aware search with date range context.
 */
export async function temporalSearch(
  state: AuthState,
  query: string,
  options: {
    dataset: string;
    timeStart?: string;
    timeEnd?: string;
    searchType?: CogneeSearchType;
    topK?: number;
  },
  userId?: string,
  tenantId?: string,
): Promise<CogneeSearchResult[]> {
  const augmentedQuery =
    options.timeStart && options.timeEnd
      ? `${query} [period: ${options.timeStart} to ${options.timeEnd}]`
      : query;

  return searchRich(
    state,
    augmentedQuery,
    options.dataset,
    options.topK ?? 5,
    options.searchType ?? 'CHUNKS',
    userId,
    tenantId,
  );
}

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
