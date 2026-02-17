/**
 * Sparse Search Types
 *
 * Type definitions for the keyword-based search using SQLite FTS5 with BM25 scoring.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface SparseSearchOptions {
  /** Maximum number of results to return */
  topK?: number;
  /** Minimum BM25 score threshold */
  minScore?: number;
  /** Filter by category */
  category?: string;
  /** Filter by date range (ISO format) */
  dateStart?: string;
  dateEnd?: string;
  /** Filter by account ID */
  accountId?: string;
  /** Filter by namespace ID */
  namespaceId?: string;
  /** Use phrase matching (exact phrase) */
  phraseMatch?: boolean;
  /** Boost certain fields */
  fieldBoosts?: {
    content?: number;
    category?: number;
    merchant?: number;
  };
}

export interface SparseSearchResult {
  chunkId: string;
  documentId: string;
  content: string;
  bm25Score: number;
  rank: number;
  matchedTerms: string[];
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
}
