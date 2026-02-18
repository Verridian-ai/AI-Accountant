import { Hono } from 'hono';
import { db, accounts, transactions } from '../schema.js';
import { eq } from 'drizzle-orm';
import { getSupportedBanks, analyzeStatement } from '../services/parsers/index.js';

const banksExtRoutes = new Hono();

// GET /api/banks — Get supported banks
banksExtRoutes.get('/banks', async (c) => {
  try {
    const banks = getSupportedBanks();
    return c.json(banks);
  } catch (err) {
    console.error('Failed to get banks:', err);
    return c.json({ error: 'Failed to get banks' }, 500);
  }
});

// POST /api/statements/detect-bank — Detect bank from PDF text
banksExtRoutes.post('/statements/detect-bank', async (c) => {
  try {
    const body = await c.req.json();
    const { pdfText } = body;
    if (!pdfText) return c.json({ error: 'pdfText is required' }, 400);
    const analysis = analyzeStatement(pdfText);
    return c.json(analysis);
  } catch (err) {
    console.error('Bank detection failed:', err);
    return c.json({ error: 'Bank detection failed' }, 500);
  }
});

// GET /api/accounts/consolidated — Get consolidated account summary
banksExtRoutes.get('/accounts/consolidated', async (c) => {
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

export default banksExtRoutes;
