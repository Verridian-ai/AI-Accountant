import type { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { db, reconciliationAlerts } from '../../../schema.js';
import { and, eq, desc } from 'drizzle-orm';
import { resolveAlertSchema } from '../../../validation/operations.js';

export function registerReconciliationOps(app: Hono): void {
  // GET /api/reconciliation-alerts
  app.get('/reconciliation-alerts', async (c) => {
    try {
      const payload = c.get('jwtPayload');
      const userId = payload.userId;
      const showResolved = c.req.query('showResolved') === 'true';
      const alerts = await db
        .select()
        .from(reconciliationAlerts)
        .where(
          and(
            eq(reconciliationAlerts.userId, userId),
            showResolved ? undefined : eq(reconciliationAlerts.isResolved, false),
          ),
        )
        .orderBy(desc(reconciliationAlerts.createdAt))
        .all();
      return c.json(alerts);
    } catch (err) {
      console.error('Failed to get reconciliation alerts:', err);
      return c.json({ error: 'Failed to get reconciliation alerts' }, 500);
    }
  });

  // POST /api/reconciliation-alerts/:id/resolve
  app.post(
    '/reconciliation-alerts/:id/resolve',
    zValidator('json', resolveAlertSchema),
    async (c) => {
      try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;
        const alertId = c.req.param('id');
        const { notes } = c.req.valid('json');
        const alert = await db
          .select()
          .from(reconciliationAlerts)
          .where(and(eq(reconciliationAlerts.id, alertId), eq(reconciliationAlerts.userId, userId)))
          .get();
        if (!alert) return c.json({ error: 'Alert not found' }, 404);
        await db
          .update(reconciliationAlerts)
          .set({
            isResolved: true,
            resolvedAt: new Date().toISOString(),
            resolutionNotes: notes ?? null,
          })
          .where(eq(reconciliationAlerts.id, alertId));
        return c.json({ success: true });
      } catch (err) {
        console.error('Failed to resolve reconciliation alert:', err);
        return c.json({ error: 'Failed to resolve reconciliation alert' }, 500);
      }
    },
  );
}
