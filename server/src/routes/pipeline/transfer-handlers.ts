import type { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db, transactions, accounts, transferLinks } from '../../schema.js';
import { eq } from 'drizzle-orm';
import {
  TransferDetector,
  type TransferCandidate,
  type AccountContext,
} from '../../services/transfers/index.js';
import {
  persistTransferMatches,
  markOwnerContributions,
} from '../../services/transfers/persistence.js';
import { events } from '../../events.js';

export function registerTransferHandlers(app: Hono): void {
  /**
   * POST /api/transfers/detect
   * Trigger transfer detection across all user accounts.
   */
  app.post('/transfers/detect', zValidator('json', z.object({}).optional()), async (c) => {
    try {
      const payload = c.get('jwtPayload');
      const userId = payload.userId;

      const allTxs = await db.select().from(transactions).where(eq(transactions.userId, userId));

      const userAccounts = await db.select().from(accounts).where(eq(accounts.userId, userId));

      if (userAccounts.length < 2) {
        return c.json({
          message: 'Need at least 2 accounts for transfer detection',
          matches: 0,
        });
      }

      const existingLinks = await db
        .select()
        .from(transferLinks)
        .where(eq(transferLinks.userId, userId));
      const existingPairs = existingLinks.map((l: Record<string, unknown>) => ({
        sourceId: parseInt(l.sourceTransactionId as string, 10) || 0,
        targetId: parseInt(l.destinationTransactionId as string, 10) || 0,
      }));

      const candidates: TransferCandidate[] = allTxs.map((t: Record<string, unknown>) => ({
        id: parseInt(t.id as string, 10) || 0,
        accountId: parseInt((t.accountId as string) || '0', 10) || 0,
        date: t.date as string,
        description: t.description as string,
        amount: t.amount as number,
        isLinked: (t.isTransfer as boolean) || false,
        linkedTransactionId: t.transferLinkId
          ? parseInt(t.transferLinkId as string, 10)
          : undefined,
      }));

      const accountContexts: AccountContext[] = userAccounts.map((a: Record<string, unknown>) => ({
        id: parseInt(a.id as string, 10) || 0,
        accountNumber: a.accountNumber as string,
        bankId: (a.bankName as string) || '',
        accountName: a.accountName as string,
        accountType: a.accountType as string,
        ownershipTag: ((a.ownershipTag as string) || 'business') as 'personal' | 'business',
      }));

      const detector = new TransferDetector();
      const matches = detector.detectTransfers(candidates, accountContexts, existingPairs);

      if (matches.length === 0) {
        return c.json({ message: 'No new transfers detected', matches: 0, created: 0 });
      }

      const result = await persistTransferMatches(matches, { userId });

      for (let i = 0; i < matches.length; i++) {
        const m = matches[i];
        const linkId = result.linkIds[i];
        if (linkId) {
          events.emitTransferDetected({
            sourceAccountId: String(m.sourceTransaction.accountId),
            destinationAccountId: String(m.targetTransaction.accountId),
            amount: Math.abs(m.sourceTransaction.amount),
            confidence: m.confidence,
            linkId,
          });
        }
      }

      const ownerContribIds: string[] = [];
      for (const m of matches) {
        const srcAcct = userAccounts.find(
          (a: Record<string, unknown>) =>
            a.id === m.sourceTransaction.accountId ||
            String(a.id) === String(m.sourceTransaction.accountId),
        );
        const dstAcct = userAccounts.find(
          (a: Record<string, unknown>) =>
            a.id === m.targetTransaction.accountId ||
            String(a.id) === String(m.targetTransaction.accountId),
        );
        if (
          (srcAcct as Record<string, unknown> | undefined)?.ownershipTag === 'personal' &&
          (dstAcct as Record<string, unknown> | undefined)?.ownershipTag !== 'personal'
        ) {
          ownerContribIds.push(String(m.targetTransaction.id));
        }
      }
      if (ownerContribIds.length > 0) {
        await markOwnerContributions(ownerContribIds);
      }

      events.emit('update', { type: 'transactions_updated' });

      return c.json({
        message: `Detected ${matches.length} transfers`,
        matchesFound: matches.length,
        matches: matches.length,
        persisted: result.created,
        created: result.created,
        skipped: result.skipped,
        ownerContributions: ownerContribIds.length,
        errors: result.errors,
      });
    } catch (err) {
      console.error('Transfer detection failed:', err);
      return c.json({ error: 'Transfer detection failed' }, 500);
    }
  });
}
