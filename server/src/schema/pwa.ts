import { pgTable, text, integer, boolean } from 'drizzle-orm/pg-core';

// NOTE: .references() to users/tenants (core.ts/multitenant.ts) omitted until those tables
// migrate to pgTable (TASK-045/046). DB-level FK constraints remain intact in SQL migrations.

// ============================================================================
// PWA SUPPORT (Wave 24)
// ============================================================================

export const pushSubscriptions = pgTable('push_subscriptions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(), // FK → users(id) CASCADE
  tenantId: text('tenant_id').notNull(), // FK → tenants(id) CASCADE
  endpoint: text('endpoint').notNull().unique(),
  keysJson: text('keys_json').notNull(),
  userAgent: text('user_agent'),
  deviceName: text('device_name'),
  isActive: boolean('is_active').notNull().default(true),
  lastUsedAt: text('last_used_at'),
  errorCount: integer('error_count').notNull().default(0),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

export const notificationPreferences = pgTable('notification_preferences', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(), // FK → users(id) CASCADE
  tenantId: text('tenant_id').notNull(), // FK → tenants(id) CASCADE
  transactionAlerts: boolean('transaction_alerts').notNull().default(true),
  basReminders: boolean('bas_reminders').notNull().default(true),
  budgetAlerts: boolean('budget_alerts').notNull().default(true),
  taxReminders: boolean('tax_reminders').notNull().default(true),
  billReminders: boolean('bill_reminders').notNull().default(true),
  syncNotifications: boolean('sync_notifications').notNull().default(false),
  teamNotifications: boolean('team_notifications').notNull().default(true),
  systemNotifications: boolean('system_notifications').notNull().default(true),
  largeTransactionThresholdCents: integer('large_transaction_threshold_cents')
    .notNull()
    .default(100000),
  budgetAlertThresholdPercent: integer('budget_alert_threshold_percent').notNull().default(80),
  pushEnabled: boolean('push_enabled').notNull().default(true),
  emailEnabled: boolean('email_enabled').notNull().default(false),
  quietHoursStart: text('quiet_hours_start'),
  quietHoursEnd: text('quiet_hours_end'),
  timezone: text('timezone').default('Australia/Sydney'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

export const offlineSyncLog = pgTable('offline_sync_log', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(), // FK → users(id) CASCADE
  tenantId: text('tenant_id').notNull(), // FK → tenants(id) CASCADE
  deviceId: text('device_id').notNull(),
  operation: text('operation').notNull(),
  resourceType: text('resource_type').notNull(),
  resourceId: text('resource_id'),
  payloadJson: text('payload_json').notNull(),
  syncStatus: text('sync_status').notNull().default('pending'),
  conflictResolution: text('conflict_resolution'),
  conflictDetails: text('conflict_details'),
  serverVersion: integer('server_version'),
  clientVersion: integer('client_version'),
  syncedAt: text('synced_at'),
  errorMessage: text('error_message'),
  retryCount: integer('retry_count').notNull().default(0),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
});

// Type exports
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type NewPushSubscription = typeof pushSubscriptions.$inferInsert;
export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type NewNotificationPreference = typeof notificationPreferences.$inferInsert;
export type OfflineSyncLogRecord = typeof offlineSyncLog.$inferSelect;
export type NewOfflineSyncLogRecord = typeof offlineSyncLog.$inferInsert;
