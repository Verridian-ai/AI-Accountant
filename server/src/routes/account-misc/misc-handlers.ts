import type { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  db,
  transactions,
  accounts,
  merchantMemory,
  pendingCategorization,
  reconciliationAlerts,
} from '../../schema.js';
import { and, eq, desc } from 'drizzle-orm';
import { events } from '../../events.js';
import { getSupportedBanks, analyzeStatement } from '../../services/parsers/index.js';
import { accountService } from '../../services/accounts.js';
import {
  detectBankSchema,
  resolveAlertSchema,
  updateMerchantMemorySchema,
  resolvePendingSchema,
} from '../../validation/operations.js';

export function registerMiscHandlers(app: Hono): void {
  // GET /api/banks
  app.get('/banks', async (c) => {
    try {
      return c.json(getSupportedBanks());
    } catch (err) {
      console.error('Failed to get banks:', err);
      return c.json({ error: 'Failed to get banks' }, 500);
    }
  });

  // POST /api/statements/detect-bank
  app.post('/statements/detect-bank', zValidator('json', detectBankSchema), async (c) => {
    try {
      const { pdfText } = c.req.valid('json');
      return c.json(analyzeStatement(pdfText));
    } catch (err) {
      console.error('Bank detection failed:', err);
      return c.json({ error: 'Bank detection failed' }, 500);
    }
  });

  // GET /api/accounts/consolidated
  app.get('/accounts/consolidated', async (c) => {
    try {
      const payload = c.get('jwtPayload');
      const userId = payload.userId;
      const userAccounts = await db
        .select()
        .from(accounts)
        .where(eq(accounts.userId, userId))
        .all();
      const userTransactions = await db
        .select()
        .from(transactions)
        .where(eq(transactions.userId, userId))
        .all();

      type SumAcctRow = typeof accounts.$inferSelect;
      type SumTxRow = typeof transactions.$inferSelect;
      const accountSummaries = (userAccounts as SumAcctRow[]).map((account: SumAcctRow) => {
        const accountTxs = (userTransactions as SumTxRow[]).filter(
          (t: SumTxRow) => t.accountId === account.id,
        );
        const totalIncome = accountTxs
          .filter((t: SumTxRow) => t.amount > 0 && !t.isTransfer)
          .reduce((sum: number, t: SumTxRow) => sum + t.amount, 0);
        const totalExpenses = accountTxs
          .filter((t: SumTxRow) => t.amount < 0 && !t.isTransfer)
          .reduce((sum: number, t: SumTxRow) => sum + Math.abs(t.amount), 0);
        const transfersIn = accountTxs
          .filter((t: SumTxRow) => t.amount > 0 && t.isTransfer)
          .reduce((sum: number, t: SumTxRow) => sum + t.amount, 0);
        const transfersOut = accountTxs
          .filter((t: SumTxRow) => t.amount < 0 && t.isTransfer)
          .reduce((sum: number, t: SumTxRow) => sum + Math.abs(t.amount), 0);
        return {
          ...account,
          transactionCount: accountTxs.length,
          totalIncome,
          totalExpenses,
          netFlow: totalIncome - totalExpenses,
          transfersIn,
          transfersOut,
        };
      });

      const overallTotals = {
        totalAccounts: userAccounts.length,
        totalTransactions: (userTransactions as SumTxRow[]).filter((t: SumTxRow) => !t.isTransfer)
          .length,
        totalIncome: accountSummaries.reduce((sum: number, a) => sum + a.totalIncome, 0),
        totalExpenses: accountSummaries.reduce((sum: number, a) => sum + a.totalExpenses, 0),
        netWorth: (userAccounts as SumAcctRow[]).reduce(
          (sum: number, a: SumAcctRow) => sum + (a.currentBalance || 0),
          0,
        ),
      };
      return c.json({ accounts: accountSummaries, totals: overallTotals });
    } catch (err) {
      console.error('Failed to get consolidated summary:', err);
      return c.json({ error: 'Failed to get consolidated summary' }, 500);
    }
  });

  // GET /api/reconciliation-alerts
  app.get('/reconciliation-alerts', async (c) => {
    try {
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
    } catch (err) {
      console.error('Failed to get reconciliation alerts:', err);
      return c.json({ error: 'Failed to get reconciliation alerts' }, 500);
    }
  });

  // POST /api/reconciliation-alerts/:id/resolve
  app.post(
    '/reconciliation-alerts/:id/resolve',
    zValidator('json', resolveAlertSchema),
    async (c) => {
      try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;
        const alertId = c.req.param('id');
        const { notes } = c.req.valid('json');
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
            resolutionNotes: notes ?? null,
          })
          .where(eq(reconciliationAlerts.id, alertId));
        return c.json({ success: true });
      } catch (err) {
        console.error('Failed to resolve reconciliation alert:', err);
        return c.json({ error: 'Failed to resolve reconciliation alert' }, 500);
      }
    },
  );

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
