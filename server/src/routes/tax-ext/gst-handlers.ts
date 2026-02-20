import type { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, transactions } from '../../schema.js';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { getQuarterDates } from '../../services/bas.js';
import { events } from '../../events.js';
import { resolvePeriod } from './helpers.js';

const categorizeGstSchema = z.object({
  updates: z.array(
    z.object({
      transactionId: z.string(),
      gstCategory: z.string().optional(),
      gstAmount: z.number().optional(),
    }),
  ),
});

const bulkApproveGstSchema = z.object({
  ids: z.array(z.union([z.string(), z.number()])),
});

export function registerGSTHandlers(app: Hono): void {
  // POST /api/transactions/categorize-gst — Batch update GST categories
  app.post('/transactions/categorize-gst', zValidator('json', categorizeGstSchema), async (c) => {
    try {
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
    } catch (err) {
      console.error('GST categorization failed:', err);
      return c.json({ error: 'GST categorization failed' }, 500);
    }
  });

  // POST /api/gst/bulk-approve — Bulk approve GST categories
  app.post('/gst/bulk-approve', zValidator('json', bulkApproveGstSchema), async (c) => {
    try {
      const payload = c.get('jwtPayload');
      const userId = payload.userId;
      const { ids } = c.req.valid('json');

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
  app.get('/gst/input-tax-credits', async (c) => {
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

      const creditsByCategory: Record<string, { gstCredits: number; transactionCount: number }> =
        {};

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
      return c.json(
        { error: 'Internal server error. Please try again.', code: 'INPUT_TAX_CREDITS_FAILED' },
        500,
      );
    }
  });
}
