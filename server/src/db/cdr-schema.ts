/**
 * CDR Open Banking Schema (Wave 18)
 * Consumer Data Right product tables for bank product comparison and rate alerts.
 * Uses sqliteTable() — the project-wide convention; wrapPgDb() proxies PG at runtime.
 */

import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { users } from '../schema/core.js';

// IMPORTANT — CURRENT_TIMESTAMP in PostgreSQL:
// The wrapPgDb() proxy stores the literal string 'CURRENT_TIMESTAMP' in PostgreSQL
// instead of evaluating it. All inserts MUST set timestamp fields explicitly:
//   createdAt: new Date().toISOString()   (see repositories/*.ts)

// ============================================================================
// CDR DATA HOLDERS
// ============================================================================

export const cdrDataHolders = sqliteTable('cdr_data_holders', {
  id: text('id').primaryKey(),
  dataHolderBrandId: text('data_holder_brand_id').notNull(),
  brandName: text('brand_name').notNull(),
  abn: text('abn'),
  acn: text('acn'),
  logoUri: text('logo_uri'),
  status: text('status').notNull().default('ACTIVE'),
  registerUri: text('register_uri').notNull(),
  publicBaseUri: text('public_base_uri').notNull(),
  industry: text('industry').notNull().default('banking'),
  lastCrawledAt: text('last_crawled_at'),
  productCount: integer('product_count').default(0),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ============================================================================
// CDR PRODUCTS
// ============================================================================

export const cdrProducts = sqliteTable('cdr_products', {
  id: text('id').primaryKey(),
  dataHolderId: text('data_holder_id')
    .notNull()
    .references(() => cdrDataHolders.id),
  productId: text('product_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  brand: text('brand'),
  brandName: text('brand_name'),
  productCategory: text('product_category').notNull(),
  isTailored: integer('is_tailored', { mode: 'boolean' }).default(false),
  effectiveFrom: text('effective_from'),
  effectiveTo: text('effective_to'),
  applicationUri: text('application_uri'),
  additionalInfoUri: text('additional_info_uri'),
  rawJson: text('raw_json'), // JSON stored as text via sqliteTable; JSONB in PG migration
  lastUpdated: text('last_updated'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ============================================================================
// CDR LENDING RATES
// ============================================================================

export const cdrLendingRates = sqliteTable('cdr_lending_rates', {
  id: text('id').primaryKey(),
  productId: text('product_id')
    .notNull()
    .references(() => cdrProducts.id, { onDelete: 'cascade' }),
  lendingRateType: text('lending_rate_type').notNull(),
  rate: real('rate').notNull(),
  comparisonRate: real('comparison_rate'),
  calculationFrequency: text('calculation_frequency'),
  applicationFrequency: text('application_frequency'),
  interestPaymentDue: text('interest_payment_due'),
  repaymentType: text('repayment_type'),
  loanPurpose: text('loan_purpose'),
  tiers: text('tiers'), // JSON stored as text; JSONB in PG migration
  additionalValue: text('additional_value'),
  additionalInfo: text('additional_info'),
  additionalInfoUri: text('additional_info_uri'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ============================================================================
// CDR DEPOSIT RATES
// ============================================================================

export const cdrDepositRates = sqliteTable('cdr_deposit_rates', {
  id: text('id').primaryKey(),
  productId: text('product_id')
    .notNull()
    .references(() => cdrProducts.id, { onDelete: 'cascade' }),
  depositRateType: text('deposit_rate_type').notNull(),
  rate: real('rate').notNull(),
  calculationFrequency: text('calculation_frequency'),
  applicationFrequency: text('application_frequency'),
  tiers: text('tiers'), // JSON stored as text; JSONB in PG migration
  additionalValue: text('additional_value'),
  additionalInfo: text('additional_info'),
  additionalInfoUri: text('additional_info_uri'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ============================================================================
// CDR FEES
// ============================================================================

export const cdrFees = sqliteTable('cdr_fees', {
  id: text('id').primaryKey(),
  productId: text('product_id')
    .notNull()
    .references(() => cdrProducts.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  feeType: text('fee_type').notNull(),
  amount: text('amount'),
  balanceRate: text('balance_rate'),
  transactionRate: text('transaction_rate'),
  accruedRate: text('accrued_rate'),
  accrualFrequency: text('accrual_frequency'),
  currency: text('currency').default('AUD'),
  additionalValue: text('additional_value'),
  additionalInfo: text('additional_info'),
  additionalInfoUri: text('additional_info_uri'),
  discounts: text('discounts'), // JSON stored as text; JSONB in PG migration
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ============================================================================
// CDR FEATURES
// ============================================================================

export const cdrFeatures = sqliteTable('cdr_features', {
  id: text('id').primaryKey(),
  productId: text('product_id')
    .notNull()
    .references(() => cdrProducts.id, { onDelete: 'cascade' }),
  featureType: text('feature_type').notNull(),
  additionalValue: text('additional_value'),
  additionalInfo: text('additional_info'),
  additionalInfoUri: text('additional_info_uri'),
  isActivated: integer('is_activated', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ============================================================================
// CDR ELIGIBILITY
// ============================================================================

export const cdrEligibility = sqliteTable('cdr_eligibility', {
  id: text('id').primaryKey(),
  productId: text('product_id')
    .notNull()
    .references(() => cdrProducts.id, { onDelete: 'cascade' }),
  eligibilityType: text('eligibility_type').notNull(),
  additionalValue: text('additional_value'),
  additionalInfo: text('additional_info'),
  additionalInfoUri: text('additional_info_uri'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ============================================================================
// CDR CRAWL LOG
// ============================================================================

export const cdrCrawlLog = sqliteTable('cdr_crawl_log', {
  id: text('id').primaryKey(),
  dataHolderId: text('data_holder_id').references(() => cdrDataHolders.id),
  crawlType: text('crawl_type').notNull(),
  status: text('status').notNull().default('running'),
  productsDiscovered: integer('products_discovered').default(0),
  productsUpdated: integer('products_updated').default(0),
  errors: text('errors'), // JSON stored as text; JSONB in PG migration
  startedAt: text('started_at').notNull().default('CURRENT_TIMESTAMP'),
  completedAt: text('completed_at'),
  durationMs: integer('duration_ms'),
});

// ============================================================================
// CDR RATE ALERTS
// ============================================================================

export const cdrRateAlerts = sqliteTable('cdr_rate_alerts', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  alertType: text('alert_type').notNull(),
  productCategory: text('product_category'),
  rateType: text('rate_type'),
  thresholdRate: real('threshold_rate'),
  comparisonProductId: text('comparison_product_id').references(() => cdrProducts.id),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  lastTriggeredAt: text('last_triggered_at'),
  notificationMethod: text('notification_method').default('in_app'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type CdrDataHolder = typeof cdrDataHolders.$inferSelect;
export type NewCdrDataHolder = typeof cdrDataHolders.$inferInsert;
export type CdrProduct = typeof cdrProducts.$inferSelect;
export type NewCdrProduct = typeof cdrProducts.$inferInsert;
export type CdrLendingRate = typeof cdrLendingRates.$inferSelect;
export type NewCdrLendingRate = typeof cdrLendingRates.$inferInsert;
export type CdrDepositRate = typeof cdrDepositRates.$inferSelect;
export type NewCdrDepositRate = typeof cdrDepositRates.$inferInsert;
export type CdrFee = typeof cdrFees.$inferSelect;
export type NewCdrFee = typeof cdrFees.$inferInsert;
export type CdrFeature = typeof cdrFeatures.$inferSelect;
export type NewCdrFeature = typeof cdrFeatures.$inferInsert;
export type CdrEligibility = typeof cdrEligibility.$inferSelect;
export type NewCdrEligibility = typeof cdrEligibility.$inferInsert;
export type CdrCrawlLog = typeof cdrCrawlLog.$inferSelect;
export type NewCdrCrawlLog = typeof cdrCrawlLog.$inferInsert;
export type CdrRateAlert = typeof cdrRateAlerts.$inferSelect;
export type NewCdrRateAlert = typeof cdrRateAlerts.$inferInsert;
