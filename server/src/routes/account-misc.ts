import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import {
  db,
  transactions,
  accounts,
  merchantMemory,
  pendingCategorization,
  reconciliationAlerts,
  transferLinks,
} from '../schema.js';
import { and, eq, desc, gte, lte, type SQL } from 'drizzle-orm';
import { events } from '../events.js';
import { getSupportedBanks, analyzeStatement } from '../services/parsers/index.js';
import { accountService } from '../services/accounts.js';
import { tenantService } from '../services/tenant.js';
import { ragService } from '../services/rag.js';
import { budgetService } from '../services/budgets.js';
import { anomalyDetectionService } from '../services/anomaly-detection.js';
import path from 'path';
import fs from 'fs';
import {
  detectTransfers,
  persistTransferMatches,
  markOwnerContributions,
} from '../services/transfers/index.js';
import crypto from 'crypto';
import {
  detectBankSchema,
  resolveAlertSchema,
  updateMerchantMemorySchema,
  resolvePendingSchema,
  linkTransferSchema,
  autoDetectTransfersSchema,
  bulkLinkTransfersSchema,
  acceptInvitationSchema,
} from '../validation/operations.js';

const createBudgetSchema = z.object({
  name: z.string().min(1),
  budgetType: z.enum(['annual', 'quarterly', 'monthly', 'project']),
  periodStart: z.string(),
  periodEnd: z.string(),
  accountId: z.string().optional(),
  autoGenerate: z.boolean().optional(),
  lookbackMonths: z.number().int().min(1).max(60).optional(),
});

const accountMiscRoutes = new Hono();

// GET /api/banks
accountMiscRoutes.get('/banks', async (c) => {
  try {
    return c.json(getSupportedBanks());
  } catch (err) {
    console.error('Failed to get banks:', err);
    return c.json({ error: 'Failed to get banks' }, 500);
  }
});

// POST /api/statements/detect-bank
accountMiscRoutes.post(
  '/statements/detect-bank',
  zValidator('json', detectBankSchema),
  async (c) => {
    try {
      const { pdfText } = c.req.valid('json');
      return c.json(analyzeStatement(pdfText));
    } catch (err) {
      console.error('Bank detection failed:', err);
      return c.json({ error: 'Bank detection failed' }, 500);
    }
  },
);

