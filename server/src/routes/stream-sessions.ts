import { Hono } from 'hono';
import { db } from '../schema.js';
import { sql } from 'drizzle-orm';
import crypto from 'crypto';
import { getErrorMessage } from '../utils/error.js';
import { sseStreamMiddleware, streamingRateLimiter } from '../services/streaming-middleware.js';
import { streamingRegistry, streamingService } from '../services/singletons.js';
import type { AgentType } from '../services/claude/types.js';

const streamSessionsRoutes = new Hono();

// POST /api/stream/agent/:agentType — Start streaming agent execution
streamSessionsRoutes.post(
  '/agent/:agentType',
  sseStreamMiddleware(),
  streamingRateLimiter(),
  async (c) => {
    try {
      const agentType = c.req.param('agentType');
      const input = await c.req.json();
      const userId = c.req.query('userId') || 'default';

      const agent = streamingRegistry.getAgent(agentType as AgentType);
      if (!agent) {
        return c.json({ error: `Agent ${agentType} not available for streaming` }, 404);
      }

      const sessionId = crypto.randomUUID();
      try {
        await db.run(sql`INSERT INTO agent_stream_sessions (id, agent_type, user_id, session_status, input_payload, model_id, provider, stream_started_at)
              VALUES (${sessionId}, ${agentType}, ${userId}, 'streaming', ${JSON.stringify(input)}, 'auto', 'anthropic', NOW())`);
      } catch {
        // Table may not exist yet — continue without session tracking
      }

      return streamingService.handleSSE(c, async (writer) => {
        const startMs = Date.now();
        try {
          writer.sendAgentSelected(agentType, 1.0);

          let fullText = '';
          for await (const chunk of agent.stream(input)) {
            writer.sendToken(chunk);
            fullText += chunk;
          }

          const latencyMs = Date.now() - startMs;
          writer.sendComplete({ agentType, status: 'completed', latencyMs });

          try {
            await db.run(sql`UPDATE agent_stream_sessions
                      SET session_status = 'completed', output_payload = ${JSON.stringify({ text: fullText })},
                          latency_ms = ${latencyMs}, stream_completed_at = NOW(), updated_at = NOW()
                      WHERE id = ${sessionId}`);
          } catch {
            // Session tracking is best-effort
          }
        } catch (err: unknown) {
          writer.sendError(getErrorMessage(err) || 'Stream failed');
          try {
            await db.run(sql`UPDATE agent_stream_sessions
                      SET session_status = 'failed', error_message = ${getErrorMessage(err) || 'Stream failed'}, updated_at = NOW()
                      WHERE id = ${sessionId}`);
          } catch {
            // Session tracking is best-effort
          }
        }
      });
    } catch (err) {
      console.error('Stream agent failed:', err);
      return c.json({ error: 'Failed to start stream' }, 500);
    }
  },
);

// GET /api/stream/session/:sessionId — Get session status
streamSessionsRoutes.get('/session/:sessionId', async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    const session = await db.get(sql`SELECT id, agent_type as "agentType", user_id as "userId",
          session_status as "sessionStatus", input_payload as "inputPayload", output_payload as "outputPayload",
          token_usage as "tokenUsage", stream_started_at as "streamStartedAt", stream_completed_at as "streamCompletedAt",
          error_message as "errorMessage", model_id as "modelId", provider, latency_ms as "latencyMs",
          created_at as "createdAt", updated_at as "updatedAt"
          FROM agent_stream_sessions WHERE id = ${sessionId}`);
    if (!session) return c.json({ error: 'Session not found' }, 404);
    return c.json(session);
  } catch (err) {
    console.error('Get stream session failed:', err);
    return c.json({ error: 'Failed to get session' }, 500);
  }
});

// GET /api/stream/history — Get user's session history
streamSessionsRoutes.get('/history', async (c) => {
  try {
    const userId = c.req.query('userId') || 'default';
    const limit = parseInt(c.req.query('limit') || '20', 10);
    const offset = parseInt(c.req.query('offset') || '0', 10);

    const sessions = await db.all(sql`SELECT id, agent_type as "agentType", user_id as "userId",
          session_status as "sessionStatus", model_id as "modelId", provider,
          latency_ms as "latencyMs", error_message as "errorMessage",
          stream_started_at as "streamStartedAt", stream_completed_at as "streamCompletedAt",
          created_at as "createdAt"
          FROM agent_stream_sessions
          WHERE user_id = ${userId}
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}`);
    return c.json({ sessions, userId, limit, offset });
  } catch (err) {
    console.error('Get stream history failed:', err);
    return c.json({ sessions: [], userId: 'default', limit: 20, offset: 0 });
  }
});

// DELETE /api/stream/session/:sessionId — Cancel active stream
streamSessionsRoutes.delete('/session/:sessionId', async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    await db.run(sql`UPDATE agent_stream_sessions
          SET session_status = 'cancelled', updated_at = NOW()
          WHERE id = ${sessionId} AND session_status = 'streaming'`);
    return c.json({ success: true, sessionId });
  } catch (err) {
    console.error('Cancel stream session failed:', err);
    return c.json({ error: 'Failed to cancel session' }, 500);
  }
});

export default streamSessionsRoutes;
