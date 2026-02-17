/**
 * Main Chunking Orchestrator
 *
 * TransactionChunker class that coordinates all chunk types
 * and provides comprehensive chunking and incremental updates.
 */

import type {
  TransactionInput,
  AccountInput,
  GeneratedChunk,
  ChunkingConfig,
  ChunkType,
} from './types.js';
import { DEFAULT_CHUNKING_CONFIG, getMonthKey } from './types.js';
import {
  createSingleTransactionChunk,
  groupByMerchant,
  groupByCategory,
  createTransactionGroupChunk,
} from './text-splitter.js';
import {
  groupByTimeWindow,
  createTemporalWindowChunk,
  createCategorySummaryChunk,
} from './semantic-chunker.js';
import { createAccountContextChunk } from './financial-chunker.js';
import { getChunkStats } from './stats.js';
import { createMerchantGroupChunks, createCategoryGroupChunks } from './group-chunker.js';

// ============================================================================
// TRANSACTION CHUNKER CLASS
// ============================================================================

export class TransactionChunker {
  private config: ChunkingConfig;
  private userId: string;

  constructor(userId: string, config: Partial<ChunkingConfig> = {}) {
    this.userId = userId;
    this.config = { ...DEFAULT_CHUNKING_CONFIG, ...config };
  }

  createSingleTransactionChunk(transaction: TransactionInput): GeneratedChunk {
    return createSingleTransactionChunk(transaction, this.userId, this.config);
  }

  createAllSingleTransactionChunks(transactions: TransactionInput[]): GeneratedChunk[] {
    return transactions.map((tx) => this.createSingleTransactionChunk(tx));
  }

  groupByMerchant(transactions: TransactionInput[]): Map<string, TransactionInput[]> {
    return groupByMerchant(transactions);
  }

  groupByCategory(transactions: TransactionInput[]): Map<string, TransactionInput[]> {
    return groupByCategory(transactions);
  }

  createTransactionGroupChunk(
    transactions: TransactionInput[],
    groupKey: string,
    groupType: 'merchant' | 'category',
  ): GeneratedChunk {
    return createTransactionGroupChunk(transactions, groupKey, groupType, this.userId, this.config);
  }

  createMerchantGroupChunks(transactions: TransactionInput[]): GeneratedChunk[] {
    return createMerchantGroupChunks(transactions, groupByMerchant, this.userId, this.config);
  }

  createCategoryGroupChunks(transactions: TransactionInput[]): GeneratedChunk[] {
    return createCategoryGroupChunks(transactions, groupByCategory, this.userId, this.config);
  }

  groupByTimeWindow(transactions: TransactionInput[], windowDays: number): TransactionInput[][] {
    return groupByTimeWindow(transactions, windowDays);
  }

  createTemporalWindowChunk(transactions: TransactionInput[]): GeneratedChunk {
    return createTemporalWindowChunk(transactions, this.userId);
  }

  createTemporalWindowChunks(
    transactions: TransactionInput[],
    windowDays?: number,
  ): GeneratedChunk[] {
    const windows = this.groupByTimeWindow(
      transactions,
      windowDays || this.config.temporalWindowDays,
    );
    return windows.map((window) => this.createTemporalWindowChunk(window));
  }

  createCategorySummaryChunk(
    transactions: TransactionInput[],
    category: string,
    month: string,
  ): GeneratedChunk {
    return createCategorySummaryChunk(transactions, category, month, this.userId, this.config);
  }

  createAllCategorySummaryChunks(transactions: TransactionInput[]): GeneratedChunk[] {
    const chunks: GeneratedChunk[] = [];
    const categoryMonthGroups = new Map<string, Map<string, TransactionInput[]>>();

    for (const tx of transactions) {
      const category = tx.category || 'Uncategorized';
      const month = getMonthKey(tx.date);

      if (!categoryMonthGroups.has(category)) {
        categoryMonthGroups.set(category, new Map());
      }
      const monthMap = categoryMonthGroups.get(category)!;

      if (!monthMap.has(month)) {
        monthMap.set(month, []);
      }
      monthMap.get(month)!.push(tx);
    }

    for (const [category, monthMap] of Array.from(categoryMonthGroups.entries())) {
      for (const [month, txs] of Array.from(monthMap.entries())) {
        if (txs.length >= 1) {
          try {
            chunks.push(this.createCategorySummaryChunk(transactions, category, month));
          } catch {
            // Skip if no matching transactions
          }
        }
      }
    }

    return chunks;
  }

  createAccountContextChunk(
    account: AccountInput,
    transactions: TransactionInput[],
  ): GeneratedChunk {
    return createAccountContextChunk(account, transactions, this.userId);
  }

  chunkTransactions(
    transactions: TransactionInput[],
    accounts: AccountInput[] = [],
  ): GeneratedChunk[] {
    const allChunks: GeneratedChunk[] = [];

    allChunks.push(...this.createAllSingleTransactionChunks(transactions));
    allChunks.push(...this.createMerchantGroupChunks(transactions));
    allChunks.push(...this.createCategoryGroupChunks(transactions));
    allChunks.push(...this.createTemporalWindowChunks(transactions));
    allChunks.push(...this.createAllCategorySummaryChunks(transactions));

    for (const account of accounts) {
      allChunks.push(this.createAccountContextChunk(account, transactions));
    }

    if (this.config.enableOverlap) {
      return this.applyOverlap(allChunks);
    }

    return allChunks;
  }

  private applyOverlap(chunks: GeneratedChunk[]): GeneratedChunk[] {
    return chunks;
  }

  chunkNewTransactions(
    newTransactions: TransactionInput[],
    existingTransactionIds: Set<string>,
    accounts: AccountInput[] = [],
  ): GeneratedChunk[] {
    const filteredNew = newTransactions.filter((tx) => !existingTransactionIds.has(tx.id));
    if (filteredNew.length === 0) return [];
    return this.chunkTransactions(filteredNew, accounts);
  }

  getChunkStats(chunks: GeneratedChunk[]): {
    totalChunks: number;
    byType: Record<ChunkType, number>;
    totalTokens: number;
    avgTokensPerChunk: number;
    totalTransactionsReferenced: number;
  } {
    return getChunkStats(chunks);
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createTransactionChunker(
  userId: string,
  config?: Partial<ChunkingConfig>,
): TransactionChunker {
  return new TransactionChunker(userId, config);
}
