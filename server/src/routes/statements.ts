import { Hono } from 'hono';
import { z } from 'zod';
import { statementService } from '../services/statements/statement-service.js';
import { tenantAuthMiddleware } from '../services/auth-middleware.js';
import { getUserId } from '../utils/auth-helpers.js';

// Upload uses multipart/form-data — no JSON body; reprocess takes no body
const _statementReprocessShape = z.object({ force: z.boolean().optional() });

const statementRoutes = new Hono();

// Apply tenant auth to all routes - requires valid JWT + X-Tenant-Id + tenant membership
statementRoutes.use('/*', tenantAuthMiddleware());

// Get all statements
statementRoutes.get('/', async (c) => {
  try {
    return c.json(await statementService.getAll(getUserId(c)));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get statements';
    return c.json({ error: message, code: 'GET_STATEMENTS_FAILED' }, 500);
  }
});

// Authenticated Upload
statementRoutes.post('/upload', async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body['file'];
    if (!file || !(file instanceof File))
      return c.json({ error: 'No file provided', code: 'NO_FILE' }, 400);
    const result = await statementService.upload(getUserId(c), file);
    return c.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    return c.json({ error: message, code: 'UPLOAD_FAILED' }, 500);
  }
});

// Reprocess
statementRoutes.post('/:id/reprocess', async (c) => {
  try {
    const result = await statementService.reprocess(getUserId(c), c.req.param('id'));
    return c.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Reprocess failed';
    return c.json({ error: message, code: 'REPROCESS_FAILED' }, 500);
  }
});

// Gap Analysis
statementRoutes.get('/gap-analysis', async (c) => {
  try {
    return c.json(await statementService.getGapAnalysis(getUserId(c)));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get gap analysis';
    return c.json({ error: message, code: 'GAP_ANALYSIS_FAILED' }, 500);
  }
});

export default statementRoutes;
