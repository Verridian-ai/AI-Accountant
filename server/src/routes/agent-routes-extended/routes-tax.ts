import type { Hono } from 'hono';
import { orchestrator } from '../../services/claude/orchestrator.js';
import { logger } from '../../lib/logger.js';
import { ensureEnabled, parseBody } from './helpers.js';
import { taxStrategySchema, taxClaimsSchema } from './schemas.js';

export function registerTaxRoutes(app: Hono): void {
  app.post('/agents/tax/strategy', async (c) => {
    const check = ensureEnabled('tax_strategy');
    if (!check.ok) return c.json(check.body, check.status as 503);

    const body = parseBody(taxStrategySchema, await c.req.json());
    if (!body.ok) return c.json(body.body, body.status as 400);

    const startTime = Date.now();
    logger.info('[Agent Route] tax_strategy invoked');

    try {
      const result = await orchestrator.invoke('tax_strategy', {
        userId: body.data.userId ?? 'anonymous',
        financialYear: body.data.financialYear ?? body.data.taxYear ?? '2024-25',
        entityType: body.data.entityType ?? 'sole_trader',
        transactions: body.data.transactions ?? [],
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
          error: err instanceof Error ? err.message : String(err),
          durationMs: Date.now() - startTime,
        },
        500,
      );
    }
  });

  app.post('/agents/tax/claims', async (c) => {
    const check = ensureEnabled('personal_tax_claims');
    if (!check.ok) return c.json(check.body, check.status as 503);

    const body = parseBody(taxClaimsSchema, await c.req.json());
    if (!body.ok) return c.json(body.body, body.status as 400);

    const startTime = Date.now();
    logger.info('[Agent Route] personal_tax_claims invoked');

    try {
      const result = await orchestrator.invoke('personal_tax_claims', {
        userId: body.data.userId ?? 'anonymous',
        financialYear: body.data.financialYear ?? body.data.taxYear ?? '2024-25',
        transactions: body.data.transactions ?? [],
        occupation: body.data.occupation,
        hasHomeOffice: body.data.hasHomeOffice,
        motorVehicleKm: body.data.motorVehicleKm,
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
          error: err instanceof Error ? err.message : String(err),
          durationMs: Date.now() - startTime,
        },
        500,
      );
    }
  });
}
