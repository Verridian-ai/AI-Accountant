# Agent 5: Push Notification Builder

## Role
Build the server-side push notification service using the Web Push API with VAPID keys. Implements subscription management, notification sending, and delivery tracking.

## Priority: WAVE 24 (After Agent 1)

## Wait Condition
Check for `.agent-done-W24-01` marker file before starting.

## Files to CREATE

### 1. `server/src/services/push-notifications.ts`
**Purpose**: Core push notification service using web-push library

- [ ] Create `PushNotificationService` class with methods:

  **Subscription Management**:
  - `subscribe(userId, tenantId, subscription: PushSubscription, deviceName?): Promise<void>` -- stores subscription endpoint + keys in `push_subscriptions` table. Updates if endpoint already exists.
  - `unsubscribe(userId, endpoint): Promise<void>` -- removes subscription from DB
  - `getSubscriptions(userId, tenantId): Promise<PushSubscriptionRecord[]>` -- list user's active subscriptions
  - `deactivateSubscription(endpoint): Promise<void>` -- sets is_active=false (for failed deliveries)
  - `cleanupInactive(): Promise<number>` -- removes subscriptions with error_count >= 5

  **Sending Notifications**:
  - `sendNotification(userId, tenantId, payload: NotificationPayload): Promise<SendResult>` -- sends to all active subscriptions for user. Respects quiet hours. Handles per-device delivery.
  - `sendToTenant(tenantId, payload: NotificationPayload, roles?: TenantRole[]): Promise<SendResult>` -- sends to all members of a tenant (optionally filtered by role)
  - `sendBulk(notifications: Array<{userId, tenantId, payload}>): Promise<BulkSendResult>` -- batch send with rate limiting

  **Delivery**:
  - `deliverToEndpoint(endpoint, keys, payload): Promise<boolean>` -- actual web-push API call. Returns false on failure, increments error_count.
  - `checkQuietHours(userId, tenantId): Promise<boolean>` -- returns true if currently in quiet hours
  - `isNotificationEnabled(userId, tenantId, category: NotificationCategory): Promise<boolean>` -- checks notification_preferences table

  **VAPID Configuration**:
  - `getVapidPublicKey(): string` -- returns public key for client subscription
  - Static method to generate VAPID keys: `generateVapidKeys()` (one-time setup utility)

### 2. `server/src/services/push-notification-types.ts`
**Purpose**: TypeScript types for push notifications

```typescript
export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string; // Default: '/icons/icon-192.png'
  badge?: string; // Default: '/icons/badge-72.png'
  tag?: string; // Group notifications by tag (replaces previous with same tag)
  data?: Record<string, any>; // Custom data for click handling
  actions?: Array<{ action: string; title: string; icon?: string }>; // Action buttons
  requireInteraction?: boolean; // Don't auto-dismiss
  url?: string; // URL to open on click
}

export type NotificationCategory =
  | 'transaction_alerts'
  | 'bas_reminders'
  | 'budget_alerts'
  | 'tax_reminders'
  | 'bill_reminders'
  | 'sync_notifications'
  | 'team_notifications'
  | 'system_notifications';

export interface SendResult {
  sent: number;
  failed: number;
  skipped: number; // Quiet hours, disabled
  errors: Array<{ endpoint: string; error: string }>;
}

export interface PushSubscriptionRecord {
  id: string;
  userId: string;
  tenantId: string;
  endpoint: string;
  keysJson: { p256dh: string; auth: string };
  deviceName?: string;
  isActive: boolean;
  lastUsedAt?: string;
  errorCount: number;
}
```

### 3. `server/src/services/notification-triggers.ts`
**Purpose**: Business logic triggers that fire notifications

- [ ] `triggerLargeTransactionAlert(transaction, userId, tenantId)`:
  - Checks amount against user's `large_transaction_threshold_cents`
  - Sends: "Large transaction: $X at [merchant]"
  - Category: `transaction_alerts`

- [ ] `triggerBASReminder(tenantId, dueDate, daysUntilDue)`:
  - Sends to all members with `bas.read` permission
  - Sends: "BAS due in [X] days - [period]"
  - Category: `bas_reminders`

- [ ] `triggerBudgetAlert(userId, tenantId, categoryName, percentUsed)`:
  - Checks against user's `budget_alert_threshold_percent`
  - Sends: "[Category] is at [X]% of budget"
  - Category: `budget_alerts`

- [ ] `triggerBillReminder(userId, tenantId, billName, dueDate)`:
  - Sends: "[Bill] due on [date]"
  - Category: `bill_reminders`

- [ ] `triggerTeamNotification(tenantId, action, actorName, targetName)`:
  - Sends to all admins/owners
  - Sends: "[Actor] [action] [target]" (e.g., "John added Mary as accountant")
  - Category: `team_notifications`

## Files to MODIFY

### 4. `server/package.json`
- [ ] Add dependency: `web-push@^3.6`
- [ ] Add dependency: `@types/web-push` (devDependency)

### 5. `.env.example` (or equivalent)
- [ ] Add VAPID environment variables:
  ```
  VAPID_PUBLIC_KEY=
  VAPID_PRIVATE_KEY=
  VAPID_SUBJECT=mailto:admin@goldledger.com.au
  ```

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `subscribe()` stores subscription in database
- [ ] `sendNotification()` delivers push to active endpoints
- [ ] Failed delivery increments `error_count`, deactivates at 5
- [ ] Quiet hours check prevents delivery during configured hours
- [ ] Notification category toggle prevents delivery for disabled categories
- [ ] `sendToTenant()` filters by role when specified
- [ ] VAPID public key is accessible for client subscription
- [ ] Create marker file: `.agent-done-W24-05`

## Dependencies
- **Requires**: Agent 1 (`.agent-done-W24-01`) for schema tables
- **Reuses**: Drizzle ORM patterns, tenant service for member lookups
