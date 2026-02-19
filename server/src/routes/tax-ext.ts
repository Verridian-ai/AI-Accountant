import { Hono } from 'hono';
import {
  db,
  transactions,
  taxBrackets,
  cgtAssets,
  cgtEvents,
  depreciableAssets,
} from '../schema.js';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import crypto from 'crypto';
import { getQuarterDates } from '../services/bas.js';
import { TaxService } from '../services/tax.js';
import { events } from '../events.js';

const taxExtRoutes = new Hono();
const taxService = new TaxService();

// Helper: resolve period string → { financialYear, quarter }
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
  const quarterNum = parseInt(q, 10);
  const fyStartYear = parseInt(year, 10);
  const financialYear = `${fyStartYear}-${(fyStartYear + 1).toString().slice(2)}`;
  return { financialYear, quarter: quarterNum };
}

// POST /api/transactions/categorize-gst — Batch update GST categories
taxExtRoutes.post('/transactions/categorize-gst', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const body = await c.req.json();
    const { updates } = body;

    if (!Array.isArray(updates)) return c.json({ error: 'Updates must be an array' }, 400);

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
  } catch (err) {
    console.error('GST categorization failed:', err);
    return c.json({ error: 'GST categorization failed' }, 500);
  }
});

// POST /api/gst/bulk-approve — Bulk approve GST categories
taxExtRoutes.post('/gst/bulk-approve', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const { ids } = await c.req.json();

    if (!Array.isArray(ids)) return c.json({ error: 'ids must be an array' }, 400);

    for (const id of ids) {
      const tx = await db
        .select()
        .from(transactions)
        .where(and(eq(transactions.id, String(id)), eq(transactions.userId, userId)))
        .get();
      if (tx) {
        const gstCategory = 'taxable_10';
        const gstAmount = Math.round(Math.abs(tx.amount) / 11);
        await db
          .update(transactions)
          .set({ gstCategory, gstAmount, isEdited: true })
          .where(eq(transactions.id, String(id)));
      }
    }

    events.emit('update', { type: 'transactions_updated' });
    return c.json({ success: true, updated: ids.length });
  } catch (err) {
    console.error('GST bulk approve failed:', err);
    return c.json({ error: 'Failed to bulk approve' }, 500);
  }
});

// GET /api/gst/input-tax-credits — GST input tax credits by category
taxExtRoutes.get('/gst/input-tax-credits', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const period = c.req.query('period') || 'current';

    const { financialYear, quarter } = resolvePeriod(period);
    const dates = getQuarterDates(financialYear, quarter);

    const txns = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          gte(transactions.date, dates.startDate),
          lte(transactions.date, dates.endDate),
          eq(transactions.isTransfer, false),
          sql`${transactions.amount} < 0`,
        ),
      )
      .all();

    const creditsByCategory: Record<string, { gstCredits: number; transactionCount: number }> = {};

    for (const tx of txns) {
      const cat = tx.gstCategory || 'taxable_10';
      if (cat === 'private' || cat === 'input_taxed') continue;
      const category = tx.category || 'Uncategorized';
      const gstAmount =
        tx.gstAmount || (cat === 'taxable_10' ? Math.round(Math.abs(tx.amount) / 11) : 0);
      if (gstAmount > 0) {
        if (!creditsByCategory[category]) {
          creditsByCategory[category] = { gstCredits: 0, transactionCount: 0 };
        }
        creditsByCategory[category].gstCredits += gstAmount;
        creditsByCategory[category].transactionCount++;
      }
    }

    const credits = Object.entries(creditsByCategory).map(([category, data]) => ({
      category,
      gstCredits: data.gstCredits,
      hasInvoice: data.gstCredits <= 8250,
      transactionCount: data.transactionCount,
    }));

    return c.json(credits);
  } catch (err) {
    console.error('Failed to fetch input tax credits:', err);
    return c.json([]);
  }
});

// GET /api/tax/brackets/:year — Get tax brackets for a year
taxExtRoutes.get('/tax/brackets/:year', async (c) => {
  try {
    const taxYear = c.req.param('year');
    const brackets = await db
      .select()
      .from(taxBrackets)
      .where(eq(taxBrackets.taxYear, taxYear))
      .all();
    return c.json(brackets);
  } catch (err) {
    console.error('Failed to get tax brackets:', err);
    return c.json({ error: 'Failed to get tax brackets' }, 500);
  }
});

// GET /api/tax/assets — Get CGT assets
taxExtRoutes.get('/tax/assets', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const assets = await db.select().from(cgtAssets).where(eq(cgtAssets.userId, userId)).all();
    return c.json(assets);
  } catch (err) {
    console.error('Failed to get assets:', err);
    return c.json({ error: 'Failed to get assets' }, 500);
  }
});

// POST /api/tax/assets — Add a CGT asset
taxExtRoutes.post('/tax/assets', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const body = await c.req.json();
    const assetId = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.insert(cgtAssets).values({
      id: assetId,
      userId,
      assetName: body.assetName,
      assetType: body.assetType,
      acquisitionDate: body.acquisitionDate,
      acquisitionCost: body.acquisitionCost,
      acquisitionCostsIncidental: body.acquisitionCostsIncidental || 0,
      improvementsCost: body.improvementsCost || 0,
      quantity: body.quantity || 1,
      unitCost: body.unitCost,
      status: body.status || 'held',
      notes: body.notes,
      createdAt: now,
      updatedAt: now,
    });

    return c.json({ id: assetId, success: true });
  } catch (err) {
    console.error('Failed to add asset:', err);
    return c.json({ error: 'Failed to add asset' }, 500);
  }
});

