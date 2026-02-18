import type { Hono } from 'hono';
import { orchestrator } from '../../services/claude/orchestrator.js';
import { logger } from '../../lib/logger.js';
import { ensureEnabled, parseBody } from './helpers.js';
import { payrollSchema } from './schemas.js';

export function registerPayrollRoute(app: Hono): void {
  app.post('/agents/payroll/calculate', async (c) => {
    const check = ensureEnabled('payroll_agent');
    if (!check.ok) return c.json(check.body, check.status as 503);

    const body = parseBody(payrollSchema, await c.req.json());
    if (!body.ok) return c.json(body.body, body.status as 400);

    const startTime = Date.now();
    logger.info('[Agent Route] payroll_agent invoked');

    try {
      const result = await orchestrator.invoke('payroll_agent', {
        transactions: body.data.transactions ?? [],
        userId: body.data.userId ?? 'anonymous',
        financialYear: body.data.financialYear,
        quarter: body.data.quarter,
      });
      return c.json({
        success: true,
        agentType: 'payroll_agent',
        result,
        usage: result.usage,
        durationMs: Date.now() - startTime,
      });
    } catch (err) {
      logger.error('[Agent Route] payroll_agent error:', err);
      return c.json(
        {
          success: false,
          agentType: 'payroll_agent',
          error: err instanceof Error ? err.message : String(err),
          durationMs: Date.now() - startTime,
        },
        500,
      );
    }
  });
}
