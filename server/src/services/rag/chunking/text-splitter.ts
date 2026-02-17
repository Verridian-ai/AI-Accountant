/**
 * Text Splitting Algorithms for Transaction Chunking
 *
 * Handles single transaction chunks and transaction grouping by merchant/category.
 */

import type { TransactionInput, GeneratedChunk, ChunkingConfig } from './types.js';
import {
  formatAmount,
  formatDate,
  normalizeMerchant,
  estimateTokens,
  generateChunkHash,
} from './types.js';

// ============================================================================
// SINGLE TRANSACTION CHUNKS (100-200 tokens)
// ============================================================================

/**
 * Create a single transaction chunk
 * Best for: specific transaction lookups, recent activity queries
 */
export function createSingleTransactionChunk(
  transaction: TransactionInput,
  userId: string,
  config: ChunkingConfig,
): GeneratedChunk {
  const lines: string[] = [];

  // Core transaction info
  lines.push(`Transaction on ${formatDate(transaction.date)}`);
  lines.push(`Description: ${transaction.description}`);
  lines.push(`Amount: ${formatAmount(transaction.amount)}`);

  if (transaction.category) {
    lines.push(`Category: ${transaction.category}`);
  }

  if (config.includeBalance && transaction.balance != null) {
    lines.push(`Balance after: ${formatAmount(transaction.balance)}`);
  }

  if (config.includeGstDetails && transaction.gstApplicable) {
    const gstInfo =
      transaction.gstAmount != null
        ? `GST: ${formatAmount(transaction.gstAmount)}`
        : 'GST applicable';
    lines.push(gstInfo);
  }

  if (transaction.isTransfer) {
    lines.push('Type: Internal transfer');
  }

  if (config.includeReasoningNotes && transaction.aiReasoningNotes) {
    lines.push(`Notes: ${transaction.aiReasoningNotes}`);
  }

  const content = lines.join('\n');

  return {
    content,
    chunkType: 'single_transaction',
    metadata: {
      userId,
      accountId: transaction.accountId,
      dateStart: transaction.date,
      dateEnd: transaction.date,
      category: transaction.category,
      merchantNormalized:
        transaction.merchantNormalized || normalizeMerchant(transaction.description),
      totalAmount: transaction.amount,
      transactionCount: 1,
      transactionIds: [transaction.id],
      chunkHash: generateChunkHash(content),
    },
    tokenEstimate: estimateTokens(content),
  };
}

// ============================================================================
// TRANSACTION GROUP CHUNKS (300-500 tokens)
// ============================================================================

/**
 * Group transactions by merchant (normalized)
 */
export function groupByMerchant(transactions: TransactionInput[]): Map<string, TransactionInput[]> {
  const groups = new Map<string, TransactionInput[]>();

  for (const tx of transactions) {
    const merchant = tx.merchantNormalized || normalizeMerchant(tx.description);
    const existing = groups.get(merchant) || [];
    existing.push(tx);
    groups.set(merchant, existing);
  }

  return groups;
}

/**
 * Group transactions by category
 */
export function groupByCategory(transactions: TransactionInput[]): Map<string, TransactionInput[]> {
  const groups = new Map<string, TransactionInput[]>();

  for (const tx of transactions) {
    const category = tx.category || 'Uncategorized';
    const existing = groups.get(category) || [];
    existing.push(tx);
    groups.set(category, existing);
  }

  return groups;
}

/**
 * Create a transaction group chunk from similar transactions
 * Best for: spending pattern analysis, merchant history queries
 */
export function createTransactionGroupChunk(
  transactions: TransactionInput[],
  groupKey: string,
  groupType: 'merchant' | 'category',
  userId: string,
  config: ChunkingConfig,
): GeneratedChunk {
  if (transactions.length === 0) {
    throw new Error('Cannot create group chunk from empty transaction list');
  }

  // Sort by date
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));

  const lines: string[] = [];
  const totalAmount = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  const dateStart = sorted[0].date;
  const dateEnd = sorted[sorted.length - 1].date;

  // Header with summary
  if (groupType === 'merchant') {
    lines.push(`Merchant Activity: ${groupKey}`);
  } else {
    lines.push(`Category: ${groupKey}`);
  }
  lines.push(`Period: ${formatDate(dateStart)} to ${formatDate(dateEnd)}`);
  lines.push(`Total: ${formatAmount(totalAmount)} across ${transactions.length} transactions`);
  lines.push('');

  // Individual transactions (limited to fit token budget)
  const maxTransactionsToList = Math.min(transactions.length, config.maxGroupSize);
  lines.push('Transactions:');

  for (let i = 0; i < maxTransactionsToList; i++) {
    const tx = sorted[i];
    const txLine = `- ${formatDate(tx.date)}: ${formatAmount(tx.amount)} - ${tx.description.substring(0, 50)}`;
    lines.push(txLine);
  }

  if (transactions.length > maxTransactionsToList) {
    lines.push(`... and ${transactions.length - maxTransactionsToList} more transactions`);
  }

  // Category breakdown for merchant groups
  if (groupType === 'merchant') {
    const categories = new Set(transactions.map((tx) => tx.category).filter(Boolean));
    if (categories.size > 0) {
      lines.push('');
      lines.push(`Categories: ${Array.from(categories).join(', ')}`);
    }
  }

  // Calculate averages
  const avgAmount = Math.round(totalAmount / transactions.length);
  lines.push('');
  lines.push(`Average transaction: ${formatAmount(avgAmount)}`);

  const content = lines.join('\n');

  return {
    content,
    chunkType: 'transaction_group',
    metadata: {
      userId,
      accountId: transactions[0].accountId,
      dateStart,
      dateEnd,
      category: groupType === 'category' ? groupKey : transactions[0].category,
      merchantNormalized: groupType === 'merchant' ? groupKey : undefined,
      totalAmount,
      transactionCount: transactions.length,
      transactionIds: transactions.map((tx) => tx.id),
      chunkHash: generateChunkHash(content),
    },
    tokenEstimate: estimateTokens(content),
  };
}
