/**
 * Ledger Journal Entry Operations — create, post, reverse
 */

import { db, journalEntries, journalEntryLines, chartOfAccounts } from '../../schema.js';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import type { JournalEntryLine, CreateJournalEntryParams, JournalEntry } from './types.js';
import { generateEntryNumber } from './ledger-helpers.js';
import { findAccountByCode } from './ledger-chart-ops.js';

export async function createJournalEntry(params: CreateJournalEntryParams): Promise<JournalEntry> {
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
  const entryNumber = await generateEntryNumber(userId);
  const now = new Date().toISOString();
  const entryId = crypto.randomUUID();
  await db.insert(journalEntries).values({
    id: entryId,
    userId,
    entryNumber,
    entryDate,
    description,
    reference: reference ?? null,
    sourceType,
    sourceId: sourceId ?? null,
    status: 'draft',
    isAdjusting: isAdjusting ?? false,
    isClosing: isClosing ?? false,
    totalDebits,
    totalCredits,
    createdAt: now,
    updatedAt: now,
  });

  const createdLines = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const account = await findAccountByCode(userId, line.accountCode);
    if (!account) throw new Error(`Account not found: ${line.accountCode}`);
    const lineId = crypto.randomUUID();
    await db.insert(journalEntryLines).values({
      id: lineId,
      journalEntryId: entryId,
      lineNumber: i + 1,
      accountId: account.id,
      description: line.description ?? null,
      debitAmount: line.debitAmount,
      creditAmount: line.creditAmount,
      taxCode: line.taxCode ?? null,
      taxAmount: line.taxAmount ?? 0,
      bankAccountId: line.bankAccountId ?? null,
      transactionId: line.transactionId ?? null,
      createdAt: now,
    });
    createdLines.push({
      id: lineId,
      lineNumber: i + 1,
      accountId: account.id,
      accountCode: account.accountCode ?? '',
      accountName: account.accountName ?? '',
      description: line.description ?? null,
      debitAmount: line.debitAmount,
      creditAmount: line.creditAmount,
      taxCode: line.taxCode ?? null,
      taxAmount: line.taxAmount ?? 0,
    });
  }
  return {
    id: entryId,
    entryNumber,
    entryDate,
    description,
    reference: reference ?? null,
    sourceType,
    sourceId: sourceId ?? null,
    status: 'draft',
    totalDebits,
    totalCredits,
    lines: createdLines,
  };
}

export async function postJournalEntry(entryId: string, postedBy: string): Promise<void> {
  const now = new Date().toISOString();
  await db
    .update(journalEntries)
    .set({ status: 'posted', postedAt: now, postedBy, updatedAt: now })
    .where(eq(journalEntries.id, entryId));
}

export async function reverseJournalEntry(
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
    originalLines.map(async (line: typeof journalEntryLines.$inferSelect) => {
      const account = await db
        .select()
        .from(chartOfAccounts)
        .where(eq(chartOfAccounts.id, line.accountId))
        .limit(1);
      return {
        accountCode: account[0].accountCode ?? '',
        description: `Reversal: ${line.description ?? ''}`,
        debitAmount: line.creditAmount ?? 0,
        creditAmount: line.debitAmount ?? 0,
      };
    }),
  );
  const reversalEntry = await createJournalEntry({
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
