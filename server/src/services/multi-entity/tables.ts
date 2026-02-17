/**
 * Multi-Entity Local Table Definitions
 *
 * Local SQLite table definitions (mirrors schema.ts definitions).
 * Will be replaced with imports once schema.ts is updated.
 */

import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const entities = sqliteTable('entities', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  entityType: text('entity_type').notNull(),
  abn: text('abn'),
  acn: text('acn'),
  tfn: text('tfn'),
  parentEntityId: text('parent_entity_id'),
  isConsolidatedParent: integer('is_consolidated_parent', { mode: 'boolean' }).default(false),
  financialYearEnd: text('financial_year_end').default('06-30'),
  reportingCurrency: text('reporting_currency').default('AUD'),
  status: text('status').default('active'),
  address: text('address'),
  contactEmail: text('contact_email'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

export const entityAccounts = sqliteTable('entity_accounts', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull(),
  accountId: text('account_id').notNull(),
  role: text('role').notNull().default('operating'),
  ownershipPercentage: real('ownership_percentage').default(100.0),
  linkedAt: text('linked_at').default('CURRENT_TIMESTAMP'),
});

export const entitySettings = sqliteTable('entity_settings', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull(),
  basReportingFrequency: text('bas_reporting_frequency').default('quarterly'),
  gstRegistered: integer('gst_registered', { mode: 'boolean' }).default(false),
  gstMethod: text('gst_method').default('cash'),
  taxRate: real('tax_rate'),
  lodgementDueDates: text('lodgement_due_dates'),
  defaultDepreciationMethod: text('default_depreciation_method').default('diminishing_value'),
  instantWriteOffThreshold: integer('instant_write_off_threshold').default(2000000),
  chartOfAccountsTemplate: text('chart_of_accounts_template'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

export const interEntityTransactions = sqliteTable('inter_entity_transactions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  fromEntityId: text('from_entity_id').notNull(),
  toEntityId: text('to_entity_id').notNull(),
  fromTransactionId: text('from_transaction_id'),
  toTransactionId: text('to_transaction_id'),
  amount: integer('amount').notNull(),
  description: text('description'),
  transactionDate: text('transaction_date').notNull(),
  transactionType: text('transaction_type').notNull(),
  status: text('status').default('pending'),
  confirmedByFrom: integer('confirmed_by_from', { mode: 'boolean' }).default(false),
  confirmedByTo: integer('confirmed_by_to', { mode: 'boolean' }).default(false),
  eliminationGroupId: text('elimination_group_id'),
  notes: text('notes'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
});

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  accountNumber: text('account_number').notNull(),
  accountName: text('account_name').notNull(),
  accountType: text('account_type').notNull(),
  bankName: text('bank_name'),
  currentBalance: integer('current_balance').default(0),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
});
