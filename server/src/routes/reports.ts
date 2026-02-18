import { Hono } from 'hono';
import { z } from 'zod';
import { db, transactions } from '../schema.js';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { tenantAuthMiddleware } from '../services/auth-middleware.js';
import { getUserId } from '../utils/auth-helpers.js';

// Zod used for type inference in report response types
const _periodQuerySchema = z.object({
  period: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const reportRoutes = new Hono();

// Apply tenant auth to all routes - requires valid JWT + X-Tenant-Id + tenant membership
reportRoutes.use('/*', tenantAuthMiddleware());

// Get consolidated report for a period
reportRoutes.get('/consolidated/:period', async (c) => {
  const userId = getUserId(c);
  const period = c.req.param('period'); // Format: YYYY-MM or YYYY

  let startDate: string;
  let endDate: string;

  if (period.length === 7) {
    // Monthly: YYYY-MM
    startDate = `${period}-01`;
    const [year, month] = period.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    endDate = `${period}-${lastDay.toString().padStart(2, '0')}`;
  } else if (period.length === 4) {
    // Yearly: YYYY
    startDate = `${period}-01-01`;
    endDate = `${period}-12-31`;
  } else {
    return c.json({ error: 'Invalid period format. Use YYYY-MM or YYYY' }, 400);
  }

  const userTransactions = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate),
      ),
    )
    .orderBy(desc(transactions.date))
    .all();

  type Transaction = typeof transactions.$inferSelect;

  // Calculate totals
  const income = userTransactions
    .filter((t: Transaction) => t.amount > 0 && !t.isTransfer)
    .reduce((sum: number, t: Transaction) => sum + t.amount, 0);

  const expenses = userTransactions
    .filter((t: Transaction) => t.amount < 0 && !t.isTransfer)
    .reduce((sum: number, t: Transaction) => sum + Math.abs(t.amount), 0);

  const netSavings = income - expenses;
  const savingsRate = income > 0 ? (netSavings / income) * 100 : 0;

  // Group by category
  const categoryBreakdown: Record<string, number> = {};
  for (const t of userTransactions) {
    if (t.isTransfer) continue;
    const cat = t.category || 'Uncategorized';
    categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + t.amount;
  }

  return c.json({
    period,
    startDate,
    endDate,
    summary: {
      income,
      expenses,
      netSavings,
      savingsRate: Math.round(savingsRate * 10) / 10,
      transactionCount: userTransactions.length,
    },
    categoryBreakdown,
    transactions: userTransactions,
  });
});

export default reportRoutes;
