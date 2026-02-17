/**
 * Hybrid Search Types
 *
 * Type definitions for the hybrid search system combining
 * dense, sparse, and fused search capabilities.
 */

import type { FusedSearchResult } from './fusion.js';

// ============================================================================
// TYPES
// ============================================================================

export interface HybridSearchOptions {
  /** Maximum results to return */
  topK?: number;
  /** Minimum fused score threshold */
  minScore?: number;
  /** Filter by category */
  category?: string;
  /** Filter by date range start (ISO format) */
  dateStart?: string;
  /** Filter by date range end (ISO format) */
  dateEnd?: string;
  /** Filter by account ID */
  accountId?: string;
  /** Filter by namespace ID */
  namespaceId?: string;
  /** Dense search weight (0-1) */
  denseWeight?: number;
  /** Sparse search weight (0-1) */
  sparseWeight?: number;
  /** RRF k constant */
  k?: number;
  /** Minimum dense similarity threshold */
  minDenseSimilarity?: number;
  /** Minimum sparse BM25 score threshold */
  minSparseScore?: number;
  /** Use phrase matching for sparse search */
  phraseMatch?: boolean;
  /** Expand query with synonyms for sparse search */
  expandQuery?: boolean;
  /** Number of results to retrieve from each retriever before fusion */
  retrieveTopK?: number;
  /** Normalize final scores to 0-1 range */
  normalizeScores?: boolean;
}

export interface HybridSearchResponse {
  /** Search results after fusion */
  results: FusedSearchResult[];
  /** Query metadata */
  query: {
    text: string;
    userId: string;
    options: HybridSearchOptions;
  };
  /** Performance and diagnostic info */
  stats: {
    denseResultCount: number;
    sparseResultCount: number;
    fusedResultCount: number;
    denseSearchTimeMs: number;
    sparseSearchTimeMs: number;
    fusionTimeMs: number;
    totalTimeMs: number;
    fusionStats: {
      inBothRetrievers: number;
      denseOnlyCount: number;
      sparseOnlyCount: number;
      avgFusedScore: number;
    };
  };
}
