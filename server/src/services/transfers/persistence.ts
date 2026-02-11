/**
 * Transfer Persistence Service
 * Persists detected transfer matches to the database
 */
import { db, transferLinks, transactions } from '../../schema.js';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import type { TransferMatch } from './detector.js';

export interface PersistTransferOptions {
  userId: string;
  dryRun?: boolean;
}

export interface PersistResult {
  created: number;
  skipped: number;
  errors: string[];
  linkIds: string[];
}

export async function persistTransferMatches(
  matches: TransferMatch[],
  options: PersistTransferOptions
): Promise<PersistResult> {
  const result: PersistResult = { created: 0, skipped: 0, errors: [], linkIds: [] };

  for (const match of matches) {
    try {
      const sourceId = String(match.sourceTransaction.id);
      const destId = String(match.targetTransaction.id);

      // Check if link already exists between these transactions
      const existing = await db.select().from(transferLinks)
        .where(and(
          eq(transferLinks.sourceTransactionId, sourceId),
          eq(transferLinks.destinationTransactionId, destId)
        )).get();

      if (existing) {
        result.skipped++;
        continue;
      }

      if (options.dryRun) {
        result.created++;
        continue;
      }

      const linkId = crypto.randomUUID();

      // Create transfer link
      await db.insert(transferLinks).values({
        id: linkId,
        userId: options.userId,
        sourceTransactionId: sourceId,
        destinationTransactionId: destId,
        sourceAccountId: String(match.sourceTransaction.accountId),
        destinationAccountId: String(match.targetTransaction.accountId),
        amount: Math.abs(match.sourceTransaction.amount),
        transferDate: match.sourceTransaction.date,
        confidence: match.confidence,
        isUserConfirmed: false,
        createdAt: new Date().toISOString(),
      });

      // Mark both transactions as transfers
      await db.update(transactions)
        .set({ isTransfer: true, transferLinkId: linkId, category: 'Transfer' })
        .where(eq(transactions.id, sourceId));
      await db.update(transactions)
        .set({ isTransfer: true, transferLinkId: linkId, category: 'Transfer' })
        .where(eq(transactions.id, destId));

      result.created++;
      result.linkIds.push(linkId);
    } catch (err: any) {
      result.errors.push(`Failed to persist match ${match.sourceTransaction.id} → ${match.targetTransaction.id}: ${err.message}`);
    }
  }

  return result;
}

export async function markOwnerContributions(
  transactionIds: string[],
): Promise<number> {
  let updated = 0;
  for (const id of transactionIds) {
    await db.update(transactions)
      .set({ isOwnerContribution: true })
      .where(eq(transactions.id, id));
    updated++;
  }
  return updated;
}
