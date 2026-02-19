import type { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { db, transactions, merchantMemory, pendingCategorization } from '../../../schema.js';
import { and, eq, desc } from 'drizzle-orm';
import { events } from '../../../events.js';
import { accountService } from '../../../services/accounts.js';
import {
  updateMerchantMemorySchema,
  resolvePendingSchema,
} from '../../../validation/operations.js';

export function registerMerchantOps(app: Hono): void {
  // PATCH /api/merchant-memory/:id
  app.patch('/merchant-memory/:id', zValidator('json', updateMerchantMemorySchema), async (c) => {
    try {
      const payload = c.get('jwtPayload');
      const userId = payload.userId;
      const memoryId = c.req.param('id');
      const { category, gstApplicable, merchantDisplayName } = c.req.valid('json');
      const existing = await db
        .select()
        .from(merchantMemory)
        .where(and(eq(merchantMemory.id, memoryId), eq(merchantMemory.userId, userId)))
        .get();
      if (!existing) return c.json({ error: 'Merchant memory entry not found' }, 404);
      await db
        .update(merchantMemory)
        .set({
          category: category ?? existing.category,
          gstApplicable: gstApplicable ?? existing.gstApplicable,
          merchantDisplayName: merchantDisplayName ?? existing.merchantDisplayName,
          isUserConfirmed: true,
        })
        .where(eq(merchantMemory.id, memoryId));
      events.emit('update', { type: 'merchant_memory_updated' });
      return c.json({ success: true });
    } catch (err) {
      console.error('Failed to update merchant memory:', err);
      return c.json({ error: 'Failed to update merchant memory' }, 500);
    }
  });

  // DELETE /api/merchant-memory/:id
  app.delete('/merchant-memory/:id', async (c) => {
    try {
      const payload = c.get('jwtPayload');
      const userId = payload.userId;
      const memoryId = c.req.param('id');
      const existing = await db
        .select()
        .from(merchantMemory)
        .where(and(eq(merchantMemory.id, memoryId), eq(merchantMemory.userId, userId)))
        .get();
      if (!existing) return c.json({ error: 'Merchant memory entry not found' }, 404);
      await db.delete(merchantMemory).where(eq(merchantMemory.id, memoryId));
      events.emit('update', { type: 'merchant_memory_updated' });
      return c.json({ success: true });
    } catch (err) {
      console.error('Failed to delete merchant memory:', err);
      return c.json({ error: 'Failed to delete merchant memory' }, 500);
    }
  });

  // POST /api/pending-categorizations/:id/resolve
  app.post(
    '/pending-categorizations/:id/resolve',
    zValidator('json', resolvePendingSchema),
    async (c) => {
      try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;
        const pendingId = c.req.param('id');
        const { action, category, gstApplicable } = c.req.valid('json');

        const pending = await db
          .select()
          .from(pendingCategorization)
          .where(
            and(eq(pendingCategorization.id, pendingId), eq(pendingCategorization.userId, userId)),
          )
          .get();
        if (!pending) return c.json({ error: 'Pending categorization not found' }, 404);

        const now = new Date().toISOString();
        if (action === 'approve') {
          await db
            .update(transactions)
            .set({ category: pending.suggestedCategory, confidenceScore: 1.0 })
            .where(eq(transactions.id, pending.transactionId));
        } else if (action === 'modify' && category) {
          await db
            .update(transactions)
            .set({ category, gstApplicable: gstApplicable ?? false, confidenceScore: 1.0 })
            .where(eq(transactions.id, pending.transactionId));
          const tx = await db
            .select()
            .from(transactions)
            .where(eq(transactions.id, pending.transactionId))
            .get();
          if (tx?.merchantNormalized) {
            await accountService.updateMerchantMemory({
              userId,
              merchantPattern: tx.merchantNormalized,
              merchantDisplayName: tx.description,
              category,
              gstApplicable: gstApplicable ?? false,
              isUserConfirmed: true,
            });
          }
        }
        await db
          .update(pendingCategorization)
          .set({
            status: action,
            userSelectedCategory: action === 'modify' ? category : pending.suggestedCategory,
            resolvedAt: now,
          })
          .where(eq(pendingCategorization.id, pendingId));
        events.emit('update', { type: 'transactions_updated' });
        return c.json({ success: true });
      } catch (err) {
        console.error('Failed to resolve pending categorization:', err);
        return c.json({ error: 'Failed to resolve pending categorization' }, 500);
      }
    },
  );

  // GET /api/pending-categorizations
  app.get('/pending-categorizations', async (c) => {
    try {
      const payload = c.get('jwtPayload') as Record<string, unknown> | undefined;
      const userId = (payload?.userId as string) ?? '';
      const isAdmin = !!payload?.adminId || payload?.role === 'super_admin' || !payload?.tenantId;

      const rows = isAdmin
        ? await db
            .select()
            .from(pendingCategorization)
            .orderBy(desc(pendingCategorization.createdAt))
            .all()
        : await db
            .select()
            .from(pendingCategorization)
            .where(eq(pendingCategorization.userId, userId))
            .orderBy(desc(pendingCategorization.createdAt))
            .all();

      return c.json(rows);
    } catch (err) {
      console.error('Failed to fetch pending categorizations:', err);
      return c.json({ error: 'Failed to fetch pending categorizations' }, 500);
    }
  });

  // GET /api/merchant-memory
  app.get('/merchant-memory', async (c) => {
    try {
      const payload = c.get('jwtPayload') as Record<string, unknown> | undefined;
      const userId = (payload?.userId as string) ?? '';
      const isAdmin = !!payload?.adminId || payload?.role === 'super_admin' || !payload?.tenantId;

      const rows = isAdmin
        ? await db.select().from(merchantMemory).orderBy(desc(merchantMemory.createdAt)).all()
        : await db
            .select()
            .from(merchantMemory)
            .where(eq(merchantMemory.userId, userId))
            .orderBy(desc(merchantMemory.createdAt))
            .all();

      return c.json(rows);
    } catch (err) {
      console.error('Failed to fetch merchant memory:', err);
      return c.json({ error: 'Failed to fetch merchant memory' }, 500);
    }
  });
}
