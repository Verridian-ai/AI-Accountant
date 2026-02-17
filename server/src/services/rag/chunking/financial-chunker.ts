/**
 * Financial Document Chunking
 *
 * Creates account context chunks with overview and recent activity information.
 */

import type { TransactionInput, AccountInput, GeneratedChunk } from './types.js';
import { formatAmount, formatDate, estimateTokens, generateChunkHash } from './types.js';

// ============================================================================
// ACCOUNT CONTEXT CHUNKS (400-600 tokens)
// ============================================================================

/**
 * Create an account context chunk with account overview and recent activity
 * Best for: "Tell me about my savings account", account-specific queries
 */
export function createAccountContextChunk(
  account: AccountInput,
  transactions: TransactionInput[],
  userId: string,
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
      userId,
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
