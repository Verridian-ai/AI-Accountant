import { Hono } from 'hono';
import { db, transactions, accounts, transferLinks } from '../schema.js';
import { eq, and, gte, lte, type SQL } from 'drizzle-orm';
import crypto from 'crypto';
import {
  detectTransfers,
  persistTransferMatches,
  markOwnerContributions,
} from '../services/transfers/index.js';
import { events } from '../events.js';

const transfersExtRoutes = new Hono();

// POST /api/transfers/auto-detect — Auto-detect transfers (with optional persist)
transfersExtRoutes.post('/auto-detect', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const body = await c.req.json().catch(() => ({}));
    const persist = body.persist === true;

    const userTransactions = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .all();

    const userAccounts = await db.select().from(accounts).where(eq(accounts.userId, userId)).all();

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
      if (ownerContribIds.length > 0) {
        await markOwnerContributions(ownerContribIds);
      }

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

// POST /api/transfers/bulk-link — Bulk link transfers
transfersExtRoutes.post('/bulk-link', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const body = await c.req.json();
    const { pairs } = body;

    if (!Array.isArray(pairs)) return c.json({ error: 'Pairs must be an array' }, 400);

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
        .where(and(eq(transactions.id, destinationTransactionId), eq(transactions.userId, userId)))
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

// GET /api/transfers/summary — Transfer summary aggregated by period
transfersExtRoutes.get('/summary', async (c) => {
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

export default transfersExtRoutes;
