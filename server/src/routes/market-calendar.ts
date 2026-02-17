import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db, economicCalendar } from '../schema.js';
import { and, gte, lte, type SQL } from 'drizzle-orm';
import crypto from 'crypto';
import { tenantAuthMiddleware } from '../services/auth-middleware.js';

const createCalendarEventSchema = z.object({
  eventName: z.string().min(1),
  scheduledDate: z.string().min(1),
  country: z.string().optional(),
  importance: z.enum(['low', 'medium', 'high']).optional(),
}).passthrough();

const calendarRoutes = new Hono();

// Apply tenant auth to all routes - requires valid JWT + X-Tenant-Id + tenant membership
calendarRoutes.use('/*', tenantAuthMiddleware());

calendarRoutes.get('/', async (c) => {
  const conditions: SQL[] = [];
  if (c.req.query('startDate')) conditions.push(gte(economicCalendar.scheduledDate, c.req.query('startDate') as string));
  if (c.req.query('endDate')) conditions.push(lte(economicCalendar.scheduledDate, c.req.query('endDate') as string));
  const events = await db.select().from(economicCalendar).where(conditions.length > 0 ? and(...conditions) : undefined).orderBy(economicCalendar.scheduledDate).all();
  return c.json({ events, count: events.length });
});

calendarRoutes.post('/', zValidator('json', createCalendarEventSchema), async (c) => {
  const body = c.req.valid('json');
  const id = crypto.randomUUID();
  await db.insert(economicCalendar).values({ id, ...body, createdAt: new Date().toISOString() }).run();
  return c.json({ id, message: 'Created' }, 201);
});

export default calendarRoutes;
