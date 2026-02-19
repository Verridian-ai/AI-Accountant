import type { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { orchestrator } from '../../services/claude/orchestrator.js';
import { logger } from '../../lib/logger.js';
import { ensureEnabled } from './helpers.js';
import { payrollSchema } from './schemas.js';

export function registerPayrollRoute(app: Hono): void {
  app.post('/agents/payroll/calculate', zValidator('json', payrollSchema), async (c) => {
    const check = ensureEnabled('payroll_agent');
    if (!check.ok) return c.json(check.body, check.status as 503);

    const data = c.req.valid('json');
    const startTime = Date.now();
    logger.info('[Agent Route] payroll_agent invoked');

    try {
      const result = await orchestrator.invoke('payroll_agent', {
        transactions: data.transactions ?? [],
        userId: data.userId ?? 'anonymous',
        financialYear: data.financialYear,
        quarter: data.quarter,
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
          error: 'Internal server error. Please try again.',
          durationMs: Date.now() - startTime,
        },
        500,
      );
    }
  });
}
