import type { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { orchestrator } from '../../services/claude/orchestrator.js';
import { logger } from '../../lib/logger.js';
import { ensureEnabled } from './helpers.js';
import { financialPlanSchema } from './schemas.js';

export function registerFinancialRoute(app: Hono): void {
  app.post('/agents/financial-plan', zValidator('json', financialPlanSchema), async (c) => {
    const check = ensureEnabled('financial_planner');
    if (!check.ok) return c.json(check.body, check.status as 503);

    const data = c.req.valid('json');
    const startTime = Date.now();
    logger.info('[Agent Route] financial_planner invoked');

    try {
      const result = await orchestrator.invoke('financial_planner', {
        userId: data.userId ?? 'anonymous',
        financialYear: data.financialYear ?? '2024-25',
        transactions: data.transactions ?? [],
        riskProfile: data.riskProfile,
        goals: data.goals ?? (data.goal ? [data.goal] : []),
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
