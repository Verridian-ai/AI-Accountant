import type { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { orchestrator } from '../../services/claude/orchestrator.js';
import { logger } from '../../lib/logger.js';
import { ensureEnabled } from './helpers.js';
import { categorizeSchema } from './schemas.js';

export function registerCategorizeRoute(app: Hono): void {
  app.post('/agents/categorize', zValidator('json', categorizeSchema), async (c) => {
    const check = ensureEnabled('transaction_categorizer');
    if (!check.ok) return c.json(check.body, check.status as 503);

    const data = c.req.valid('json');
    const startTime = Date.now();
    logger.info('[Agent Route] transaction_categorizer invoked');

    try {
      const txs = (data.transactions ?? []).map((tx) => ({
        ...tx,
        accountId: tx.accountId ?? 0,
        bankId: (tx.bankId ?? 'cba') as import('../../services/parsers/types.js').BankId,
      }));
      const result = await orchestrator.invoke('transaction_categorizer', {
        transactions: txs,
        existingMerchantMemory: [],
      });
      return c.json({
        success: true,
        agentType: 'transaction_categorizer',
        result,
        usage: result.usage,
        durationMs: Date.now() - startTime,
      });
    } catch (err) {
      logger.error('[Agent Route] transaction_categorizer error:', err);
      return c.json(
        {
          success: false,
          agentType: 'transaction_categorizer',
          error: err instanceof Error ? err.message : String(err),
          durationMs: Date.now() - startTime,
        },
        500,
      );
    }
  });
}
