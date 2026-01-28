/**
 * Inter-Account Transfer Detection
 *
 * Detects transfers between accounts owned by the same user.
 * Uses amount matching, date proximity, and description keywords
 * to identify transfer pairs and exclude them from income/expense reports.
 */

/**
 * Transaction for transfer matching
 */
export interface TransferCandidate {
  id: number;
  accountId: number;
  date: string; // ISO format
  description: string;
  amount: number; // In cents, negative for debits
  isLinked?: boolean;
  linkedTransactionId?: number;
}

/**
 * Account information for context
 */
export interface AccountContext {
  id: number;
  accountNumber: string;
  bankId: string;
  accountName?: string;
}

/**
 * Result of transfer matching
 */
export interface TransferMatch {
  sourceTransaction: TransferCandidate;
  targetTransaction: TransferCandidate;
  confidence: number;
  matchReasons: string[];
}

/**
 * Transfer detection configuration
 */
export interface TransferDetectorConfig {
  /** Maximum days between matching transactions */
  matchWindowDays: number;
  /** Amount tolerance for matching (in cents) */
  amountToleranceCents: number;
  /** Minimum confidence to consider a match */
  minConfidence: number;
  /** Keywords that indicate transfers */
  transferKeywords: string[];
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: TransferDetectorConfig = {
  matchWindowDays: 3,
  amountToleranceCents: 500, // $5 tolerance for fees
  minConfidence: 0.6,
  transferKeywords: [
    'transfer',
    'tfr',
    'trf',
    'internal',
    'osko',
    'pay anyone',
    'bpay',
    'direct credit',
    'direct debit',
    'internet transfer',
    'mobile transfer',
  ],
};

/**
 * Transfer Detector Class
 */
export class TransferDetector {
  private config: TransferDetectorConfig;

