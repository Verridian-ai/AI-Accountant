/**
 * Dense Search Types
 *
 * Type definitions for the vector similarity search using FastEmbed embeddings.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface DenseSearchOptions {
  /** Maximum number of results to return */
  topK?: number;
  /** Minimum similarity threshold (0-1) */
  minSimilarity?: number;
  /** Filter by category */
  category?: string;
  /** Filter by date range (ISO format) */
  dateStart?: string;
  dateEnd?: string;
  /** Filter by account ID */
  accountId?: string;
  /** Filter by namespace ID (if not using default) */
  namespaceId?: string;
}

export interface DenseSearchResult {
  chunkId: string;
  documentId: string;
  content: string;
  similarity: number;
  rank: number;
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
