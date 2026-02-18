import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { users } from './core.js';
import { accounts, statements } from './banking.js';

// IMPORTANT — CURRENT_TIMESTAMP in PostgreSQL:
// The wrapPgDb() proxy stores the literal string 'CURRENT_TIMESTAMP' in PostgreSQL
// instead of evaluating it. All inserts MUST set timestamp fields explicitly:
//   createdAt: new Date().toISOString()   (see repositories/*.ts)

// ============================================================================
// TRANSACTIONS
// ============================================================================

export const transactions = sqliteTable(
  'transactions',
  {
    id: text('id').primaryKey(),
    date: text('date').notNull(),
    description: text('description').notNull(),
    amount: integer('amount').notNull(),
    balance: integer('balance'),
    category: text('category'),
    gstApplicable: integer('gst_applicable', { mode: 'boolean' }).default(false),
    gstAmount: integer('gst_amount').default(0),
    gstCategory: text('gst_category'),
    aiReasoningNotes: text('ai_reasoning_notes'),
    confidenceScore: real('confidence_score').default(1.0),
    isEdited: integer('is_edited', { mode: 'boolean' }).default(false),
    isTransfer: integer('is_transfer', { mode: 'boolean' }).default(false),
    transferLinkId: text('transfer_link_id'),
    isOwnerContribution: integer('is_owner_contribution', { mode: 'boolean' }).default(false),
    transactionHash: text('transaction_hash'),
    merchantNormalized: text('merchant_normalized'),
    parserVersion: text('parser_version'),
    extractionHash: text('extraction_hash'),
    parentTransactionId: text('parent_transaction_id'),
    statementId: text('statement_id').references(() => statements.id, { onDelete: 'set null' }),
    accountId: text('account_id').references(() => accounts.id, { onDelete: 'set null' }),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  },
  (t) => ({
    userIdx: index('idx_transactions_user_id').on(t.userId),
    userAccountDateIdx: index('idx_transactions_user_account_date').on(
      t.userId,
      t.accountId,
      t.date,
    ),
    dateIdx: index('idx_transactions_date').on(t.date),
    categoryIdx: index('idx_transactions_category').on(t.category),
  }),
);

export const transactionHistory = sqliteTable('transaction_history', {
  id: text('id').primaryKey(),
  transactionId: text('transaction_id').references(() => transactions.id, { onDelete: 'set null' }),
  changeType: text('change_type').notNull(),
  oldData: text('old_data'),
  newData: text('new_data'),
  timestamp: text('timestamp').notNull().default('CURRENT_TIMESTAMP'),
});

// ============================================================================
// TRANSFERS
// ============================================================================

export const transferLinks = sqliteTable('transfer_links', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  sourceTransactionId: text('source_transaction_id')
    .notNull()
    .references(() => transactions.id, { onDelete: 'cascade' }),
  destinationTransactionId: text('destination_transaction_id')
    .notNull()
    .references(() => transactions.id, { onDelete: 'cascade' }),
  sourceAccountId: text('source_account_id').references(() => accounts.id),
  destinationAccountId: text('destination_account_id').references(() => accounts.id),
  amount: integer('amount').notNull(),
  transferDate: text('transfer_date').notNull(),
  confidence: real('confidence').default(1.0),
  isUserConfirmed: integer('is_user_confirmed', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ============================================================================
// CATEGORIZATION
// ============================================================================

export const merchantMemory = sqliteTable('merchant_memory', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  merchantPattern: text('merchant_pattern').notNull(),
  merchantDisplayName: text('merchant_display_name'),
  category: text('category').notNull(),
  gstApplicable: integer('gst_applicable', { mode: 'boolean' }).default(false),
  timesUsed: integer('times_used').default(1),
  lastUsed: text('last_used').notNull().default('CURRENT_TIMESTAMP'),
  isUserConfirmed: integer('is_user_confirmed', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const pendingCategorization = sqliteTable('pending_categorization', {
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
  alternativeCategories: text('alternative_categories'),
  status: text('status').notNull().default('pending'),
  userSelectedCategory: text('user_selected_category'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  resolvedAt: text('resolved_at'),
});

// ============================================================================
// RECONCILIATION
// ============================================================================

export const reconciliationAlerts = sqliteTable('reconciliation_alerts', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  accountId: text('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  alertType: text('alert_type').notNull(),
  expectedValue: integer('expected_value'),
  actualValue: integer('actual_value'),
  difference: integer('difference'),
  description: text('description').notNull(),
  statementId: text('statement_id').references(() => statements.id),
  isResolved: integer('is_resolved', { mode: 'boolean' }).default(false),
  resolvedAt: text('resolved_at'),
  resolutionNotes: text('resolution_notes'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// Type exports
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type TransactionHistoryRecord = typeof transactionHistory.$inferSelect;
export type TransferLink = typeof transferLinks.$inferSelect;
export type MerchantMemoryRecord = typeof merchantMemory.$inferSelect;
export type PendingCategorizationRecord = typeof pendingCategorization.$inferSelect;
export type ReconciliationAlert = typeof reconciliationAlerts.$inferSelect;
