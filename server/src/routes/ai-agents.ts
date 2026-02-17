import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db, transactions } from '../schema.js';
import { eq, desc } from 'drizzle-orm';
import { agentService } from '../services/agents.js';
import { getVertexAIClient, VERTEX_AI_MODELS, FINTECH_MODEL_PRESETS } from '../services/vertex-ai.js';
import { tenantAuthMiddleware } from '../services/auth-middleware.js';

const runAgentSchema = z.object({
  query: z.string().min(1),
});

const agentRoutes = new Hono();

// Apply tenant auth to all routes - requires valid JWT + X-Tenant-Id + tenant membership
agentRoutes.use('/*', tenantAuthMiddleware());

agentRoutes.get('/vertex-ai/models', (c) => {
  return c.json({ models: VERTEX_AI_MODELS, presets: FINTECH_MODEL_PRESETS });
});

agentRoutes.get('/vertex-ai/test', async (c) => {
  return c.json(await getVertexAIClient().testConnection());
});

agentRoutes.get('/', async (c) => {
  return c.json(await agentService.getAgentInfo());
});

agentRoutes.get('/:type', async (c) => {
  return c.json(await agentService.getAgentInfo(c.req.param('type') as import('../services/agents.js').PythonAgentType));
});

agentRoutes.post('/:type/run', zValidator('json', runAgentSchema), async (c) => {
  const payload = c.get('jwtPayload');
  const agentType = c.req.param('type') as import('../services/agents.js').PythonAgentType;
  const { query } = c.req.valid('json');
  const txs = await db.select().from(transactions).where(eq(transactions.userId, payload.userId)).orderBy(desc(transactions.date));
  const result = await agentService.runAgent(agentType, query, { transactions: txs });
  return c.json(result);
});

export default agentRoutes;