  constructor(config: Partial<TransferDetectorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Detect transfers between accounts
   */
  detectTransfers(
    transactions: TransferCandidate[],
    accounts: AccountContext[],
    existingLinks: Array<{ sourceId: number; targetId: number }> = []
  ): TransferMatch[] {
    // Filter out already linked transactions
    const linkedIds = new Set<number>();
    for (const link of existingLinks) {
      linkedIds.add(link.sourceId);
      linkedIds.add(link.targetId);
    }

    const unlinked = transactions.filter(
      (tx) => !linkedIds.has(tx.id) && !tx.isLinked
    );

    // Separate debits and credits by account
    const debitsByAccount = new Map<number, TransferCandidate[]>();
    const creditsByAccount = new Map<number, TransferCandidate[]>();

    for (const tx of unlinked) {
      if (tx.amount < 0) {
        // Debit (outgoing)
        const list = debitsByAccount.get(tx.accountId) || [];
        list.push(tx);
        debitsByAccount.set(tx.accountId, list);
      } else {
        // Credit (incoming)
        const list = creditsByAccount.get(tx.accountId) || [];
        list.push(tx);
        creditsByAccount.set(tx.accountId, list);
      }
    }

    const matches: TransferMatch[] = [];
    const usedTransactions = new Set<number>();

    // Match debits to credits across different accounts
    for (const [sourceAccountId, debits] of debitsByAccount) {
      for (const debit of debits) {
        if (usedTransactions.has(debit.id)) continue;

        // Look for matching credit in other accounts
        for (const [targetAccountId, credits] of creditsByAccount) {
          if (targetAccountId === sourceAccountId) continue;

          for (const credit of credits) {
            if (usedTransactions.has(credit.id)) continue;

            const match = this.evaluateMatch(debit, credit, accounts);
            if (match && match.confidence >= this.config.minConfidence) {
              matches.push(match);
              usedTransactions.add(debit.id);
              usedTransactions.add(credit.id);
              break;
            }
          }

          if (usedTransactions.has(debit.id)) break;
        }
      }
    }

    // Sort by confidence
    matches.sort((a, b) => b.confidence - a.confidence);

    return matches;
  }

  /**
   * Evaluate if two transactions are a transfer pair
   */
  private evaluateMatch(
    debit: TransferCandidate,
    credit: TransferCandidate,
    accounts: AccountContext[]
  ): TransferMatch | null {
    const matchReasons: string[] = [];
    let score = 0;

    // Amount matching (most important)
    const debitAmount = Math.abs(debit.amount);
    const creditAmount = credit.amount;
    const amountDiff = Math.abs(debitAmount - creditAmount);

    if (amountDiff === 0) {
      matchReasons.push('Exact amount match');
      score += 0.4;
    } else if (amountDiff <= this.config.amountToleranceCents) {
      matchReasons.push(`Amount within $${(amountDiff / 100).toFixed(2)} tolerance`);
      score += 0.3;
    } else {
      // Amounts don't match
      return null;
    }

    // Date proximity
    const daysDiff = this.daysBetween(debit.date, credit.date);
    if (daysDiff > this.config.matchWindowDays) {
      return null;
    }

    if (daysDiff === 0) {
      matchReasons.push('Same day');
      score += 0.25;
    } else if (daysDiff === 1) {
      matchReasons.push('Next day');
      score += 0.2;
    } else {
      matchReasons.push(`${daysDiff} days apart`);
      score += 0.1;
    }

    // Transfer keyword matching
    const debitDesc = debit.description.toLowerCase();
    const creditDesc = credit.description.toLowerCase();
    const debitHasKeyword = this.hasTransferKeyword(debitDesc);
    const creditHasKeyword = this.hasTransferKeyword(creditDesc);

    if (debitHasKeyword && creditHasKeyword) {
      matchReasons.push('Both have transfer keywords');
      score += 0.2;
    } else if (debitHasKeyword || creditHasKeyword) {
      matchReasons.push('One has transfer keyword');
      score += 0.1;
    }

    // Cross-reference in descriptions
    const sourceAccount = accounts.find((a) => a.id === debit.accountId);
    const targetAccount = accounts.find((a) => a.id === credit.accountId);

    if (sourceAccount && creditDesc.includes(sourceAccount.accountNumber.slice(-4))) {
      matchReasons.push('Credit references source account');
      score += 0.15;
    }

    if (targetAccount && debitDesc.includes(targetAccount.accountNumber.slice(-4))) {
      matchReasons.push('Debit references target account');
      score += 0.15;
    }

    // Same bank bonus
    if (sourceAccount && targetAccount && sourceAccount.bankId === targetAccount.bankId) {
      matchReasons.push('Same bank');
      score += 0.1;
    }

    // Cap at 1.0
    const confidence = Math.min(1, score);

    return {
      sourceTransaction: debit,
      targetTransaction: credit,
      confidence,
      matchReasons,
    };
  }

  /**
   * Check if description contains transfer keywords
   */
  private hasTransferKeyword(description: string): boolean {
    return this.config.transferKeywords.some((keyword) =>
      description.includes(keyword)
    );
  }

  /**
   * Calculate days between two ISO dates
   */
  private daysBetween(date1: string, date2: string): number {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Detect multi-hop transfers (A -> B -> C)
   */
  detectMultiHopTransfers(
    matches: TransferMatch[]
  ): Array<TransferCandidate[]> {
    // Build graph of transfers
    const graph = new Map<number, number[]>();

    for (const match of matches) {
      const sourceId = match.sourceTransaction.id;
      const targetId = match.targetTransaction.id;

      const existing = graph.get(sourceId) || [];
      existing.push(targetId);
      graph.set(sourceId, existing);
    }

    // Find chains
    const chains: Array<TransferCandidate[]> = [];
    const visited = new Set<number>();

    const findChain = (
      startId: number,
      transactions: Map<number, TransferCandidate>
    ): TransferCandidate[] => {
      const chain: TransferCandidate[] = [];
      let currentId = startId;

      while (currentId && !visited.has(currentId)) {
        visited.add(currentId);
        const tx = transactions.get(currentId);
        if (tx) chain.push(tx);

        const next = graph.get(currentId);
        currentId = next?.[0] ?? 0;
      }

      return chain;
    };

    // Build transaction lookup
    const txMap = new Map<number, TransferCandidate>();
    for (const match of matches) {
      txMap.set(match.sourceTransaction.id, match.sourceTransaction);
      txMap.set(match.targetTransaction.id, match.targetTransaction);
    }

    // Find all chains
    for (const match of matches) {
      if (!visited.has(match.sourceTransaction.id)) {
        const chain = findChain(match.sourceTransaction.id, txMap);
        if (chain.length > 1) {
          chains.push(chain);
        }
      }
    }

    return chains;
  }

  /**
   * Get all transaction IDs that are part of transfers
   */
  getTransferTransactionIds(matches: TransferMatch[]): Set<number> {
    const ids = new Set<number>();
    for (const match of matches) {
      ids.add(match.sourceTransaction.id);
      ids.add(match.targetTransaction.id);
    }
    return ids;
  }
}

/**
 * Convenience function for quick transfer detection
 */
export function detectTransfers(
  transactions: TransferCandidate[],
  accounts: AccountContext[],
  existingLinks?: Array<{ sourceId: number; targetId: number }>
): TransferMatch[] {
  const detector = new TransferDetector();
  return detector.detectTransfers(transactions, accounts, existingLinks);
}

/**
 * Filter out transfer transactions from a list
 */
export function excludeTransfers(
  transactions: TransferCandidate[],
  transferMatches: TransferMatch[]
): TransferCandidate[] {
  const transferIds = new Set<number>();
  for (const match of transferMatches) {
    transferIds.add(match.sourceTransaction.id);
    transferIds.add(match.targetTransaction.id);
  }
  return transactions.filter((tx) => !transferIds.has(tx.id));
}

/**
 * Generate transfer report for display
 */
export function generateTransferReport(matches: TransferMatch[]): string {
  const lines: string[] = [];

  lines.push('=== Inter-Account Transfer Detection Report ===');
  lines.push(`Total Matches: ${matches.length}`);
  lines.push('');

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    lines.push(`Transfer ${i + 1}:`);
    lines.push(`  From: ${match.sourceTransaction.description}`);
    lines.push(`  Amount: $${(Math.abs(match.sourceTransaction.amount) / 100).toFixed(2)}`);
    lines.push(`  To: ${match.targetTransaction.description}`);
    lines.push(`  Confidence: ${(match.confidence * 100).toFixed(0)}%`);
    lines.push(`  Reasons: ${match.matchReasons.join(', ')}`);
    lines.push('');
  }

  return lines.join('\n');
}
