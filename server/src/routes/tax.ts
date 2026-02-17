import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db, transactions, deductions, taxYearSummary } from '../schema.js';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import crypto from 'crypto';
import { TaxService } from '../services/tax.js';
import { BASService } from '../services/bas.js';
import { events } from '../events.js';

const categorizeGSTSchema = z.object({
  updates: z
    .array(
      z.object({
        transactionId: z.string().min(1),
        gstCategory: z.string().min(1),
        gstAmount: z.number().optional(),
      }),
    )
    .min(1),
});

const classifyGSTSchema = z.object({
  gstCategory: z.string().min(1),
});

const createDeductionSchema = z
  .object({
    taxYear: z.string().min(4),
    description: z.string().min(1),
    amountCents: z.number().int().min(0),
    category: z.string().optional(),
    notes: z.string().max(2000).optional(),
  })
  .passthrough();

const taxRoutes = new Hono();
const taxService = new TaxService();
const basService = new BASService();

// Helper: resolve period string to quarter dates
function resolvePeriod(period: string): { financialYear: string; quarter: number } {
  if (period === 'current') {
    const today = new Date();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();
    const fy =
      month >= 7
        ? `${year}-${(year + 1).toString().slice(2)}`
        : `${year - 1}-${year.toString().slice(2)}`;
    let q: number;
    if (month >= 7 && month <= 9) q = 1;
    else if (month >= 10 && month <= 12) q = 2;
    else if (month >= 1 && month <= 3) q = 3;
    else q = 4;
    return { financialYear: fy, quarter: q };
  }
  const [year, q] = period.split('-Q');
  const quarterNum = parseInt(q);
  const fyStartYear = parseInt(year);
  const financialYear = `${fyStartYear}-${(fyStartYear + 1).toString().slice(2)}`;
  return { financialYear, quarter: quarterNum };
}

// ============ GST ENDPOINTS ============

// Batch update GST categories
taxRoutes.post('/categorize-gst', zValidator('json', categorizeGSTSchema), async (c) => {
  const payload = c.get('jwtPayload');
  const userId = payload.userId;
  const { updates } = c.req.valid('json');
  for (const update of updates) {
    const tx = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, update.transactionId), eq(transactions.userId, userId)))
      .get();
    if (tx) {
      await db
        .update(transactions)
        .set({ gstCategory: update.gstCategory, gstAmount: update.gstAmount })
        .where(eq(transactions.id, update.transactionId));
    }
  }
  events.emit('update', { type: 'transactions_updated' });
  return c.json({ success: true, updated: updates.length });
});

// GST Summary
taxRoutes.get('/gst/summary', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const period = c.req.query('period') || 'current';
    const { financialYear, quarter } = resolvePeriod(period);
    const result = await basService.calculateBAS(payload.userId, financialYear, quarter);
    const { getQuarterDates } = await import('../services/bas.js');
    const dates = getQuarterDates(financialYear, quarter);
    const quarterTxns = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, payload.userId),
          gte(transactions.date, dates.startDate),
          lte(transactions.date, dates.endDate),
          eq(transactions.isTransfer, false),
        ),
      )
      .all();
    let _taxableSales = 0,
      _taxablePurchases = 0,
      classifiedCount = 0,
      needReviewCount = 0;
    for (const tx of quarterTxns) {
      const _cat = tx.gstCategory || 'taxable_10';
      const amt = Math.abs(tx.amount);
      if (!tx.gstCategory) needReviewCount++;
      else classifiedCount++;
      if (tx.amount > 0) _taxableSales += amt;
      else _taxablePurchases += amt;
    }
    return c.json({
      gstCollected: result.labels['1A'],
      gstCredits: result.labels['1B'],
      netGST: result.netGst,
      transactionsClassified: classifiedCount,
      transactionsNeedReview: needReviewCount,
    });
  } catch {
    return c.json({ gstCollected: 0, gstCredits: 0, netGST: 0 });
  }
});

// GST Review Queue
taxRoutes.get('/gst/review-queue', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const reviewItems = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, payload.userId),
          eq(transactions.isTransfer, false),
          sql`(${transactions.gstCategory} IS NULL OR ${transactions.gstCategory} = '')`,
        ),
      )
      .limit(50)
      .all();
    const items = reviewItems.map((tx: any) => ({
      id: tx.id,
      date: tx.date,
      description: tx.description,
      amount: tx.amount,
      suggestedCategory: 'taxable_10',
      suggestedGstAmount: Math.round(Math.abs(tx.amount) / 11),
      confidence: 0.5,
      currentCategory: tx.category || 'Uncategorized',
    }));
    return c.json(items);
  } catch {
    return c.json([]);
  }
});

// GST Classify
taxRoutes.post('/gst/classify/:id', zValidator('json', classifyGSTSchema), async (c) => {
  const payload = c.get('jwtPayload');
  const id = c.req.param('id');
  const { gstCategory } = c.req.valid('json');
  const tx = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, payload.userId)))
    .get();
  if (!tx) return c.json({ error: 'Not found' }, 404);
  const gstAmount = gstCategory === 'taxable_10' ? Math.round(Math.abs(tx.amount) / 11) : 0;
  await db
    .update(transactions)
    .set({ gstCategory, gstAmount, isEdited: true })
    .where(eq(transactions.id, id));
  return c.json({ success: true });
});

// ============ TAX ENDPOINTS ============

// Get tax calculation
taxRoutes.get('/tax/calculate/:year', async (c) => {
  const taxYear = c.req.param('year');
  const query = c.req.query();
  const result = taxService.calculateFullTax(
    parseInt(query.grossIncome || '0') / 100,
    parseInt(query.totalDeductions || '0') / 100,
    query.hasPrivateHealth === 'true',
    query.applyLITO !== 'false',
  );
  return c.json({
    taxYear,
    taxable_income: Math.round(result.taxableIncome * 100),
    total_tax: Math.round(result.totalTax * 100),
    effective_rate: result.effectiveTaxRate / 100,
  });
});

// Get tax summary
taxRoutes.get('/tax/summary/:year', async (c) => {
  const payload = c.get('jwtPayload');
  const taxYear = c.req.param('year');
  const existing = await db
    .select()
    .from(taxYearSummary)
    .where(and(eq(taxYearSummary.userId, payload.userId), eq(taxYearSummary.taxYear, taxYear)))
    .get();
  if (existing) return c.json(existing);
  const userTransactions = await db
    .select()
    .from(transactions)
    .where(eq(transactions.userId, payload.userId))
    .all();
  const totalIncome = userTransactions
    .filter((t: any) => t.amount > 0 && !t.isTransfer)
    .reduce((sum: number, t: any) => sum + t.amount, 0); // eslint-disable-line @typescript-eslint/no-explicit-any
  return c.json({ taxYear, grossIncomeCents: totalIncome, status: 'draft' });
});

// Deductions, Assets, CGT, Depreciation (omitted for brevity, assume similar structure)
taxRoutes.get('/tax/deductions/:year', async (c) => {
  const payload = c.get('jwtPayload');
  return c.json(
    await db
      .select()
      .from(deductions)
      .where(
        and(eq(deductions.userId, payload.userId), eq(deductions.taxYear, c.req.param('year'))),
      )
      .all(),
  );
});

taxRoutes.post('/tax/deductions', zValidator('json', createDeductionSchema), async (c) => {
  const payload = c.get('jwtPayload');
  const body = c.req.valid('json');
  const id = crypto.randomUUID();
  await db
    .insert(deductions)
    .values({ id, userId: payload.userId, ...body, createdAt: new Date().toISOString() });
  return c.json({ id, success: true });
});

export default taxRoutes;
