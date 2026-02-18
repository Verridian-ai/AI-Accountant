import type { Hono } from 'hono';
import { orchestrator } from '../../services/claude/orchestrator.js';
import { logger } from '../../lib/logger.js';
import { ensureEnabled, parseBody } from './helpers.js';
import { merchantIntelSchema } from './schemas.js';

export function registerMerchantRoute(app: Hono): void {
  app.post('/agents/merchant-intel', async (c) => {
    const check = ensureEnabled('merchant_intelligence');
    if (!check.ok) return c.json(check.body, check.status as 503);

    const body = parseBody(merchantIntelSchema, await c.req.json());
    if (!body.ok) return c.json(body.body, body.status as 400);

    const startTime = Date.now();
    logger.info('[Agent Route] merchant_intelligence invoked');

    try {
      const merchants = body.data.merchants ?? [
        {
          transactionId: body.data.transactionId ?? 0,
          description: body.data.merchantName,
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
          error: err instanceof Error ? err.message : String(err),
          durationMs: Date.now() - startTime,
        },
        500,
      );
    }
  });
}
