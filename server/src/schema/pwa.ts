import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { users } from './core.js';
import { tenants } from './multitenant.js';

// IMPORTANT — CURRENT_TIMESTAMP in PostgreSQL:
// The wrapPgDb() proxy stores the literal string 'CURRENT_TIMESTAMP' in PostgreSQL
// instead of evaluating it. All inserts MUST set timestamp fields explicitly:
//   createdAt: new Date().toISOString()   (see repositories/*.ts)

// ============================================================================
// PWA SUPPORT (Wave 24)
// ============================================================================

export const pushSubscriptions = sqliteTable('push_subscriptions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull().unique(),
  keysJson: text('keys_json').notNull(),
  userAgent: text('user_agent'),
  deviceName: text('device_name'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  lastUsedAt: text('last_used_at'),
  errorCount: integer('error_count').notNull().default(0),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

export const notificationPreferences = sqliteTable('notification_preferences', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  transactionAlerts: integer('transaction_alerts', { mode: 'boolean' }).notNull().default(true),
  basReminders: integer('bas_reminders', { mode: 'boolean' }).notNull().default(true),
  budgetAlerts: integer('budget_alerts', { mode: 'boolean' }).notNull().default(true),
  taxReminders: integer('tax_reminders', { mode: 'boolean' }).notNull().default(true),
  billReminders: integer('bill_reminders', { mode: 'boolean' }).notNull().default(true),
  syncNotifications: integer('sync_notifications', { mode: 'boolean' }).notNull().default(false),
  teamNotifications: integer('team_notifications', { mode: 'boolean' }).notNull().default(true),
  systemNotifications: integer('system_notifications', { mode: 'boolean' }).notNull().default(true),
  largeTransactionThresholdCents: integer('large_transaction_threshold_cents')
    .notNull()
    .default(100000),
  budgetAlertThresholdPercent: integer('budget_alert_threshold_percent').notNull().default(80),
  pushEnabled: integer('push_enabled', { mode: 'boolean' }).notNull().default(true),
  emailEnabled: integer('email_enabled', { mode: 'boolean' }).notNull().default(false),
  quietHoursStart: text('quiet_hours_start'),
  quietHoursEnd: text('quiet_hours_end'),
  timezone: text('timezone').default('Australia/Sydney'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

export const offlineSyncLog = sqliteTable('offline_sync_log', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
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
