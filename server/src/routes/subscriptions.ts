import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { subscriptionService } from '../services/subscriptions.js';
import { rbacService } from '../services/rbac.js';
import { ForbiddenError } from '../services/rbac-errors.js';
import { getErrorMessage } from '../utils/error.js';
import { getUserId } from '../utils/auth-helpers.js';

const subscribeSchema = z.object({
  planName: z.string().min(1),
  billingCycle: z.enum(['monthly', 'annually']).optional(),
});

const changePlanSchema = z.object({
  planName: z.string().min(1),
});

const subscriptionRoutes = new Hono();

// --- SUBSCRIPTION ROUTES ---

subscriptionRoutes.get('/plans', async (c) => {
  const plans = await subscriptionService.getPlans();
  return c.json({ plans, count: plans.length });
});

subscriptionRoutes.get('/:tenantId', async (c) => {
  const tenantId = c.req.param('tenantId');
  const subscription = await subscriptionService.getCurrentSubscription(tenantId);
  const usage = await subscriptionService.getUsage(tenantId);
  return c.json({ subscription, usage });
});

subscriptionRoutes.post('/:tenantId', zValidator('json', subscribeSchema), async (c) => {
  try {
    const tenantId = c.req.param('tenantId');
    const userId = getUserId(c);
    await rbacService.requirePermission(tenantId, userId, 'settings.manage');
    const { planName, billingCycle } = c.req.valid('json');
    return c.json(await subscriptionService.subscribe(tenantId, planName, billingCycle), 201);
  } catch (err) {
    if (err instanceof ForbiddenError) return c.json({ error: getErrorMessage(err) }, 403);
    return c.json({ error: 'Failed' }, 400);
  }
});

subscriptionRoutes.put('/:tenantId/upgrade', zValidator('json', changePlanSchema), async (c) => {
  try {
    const tenantId = c.req.param('tenantId');
    const userId = getUserId(c);
    await rbacService.requirePermission(tenantId, userId, 'settings.manage');
    const { planName: newPlanName } = c.req.valid('json');
    return c.json(await subscriptionService.upgrade(tenantId, newPlanName));
  } catch (err) {
    if (err instanceof ForbiddenError) return c.json({ error: getErrorMessage(err) }, 403);
    return c.json({ error: 'Failed' }, 400);
  }
});

subscriptionRoutes.put('/:tenantId/downgrade', zValidator('json', changePlanSchema), async (c) => {
  try {
    const tenantId = c.req.param('tenantId');
    const userId = getUserId(c);
    await rbacService.requirePermission(tenantId, userId, 'settings.manage');
    const { planName: newPlanName } = c.req.valid('json');
    return c.json(await subscriptionService.downgrade(tenantId, newPlanName));
  } catch (err) {
    if (err instanceof ForbiddenError) return c.json({ error: getErrorMessage(err) }, 403);
    return c.json({ error: 'Failed' }, 400);
  }
});

subscriptionRoutes.delete('/:tenantId', async (c) => {
  try {
    const tenantId = c.req.param('tenantId');
    const userId = getUserId(c);
    await rbacService.requirePermission(tenantId, userId, 'settings.manage');
    return c.json(await subscriptionService.cancel(tenantId));
  } catch (err) {
    if (err instanceof ForbiddenError) return c.json({ error: getErrorMessage(err) }, 403);
    return c.json({ error: 'Failed' }, 400);
  }
});

export default subscriptionRoutes;
