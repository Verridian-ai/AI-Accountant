import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db, accounts } from '../schema.js';
import { eq, and } from 'drizzle-orm';
import { aiService, type DebtStrategy } from '../services/ai.js';
import { tenantAuthMiddleware } from '../services/auth-middleware.js';

const debtRecommendationsSchema = z.object({
  monthlyBudget: z.number().positive(),
});

const budgetsRoutes = new Hono();

// Apply tenant auth to all routes - requires valid JWT + X-Tenant-Id + tenant membership
budgetsRoutes.use('/*', tenantAuthMiddleware());

// Get debt reduction recommendations
budgetsRoutes.post('/debt-recommendations', zValidator('json', debtRecommendationsSchema), async (c) => {
  const payload = c.get('jwtPayload');
  const userId = payload.userId;
  const { monthlyBudget } = c.req.valid('json');

  const debtAccounts = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.isActive, true)))
    .all();

  type AccountRow = typeof accounts.$inferSelect;
  const typedDebtAccounts: AccountRow[] = debtAccounts;
  const accountsWithDebt = typedDebtAccounts.filter(
    (a: AccountRow) =>
      (a.accountType === 'credit_card' || a.accountType === 'loan') &&
      a.currentBalance !== null &&
      a.currentBalance < 0,
  );

  if (accountsWithDebt.length === 0) {
    return c.json({
      message: 'No debt accounts found',
      aggressive: null,
      moderate: null,
      minimum: null,
    });
  }

  const accountMap = new Map(accountsWithDebt.map((a: AccountRow) => [a.id, a]));

  const accountsForAnalysis = accountsWithDebt.map((a: AccountRow) => ({
    id: a.id,
    name: a.accountName,
    type: a.accountType,
    balance: Math.abs(a.currentBalance || 0),
    interestRate: a.interestRate || 0,
    minimumPayment: a.minimumPayment || 0,
  }));

  const aiResult = await aiService.analyzeDebtPayoff(
    accountsForAnalysis,
    monthlyBudget * 100,
  );

  const transformStrategy = (
    strategy: DebtStrategy,
    name: string,
    description: string,
  ) => {
    if (!strategy) return null;

    const totalMonthlyPayment = strategy.monthlyPayments.reduce(
      (sum: number, p: { account_id: string; payment_cents: number }) => sum + (p.payment_cents || 0),
      0,
    );

    const payoffOrder = strategy.monthlyPayments.map((p: { account_id: string; payment_cents: number }) => {
      const account = accountMap.get(p.account_id);
      return {
        accountId: p.account_id,
        accountName: account?.accountName || 'Unknown Account',
        monthsToPayoff: strategy.totalMonths,
        interestPaid: 0,
      };
    });

    const projections = (strategy.monthlyBreakdown || []).slice(0, 24).map((m) => {
      const totalDebt = Object.values(m.balances || {}).reduce(
        (sum: number, bal: number) => sum + bal,
        0,
      );
      return {
        month: m.month,
        totalDebt,
        interestPaid: m.interest_paid || 0,
      };
    });

    return {
      name,
      description,
      totalMonths: strategy.totalMonths,
      totalInterestPaid: strategy.totalInterestCents,
      monthlyPayment: totalMonthlyPayment,
      payoffOrder,
      projections,
    };
  };

  const result = {
    aggressive: transformStrategy(aiResult.aggressive, 'Aggressive', 'Maximum debt payoff - avalanche method'),
    moderate: transformStrategy(aiResult.moderate, 'Moderate', 'Balanced approach with savings buffer'),
    minimum: transformStrategy(aiResult.minimum, 'Minimum', 'Minimum payments only'),
  };

  return c.json(result);
});

export default budgetsRoutes;
