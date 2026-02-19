import { pgTable, pgEnum, text, integer, boolean, jsonb } from 'drizzle-orm/pg-core';
import { users } from './core.js';

// IMPORTANT — CURRENT_TIMESTAMP in PostgreSQL:
// The wrapPgDb() proxy stores the literal string 'CURRENT_TIMESTAMP' in PostgreSQL
// instead of evaluating it. All inserts MUST set timestamp fields explicitly:
//   createdAt: new Date().toISOString()   (see repositories/*.ts)

// ============================================================================
// ENUMS
// ============================================================================

export const tenantRoleEnum = pgEnum('tenant_role', [
  'viewer',
  'bookkeeper',
  'accountant',
  'admin',
  'owner',
]);

// ============================================================================
// MULTI-TENANT (Wave 23)
// ============================================================================

export const tenants = pgTable('tenants', {
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
  settingsJson: jsonb('settings_json').$type<Record<string, unknown>>().default({}),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

export const tenantMembers = pgTable('tenant_members', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  role: tenantRoleEnum('role').notNull().default('viewer'),
  displayName: text('display_name'),
  isPrimaryContact: boolean('is_primary_contact').notNull().default(false),
  invitedBy: text('invited_by').references(() => users.id),
  joinedAt: text('joined_at').default('CURRENT_TIMESTAMP'),
  lastActiveAt: text('last_active_at'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

export const tenantInvitations = pgTable('tenant_invitations', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  role: tenantRoleEnum('role').notNull().default('viewer'),
  invitedBy: text('invited_by')
    .notNull()
    .references(() => users.id),
  token: text('token').notNull().unique(),
  status: text('status').notNull().default('pending'),
  expiresAt: text('expires_at').notNull(),
  acceptedAt: text('accepted_at'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
});

export const permissions = pgTable('permissions', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  resource: text('resource').notNull(),
  action: text('action').notNull(),
  isSystem: boolean('is_system').notNull().default(false),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
});

export const rolePermissions = pgTable('role_permissions', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  role: tenantRoleEnum('role').notNull(),
  permissionId: text('permission_id')
    .notNull()
    .references(() => permissions.id, { onDelete: 'cascade' }),
  grantedBy: text('granted_by').references(() => users.id),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
});

export const subscriptionPlans = pgTable('subscription_plans', {
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
  featuresJson: jsonb('features_json').$type<string[]>().default([]),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

export const subscriptionHistory = pgTable('subscription_history', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  planId: text('plan_id')
    .notNull()
    .references(() => subscriptionPlans.id),
  status: text('status').notNull().default('active'),
  billingCycle: text('billing_cycle').notNull().default('monthly'),
  currentPeriodStart: text('current_period_start').notNull(),
  currentPeriodEnd: text('current_period_end').notNull(),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
  cancelledAt: text('cancelled_at'),
  trialEnd: text('trial_end'),
  paymentMethodJson: text('payment_method_json'),
  usageJson: text('usage_json').default(
    '{"members":0,"accounts":0,"transactions":0,"aiQueries":0,"storageMb":0}',
  ),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

export const apiRateLimits = pgTable('api_rate_limits', {
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
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

// Type exports
export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
export type TenantMember = typeof tenantMembers.$inferSelect;
export type NewTenantMember = typeof tenantMembers.$inferInsert;
export type TenantInvitation = typeof tenantInvitations.$inferSelect;
export type NewTenantInvitation = typeof tenantInvitations.$inferInsert;
export type Permission = typeof permissions.$inferSelect;
export type NewPermission = typeof permissions.$inferInsert;
export type RolePermission = typeof rolePermissions.$inferSelect;
export type NewRolePermission = typeof rolePermissions.$inferInsert;
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type NewSubscriptionPlan = typeof subscriptionPlans.$inferInsert;
export type SubscriptionHistoryRecord = typeof subscriptionHistory.$inferSelect;
export type NewSubscriptionHistoryRecord = typeof subscriptionHistory.$inferInsert;
export type ApiRateLimit = typeof apiRateLimits.$inferSelect;
export type NewApiRateLimit = typeof apiRateLimits.$inferInsert;
