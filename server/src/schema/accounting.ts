import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { users } from './core.js';
import { accounts, statements } from './banking.js';
import { transactions } from './transactions.js';

// ============================================================================
// EXPORTS & REPORTS
// ============================================================================

export const exportHistory = sqliteTable('export_history', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  exportType: text('export_type').notNull(),
  format: text('format').notNull(),
  parameters: text('parameters'),
  filters: text('filters'),
  dateRange: text('date_range'),
  filePath: text('file_path'),
  fileSize: integer('file_size'),
  fileSizeBytes: integer('file_size_bytes'),
  recordCount: integer('record_count'),
  status: text('status').notNull().default('pending'),
  errorMessage: text('error_message'),
  expiresAt: text('expires_at'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  completedAt: text('completed_at'),
});

// ============================================================================
// LEDGER & ACCOUNTING
// ============================================================================

export const chartOfAccounts = sqliteTable('chart_of_accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  parentId: text('parent_id'),
  isSystem: integer('is_system', { mode: 'boolean' }).default(false),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  accountCode: text('account_code'),
  accountName: text('account_name'),
  accountType: text('account_type'),
  normalBalance: text('normal_balance'),
  taxCode: text('tax_code'),
  basLabel: text('bas_label'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const journalEntries = sqliteTable('journal_entries', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  entryDate: text('entry_date').notNull(),
  reference: text('reference'),
  description: text('description').notNull(),
  transactionId: text('transaction_id').references(() => transactions.id, { onDelete: 'set null' }),
  isAuto: integer('is_auto', { mode: 'boolean' }).default(false),
  status: text('status').notNull().default('draft'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  postedAt: text('posted_at'),
});

export const journalEntryLines = sqliteTable('journal_entry_lines', {
  id: text('id').primaryKey(),
  entryId: text('entry_id')
    .notNull()
    .references(() => journalEntries.id, { onDelete: 'cascade' }),
  accountId: text('account_id')
    .notNull()
    .references(() => chartOfAccounts.id),
  debit: integer('debit').default(0),
  credit: integer('credit').default(0),
  description: text('description'),
  lineOrder: integer('line_order').notNull().default(0),
  journalEntryId: text('journal_entry_id'),
  debitAmount: integer('debit_amount'),
  creditAmount: integer('credit_amount'),
});

export const accountingPeriods = sqliteTable('accounting_periods', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  status: text('status').notNull().default('open'),
  closedAt: text('closed_at'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const accountBalances = sqliteTable('account_balances', {
  id: text('id').primaryKey(),
  chartAccountId: text('chart_account_id')
    .notNull()
    .references(() => chartOfAccounts.id, { onDelete: 'cascade' }),
  periodId: text('period_id')
    .notNull()
    .references(() => accountingPeriods.id, { onDelete: 'cascade' }),
  openingBalance: integer('opening_balance').notNull().default(0),
  debits: integer('debits').notNull().default(0),
  credits: integer('credits').notNull().default(0),
  closingBalance: integer('closing_balance').notNull().default(0),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ============================================================================
// UPLOAD QUEUE
// ============================================================================

export const uploadQueue = sqliteTable('upload_queue', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  batchId: text('batch_id').notNull(),
  filename: text('filename').notNull(),
  originalName: text('original_name').notNull(),
  size: integer('size').notNull(),
  mimeType: text('mime_type').notNull(),
  state: text('state').notNull().default('pending'),
  priority: text('priority').notNull().default('normal'),
  statementId: text('statement_id').references(() => statements.id),
  error: text('error'),
  retryCount: integer('retry_count').default(0),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  processedAt: text('processed_at'),
});

// ============================================================================
// OWNER EQUITY EVENTS (Wave 12)
// ============================================================================

export const ownerEquityEvents = sqliteTable('owner_equity_events', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  accountId: text('account_id').references(() => accounts.id, { onDelete: 'set null' }),
  transactionId: text('transaction_id').references(() => transactions.id, { onDelete: 'set null' }),
  eventType: text('event_type').notNull(),
  amount: integer('amount').notNull(),
  detectedBy: text('detected_by'),
  confirmed: integer('confirmed', { mode: 'boolean' }).default(false),
  financialYear: text('financial_year').notNull(),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const economicDataCache = sqliteTable('economic_data_cache', {
  id: text('id').primaryKey(),
  dataSource: text('data_source').notNull(),
  dataKey: text('data_key').notNull(),
  dataValue: text('data_value'),
  fetchedAt: text('fetched_at').notNull().default('CURRENT_TIMESTAMP'),
  expiresAt: text('expires_at'),
});

// Type exports
export type ExportHistoryRecord = typeof exportHistory.$inferSelect;
export type ChartOfAccountsEntry = typeof chartOfAccounts.$inferSelect;
export type JournalEntry = typeof journalEntries.$inferSelect;
export type JournalEntryLine = typeof journalEntryLines.$inferSelect;
export type AccountingPeriod = typeof accountingPeriods.$inferSelect;
export type AccountBalance = typeof accountBalances.$inferSelect;
export type UploadQueueItem = typeof uploadQueue.$inferSelect;
