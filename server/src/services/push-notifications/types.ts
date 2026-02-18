/**
 * Push Notification Types (Wave 24)
 *
 * TypeScript types for the web-push notification system.
 * Used by PushNotificationService and notification triggers.
 */

// ============================================================================
// NOTIFICATION PAYLOAD
// ============================================================================

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
  actions?: Array<{ action: string; title: string; icon?: string }>;
  requireInteraction?: boolean;
  url?: string;
}

// ============================================================================
// NOTIFICATION CATEGORIES
// ============================================================================

export type NotificationCategory =
  | 'transaction_alerts'
  | 'bas_reminders'
  | 'budget_alerts'
  | 'tax_reminders'
  | 'bill_reminders'
  | 'sync_notifications'
  | 'team_notifications'
  | 'system_notifications';

/** Maps NotificationCategory to the matching column on notification_preferences */
export const CATEGORY_TO_COLUMN: Record<NotificationCategory, string> = {
  transaction_alerts: 'transactionAlerts',
  bas_reminders: 'basReminders',
  budget_alerts: 'budgetAlerts',
  tax_reminders: 'taxReminders',
  bill_reminders: 'billReminders',
  sync_notifications: 'syncNotifications',
  team_notifications: 'teamNotifications',
  system_notifications: 'systemNotifications',
};

// ============================================================================
// SEND RESULTS
// ============================================================================

export interface SendResult {
  sent: number;
  failed: number;
  skipped: number;
  errors: Array<{ endpoint: string; error: string }>;
}

export interface BulkSendResult {
  totalSent: number;
  totalFailed: number;
  totalSkipped: number;
  results: SendResult[];
}

// ============================================================================
// SUBSCRIPTION RECORD
// ============================================================================

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

/** Client-side push subscription data (from browser's PushSubscription API) */
export interface ClientPushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}
