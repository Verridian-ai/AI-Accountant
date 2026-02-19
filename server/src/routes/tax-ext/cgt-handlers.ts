import type { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, taxBrackets, cgtAssets, cgtEvents } from '../../schema.js';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import { TaxService } from '../../services/tax.js';

const taxService = new TaxService();

const cgtAssetSchema = z.object({
  assetName: z.string(),
  assetType: z.string(),
  acquisitionDate: z.string(),
  acquisitionCost: z.number(),
  acquisitionCostsIncidental: z.number().optional(),
  improvementsCost: z.number().optional(),
  quantity: z.number().optional(),
  unitCost: z.number().optional(),
  status: z.string().optional(),
  notes: z.string().optional(),
});

const cgtDisposalSchema = z.object({
  assetId: z.string().optional(),
  acquisitionDate: z.string(),
  acquisitionCost: z.number(),
  disposalDate: z.string(),
  disposalProceeds: z.number(),
  incidentalCosts: z.number().optional(),
  disposalCosts: z.number().optional(),
  carriedForwardLosses: z.number().optional(),
  quantityDisposed: z.number().optional(),
});

export function registerCGTHandlers(app: Hono): void {
  // GET /api/tax/brackets/:year — Get tax brackets for a year
  app.get('/tax/brackets/:year', async (c) => {
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
  app.get('/tax/assets', async (c) => {
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
  app.post('/tax/assets', zValidator('json', cgtAssetSchema), async (c) => {
    try {
      const payload = c.get('jwtPayload');
      const userId = payload.userId;
      const body = c.req.valid('json');
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
  app.get('/tax/cgt', async (c) => {
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
  app.post('/tax/cgt/disposal', zValidator('json', cgtDisposalSchema), async (c) => {
    try {
      const payload = c.get('jwtPayload');
      const userId = payload.userId;
      const body = c.req.valid('json');

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
}
