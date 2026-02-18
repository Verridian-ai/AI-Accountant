import { pgTable, text, integer, real, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './core.js';
import { accounts, statements, transactions } from './banking.js';

// =============================================================================
// CATEGORIZATION
// =============================================================================

export const userCategories = pgTable(
  'user_categories',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    categoryName: text('category_name').notNull(),
    parentCategory: text('parent_category'),
    icon: text('icon'),
    color: text('color'),
    isIncome: boolean('is_income').default(false),
    isTransfer: boolean('is_transfer').default(false),
    isHidden: boolean('is_hidden').default(false),
    sortOrder: integer('sort_order').default(0),
  },
  (table) => ({
    userCategoriesIdx: index('user_categories_idx').on(table.userId, table.categoryName),
  }),
);

export const merchantMemory = pgTable(
  'merchant_memory',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    merchantPattern: text('merchant_pattern').notNull(),
    merchantDisplayName: text('merchant_display_name'),
    category: text('category').notNull(),
    gstApplicable: boolean('gst_applicable').default(false),
    timesUsed: integer('times_used').default(1),
    lastUsed: timestamp('last_used', { withTimezone: true }).defaultNow().notNull(),
    isUserConfirmed: boolean('is_user_confirmed').default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userPatternIdx: index('merchant_user_pattern_idx').on(table.userId, table.merchantPattern),
    categoryIdx: index('merchant_category_idx').on(table.category),
  }),
);

export const pendingCategorization = pgTable(
  'pending_categorization',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    transactionId: text('transaction_id')
      .notNull()
      .references(() => transactions.id, { onDelete: 'cascade' }),
    suggestedCategory: text('suggested_category'),
    suggestedConfidence: real('suggested_confidence'),
    aiReasoning: text('ai_reasoning'),
    alternativeCategories: text('alternative_categories'), // JSON array
    status: text('status').notNull().default('pending'), // 'pending', 'approved', 'rejected', 'skipped'
    userSelectedCategory: text('user_selected_category'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (table) => ({
    userStatusIdx: index('pending_cat_user_status_idx').on(table.userId, table.status),
    transactionIdx: index('pending_cat_transaction_idx').on(table.transactionId),
  }),
);

// =============================================================================
// RECONCILIATION
// =============================================================================

export const reconciliationAlerts = pgTable(
  'reconciliation_alerts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    alertType: text('alert_type').notNull(), // 'balance_mismatch', 'duplicate_transaction', 'missing_transaction', 'gap_detected'
    // Values in cents
    expectedValue: integer('expected_value'),
    actualValue: integer('actual_value'),
    difference: integer('difference'),
    description: text('description').notNull(),
    statementId: text('statement_id').references(() => statements.id),
    isResolved: boolean('is_resolved').default(false),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolutionNotes: text('resolution_notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index('reconciliation_user_idx').on(table.userId, table.isResolved),
    accountIdx: index('reconciliation_account_idx').on(table.accountId),
  }),
);

// =============================================================================
// DEBT MANAGEMENT
// =============================================================================

export const debtPayoffScenarios = pgTable(
  'debt_payoff_scenarios',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    strategy: text('strategy').notNull(), // 'avalanche', 'snowball', 'custom'
    accountsIncluded: text('accounts_included').notNull(), // JSON array of account IDs
    // Budget in cents
    monthlyBudget: integer('monthly_budget'),
    projectedPayoffDate: text('projected_payoff_date'),
    // Costs in cents
    totalInterestCost: integer('total_interest_cost'),
    totalPayments: integer('total_payments'),
    monthlyBreakdown: text('monthly_breakdown'), // JSON
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index('debt_scenario_user_idx').on(table.userId),
  }),
);

export type MerchantMemory = typeof merchantMemory.$inferSelect;
export type NewMerchantMemory = typeof merchantMemory.$inferInsert;
export type ReconciliationAlert = typeof reconciliationAlerts.$inferSelect;
export type NewReconciliationAlert = typeof reconciliationAlerts.$inferInsert;
