import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { stream } from 'hono/streaming';
import { db, notificationPreferences } from '../schema.js';
import { eq } from 'drizzle-orm';
import { events } from '../events.js';
import { getUserId } from '../utils/auth-helpers.js';

const notificationPrefsSchema = z.object({
  emailAlerts: z.boolean().optional(),
  pushAlerts: z.boolean().optional(),
  weeklyDigest: z.boolean().optional(),
  thresholdCents: z.number().int().min(0).optional(),
}).passthrough();

const miscRoutes = new Hono();

// Events (SSE)
miscRoutes.get('/events', (c) => {
  c.header('Content-Type', 'text/event-stream');
  c.header('Cache-Control', 'no-cache');
  c.header('Connection', 'keep-alive');

  return stream(c, async (stream) => {
    const listener = (data: Record<string, any>) => {
      const payload = JSON.stringify(data);
      stream.write(`event: update\ndata: ${payload}\n\n`);
      if (data?.type && data.type !== 'update') {
        stream.write(`event: ${data.type}\ndata: ${payload}\n\n`);
      }
    };

    events.on('update', listener);
    const keepAlive = setInterval(() => stream.write(': keep-alive\n\n'), 30000);

    stream.onAbort(() => {
      events.off('update', listener);
      clearInterval(keepAlive);
    });

    while (true) {
      await stream.sleep(1000);
    }
  });
});

// Notifications
miscRoutes.post('/push/subscribe', async (c) => {
  return c.json({ success: true });
});

miscRoutes.delete('/push/subscribe', async (c) => {
  return c.json({ success: true });
});

miscRoutes.get('/push/vapid-key', (c) => {
  return c.json({ publicKey: 'PLACEHOLDER' });
});

miscRoutes.get('/push/subscriptions', async (c) => {
  return c.json({ count: 0, subscriptions: [] });
});

miscRoutes.get('/notifications/preferences', async (c) => {
  const userId = getUserId(c);
  const prefs = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId)).get();
  return c.json(prefs || { userId, emailAlerts: true, pushAlerts: false, weeklyDigest: true, thresholdCents: 10000 });
});

miscRoutes.put('/notifications/preferences', zValidator('json', notificationPrefsSchema), async (c) => {
  const userId = getUserId(c);
  const body = c.req.valid('json');
  await db.update(notificationPreferences).set(body).where(eq(notificationPreferences.userId, userId));
  return c.json({ success: true });
});

// Sync
miscRoutes.post('/sync', async (c) => {
  return c.json({ success: true, timestamp: new Date().toISOString() });
});

miscRoutes.get('/sync/conflicts', async (c) => {
  return c.json({ conflicts: [], count: 0 });
});

miscRoutes.post('/sync/resolve/:conflictId', async (c) => {
  return c.json({ success: true });
});

miscRoutes.get('/sync/log', async (c) => {
  return c.json({ entries: [], count: 0 });
});

// Other
miscRoutes.get('/manifest', (c) => {
  return c.json({ name: 'GoldLedger', short_name: 'GoldLedger', start_url: '/', display: 'standalone' });
});

miscRoutes.get('/health/ping', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default miscRoutes;
