import type { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, merchantMemory } from '../../schema.js';
import { and, eq, like } from 'drizzle-orm';
import { orchestrator } from '../../services/claude/orchestrator.js';

const merchantBatchResolveSchema = z.object({
  descriptions: z.array(z.string()).min(1),
});

export function registerMerchantHandlers(app: Hono): void {
  /**
   * GET /api/merchants
   * List merchant memory mappings for the user.
   */
  app.get('/merchants', async (c) => {
    try {
      const payload = c.get('jwtPayload');
      const userId = payload.userId;
      const search = c.req.query('search');

      let query = db.select().from(merchantMemory).where(eq(merchantMemory.userId, userId));

      if (search) {
        const pattern = `%${search.toLowerCase()}%`;
        query = db
          .select()
          .from(merchantMemory)
          .where(
            and(eq(merchantMemory.userId, userId), like(merchantMemory.merchantPattern, pattern)),
          ) as Record<string, unknown>;
      }

      const mappings = await query.all();

      return c.json({
        merchants: mappings.map((m: Record<string, unknown>) => ({
          id: m.id,
          pattern: m.merchantPattern,
          displayName: m.merchantDisplayName,
          category: m.category,
          gstRegistered: m.gstApplicable || false,
          timesUsed: m.timesUsed || 0,
          lastUsed: m.lastUsed,
          isUserConfirmed: m.isUserConfirmed || false,
        })),
        total: mappings.length,
      });
    } catch (err) {
      console.error('Merchant list failed:', err);
      return c.json({ error: 'Failed to list merchants' }, 500);
    }
  });

  /**
   * POST /api/merchants/batch-resolve
   * Batch-resolve merchant descriptions using the Merchant Intelligence agent.
   */
  app.post(
    '/merchants/batch-resolve',
    zValidator('json', merchantBatchResolveSchema),
    async (c) => {
      try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;
        const { descriptions } = c.req.valid('json');

        if (!orchestrator.isEnabled()) {
          return c.json({ error: 'Claude agents are not enabled' }, 503);
        }

        const existingMappings = await db
          .select()
          .from(merchantMemory)
          .where(eq(merchantMemory.userId, userId))
          .all();

        const result = await orchestrator.invoke('merchant_intelligence', {
          merchants: descriptions.map((desc: string, i: number) => ({
            transactionId: i,
            description: desc,
            amount: 0,
          })),
          existingMappings: existingMappings.map((m: Record<string, unknown>) => ({
            pattern: m.merchantPattern,
            displayName: m.merchantDisplayName || m.merchantPattern,
            gstRegistered: m.gstApplicable || false,
            category: m.category,
          })),
        });

        return c.json({
          message: `Resolved ${result.results.length} merchants`,
          results: result.results,
          newMappings: result.newMappings,
        });
      } catch (err) {
        console.error('Merchant batch-resolve failed:', err);
        return c.json({ error: 'Merchant batch resolution failed' }, 500);
      }
    },
  );
}
