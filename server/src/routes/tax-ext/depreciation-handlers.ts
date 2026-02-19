import type { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, depreciableAssets } from '../../schema.js';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import { TaxService } from '../../services/tax.js';

const taxService = new TaxService();

const depreciableAssetSchema = z.object({
  assetName: z.string(),
  assetCategory: z.string(),
  purchaseDate: z.string(),
  purchaseCost: z.number(),
  effectiveLifeYears: z.number(),
  depreciationMethod: z.enum(['diminishing', 'prime_cost']).optional(),
  businessUsePercentage: z.number().min(0).max(100).optional(),
  isInstantWriteOff: z.boolean().optional(),
  linkedTransactionId: z.string().optional(),
  notes: z.string().optional(),
});

export function registerDepreciationHandlers(app: Hono): void {
  // GET /api/tax/depreciation/assets — Get depreciable assets
  app.get('/tax/depreciation/assets', async (c) => {
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
  app.post('/tax/depreciation/assets', zValidator('json', depreciableAssetSchema), async (c) => {
    try {
      const payload = c.get('jwtPayload');
      const userId = payload.userId;
      const body = c.req.valid('json');
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
  app.get('/tax/depreciation/calculate/:assetId', async (c) => {
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
}
