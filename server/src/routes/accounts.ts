import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { accountService } from '../services/accounts.js';
import { events } from '../events.js';
import { getSupportedBanks, analyzeStatement } from '../services/parsers/index.js';

const createAccountSchema = z.object({
  accountNumber: z.string().min(1),
  accountName: z.string().min(1),
  accountType: z.string().min(1),
  bankName: z.string().optional(),
  interestRate: z.number().optional(),
  creditLimit: z.number().optional(),
  minimumPayment: z.number().optional(),
  paymentDueDay: z.number().int().min(1).max(31).optional(),
});

const updateAccountSchema = z.object({
  accountName: z.string().min(1).optional(),
  accountType: z.string().min(1).optional(),
  bankName: z.string().optional(),
  interestRate: z.number().optional(),
  creditLimit: z.number().optional(),
  minimumPayment: z.number().optional(),
  paymentDueDay: z.number().int().min(1).max(31).optional(),
  ownershipTag: z.string().optional(),
  isActive: z.boolean().optional(),
});

const resolveCategorizationSchema = z.object({
  action: z.enum(['approve', 'modify', 'reject']),
  category: z.string().optional(),
  gstApplicable: z.boolean().optional(),
});

const createTransferSchema = z.object({
  sourceTransactionId: z.string().min(1),
  destinationTransactionId: z.string().min(1),
});

const resolveAlertSchema = z.object({
  notes: z.string().optional(),
});

const detectBankSchema = z.object({
  pdfText: z.string().min(1),
});

const updateMerchantMemorySchema = z.object({
  category: z.string().optional(),
  gstApplicable: z.boolean().optional(),
  notes: z.string().optional(),
});

const accountRoutes = new Hono();

// Get all accounts
accountRoutes.get('/', async (c) => {
  const payload = c.get('jwtPayload');
  const userId = payload.userId;
  const ownershipTag = c.req.query('ownershipTag');
  const type = c.req.query('type');
  const search = c.req.query('search');

  const userAccounts = await accountService.getUserAccounts(userId, { ownershipTag, type, search });
  return c.json(userAccounts);
});

// Chart of Accounts
accountRoutes.get('/chart-of-accounts', async (c) => {
  const payload = c.get('jwtPayload');
  const userId = payload.userId;
  const chart = await accountService.getChartOfAccounts(userId);
  return c.json(chart);
});

// Get single account
accountRoutes.get('/:id', async (c) => {
  const payload = c.get('jwtPayload');
  const userId = payload.userId;
  const accountId = c.req.param('id');

  const account = await accountService.getAccount(userId, accountId);
  if (!account) return c.json({ error: 'Account not found' }, 404);

  return c.json(account);
});

// Delete account
accountRoutes.delete('/:id', async (c) => {
  const payload = c.get('jwtPayload');
  const userId = payload.userId;
  const accountId = c.req.param('id');

  const result = await accountService.deleteAccount(userId, accountId);
  if (!result) return c.json({ error: 'Account not found' }, 404);

  events.emit('update', { type: 'accounts_updated' });
  return c.json({ success: true });
});

// Create account
accountRoutes.post('/', zValidator('json', createAccountSchema), async (c) => {
  const payload = c.get('jwtPayload');
  const userId = payload.userId;
  const body = c.req.valid('json');

  const result = await accountService.createAccount({ userId, ...body });
  events.emit('update', { type: 'accounts_updated' });
  return c.json(result, 201);
});

// Update account
accountRoutes.patch('/:id', zValidator('json', updateAccountSchema), async (c) => {
  const payload = c.get('jwtPayload');
  const userId = payload.userId;
  const accountId = c.req.param('id');
  const body = c.req.valid('json');

  const result = await accountService.updateAccount(userId, accountId, body);
  if (!result) return c.json({ error: 'Account not found' }, 404);

  events.emit('update', { type: 'accounts_updated' });
  return c.json({ success: true });
});

// Get pending categorizations
accountRoutes.get('/pending-categorizations', async (c) => {
  const payload = c.get('jwtPayload');
  const userId = payload.userId;
  const results = await accountService.getPendingCategorizations(userId);
  return c.json(results);
});

// Resolve pending categorization
accountRoutes.post(
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
accountRoutes.get('/merchant-memory', async (c) => {
  const payload = c.get('jwtPayload');
  const userId = payload.userId;
  return c.json(await accountService.getMerchantMemory(userId));
});

accountRoutes.patch(
  '/merchant-memory/:id',
  zValidator('json', updateMerchantMemorySchema),
  async (c) => {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const id = c.req.param('id');
    const body = c.req.valid('json');

    const result = await accountService.updateMerchantMemoryById(userId, id, body);
    if (!result) return c.json({ error: 'Not found' }, 404);

    events.emit('update', { type: 'merchant_memory_updated' });
    return c.json({ success: true });
  },
);

accountRoutes.delete('/merchant-memory/:id', async (c) => {
  const payload = c.get('jwtPayload');
  const userId = payload.userId;
  const id = c.req.param('id');

  const result = await accountService.deleteMerchantMemory(userId, id);
  if (!result) return c.json({ error: 'Not found' }, 404);

  events.emit('update', { type: 'merchant_memory_updated' });
  return c.json({ success: true });
});

// Transfers
accountRoutes.get('/transfers', async (c) => {
  const payload = c.get('jwtPayload');
  const userId = payload.userId;
  return c.json(await accountService.getTransfers(userId));
});

accountRoutes.post('/transfers', zValidator('json', createTransferSchema), async (c) => {
  const payload = c.get('jwtPayload');
  const userId = payload.userId;
  const body = c.req.valid('json');

  const result = await accountService.createTransfer({ userId, ...body });
  if (!result) return c.json({ error: 'Not found' }, 404);

  events.emit('update', { type: 'transactions_updated' });
  return c.json(result);
});

accountRoutes.delete('/transfers/:id', async (c) => {
  const payload = c.get('jwtPayload');
  const userId = payload.userId;
  const id = c.req.param('id');

  const result = await accountService.deleteTransfer(userId, id);
  if (!result) return c.json({ error: 'Not found' }, 404);

  events.emit('update', { type: 'transactions_updated' });
  return c.json({ success: true });
});

// Balance History
accountRoutes.get('/:id/balance-history', async (c) => {
  const payload = c.get('jwtPayload');
  const userId = payload.userId;
  const id = c.req.param('id');

  const history = await accountService.getBalanceHistory(userId, id);
  if (!history) return c.json({ error: 'Account not found' }, 404);

  return c.json(history);
});

// Reconciliation Alerts
accountRoutes.get('/reconciliation-alerts', async (c) => {
  const payload = c.get('jwtPayload');
  const userId = payload.userId;
  const showResolved = c.req.query('showResolved') === 'true';
  return c.json(await accountService.getReconciliationAlerts(userId, showResolved));
});

accountRoutes.post(
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
accountRoutes.get('/:id/credit-analytics', async (c) => {
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

// Banks
accountRoutes.get('/banks', async (c) => {
  return c.json(getSupportedBanks());
});

accountRoutes.post('/detect-bank', zValidator('json', detectBankSchema), async (c) => {
  const { pdfText } = c.req.valid('json');
  return c.json(analyzeStatement(pdfText));
});

// Consolidated Account Summary
accountRoutes.get('/consolidated', async (c) => {
  const payload = c.get('jwtPayload');
  const userId = payload.userId;
  return c.json(await accountService.getConsolidatedSummary(userId));
});

export default accountRoutes;
