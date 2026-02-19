import type { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { db, transactions, accounts, transferLinks } from '../../../schema.js';
import { eq } from 'drizzle-orm';
import { events } from '../../../events.js';
import {
  detectTransfers,
  persistTransferMatches,
  markOwnerContributions,
} from '../../../services/transfers/index.js';
import { autoDetectTransfersSchema } from '../../../validation/operations.js';

export function registerTransferDetectOps(app: Hono): void {
  // POST /api/transfers/auto-detect
  app.post('/transfers/auto-detect', zValidator('json', autoDetectTransfersSchema), async (c) => {
    try {
      const payload = c.get('jwtPayload');
      const userId = payload.userId;
      const { persist = false } = c.req.valid('json');

      const userTransactions = await db
        .select()
        .from(transactions)
        .where(eq(transactions.userId, userId))
        .all();
      const userAccounts = await db
        .select()
        .from(accounts)
        .where(eq(accounts.userId, userId))
        .all();
      const existingLinks = await db
        .select()
        .from(transferLinks)
        .where(eq(transferLinks.userId, userId))
        .all();

      type DetTxRow = typeof transactions.$inferSelect;
      type DetAcctRow = typeof accounts.$inferSelect;
      type DetLinkRow = typeof transferLinks.$inferSelect;
      const candidates = (userTransactions as DetTxRow[]).map((t: DetTxRow) => ({
        id: parseInt(t.id, 10) || 0,
        accountId: parseInt(t.accountId || '0', 10) || 0,
        date: t.date,
        description: t.description,
        amount: t.amount,
        isLinked: t.isTransfer ?? undefined,
        linkedTransactionId: t.transferLinkId ? parseInt(t.transferLinkId, 10) : undefined,
      }));
      const accountContexts = (userAccounts as DetAcctRow[]).map((a: DetAcctRow) => ({
        id: parseInt(a.id, 10) || 0,
        accountNumber: a.accountNumber,
        bankId: a.bankName || 'unknown',
        accountName: a.accountName,
        accountType: a.accountType,
        ownershipTag: (a.ownershipTag || 'business') as 'personal' | 'business',
      }));
      const existingLinkPairs = (existingLinks as DetLinkRow[]).map((l: DetLinkRow) => ({
        sourceId: parseInt(l.sourceTransactionId, 10) || 0,
        targetId: parseInt(l.destinationTransactionId, 10) || 0,
      }));

      const matches = detectTransfers(candidates, accountContexts, existingLinkPairs);
      let persistResult = null;
      if (persist && matches.length > 0) {
        persistResult = await persistTransferMatches(matches, { userId });
        const ownerContribIds: string[] = [];
        for (const match of matches) {
          const srcAcct = (userAccounts as DetAcctRow[]).find(
            (a: DetAcctRow) => (parseInt(a.id, 10) || 0) === match.sourceTransaction.accountId,
          );
          const dstAcct = (userAccounts as DetAcctRow[]).find(
            (a: DetAcctRow) => (parseInt(a.id, 10) || 0) === match.targetTransaction.accountId,
          );
          if (srcAcct?.ownershipTag === 'personal' && dstAcct?.ownershipTag === 'business') {
            ownerContribIds.push(String(match.targetTransaction.id));
          }
        }
        if (ownerContribIds.length > 0) await markOwnerContributions(ownerContribIds);
        events.emit('update', { type: 'transfers_updated' });
      }
      return c.json({
        matchesFound: matches.length,
        persisted: persist ? persistResult?.created || 0 : 0,
        matches: matches.map((m) => ({
          sourceTransaction: m.sourceTransaction,
          targetTransaction: m.targetTransaction,
          confidence: m.confidence,
          reasons: m.matchReasons,
        })),
      });
    } catch (err) {
      console.error('Transfer detection failed:', err);
      return c.json({ error: 'Transfer detection failed' }, 500);
    }
  });
}
