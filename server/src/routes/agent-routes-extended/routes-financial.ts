import type { Hono } from 'hono';
import { orchestrator } from '../../services/claude/orchestrator.js';
import { logger } from '../../lib/logger.js';
import { ensureEnabled, parseBody } from './helpers.js';
import { financialPlanSchema } from './schemas.js';

export function registerFinancialRoute(app: Hono): void {
  app.post('/agents/financial-plan', async (c) => {
    const check = ensureEnabled('financial_planner');
    if (!check.ok) return c.json(check.body, check.status as 503);

    const body = parseBody(financialPlanSchema, await c.req.json());
    if (!body.ok) return c.json(body.body, body.status as 400);

    const startTime = Date.now();
    logger.info('[Agent Route] financial_planner invoked');

    try {
      const result = await orchestrator.invoke('financial_planner', {
        userId: body.data.userId ?? 'anonymous',
        financialYear: body.data.financialYear ?? '2024-25',
        transactions: body.data.transactions ?? [],
        riskProfile: body.data.riskProfile,
        goals: body.data.goals ?? (body.data.goal ? [body.data.goal] : []),
      });
      return c.json({
        success: true,
        agentType: 'financial_planner',
        result,
        usage: result.usage,
        durationMs: Date.now() - startTime,
      });
    } catch (err) {
      logger.error('[Agent Route] financial_planner error:', err);
      return c.json(
        {
          success: false,
          agentType: 'financial_planner',
          error: err instanceof Error ? err.message : String(err),
          durationMs: Date.now() - startTime,
        },
        500,
      );
    }
  });
}
