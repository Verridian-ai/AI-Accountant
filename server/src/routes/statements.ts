import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
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
    console.error('[Statements] Get statements failed:', err);
    return c.json(
      { error: 'Internal server error. Please try again.', code: 'GET_STATEMENTS_FAILED' },
      500,
    );
  }
});

// File validation constants
const MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.csv', '.xls', '.xlsx', '.ofx', '.qfx', '.qif']);
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'text/csv',
  'text/plain',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/x-ofx',
  'application/x-qfx',
  'application/x-qif',
  'application/octet-stream', // generic fallback — validated by extension
]);

// Authenticated Upload
statementRoutes.post('/upload', async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body['file'];
    if (!file || !(file instanceof File))
      return c.json({ error: 'No file provided', code: 'NO_FILE' }, 400);

    // Validate file size
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      return c.json(
        {
          error: `File too large. Maximum size is ${MAX_UPLOAD_SIZE_BYTES / 1024 / 1024}MB.`,
          code: 'FILE_TOO_LARGE',
        },
        400,
      );
    }

    // Validate file extension
    const ext = (file.name.match(/\.[^.]+$/)?.[0] ?? '').toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return c.json(
        {
          error: `Unsupported file type "${ext}". Accepted: ${[...ALLOWED_EXTENSIONS].join(', ')}`,
          code: 'INVALID_FILE_TYPE',
        },
        400,
      );
    }

    // Validate MIME type (allow generic octet-stream if extension is valid)
    if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
      return c.json(
        { error: `Unsupported MIME type "${file.type}".`, code: 'INVALID_MIME_TYPE' },
        400,
      );
    }

    const result = await statementService.upload(getUserId(c), file);
    return c.json(result);
  } catch (err) {
    console.error('[Statements] Upload failed:', err);
    return c.json(
      { error: 'Internal server error. Please try again.', code: 'UPLOAD_FAILED' },
      500,
    );
  }
});

// Reprocess
statementRoutes.post('/:id/reprocess', zValidator('json', z.object({}).optional()), async (c) => {
  try {
    const result = await statementService.reprocess(getUserId(c), c.req.param('id'));
    return c.json(result);
  } catch (err) {
    console.error('[Statements] Reprocess failed:', err);
    return c.json(
      { error: 'Internal server error. Please try again.', code: 'REPROCESS_FAILED' },
      500,
    );
  }
});

// Gap Analysis
statementRoutes.get('/gap-analysis', async (c) => {
  try {
    return c.json(await statementService.getGapAnalysis(getUserId(c)));
  } catch (err) {
    console.error('[Statements] Gap analysis failed:', err);
    return c.json(
      { error: 'Internal server error. Please try again.', code: 'GAP_ANALYSIS_FAILED' },
      500,
    );
  }
});

export default statementRoutes;
