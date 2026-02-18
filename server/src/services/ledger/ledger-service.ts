/**
 * Ledger Service — Double-entry bookkeeping facade
 * Delegates to sub-modules for all implementations.
 */

import type { CreateJournalEntryParams, JournalEntry, AccountBalance } from './types.js';
import {
  initializeChartOfAccounts,
  getChartOfAccountsList,
  findAccountByCode as findAccountByCodeImpl,
} from './ledger-chart-ops.js';
import {
  createJournalEntry as createJournalEntryImpl,
  postJournalEntry as postJournalEntryImpl,
  reverseJournalEntry as reverseJournalEntryImpl,
} from './ledger-journal-ops.js';
import {
  mapTransactionToJournal as mapTransactionToJournalImpl,
  mapTransferToJournal as mapTransferToJournalImpl,
} from './ledger-transaction-mapping.js';
import {
  calculateAccountBalances as calculateAccountBalancesImpl,
  generateTrialBalance as generateTrialBalanceImpl,
} from './ledger-calculations.js';
import type { chartOfAccounts } from '../../schema.js';

export class LedgerService {
  async initializeChartOfAccounts(userId: string): Promise<void> {
    return initializeChartOfAccounts(userId);
  }

  async getChartOfAccounts(userId: string): Promise<(typeof chartOfAccounts.$inferSelect)[]> {
    return getChartOfAccountsList(userId);
  }

  async findAccountByCode(
    userId: string,
    accountCode: string,
  ): Promise<typeof chartOfAccounts.$inferSelect | null> {
    return findAccountByCodeImpl(userId, accountCode);
  }

  async createJournalEntry(params: CreateJournalEntryParams): Promise<JournalEntry> {
    return createJournalEntryImpl(params);
  }

  async postJournalEntry(entryId: string, postedBy: string): Promise<void> {
    return postJournalEntryImpl(entryId, postedBy);
  }

  async reverseJournalEntry(
    originalEntryId: string,
    userId: string,
    reversalDate: string,
    reason: string,
  ): Promise<JournalEntry> {
    return reverseJournalEntryImpl(originalEntryId, userId, reversalDate, reason);
  }

  async mapTransactionToJournal(userId: string, transactionId: string): Promise<JournalEntry> {
    return mapTransactionToJournalImpl(userId, transactionId);
  }

  async mapTransferToJournal(
    userId: string,
    sourceTransactionId: string,
    destinationTransactionId: string,
    amount: number,
    transferDate: string,
  ): Promise<JournalEntry> {
    return mapTransferToJournalImpl(
      userId,
      sourceTransactionId,
      destinationTransactionId,
      amount,
      transferDate,
    );
  }

  async calculateAccountBalances(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<AccountBalance[]> {
    return calculateAccountBalancesImpl(userId, startDate, endDate);
  }

  async generateTrialBalance(
    userId: string,
    asOfDate: string,
  ): Promise<{
    accounts: AccountBalance[];
    totalDebits: number;
    totalCredits: number;
    isBalanced: boolean;
  }> {
    return generateTrialBalanceImpl(userId, asOfDate);
  }
}
