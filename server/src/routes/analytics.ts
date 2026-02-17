import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db, transactions } from '../schema.js';
import { eq, and, gte, sql } from 'drizzle-orm';
import crypto from 'crypto';
import { tenantAuthMiddleware } from '../services/auth-middleware.js';

const analyticsQuerySchema = z.object({
  months: z.string().regex(/^\d+$/).optional(),
  accountId: z.string().optional(),
  period: z.string().optional(),
});

// Shared query validator for analytics GET endpoints
const analyticsQuery = zValidator('query', analyticsQuerySchema);

const analyticsRoutes = new Hono();

// Apply tenant auth to all routes - requires valid JWT + X-Tenant-Id + tenant membership
analyticsRoutes.use('/*', tenantAuthMiddleware());

// Helper: get cutoff date relative to the user's latest transaction
async function getRelativeCutoff(userId: string, months: number): Promise<string> {
  const latest = await db.select({ maxDate: sql<string>`MAX(${transactions.date})` }).from(transactions).where(eq(transactions.userId, userId)).get();
  const refDate = latest?.maxDate ? new Date(latest.maxDate) : new Date();
  refDate.setMonth(refDate.getMonth() - months);
  return refDate.toISOString().split('T')[0];
}

// 6. Category Breakdown
analyticsRoutes.get('/category-breakdown', analyticsQuery, async (c) => {
  const payload = c.get('jwtPayload');
  const months = parseInt(c.req.query('months') || '6');
  const cutoffStr = await getRelativeCutoff(payload.userId, months);
  const txns = await db.select().from(transactions).where(and(eq(transactions.userId, payload.userId), gte(transactions.date, cutoffStr), eq(transactions.isTransfer, false))).all();
  const categories: Record<string, number> = {};
  let totalExpense = 0;
  for (const t of txns) {
    if (t.amount >= 0) continue;
    const cat = t.category || 'Uncategorized';
    categories[cat] = (categories[cat] || 0) + Math.abs(t.amount);
    totalExpense += Math.abs(t.amount);
  }
  return c.json({ categories: Object.entries(categories).map(([name, value]) => ({ name, value })), total: totalExpense });
});

// 7. Spending Trends
analyticsRoutes.get('/spending-trends', async (c) => {
  const payload = c.get('jwtPayload');
  const cutoffStr = await getRelativeCutoff(payload.userId, parseInt(c.req.query('months') || '6'));
  const txns = await db.select().from(transactions).where(and(eq(transactions.userId, payload.userId), gte(transactions.date, cutoffStr), eq(transactions.isTransfer, false))).all();
  const byMonth: Record<string, Record<string, number>> = {};
  for (const t of txns) {
    if (t.amount >= 0) continue;
    const month = t.date.substring(0, 7);
    if (!byMonth[month]) byMonth[month] = {};
    const cat = t.category || 'Other';
    byMonth[month][cat] = (byMonth[month][cat] || 0) + Math.abs(t.amount);
  }
  return c.json(Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).map(([month, categories]) => ({ month, categories, total: Object.values(categories).reduce((s, v) => s + v, 0) })));
});

// 8. Recurring Payments
analyticsRoutes.get('/recurring-payments', async (c) => {
  const payload = c.get('jwtPayload');
  const txns = await db.select().from(transactions).where(and(eq(transactions.userId, payload.userId), eq(transactions.isTransfer, false))).all();
  const byMerchant: Record<string, Array<{ amount: number; date: string }>> = {};
  for (const t of txns) {
    if (t.amount >= 0) continue;
    const key = (t.description || '').replace(/\d{2,}/g, '').trim().substring(0, 40);
    if (!key) continue;
    if (!byMerchant[key]) byMerchant[key] = [];
    byMerchant[key].push({ amount: Math.abs(t.amount), date: t.date });
  }
  const recurring = [];
  for (const [merchant, occurrences] of Object.entries(byMerchant)) {
    if (occurrences.length < 2) continue;
    occurrences.sort((a, b) => a.date.localeCompare(b.date));
    let totalGap = 0;
    for (let i = 1; i < occurrences.length; i++) totalGap += (new Date(occurrences[i].date).getTime() - new Date(occurrences[i - 1].date).getTime()) / (1000 * 60 * 60 * 24);
    const avgGap = totalGap / (occurrences.length - 1);
    const typicalAmount = Math.round(occurrences.reduce((s, o) => s + o.amount, 0) / occurrences.length);
    recurring.push({ id: crypto.randomUUID(), merchantPattern: merchant, typicalAmount, frequency: avgGap <= 10 ? 'weekly' : avgGap <= 20 ? 'fortnightly' : 'monthly' });
  }
  return c.json(recurring);
});

// 9. Budget vs Actual
analyticsRoutes.get('/budget-vs-actual', async (c) => {
  const payload = c.get('jwtPayload');
  const latestResult = await db.select({ maxDate: sql<string>`MAX(${transactions.date})` }).from(transactions).where(eq(transactions.userId, payload.userId)).get();
  const refDate = latestResult?.maxDate ? new Date(latestResult.maxDate) : new Date();
  const monthStart = `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, '0')}-01`;
  const txns = await db.select().from(transactions).where(and(eq(transactions.userId, payload.userId), gte(transactions.date, monthStart), eq(transactions.isTransfer, false))).all();
  const actuals: Record<string, number> = {};
  for (const t of txns) if (t.amount < 0) actuals[t.category || 'Other'] = (actuals[t.category || 'Other'] || 0) + Math.abs(t.amount);
  return c.json(Object.entries(actuals).map(([category, actualCents]) => ({ id: crypto.randomUUID(), category, actualCents })));
});

// 11. Anomaly Detection
analyticsRoutes.get('/anomalies', async (c) => {
  const payload = c.get('jwtPayload');
  const _txns = await db.select().from(transactions).where(and(eq(transactions.userId, payload.userId), eq(transactions.isTransfer, false))).all();
  return c.json([]); // Simplified
});

// 12. Cash Flow Forecast
analyticsRoutes.get('/cash-flow-forecast', async (c) => {
  const _payload = c.get('jwtPayload');
  return c.json([]); // Simplified
});

export default analyticsRoutes;
