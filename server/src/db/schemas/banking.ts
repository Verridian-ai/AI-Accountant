import {
  pgTable,
  text,
  integer,
  real,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './core.js';

// =============================================================================
// ACCOUNTS
// =============================================================================

export const accounts = pgTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountNumber: text('account_number').notNull(),
    accountNumberHash: text('account_number_hash').notNull(),
    accountName: text('account_name').notNull(),
    accountType: text('account_type').notNull(), // 'checking', 'savings', 'credit_card', 'loan'
    bankName: text('bank_name'),
    // Currency amounts stored as cents (BIGINT) for precision
    currentBalance: integer('current_balance').default(0),
    lastStatementDate: text('last_statement_date'),
    // Percentage stored as decimal (e.g., 0.0525 for 5.25%)
    interestRate: real('interest_rate'),
    // Currency amounts
    creditLimit: integer('credit_limit'),
    minimumPayment: integer('minimum_payment'),
    paymentDueDay: integer('payment_due_day'),
    linkedPaymentAccountId: text('linked_payment_account_id'),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('accounts_user_id_idx').on(table.userId),
    hashIdx: index('accounts_hash_idx').on(table.accountNumberHash),
  }),
);

// =============================================================================
// STATEMENTS
// =============================================================================

export const statements = pgTable(
  'statements',
  {
    id: text('id').primaryKey(),
    filename: text('filename').notNull(),
    hash: text('hash').notNull().unique(),
    uploadDate: timestamp('upload_date', { withTimezone: true }).defaultNow().notNull(),
    parsingStatus: text('parsing_status').notNull().default('PENDING'),
    aiModelUsed: text('ai_model_used'),
    errorMessage: text('error_message'),
    errorType: text('error_type'),
    errorDetails: text('error_details'),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    periodStartDate: text('period_start_date'),
    periodEndDate: text('period_end_date'),
    // Balances in cents
    openingBalance: integer('opening_balance'),
    closingBalance: integer('closing_balance'),
    transactionCount: integer('transaction_count').default(0),
    isComplete: boolean('is_complete').default(true),
    validationErrors: text('validation_errors'), // JSON array of errors
  },
  (table) => ({
    hashIdx: uniqueIndex('statements_hash_unique').on(table.hash),
    userIdIdx: index('statements_user_id_idx').on(table.userId),
    uploadDateIdx: index('statements_upload_date_idx').on(table.uploadDate),
    userDateIdx: index('statements_user_date_idx').on(table.userId, table.uploadDate),
    periodIdx: index('statements_period_idx').on(table.periodStartDate, table.periodEndDate),
  }),
);

export const statementAccounts = pgTable('statement_accounts', {
  statementId: text('statement_id')
    .primaryKey()
    .references(() => statements.id, { onDelete: 'cascade' }),
  accountId: text('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
});

export const accountBalanceHistory = pgTable(
  'account_balance_history',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    // Balance in cents
    balance: integer('balance').notNull(),
    balanceDate: text('balance_date').notNull(),
    source: text('source').notNull(), // 'statement', 'manual', 'calculated'
    statementId: text('statement_id').references(() => statements.id),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    accountDateIdx: index('balance_history_account_date_idx').on(
      table.accountId,
      table.balanceDate,
    ),
  }),
);

// =============================================================================
// TRANSACTIONS
// =============================================================================

export const transactions = pgTable(
  'transactions',
  {
    id: text('id').primaryKey(),
    date: text('date').notNull(), // ISO date string YYYY-MM-DD
    description: text('description').notNull(),
    // Amount in cents (positive = credit, negative = debit)
    amount: integer('amount').notNull(),
    // Balance in cents
    balance: integer('balance'),
    category: text('category'),
    gstApplicable: boolean('gst_applicable').default(false),
    aiReasoningNotes: text('ai_reasoning_notes'),
    confidenceScore: real('confidence_score').default(1.0),
    isEdited: boolean('is_edited').default(false),
    isTransfer: boolean('is_transfer').default(false),
    transferLinkId: text('transfer_link_id'),
    merchantNormalized: text('merchant_normalized'),
    parentTransactionId: text('parent_transaction_id'),
    statementId: text('statement_id').references(() => statements.id, {
      onDelete: 'set null',
    }),
    accountId: text('account_id').references(() => accounts.id, {
      onDelete: 'set null',
    }),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => ({
    dateIdx: index('transactions_date_idx').on(table.date),
    userIdIdx: index('transactions_user_id_idx').on(table.userId),
    statementIdIdx: index('transactions_statement_id_idx').on(table.statementId),
    categoryIdx: index('transactions_category_idx').on(table.category),
    userDateIdx: index('transactions_user_date_idx').on(table.userId, table.date),
    accountIdIdx: index('transactions_account_id_idx').on(table.accountId),
    transferIdx: index('transactions_transfer_idx').on(table.isTransfer, table.transferLinkId),
  }),
);

export const transactionHistory = pgTable(
  'transaction_history',
  {
    id: text('id').primaryKey(),
    transactionId: text('transaction_id').references(() => transactions.id, {
      onDelete: 'set null',
    }),
    changeType: text('change_type').notNull(), // 'create', 'update', 'delete', 'split', 'merge'
    oldData: text('old_data'), // JSON
    newData: text('new_data'), // JSON
    timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    transactionIdIdx: index('transaction_history_transaction_idx').on(table.transactionId),
    timestampIdx: index('transaction_history_timestamp_idx').on(table.timestamp),
  }),
);

// =============================================================================
// TRANSFERS
// =============================================================================

export const transferLinks = pgTable(
  'transfer_links',
  {
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
    // Amount in cents
    amount: integer('amount').notNull(),
    transferDate: text('transfer_date').notNull(),
    confidence: real('confidence').default(1.0),
    isUserConfirmed: boolean('is_user_confirmed').default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index('transfer_links_user_idx').on(table.userId),
    sourceIdx: index('transfer_links_source_idx').on(table.sourceTransactionId),
    destIdx: index('transfer_links_dest_idx').on(table.destinationTransactionId),
  }),
);

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Statement = typeof statements.$inferSelect;
export type NewStatement = typeof statements.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type TransferLink = typeof transferLinks.$inferSelect;
export type NewTransferLink = typeof transferLinks.$inferInsert;
