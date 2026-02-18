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

// =============================================================================
// MULTI-TENANT (Wave 23)
// =============================================================================

export const tenants = pgTable(
  'tenants',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    logoUrl: text('logo_url'),
    primaryContactEmail: text('primary_contact_email'),
    abn: text('abn'),
    entityType: text('entity_type'),
    industry: text('industry'),
    financialYearEnd: text('financial_year_end').default('06-30'),
    timezone: text('timezone').default('Australia/Sydney'),
    settingsJson: text('settings_json').default('{}'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    slugIdx: uniqueIndex('tenants_slug_unique').on(table.slug),
  }),
);

export const tenantMembers = pgTable(
  'tenant_members',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('viewer'),
    displayName: text('display_name'),
    isPrimaryContact: boolean('is_primary_contact').notNull().default(false),
    invitedBy: text('invited_by').references(() => users.id),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow(),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    tenantIdx: index('idx_tenant_members_tenant').on(table.tenantId),
    userIdx: index('idx_tenant_members_user').on(table.userId),
    tenantRoleIdx: index('idx_tenant_members_role').on(table.tenantId, table.role),
  }),
);

export const tenantInvitations = pgTable(
  'tenant_invitations',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: text('role').notNull().default('viewer'),
    invitedBy: text('invited_by')
      .notNull()
      .references(() => users.id),
    token: text('token').notNull().unique(),
    status: text('status').notNull().default('pending'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    emailIdx: index('idx_tenant_invitations_email').on(table.email),
    tokenIdx: uniqueIndex('idx_tenant_invitations_token').on(table.token),
    tenantStatusIdx: index('idx_tenant_invitations_status').on(table.tenantId, table.status),
  }),
);

export const permissions = pgTable(
  'permissions',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull().unique(),
    description: text('description'),
    resource: text('resource').notNull(),
    action: text('action').notNull(),
    isSystem: boolean('is_system').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    nameIdx: uniqueIndex('permissions_name_unique').on(table.name),
  }),
);

export const rolePermissions = pgTable(
  'role_permissions',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    permissionId: text('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
    grantedBy: text('granted_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    tenantRoleIdx: index('idx_role_permissions_tenant_role').on(table.tenantId, table.role),
  }),
);

export const subscriptionPlans = pgTable(
  'subscription_plans',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull().unique(),
    displayName: text('display_name').notNull(),
    description: text('description'),
    priceMonthlyCents: integer('price_monthly_cents').notNull().default(0),
    priceAnnualCents: integer('price_annual_cents').notNull().default(0),
    maxMembers: integer('max_members').notNull().default(1),
    maxAccounts: integer('max_accounts').notNull().default(2),
    maxTransactionsPerMonth: integer('max_transactions_per_month').notNull().default(500),
    maxAiQueriesPerMonth: integer('max_ai_queries_per_month').notNull().default(50),
    maxStorageMb: integer('max_storage_mb').notNull().default(100),
    featuresJson: text('features_json').default('[]'),
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    nameIdx: uniqueIndex('subscription_plans_name_unique').on(table.name),
  }),
);

export const subscriptionHistory = pgTable(
  'subscription_history',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    planId: text('plan_id')
      .notNull()
      .references(() => subscriptionPlans.id),
    status: text('status').notNull().default('active'),
    billingCycle: text('billing_cycle').notNull().default('monthly'),
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true }).notNull(),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }).notNull(),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    trialEnd: timestamp('trial_end', { withTimezone: true }),
    paymentMethodJson: text('payment_method_json'),
    usageJson: text('usage_json').default(
      '{"members":0,"accounts":0,"transactions":0,"aiQueries":0,"storageMb":0}',
    ),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    tenantIdx: index('idx_subscription_history_tenant').on(table.tenantId),
    tenantStatusIdx: index('idx_subscription_history_status').on(table.tenantId, table.status),
  }),
);

export const apiRateLimits = pgTable(
  'api_rate_limits',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    endpointPattern: text('endpoint_pattern').notNull(),
    requestsPerMinute: integer('requests_per_minute').notNull().default(60),
    requestsPerHour: integer('requests_per_hour').notNull().default(1000),
    requestsPerDay: integer('requests_per_day').notNull().default(10000),
    burstLimit: integer('burst_limit').notNull().default(10),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    tenantIdx: index('idx_api_rate_limits_tenant').on(table.tenantId),
  }),
);

export type PgTenant = typeof tenants.$inferSelect;
export type NewPgTenant = typeof tenants.$inferInsert;
export type PgTenantMember = typeof tenantMembers.$inferSelect;
export type NewPgTenantMember = typeof tenantMembers.$inferInsert;
export type PgTenantInvitation = typeof tenantInvitations.$inferSelect;
export type NewPgTenantInvitation = typeof tenantInvitations.$inferInsert;
export type PgPermission = typeof permissions.$inferSelect;
export type NewPgPermission = typeof permissions.$inferInsert;
export type PgRolePermission = typeof rolePermissions.$inferSelect;
export type NewPgRolePermission = typeof rolePermissions.$inferInsert;
export type PgSubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type NewPgSubscriptionPlan = typeof subscriptionPlans.$inferInsert;
export type PgSubscriptionHistory = typeof subscriptionHistory.$inferSelect;
export type NewPgSubscriptionHistory = typeof subscriptionHistory.$inferInsert;
export type PgApiRateLimit = typeof apiRateLimits.$inferSelect;
export type NewPgApiRateLimit = typeof apiRateLimits.$inferInsert;
