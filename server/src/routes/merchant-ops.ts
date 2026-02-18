import { Hono } from 'hono';
import {
  db,
  transactions,
  merchantMemory,
  pendingCategorization,
  reconciliationAlerts,
  transferLinks,
} from '../schema.js';
import { eq, and, desc } from 'drizzle-orm';
import crypto from 'crypto';
import { accountService } from '../services/accounts.js';
import { events } from '../events.js';

const merchantOpsRoutes = new Hono();

// POST /api/pending-categorizations/:id/resolve
merchantOpsRoutes.post('/pending-categorizations/:id/resolve', async (c) => {
  const payload = c.get('jwtPayload');
  const userId = payload.userId;
  const pendingId = c.req.param('id');
  const body = await c.req.json();
  const { action, category, gstApplicable } = body;

  const pending = await db
    .select()
    .from(pendingCategorization)
    .where(and(eq(pendingCategorization.id, pendingId), eq(pendingCategorization.userId, userId)))
    .get();

  if (!pending) {
    return c.json({ error: 'Pending categorization not found' }, 404);
  }

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
});

// PATCH /api/merchant-memory/:id
merchantOpsRoutes.patch('/merchant-memory/:id', async (c) => {
  const payload = c.get('jwtPayload');
  const userId = payload.userId;
  const memoryId = c.req.param('id');
  const body = await c.req.json();

  const existing = await db
    .select()
    .from(merchantMemory)
    .where(and(eq(merchantMemory.id, memoryId), eq(merchantMemory.userId, userId)))
    .get();

  if (!existing) return c.json({ error: 'Merchant memory entry not found' }, 404);

  await db
    .update(merchantMemory)
    .set({
      category: body.category ?? existing.category,
      gstApplicable: body.gstApplicable ?? existing.gstApplicable,
      merchantDisplayName: body.merchantDisplayName ?? existing.merchantDisplayName,
      isUserConfirmed: true,
    })
    .where(eq(merchantMemory.id, memoryId));

  events.emit('update', { type: 'merchant_memory_updated' });
  return c.json({ success: true });
});

// DELETE /api/merchant-memory/:id
merchantOpsRoutes.delete('/merchant-memory/:id', async (c) => {
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
});

// POST /api/transfers — Manually link two transactions as a transfer
merchantOpsRoutes.post('/transfers', async (c) => {
  const payload = c.get('jwtPayload');
  const userId = payload.userId;
  const body = await c.req.json();
  const { sourceTransactionId, destinationTransactionId } = body;

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
});

// DELETE /api/transfers/:id — Delete a transfer link
merchantOpsRoutes.delete('/transfers/:id', async (c) => {
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
});

// GET /api/reconciliation-alerts
merchantOpsRoutes.get('/reconciliation-alerts', async (c) => {
  const payload = c.get('jwtPayload');
  const userId = payload.userId;
  const showResolved = c.req.query('showResolved') === 'true';

  const alerts = await db
    .select()
    .from(reconciliationAlerts)
    .where(
      and(
        eq(reconciliationAlerts.userId, userId),
        showResolved ? undefined : eq(reconciliationAlerts.isResolved, false),
      ),
    )
    .orderBy(desc(reconciliationAlerts.createdAt))
    .all();

  return c.json(alerts);
});

// POST /api/reconciliation-alerts/:id/resolve
merchantOpsRoutes.post('/reconciliation-alerts/:id/resolve', async (c) => {
  const payload = c.get('jwtPayload');
  const userId = payload.userId;
  const alertId = c.req.param('id');
  const body = await c.req.json();

  const alert = await db
    .select()
    .from(reconciliationAlerts)
    .where(and(eq(reconciliationAlerts.id, alertId), eq(reconciliationAlerts.userId, userId)))
    .get();

  if (!alert) return c.json({ error: 'Alert not found' }, 404);

  await db
    .update(reconciliationAlerts)
    .set({
      isResolved: true,
      resolvedAt: new Date().toISOString(),
      resolutionNotes: body.notes || null,
    })
    .where(eq(reconciliationAlerts.id, alertId));

  return c.json({ success: true });
});

export default merchantOpsRoutes;
