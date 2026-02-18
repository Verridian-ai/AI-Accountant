/**
 * HTTP Primitives — low-level Cognee API calls.
 *
 * Exposes: add, searchRich, search (convenience), parseSearchResult.
 * All functions take a CogneeClientContext as the first parameter.
 */

import type { CogneeSearchType, CogneeSearchResult } from './types.js';
import { REQUEST_TIMEOUT_MS } from './config.js';
import type { CogneeClientContext } from './client-context.js';
import { applyTenantPrefix } from './tenant-utils.js';

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

    const text =
      (typeof obj.text === 'string' ? obj.text : null) ??
      (typeof obj.content === 'string' ? obj.content : null) ??
      (typeof obj.chunk_text === 'string' ? obj.chunk_text : null) ??
      (typeof obj.summary === 'string' ? obj.summary : null) ??
      (typeof obj.answer === 'string' ? obj.answer : null) ??
      JSON.stringify(item);

    const score = typeof obj.score === 'number' ? obj.score : undefined;

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
 * Add data to a Cognee dataset via multipart FormData.
 */
export async function add(
  ctx: CogneeClientContext,
  data: string[],
  dataset: string,
  userId?: string,
  tenantId?: string,
): Promise<void> {
  try {
    const prefixedDataset = applyTenantPrefix(dataset, tenantId);
    const content = data.join('\n\n');
    const formData = new FormData();
    formData.append('data', new Blob([content], { type: 'text/plain' }), `${prefixedDataset}.txt`);
    formData.append('datasetName', prefixedDataset);

    const auth = await ctx.authHeaders(userId);
    const res = await fetch(`${ctx.baseUrl}/api/v1/add`, {
      method: 'POST',
      headers: { ...auth },
      body: formData,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[CogneeClient] Add failed: ${res.status}`);
    }
  } catch (err) {
    console.warn('[CogneeClient] Add error:', err);
  }
}

/**
 * Search Cognee returning rich result objects with metadata.
 */
export async function searchRich(
  ctx: CogneeClientContext,
  query: string,
  dataset: string,
  topK: number = 5,
  searchType: CogneeSearchType = 'GRAPH_COMPLETION',
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
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[CogneeClient] Search failed: ${res.status}`);
      return [];
    }
    const data = await res.json();
    if (Array.isArray(data)) {
      return data.map((item: unknown) => parseSearchResult(item));
    }
    return [];
  } catch (err) {
    console.warn('[CogneeClient] Search error:', err);
    return [];
  }
}

/**
 * Search Cognee returning plain text strings (backward-compatible wrapper).
 */
export async function search(
  ctx: CogneeClientContext,
  query: string,
  dataset: string,
  topK: number = 5,
  searchType: CogneeSearchType = 'GRAPH_COMPLETION',
  userId?: string,
  tenantId?: string,
): Promise<string[]> {
  const results = await searchRich(ctx, query, dataset, topK, searchType, userId, tenantId);
  return results.map((r) => r.text);
}
