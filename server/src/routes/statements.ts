import { Hono } from 'hono';
import { statementService } from '../services/statements/statement-service.js';

const statementRoutes = new Hono();

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

  try {
    const result = await statementService.upload(payload.userId, file);
    return c.json(result);
  } catch (error: any) {
    // eslint-disable-line @typescript-eslint/no-explicit-any
    if (error.message.startsWith('Duplicate file')) {
      return c.json({ error: 'Duplicate', id: error.message.split(': ')[1] }, 409);
    }
    return c.json({ error: 'Upload failed' }, 500);
  }
});

// Reprocess
statementRoutes.post('/:id/reprocess', async (c) => {
  const payload = c.get('jwtPayload');
  try {
    const result = await statementService.reprocess(payload.userId, c.req.param('id'));
    return c.json(result);
  } catch (error: any) {
    // eslint-disable-line @typescript-eslint/no-explicit-any
    if (error.message === 'Statement not found') {
      return c.json({ error: 'Not found' }, 404);
    }
    return c.json({ error: 'Reprocessing failed' }, 500);
  }
});

// Gap Analysis
statementRoutes.get('/gap-analysis', async (c) => {
  const payload = c.get('jwtPayload');
  return c.json(await statementService.getGapAnalysis(payload.userId));
});

export default statementRoutes;
