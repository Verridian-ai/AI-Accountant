import type { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, transactions } from '../../schema.js';
import { and, eq } from 'drizzle-orm';
import { enrichmentService } from '../../services/enrichment.js';
import { BASService } from '../../services/bas.js';
import { events } from '../../events.js';

const enrichmentBatchSchema = z.object({
  transactionIds: z.array(z.string()).min(1),
});

const basService = new BASService();

export function registerEnrichmentHandlers(app: Hono): void {
  /**
   * POST /api/enrichment/run
   * Trigger batch enrichment for uncategorized transactions.
   */
  app.post('/enrichment/run', async (c) => {
    try {
      const payload = c.get('jwtPayload');
      const userId = payload.userId;

      const result = await enrichmentService.enrichUncategorized(userId);
      events.emit('update', { type: 'transactions_updated' });

      return c.json({ message: 'Enrichment complete', ...result });
    } catch (err) {
      console.error('Enrichment failed:', err);
      return c.json({ error: 'Enrichment failed' }, 500);
    }
  });

  /**
   * POST /api/enrichment/batch
   * Enrich specific transaction IDs.
   */
  app.post('/enrichment/batch', zValidator('json', enrichmentBatchSchema), async (c) => {
    try {
      const payload = c.get('jwtPayload');
      const userId = payload.userId;
      const { transactionIds } = c.req.valid('json');

      const result = await enrichmentService.enrichTransactions(transactionIds, userId);
      events.emit('update', { type: 'transactions_updated' });

      return c.json({ message: `Enriched ${result.enriched} transactions`, ...result });
    } catch (err) {
      console.error('Batch enrichment failed:', err);
      return c.json({ error: 'Batch enrichment failed' }, 500);
    }
  });

  /**
   * POST /api/enrichment/transaction/:id
   * Enrich a single transaction by ID.
   */
  app.post('/enrichment/transaction/:id', async (c) => {
    try {
      const payload = c.get('jwtPayload');
      const userId = payload.userId;
      const transactionId = c.req.param('id');

      const [tx] = await db
        .select()
        .from(transactions)
        .where(and(eq(transactions.id, transactionId), eq(transactions.userId, userId)))
        .all();

      if (!tx) {
        return c.json({ error: 'Transaction not found' }, 404);
      }

      const result = await enrichmentService.enrichTransactions([transactionId], userId);
      events.emit('update', { type: 'transactions_updated' });

      return c.json({ message: 'Transaction enriched', transactionId, ...result });
    } catch (err) {
      console.error('Single transaction enrichment failed:', err);
      return c.json({ error: 'Transaction enrichment failed' }, 500);
    }
  });

  /**
   * GET /api/bas/prefill?period=YYYY-QN
   * Get BAS pre-fill data for a quarter.
   */
  app.get('/bas/prefill', async (c) => {
    try {
      const payload = c.get('jwtPayload');
      const userId = payload.userId;
      const period = c.req.query('period');

      if (!period) {
        return c.json({ error: 'period query parameter is required (format: YYYY-QN)' }, 400);
      }

      const match = period.match(/^(\d{4})-Q([1-4])$/);
      if (!match) {
        return c.json({ error: 'Invalid period format. Use YYYY-Q1, YYYY-Q2, etc.' }, 400);
      }

      const year = parseInt(match[1], 10);
      const quarter = parseInt(match[2], 10);
      const financialYear = `${year}-${(year + 1).toString().slice(2)}`;

      const result = await basService.calculateBAS(userId, financialYear, quarter, 'cash');

      const g5 = result.labels.G2 + result.labels.G3;
      const g6 = result.labels.G1 - g5;

      return c.json({
        period: `${financialYear}-Q${quarter}`,
        startDate: result.period.startDate,
        endDate: result.period.endDate,
        lodgementDue: result.period.lodgementDue,
        labels: {
          G1: result.labels.G1,
          G2: result.labels.G2,
          G3: result.labels.G3,
          G5: g5,
          G6: g6,
          G9: result.labels['1A'],
          G10: result.labels.G10,
          G11: result.labels.G11,
          G12: result.labels.G10 + result.labels.G11,
          G19: result.labels['1B'],
          G20: result.labels['1A'] - result.labels['1B'],
          '1A': result.labels['1A'],
          '1B': result.labels['1B'],
          W1: result.labels.W1,
          W2: result.labels.W2,
          '5A': result.labels['5A'],
          '7C': result.labels['7C'],
          '7D': result.labels['7D'],
        },
        netGst: result.netGst,
        totalPayable: result.totalPayable,
        isRefund: result.isRefund,
        transactionCount: result.transactionCount,
      });
    } catch (err) {
      console.error('BAS prefill failed:', err);
      return c.json({ error: 'BAS prefill calculation failed' }, 500);
    }
  });
}
