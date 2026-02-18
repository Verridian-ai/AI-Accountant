import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './core.js';
import { tenants } from './multitenant.js';

// =============================================================================
// PWA SUPPORT (Wave 24)
// =============================================================================

export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
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
    isActive: boolean('is_active').notNull().default(true),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    errorCount: integer('error_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    userIdx: index('idx_pg_push_subscriptions_user').on(table.userId),
    tenantIdx: index('idx_pg_push_subscriptions_tenant').on(table.tenantId),
    activeIdx: index('idx_pg_push_subscriptions_active').on(table.isActive),
    endpointIdx: uniqueIndex('pg_push_subscriptions_endpoint_unique').on(table.endpoint),
  }),
);

export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
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
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    userTenantIdx: index('idx_pg_notification_preferences_user_tenant').on(
      table.userId,
      table.tenantId,
    ),
    userTenantUniqueIdx: uniqueIndex('pg_notification_preferences_user_tenant_unique').on(
      table.userId,
      table.tenantId,
    ),
  }),
);

export const offlineSyncLog = pgTable(
  'offline_sync_log',
  {
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
    syncedAt: timestamp('synced_at', { withTimezone: true }),
    errorMessage: text('error_message'),
    retryCount: integer('retry_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    userIdx: index('idx_pg_offline_sync_user').on(table.userId),
    statusIdx: index('idx_pg_offline_sync_status').on(table.syncStatus),
    deviceIdx: index('idx_pg_offline_sync_device').on(table.deviceId),
    pendingIdx: index('idx_pg_offline_sync_pending').on(table.syncStatus, table.createdAt),
  }),
);

export type PgPushSubscription = typeof pushSubscriptions.$inferSelect;
export type NewPgPushSubscription = typeof pushSubscriptions.$inferInsert;
export type PgNotificationPreference = typeof notificationPreferences.$inferSelect;
export type NewPgNotificationPreference = typeof notificationPreferences.$inferInsert;
export type PgOfflineSyncLog = typeof offlineSyncLog.$inferSelect;
export type NewPgOfflineSyncLog = typeof offlineSyncLog.$inferInsert;
