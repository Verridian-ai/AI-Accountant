/**
 * Fusion Types and Constants
 *
 * Type definitions and default configuration for Reciprocal Rank Fusion (RRF).
 */

// ============================================================================
// TYPES
// ============================================================================

export interface FusionConfig {
  /** RRF constant k (default: 60) */
  k?: number;
  /** Weight for dense/semantic search results (default: 0.6) */
  denseWeight?: number;
  /** Weight for sparse/keyword search results (default: 0.4) */
  sparseWeight?: number;
  /** Minimum combined score threshold */
  minScore?: number;
  /** Maximum results to return after fusion */
  topK?: number;
}

export interface FusedSearchResult {
  chunkId: string;
  documentId: string;
  content: string;
  /** Combined RRF score */
  fusedScore: number;
  /** Rank in fused results (1-indexed) */
  fusedRank: number;
  /** Individual scores from each retriever */
  scores: {
    /** Dense search similarity score (if found in dense results) */
    denseSimilarity: number | null;
    /** Dense search rank (if found in dense results) */
    denseRank: number | null;
    /** Sparse search BM25 score (if found in sparse results) */
    sparseBm25: number | null;
    /** Sparse search rank (if found in sparse results) */
    sparseRank: number | null;
    /** RRF contribution from dense search */
    denseRRF: number;
    /** RRF contribution from sparse search */
    sparseRRF: number;
  };
  /** Source indicators */
  sources: {
    inDense: boolean;
    inSparse: boolean;
  };
  /** Metadata from the chunk */
  metadata: {
    chunkType: string;
    category: string | null;
    dateStart: string | null;
    dateEnd: string | null;
    accountId: string | null;
    totalAmount: number | null;
    transactionCount: number | null;
    merchantNormalized: string | null;
  };
  /** Matched terms from sparse search (if available) */
  matchedTerms: string[];
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

export const DEFAULT_FUSION_CONFIG: Required<FusionConfig> = {
  k: 60,
  denseWeight: 0.6,
  sparseWeight: 0.4,
  minScore: 0.0,
  topK: 20,
};
