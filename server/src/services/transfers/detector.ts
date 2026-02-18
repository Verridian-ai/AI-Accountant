/**
 * Inter-Account Transfer Detection
 *
 * Detects transfers between accounts owned by the same user.
 * Uses amount matching, date proximity, and description keywords
 * to identify transfer pairs and exclude them from income/expense reports.
 */

import {
  type TransferCandidate,
  type AccountContext,
  type TransferMatch,
  type TransferDetectorConfig,
  DEFAULT_CONFIG,
} from './detector-types.js';
import {
  detectMultiHopTransfers as detectMultiHopFn,
  detectCreditCardPayments as detectCCPaymentsFn,
  detectOwnerContributions as detectOwnerContribFn,
  detectSavingsSweeps as detectSweepsFn,
} from './detector-specialized.js';

export type { TransferCandidate, AccountContext, TransferMatch, TransferDetectorConfig };

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
    existingLinks: Array<{ sourceId: number; targetId: number }> = [],
  ): TransferMatch[] {
    const linkedIds = new Set<number>();
    for (const link of existingLinks) {
      linkedIds.add(link.sourceId);
      linkedIds.add(link.targetId);
    }

    const unlinked = transactions.filter((tx) => !linkedIds.has(tx.id) && !tx.isLinked);

    const debitsByAccount = new Map<number, TransferCandidate[]>();
    const creditsByAccount = new Map<number, TransferCandidate[]>();

    for (const tx of unlinked) {
      const map = tx.amount < 0 ? debitsByAccount : creditsByAccount;
      const list = map.get(tx.accountId) || [];
      list.push(tx);
      map.set(tx.accountId, list);
    }

    const matches: TransferMatch[] = [];
    const usedTransactions = new Set<number>();

    for (const [sourceAccountId, debits] of debitsByAccount) {
      for (const debit of debits) {
        if (usedTransactions.has(debit.id)) continue;

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

    matches.sort((a, b) => b.confidence - a.confidence);
    return matches;
  }

  /**
   * Evaluate if two transactions are a transfer pair
   */
  evaluateMatch(
    debit: TransferCandidate,
    credit: TransferCandidate,
    accounts: AccountContext[],
  ): TransferMatch | null {
    const matchReasons: string[] = [];
    let score = 0;

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
      return null;
    }

    const daysDiff = this.daysBetween(debit.date, credit.date);
    if (daysDiff > this.config.matchWindowDays) return null;

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

    const debitDesc = debit.description.toLowerCase();
    const creditDesc = credit.description.toLowerCase();
    const debitHasKw = this.hasTransferKeyword(debitDesc);
    const creditHasKw = this.hasTransferKeyword(creditDesc);

    if (debitHasKw && creditHasKw) {
      matchReasons.push('Both have transfer keywords');
      score += 0.2;
    } else if (debitHasKw || creditHasKw) {
      matchReasons.push('One has transfer keyword');
      score += 0.1;
    }

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
    if (sourceAccount && targetAccount && sourceAccount.bankId === targetAccount.bankId) {
      matchReasons.push('Same bank');
      score += 0.1;
    }
    if (targetAccount?.accountType === 'credit_card') {
      const ccKw = ['credit card', 'cc payment', 'card payment', 'visa', 'mastercard'];
      if (ccKw.some((kw) => debitDesc.includes(kw))) {
        matchReasons.push('Credit card payment');
        score += 0.15;
      }
    }
    if (sourceAccount?.ownershipTag === 'personal' && targetAccount?.ownershipTag === 'business') {
      matchReasons.push('Owner contribution (personal → business)');
      score += 0.1;
    }

    return {
      sourceTransaction: debit,
      targetTransaction: credit,
      confidence: Math.min(1, score),
      matchReasons,
    };
  }

  private hasTransferKeyword(description: string): boolean {
    return this.config.transferKeywords.some((keyword) => description.includes(keyword));
  }

  private daysBetween(date1: string, date2: string): number {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return Math.ceil(Math.abs(d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
  }

  // Delegated specialized detectors
  detectMultiHopTransfers(matches: TransferMatch[]): Array<TransferCandidate[]> {
    return detectMultiHopFn(matches);
  }

  detectCreditCardPayments(
    transactions: TransferCandidate[],
    accounts: AccountContext[],
  ): TransferMatch[] {
    return detectCCPaymentsFn(
      transactions,
      accounts,
      (d, c, a) => this.evaluateMatch(d, c, a),
      this.config.minConfidence,
    );
  }

  detectOwnerContributions(
    transactions: TransferCandidate[],
    accounts: AccountContext[],
  ): number[] {
    return detectOwnerContribFn(
      transactions,
      accounts,
      (d, c, a) => this.evaluateMatch(d, c, a),
      this.config.minConfidence,
    );
  }

  detectSavingsSweeps(
    transactions: TransferCandidate[],
    accounts: AccountContext[],
  ): TransferMatch[] {
    return detectSweepsFn(
      transactions,
      accounts,
      (d, c, a) => this.evaluateMatch(d, c, a),
      this.config.minConfidence,
      (d1, d2) => this.daysBetween(d1, d2),
    );
  }

  getTransferTransactionIds(matches: TransferMatch[]): Set<number> {
    const ids = new Set<number>();
    for (const match of matches) {
      ids.add(match.sourceTransaction.id);
      ids.add(match.targetTransaction.id);
    }
    return ids;
  }
}

// Re-export standalone convenience functions from detector-utils
export { detectTransfers, excludeTransfers, generateTransferReport } from './detector-utils.js';
