import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { stream } from 'hono/streaming';
import { db, notificationPreferences } from '../schema.js';
import { eq } from 'drizzle-orm';
import { events, type SSEEvent } from '../events.js';
import { getUserId } from '../utils/auth-helpers.js';
import { tenantAuthMiddleware } from '../services/auth-middleware.js';
import { pushNotificationService } from '../services/push-notifications.js';
import { syncService } from '../services/sync/index.js';

// ─── Validation Schemas ───────────────────────────────────────────────────────

const notificationPrefsSchema = z
  .object({
    emailAlerts: z.boolean().optional(),
    pushAlerts: z.boolean().optional(),
    weeklyDigest: z.boolean().optional(),
    thresholdCents: z.number().int().min(0).optional(),
  })
  .passthrough();

const pushSubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  deviceName: z.string().optional(),
});

const pushUnsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

const syncOperationSchema = z.object({
  deviceId: z.string(),
  operation: z.enum(['create', 'update', 'delete']),
  resourceType: z.string(),
  resourceId: z.string().optional(),
  payload: z.record(z.unknown()),
  clientVersion: z.number().optional(),
});

const syncBodySchema = z.object({
  operations: z.array(syncOperationSchema),
});

const syncResolveSchema = z.object({
  resolution: z.enum(['client_wins', 'server_wins']),
});

const syncLogQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});

// ─── Router ───────────────────────────────────────────────────────────────────

const miscRoutes = new Hono();

// Apply tenant auth to all routes - requires valid JWT + X-Tenant-Id + tenant membership
miscRoutes.use('/*', tenantAuthMiddleware());

// ─── Events (SSE) ─────────────────────────────────────────────────────────────

miscRoutes.get('/events', (c) => {
  c.header('Content-Type', 'text/event-stream');
  c.header('Cache-Control', 'no-cache');
  c.header('Connection', 'keep-alive');

  return stream(c, async (stream) => {
    const listener = (data: SSEEvent | Record<string, unknown>) => {
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

// ─── Push Notifications ───────────────────────────────────────────────────────

miscRoutes.get('/push/vapid-key', (c) => {
  const publicKey = pushNotificationService.getVapidPublicKey();
  if (!publicKey) {
    return c.json({ error: 'Push notifications not configured', code: 'PUSH_NOT_CONFIGURED' }, 503);
  }
  return c.json({ data: { publicKey } });
});

miscRoutes.post('/push/subscribe', zValidator('json', pushSubscribeSchema), async (c) => {
  try {
    const userId = getUserId(c);
    const tenantId = c.req.header('X-Tenant-Id') ?? 'default';
    const { endpoint, keys, deviceName } = c.req.valid('json');
    await pushNotificationService.subscribe(userId, tenantId, { endpoint, keys }, deviceName);
    return c.json({ data: { success: true } }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to subscribe';
    return c.json({ error: message, code: 'SUBSCRIBE_FAILED' }, 500);
  }
});

miscRoutes.delete('/push/subscribe', zValidator('json', pushUnsubscribeSchema), async (c) => {
  try {
    const userId = getUserId(c);
    const { endpoint } = c.req.valid('json');
    await pushNotificationService.unsubscribe(userId, endpoint);
    return c.json({ data: { success: true } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to unsubscribe';
    return c.json({ error: message, code: 'UNSUBSCRIBE_FAILED' }, 500);
  }
});

miscRoutes.get('/push/subscriptions', async (c) => {
  try {
    const userId = getUserId(c);
    const tenantId = c.req.header('X-Tenant-Id') ?? 'default';
    const subscriptions = await pushNotificationService.getSubscriptions(userId, tenantId);
    return c.json({ data: { count: subscriptions.length, subscriptions } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get subscriptions';
    return c.json({ error: message, code: 'GET_SUBSCRIPTIONS_FAILED' }, 500);
  }
});

// ─── Notification Preferences ─────────────────────────────────────────────────

miscRoutes.get('/notifications/preferences', async (c) => {
  try {
    const userId = getUserId(c);
    const prefs = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .get();
    return c.json(
      prefs ?? {
        userId,
        emailAlerts: true,
        pushAlerts: false,
        weeklyDigest: true,
        thresholdCents: 10000,
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get preferences';
    return c.json({ error: message, code: 'GET_PREFS_FAILED' }, 500);
  }
});

miscRoutes.put(
  '/notifications/preferences',
  zValidator('json', notificationPrefsSchema),
  async (c) => {
    try {
      const userId = getUserId(c);
      const body = c.req.valid('json');
      await db
        .update(notificationPreferences)
        .set(body)
        .where(eq(notificationPreferences.userId, userId));
      return c.json({ success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update preferences';
      return c.json({ error: message, code: 'UPDATE_PREFS_FAILED' }, 500);
    }
  },
);

// ─── Offline Sync ─────────────────────────────────────────────────────────────

miscRoutes.post('/sync', zValidator('json', syncBodySchema), async (c) => {
  try {
    const userId = getUserId(c);
    const tenantId = c.req.header('X-Tenant-Id') ?? 'default';
    const { operations } = c.req.valid('json');
    const result = await syncService.processSync(userId, tenantId, operations);
    return c.json({ data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync failed';
    return c.json({ error: message, code: 'SYNC_FAILED' }, 500);
  }
});

miscRoutes.get('/sync/conflicts', async (c) => {
  try {
    const userId = getUserId(c);
    const tenantId = c.req.header('X-Tenant-Id') ?? 'default';
    const conflicts = await syncService.getConflicts(userId, tenantId);
    return c.json({ data: { conflicts, count: conflicts.length } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get conflicts';
    return c.json({ error: message, code: 'GET_CONFLICTS_FAILED' }, 500);
  }
});

miscRoutes.post('/sync/resolve/:conflictId', zValidator('json', syncResolveSchema), async (c) => {
  try {
    const conflictId = c.req.param('conflictId');
    const { resolution } = c.req.valid('json');
    await syncService.resolveConflict(conflictId, resolution);
    return c.json({ data: { success: true, conflictId } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to resolve conflict';
    if (message.includes('not found')) {
      return c.json({ error: message, code: 'CONFLICT_NOT_FOUND' }, 404);
    }
    return c.json({ error: message, code: 'RESOLVE_FAILED' }, 500);
  }
});

miscRoutes.get('/sync/log', zValidator('query', syncLogQuerySchema), async (c) => {
  try {
    const userId = getUserId(c);
    const tenantId = c.req.header('X-Tenant-Id') ?? 'default';
    const { limit, offset } = c.req.valid('query');
    const entries = await syncService.getSyncLog(userId, tenantId, limit, offset);
    return c.json({ data: { entries, count: entries.length } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get sync log';
    return c.json({ error: message, code: 'GET_LOG_FAILED' }, 500);
  }
});

// ─── Static / System ──────────────────────────────────────────────────────────

miscRoutes.get('/manifest', (c) => {
  return c.json({
    name: 'GoldLedger',
    short_name: 'GoldLedger',
    start_url: '/',
    display: 'standalone',
  });
});

miscRoutes.get('/health', (c) => {
  return c.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

miscRoutes.get('/health/ping', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default miscRoutes;
