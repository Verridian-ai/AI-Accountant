import type { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { ragService } from '../../services/rag.js';
import { tenantService } from '../../services/tenant.js';
import { budgetService } from '../../services/budgets.js';
import { anomalyDetectionService } from '../../services/anomaly-detection.js';
import path from 'path';
import fs from 'fs';
import {
  acceptInvitationSchema,
  ingestKnowledgeSchema,
  approveReasonSchema,
} from '../../validation/operations.js';

const createBudgetSchema = z.object({
  name: z.string().min(1),
  budgetType: z.enum(['annual', 'quarterly', 'monthly', 'project']),
  periodStart: z.string(),
  periodEnd: z.string(),
  accountId: z.string().optional(),
  autoGenerate: z.boolean().optional(),
  lookbackMonths: z.number().int().min(1).max(60).optional(),
});

export function registerAnalyticsHandlers(app: Hono): void {
  // POST /api/invitations/accept
  app.post('/invitations/accept', zValidator('json', acceptInvitationSchema), async (c) => {
    try {
      const { token, userId: bodyUserId } = c.req.valid('json');
      let userId: string | undefined;
      try {
        const payload = c.get('jwtPayload');
        userId = payload?.userId ?? bodyUserId;
      } catch {
        userId = bodyUserId;
      }
      if (!userId) return c.json({ error: 'userId is required (via auth or body)' }, 400);
      return c.json(await tenantService.acceptInvitation(token, userId));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to accept invitation';
      return c.json({ error: msg }, 400);
    }
  });

  // POST /api/admin/ingest-knowledge
  app.post('/admin/ingest-knowledge', zValidator('json', ingestKnowledgeSchema), async (c) => {
    try {
      const { datasetName } = c.req.valid('json');
      const targetDataset = datasetName || 'production_handbooks';
      const knowledgeDir = path.resolve(process.cwd(), 'knowledge');
      if (!fs.existsSync(knowledgeDir))
        return c.json({ error: 'Knowledge directory not found' }, 404);
      const files = fs.readdirSync(knowledgeDir);
      const documents: string[] = [];
      for (const file of files) {
        if (file.endsWith('.md')) {
          const content = fs.readFileSync(path.join(knowledgeDir, file), 'utf-8');
          documents.push(`Source: ${file}\nContent:\n${content}`);
        }
      }
      if (documents.length === 0) return c.json({ message: 'No markdown files found to ingest' });
      const result = await ragService.addDocuments(documents, targetDataset);
      return c.json(result);
    } catch (err) {
      console.error('Ingestion failed:', err);
      return c.json({ error: 'Ingestion failed' }, 500);
    }
  });

  // GET /api/analytics/budgets
  app.get('/analytics/budgets', async (c) => {
    try {
      const payload = c.get('jwtPayload');
      const status = c.req.query('status');
      const budgets = await budgetService.listBudgets(payload.userId, status);
      return c.json({ data: budgets });
    } catch (err) {
      console.error('[Analytics] Get budgets failed:', err);
      return c.json(
        { error: 'Internal server error. Please try again.', code: 'GET_BUDGETS_FAILED' },
        500,
      );
    }
  });

  // POST /api/analytics/budgets
  app.post('/analytics/budgets', zValidator('json', createBudgetSchema), async (c) => {
    try {
      const payload = c.get('jwtPayload');
      const params = c.req.valid('json');
      const budget = await budgetService.createBudget(payload.userId, params);
      return c.json({ data: budget }, 201);
    } catch (err) {
      console.error('[Analytics] Create budget failed:', err);
      return c.json(
        { error: 'Internal server error. Please try again.', code: 'CREATE_BUDGET_FAILED' },
        500,
      );
    }
  });

  // POST /api/analytics/anomalies/:id/dismiss
  app.post(
    '/analytics/anomalies/:id/dismiss',
    zValidator('json', approveReasonSchema),
    async (c) => {
      try {
        const alertId = c.req.param('id');
        const { reason: bodyReason } = c.req.valid('json');
        const reason = bodyReason ?? 'dismissed';
        await anomalyDetectionService.dismissAlert(alertId, reason);
        return c.json({ data: { success: true, alertId } });
      } catch (err) {
        console.error('[Analytics] Dismiss alert failed:', err);
        return c.json(
          { error: 'Internal server error. Please try again.', code: 'DISMISS_ALERT_FAILED' },
          500,
        );
      }
    },
  );
}
