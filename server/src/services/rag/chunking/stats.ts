/**
 * Chunking Statistics
 *
 * Provides statistical analysis for generated chunks.
 */

import type { GeneratedChunk, ChunkType } from './types.js';

// ============================================================================
// CHUNK STATISTICS
// ============================================================================

/**
 * Get chunk statistics for a set of generated chunks
 */
export function getChunkStats(chunks: GeneratedChunk[]): {
  totalChunks: number;
  byType: Record<ChunkType, number>;
  totalTokens: number;
  avgTokensPerChunk: number;
  totalTransactionsReferenced: number;
} {
  const byType: Record<ChunkType, number> = {
    single_transaction: 0,
    transaction_group: 0,
    temporal_window: 0,
    category_summary: 0,
    account_context: 0,
  };

  let totalTokens = 0;
  const allTransactionIds = new Set<string>();

  for (const chunk of chunks) {
    byType[chunk.chunkType]++;
    totalTokens += chunk.tokenEstimate;

    if (chunk.metadata.transactionIds) {
      for (const id of chunk.metadata.transactionIds) {
        allTransactionIds.add(id);
      }
    }
  }

  return {
    totalChunks: chunks.length,
    byType,
    totalTokens,
    avgTokensPerChunk: chunks.length > 0 ? Math.round(totalTokens / chunks.length) : 0,
    totalTransactionsReferenced: allTransactionIds.size,
  };
}
