/**
 * Ledger Service — Double-entry bookkeeping for the Australian accounting system
 */

import {
  db,
  journalEntries,
  journalEntryLines,
  chartOfAccounts,
  transactions,
} from '../../schema.js';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import crypto from 'crypto';
import type {
  JournalEntryLine,
  CreateJournalEntryParams,
  JournalEntry,
  AccountBalance,
} from './types.js';
import { STANDARD_CHART_OF_ACCOUNTS } from './chart-of-accounts.js';

export class LedgerService {
  async initializeChartOfAccounts(userId: string): Promise<void> {
    const now = new Date().toISOString();
    for (const account of STANDARD_CHART_OF_ACCOUNTS) {
      let parentAccountId: string | undefined;
      if (account.parent) {
        const parent = await db
          .select()
          .from(chartOfAccounts)
          .where(
            and(
              eq(chartOfAccounts.userId, userId),
              eq(chartOfAccounts.accountCode, account.parent),
            ),
          )
          .limit(1);
        if (parent.length > 0) parentAccountId = parent[0].id;
      }
      await db
        .insert(chartOfAccounts)
        .values({
          id: crypto.randomUUID(),
          userId,
          accountCode: account.code,
          accountName: account.name,
          accountType: account.type,
          normalBalance: account.normalBalance as 'debit' | 'credit',
          parentAccountId,
          taxCode: account.taxCode,
          basLabel: account.basLabel,
          isSystemAccount: true,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing();
    }
  }

  async getChartOfAccounts(userId: string): Promise<(typeof chartOfAccounts.$inferSelect)[]> {
    return db
      .select()
      .from(chartOfAccounts)
      .where(eq(chartOfAccounts.userId, userId))
      .orderBy(chartOfAccounts.accountCode);
  }

  async findAccountByCode(
    userId: string,
    accountCode: string,
  ): Promise<typeof chartOfAccounts.$inferSelect | null> {
    const result = await db
      .select()
      .from(chartOfAccounts)
      .where(and(eq(chartOfAccounts.userId, userId), eq(chartOfAccounts.accountCode, accountCode)))
      .limit(1);
    return result[0] || null;
  }

  async createJournalEntry(params: CreateJournalEntryParams): Promise<JournalEntry> {
    const {
      userId,
      entryDate,
      description,
      reference,
      sourceType,
      sourceId,
      lines,
      isAdjusting,
      isClosing,
    } = params;
    const totalDebits = lines.reduce((sum, line) => sum + Math.round(line.debitAmount), 0);
    const totalCredits = lines.reduce((sum, line) => sum + Math.round(line.creditAmount), 0);
    if (totalDebits !== totalCredits) {
      throw new Error(
        `Journal entry is not balanced: Debits (${totalDebits}) ≠ Credits (${totalCredits})`,
      );
    }
    const entryNumber = await this.generateEntryNumber(userId);
    const now = new Date().toISOString();
    const entryId = crypto.randomUUID();
    await db.insert(journalEntries).values({
      id: entryId,
      userId,
      entryNumber,
      entryDate,
      description,
      reference: reference || null,
      sourceType,
      sourceId: sourceId || null,
      status: 'draft',
      isAdjusting: isAdjusting || false,
      isClosing: isClosing || false,
      totalDebits,
      totalCredits,
      createdAt: now,
      updatedAt: now,
    });

    const createdLines = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const account = await this.findAccountByCode(userId, line.accountCode);
      if (!account) throw new Error(`Account not found: ${line.accountCode}`);
      const lineId = crypto.randomUUID();
      await db.insert(journalEntryLines).values({
        id: lineId,
        journalEntryId: entryId,
        lineNumber: i + 1,
        accountId: account.id,
        description: line.description || null,
        debitAmount: line.debitAmount,
        creditAmount: line.creditAmount,
        taxCode: line.taxCode || null,
        taxAmount: line.taxAmount || 0,
        bankAccountId: line.bankAccountId || null,
        transactionId: line.transactionId || null,
        createdAt: now,
      });
      createdLines.push({
        id: lineId,
        lineNumber: i + 1,
        accountId: account.id,
        accountCode: account.accountCode ?? '',
        accountName: account.accountName ?? '',
        description: line.description || null,
        debitAmount: line.debitAmount,
        creditAmount: line.creditAmount,
        taxCode: line.taxCode || null,
        taxAmount: line.taxAmount || 0,
      });
    }
    return {
      id: entryId,
      entryNumber,
      entryDate,
      description,
      reference: reference || null,
      sourceType,
      sourceId: sourceId || null,
      status: 'draft',
      totalDebits,
      totalCredits,
      lines: createdLines,
    };
  }

  async postJournalEntry(entryId: string, postedBy: string): Promise<void> {
    const now = new Date().toISOString();
    await db
      .update(journalEntries)
      .set({ status: 'posted', postedAt: now, postedBy, updatedAt: now })
      .where(eq(journalEntries.id, entryId));
  }

  async reverseJournalEntry(
    originalEntryId: string,
    userId: string,
    reversalDate: string,
    reason: string,
  ): Promise<JournalEntry> {
    const original = await db
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.id, originalEntryId))
      .limit(1);
    if (!original.length) throw new Error('Journal entry not found');
    const originalLines = await db
      .select()
      .from(journalEntryLines)
      .where(eq(journalEntryLines.journalEntryId, originalEntryId));
    const reversalLines: JournalEntryLine[] = await Promise.all(
      originalLines.map(async (line: any) => {
        const account = await db
          .select()
          .from(chartOfAccounts)
          .where(eq(chartOfAccounts.id, line.accountId))
          .limit(1);
        return {
          accountCode: account[0].accountCode,
          description: `Reversal: ${line.description || ''}`,
          debitAmount: line.creditAmount,
          creditAmount: line.debitAmount,
          taxCode: line.taxCode || undefined,
          taxAmount: line.taxAmount ? -line.taxAmount : undefined,
          bankAccountId: line.bankAccountId || undefined,
          transactionId: line.transactionId || undefined,
        };
      }),
    );
    const reversalEntry = await this.createJournalEntry({
      userId,
      entryDate: reversalDate,
      description: `Reversal of ${original[0].entryNumber}: ${reason}`,
      reference: `REV-${original[0].entryNumber}`,
      sourceType: 'adjustment',
      sourceId: originalEntryId,
      lines: reversalLines,
    });
    await db
      .update(journalEntries)
      .set({ reversedById: reversalEntry.id, updatedAt: new Date().toISOString() })
      .where(eq(journalEntries.id, originalEntryId));
    return reversalEntry;
  }

  async mapTransactionToJournal(userId: string, transactionId: string): Promise<JournalEntry> {
    const txn = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, transactionId))
      .limit(1);
    if (!txn.length) throw new Error('Transaction not found');
    const transaction = txn[0];
    const amount = Math.abs(transaction.amount);
    const isCredit = transaction.amount > 0;
    const lines: JournalEntryLine[] = [];
    const bankAccountCode = '1-0110';
    const gstAmount =
      transaction.gstApplicable && transaction.gstAmount
        ? transaction.gstAmount
        : transaction.gstApplicable
          ? Math.round((amount * 100) / 1100)
          : 0;
    const netAmount = amount - gstAmount;

    if (isCredit) {
      lines.push({
        accountCode: bankAccountCode,
        description: transaction.description,
        debitAmount: amount,
        creditAmount: 0,
        transactionId,
      });
      const revenueAccountCode = this.mapCategoryToAccount(transaction.category, 'revenue');
      lines.push({
        accountCode: revenueAccountCode,
        description: transaction.description,
        debitAmount: 0,
        creditAmount: netAmount,
        taxCode: transaction.gstApplicable ? 'GST' : 'FRE',
        transactionId,
      });
      if (gstAmount > 0) {
        lines.push({
          accountCode: '2-0300',
          description: 'GST on ' + transaction.description,
          debitAmount: 0,
          creditAmount: gstAmount,
          taxCode: 'GST',
          taxAmount: gstAmount,
          transactionId,
        });
      }
    } else {
      const expenseAccountCode = this.mapCategoryToAccount(transaction.category, 'expense');
      lines.push({
        accountCode: expenseAccountCode,
        description: transaction.description,
        debitAmount: netAmount,
        creditAmount: 0,
        taxCode: transaction.gstApplicable ? 'GST' : 'FRE',
        transactionId,
      });
      if (gstAmount > 0) {
        lines.push({
          accountCode: '2-0310',
          description: 'GST on ' + transaction.description,
          debitAmount: gstAmount,
          creditAmount: 0,
          taxCode: 'GST',
          taxAmount: gstAmount,
          transactionId,
        });
      }
      lines.push({
        accountCode: bankAccountCode,
        description: transaction.description,
        debitAmount: 0,
        creditAmount: amount,
        transactionId,
      });
    }
    return this.createJournalEntry({
      userId,
      entryDate: transaction.date,
      description: transaction.description,
      sourceType: 'transaction',
      sourceId: transactionId,
      lines,
    });
  }

  async mapTransferToJournal(
    userId: string,
    sourceTransactionId: string,
    destinationTransactionId: string,
    amount: number,
    transferDate: string,
  ): Promise<JournalEntry> {
    const lines: JournalEntryLine[] = [
      {
        accountCode: '1-0110',
        description: 'Transfer In',
        debitAmount: amount,
        creditAmount: 0,
        transactionId: destinationTransactionId,
      },
      {
        accountCode: '1-0110',
        description: 'Transfer Out',
        debitAmount: 0,
        creditAmount: amount,
        transactionId: sourceTransactionId,
      },
    ];
    return this.createJournalEntry({
      userId,
      entryDate: transferDate,
      description: 'Internal Transfer',
      sourceType: 'transaction',
      lines,
    });
  }

  async calculateAccountBalances(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<AccountBalance[]> {
    const balances: AccountBalance[] = [];
    const allAccounts = await this.getChartOfAccounts(userId);
    for (const account of allAccounts) {
      const totals = await db
        .select({
          totalDebits: sql<number>`COALESCE(SUM(${journalEntryLines.debitAmount}), 0)`,
          totalCredits: sql<number>`COALESCE(SUM(${journalEntryLines.creditAmount}), 0)`,
        })
        .from(journalEntryLines)
        .innerJoin(journalEntries, eq(journalEntryLines.journalEntryId, journalEntries.id))
        .where(
          and(
            eq(journalEntryLines.accountId, account.id),
            eq(journalEntries.userId, userId),
            eq(journalEntries.status, 'posted'),
            gte(journalEntries.entryDate, startDate),
            lte(journalEntries.entryDate, endDate),
          ),
        );
      const totalDebits = totals[0]?.totalDebits || 0;
      const totalCredits = totals[0]?.totalCredits || 0;
      const closingBalance =
        account.normalBalance === 'debit' ? totalDebits - totalCredits : totalCredits - totalDebits;
      balances.push({
        accountId: account.id,
        accountCode: account.accountCode ?? '',
        accountName: account.accountName ?? '',
        accountType: account.accountType ?? '',
        openingBalance: 0,
        totalDebits,
        totalCredits,
        closingBalance,
      });
    }
    return balances.filter((b) => b.totalDebits !== 0 || b.totalCredits !== 0);
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
    const balances = await this.calculateAccountBalances(userId, '1900-01-01', asOfDate);
    let totalDebits = 0;
    let totalCredits = 0;
    for (const balance of balances) {
      if (balance.closingBalance > 0) totalDebits += balance.closingBalance;
      else totalCredits += Math.abs(balance.closingBalance);
    }
    totalDebits = Math.round(totalDebits);
    totalCredits = Math.round(totalCredits);
    return {
      accounts: balances,
      totalDebits,
      totalCredits,
      isBalanced: Math.abs(totalDebits - totalCredits) < 1,
    };
  }

  private async generateEntryNumber(userId: string): Promise<string> {
    const countResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(journalEntries)
      .where(eq(journalEntries.userId, userId));
    const nextNumber = (countResult[0]?.count || 0) + 1;
    const year = new Date().getFullYear();
    return `JE-${year}-${String(nextNumber).padStart(5, '0')}`;
  }

  private mapCategoryToAccount(category: string | null, type: 'revenue' | 'expense'): string {
    if (!category) return type === 'revenue' ? '4-0400' : '6-2000';
    const categoryLower = category.toLowerCase();
    if (type === 'revenue') {
      if (categoryLower.includes('sale')) return '4-0100';
      if (categoryLower.includes('service')) return '4-0200';
      if (categoryLower.includes('interest')) return '4-0300';
      if (categoryLower.includes('export')) return '4-0500';
      return '4-0400';
    }
    if (categoryLower.includes('advertising') || categoryLower.includes('marketing'))
      return '6-0100';
    if (categoryLower.includes('bank') || categoryLower.includes('fee')) return '6-0200';
    if (
      categoryLower.includes('computer') ||
      categoryLower.includes('software') ||
      categoryLower.includes('it')
    )
      return '6-0300';
    if (categoryLower.includes('entertainment') || categoryLower.includes('meal')) return '6-0500';
    if (categoryLower.includes('insurance')) return '6-0600';
    if (categoryLower.includes('interest')) return '6-0700';
    if (
      categoryLower.includes('vehicle') ||
      categoryLower.includes('fuel') ||
      categoryLower.includes('car')
    )
      return '6-0800';
    if (categoryLower.includes('office') || categoryLower.includes('stationery')) return '6-0900';
    if (
      categoryLower.includes('professional') ||
      categoryLower.includes('legal') ||
      categoryLower.includes('accounting')
    )
      return '6-1000';
    if (categoryLower.includes('rent') || categoryLower.includes('lease')) return '6-1100';
    if (categoryLower.includes('repair') || categoryLower.includes('maintenance')) return '6-1200';
    if (categoryLower.includes('subscription')) return '6-1300';
    if (
      categoryLower.includes('phone') ||
      categoryLower.includes('internet') ||
      categoryLower.includes('telecom')
    )
      return '6-1400';
    if (
      categoryLower.includes('travel') ||
      categoryLower.includes('flight') ||
      categoryLower.includes('accommodation')
    )
      return '6-1500';
    if (
      categoryLower.includes('utility') ||
      categoryLower.includes('electric') ||
      categoryLower.includes('gas') ||
      categoryLower.includes('water')
    )
      return '6-1600';
    if (
      categoryLower.includes('wage') ||
      categoryLower.includes('salary') ||
      categoryLower.includes('payroll')
    )
      return '6-1700';
    if (categoryLower.includes('super')) return '6-1800';
    if (categoryLower.includes('wfh') || categoryLower.includes('home office')) return '6-1900';
    return '6-2000';
  }
}
