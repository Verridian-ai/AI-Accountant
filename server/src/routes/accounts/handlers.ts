import type { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { db, accounts as accountsTable } from '../../schema.js';
import { accountService } from '../../services/accounts.js';
import { events } from '../../events.js';
import { getSupportedBanks, analyzeStatement } from '../../services/parsers/index.js';
import {
  createAccountSchema,
  updateAccountSchema,
  resolveCategorizationSchema,
  createTransferSchema,
  resolveAlertSchema,
  detectBankSchema,
  updateMerchantMemorySchema,
} from './schemas.js';

export function registerAccountHandlers(app: Hono): void {
  // Get all accounts
  app.get('/', async (c) => {
    const payload = c.get('jwtPayload') as Record<string, unknown> | undefined;
    const userId = (payload?.userId as string) ?? '';
    const ownershipTag = c.req.query('ownershipTag');
    const type = c.req.query('type');
    const search = c.req.query('search');

    const isAdmin = !!payload?.adminId || payload?.role === 'super_admin' || !payload?.tenantId;
    if (isAdmin) {
      const allAccounts = await db.select().from(accountsTable).all();
      return c.json(allAccounts);
    }

    const userAccounts = await accountService.getUserAccounts(userId, {
      ownershipTag,
      type,
      search,
    });
    return c.json(userAccounts);
  });

  // Chart of Accounts
  app.get('/chart-of-accounts', async (c) => {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const chart = await accountService.getChartOfAccounts(userId);
    return c.json(chart);
  });

  // Banks
  app.get('/banks', async (_c) => {
    return _c.json(getSupportedBanks());
  });

  // Detect bank
  app.post('/detect-bank', zValidator('json', detectBankSchema), async (c) => {
    const { pdfText } = c.req.valid('json');
    return c.json(analyzeStatement(pdfText));
  });

  // Consolidated Account Summary
  app.get('/consolidated', async (c) => {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    return c.json(await accountService.getConsolidatedSummary(userId));
  });

  // Get pending categorizations
  app.get('/pending-categorizations', async (c) => {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const results = await accountService.getPendingCategorizations(userId);
    return c.json(results);
  });

  // Resolve pending categorization
  app.post(
    '/pending-categorizations/:id/resolve',
    zValidator('json', resolveCategorizationSchema),
    async (c) => {
      const payload = c.get('jwtPayload');
      const userId = payload.userId;
      const pendingId = c.req.param('id');
      const { action, category, gstApplicable } = c.req.valid('json');

      const result = await accountService.resolveCategorization({
        userId,
        pendingId,
        action,
        category,
        gstApplicable,
      });
      if (!result) return c.json({ error: 'Pending categorization not found' }, 404);

      events.emit('update', { type: 'transactions_updated' });
      return c.json({ success: true });
    },
  );

  // Merchant memory
  app.get('/merchant-memory', async (c) => {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    return c.json(await accountService.getMerchantMemory(userId));
  });

  app.patch('/merchant-memory/:id', zValidator('json', updateMerchantMemorySchema), async (c) => {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const id = c.req.param('id');
    const body = c.req.valid('json');

    const result = await accountService.updateMerchantMemoryById(userId, id, body);
    if (!result) return c.json({ error: 'Not found' }, 404);

    events.emit('update', { type: 'merchant_memory_updated' });
    return c.json({ success: true });
  });

  app.delete('/merchant-memory/:id', async (c) => {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const id = c.req.param('id');

    const result = await accountService.deleteMerchantMemory(userId, id);
    if (!result) return c.json({ error: 'Not found' }, 404);

    events.emit('update', { type: 'merchant_memory_updated' });
    return c.json({ success: true });
  });

  // Transfers
  app.get('/transfers', async (c) => {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    return c.json(await accountService.getTransfers(userId));
  });

  app.post('/transfers', zValidator('json', createTransferSchema), async (c) => {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const body = c.req.valid('json');

    const result = await accountService.createTransfer({ userId, ...body });
    if (!result) return c.json({ error: 'Not found' }, 404);

    events.emit('update', { type: 'transactions_updated' });
    return c.json(result);
  });

  app.delete('/transfers/:id', async (c) => {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const id = c.req.param('id');

    const result = await accountService.deleteTransfer(userId, id);
    if (!result) return c.json({ error: 'Not found' }, 404);

    events.emit('update', { type: 'transactions_updated' });
    return c.json({ success: true });
  });

  // Balance History
  app.get('/:id/balance-history', async (c) => {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const id = c.req.param('id');

    const history = await accountService.getBalanceHistory(userId, id);
    if (!history) return c.json({ error: 'Account not found' }, 404);

    return c.json(history);
  });

  // Reconciliation Alerts
  app.get('/reconciliation-alerts', async (c) => {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const showResolved = c.req.query('showResolved') === 'true';
    return c.json(await accountService.getReconciliationAlerts(userId, showResolved));
  });

  app.post(
    '/reconciliation-alerts/:id/resolve',
    zValidator('json', resolveAlertSchema),
    async (c) => {
      const payload = c.get('jwtPayload');
      const userId = payload.userId;
      const id = c.req.param('id');
      const { notes } = c.req.valid('json');

      const result = await accountService.resolveReconciliationAlert(userId, id, notes);
      if (!result) return c.json({ error: 'Alert not found' }, 404);

      return c.json({ success: true });
    },
  );

  // Credit Analytics
  app.get('/:id/credit-analytics', async (c) => {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const id = c.req.param('id');

    try {
      const result = await accountService.getCreditAnalytics(userId, id);
      if (!result) return c.json({ error: 'Account not found' }, 404);
      return c.json(result);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'Not a credit card')
        return c.json({ error: 'Not a credit card' }, 400);
      throw err;
    }
  });

  // Create account
  app.post('/', zValidator('json', createAccountSchema), async (c) => {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const body = c.req.valid('json');

    const result = await accountService.createAccount({ userId, ...body });
    events.emit('update', { type: 'accounts_updated' });
    return c.json(result, 201);
  });

  // Update account
  app.patch('/:id', zValidator('json', updateAccountSchema), async (c) => {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const accountId = c.req.param('id');
    const body = c.req.valid('json');

    const result = await accountService.updateAccount(userId, accountId, body);
    if (!result) return c.json({ error: 'Account not found' }, 404);

    events.emit('update', { type: 'accounts_updated' });
    return c.json({ success: true });
  });

  // Delete account
  app.delete('/:id', async (c) => {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const accountId = c.req.param('id');

    const result = await accountService.deleteAccount(userId, accountId);
    if (!result) return c.json({ error: 'Account not found' }, 404);

    events.emit('update', { type: 'accounts_updated' });
    return c.json({ success: true });
  });

  // Get single account
  app.get('/:id', async (c) => {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const accountId = c.req.param('id');

    const account = await accountService.getAccount(userId, accountId);
    if (!account) return c.json({ error: 'Account not found' }, 404);

    return c.json(account);
  });
}
