import type { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { orchestrator } from '../../services/claude/orchestrator.js';
import { logger } from '../../lib/logger.js';
import { ensureEnabled } from './helpers.js';
import { parseSchema } from './schemas.js';

export function registerParseRoute(app: Hono): void {
  app.post('/agents/parse', zValidator('json', parseSchema), async (c) => {
    const check = ensureEnabled('statement_parser');
    if (!check.ok) return c.json(check.body, check.status as 503);

    const data = c.req.valid('json');
    const startTime = Date.now();
    logger.info('[Agent Route] statement_parser invoked');

    try {
      const result = await orchestrator.invoke('statement_parser', {
        statementId: data.statementId ?? 0,
        extractedText: data.extractedText ?? '',
        fileName: data.fileName ?? 'unknown',
      });
      return c.json({
        success: true,
        agentType: 'statement_parser',
        result,
        usage: result.usage,
        durationMs: Date.now() - startTime,
      });
    } catch (err) {
      logger.error('[Agent Route] statement_parser error:', err);
      return c.json(
        {
          success: false,
          agentType: 'statement_parser',
          error: 'Internal server error. Please try again.',
          durationMs: Date.now() - startTime,
        },
        500,
      );
    }
  });
}
