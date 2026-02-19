import type { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { orchestrator } from '../../services/claude/orchestrator.js';
import { logger } from '../../lib/logger.js';
import { ensureEnabled } from './helpers.js';
import { merchantIntelSchema } from './schemas.js';

export function registerMerchantRoute(app: Hono): void {
  app.post('/agents/merchant-intel', zValidator('json', merchantIntelSchema), async (c) => {
    const check = ensureEnabled('merchant_intelligence');
    if (!check.ok) return c.json(check.body, check.status as 503);

    const data = c.req.valid('json');
    const startTime = Date.now();
    logger.info('[Agent Route] merchant_intelligence invoked');

    try {
      const merchants = data.merchants ?? [
        {
          transactionId: data.transactionId ?? 0,
          description: data.merchantName,
          amount: 0,
        },
      ];
      const result = await orchestrator.invoke('merchant_intelligence', {
        merchants,
        existingMappings: [],
      });
      return c.json({
        success: true,
        agentType: 'merchant_intelligence',
        result,
        usage: result.usage,
        durationMs: Date.now() - startTime,
      });
    } catch (err) {
      logger.error('[Agent Route] merchant_intelligence error:', err);
      return c.json(
        {
          success: false,
          agentType: 'merchant_intelligence',
          error: 'Internal server error. Please try again.',
          durationMs: Date.now() - startTime,
        },
        500,
      );
    }
  });
}
