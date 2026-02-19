import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import { ragService } from '../services/rag.js';
import { adminAuthMiddleware } from '../services/admin-auth/index.js';
import { logger } from '../lib/logger.js';
import { getProductionPool, isMaskedBranchActive, neonHealthCheck } from '../db/neon-connection.js';

const adminExtRoutes = new Hono();

// Require valid admin JWT for all routes in this file
adminExtRoutes.use('/*', adminAuthMiddleware());

const ingestKnowledgeSchema = z.object({
  datasetName: z.string().optional(),
});

// POST /api/admin/ingest-knowledge — Ingest markdown docs into Cognee
adminExtRoutes.post(
  '/admin/ingest-knowledge',
  zValidator('json', ingestKnowledgeSchema),
  async (c) => {
    try {
      const { datasetName } = c.req.valid('json');
      const targetDataset = datasetName || 'production_handbooks';

      const knowledgeDir = path.resolve(process.cwd(), 'knowledge');

      if (!fs.existsSync(knowledgeDir)) {
        return c.json({ error: 'Knowledge directory not found' }, 404);
      }

      const files = fs.readdirSync(knowledgeDir);
      const documents: string[] = [];

      for (const file of files) {
        if (file.endsWith('.md')) {
          const filePath = path.join(knowledgeDir, file);
          const content = fs.readFileSync(filePath, 'utf-8');
          documents.push(`Source: ${file}\nContent:\n${content}`);
        }
      }

      if (documents.length === 0) {
        return c.json({ message: 'No markdown files found to ingest' });
      }

      const result = await ragService.addDocuments(documents, targetDataset);
      return c.json(result);
    } catch (err) {
      logger.error('Ingestion failed:', err);
      return c.json({ error: 'Ingestion failed' }, 500);
    }
  },
);

// GET /api/admin/pool-stats — Connection pool utilization metrics (TASK-049)
adminExtRoutes.get('/admin/pool-stats', async (c) => {
  try {
    const prodPool = getProductionPool();
    const prodStats = {
      totalCount: prodPool.totalCount,
      idleCount: prodPool.idleCount,
      waitingCount: prodPool.waitingCount,
      status: prodPool.totalCount > 0 ? 'healthy' : 'initializing',
    };

    const maskedActive = isMaskedBranchActive();
    const health = await neonHealthCheck();

    return c.json({
      production: prodStats,
      masked: {
        active: maskedActive,
        totalCount: health.masked.poolStats?.totalCount ?? 0,
        idleCount: health.masked.poolStats?.idleCount ?? 0,
        waitingCount: health.masked.poolStats?.waitingCount ?? 0,
        status: maskedActive ? health.masked.status : 'fallback_to_production',
      },
      overall: health.production.status,
      useNeon: health.useNeon,
      maskedBranchConfigured: health.maskedBranchConfigured,
      checkedAt: new Date().toISOString(),
    });
  } catch {
    return c.json({ error: 'Failed to retrieve pool stats' }, 500);
  }
});

export default adminExtRoutes;
