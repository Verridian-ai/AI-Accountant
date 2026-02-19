import type { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { subscriptionService } from '../../services/subscriptions.js';
import { rbacService } from '../../services/rbac.js';
import { ForbiddenError } from '../../services/rbac-errors.js';
import { getErrorMessage } from '../../utils/error.js';
import { getUserId } from '../../utils/auth-helpers.js';
import { createSubscriptionSchema, changePlanSchema } from './schemas.js';

export function registerSubscriptionHandlers(app: Hono): void {
  // GET /:tenantId/subscription — Get current subscription + usage
  app.get('/:tenantId/subscription', async (c) => {
    try {
      const tenantId = c.req.param('tenantId');
      const subscription = await subscriptionService.getCurrentSubscription(tenantId);
      const usage = await subscriptionService.getUsage(tenantId);
      return c.json({ subscription, usage });
    } catch (err: unknown) {
      return c.json({ error: getErrorMessage(err) || 'Failed to get subscription' }, 500);
    }
  });

  // POST /:tenantId/subscription — Create subscription
  app.post('/:tenantId/subscription', zValidator('json', createSubscriptionSchema), async (c) => {
    try {
      const tenantId = c.req.param('tenantId');
      const userId = getUserId(c);
      await rbacService.requirePermission(tenantId, userId, 'settings.manage');
      const { planName, billingCycle } = c.req.valid('json');
      return c.json(await subscriptionService.subscribe(tenantId, planName, billingCycle), 201);
    } catch (err: unknown) {
      if (err instanceof ForbiddenError) return c.json({ error: getErrorMessage(err) }, 403);
      return c.json({ error: getErrorMessage(err) || 'Failed to subscribe' }, 400);
    }
  });

  // PUT /:tenantId/subscription/upgrade — Upgrade plan
  app.put('/:tenantId/subscription/upgrade', zValidator('json', changePlanSchema), async (c) => {
    try {
      const tenantId = c.req.param('tenantId');
      const userId = getUserId(c);
      await rbacService.requirePermission(tenantId, userId, 'settings.manage');
      const { newPlanName } = c.req.valid('json');
      return c.json(await subscriptionService.upgrade(tenantId, newPlanName));
    } catch (err: unknown) {
      if (err instanceof ForbiddenError) return c.json({ error: getErrorMessage(err) }, 403);
      return c.json({ error: getErrorMessage(err) || 'Failed to upgrade' }, 400);
    }
  });

  // PUT /:tenantId/subscription/downgrade — Downgrade plan
  app.put('/:tenantId/subscription/downgrade', zValidator('json', changePlanSchema), async (c) => {
    try {
      const tenantId = c.req.param('tenantId');
      const userId = getUserId(c);
      await rbacService.requirePermission(tenantId, userId, 'settings.manage');
      const { newPlanName } = c.req.valid('json');
      return c.json(await subscriptionService.downgrade(tenantId, newPlanName));
    } catch (err: unknown) {
      if (err instanceof ForbiddenError) return c.json({ error: getErrorMessage(err) }, 403);
      return c.json({ error: getErrorMessage(err) || 'Failed to downgrade' }, 400);
    }
  });

  // DELETE /:tenantId/subscription — Cancel subscription
  app.delete('/:tenantId/subscription', async (c) => {
    try {
      const tenantId = c.req.param('tenantId');
      const userId = getUserId(c);
      await rbacService.requirePermission(tenantId, userId, 'settings.manage');
      return c.json(await subscriptionService.cancel(tenantId));
    } catch (err: unknown) {
      if (err instanceof ForbiddenError) return c.json({ error: getErrorMessage(err) }, 403);
      return c.json({ error: getErrorMessage(err) || 'Failed to cancel subscription' }, 400);
    }
  });
}
