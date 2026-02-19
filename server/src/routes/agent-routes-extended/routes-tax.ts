import type { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { orchestrator } from '../../services/claude/orchestrator.js';
import { logger } from '../../lib/logger.js';
import { ensureEnabled } from './helpers.js';
import { taxStrategySchema, taxClaimsSchema } from './schemas.js';

export function registerTaxRoutes(app: Hono): void {
  app.post('/agents/tax/strategy', zValidator('json', taxStrategySchema), async (c) => {
    const check = ensureEnabled('tax_strategy');
    if (!check.ok) return c.json(check.body, check.status as 503);

    const data = c.req.valid('json');
    const startTime = Date.now();
    logger.info('[Agent Route] tax_strategy invoked');

    try {
      const result = await orchestrator.invoke('tax_strategy', {
        userId: data.userId ?? 'anonymous',
        financialYear: data.financialYear ?? data.taxYear ?? '2024-25',
        entityType: data.entityType ?? 'sole_trader',
        transactions: data.transactions ?? [],
      });
      return c.json({
        success: true,
        agentType: 'tax_strategy',
        result,
        usage: result.usage,
        durationMs: Date.now() - startTime,
      });
    } catch (err) {
      logger.error('[Agent Route] tax_strategy error:', err);
      return c.json(
        {
          success: false,
          agentType: 'tax_strategy',
          error: 'Internal server error. Please try again.',
          durationMs: Date.now() - startTime,
        },
        500,
      );
    }
  });

  app.post('/agents/tax/claims', zValidator('json', taxClaimsSchema), async (c) => {
    const check = ensureEnabled('personal_tax_claims');
    if (!check.ok) return c.json(check.body, check.status as 503);

    const data = c.req.valid('json');
    const startTime = Date.now();
    logger.info('[Agent Route] personal_tax_claims invoked');

    try {
      const result = await orchestrator.invoke('personal_tax_claims', {
        userId: data.userId ?? 'anonymous',
        financialYear: data.financialYear ?? data.taxYear ?? '2024-25',
        transactions: data.transactions ?? [],
        occupation: data.occupation,
        hasHomeOffice: data.hasHomeOffice,
        motorVehicleKm: data.motorVehicleKm,
      });
      return c.json({
        success: true,
        agentType: 'personal_tax_claims',
        result,
        usage: result.usage,
        durationMs: Date.now() - startTime,
      });
    } catch (err) {
      logger.error('[Agent Route] personal_tax_claims error:', err);
      return c.json(
        {
          success: false,
          agentType: 'personal_tax_claims',
          error: 'Internal server error. Please try again.',
          durationMs: Date.now() - startTime,
        },
        500,
      );
    }
  });
}