// GET /api/tax/cgt — Get CGT events
taxExtRoutes.get('/tax/cgt', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const taxYear = c.req.query('taxYear');

    const events_list = await db
      .select()
      .from(cgtEvents)
      .where(
        and(eq(cgtEvents.userId, userId), taxYear ? eq(cgtEvents.taxYear, taxYear) : undefined),
      )
      .all();

    return c.json(events_list);
  } catch (err) {
    console.error('Failed to get CGT events:', err);
    return c.json({ error: 'Failed to get CGT events' }, 500);
  }
});

// POST /api/tax/cgt/disposal — Record a CGT disposal
taxExtRoutes.post('/tax/cgt/disposal', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const body = await c.req.json();

    const cgtResult = taxService.calculateCapitalGain(
      body.acquisitionDate,
      body.acquisitionCost,
      body.disposalDate,
      body.disposalProceeds,
      body.incidentalCosts || 0,
      body.disposalCosts || 0,
      body.carriedForwardLosses || 0,
    );

    const eventId = crypto.randomUUID();
    const now = new Date().toISOString();

    const dispDate = new Date(body.disposalDate);
    const month = dispDate.getMonth() + 1;
    const year = dispDate.getFullYear();
    const taxYear =
      month >= 7
        ? `${year}-${(year + 1).toString().slice(2)}`
        : `${year - 1}-${year.toString().slice(2)}`;

    await db.insert(cgtEvents).values({
      id: eventId,
      userId,
      assetId: body.assetId,
      taxYear,
      disposalDate: body.disposalDate,
      disposalProceeds: body.disposalProceeds,
      disposalCosts: body.disposalCosts || 0,
      quantityDisposed: body.quantityDisposed || 1,
      costBaseUsed: cgtResult.costBase,
      capitalGainGross: cgtResult.grossGain,
      discountApplied: cgtResult.discountEligible,
      discountAmount: cgtResult.discountAmount,
      capitalGainNet: cgtResult.netGain,
      capitalLoss: cgtResult.capitalLoss,
      calculationDetails: JSON.stringify(cgtResult),
      createdAt: now,
    });

    return c.json({ id: eventId, taxYear, ...cgtResult });
  } catch (err) {
    console.error('Failed to record disposal:', err);
    return c.json({ error: 'Failed to record disposal' }, 500);
  }
});

// GET /api/tax/depreciation/assets — Get depreciable assets
taxExtRoutes.get('/tax/depreciation/assets', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const assets = await db
      .select()
      .from(depreciableAssets)
      .where(eq(depreciableAssets.userId, userId))
      .all();
    return c.json(assets);
  } catch (err) {
    console.error('Failed to get depreciable assets:', err);
    return c.json({ error: 'Failed to get depreciable assets' }, 500);
  }
});

// POST /api/tax/depreciation/assets — Add depreciable asset
taxExtRoutes.post('/tax/depreciation/assets', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const body = await c.req.json();
    const assetId = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.insert(depreciableAssets).values({
      id: assetId,
      userId,
      assetName: body.assetName,
      assetCategory: body.assetCategory,
      purchaseDate: body.purchaseDate,
      purchaseCost: body.purchaseCost,
      effectiveLifeYears: body.effectiveLifeYears,
      depreciationMethod: body.depreciationMethod || 'diminishing',
      businessUsePercentage: body.businessUsePercentage || 100,
      openingWrittenDownValue: body.purchaseCost,
      currentWrittenDownValue: body.purchaseCost,
      isInstantWriteOff: body.isInstantWriteOff || false,
      status: 'active',
      linkedTransactionId: body.linkedTransactionId,
      notes: body.notes,
      createdAt: now,
      updatedAt: now,
    });

    return c.json({ id: assetId, success: true });
  } catch (err) {
    console.error('Failed to add depreciable asset:', err);
    return c.json({ error: 'Failed to add depreciable asset' }, 500);
  }
});

// GET /api/tax/depreciation/calculate/:assetId — Calculate depreciation
taxExtRoutes.get('/tax/depreciation/calculate/:assetId', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const assetId = c.req.param('assetId');

    const asset = await db
      .select()
      .from(depreciableAssets)
      .where(and(eq(depreciableAssets.id, assetId), eq(depreciableAssets.userId, userId)))
      .get();

    if (!asset) return c.json({ error: 'Asset not found' }, 404);

    const result = taxService.calculateDepreciation(
      asset.purchaseCost,
      asset.effectiveLifeYears,
      asset.openingWrittenDownValue || asset.purchaseCost,
      asset.depreciationMethod as 'diminishing' | 'prime_cost',
      asset.businessUsePercentage || 100,
    );

    return c.json(result);
  } catch (err) {
    console.error('Depreciation calculation failed:', err);
    return c.json({ error: 'Depreciation calculation failed' }, 500);
  }
});

export default taxExtRoutes;
