/**
 * Financial Data Chunking System for RAG
 *
 * Implements specialized chunking strategies for financial transaction data
 * to optimize retrieval-augmented generation for financial queries.
 *
 * Chunk Types and Target Token Sizes:
 * - Single Transaction: 100-200 tokens (individual transactions)
 * - Transaction Group: 300-500 tokens (same merchant/category)
 * - Temporal Window: 500-800 tokens (date range summary)
 * - Category Summary: 200-300 tokens (monthly category totals)
 * - Account Context: 400-600 tokens (account overview)
 */

import * as crypto from 'crypto';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Chunk type identifiers matching the schema
 */
export type ChunkType =
  | 'single_transaction'
  | 'transaction_group'
  | 'temporal_window'
  | 'category_summary'
  | 'account_context';

/**
 * Token size limits for each chunk type
 */
export const CHUNK_TOKEN_LIMITS: Record<ChunkType, { min: number; max: number }> = {
  single_transaction: { min: 100, max: 200 },
  transaction_group: { min: 300, max: 500 },
  temporal_window: { min: 500, max: 800 },
  category_summary: { min: 200, max: 300 },
  account_context: { min: 400, max: 600 },
};

/**
 * Transaction input for chunking
 */
export interface TransactionInput {
  id: string;
  date: string; // YYYY-MM-DD format
  description: string;
  amount: number; // In cents
  balance?: number | null;
  category?: string | null;
  gstApplicable?: boolean | null;
  gstAmount?: number | null;
  aiReasoningNotes?: string | null;
  merchantNormalized?: string | null;
  accountId?: string | null;
  isTransfer?: boolean | null;
}

/**
 * Account input for context chunks
 */
export interface AccountInput {
  id: string;
  accountName: string;
  accountType: string;
  bankName?: string | null;
  currentBalance?: number | null;
  lastStatementDate?: string | null;
}

/**
 * Base chunk metadata
 */
export interface ChunkMetadata {
  userId: string;
  accountId?: string | null;
  dateStart?: string | null;
  dateEnd?: string | null;
  category?: string | null;
  merchantNormalized?: string | null;
  totalAmount?: number | null;
  transactionCount?: number | null;
  transactionIds?: string[];
  chunkHash?: string;
}

/**
 * Generated chunk output
 */
export interface GeneratedChunk {
  content: string;
  chunkType: ChunkType;
  metadata: ChunkMetadata;
  tokenEstimate: number;
}

/**
 * Chunking configuration
 */
export interface ChunkingConfig {
  /** Enable overlapping chunks for context preservation */
  enableOverlap: boolean;
  /** Number of transactions to overlap between chunks */
  overlapTransactions: number;
  /** Minimum transactions before creating a group chunk */
  minGroupSize: number;
  /** Maximum transactions per group chunk */
  maxGroupSize: number;
  /** Days to include in temporal windows */
  temporalWindowDays: number;
  /** Include AI reasoning notes in chunks */
  includeReasoningNotes: boolean;
  /** Include balance information */
  includeBalance: boolean;
  /** Include GST details */
  includeGstDetails: boolean;
}

/**
 * Default chunking configuration
 */
export const DEFAULT_CHUNKING_CONFIG: ChunkingConfig = {
  enableOverlap: true,
  overlapTransactions: 2,
  minGroupSize: 3,
  maxGroupSize: 15,
  temporalWindowDays: 7,
  includeReasoningNotes: true,
  includeBalance: true,
  includeGstDetails: true,
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Estimate token count for text (roughly 4 characters per token)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Format amount from cents to dollars with currency symbol
 */
export function formatAmount(cents: number): string {
  const dollars = cents / 100;
  const sign = dollars < 0 ? '-' : '+';
  return `${sign}$${Math.abs(dollars).toFixed(2)}`;
}

/**
 * Format date for display
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Get month key from date (YYYY-MM)
 */
export function getMonthKey(dateStr: string): string {
  return dateStr.substring(0, 7);
}

/**
 * Generate content hash for deduplication
 */
export function generateChunkHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
}

/**
 * Normalize merchant name for grouping
 */
export function normalizeMerchant(description: string): string {
  return description
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 3)
    .join(' ');
}

// ============================================================================
// TRANSACTION CHUNKER CLASS
// ============================================================================

/**
 * TransactionChunker - Creates optimized chunks from financial transaction data
 */
export class TransactionChunker {
  private config: ChunkingConfig;
  private userId: string;

  constructor(userId: string, config: Partial<ChunkingConfig> = {}) {
    this.userId = userId;
    this.config = { ...DEFAULT_CHUNKING_CONFIG, ...config };
  }

