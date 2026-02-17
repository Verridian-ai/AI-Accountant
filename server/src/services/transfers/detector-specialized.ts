/**
 * Inter-Account Transfer Detection — Specialized Detectors
 *
 * Extracted specialized detection methods: multi-hop transfers,
 * credit card payments, owner contributions, and savings sweeps.
 * These are used as method implementations in the TransferDetector class.
 */

import type { TransferCandidate, AccountContext, TransferMatch } from './detector-types.js';

/**
 * Detect multi-hop transfers (A -> B -> C)
 */
export function detectMultiHopTransfers(matches: TransferMatch[]): Array<TransferCandidate[]> {
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
    transactions: Map<number, TransferCandidate>,
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
 * Detect credit card payments across accounts
 */
export function detectCreditCardPayments(
  transactions: TransferCandidate[],
  accounts: AccountContext[],
  evaluateMatch: (
    debit: TransferCandidate,
    credit: TransferCandidate,
    accounts: AccountContext[],
  ) => TransferMatch | null,
  minConfidence: number,
): TransferMatch[] {
  const ccKeywords = ['credit card', 'cc payment', 'card payment', 'visa payment', 'mastercard'];
  const creditCardAccounts = accounts.filter((a) => a.accountType === 'credit_card');
  if (creditCardAccounts.length === 0) return [];

  const ccAccountIds = new Set(creditCardAccounts.map((a) => a.id));
  const matches: TransferMatch[] = [];
  const usedTransactions = new Set<number>();

  // Find debits from transaction accounts that match credits on credit card accounts
  const debits = transactions.filter((tx) => tx.amount < 0 && !ccAccountIds.has(tx.accountId));
  const credits = transactions.filter((tx) => tx.amount > 0 && ccAccountIds.has(tx.accountId));

  for (const debit of debits) {
    if (usedTransactions.has(debit.id)) continue;
    const debitDesc = debit.description.toLowerCase();
    const hasCcKeyword = ccKeywords.some((kw) => debitDesc.includes(kw));

    for (const credit of credits) {
      if (usedTransactions.has(credit.id)) continue;

      const match = evaluateMatch(debit, credit, accounts);
      if (match) {
        // Boost confidence for CC keyword matches
        if (hasCcKeyword) {
          match.confidence = Math.min(1, match.confidence + 0.15);
          if (!match.matchReasons.includes('Credit card payment')) {
            match.matchReasons.push('Credit card payment');
          }
        }
        if (match.confidence >= minConfidence) {
          matches.push(match);
          usedTransactions.add(debit.id);
          usedTransactions.add(credit.id);
          break;
        }
      }
    }
  }

  return matches;
}

/**
 * Detect owner contributions (personal-to-business transfers)
 */
export function detectOwnerContributions(
  transactions: TransferCandidate[],
  accounts: AccountContext[],
  evaluateMatch: (
    debit: TransferCandidate,
    credit: TransferCandidate,
    accounts: AccountContext[],
  ) => TransferMatch | null,
  minConfidence: number,
): number[] {
  const personalAccounts = accounts.filter((a) => a.ownershipTag === 'personal');
  const businessAccounts = accounts.filter((a) => a.ownershipTag === 'business');
  if (personalAccounts.length === 0 || businessAccounts.length === 0) return [];

  const personalIds = new Set(personalAccounts.map((a) => a.id));
  const businessIds = new Set(businessAccounts.map((a) => a.id));
  const contributionIds: number[] = [];

  // Find debits from personal accounts matching credits to business accounts
  const debits = transactions.filter((tx) => tx.amount < 0 && personalIds.has(tx.accountId));
  const credits = transactions.filter((tx) => tx.amount > 0 && businessIds.has(tx.accountId));
  const usedCredits = new Set<number>();

  for (const debit of debits) {
    for (const credit of credits) {
      if (usedCredits.has(credit.id)) continue;

      const match = evaluateMatch(debit, credit, accounts);
      if (match && match.confidence >= minConfidence) {
        contributionIds.push(credit.id);
        usedCredits.add(credit.id);
        break;
      }
    }
  }

  return contributionIds;
}

/**
 * Detect savings sweep patterns (regular automatic transfers to savings)
 */
export function detectSavingsSweeps(
  transactions: TransferCandidate[],
  accounts: AccountContext[],
  evaluateMatch: (
    debit: TransferCandidate,
    credit: TransferCandidate,
    accounts: AccountContext[],
  ) => TransferMatch | null,
  minConfidence: number,
  daysBetween: (date1: string, date2: string) => number,
): TransferMatch[] {
  const sweepKeywords = ['sweep', 'auto save', 'automatic', 'scheduled', 'recurring'];
  const matches: TransferMatch[] = [];
  const usedTransactions = new Set<number>();

  // Group transactions by amount to find recurring patterns
  const debitsByAmount = new Map<number, TransferCandidate[]>();
  for (const tx of transactions) {
    if (tx.amount >= 0) continue;
    const absAmount = Math.abs(tx.amount);
    const list = debitsByAmount.get(absAmount) || [];
    list.push(tx);
    debitsByAmount.set(absAmount, list);
  }

  // Find recurring same-amount debits (at least 2 occurrences)
  for (const [_amount, debits] of debitsByAmount) {
    if (debits.length < 2) continue;

    // Check if the interval is regular
    const sortedDebits = [...debits].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    const intervals: number[] = [];
    for (let i = 1; i < sortedDebits.length; i++) {
      intervals.push(daysBetween(sortedDebits[i - 1].date, sortedDebits[i].date));
    }

    // Check for regularity: consistent interval (within 3 day tolerance)
    const avgInterval = intervals.reduce((s, v) => s + v, 0) / intervals.length;
    const isRegular = intervals.every((iv) => Math.abs(iv - avgInterval) <= 3);

    if (!isRegular) continue;

    // Match each sweep debit to corresponding credit
    for (const debit of sortedDebits) {
      if (usedTransactions.has(debit.id)) continue;
      const debitDesc = debit.description.toLowerCase();
      const hasSweepKeyword = sweepKeywords.some((kw) => debitDesc.includes(kw));

      // Find matching credit in another account
      const credits = transactions.filter(
        (tx) => tx.amount > 0 && tx.accountId !== debit.accountId && !usedTransactions.has(tx.id),
      );

      for (const credit of credits) {
        const match = evaluateMatch(debit, credit, accounts);
        if (match) {
          if (hasSweepKeyword) {
            match.confidence = Math.min(1, match.confidence + 0.1);
            match.matchReasons.push('Savings sweep pattern');
          }
          match.matchReasons.push(
            `Recurring (${intervals.length + 1} occurrences, ~${Math.round(avgInterval)}d interval)`,
          );
          if (match.confidence >= minConfidence) {
            matches.push(match);
            usedTransactions.add(debit.id);
            usedTransactions.add(credit.id);
            break;
          }
        }
      }
    }
  }

  return matches;
}
