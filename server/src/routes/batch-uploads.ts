import { Hono } from 'hono';
import { z } from 'zod';
import { bulkUploadQueue } from '../services/queue.js';
import { tenantAuthMiddleware } from '../services/auth-middleware.js';
import { getUserId } from '../utils/auth-helpers.js';

// batch-uploads uses multipart/form-data, not JSON — z import for type definitions
const _batchOptionsSchema = z.object({
  priority: z.enum(['high', 'normal', 'low']).optional(),
});

const batchRoutes = new Hono();

// Apply tenant auth to all routes - requires valid JWT + X-Tenant-Id + tenant membership
batchRoutes.use('/*', tenantAuthMiddleware());

// Batch Upload
batchRoutes.post('/', async (c) => {
  const body = await c.req.parseBody({ all: true });
  const files = body['files'];
  if (!files) return c.json({ error: 'No files' }, 400);
  const fileArray = Array.isArray(files) ? files : [files];
  const validFiles = fileArray.filter((f): f is File => f instanceof File);
  if (validFiles.length === 0) return c.json({ error: 'No valid files' }, 400);
  const fileInfos = await Promise.all(
    validFiles.map(async (file) => ({
      name: file.name,
      size: file.size,
      type: file.type,
      buffer: Buffer.from(await file.arrayBuffer()),
    })),
  );
  const job = await bulkUploadQueue.addJob(fileInfos, getUserId(c), {
    priority: validFiles.length > 10 ? 'normal' : 'high',
  });
  return c.json({ message: 'Queued', jobId: job.id, fileCount: validFiles.length });
});

// Job Status
batchRoutes.get('/:jobId', async (c) => {
  const job = bulkUploadQueue.getJobStatus(c.req.param('jobId'));
  if (!job) return c.json({ error: 'Not found' }, 404);
  return c.json(job);
});

// Cancel/Retry
batchRoutes.post('/:jobId/cancel', async (c) => {
  return c.json({ cancelled: await bulkUploadQueue.cancelJob(c.req.param('jobId')) });
});

batchRoutes.post('/:jobId/retry', async (c) => {
  return c.json({ retried: await bulkUploadQueue.retryJob(c.req.param('jobId')) });
});

// Queue Stats
batchRoutes.get('/queue/stats', async (c) => {
  return c.json(bulkUploadQueue.getStats());
});

export default batchRoutes;
