/**
 * Semantic-Aware Chunking
 *
 * Creates temporal window chunks and category summary chunks
 * for time-based and category-based financial queries.
 */

import type { TransactionInput, GeneratedChunk, ChunkingConfig } from './types.js';
import {
  formatAmount,
  formatDate,
  getMonthKey,
  normalizeMerchant,
  estimateTokens,
  generateChunkHash,
} from './types.js';

// ============================================================================
// TEMPORAL WINDOW CHUNKS (500-800 tokens)
// ============================================================================

/**
 * Group transactions into temporal windows
 */
export function groupByTimeWindow(
  transactions: TransactionInput[],
  windowDays: number,
): TransactionInput[][] {
  if (transactions.length === 0) return [];

  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));

  const windows: TransactionInput[][] = [];
  let currentWindow: TransactionInput[] = [sorted[0]];
  let windowStart = new Date(sorted[0].date);

  for (let i = 1; i < sorted.length; i++) {
    const txDate = new Date(sorted[i].date);
    const daysDiff = Math.floor((txDate.getTime() - windowStart.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff <= windowDays) {
      currentWindow.push(sorted[i]);
    } else {
      windows.push(currentWindow);
      currentWindow = [sorted[i]];
      windowStart = txDate;
    }
  }

  if (currentWindow.length > 0) {
    windows.push(currentWindow);
  }

  return windows;
}

/**
 * Create a temporal window chunk summarizing activity over a date range
 * Best for: "What did I spend last week?", time-based analysis
 */
export function createTemporalWindowChunk(
  transactions: TransactionInput[],
  userId: string,
): GeneratedChunk {
  if (transactions.length === 0) {
    throw new Error('Cannot create temporal chunk from empty transaction list');
  }

  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));

  const dateStart = sorted[0].date;
  const dateEnd = sorted[sorted.length - 1].date;

  // Calculate summaries
  const income = transactions.filter((tx) => tx.amount > 0).reduce((sum, tx) => sum + tx.amount, 0);
  const expenses = transactions
    .filter((tx) => tx.amount < 0)
    .reduce((sum, tx) => sum + tx.amount, 0);
  const netFlow = income + expenses;

  // Category breakdown
  const categoryTotals = new Map<string, { amount: number; count: number }>();
  for (const tx of transactions) {
    const category = tx.category || 'Uncategorized';
    const existing = categoryTotals.get(category) || { amount: 0, count: 0 };
    existing.amount += tx.amount;
    existing.count += 1;
    categoryTotals.set(category, existing);
  }

  // Sort categories by absolute amount
  const sortedCategories = Array.from(categoryTotals.entries()).sort(
    (a, b) => Math.abs(b[1].amount) - Math.abs(a[1].amount),
  );

  const lines: string[] = [];

  // Summary header
  lines.push(`Financial Activity: ${formatDate(dateStart)} to ${formatDate(dateEnd)}`);
  lines.push('');
  lines.push('Summary:');
  lines.push(`- Total transactions: ${transactions.length}`);
  lines.push(`- Total income: ${formatAmount(income)}`);
  lines.push(`- Total expenses: ${formatAmount(Math.abs(expenses))}`);
  lines.push(`- Net flow: ${formatAmount(netFlow)}`);

  // Opening and closing balances if available
  const firstBalance = sorted[0].balance;
  const lastBalance = sorted[sorted.length - 1].balance;
  if (firstBalance != null && lastBalance != null) {
    lines.push(`- Opening balance: ${formatAmount(firstBalance - sorted[0].amount)}`);
    lines.push(`- Closing balance: ${formatAmount(lastBalance)}`);
  }

  // Category breakdown
  lines.push('');
  lines.push('Spending by category:');
  const topCategories = sortedCategories.slice(0, 8);
  for (const [category, stats] of topCategories) {
    lines.push(`- ${category}: ${formatAmount(stats.amount)} (${stats.count} transactions)`);
  }
  if (sortedCategories.length > 8) {
    lines.push(`... and ${sortedCategories.length - 8} more categories`);
  }

  // Top transactions
  const topExpenses = [...transactions]
    .filter((tx) => tx.amount < 0)
    .sort((a, b) => a.amount - b.amount)
    .slice(0, 5);

  if (topExpenses.length > 0) {
    lines.push('');
    lines.push('Largest expenses:');
    for (const tx of topExpenses) {
      lines.push(
        `- ${formatDate(tx.date)}: ${formatAmount(tx.amount)} - ${tx.description.substring(0, 40)}`,
      );
    }
  }

  const content = lines.join('\n');

  return {
    content,
    chunkType: 'temporal_window',
    metadata: {
      userId,
      accountId: transactions[0].accountId,
      dateStart,
      dateEnd,
      totalAmount: netFlow,
      transactionCount: transactions.length,
      transactionIds: transactions.map((tx) => tx.id),
      chunkHash: generateChunkHash(content),
    },
    tokenEstimate: estimateTokens(content),
  };
}

