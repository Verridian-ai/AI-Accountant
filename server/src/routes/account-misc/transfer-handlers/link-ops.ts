import type { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { db, transactions, transferLinks } from '../../../schema.js';
import { and, eq } from 'drizzle-orm';
import { events } from '../../../events.js';
import { linkTransferSchema, bulkLinkTransfersSchema } from '../../../validation/operations.js';
import crypto from 'crypto';

export function registerTransferLinkOps(app: Hono): void {
  // POST /api/transfers (manual link)
  app.post('/transfers', zValidator('json', linkTransferSchema), async (c) => {
    try {
      const payload = c.get('jwtPayload');
      const userId = payload.userId;
      const { sourceTransactionId, destinationTransactionId } = c.req.valid('json');

      const sourceTx = await db
        .select()
        .from(transactions)
        .where(and(eq(transactions.id, sourceTransactionId), eq(transactions.userId, userId)))
        .get();
      const destTx = await db
        .select()
        .from(transactions)
        .where(and(eq(transactions.id, destinationTransactionId), eq(transactions.userId, userId)))
        .get();
      if (!sourceTx || !destTx) return c.json({ error: 'One or both transactions not found' }, 404);

      const linkId = crypto.randomUUID();
      const now = new Date().toISOString();
      await db.insert(transferLinks).values({
        id: linkId,
        userId,
        sourceTransactionId,
        destinationTransactionId,
        sourceAccountId: sourceTx.accountId,
        destinationAccountId: destTx.accountId,
        amount: Math.abs(sourceTx.amount),
        transferDate: sourceTx.date,
        confidence: 1.0,
        isUserConfirmed: true,
        createdAt: now,
      });
      await db
        .update(transactions)
        .set({ isTransfer: true, transferLinkId: linkId, category: 'Transfer' })
        .where(eq(transactions.id, sourceTransactionId));
      await db
        .update(transactions)
        .set({ isTransfer: true, transferLinkId: linkId, category: 'Transfer' })
        .where(eq(transactions.id, destinationTransactionId));
      events.emit('update', { type: 'transactions_updated' });
      return c.json({ id: linkId, success: true });
    } catch (err) {
      console.error('Failed to create transfer link:', err);
      return c.json({ error: 'Failed to create transfer link' }, 500);
    }
  });

  // DELETE /api/transfers/:id
  app.delete('/transfers/:id', async (c) => {
    try {
      const payload = c.get('jwtPayload');
      const userId = payload.userId;
      const linkId = c.req.param('id');
      const link = await db
        .select()
        .from(transferLinks)
        .where(and(eq(transferLinks.id, linkId), eq(transferLinks.userId, userId)))
        .get();
      if (!link) return c.json({ error: 'Transfer link not found' }, 404);
      await db
        .update(transactions)
        .set({ isTransfer: false, transferLinkId: null })
        .where(eq(transactions.id, link.sourceTransactionId));
      await db
        .update(transactions)
        .set({ isTransfer: false, transferLinkId: null })
        .where(eq(transactions.id, link.destinationTransactionId));
      await db.delete(transferLinks).where(eq(transferLinks.id, linkId));
      events.emit('update', { type: 'transactions_updated' });
      return c.json({ success: true });
    } catch (err) {
      console.error('Failed to delete transfer link:', err);
      return c.json({ error: 'Failed to delete transfer link' }, 500);
    }
  });

  // POST /api/transfers/bulk-link
  app.post('/transfers/bulk-link', zValidator('json', bulkLinkTransfersSchema), async (c) => {
    try {
      const payload = c.get('jwtPayload');
      const userId = payload.userId;
      const { pairs } = c.req.valid('json');

      const now = new Date().toISOString();
      const created: string[] = [];
      for (const pair of pairs) {
        const { sourceTransactionId, destinationTransactionId, confidence } = pair;
        const sourceTx = await db
          .select()
          .from(transactions)
          .where(and(eq(transactions.id, sourceTransactionId), eq(transactions.userId, userId)))
          .get();
        const destTx = await db
          .select()
          .from(transactions)
          .where(
            and(eq(transactions.id, destinationTransactionId), eq(transactions.userId, userId)),
          )
          .get();
        if (!sourceTx || !destTx) continue;
        const linkId = crypto.randomUUID();
        await db.insert(transferLinks).values({
          id: linkId,
          userId,
          sourceTransactionId,
          destinationTransactionId,
          sourceAccountId: sourceTx.accountId,
          destinationAccountId: destTx.accountId,
          amount: Math.abs(sourceTx.amount),
          transferDate: sourceTx.date,
          confidence: confidence || 0.8,
          isUserConfirmed: false,
          createdAt: now,
        });
        await db
          .update(transactions)
          .set({ isTransfer: true, transferLinkId: linkId, category: 'Transfer' })
          .where(eq(transactions.id, sourceTransactionId));
        await db
          .update(transactions)
          .set({ isTransfer: true, transferLinkId: linkId, category: 'Transfer' })
          .where(eq(transactions.id, destinationTransactionId));
        created.push(linkId);
      }
      events.emit('update', { type: 'transactions_updated' });
      return c.json({ success: true, created: created.length, linkIds: created });
    } catch (err) {
      console.error('Bulk link failed:', err);
      return c.json({ error: 'Bulk link failed' }, 500);
    }
  });
}
