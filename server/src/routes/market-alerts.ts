import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db, marketAlerts } from '../schema.js';
import { eq, desc } from 'drizzle-orm';
import crypto from 'crypto';

const createAlertSchema = z.object({
  alertType: z.string().min(1),
  thresholdValue: z.number(),
  indicator: z.string().optional(),
  direction: z.enum(['above', 'below']).optional(),
}).passthrough();

const alertRoutes = new Hono();

alertRoutes.post('/', zValidator('json', createAlertSchema), async (c) => {
  const body = c.req.valid('json');
  const id = crypto.randomUUID();
  await db.insert(marketAlerts).values({ id, userId: 'default', ...body, createdAt: new Date().toISOString() }).run();
  return c.json({ id, message: 'Created' }, 201);
});

alertRoutes.get('/', async (c) => {
  const activeOnly = c.req.query('activeOnly') === 'true';
  const alerts = await db.select().from(marketAlerts).where(activeOnly ? eq(marketAlerts.isActive, true) : undefined).orderBy(desc(marketAlerts.createdAt)).all();
  return c.json({ alerts, count: alerts.length });
});

export default alertRoutes;