  // ========================================================================
  // SINGLE TRANSACTION CHUNKS (100-200 tokens)
  // ========================================================================

  /**
   * Create a single transaction chunk
   * Best for: specific transaction lookups, recent activity queries
   */
  createSingleTransactionChunk(transaction: TransactionInput): GeneratedChunk {
    const lines: string[] = [];

    // Core transaction info
    lines.push(`Transaction on ${formatDate(transaction.date)}`);
    lines.push(`Description: ${transaction.description}`);
    lines.push(`Amount: ${formatAmount(transaction.amount)}`);

    if (transaction.category) {
      lines.push(`Category: ${transaction.category}`);
    }

    if (this.config.includeBalance && transaction.balance != null) {
      lines.push(`Balance after: ${formatAmount(transaction.balance)}`);
    }

    if (this.config.includeGstDetails && transaction.gstApplicable) {
      const gstInfo =
        transaction.gstAmount != null
          ? `GST: ${formatAmount(transaction.gstAmount)}`
          : 'GST applicable';
      lines.push(gstInfo);
    }

    if (transaction.isTransfer) {
      lines.push('Type: Internal transfer');
    }

    if (this.config.includeReasoningNotes && transaction.aiReasoningNotes) {
      lines.push(`Notes: ${transaction.aiReasoningNotes}`);
    }

    const content = lines.join('\n');

    return {
      content,
      chunkType: 'single_transaction',
      metadata: {
        userId: this.userId,
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

  /**
   * Create single transaction chunks for all transactions
   */
  createAllSingleTransactionChunks(transactions: TransactionInput[]): GeneratedChunk[] {
    return transactions.map((tx) => this.createSingleTransactionChunk(tx));
  }

  // ========================================================================
  // TRANSACTION GROUP CHUNKS (300-500 tokens)
  // ========================================================================

  /**
   * Group transactions by merchant (normalized)
   */
  groupByMerchant(transactions: TransactionInput[]): Map<string, TransactionInput[]> {
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
  groupByCategory(transactions: TransactionInput[]): Map<string, TransactionInput[]> {
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
  createTransactionGroupChunk(
    transactions: TransactionInput[],
    groupKey: string,
    groupType: 'merchant' | 'category',
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
    const maxTransactionsToList = Math.min(transactions.length, this.config.maxGroupSize);
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
        userId: this.userId,
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

  /**
   * Create merchant group chunks for all merchants
   */
  createMerchantGroupChunks(transactions: TransactionInput[]): GeneratedChunk[] {
    const chunks: GeneratedChunk[] = [];
    const merchantGroups = this.groupByMerchant(transactions);

    for (const [merchant, txs] of Array.from(merchantGroups.entries())) {
      if (txs.length >= this.config.minGroupSize) {
        // Split large groups into multiple chunks
        for (let i = 0; i < txs.length; i += this.config.maxGroupSize) {
          const slice = txs.slice(i, i + this.config.maxGroupSize);
          if (slice.length >= this.config.minGroupSize) {
            chunks.push(this.createTransactionGroupChunk(slice, merchant, 'merchant'));
          }
        }
      }
    }

    return chunks;
  }

  /**
   * Create category group chunks
   */
  createCategoryGroupChunks(transactions: TransactionInput[]): GeneratedChunk[] {
    const chunks: GeneratedChunk[] = [];
    const categoryGroups = this.groupByCategory(transactions);

    for (const [category, txs] of Array.from(categoryGroups.entries())) {
      if (txs.length >= this.config.minGroupSize) {
        for (let i = 0; i < txs.length; i += this.config.maxGroupSize) {
          const slice = txs.slice(i, i + this.config.maxGroupSize);
          if (slice.length >= this.config.minGroupSize) {
            chunks.push(this.createTransactionGroupChunk(slice, category, 'category'));
          }
        }
      }
    }

    return chunks;
  }

  // ========================================================================
  // TEMPORAL WINDOW CHUNKS (500-800 tokens)
  // ========================================================================

  /**
   * Group transactions into temporal windows
   */
  groupByTimeWindow(transactions: TransactionInput[], windowDays: number): TransactionInput[][] {
    if (transactions.length === 0) return [];

    const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));

    const windows: TransactionInput[][] = [];
    let currentWindow: TransactionInput[] = [sorted[0]];
    let windowStart = new Date(sorted[0].date);

    for (let i = 1; i < sorted.length; i++) {
      const txDate = new Date(sorted[i].date);
      const daysDiff = Math.floor(
        (txDate.getTime() - windowStart.getTime()) / (1000 * 60 * 60 * 24),
      );

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
  createTemporalWindowChunk(transactions: TransactionInput[]): GeneratedChunk {
    if (transactions.length === 0) {
      throw new Error('Cannot create temporal chunk from empty transaction list');
    }

    const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));

    const dateStart = sorted[0].date;
    const dateEnd = sorted[sorted.length - 1].date;

    // Calculate summaries
    const income = transactions
      .filter((tx) => tx.amount > 0)
      .reduce((sum, tx) => sum + tx.amount, 0);
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
        userId: this.userId,
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

  /**
   * Create temporal window chunks for all time periods
   */
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

  // ========================================================================
  // CATEGORY SUMMARY CHUNKS (200-300 tokens)
  // ========================================================================

  /**
   * Create a monthly category summary chunk
   * Best for: "How much did I spend on groceries in January?", budget tracking
   */
  createCategorySummaryChunk(
    transactions: TransactionInput[],
    category: string,
    month: string, // YYYY-MM format
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
    const monthName = new Date(parseInt(year), parseInt(monthNum) - 1, 1).toLocaleDateString(
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
    if (gstTxs.length > 0 && this.config.includeGstDetails) {
      const totalGst = gstTxs.reduce((sum, tx) => sum + (tx.gstAmount || 0), 0);
      lines.push('');
      lines.push(`GST applicable: ${gstTxs.length} transactions, ${formatAmount(totalGst)} GST`);
    }

    const content = lines.join('\n');

    return {
      content,
      chunkType: 'category_summary',
      metadata: {
        userId: this.userId,
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

  /**
   * Create monthly category summary chunks for all categories and months
   */
  createAllCategorySummaryChunks(transactions: TransactionInput[]): GeneratedChunk[] {
    const chunks: GeneratedChunk[] = [];

    // Group by category and month
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

    // Create chunks for each category-month combination
    for (const [category, monthMap] of Array.from(categoryMonthGroups.entries())) {
      for (const [month, txs] of Array.from(monthMap.entries())) {
        if (txs.length >= 1) {
          try {
            chunks.push(this.createCategorySummaryChunk(transactions, category, month));
          } catch (e) {
            // Skip if no matching transactions
          }
        }
      }
    }

    return chunks;
  }

  // ========================================================================
  // ACCOUNT CONTEXT CHUNKS (400-600 tokens)
  // ========================================================================

  /**
   * Create an account context chunk with account overview and recent activity
   * Best for: "Tell me about my savings account", account-specific queries
   */
  createAccountContextChunk(
    account: AccountInput,
    transactions: TransactionInput[],
  ): GeneratedChunk {
    // Filter transactions for this account
    const accountTxs = transactions.filter((tx) => tx.accountId === account.id);
    const sorted = [...accountTxs].sort((a, b) => b.date.localeCompare(a.date));

    const lines: string[] = [];

    // Account header
    lines.push(`Account: ${account.accountName}`);
    lines.push(`Type: ${account.accountType}`);
    if (account.bankName) {
      lines.push(`Bank: ${account.bankName}`);
    }
    if (account.currentBalance != null) {
      lines.push(`Current Balance: ${formatAmount(account.currentBalance)}`);
    }
    if (account.lastStatementDate) {
      lines.push(`Last Statement: ${formatDate(account.lastStatementDate)}`);
    }

    // Transaction summary
    if (accountTxs.length > 0) {
      const totalIncome = accountTxs
        .filter((tx) => tx.amount > 0)
        .reduce((sum, tx) => sum + tx.amount, 0);
      const totalExpenses = accountTxs
        .filter((tx) => tx.amount < 0)
        .reduce((sum, tx) => sum + tx.amount, 0);

      lines.push('');
      lines.push('Activity Summary:');
      lines.push(`- Total transactions: ${accountTxs.length}`);
      lines.push(`- Total credits: ${formatAmount(totalIncome)}`);
      lines.push(`- Total debits: ${formatAmount(Math.abs(totalExpenses))}`);

      const dateStart = sorted[sorted.length - 1].date;
      const dateEnd = sorted[0].date;
      lines.push(`- Date range: ${formatDate(dateStart)} to ${formatDate(dateEnd)}`);

      // Category breakdown
      const categoryTotals = new Map<string, number>();
      for (const tx of accountTxs) {
        const category = tx.category || 'Uncategorized';
        categoryTotals.set(category, (categoryTotals.get(category) || 0) + tx.amount);
      }

      const topCategories = Array.from(categoryTotals.entries())
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
        .slice(0, 5);

      if (topCategories.length > 0) {
        lines.push('');
        lines.push('Top categories:');
        for (const [category, amount] of topCategories) {
          lines.push(`- ${category}: ${formatAmount(amount)}`);
        }
      }

      // Recent transactions
      const recentTxs = sorted.slice(0, 5);
      if (recentTxs.length > 0) {
        lines.push('');
        lines.push('Recent transactions:');
        for (const tx of recentTxs) {
          lines.push(
            `- ${formatDate(tx.date)}: ${formatAmount(tx.amount)} - ${tx.description.substring(0, 35)}`,
          );
        }
      }

      // Transfers
      const transfers = accountTxs.filter((tx) => tx.isTransfer);
      if (transfers.length > 0) {
        lines.push('');
        lines.push(`Internal transfers: ${transfers.length} transactions`);
      }
    } else {
      lines.push('');
      lines.push('No transaction history available for this account.');
    }

    const content = lines.join('\n');

    return {
      content,
      chunkType: 'account_context',
      metadata: {
        userId: this.userId,
        accountId: account.id,
        dateStart: sorted.length > 0 ? sorted[sorted.length - 1].date : undefined,
        dateEnd: sorted.length > 0 ? sorted[0].date : undefined,
        totalAmount: accountTxs.reduce((sum, tx) => sum + tx.amount, 0),
        transactionCount: accountTxs.length,
        transactionIds: accountTxs.map((tx) => tx.id),
        chunkHash: generateChunkHash(content),
      },
      tokenEstimate: estimateTokens(content),
    };
  }

  // ========================================================================
  // COMPREHENSIVE CHUNKING
  // ========================================================================

  /**
   * Generate all chunk types for a set of transactions
   * Creates overlapping chunks when configured for context preservation
   */
  chunkTransactions(
    transactions: TransactionInput[],
    accounts: AccountInput[] = [],
  ): GeneratedChunk[] {
    const allChunks: GeneratedChunk[] = [];

    // 1. Single transaction chunks (for specific lookups)
    const singleChunks = this.createAllSingleTransactionChunks(transactions);
    allChunks.push(...singleChunks);

    // 2. Merchant group chunks (for spending patterns)
    const merchantChunks = this.createMerchantGroupChunks(transactions);
    allChunks.push(...merchantChunks);

    // 3. Category group chunks (for category analysis)
    const categoryChunks = this.createCategoryGroupChunks(transactions);
    allChunks.push(...categoryChunks);

    // 4. Temporal window chunks (for time-based queries)
    const temporalChunks = this.createTemporalWindowChunks(transactions);
    allChunks.push(...temporalChunks);

    // 5. Monthly category summaries (for budget tracking)
    const summaryChunks = this.createAllCategorySummaryChunks(transactions);
    allChunks.push(...summaryChunks);

    // 6. Account context chunks (for account-specific queries)
    for (const account of accounts) {
      const accountChunk = this.createAccountContextChunk(account, transactions);
      allChunks.push(accountChunk);
    }

    // Apply overlap if configured
    if (this.config.enableOverlap) {
      return this.applyOverlap(allChunks);
    }

    return allChunks;
  }

  /**
   * Apply overlap between sequential chunks for context preservation
   */
  private applyOverlap(chunks: GeneratedChunk[]): GeneratedChunk[] {
    // For now, chunks are self-contained. Overlap is primarily handled
    // during retrieval by returning additional context chunks.
    // Future enhancement: add overlap tokens from adjacent chunks.
    return chunks;
  }

  // ========================================================================
  // INCREMENTAL UPDATES
  // ========================================================================

  /**
   * Generate chunks for new transactions only
   * Useful for incremental indexing when new statements are uploaded
   */
  chunkNewTransactions(
    newTransactions: TransactionInput[],
    existingTransactionIds: Set<string>,
    accounts: AccountInput[] = [],
  ): GeneratedChunk[] {
    // Filter to only truly new transactions
    const filteredNew = newTransactions.filter((tx) => !existingTransactionIds.has(tx.id));

    if (filteredNew.length === 0) {
      return [];
    }

    // Generate chunks for new transactions
    return this.chunkTransactions(filteredNew, accounts);
  }

  /**
   * Get chunk statistics
   */
  getChunkStats(chunks: GeneratedChunk[]): {
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
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a TransactionChunker instance
 */
export function createTransactionChunker(
  userId: string,
  config?: Partial<ChunkingConfig>,
): TransactionChunker {
  return new TransactionChunker(userId, config);
}

// ============================================================================
// EXPORTS
// ============================================================================

export { TransactionChunker as default };
