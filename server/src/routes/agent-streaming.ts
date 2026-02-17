import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db } from '../schema.js';
import { sql } from 'drizzle-orm';

const agentStreamInputSchema = z.record(z.unknown());
import { StreamingService } from '../services/claude/streaming.js';
import { StreamingRegistry } from '../services/streaming-registry.js';
import { sseStreamMiddleware, streamingRateLimiter } from '../services/streaming-middleware.js';
import { SchemaRegistry } from '../services/claude/schemas/schema-registry.js';
import { AuditService } from '../services/claude/audit.js';
import { ConfirmationFlowService } from '../services/claude/confirmation-flow.js';
import type { AgentType } from '../services/claude/types.js';

const streamingRoutes = new Hono();
const streamingService = new StreamingService();
const streamingRegistry = new StreamingRegistry();
const _schemaRegistry = new SchemaRegistry();
const _auditService = new AuditService(db);
const confirmationFlow = new ConfirmationFlowService(db);

streamingRoutes.post('/agent/:agentType', sseStreamMiddleware(), streamingRateLimiter(), zValidator('json', agentStreamInputSchema), async (c) => {
  const agentType = c.req.param('agentType') as AgentType;
  const input = c.req.valid('json');
  const _userId = c.req.query('userId') || 'default';
  const agent = streamingRegistry.getAgent(agentType);
  if (!agent) return c.json({ error: 'Not found' }, 404);
  return streamingService.handleSSE(c, async (writer) => {
    let _fullText = '';
    for await (const chunk of agent.stream(input)) { writer.sendToken(chunk); _fullText += chunk; }
    writer.sendComplete({ agentType, status: 'completed' });
  });
});

streamingRoutes.get('/session/:sessionId', async (c) => {
  const session = await db.get(sql`SELECT * FROM agent_stream_sessions WHERE id = ${c.req.param('sessionId')}`);
  return session ? c.json(session) : c.json({ error: 'Not found' }, 404);
});

// Mutations
streamingRoutes.post('/confirm/:actionId', async (c) => {
  try {
    const mutation = await confirmationFlow.confirm(c.req.param('actionId'), 'default');
    return c.json({ success: true, mutation });
  } catch { return c.json({ error: 'Failed' }, 400); }
});

streamingRoutes.get('/pending', async (c) => {
  return c.json({ mutations: await confirmationFlow.getPendingMutations(c.req.query('sessionId')!) });
});

export default streamingRoutes;
