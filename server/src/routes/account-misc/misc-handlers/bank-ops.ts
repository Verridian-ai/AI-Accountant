import type { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { db, transactions, accounts } from '../../../schema.js';
import { eq } from 'drizzle-orm';
import { getSupportedBanks, analyzeStatement } from '../../../services/parsers/index.js';
import { detectBankSchema } from '../../../validation/operations.js';

export function registerBankOps(app: Hono): void {
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
}
