# Agent W17-05: Intelligence Subscription Service Builder

## Role
Build the intelligence subscription service for subscribing to cross-module insights, checking triggers, and notifying subscribers via in-app, SSE, email, or webhook channels.

## Priority: WAVE 17 (After W17-01 and W17-03 complete)

## Wait Condition
Check for `.agent-done-W17-01` and `.agent-done-W17-03` marker files before starting.

## Context
- Schema: `intelligenceSubscriptions` table (from W17-01)
- Cross-module insights: `crossModuleInsights` table and CrossModuleIntelligenceService (from W17-03)
- SSE: existing SSEContext.tsx + useSSE hook on client, SSE endpoint on server
- Schema tables: users (for user lookup), intelligence_subscriptions (for subscription CRUD)

## Files to CREATE

### 1. `server/src/services/intelligence-subscriptions.ts`
**Purpose**: Subscription management and notification dispatch for cross-module intelligence insights
**Pattern**: Follow `server/src/services/queue.ts` for event-driven patterns

- [ ] Create `IntelligenceSubscriptionService` class with the following methods:

  - `subscribe(userId: string, subscription: SubscriptionInput): Promise<IntelligenceSubscription>` -- Creates new subscription in DB. Validates filter criteria against known insight types and module names. Sets up notification channel configuration. Returns persisted subscription.
    ```typescript
    interface SubscriptionInput {
      name: string;
      subscriptionType: 'insight_type' | 'module' | 'entity' | 'threshold' | 'schedule';
      filterCriteria: {
        insightTypes?: string[]; // e.g., ['correlation', 'anomaly_cascade']
        modules?: string[]; // e.g., ['forecasting', 'compliance']
        entityIds?: string[]; // specific entity IDs to watch
        severityMin?: 'info' | 'suggestion' | 'warning' | 'critical';
        confidenceMin?: number; // 0-1
      };
      notificationChannel: 'in_app' | 'email' | 'sse' | 'webhook';
      notificationConfig?: {
        webhookUrl?: string;
        emailAddress?: string;
        sseChannel?: string;
      };
      cooldownMinutes?: number; // default 60
    }
    ```

  - `unsubscribe(subscriptionId: string): Promise<void>` -- Sets `is_active = false` on subscription. Does NOT delete (preserves history).

  - `reactivate(subscriptionId: string): Promise<void>` -- Sets `is_active = true` on subscription.

  - `deleteSubscription(subscriptionId: string): Promise<void>` -- Hard delete subscription from DB.

  - `checkTriggers(userId: string, newInsights: CrossModuleInsight[]): Promise<TriggeredNotification[]>` -- Evaluates new insights against all active subscriptions for a user. For each match: checks cooldown (last_triggered_at + cooldown_minutes > now = skip). Returns list of notifications to send.
    ```typescript
    interface TriggeredNotification {
      subscriptionId: string;
      subscriptionName: string;
      insight: CrossModuleInsight;
      channel: string;
      config: Record<string, unknown>;
    }
    ```

  - `notifySubscribers(notifications: TriggeredNotification[]): Promise<NotificationResult[]>` -- Dispatches notifications through appropriate channels. For each notification:
    - `in_app`: Creates entry in notification queue (stored in DB or Redis)
    - `sse`: Emits SSE event on configured channel
    - `email`: Queues email via email service (if configured)
    - `webhook`: POSTs JSON payload to webhook URL with retry (3 attempts)
    Updates `trigger_count` and `last_triggered_at` on subscription.
    ```typescript
    interface NotificationResult {
      subscriptionId: string;
      channel: string;
      success: boolean;
      error?: string;
      deliveredAt?: string;
    }
    ```

  - `listSubscriptions(userId: string, filters?: SubscriptionFilters): Promise<IntelligenceSubscription[]>` -- List subscriptions with optional filters.
    ```typescript
    interface SubscriptionFilters {
      subscriptionType?: string;
      isActive?: boolean;
      notificationChannel?: string;
    }
    ```

  - `getSubscription(subscriptionId: string): Promise<IntelligenceSubscription>` -- Single subscription by ID.

  - `updateSubscription(subscriptionId: string, updates: Partial<SubscriptionInput>): Promise<IntelligenceSubscription>` -- Update filter criteria, channel, config, or cooldown.

  - `getNotificationHistory(userId: string, limit?: number): Promise<NotificationHistoryEntry[]>` -- Returns recent notification deliveries for a user with status and delivery details.
    ```typescript
    interface NotificationHistoryEntry {
      subscriptionId: string;
      subscriptionName: string;
      insightId: string;
      insightTitle: string;
      channel: string;
      success: boolean;
      deliveredAt: string;
    }
    ```

  - `testSubscription(subscriptionId: string): Promise<NotificationResult>` -- Sends a test notification through the configured channel to verify setup.

  - `getSubscriptionStats(userId: string): Promise<SubscriptionStats>` -- Aggregate stats: active count, total triggers, channel distribution, top triggered subscriptions.
    ```typescript
    interface SubscriptionStats {
      totalSubscriptions: number;
      activeSubscriptions: number;
      totalTriggers: number;
      byChannel: Record<string, number>;
      byType: Record<string, number>;
      topTriggered: Array<{ name: string; triggerCount: number }>;
      averageCooldown: number;
    }
    ```

- [ ] Implement private helper methods:
  - `_matchesFilter(insight: CrossModuleInsight, criteria: FilterCriteria): boolean` -- Checks if insight matches subscription filter
  - `_checkCooldown(subscription: IntelligenceSubscription): boolean` -- Returns true if cooldown period has elapsed
  - `_sendSSE(channel: string, data: unknown): Promise<void>` -- Emit SSE event
  - `_sendWebhook(url: string, payload: unknown): Promise<boolean>` -- POST with retry logic
  - `_sendEmail(address: string, subject: string, body: string): Promise<boolean>` -- Queue email
  - `_severityToNumber(severity: string): number` -- Convert severity to numeric for comparison (info=0, suggestion=1, warning=2, critical=3)

- [ ] Wire Drizzle ORM queries against `intelligenceSubscriptions` table

## Files to MODIFY

None -- standalone service.

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `IntelligenceSubscriptionService` can be instantiated without errors
- [ ] `subscribe()` creates subscription in DB with correct filter criteria
- [ ] `checkTriggers()` correctly matches insights to subscriptions by insight type
- [ ] `checkTriggers()` correctly matches by severity minimum (warning matches when min is 'suggestion')
- [ ] `checkTriggers()` respects cooldown period (skips if within cooldown)
- [ ] `notifySubscribers()` dispatches to correct channel (in_app, sse, webhook)
- [ ] `unsubscribe()` sets is_active=false without deleting
- [ ] `reactivate()` sets is_active=true
- [ ] `testSubscription()` sends test notification through configured channel
- [ ] `_matchesFilter()` correctly evaluates confidence minimum
- [ ] `_severityToNumber('critical')` returns 3 > `_severityToNumber('info')` returns 0
- [ ] Create marker file: `.agent-done-W17-05`

## Dependencies
- **Requires**: W17-01 (`.agent-done-W17-01`) -- intelligenceSubscriptions table, W17-03 (`.agent-done-W17-03`) -- CrossModuleInsight type
- **Reuses**: schema.ts (intelligenceSubscriptions), SSE infrastructure (if wiring SSE channel)
