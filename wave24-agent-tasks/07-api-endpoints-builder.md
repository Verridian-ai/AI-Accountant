# Agent 7: API Endpoints Builder

## Role
Wire 12 new API routes in `server/src/index.ts` for push notifications, offline sync, PWA manifest, and health ping.

## Priority: WAVE 24 (After Agents 1, 5)

## Wait Condition
Check for `.agent-done-W24-01` and `.agent-done-W24-05` marker files before starting.

## Files to CREATE

### 1. `server/src/services/sync.ts`
**Purpose**: Server-side sync service for processing offline changes

- [ ] Create `SyncService` class with methods:
  - `processSync(userId, tenantId, operations: SyncOperation[]): Promise<SyncResult>` -- processes batch of offline changes, detects conflicts, applies non-conflicting changes, returns results
  - `getServerVersion(resourceType, resourceId): Promise<number>` -- returns current server version for conflict detection
  - `applyOperation(op: SyncOperation, tenantId): Promise<ApplyResult>` -- applies single create/update/delete to database
  - `getConflicts(userId, tenantId): Promise<ServerConflict[]>` -- returns unresolved conflicts stored in `offline_sync_log`
  - `resolveConflict(conflictId, resolution: 'client_wins' | 'server_wins'): Promise<void>` -- applies resolution
  - `getSyncLog(userId, tenantId, limit?): Promise<SyncLogEntry[]>` -- paginated sync history

## Files to MODIFY

### 2. `server/src/index.ts`
**Current state**: ~4,707+ lines (plus Wave 21-23 additions)
**Insert location**: After existing route blocks

- [ ] Add imports:
  ```typescript
  import { PushNotificationService } from './services/push-notifications.js';
  import { SyncService } from './services/sync.js';
  ```

- [ ] Instantiate services:
  ```typescript
  const pushService = new PushNotificationService();
  const syncService = new SyncService();
  ```

### Push Notification Routes (4 endpoints):

- [ ] `POST /api/push/subscribe` -- Register push subscription
  ```typescript
  app.post('/api/push/subscribe', async (c) => {
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');
    const { subscription, deviceName } = await c.req.json();
    await pushService.subscribe(userId, tenantId, subscription, deviceName);
    return c.json({ success: true });
  });
  ```

- [ ] `DELETE /api/push/subscribe` -- Unsubscribe from push (body: `{endpoint}`)

- [ ] `GET /api/push/vapid-key` -- Get VAPID public key for client subscription setup (no auth required for PWA)

- [ ] `GET /api/push/subscriptions` -- List user's active push subscriptions

### Notification Preferences Routes (2 endpoints):

- [ ] `GET /api/notifications/preferences` -- Get user's notification preferences for current tenant
- [ ] `PUT /api/notifications/preferences` -- Update notification preferences (body: partial update of toggles and thresholds)

### Sync Routes (4 endpoints):

- [ ] `POST /api/sync` -- Process batch of offline changes
  ```typescript
  app.post('/api/sync', async (c) => {
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');
    const { operations } = await c.req.json();
    const result = await syncService.processSync(userId, tenantId, operations);
    return c.json(result);
  });
  ```

- [ ] `GET /api/sync/conflicts` -- Get unresolved conflicts for user

- [ ] `POST /api/sync/resolve/:conflictId` -- Resolve a specific conflict (body: `{resolution: 'client_wins' | 'server_wins'}`)

- [ ] `GET /api/sync/log` -- Get sync history (paginated: ?limit=20&offset=0)

### PWA Routes (2 endpoints):

- [ ] `GET /api/manifest` -- Serve manifest.json with dynamic values (tenant name, colors)
  ```typescript
  app.get('/api/manifest', async (c) => {
    // Optional: customize manifest per tenant
    const manifest = {
      name: 'GoldLedger',
      short_name: 'GoldLedger',
      start_url: '/',
      display: 'standalone',
      background_color: '#111827',
      theme_color: '#FFCC00',
      // ... icons
    };
    return c.json(manifest);
  });
  ```

- [ ] `GET /api/health/ping` -- Lightweight health check for PWA connectivity detection
  ```typescript
  app.get('/api/health/ping', (c) => {
    return c.json({ status: 'ok', timestamp: Date.now() });
  });
  ```

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] All 12 routes are accessible (test with curl)
- [ ] Push subscribe/unsubscribe stores and removes subscription records
- [ ] VAPID key endpoint returns public key
- [ ] Notification preferences CRUD works
- [ ] Sync endpoint processes offline operations and returns results
- [ ] Conflict detection and resolution works
- [ ] Health ping returns within 50ms
- [ ] No route path conflicts with existing routes
- [ ] Create marker file: `.agent-done-W24-07`

## Dependencies
- **Requires**: Agent 1 (`.agent-done-W24-01`) for schema tables, Agent 5 (`.agent-done-W24-05`) for PushNotificationService
- **IMPORTANT**: Only this agent modifies `server/src/index.ts` in Wave 24
