/**
 * Pipeline stage: Transfer detection across accounts.
 */
import { db, transactions, accounts } from '../../schema.js';
import { eq } from 'drizzle-orm';
import { events } from '../../events.js';
import { logger } from '../../utils/logger.js';
import {
  TransferDetector,
  type TransferCandidate,
  type AccountContext,
} from '../transfers/index.js';
import { persistTransferMatches, markOwnerContributions } from '../transfers/persistence.js';
import type { AccountDetectionResult } from './types.js';

// Transfer-like description patterns for fallback flagging
const TRANSFER_KEYWORDS =
  /\b(transfer|tfr|trf|internal|bpay\s+transfer|pay\s+anyone|direct\s+credit|direct\s+debit)\b/i;

/** Flag transactions as likely transfers based on description keywords when full detection fails */
export async function flagLikelyTransfersByDescription(
  txList: Array<{ id: string; description: string; category?: string }>,
) {
  let flagged = 0;
  for (const tx of txList) {
    if (
      TRANSFER_KEYWORDS.test(tx.description) ||
      tx.category === 'Internal Transfer' ||
      tx.category === 'Transfer'
    ) {
      try {
        await db.update(transactions).set({ isTransfer: true }).where(eq(transactions.id, tx.id));
        flagged++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn(`[Pipeline] Failed to flag transfer ${tx.id}: ${msg}`);
      }
    }
  }
  if (flagged > 0) {
    logger.info(`[Pipeline] Flagged ${flagged} transactions as likely transfers by description`);
  }
}

/** Detect transfers across accounts */
export async function detectTransfers(
  toInsert: Array<{ id: string; description: string; category?: string }>,
  userId: string | undefined,
  _accountDetection: AccountDetectionResult,
) {
  if (!userId || toInsert.length === 0) {
    if (userId && toInsert.length > 0) {
      await flagLikelyTransfersByDescription(toInsert);
    }
    return;
  }

  try {
    logger.info(`[Pipeline] Running transfer detection...`);

    // Get all user transactions (including newly inserted ones)
    const allUserTxs = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .all();

    // Get all user accounts
    const userAccounts = await db.select().from(accounts).where(eq(accounts.userId, userId)).all();

    if (userAccounts.length > 1 && allUserTxs.length > 1) {
      // Convert to TransferCandidate format
      const candidates: TransferCandidate[] = allUserTxs.map((t: Record<string, unknown>) => ({
        id: t.id as string,
        accountId: (t.accountId as string) || '',
        date: t.date as string,
        description: t.description as string,
        amount: t.amount as number,
        isLinked: (t.isTransfer as boolean) || false,
        linkedTransactionId: (t.transferLinkId as string) || undefined,
      }));

      // Convert accounts to AccountContext format
      const accountContexts: AccountContext[] = userAccounts.map((a: Record<string, unknown>) => ({
        id: a.id as string,
        accountNumber: a.accountNumber as string,
        bankId: (a.bankName as string) || '',
        accountName: a.accountName as string,
        accountType: a.accountType as string,
        ownershipTag: (a.ownershipTag as string) || 'business',
      }));

      const detector = new TransferDetector();
      const matches = detector.detectTransfers(candidates, accountContexts);

      if (matches.length > 0) {
        logger.info(`[Pipeline] Found ${matches.length} potential transfers, persisting...`);
        const persistResult = await persistTransferMatches(matches, { userId });
        logger.info(
          `[Pipeline] Transfer persistence: ${persistResult.created} created, ${persistResult.skipped} skipped, ${persistResult.errors.length} errors`,
        );

        // Emit typed SSE events for each detected transfer
        for (let mi = 0; mi < matches.length; mi++) {
          const m = matches[mi];
          const linkId = persistResult.linkIds[mi] || '';
          if (linkId) {
            events.emitTransferDetected({
              sourceAccountId: String(m.sourceTransaction.accountId) || null,
              destinationAccountId: String(m.targetTransaction.accountId) || null,
              amount: Math.abs(m.sourceTransaction.amount),
              confidence: m.confidence,
              linkId,
            });
          }
        }

        // Detect owner contributions (personal -> business)
        const ownerContribIds: string[] = [];
        for (const match of matches) {
          const srcAcct = accountContexts.find((a) => a.id === match.sourceTransaction.accountId);
          const dstAcct = accountContexts.find((a) => a.id === match.targetTransaction.accountId);
          if (srcAcct?.ownershipTag === 'personal' && dstAcct?.ownershipTag === 'business') {
            ownerContribIds.push(String(match.targetTransaction.id));
          }
        }
        if (ownerContribIds.length > 0) {
          const ownerUpdated = await markOwnerContributions(ownerContribIds);
          logger.info(`[Pipeline] Marked ${ownerUpdated} transactions as owner contributions`);
        }

        events.emit('update', { type: 'transfers_updated', userId });
      } else {
        logger.info(`[Pipeline] No transfer matches found`);
      }
    }
  } catch (transferErr: unknown) {
    const msg = transferErr instanceof Error ? transferErr.message : String(transferErr);
    logger.warn(`[Pipeline] Transfer detection error (non-fatal): ${msg}`);
    // Flag transactions that look like transfers by description keywords
    await flagLikelyTransfersByDescription(toInsert);
  }
}
