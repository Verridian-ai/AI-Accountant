# Agent W17-07: API Endpoints Builder

## Role
Wire 14 new API routes in server/src/index.ts for temporal queries, cross-module intelligence, subscriptions, and Redis session management.

## Priority: WAVE 17 (After W17-02, W17-03, W17-04, W17-05 complete)

## Wait Condition
Check for `.agent-done-W17-02`, `.agent-done-W17-03`, `.agent-done-W17-04`, `.agent-done-W17-05` marker files before starting.

## File to MODIFY

### `server/src/index.ts`
**Insert location**: After Wave 16 routes, before final app mount

- [ ] Add imports for 4 new services:
  ```typescript
  import { TemporalCognifyService } from './services/temporal-cognify.js';
  import { CrossModuleIntelligenceService } from './services/cross-module-intelligence.js';
  import { IntelligenceSubscriptionService } from './services/intelligence-subscriptions.js';
  import { CogneeSessionService } from './services/cognee-sessions.js';
  ```

- [ ] Instantiate 4 services:
  ```typescript
  const temporalCognifyService = new TemporalCognifyService();
  const crossModuleIntelligenceService = new CrossModuleIntelligenceService();
  const intelligenceSubscriptionService = new IntelligenceSubscriptionService();
  const cogneeSessionService = new CogneeSessionService();
  ```

- [ ] Add 4 Temporal Query routes:
  - `POST /api/intelligence/temporal/query` -- Body: `{ userId, queryType, targetEntity, timeStart, timeEnd?, timeGranularity?, parameters, useCache? }`. Calls `temporalCognifyService.executeTemporalQuery()`. Returns query results (from cache if available).
  - `POST /api/intelligence/temporal/save` -- Body: `{ userId, name, description?, ...queryInput }`. Calls `temporalCognifyService.saveQuery()`. Returns saved query.
  - `GET /api/intelligence/temporal/saved/:userId` -- Query: `?queryType=&targetEntity=`. Calls `temporalCognifyService.listSavedQueries()`.
  - `GET /api/intelligence/temporal/timeline/:userId` -- Query: `?start=&end=&entityType=`. Calls `temporalCognifyService.getTemporalTimeline()`. Returns chronological event list.

- [ ] Add 4 Cross-Module Intelligence routes:
  - `POST /api/intelligence/insights/scan` -- Body: `{ userId, modules?, timeRange?, minConfidence?, severityFilter? }`. Calls `crossModuleIntelligenceService.scanForInsights()`. Returns ranked insights.
  - `GET /api/intelligence/insights/:userId` -- Query: `?insightType=&severity=&status=&minConfidence=&limit=&offset=`. Calls `crossModuleIntelligenceService.getInsights()`. Returns paginated list.
  - `GET /api/intelligence/insights/detail/:insightId` -- Calls `crossModuleIntelligenceService.getInsightById()`. Returns full insight with evidence.
  - `PATCH /api/intelligence/insights/:insightId/status` -- Body: `{ status: 'viewed' | 'acted_on' | 'dismissed' }`. Calls appropriate status update method.

- [ ] Add 2 Module Connection routes:
  - `GET /api/intelligence/connections` -- Query: `?sourceModule=&targetModule=&connectionType=&minStrength=`. Calls `crossModuleIntelligenceService.getModuleConnections()`.
  - `POST /api/intelligence/correlations` -- Body: `{ userId, moduleA, moduleB }`. Calls `crossModuleIntelligenceService.findCorrelations()`. Returns correlation results.

- [ ] Add 3 Subscription routes:
  - `POST /api/intelligence/subscriptions` -- Body: `{ userId, name, subscriptionType, filterCriteria, notificationChannel, notificationConfig?, cooldownMinutes? }`. Calls `intelligenceSubscriptionService.subscribe()`.
  - `GET /api/intelligence/subscriptions/:userId` -- Query: `?subscriptionType=&isActive=&notificationChannel=`. Calls `intelligenceSubscriptionService.listSubscriptions()`.
  - `DELETE /api/intelligence/subscriptions/:subscriptionId` -- Calls `intelligenceSubscriptionService.deleteSubscription()`.

- [ ] Add 1 Redis/Cache health route:
  - `GET /api/intelligence/cache/health` -- Calls `cogneeSessionService.getHealthStatus()`. Returns Redis connection status and cache metrics.

### Route Pattern (follow existing pattern):
```typescript
app.post('/api/intelligence/temporal/query', async (c) => {
    try {
        const body = await c.req.json();
        const { userId, ...queryInput } = body;
        const result = await temporalCognifyService.executeTemporalQuery(userId, queryInput);
        return c.json(result);
    } catch (err) {
        console.error('Temporal query failed:', err);
        return c.json({ error: 'Failed to execute temporal query' }, 500);
    }
});
```

### Subscription trigger integration:
- [ ] After `scanForInsights()` call, wire subscription trigger:
  ```typescript
  // In the /api/intelligence/insights/scan route handler:
  const insights = await crossModuleIntelligenceService.scanForInsights(userId, options);
  // Check subscriptions for matching insights
  if (insights.length > 0) {
    const notifications = await intelligenceSubscriptionService.checkTriggers(userId, insights);
    if (notifications.length > 0) {
      await intelligenceSubscriptionService.notifySubscribers(notifications);
    }
  }
  return c.json({ insights, notificationsSent: notifications?.length || 0 });
  ```

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] All 14 routes are accessible (test with curl after Docker rebuild)
- [ ] No route path conflicts with existing routes (all under /api/intelligence/)
- [ ] Temporal query returns results (possibly from cache)
- [ ] Insight scan runs all scanners and returns ranked results
- [ ] Subscription creation returns valid subscription with ID
- [ ] Cache health endpoint returns Redis status
- [ ] Subscription triggers fire when matching insights are found
- [ ] Module connections endpoint returns predefined connections
- [ ] Create marker file: `.agent-done-W17-07`

## Dependencies
- **Requires**: W17-02 (`.agent-done-W17-02`), W17-03 (`.agent-done-W17-03`), W17-04 (`.agent-done-W17-04`), W17-05 (`.agent-done-W17-05`)
- **IMPORTANT**: Only W17-07 modifies server/src/index.ts in Wave 17