// GET /api/accounts/consolidated
accountMiscRoutes.get('/accounts/consolidated', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const userAccounts = await db.select().from(accounts).where(eq(accounts.userId, userId)).all();
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
accountMiscRoutes.get('/reconciliation-alerts', async (c) => {
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
accountMiscRoutes.post(
  '/reconciliation-alerts/:id/resolve',
  zValidator('json', resolveAlertSchema),
  async (c) => {
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
  },
);

// PATCH /api/merchant-memory/:id
accountMiscRoutes.patch(
  '/merchant-memory/:id',
  zValidator('json', updateMerchantMemorySchema),
  async (c) => {
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
  },
);

// DELETE /api/merchant-memory/:id
accountMiscRoutes.delete('/merchant-memory/:id', async (c) => {
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

// POST /api/pending-categorizations/:id/resolve
accountMiscRoutes.post(
  '/pending-categorizations/:id/resolve',
  zValidator('json', resolvePendingSchema),
  async (c) => {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const pendingId = c.req.param('id');
    const { action, category, gstApplicable } = c.req.valid('json');

    const pending = await db
      .select()
      .from(pendingCategorization)
      .where(and(eq(pendingCategorization.id, pendingId), eq(pendingCategorization.userId, userId)))
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
  },
);

// POST /api/transfers (manual link)
accountMiscRoutes.post('/transfers', zValidator('json', linkTransferSchema), async (c) => {
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
});

// DELETE /api/transfers/:id
accountMiscRoutes.delete('/transfers/:id', async (c) => {
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

// POST /api/transfers/auto-detect
accountMiscRoutes.post(
  '/transfers/auto-detect',
  zValidator('json', autoDetectTransfersSchema),
  async (c) => {
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
        id: parseInt(t.id) || 0,
        accountId: parseInt(t.accountId || '0') || 0,
        date: t.date,
        description: t.description,
        amount: t.amount,
        isLinked: t.isTransfer ?? undefined,
        linkedTransactionId: t.transferLinkId ? parseInt(t.transferLinkId) : undefined,
      }));
      const accountContexts = (userAccounts as DetAcctRow[]).map((a: DetAcctRow) => ({
        id: parseInt(a.id) || 0,
        accountNumber: a.accountNumber,
        bankId: a.bankName || 'unknown',
        accountName: a.accountName,
        accountType: a.accountType,
        ownershipTag: (a.ownershipTag || 'business') as 'personal' | 'business',
      }));
      const existingLinkPairs = (existingLinks as DetLinkRow[]).map((l: DetLinkRow) => ({
        sourceId: parseInt(l.sourceTransactionId) || 0,
        targetId: parseInt(l.destinationTransactionId) || 0,
      }));

      const matches = detectTransfers(candidates, accountContexts, existingLinkPairs);
      let persistResult = null;
      if (persist && matches.length > 0) {
        persistResult = await persistTransferMatches(matches, { userId });
        const ownerContribIds: string[] = [];
        for (const match of matches) {
          const srcAcct = (userAccounts as DetAcctRow[]).find(
            (a: DetAcctRow) => (parseInt(a.id) || 0) === match.sourceTransaction.accountId,
          );
          const dstAcct = (userAccounts as DetAcctRow[]).find(
            (a: DetAcctRow) => (parseInt(a.id) || 0) === match.targetTransaction.accountId,
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
  },
);

// POST /api/transfers/bulk-link
accountMiscRoutes.post(
  '/transfers/bulk-link',
  zValidator('json', bulkLinkTransfersSchema),
  async (c) => {
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
  },
);

// GET /api/transfers/summary
accountMiscRoutes.get('/transfers/summary', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const period = c.req.query('period') || 'monthly';
    const fromDate = c.req.query('from');
    const toDate = c.req.query('to');

    const conditions: (SQL | undefined)[] = [eq(transferLinks.userId, userId)];
    if (fromDate) {
      conditions.push(gte(transferLinks.transferDate, fromDate));
    } else {
      const legacyMap: Record<string, number> = { '1m': 1, '3m': 3, '6m': 6, '12m': 12 };
      const defaultMonths = legacyMap[period] || 3;
      const defaultStart = new Date();
      defaultStart.setMonth(defaultStart.getMonth() - defaultMonths);
      conditions.push(gte(transferLinks.transferDate, defaultStart.toISOString().split('T')[0]));
    }
    if (toDate) conditions.push(lte(transferLinks.transferDate, toDate));

    const links = await db
      .select()
      .from(transferLinks)
      .where(and(...conditions))
      .all();

    const byPeriod: Record<string, { count: number; totalAmount: number }> = {};
    for (const link of links) {
      const date = link.transferDate || '';
      let periodKey: string;
      if (period === 'quarterly') {
        const [year, month] = date.split('-').map(Number);
        const q = Math.ceil(month / 3);
        periodKey = `${year}-Q${q}`;
      } else {
        periodKey = date.substring(0, 7);
      }
      if (!byPeriod[periodKey]) byPeriod[periodKey] = { count: 0, totalAmount: 0 };
      byPeriod[periodKey].count += 1;
      byPeriod[periodKey].totalAmount += link.amount || 0;
    }

    const byPair: Record<
      string,
      { sourceAccountId: string; destinationAccountId: string; count: number; totalAmount: number }
    > = {};
    for (const link of links) {
      const pairKey = `${link.sourceAccountId || 'unknown'}→${link.destinationAccountId || 'unknown'}`;
      if (!byPair[pairKey]) {
        byPair[pairKey] = {
          sourceAccountId: link.sourceAccountId || 'unknown',
          destinationAccountId: link.destinationAccountId || 'unknown',
          count: 0,
          totalAmount: 0,
        };
      }
      byPair[pairKey].count += 1;
      byPair[pairKey].totalAmount += link.amount || 0;
    }

    return c.json({
      period,
      totalTransfers: links.length,
      totalAmount: links.reduce(
        (sum: number, l: { amount?: number | null }) => sum + (l.amount || 0),
        0,
      ),
      confirmedCount: links.filter((l: { isUserConfirmed?: boolean | null }) => l.isUserConfirmed)
        .length,
      pendingCount: links.filter((l: { isUserConfirmed?: boolean | null }) => !l.isUserConfirmed)
        .length,
      byPeriod: Object.entries(byPeriod)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, data]) => ({ period: key, ...data })),
      byAccountPair: Object.values(byPair).sort((a, b) => b.totalAmount - a.totalAmount),
    });
  } catch (err) {
    console.error('Transfer summary failed:', err);
    return c.json({ error: 'Transfer summary failed' }, 500);
  }
});

// POST /api/invitations/accept
accountMiscRoutes.post(
  '/invitations/accept',
  zValidator('json', acceptInvitationSchema),
  async (c) => {
    try {
      const { token, userId: bodyUserId } = c.req.valid('json');
      let userId: string | undefined;
      try {
        const payload = c.get('jwtPayload');
        userId = payload?.userId ?? bodyUserId;
      } catch {
        userId = bodyUserId;
      }
      if (!userId) return c.json({ error: 'userId is required (via auth or body)' }, 400);
      return c.json(await tenantService.acceptInvitation(token, userId));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to accept invitation';
      return c.json({ error: msg }, 400);
    }
  },
);

// POST /api/admin/ingest-knowledge
accountMiscRoutes.post('/admin/ingest-knowledge', async (c) => {
  try {
    const { datasetName } = await c.req.json();
    const targetDataset = datasetName || 'production_handbooks';
    const knowledgeDir = path.resolve(process.cwd(), 'knowledge');
    if (!fs.existsSync(knowledgeDir))
      return c.json({ error: 'Knowledge directory not found' }, 404);
    const files = fs.readdirSync(knowledgeDir);
    const documents: string[] = [];
    for (const file of files) {
      if (file.endsWith('.md')) {
        const content = fs.readFileSync(path.join(knowledgeDir, file), 'utf-8');
        documents.push(`Source: ${file}\nContent:\n${content}`);
      }
    }
    if (documents.length === 0) return c.json({ message: 'No markdown files found to ingest' });
    const result = await ragService.addDocuments(documents, targetDataset);
    return c.json(result);
  } catch (err) {
    console.error('Ingestion failed:', err);
    return c.json({ error: 'Ingestion failed' }, 500);
  }
});

// GET /api/analytics/budgets
accountMiscRoutes.get('/analytics/budgets', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const status = c.req.query('status');
    const budgets = await budgetService.listBudgets(payload.userId, status);
    return c.json({ data: budgets });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get budgets';
    return c.json({ error: message, code: 'GET_BUDGETS_FAILED' }, 500);
  }
});

// POST /api/analytics/budgets
accountMiscRoutes.post('/analytics/budgets', zValidator('json', createBudgetSchema), async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const params = c.req.valid('json');
    const budget = await budgetService.createBudget(payload.userId, params);
    return c.json({ data: budget }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create budget';
    return c.json({ error: message, code: 'CREATE_BUDGET_FAILED' }, 500);
  }
});

// POST /api/analytics/anomalies/:id/dismiss
accountMiscRoutes.post('/analytics/anomalies/:id/dismiss', async (c) => {
  try {
    const alertId = c.req.param('id');
    const body = (await c.req.json().catch(() => ({}))) as { reason?: string };
    const reason = typeof body.reason === 'string' ? body.reason : 'dismissed';
    await anomalyDetectionService.dismissAlert(alertId, reason);
    return c.json({ data: { success: true, alertId } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to dismiss alert';
    return c.json({ error: message, code: 'DISMISS_ALERT_FAILED' }, 500);
  }
});

export default accountMiscRoutes;
