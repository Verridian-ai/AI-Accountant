import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db, cogneeUserAccounts } from '../schema.js';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { cogneeClient } from '../services/cognee_client.js';
import { cogneeSessionService } from '../services/cognee-sessions.js';
import { tenantAuthMiddleware } from '../services/auth-middleware.js';
import { triggerMemifyEnrichment } from '../services/cognee/memify-rules.js';

const cogneeRoutes = new Hono();

// Apply tenant auth to all routes - requires valid JWT + X-Tenant-Id + tenant membership
cogneeRoutes.use('/*', tenantAuthMiddleware());

const initCogneeUserSchema = z.object({ userId: z.string().min(1), email: z.string().email().optional() });
const reindexSchema = z.object({ userId: z.string().min(1), datasets: z.array(z.string()).optional() });
const memifyTriggerSchema = z.object({ datasets: z.array(z.string()).min(1) });

cogneeRoutes.post('/init-user', zValidator('json', initCogneeUserSchema), async (c) => {
  const { userId, email } = c.req.valid('json');
  const existing = await db.select().from(cogneeUserAccounts).where(eq(cogneeUserAccounts.userId, userId)).limit(1).all();
  if (existing.length > 0) return c.json({ message: 'Exists', account: existing[0] });
  const cogneeEmail = email || `user_${userId}@goldledger.app`;
  const result = await cogneeClient.createCogneeUser(cogneeEmail, crypto.randomUUID());
  await (db.insert(cogneeUserAccounts).values({ id: crypto.randomUUID(), userId, cogneeEmail, cogneeRefreshToken: result.refreshToken, cogneeUserId: result.userId, datasetPrefix: `user_${userId}`, isActive: true, createdAt: new Date().toISOString() }) as any).run(); // eslint-disable-line @typescript-eslint/no-explicit-any
  if (result.userId && result.refreshToken) await cogneeClient.setupUserAuth(userId, result.refreshToken);
  return c.json({ message: 'Initialized' }, 201);
});

cogneeRoutes.post('/reindex', zValidator('json', reindexSchema), async (c) => {
  const { userId, datasets } = c.req.valid('json');
  // Best-effort cognify
  await cogneeClient.cognify(datasets || [], true, userId);
  return c.json({ status: 'ok' });
});

cogneeRoutes.get('/session', async (c) => {
  const userId = c.get('jwtPayload').userId;
  const account = await db.select().from(cogneeUserAccounts).where(eq(cogneeUserAccounts.userId, userId)).limit(1).all();
  const datasetPrefix = account.length > 0 ? (account[0].datasetPrefix || `user_${userId}`) : `user_${userId}`;
  return c.json(await cogneeSessionService.getOrCreateCogneeSession(userId, { sessionType: 'chat', datasetPrefix }));
});

cogneeRoutes.get('/graph/:userId', async (c) => {
  const userId = c.req.param('userId');
  const account = await db.select().from(cogneeUserAccounts).where(eq(cogneeUserAccounts.userId, userId)).limit(1).all();
  if (account.length === 0) return c.json({ error: 'Not init' }, 404);
  const allDatasets = await cogneeClient.listDatasets(userId);
  return c.json({ userId, datasets: allDatasets });
});

cogneeRoutes.post('/memify/trigger', zValidator('json', memifyTriggerSchema), async (c) => {
  const { datasets } = c.req.valid('json');
  const userId = c.get('jwtPayload')?.userId;
  const tenantId = c.get('jwtPayload')?.tenantId;
  await triggerMemifyEnrichment(datasets, userId, tenantId);
  return c.json({ status: 'triggered', datasets, background: true });
});

export default cogneeRoutes;