// ============================================================================
// CATEGORY SUMMARY CHUNKS (200-300 tokens)
// ============================================================================

/**
 * Create a monthly category summary chunk
 * Best for: "How much did I spend on groceries in January?", budget tracking
 */
export function createCategorySummaryChunk(
  transactions: TransactionInput[],
  category: string,
  month: string, // YYYY-MM format
  userId: string,
  config: ChunkingConfig,
): GeneratedChunk {
  const monthTxs = transactions.filter(
    (tx) => tx.category === category && getMonthKey(tx.date) === month,
  );

  if (monthTxs.length === 0) {
    throw new Error(`No transactions found for category ${category} in ${month}`);
  }

  const sorted = [...monthTxs].sort((a, b) => a.date.localeCompare(b.date));
  const total = monthTxs.reduce((sum, tx) => sum + tx.amount, 0);
  const avg = Math.round(total / monthTxs.length);

  // Parse month for display
  const [year, monthNum] = month.split('-');
  const monthName = new Date(parseInt(year, 10), parseInt(monthNum, 10) - 1, 1).toLocaleDateString(
    'en-AU',
    { month: 'long', year: 'numeric' },
  );

  const lines: string[] = [];

  lines.push(`${category} - ${monthName}`);
  lines.push('');
  lines.push(`Total: ${formatAmount(total)}`);
  lines.push(`Transactions: ${monthTxs.length}`);
  lines.push(`Average: ${formatAmount(avg)}`);

  // Date range
  lines.push(
    `Period: ${formatDate(sorted[0].date)} to ${formatDate(sorted[sorted.length - 1].date)}`,
  );

  // Top merchants for this category
  const merchantTotals = new Map<string, number>();
  for (const tx of monthTxs) {
    const merchant = tx.merchantNormalized || normalizeMerchant(tx.description);
    merchantTotals.set(merchant, (merchantTotals.get(merchant) || 0) + tx.amount);
  }

  const topMerchants = Array.from(merchantTotals.entries())
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 5);

  if (topMerchants.length > 0) {
    lines.push('');
    lines.push('Top merchants:');
    for (const [merchant, amount] of topMerchants) {
      lines.push(`- ${merchant}: ${formatAmount(amount)}`);
    }
  }

  // GST summary if applicable
  const gstTxs = monthTxs.filter((tx) => tx.gstApplicable);
  if (gstTxs.length > 0 && config.includeGstDetails) {
    const totalGst = gstTxs.reduce((sum, tx) => sum + (tx.gstAmount || 0), 0);
    lines.push('');
    lines.push(`GST applicable: ${gstTxs.length} transactions, ${formatAmount(totalGst)} GST`);
  }

  const content = lines.join('\n');

  return {
    content,
    chunkType: 'category_summary',
    metadata: {
      userId,
      accountId: monthTxs[0].accountId,
      dateStart: sorted[0].date,
      dateEnd: sorted[sorted.length - 1].date,
      category,
      totalAmount: total,
      transactionCount: monthTxs.length,
      transactionIds: monthTxs.map((tx) => tx.id),
      chunkHash: generateChunkHash(content),
    },
    tokenEstimate: estimateTokens(content),
  };
}
