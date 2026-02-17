import { Hono } from 'hono';
import { z } from 'zod';
import { statementService } from '../services/statements/statement-service.js';
import { tenantAuthMiddleware } from '../services/auth-middleware.js';

// Upload uses multipart/form-data — no JSON body; reprocess takes no body
const _statementReprocessShape = z.object({ force: z.boolean().optional() });

const statementRoutes = new Hono();

// Apply tenant auth to all routes - requires valid JWT + X-Tenant-Id + tenant membership
statementRoutes.use('/*', tenantAuthMiddleware());

// Get all statements
statementRoutes.get('/', async (c) => {
  const payload = c.get('jwtPayload');
  return c.json(await statementService.getAll(payload.userId));
});

// Authenticated Upload

statementRoutes.post('/upload', async (c) => {
  const payload = c.get('jwtPayload');

  const body = await c.req.parseBody();

  const file = body['file'];

  if (!file || !(file instanceof File)) return c.json({ error: 'No file' }, 400);

  const result = await statementService.upload(payload.userId, file);

  return c.json(result);
});

// Reprocess

statementRoutes.post('/:id/reprocess', async (c) => {
  const payload = c.get('jwtPayload');

  const result = await statementService.reprocess(payload.userId, c.req.param('id'));

  return c.json(result);
});

// Gap Analysis
statementRoutes.get('/gap-analysis', async (c) => {
  const payload = c.get('jwtPayload');
  return c.json(await statementService.getGapAnalysis(payload.userId));
});

export default statementRoutes;
