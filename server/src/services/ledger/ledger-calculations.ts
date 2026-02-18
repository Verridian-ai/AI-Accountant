/**
 * Ledger Calculations — account balances and trial balance
 */

import { db, journalEntries, journalEntryLines, chartOfAccounts } from '../../schema.js';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import type { AccountBalance } from './types.js';

export async function calculateAccountBalances(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<AccountBalance[]> {
  const balances: AccountBalance[] = [];
  const allAccounts = await db
    .select()
    .from(chartOfAccounts)
    .where(eq(chartOfAccounts.userId, userId))
    .orderBy(chartOfAccounts.accountCode);
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
    const totalDebits = totals[0]?.totalDebits ?? 0;
    const totalCredits = totals[0]?.totalCredits ?? 0;
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

export async function generateTrialBalance(
  userId: string,
  asOfDate: string,
): Promise<{
  accounts: AccountBalance[];
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
}> {
  const balances = await calculateAccountBalances(userId, '1900-01-01', asOfDate);
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
