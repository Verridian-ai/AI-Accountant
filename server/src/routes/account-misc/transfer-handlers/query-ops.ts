import type { Hono } from 'hono';
import { db, transferLinks } from '../../../schema.js';
import { and, eq, desc, gte, lte, type SQL } from 'drizzle-orm';

export function registerTransferQueryOps(app: Hono): void {
  // GET /api/transfers/summary
  app.get('/transfers/summary', async (c) => {
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
        {
          sourceAccountId: string;
          destinationAccountId: string;
          count: number;
          totalAmount: number;
        }
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

  // GET /api/transfers
  app.get('/transfers', async (c) => {
    try {
      const payload = c.get('jwtPayload') as Record<string, unknown> | undefined;
      const userId = (payload?.userId as string) ?? '';
      const isAdmin = !!payload?.adminId || payload?.role === 'super_admin' || !payload?.tenantId;

      const rows = isAdmin
        ? await db.select().from(transferLinks).orderBy(desc(transferLinks.createdAt)).all()
        : await db
            .select()
            .from(transferLinks)
            .where(eq(transferLinks.userId, userId))
            .orderBy(desc(transferLinks.createdAt))
            .all();

      return c.json(rows);
    } catch (err) {
      console.error('Failed to fetch transfers:', err);
      return c.json({ error: 'Failed to fetch transfers' }, 500);
    }
  });
}
