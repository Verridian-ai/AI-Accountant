/**
 * Owner Equity — Contribution & Drawing Scanner
 * Detects potential owner contributions and drawings from transaction data.
 */

import { db, transactions, accounts } from '../../schema.js';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { TransferDetector } from '../transfers/detector.js';
import type { TransferCandidate, AccountContext } from '../transfers/detector.js';
import { getFinancialYearDates } from '../tax.js';
import type { DetectedEquityEvent } from './types.js';
import {
  CONTRIBUTION_THRESHOLD_CENTS,
  PERSONAL_EXPENSE_CATEGORIES,
  ATM_PATTERNS,
} from './types.js';

interface TransactionRow {
  id: string;
  accountId: string | null;
  date: string;
  description: string;
  amount: number;
  category: string | null;
  isTransfer: boolean | number | null;
}

interface AccountRow {
  id: string;
  accountNumber: string | null;
  bankName: string | null;
  accountName: string;
  accountType: string;
  ownershipTag: string | null;
}

function toOwnershipTag(tag: string | null): 'business' | 'personal' | undefined {
  if (tag === 'business' || tag === 'personal') return tag;
  return undefined;
}

/**
 * Scan for potential owner contributions (personal -> business transfers)
 * Uses TransferDetector to match cross-account transfers.
 */
export async function scanForContributions(
  userId: string,
  financialYear: string,
): Promise<DetectedEquityEvent[]> {
  const { start, end } = getFinancialYearDates(financialYear);

  // Load accounts
  const userAccounts: AccountRow[] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .all();

  // Load transactions in the financial year
  const txRows: TransactionRow[] = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.date, start),
        lte(transactions.date, end),
      ),
    )
    .all();

  // Map to TransferDetector format
  const candidates: TransferCandidate[] = txRows.map((tx: TransactionRow, i: number) => ({
    id: i,
    accountId: userAccounts.findIndex((a: AccountRow) => a.id === tx.accountId),
    date: tx.date,
    description: tx.description,
    amount: tx.amount,
  }));

  const accountContexts: AccountContext[] = userAccounts.map((a: AccountRow, i: number) => ({
    id: i,
    accountNumber: a.accountNumber ?? '',
    bankId: a.bankName ?? 'CBA',
    accountName: a.accountName,
    accountType: a.accountType,
    ownershipTag: toOwnershipTag(a.ownershipTag) ?? 'business',
  }));

  // Detect contributions using TransferDetector
  const detector = new TransferDetector();
  const contributionIndices = detector.detectOwnerContributions(candidates, accountContexts);

  // Map back to detected events, filtering by threshold
  const events: DetectedEquityEvent[] = [];
  for (const idx of contributionIndices) {
    const candidate = candidates[idx];
    const tx = txRows[candidate ? candidates.indexOf(candidate) : -1];
    if (!tx) continue;

    const amount = Math.abs(tx.amount);
    if (amount < CONTRIBUTION_THRESHOLD_CENTS) continue;

    const sourceAccountIdx = candidate.accountId;
    const sourceAccount = userAccounts[sourceAccountIdx];

    events.push({
      transactionId: tx.id,
      amount,
      date: tx.date,
      sourceAccount: sourceAccount?.accountName ?? 'Unknown',
      description: tx.description,
      confidence: 0.8,
    });
  }

  return events;
}

/**
 * Scan for potential owner drawings (business -> personal transfers,
 * ATM withdrawals from business accounts, personal expenses from business accounts)
 */
export async function scanForDrawings(
  userId: string,
  financialYear: string,
): Promise<DetectedEquityEvent[]> {
  const { start, end } = getFinancialYearDates(financialYear);

  // Load business accounts
  const businessAccounts: AccountRow[] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), sql`${accounts.ownershipTag} = 'business'`))
    .all();

  if (businessAccounts.length === 0) return [];

  const businessAccountIds = new Set(businessAccounts.map((a: AccountRow) => a.id));

  // Load business account transactions in the financial year
  const txRows: TransactionRow[] = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.date, start),
        lte(transactions.date, end),
        sql`${transactions.amount} < 0`,
      ),
    )
    .all();

  const events: DetectedEquityEvent[] = [];

  for (const tx of txRows) {
    // Only consider transactions from business accounts
    if (!tx.accountId || !businessAccountIds.has(tx.accountId)) continue;

    const amount = Math.abs(tx.amount);
    const desc = tx.description ?? '';

    // Check for ATM withdrawals
    const isATM = ATM_PATTERNS.some((p) => p.test(desc));
    if (isATM) {
      const account = businessAccounts.find((a: AccountRow) => a.id === tx.accountId);
      events.push({
        transactionId: tx.id,
        amount,
        date: tx.date,
        sourceAccount: account?.accountName ?? 'Business Account',
        description: desc,
        confidence: 0.9,
      });
      continue;
    }

    // Check for personal expense categories
    const isPersonalExpense = PERSONAL_EXPENSE_CATEGORIES.includes(tx.category ?? '');
    if (isPersonalExpense) {
      const account = businessAccounts.find((a: AccountRow) => a.id === tx.accountId);
      events.push({
        transactionId: tx.id,
        amount,
        date: tx.date,
        sourceAccount: account?.accountName ?? 'Business Account',
        description: desc,
        confidence: 0.7,
      });
      continue;
    }

    // Check for transfers to personal accounts (isTransfer + isOwnerContribution inverse)
    if (tx.isTransfer && amount >= CONTRIBUTION_THRESHOLD_CENTS) {
      const account = businessAccounts.find((a: AccountRow) => a.id === tx.accountId);
      events.push({
        transactionId: tx.id,
        amount,
        date: tx.date,
        sourceAccount: account?.accountName ?? 'Business Account',
        description: desc,
        confidence: 0.75,
      });
    }
  }

  return events;
}
