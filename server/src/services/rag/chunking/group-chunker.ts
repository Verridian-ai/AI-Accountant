/**
 * Group Chunking Operations
 *
 * Creates merchant group and category group chunks from transaction data,
 * splitting large groups into bounded sub-chunks.
 */

import type { TransactionInput, GeneratedChunk, ChunkingConfig } from './types.js';
import { createTransactionGroupChunk } from './text-splitter.js';

// ============================================================================
// GROUP CHUNKING
// ============================================================================

/**
 * Create merchant group chunks for all merchants.
 * Large groups are split into bounded sub-chunks.
 */
export function createMerchantGroupChunks(
  transactions: TransactionInput[],
  groupByMerchantFn: (txs: TransactionInput[]) => Map<string, TransactionInput[]>,
  userId: string,
  config: ChunkingConfig,
): GeneratedChunk[] {
  const chunks: GeneratedChunk[] = [];
  const merchantGroups = groupByMerchantFn(transactions);

  for (const [merchant, txs] of Array.from(merchantGroups.entries())) {
    if (txs.length >= config.minGroupSize) {
      for (let i = 0; i < txs.length; i += config.maxGroupSize) {
        const slice = txs.slice(i, i + config.maxGroupSize);
        if (slice.length >= config.minGroupSize) {
          chunks.push(createTransactionGroupChunk(slice, merchant, 'merchant', userId, config));
        }
      }
    }
  }

  return chunks;
}

/**
 * Create category group chunks for all categories.
 * Large groups are split into bounded sub-chunks.
 */
export function createCategoryGroupChunks(
  transactions: TransactionInput[],
  groupByCategoryFn: (txs: TransactionInput[]) => Map<string, TransactionInput[]>,
  userId: string,
  config: ChunkingConfig,
): GeneratedChunk[] {
  const chunks: GeneratedChunk[] = [];
  const categoryGroups = groupByCategoryFn(transactions);

  for (const [category, txs] of Array.from(categoryGroups.entries())) {
    if (txs.length >= config.minGroupSize) {
      for (let i = 0; i < txs.length; i += config.maxGroupSize) {
        const slice = txs.slice(i, i + config.maxGroupSize);
        if (slice.length >= config.minGroupSize) {
          chunks.push(createTransactionGroupChunk(slice, category, 'category', userId, config));
        }
      }
    }
  }

  return chunks;
}
