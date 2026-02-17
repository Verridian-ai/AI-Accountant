/**
 * Search Convenience Functions
 *
 * Quick-access functions for hybrid, semantic, and keyword search
 * using the default HybridSearchEngine singleton.
 */

import type { DenseSearchOptions, DenseSearchResult } from './dense-search.js';
import type { SparseSearchOptions, SparseSearchResult } from './sparse-search.js';
import type { HybridSearchOptions, HybridSearchResponse } from './hybrid-search-types.js';
import { hybridSearchEngine } from './hybrid-engine.js';

/**
 * Quick hybrid search using default settings
 */
export async function hybridSearch(
  userId: string,
  query: string,
  options: HybridSearchOptions = {},
): Promise<HybridSearchResponse> {
  return hybridSearchEngine.search(userId, query, options);
}

/**
 * Quick semantic search using default settings
 */
export async function semanticSearch(
  userId: string,
  query: string,
  options: DenseSearchOptions = {},
): Promise<DenseSearchResult[]> {
  return hybridSearchEngine.semanticSearch(userId, query, options);
}

/**
 * Quick keyword search using default settings
 */
export async function keywordSearch(
  userId: string,
  query: string,
  options: SparseSearchOptions = {},
): Promise<SparseSearchResult[]> {
  return hybridSearchEngine.keywordSearch(userId, query, options);
}

/**
 * Initialize the search system
 * Should be called during application startup
 */
export async function initializeSearch(): Promise<void> {
  await hybridSearchEngine.initialize();
}
