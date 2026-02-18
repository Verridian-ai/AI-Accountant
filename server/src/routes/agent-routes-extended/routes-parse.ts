import type { Hono } from 'hono';
import { orchestrator } from '../../services/claude/orchestrator.js';
import { logger } from '../../lib/logger.js';
import { ensureEnabled, parseBody } from './helpers.js';
import { parseSchema } from './schemas.js';

export function registerParseRoute(app: Hono): void {
  app.post('/agents/parse', async (c) => {
    const check = ensureEnabled('statement_parser');
    if (!check.ok) return c.json(check.body, check.status as 503);

    const body = parseBody(parseSchema, await c.req.json());
    if (!body.ok) return c.json(body.body, body.status as 400);

    const startTime = Date.now();
    logger.info('[Agent Route] statement_parser invoked');

    try {
      const result = await orchestrator.invoke('statement_parser', {
        statementId: body.data.statementId ?? 0,
        extractedText: body.data.extractedText ?? '',
        fileName: body.data.fileName ?? 'unknown',
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
          error: err instanceof Error ? err.message : String(err),
          durationMs: Date.now() - startTime,
        },
        500,
      );
    }
  });
}
