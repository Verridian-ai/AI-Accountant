import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { users } from './core.js';

// ============================================================================
// ACCOUNTS
// ============================================================================

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  accountNumber: text('account_number').notNull(),
  accountNumberHash: text('account_number_hash').notNull(),
  accountName: text('account_name').notNull(),
  accountType: text('account_type').notNull(),
  bankName: text('bank_name'),
  currentBalance: integer('current_balance').default(0),
  lastStatementDate: text('last_statement_date'),
  interestRate: real('interest_rate'),
  creditLimit: integer('credit_limit'),
  minimumPayment: integer('minimum_payment'),
  paymentDueDay: integer('payment_due_day'),
  linkedPaymentAccountId: text('linked_payment_account_id'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  ownershipTag: text('ownership_tag').default('business'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ============================================================================
// STATEMENTS
// ============================================================================

export const statements = sqliteTable('statements', {
  id: text('id').primaryKey(),
  filename: text('filename').notNull(),
  hash: text('hash').notNull().unique(),
  uploadDate: text('upload_date').notNull(),
  parsingStatus: text('parsing_status').notNull().default('PENDING'),
  aiModelUsed: text('ai_model_used'),
  errorMessage: text('error_message'),
  errorType: text('error_type'),
  errorDetails: text('error_details'),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  periodStartDate: text('period_start_date'),
  periodEndDate: text('period_end_date'),
  openingBalance: integer('opening_balance'),
  closingBalance: integer('closing_balance'),
  transactionCount: integer('transaction_count').default(0),
  isComplete: integer('is_complete', { mode: 'boolean' }).default(true),
  validationErrors: text('validation_errors'),
});

export const statementAccounts = sqliteTable('statement_accounts', {
  statementId: text('statement_id')
    .primaryKey()
    .references(() => statements.id, { onDelete: 'cascade' }),
  accountId: text('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
});

export const accountBalanceHistory = sqliteTable('account_balance_history', {
  id: text('id').primaryKey(),
  accountId: text('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  balance: integer('balance').notNull(),
  balanceDate: text('balance_date').notNull(),
  source: text('source').notNull(),
  statementId: text('statement_id').references(() => statements.id),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// Type exports
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type AccountBalanceHistoryRecord = typeof accountBalanceHistory.$inferSelect;
export type Statement = typeof statements.$inferSelect;
export type NewStatement = typeof statements.$inferInsert;
