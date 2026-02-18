/**
 * Ledger Transaction Mapping — map bank transactions and transfers to journal entries
 */

import { db, transactions } from '../../schema.js';
import { eq } from 'drizzle-orm';
import type { JournalEntryLine, JournalEntry } from './types.js';
import { mapCategoryToAccount } from './ledger-helpers.js';
import { createJournalEntry } from './ledger-journal-ops.js';

export async function mapTransactionToJournal(
  userId: string,
  transactionId: string,
): Promise<JournalEntry> {
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
    const revenueAccountCode = mapCategoryToAccount(transaction.category, 'revenue');
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
    const expenseAccountCode = mapCategoryToAccount(transaction.category, 'expense');
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
  return createJournalEntry({
    userId,
    entryDate: transaction.date,
    description: transaction.description,
    sourceType: 'transaction',
    sourceId: transactionId,
    lines,
  });
}

export async function mapTransferToJournal(
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
  return createJournalEntry({
    userId,
    entryDate: transferDate,
    description: 'Internal Transfer',
    sourceType: 'transaction',
    lines,
  });
}
