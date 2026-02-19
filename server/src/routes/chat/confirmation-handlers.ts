import type { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { getErrorMessage } from '../../utils/error.js';
import type { AgentType } from '../../services/claude/types.js';
import { confirmationFlow, auditService } from './services.js';
import { actionReasonSchema } from './helpers.js';

export function registerConfirmationHandlers(app: Hono): void {
  // POST /api/chat/confirm/:actionId
  app.post('/confirm/:actionId', zValidator('json', actionReasonSchema), async (c) => {
    try {
      const actionId = c.req.param('actionId');
      const { reason } = c.req.valid('json');
      const userId = 'default';
      const mutation = await confirmationFlow.confirm(actionId, userId, reason);
      await auditService
        .logMutationConfirmed(actionId, mutation.sessionId, mutation.agentType as AgentType, userId)
        .catch((err: unknown) => console.warn('[Audit] Log confirm failed:', err));
      return c.json({ success: true, mutation });
    } catch (err) {
      const message = err instanceof Error ? getErrorMessage(err) : 'Confirmation failed';
      return c.json({ error: message, code: 400 }, 400);
    }
  });

  // POST /api/chat/reject/:actionId
  app.post('/reject/:actionId', zValidator('json', actionReasonSchema), async (c) => {
    try {
      const actionId = c.req.param('actionId');
      const { reason } = c.req.valid('json');
      const userId = 'default';
      const mutation = await confirmationFlow.reject(actionId, userId, reason);
      await auditService
        .logMutationRejected(
          actionId,
          mutation.sessionId,
          mutation.agentType as AgentType,
          reason,
          userId,
        )
        .catch((err: unknown) => console.warn('[Audit] Log reject failed:', err));
      return c.json({ success: true, mutation });
    } catch (err) {
      const message = err instanceof Error ? getErrorMessage(err) : 'Rejection failed';
      return c.json({ error: message, code: 400 }, 400);
    }
  });

  // GET /api/chat/pending
  app.get('/pending', async (c) => {
    try {
      const sessionId = c.req.query('sessionId');
      if (!sessionId) return c.json({ error: 'sessionId query param required', code: 400 }, 400);
      const mutations = await confirmationFlow.getPendingMutations(sessionId);
      return c.json({ mutations });
    } catch (err) {
      console.error('[Chat/Pending Error]', err);
      return c.json({ error: 'Failed to fetch pending mutations', code: 500 }, 500);
    }
  });

  // GET /api/chat/history
  app.get('/history', async (c) => {
    try {
      const sessionId = c.req.query('sessionId');
      const limit = parseInt(c.req.query('limit') ?? '50', 10);
      const userId = 'default';
      if (sessionId) {
        const session = await confirmationFlow.getSession(sessionId);
        return c.json({ sessions: session ? [session] : [], total: session ? 1 : 0 });
      }
      const result = await confirmationFlow.getSessionHistory({ userId, limit });
      return c.json(result);
    } catch (err) {
      console.error('[Chat/History Error]', err);
      return c.json({ error: 'Failed to fetch session history', code: 500 }, 500);
    }
  });
}
