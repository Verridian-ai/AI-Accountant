/**
 * SQLite Schema for AI Accountant
 * Used with Drizzle ORM + better-sqlite3/libsql (local) or PostgreSQL (production)
 */

import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { drizzle as drizzleSqlite } from 'drizzle-orm/libsql';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { createClient } from '@libsql/client';
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

// ============================================================================
// DATABASE CONNECTION
// ============================================================================

const isProduction = process.env.NODE_ENV === 'production';
const dbUrl = process.env.DATABASE_URL || 'file:sqlite.db';
const usePostgres =
  isProduction || dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://');

/** SQLite-compat query builder that adds .get()/.all()/.run() to PG query chains */
interface SqliteCompatQuery<T = unknown> {
  get(): Promise<T | undefined>;
  all(): Promise<T[]>;
  run(): Promise<void>;
  where(...args: unknown[]): SqliteCompatQuery<T>;
  set(...args: unknown[]): SqliteCompatQuery<T>;
  values(...args: unknown[]): SqliteCompatQuery<T>;
  from(...args: unknown[]): SqliteCompatQuery<T>;
  leftJoin(...args: unknown[]): SqliteCompatQuery<T>;
  orderBy(...args: unknown[]): SqliteCompatQuery<T>;
  [key: string]: unknown;
}

/**
 * Create a Proxy wrapper around the PostgreSQL db to intercept query chains
 * and add .get() / .all() / .run() methods that are SQLite-specific.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Proxy wraps Drizzle's dynamic PG database object
function wrapPgDb(pgDb: any): any {
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === 'function') {
        return function (this: unknown, ...args: unknown[]) {
          const result = (value as Function).apply(target, args);
          // Wrap the result in a proxy to add .get()/.all()/.run()
          if (result && typeof result === 'object' && typeof (result as PromiseLike<unknown>).then === 'function') {
            return addSqliteCompat(result as Record<string, unknown>);
          }
          if (result && typeof result === 'object') {
            return addSqliteCompat(result as Record<string, unknown>);
          }
          return result;
        };
      }
      return value;
    },
  };
  return new Proxy(pgDb, handler);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Proxy wraps dynamic Drizzle query chain objects
function addSqliteCompat(obj: Record<string, unknown>): any {
  if (!obj || typeof obj !== 'object') return obj;
  // Avoid double-wrapping
  if (obj.__pgWrapped) return obj;

  return new Proxy(obj, {
    get(target, prop, receiver) {
      if (prop === '__pgWrapped') return true;
      if (prop === 'get') {
        return async function () {
          const rows = await (target as unknown as PromiseLike<unknown>);
          return Array.isArray(rows) ? (rows[0] ?? undefined) : rows;
        };
      }
      if (prop === 'all') {
        return async function () {
          const rows = await (target as unknown as PromiseLike<unknown>);
          return Array.isArray(rows) ? rows : [rows];
        };
      }
      if (prop === 'run') {
        return async function () {
          return await (target as unknown as PromiseLike<unknown>);
        };
      }
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === 'function') {
        return function (this: unknown, ...args: unknown[]) {
          const result = (value as Function).apply(target, args);
          if (result && typeof result === 'object') {
            return addSqliteCompat(result as Record<string, unknown>);
          }
          return result;
        };
      }
      return value;
    },
  });
}

function createDb() {
  if (usePostgres) {
    console.log('[DB] Using PostgreSQL');
    const pool = new pg.Pool({
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'ai_accountant',
      user: process.env.DB_USER || 'app_user',
      password: process.env.DB_PASSWORD,
      ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
      max: 20,
    });
    const pgDb = drizzlePg(pool);
    console.log('[DB] PostgreSQL compatibility layer applied (get/all/run via Proxy)');
    return wrapPgDb(pgDb);
  } else {
    console.log('[DB] Using SQLite');
    const client = createClient({ url: dbUrl });
    return drizzleSqlite(client);
  }
}

export const db = createDb();

// ============================================================================
// USERS & AUTHENTICATION
// ============================================================================

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const userSettings = sqliteTable('user_settings', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  modelParsingText: text('model_parsing_text').notNull().default('google/gemini-3-flash-preview'),
  modelParsingVision: text('model_parsing_vision')
    .notNull()
    .default('google/gemini-3-flash-preview'),
  modelCategorization: text('model_categorization')
    .notNull()
    .default('google/gemini-3-flash-preview'),
  modelChat: text('model_chat').notNull().default('google/gemini-3-flash-preview'),
  modelEmbedding: text('model_embedding').notNull().default('openai/text-embedding-3-large'),
});

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

// ============================================================================
// TRANSACTIONS
// ============================================================================

export const transactions = sqliteTable('transactions', {
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
});

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

// ============================================================================
// BUSINESS PROFILES
// ============================================================================

export const businessProfiles = sqliteTable('business_profiles', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  businessName: text('business_name').notNull(),
  abn: text('abn'),
  entityType: text('entity_type').notNull().default('sole_trader'),
  industry: text('industry'),
  basFrequency: text('bas_frequency').default('quarterly'),
  gstRegistered: integer('gst_registered', { mode: 'boolean' }).default(false),
  financialYearEnd: text('financial_year_end').default('06-30'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ============================================================================
// TAX & BAS
// ============================================================================

export const basPeriods = sqliteTable('bas_periods', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  financialYear: text('financial_year').notNull(),
  quarter: integer('quarter').notNull(),
  periodType: text('period_type').notNull().default('quarterly'),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  dueDate: text('due_date'),
  lodgementDue: text('lodgement_due'),
  lodgementDate: text('lodgement_date'),
  accountingMethod: text('accounting_method').notNull().default('cash'),
  status: text('status').notNull().default('draft'),
  lodgedAt: text('lodged_at'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const basCalculations = sqliteTable('bas_calculations', {
  id: text('id').primaryKey(),
  basPeriodId: text('bas_period_id')
    .notNull()
    .references(() => basPeriods.id, { onDelete: 'cascade' }),
  periodId: text('period_id').references(() => basPeriods.id, { onDelete: 'cascade' }),
  label: text('label'),
  value: integer('value').default(0),
  labelG1: integer('label_g1').default(0),
  labelG2: integer('label_g2').default(0),
  labelG3: integer('label_g3').default(0),
  labelG10: integer('label_g10').default(0),
  labelG11: integer('label_g11').default(0),
  label1A: integer('label_1a').default(0),
  label1B: integer('label_1b').default(0),
  labelW1: integer('label_w1').default(0),
  labelW2: integer('label_w2').default(0),
  label5A: integer('label_5a').default(0),
  label7C: integer('label_7c').default(0),
  label7D: integer('label_7d').default(0),
  amountOwing: integer('amount_owing').default(0),
  refundDue: integer('refund_due').default(0),
  calculatedAt: text('calculated_at').notNull().default('CURRENT_TIMESTAMP'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const taxCodes = sqliteTable('tax_codes', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  description: text('description').notNull(),
  rate: real('rate').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
});

export const taxBrackets = sqliteTable('tax_brackets', {
  id: text('id').primaryKey(),
  taxYear: text('tax_year').notNull(),
  financialYear: text('financial_year'),
  minIncome: integer('min_income').notNull(),
  maxIncome: integer('max_income'),
  baseTax: integer('base_tax').notNull().default(0),
  rate: real('rate').notNull(),
});

export const deductions = sqliteTable('deductions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  taxYear: text('tax_year').notNull(),
  financialYear: text('financial_year'),
  category: text('category').notNull(),
  subcategory: text('subcategory'),
  calculationMethod: text('calculation_method'),
  description: text('description').notNull(),
  amount: integer('amount').notNull(),
  transactionId: text('transaction_id').references(() => transactions.id),
  isVerified: integer('is_verified', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const cgtAssets = sqliteTable('cgt_assets', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  assetName: text('asset_name').notNull(),
  assetType: text('asset_type').notNull(),
  quantity: real('quantity').default(1),
  unitCost: integer('unit_cost'),
  acquisitionDate: text('acquisition_date').notNull(),
  acquisitionCost: integer('acquisition_cost').notNull(),
  acquisitionCostsIncidental: integer('acquisition_costs_incidental').default(0),
  improvementsCost: integer('improvements_cost').default(0),
  status: text('status').notNull().default('held'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const cgtEvents = sqliteTable('cgt_events', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  assetId: text('asset_id')
    .notNull()
    .references(() => cgtAssets.id, { onDelete: 'cascade' }),
  taxYear: text('tax_year').notNull(),
  eventType: text('event_type').notNull(),
  eventDate: text('event_date').notNull(),
  disposalDate: text('disposal_date'),
  disposalProceeds: integer('disposal_proceeds'),
  proceeds: integer('proceeds'),
  costBase: integer('cost_base'),
  capitalGainLoss: integer('capital_gain_loss'),
  capitalGainGross: integer('capital_gain_gross'),
  capitalGainNet: integer('capital_gain_net'),
  capitalLoss: integer('capital_loss'),
  discountApplied: integer('discount_applied', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const depreciableAssets = sqliteTable('depreciable_assets', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  assetName: text('asset_name').notNull(),
  assetCategory: text('asset_category').notNull(),
  purchaseDate: text('purchase_date').notNull(),
  purchaseCost: integer('purchase_cost').notNull(),
  effectiveLife: integer('effective_life').notNull(),
  effectiveLifeYears: integer('effective_life_years'),
  depreciationMethod: text('depreciation_method').notNull().default('diminishing'),
  openingValue: integer('opening_value').notNull(),
  openingWrittenDownValue: integer('opening_written_down_value'),
  currentValue: integer('current_value').notNull(),
  currentWrittenDownValue: integer('current_written_down_value'),
  businessUsePercentage: real('business_use_percentage').default(100),
  isInstantWriteOff: integer('is_instant_write_off', { mode: 'boolean' }).default(false),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const depreciationSchedule = sqliteTable('depreciation_schedule', {
  id: text('id').primaryKey(),
  assetId: text('asset_id')
    .notNull()
    .references(() => depreciableAssets.id, { onDelete: 'cascade' }),
  financialYear: text('financial_year').notNull(),
  openingValue: integer('opening_value').notNull(),
  depreciationAmount: integer('depreciation_amount').notNull(),
  closingValue: integer('closing_value').notNull(),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const taxYearSummary = sqliteTable('tax_year_summary', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  taxYear: text('tax_year').notNull(),
  financialYear: text('financial_year'),
  grossIncome: integer('gross_income').default(0),
  totalDeductions: integer('total_deductions').default(0),
  taxableIncome: integer('taxable_income').default(0),
  taxPayable: integer('tax_payable').default(0),
  medicareLevy: integer('medicare_levy').default(0),
  taxOffsets: integer('tax_offsets').default(0),
  netTax: integer('net_tax').default(0),
  calculatedAt: text('calculated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ============================================================================
// AUDIT & SECURITY
// ============================================================================

export const auditLog = sqliteTable('audit_log', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id'),
  oldValue: text('old_value'),
  newValue: text('new_value'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  requestPath: text('request_path'),
  requestMethod: text('request_method'),
  statusCode: integer('status_code'),
  durationMs: integer('duration_ms'),
  errorMessage: text('error_message'),
  timestamp: text('timestamp').notNull().default('CURRENT_TIMESTAMP'),
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  refreshTokenHash: text('refresh_token_hash').notNull(),
  deviceFingerprint: text('device_fingerprint'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  expiresAt: text('expires_at').notNull(),
  revokedAt: text('revoked_at'),
});

// ============================================================================
// TEAMS & SUBSCRIPTIONS
// ============================================================================

export const teams = sqliteTable('teams', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  ownerId: text('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  description: text('description'),
  settings: text('settings'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const teamMembers = sqliteTable('team_members', {
  id: text('id').primaryKey(),
  teamId: text('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('viewer'),
  joinedAt: text('joined_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const teamInvitations = sqliteTable('team_invitations', {
  id: text('id').primaryKey(),
  teamId: text('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  role: text('role').notNull().default('viewer'),
  token: text('token').notNull().unique(),
  invitedBy: text('invited_by')
    .notNull()
    .references(() => users.id),
  status: text('status').notNull().default('pending'),
  expiresAt: text('expires_at').notNull(),
  acceptedAt: text('accepted_at'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const subscriptions = sqliteTable('subscriptions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  plan: text('plan').notNull().default('free'),
  status: text('status').notNull().default('active'),
  currentPeriodStart: text('current_period_start'),
  currentPeriodEnd: text('current_period_end'),
  cancelAtPeriodEnd: integer('cancel_at_period_end', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

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
// PARSER METRICS & FEEDBACK
// ============================================================================

export const parserMetrics = sqliteTable('parser_metrics', {
  id: text('id').primaryKey(),
  statementId: text('statement_id').references(() => statements.id, { onDelete: 'cascade' }),
  bankName: text('bank_name').notNull(),
  parserUsed: text('parser_used').notNull(),
  extractionTimeMs: integer('extraction_time_ms'),
  transactionCount: integer('transaction_count'),
  confidenceScore: real('confidence_score'),
  errorsCount: integer('errors_count').default(0),
  warningsCount: integer('warnings_count').default(0),
  usedVisionFallback: integer('used_vision_fallback', { mode: 'boolean' }).default(false),
  bankId: text('bank_id'),
  totalDurationMs: integer('total_duration_ms'),
  parseErrorCount: integer('parse_error_count'),
  transactionsParsed: integer('transactions_parsed'),
  detectionConfidence: real('detection_confidence'),
  highConfidenceCount: integer('high_confidence_count'),
  lowConfidenceCount: integer('low_confidence_count'),
  extractionMethod: text('extraction_method'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const parserAccuracyAggregates = sqliteTable('parser_accuracy_aggregates', {
  id: text('id').primaryKey(),
  bankName: text('bank_name').notNull(),
  parserVersion: text('parser_version').notNull(),
  periodStart: text('period_start').notNull(),
  periodEnd: text('period_end').notNull(),
  totalStatements: integer('total_statements').notNull().default(0),
  successfulStatements: integer('successful_statements').notNull().default(0),
  avgConfidenceScore: real('avg_confidence_score'),
  avgExtractionTimeMs: real('avg_extraction_time_ms'),
  visionFallbackRate: real('vision_fallback_rate'),
  bankId: text('bank_id'),
  periodType: text('period_type'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const parserFeedback = sqliteTable('parser_feedback', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  statementId: text('statement_id').references(() => statements.id, { onDelete: 'set null' }),
  transactionId: text('transaction_id').references(() => transactions.id, { onDelete: 'set null' }),
  feedbackType: text('feedback_type').notNull(),
  originalValue: text('original_value'),
  correctedValue: text('corrected_value'),
  fieldName: text('field_name'),
  notes: text('notes'),
  aiConfidence: text('ai_confidence'),
  userNotes: text('user_notes'),
  status: text('status').notNull().default('pending'),
  bankId: text('bank_id'),
  reviewedAt: text('reviewed_at'),
  reviewNotes: text('review_notes'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
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
// RAG & KNOWLEDGE
// ============================================================================

export const ragNamespaces = sqliteTable('rag_namespaces', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  chunkCount: integer('chunk_count').default(0),
  embeddingModel: text('embedding_model'),
  embeddingDimensions: integer('embedding_dimensions'),
  documentCount: integer('document_count'),
  lastIndexedAt: text('last_indexed_at'),
  status: text('status'),
  settings: text('settings'),
  lastUpdated: text('last_updated').notNull().default('CURRENT_TIMESTAMP'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const ragChunks = sqliteTable('rag_chunks', {
  id: text('id').primaryKey(),
  namespaceId: text('namespace_id')
    .notNull()
    .references(() => ragNamespaces.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  contentHash: text('content_hash').notNull(),
  chunkType: text('chunk_type').notNull(),
  metadata: text('metadata'),
  embedding: text('embedding'),
  sourceId: text('source_id'),
  sourceType: text('source_type'),
  documentId: text('document_id'),
  category: text('category'),
  accountId: text('account_id'),
  dateStart: text('date_start'),
  dateEnd: text('date_end'),
  contentTokens: integer('content_tokens'),
  totalAmount: integer('total_amount'),
  transactionCount: integer('transaction_count'),
  merchantNormalized: text('merchant_normalized'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const ragDocuments = sqliteTable('rag_documents', {
  id: text('id').primaryKey(),
  namespaceId: text('namespace_id')
    .notNull()
    .references(() => ragNamespaces.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  sourceType: text('source_type').notNull(),
  sourceId: text('source_id'),
  version: integer('version').notNull().default(1),
  chunkCount: integer('chunk_count').default(0),
  status: text('status').notNull().default('indexed'),
  contentHash: text('content_hash'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const ragCitations = sqliteTable('rag_citations', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  queryId: text('query_id').notNull(),
  chunkId: text('chunk_id')
    .notNull()
    .references(() => ragChunks.id, { onDelete: 'cascade' }),
  relevanceScore: real('relevance_score'),
  usedInResponse: integer('used_in_response', { mode: 'boolean' }).default(false),
  documentId: text('document_id'),
  rerankScore: real('rerank_score'),
  position: integer('position'),
  excerptUsed: text('excerpt_used'),
  wasHelpful: integer('was_helpful', { mode: 'boolean' }),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ============================================================================
// TAX OFFSETS & CAPITAL LOSSES
// ============================================================================

export const taxOffsets = sqliteTable('tax_offsets', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  taxYear: text('tax_year').notNull(),
  offsetType: text('offset_type').notNull(),
  amount: integer('amount').notNull(),
  description: text('description'),
  createdAt: text('created_at').notNull(),
});

export const capitalLosses = sqliteTable('capital_losses', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  taxYear: text('tax_year').notNull(),
  assetDescription: text('asset_description').notNull(),
  acquisitionDate: text('acquisition_date'),
  disposalDate: text('disposal_date'),
  lossAmount: integer('loss_amount').notNull(),
  appliedAmount: integer('applied_amount'),
  carriedForward: integer('carried_forward', { mode: 'boolean' }),
  createdAt: text('created_at').notNull(),
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
// DASHBOARDS & CHARTS (Wave 22)
// ============================================================================

export const dashboardLayouts = sqliteTable('dashboard_layouts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().default('default'),
  name: text('name').notNull(),
  description: text('description'),
  layoutJson: text('layout_json').notNull().default('{}'),
  widgets: text('widgets').notNull().default('[]'),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  isShared: integer('is_shared', { mode: 'boolean' }).notNull().default(false),
  thumbnailUrl: text('thumbnail_url'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

export const savedCharts = sqliteTable('saved_charts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().default('default'),
  dashboardId: text('dashboard_id').references(() => dashboardLayouts.id),
  chartType: text('chart_type').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  dataSource: text('data_source').notNull(),
  configJson: text('config_json').notNull().default('{}'),
  filtersJson: text('filters_json').default('{}'),
  refreshIntervalSeconds: integer('refresh_interval_seconds').default(0),
  pinned: integer('pinned', { mode: 'boolean' }).notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

// ============================================================================
// COGNEE MULTI-USER
// ============================================================================

export const cogneeUserAccounts = sqliteTable('cognee_user_accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  cogneeEmail: text('cognee_email').notNull(),
  cogneeRefreshToken: text('cognee_refresh_token'), // Encrypted refresh token, NOT password (D02 CRIT-03)
  cogneeUserId: text('cognee_user_id'),
  datasetPrefix: text('dataset_prefix').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  lastSyncAt: text('last_sync_at'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const cogneeSessions = sqliteTable('cognee_sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  sessionType: text('session_type').notNull().default('chat'),
  cogneeSessionId: text('cognee_session_id'),
  state: text('state').notNull().default('active'),
  contextData: text('context_data'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  lastActivityAt: text('last_activity_at').notNull().default('CURRENT_TIMESTAMP'),
  expiresAt: text('expires_at').notNull(),
});

// ============================================================================
// WAVE 16: Cognee DataPoints, Graph Schemas & Feedback
// ============================================================================

export const datapointConfigs = sqliteTable('datapoint_configs', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  datapointType: text('datapoint_type').notNull(),
  schemaDefinition: text('schema_definition').notNull(),
  extractionPrompt: text('extraction_prompt'),
  datasetName: text('dataset_name').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  isPredefined: integer('is_predefined', { mode: 'boolean' }).default(false),
  extractionCount: integer('extraction_count').default(0),
  lastExtractionAt: text('last_extraction_at'),
  accuracyScore: real('accuracy_score'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const graphSchemas = sqliteTable('graph_schemas', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  ontologyType: text('ontology_type').notNull(),
  nodeTypes: text('node_types').notNull(),
  edgeTypes: text('edge_types').notNull(),
  constraints: text('constraints'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  isPredefined: integer('is_predefined', { mode: 'boolean' }).default(false),
  appliedDatasets: text('applied_datasets'),
  version: integer('version').default(1),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const cogneeFeedback = sqliteTable('cognee_feedback', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  feedbackType: text('feedback_type').notNull(),
  originalValue: text('original_value'),
  correctedValue: text('corrected_value'),
  context: text('context'),
  datapointConfigId: text('datapoint_config_id'),
  appliedToMemify: integer('applied_to_memify', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ============================================================================
// WAVE 2: Agent Sessions, Mutations & Audit Log
// ============================================================================

export const agentSessions = sqliteTable('agent_sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  startedAt: text('started_at').default('CURRENT_TIMESTAMP'),
  lastActivityAt: text('last_activity_at').default('CURRENT_TIMESTAMP'),
  status: text('status').notNull().default('active'),
  context: text('context'),
  totalMutations: integer('total_mutations').notNull().default(0),
  confirmedMutations: integer('confirmed_mutations').notNull().default(0),
  rejectedMutations: integer('rejected_mutations').notNull().default(0),
  queryCount: integer('query_count').notNull().default(0),
  agentTypesUsed: text('agent_types_used'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
});

export const agentMutations = sqliteTable('agent_mutations', {
  id: text('id').primaryKey(),
  sessionId: text('session_id')
    .notNull()
    .references(() => agentSessions.id),
  agentType: text('agent_type').notNull(),
  mutationType: text('mutation_type').notNull(),
  targetTable: text('target_table').notNull(),
  targetId: text('target_id'),
  targetIds: text('target_ids'),
  beforeState: text('before_state'),
  afterState: text('after_state').notNull(),
  description: text('description').notNull(),
  status: text('status').notNull().default('proposed'),
  confidence: real('confidence'),
  requiresConfirmation: integer('requires_confirmation', { mode: 'boolean' })
    .notNull()
    .default(true),
  confirmedAt: text('confirmed_at'),
  executedAt: text('executed_at'),
  rejectedAt: text('rejected_at'),
  rejectionReason: text('rejection_reason'),
  errorMessage: text('error_message'),
  expiresAt: text('expires_at'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

export const agentAuditLog = sqliteTable('agent_audit_log', {
  id: text('id').primaryKey(),
  mutationId: text('mutation_id').references(() => agentMutations.id),
  sessionId: text('session_id').references(() => agentSessions.id),
  agentType: text('agent_type').notNull(),
  action: text('action').notNull(),
  targetTable: text('target_table'),
  targetId: text('target_id'),
  beforeState: text('before_state'),
  afterState: text('after_state'),
  metadata: text('metadata'),
  userId: text('user_id'),
  ipAddress: text('ip_address'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
});

// ============================================================================
// MULTI-TENANT (Wave 23)
// ============================================================================

export const tenants = sqliteTable('tenants', {
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
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

export const tenantMembers = sqliteTable('tenant_members', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('viewer'),
  displayName: text('display_name'),
  isPrimaryContact: integer('is_primary_contact', { mode: 'boolean' }).notNull().default(false),
  invitedBy: text('invited_by').references(() => users.id),
  joinedAt: text('joined_at').default('CURRENT_TIMESTAMP'),
  lastActiveAt: text('last_active_at'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

export const tenantInvitations = sqliteTable('tenant_invitations', {
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
  expiresAt: text('expires_at').notNull(),
  acceptedAt: text('accepted_at'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
});

export const permissions = sqliteTable('permissions', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  resource: text('resource').notNull(),
  action: text('action').notNull(),
  isSystem: integer('is_system', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
});

export const rolePermissions = sqliteTable('role_permissions', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  permissionId: text('permission_id')
    .notNull()
    .references(() => permissions.id, { onDelete: 'cascade' }),
  grantedBy: text('granted_by').references(() => users.id),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
});

export const subscriptionPlans = sqliteTable('subscription_plans', {
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
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

export const subscriptionHistory = sqliteTable('subscription_history', {
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
  cancelAtPeriodEnd: integer('cancel_at_period_end', { mode: 'boolean' }).notNull().default(false),
  cancelledAt: text('cancelled_at'),
  trialEnd: text('trial_end'),
  paymentMethodJson: text('payment_method_json'),
  usageJson: text('usage_json').default(
    '{"members":0,"accounts":0,"transactions":0,"aiQueries":0,"storageMb":0}',
  ),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

export const apiRateLimits = sqliteTable('api_rate_limits', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  endpointPattern: text('endpoint_pattern').notNull(),
  requestsPerMinute: integer('requests_per_minute').notNull().default(60),
  requestsPerHour: integer('requests_per_hour').notNull().default(1000),
  requestsPerDay: integer('requests_per_day').notNull().default(10000),
  burstLimit: integer('burst_limit').notNull().default(10),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
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

// ============================================================================
// FINANCIAL REPORTING & BUDGETING (Wave 13)
// ============================================================================

export const reportSnapshots = sqliteTable('report_snapshots', {
  id: text('id').primaryKey(),
  templateId: text('template_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  reportType: text('report_type').notNull(),
  periodStart: text('period_start').notNull(),
  periodEnd: text('period_end').notNull(),
  data: text('data').notNull(),
  comparisonData: text('comparison_data'),
  metadata: text('metadata'),
  generatedAt: text('generated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const budgets = sqliteTable('budgets', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  accountId: text('account_id').references(() => accounts.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  budgetType: text('budget_type').notNull(),
  periodStart: text('period_start').notNull(),
  periodEnd: text('period_end').notNull(),
  totalAmount: real('total_amount').notNull().default(0),
  status: text('status').notNull().default('draft'),
  autoGenerated: integer('auto_generated', { mode: 'boolean' }).default(false),
  sourceMethod: text('source_method'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const budgetLines = sqliteTable('budget_lines', {
  id: text('id').primaryKey(),
  budgetId: text('budget_id')
    .notNull()
    .references(() => budgets.id, { onDelete: 'cascade' }),
  category: text('category').notNull(),
  subcategory: text('subcategory'),
  period: text('period').notNull(),
  budgetedAmount: real('budgeted_amount').notNull(),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const budgetVsActual = sqliteTable('budget_vs_actual', {
  id: text('id').primaryKey(),
  budgetLineId: text('budget_line_id')
    .notNull()
    .references(() => budgetLines.id, { onDelete: 'cascade' }),
  actualAmount: real('actual_amount').notNull().default(0),
  varianceAmount: real('variance_amount').notNull().default(0),
  variancePercent: real('variance_percent').default(0),
  transactionCount: integer('transaction_count').default(0),
  lastCalculated: text('last_calculated').notNull().default('CURRENT_TIMESTAMP'),
});

export const forecastScenarios = sqliteTable('forecast_scenarios', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  scenarioType: text('scenario_type').notNull(),
  basePeriodStart: text('base_period_start').notNull(),
  basePeriodEnd: text('base_period_end').notNull(),
  forecastMonths: integer('forecast_months').notNull().default(12),
  assumptions: text('assumptions').notNull(),
  status: text('status').default('draft'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const forecastPeriods = sqliteTable('forecast_periods', {
  id: text('id').primaryKey(),
  scenarioId: text('scenario_id')
    .notNull()
    .references(() => forecastScenarios.id, { onDelete: 'cascade' }),
  period: text('period').notNull(),
  category: text('category').notNull(),
  forecastAmount: real('forecast_amount').notNull(),
  confidenceLower: real('confidence_lower'),
  confidenceUpper: real('confidence_upper'),
  method: text('method').notNull(),
});

export const kpiMetrics = sqliteTable('kpi_metrics', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  metricName: text('metric_name').notNull(),
  metricValue: real('metric_value').notNull(),
  period: text('period').notNull(),
  targetValue: real('target_value'),
  trendDirection: text('trend_direction'),
  previousValue: real('previous_value'),
  calculatedAt: text('calculated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ============================================================================
// AI OCR DOCUMENT PROCESSING & PAYMENT MATCHING (Wave 14)
// ============================================================================

export const ocrDocuments = sqliteTable('ocr_documents', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  accountId: text('account_id').references(() => accounts.id, { onDelete: 'set null' }),
  fileName: text('file_name').notNull(),
  filePath: text('file_path').notNull(),
  fileSize: integer('file_size').notNull(),
  mimeType: text('mime_type').notNull(),
  documentType: text('document_type'),
  documentNumber: text('document_number'),
  vendorName: text('vendor_name'),
  vendorAbn: text('vendor_abn'),
  documentDate: text('document_date'),
  dueDate: text('due_date'),
  subtotal: real('subtotal'),
  gstAmount: real('gst_amount'),
  totalAmount: real('total_amount'),
  currency: text('currency').default('AUD'),
  extractedData: text('extracted_data'),
  confidenceScore: real('confidence_score').default(0),
  status: text('status').notNull().default('pending'),
  errorMessage: text('error_message'),
  processedAt: text('processed_at'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

export const ocrLineItems = sqliteTable('ocr_line_items', {
  id: text('id').primaryKey(),
  documentId: text('document_id')
    .notNull()
    .references(() => ocrDocuments.id, { onDelete: 'cascade' }),
  lineNumber: integer('line_number').notNull(),
  description: text('description').notNull(),
  quantity: real('quantity').default(1),
  unitPrice: real('unit_price'),
  amount: real('amount').notNull(),
  gstAmount: real('gst_amount').default(0),
  gstInclusive: integer('gst_inclusive').default(1),
  category: text('category'),
  accountCode: text('account_code'),
  confidenceScore: real('confidence_score').default(0),
});

export const paymentMatchRules = sqliteTable('payment_match_rules', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  ruleType: text('rule_type').notNull(),
  vendorPattern: text('vendor_pattern'),
  amountExact: real('amount_exact'),
  amountMin: real('amount_min'),
  amountMax: real('amount_max'),
  amountTolerance: real('amount_tolerance').default(0.01),
  dateToleranceDays: integer('date_tolerance_days').default(7),
  categoryFilter: text('category_filter'),
  priority: integer('priority').default(100),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  matchCount: integer('match_count').default(0),
  lastMatchedAt: text('last_matched_at'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
});

export const paymentMatches = sqliteTable('payment_matches', {
  id: text('id').primaryKey(),
  documentId: text('document_id')
    .notNull()
    .references(() => ocrDocuments.id, { onDelete: 'cascade' }),
  transactionId: text('transaction_id')
    .notNull()
    .references(() => transactions.id, { onDelete: 'cascade' }),
  ruleId: text('rule_id').references(() => paymentMatchRules.id, { onDelete: 'set null' }),
  matchScore: real('match_score').notNull(),
  matchMethod: text('match_method').notNull(),
  amountDifference: real('amount_difference').default(0),
  dateDifference: integer('date_difference').default(0),
  status: text('status').notNull().default('suggested'),
  confirmedBy: text('confirmed_by'),
  confirmedAt: text('confirmed_at'),
  notes: text('notes'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
});

export const documentQueue = sqliteTable('document_queue', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  documentId: text('document_id')
    .notNull()
    .references(() => ocrDocuments.id, { onDelete: 'cascade' }),
  action: text('action').notNull(),
  priority: integer('priority').default(100),
  status: text('status').notNull().default('queued'),
  attempts: integer('attempts').default(0),
  maxAttempts: integer('max_attempts').default(3),
  errorMessage: text('error_message'),
  scheduledAt: text('scheduled_at').default('CURRENT_TIMESTAMP'),
  startedAt: text('started_at'),
  completedAt: text('completed_at'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
});

// ============================================================================
// PREDICTIVE ANALYTICS & COMPLIANCE MONITORING (Wave 15)
// ============================================================================

export const cashFlowForecasts = sqliteTable('cash_flow_forecasts', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  accountId: text('account_id').references(() => accounts.id),
  name: text('name').notNull(),
  forecastType: text('forecast_type').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  granularity: text('granularity').notNull().default('monthly'),
  accuracyScore: real('accuracy_score'),
  confidenceLevel: real('confidence_level').default(0.85),
  parameters: text('parameters'),
  status: text('status').notNull().default('draft'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const cashFlowForecastPeriods = sqliteTable('cash_flow_forecast_periods', {
  id: text('id').primaryKey(),
  forecastId: text('forecast_id')
    .notNull()
    .references(() => cashFlowForecasts.id, { onDelete: 'cascade' }),
  periodStart: text('period_start').notNull(),
  periodEnd: text('period_end').notNull(),
  predictedInflow: real('predicted_inflow').notNull().default(0),
  predictedOutflow: real('predicted_outflow').notNull().default(0),
  predictedNet: real('predicted_net').notNull().default(0),
  actualInflow: real('actual_inflow'),
  actualOutflow: real('actual_outflow'),
  actualNet: real('actual_net'),
  variance: real('variance'),
  variancePct: real('variance_pct'),
  confidenceLower: real('confidence_lower'),
  confidenceUpper: real('confidence_upper'),
  breakdown: text('breakdown'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const anomalyAlerts = sqliteTable('anomaly_alerts', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  accountId: text('account_id').references(() => accounts.id),
  transactionId: text('transaction_id').references(() => transactions.id),
  alertType: text('alert_type').notNull(),
  severity: text('severity').notNull().default('medium'),
  title: text('title').notNull(),
  description: text('description').notNull(),
  details: text('details'),
  status: text('status').notNull().default('open'),
  resolvedBy: text('resolved_by'),
  resolvedAt: text('resolved_at'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const complianceChecks = sqliteTable('compliance_checks', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  obligationType: text('obligation_type').notNull(),
  period: text('period').notNull(),
  dueDate: text('due_date').notNull(),
  status: text('status').notNull().default('pending'),
  lodgedDate: text('lodged_date'),
  amountDue: real('amount_due'),
  amountPaid: real('amount_paid'),
  referenceNumber: text('reference_number'),
  notes: text('notes'),
  riskLevel: text('risk_level').default('low'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const complianceSchedules = sqliteTable('compliance_schedules', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  obligationType: text('obligation_type').notNull(),
  frequency: text('frequency').notNull(),
  baseDueDay: integer('base_due_day').notNull(),
  reminderDaysBefore: integer('reminder_days_before').notNull().default(14),
  autoGenerate: integer('auto_generate').notNull().default(1),
  lastGenerated: text('last_generated'),
  enabled: integer('enabled').notNull().default(1),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ============================================================================
// TEMPORAL INTELLIGENCE (Wave 17)
// ============================================================================

export const temporalQueries = sqliteTable('temporal_queries', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  queryType: text('query_type').notNull(),
  targetEntity: text('target_entity').notNull(),
  timeStart: text('time_start').notNull(),
  timeEnd: text('time_end'),
  timeGranularity: text('time_granularity').default('monthly'),
  queryParameters: text('query_parameters').notNull(),
  cogneeDataset: text('cognee_dataset'),
  cogneeSearchType: text('cognee_search_type').default('GRAPH_COMPLETION'),
  resultCache: text('result_cache'),
  cacheExpiresAt: text('cache_expires_at'),
  executionCount: integer('execution_count').notNull().default(0),
  lastExecutedAt: text('last_executed_at'),
  averageExecutionMs: integer('average_execution_ms'),
  isSaved: integer('is_saved', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const crossModuleInsights = sqliteTable('cross_module_insights', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  insightType: text('insight_type').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  severity: text('severity').notNull().default('info'),
  sourceModules: text('source_modules').notNull(),
  relatedEntities: text('related_entities').notNull(),
  timeRangeStart: text('time_range_start'),
  timeRangeEnd: text('time_range_end'),
  confidence: real('confidence').notNull().default(0.5),
  evidence: text('evidence').notNull(),
  recommendedAction: text('recommended_action'),
  status: text('status').notNull().default('new'),
  actedOnAt: text('acted_on_at'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  expiresAt: text('expires_at'),
});

export const intelligenceSubscriptions = sqliteTable('intelligence_subscriptions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  subscriptionType: text('subscription_type').notNull(),
  filterCriteria: text('filter_criteria').notNull(),
  notificationChannel: text('notification_channel').notNull().default('in_app'),
  notificationConfig: text('notification_config'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  triggerCount: integer('trigger_count').notNull().default(0),
  lastTriggeredAt: text('last_triggered_at'),
  cooldownMinutes: integer('cooldown_minutes').default(60),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const moduleConnections = sqliteTable('module_connections', {
  id: text('id').primaryKey(),
  sourceModule: text('source_module').notNull(),
  targetModule: text('target_module').notNull(),
  connectionType: text('connection_type').notNull(),
  description: text('description').notNull(),
  strength: real('strength').notNull().default(0.5),
  isBidirectional: integer('is_bidirectional', { mode: 'boolean' }).notNull().default(false),
  metadata: text('metadata'),
  lastActivityAt: text('last_activity_at'),
  activityCount: integer('activity_count').notNull().default(0),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ============================================================================
// ACCOUNTS PAYABLE & PURCHASE ORDERS (Wave 10)
// ============================================================================

export const suppliers = sqliteTable('suppliers', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  businessName: text('business_name').notNull(),
  contactName: text('contact_name'),
  email: text('email'),
  phone: text('phone'),
  address: text('address'),
  abn: text('abn'),
  paymentTermsDays: integer('payment_terms_days').notNull().default(30),
  bankBsb: text('bank_bsb'),
  bankAccountNumber: text('bank_account_number'),
  bankAccountName: text('bank_account_name'),
  notes: text('notes'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const bills = sqliteTable('bills', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  supplierId: text('supplier_id')
    .notNull()
    .references(() => suppliers.id),
  billNumber: text('bill_number'),
  status: text('status').notNull().default('draft'),
  issueDate: text('issue_date').notNull(),
  dueDate: text('due_date').notNull(),
  subtotal: integer('subtotal').notNull().default(0),
  gstAmount: integer('gst_amount').notNull().default(0),
  totalAmount: integer('total_amount').notNull().default(0),
  amountPaid: integer('amount_paid').notNull().default(0),
  amountDue: integer('amount_due').notNull().default(0),
  currency: text('currency').notNull().default('AUD'),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const billLines = sqliteTable('bill_lines', {
  id: text('id').primaryKey(),
  billId: text('bill_id')
    .notNull()
    .references(() => bills.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  quantity: real('quantity').notNull().default(1),
  unitPrice: integer('unit_price').notNull().default(0),
  amount: integer('amount').notNull().default(0),
  gstRate: real('gst_rate').default(0.1),
  gstAmount: integer('gst_amount').default(0),
  accountCode: text('account_code'),
  taxCode: text('tax_code'),
});

export const billPayments = sqliteTable('bill_payments', {
  id: text('id').primaryKey(),
  billId: text('bill_id')
    .notNull()
    .references(() => bills.id),
  paymentDate: text('payment_date').notNull(),
  amount: integer('amount').notNull(),
  paymentMethod: text('payment_method'),
  reference: text('reference'),
  transactionId: text('transaction_id').references(() => transactions.id),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const purchaseOrders = sqliteTable('purchase_orders', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  supplierId: text('supplier_id')
    .notNull()
    .references(() => suppliers.id),
  poNumber: text('po_number').notNull().unique(),
  status: text('status').notNull().default('draft'),
  issueDate: text('issue_date').notNull(),
  expectedDate: text('expected_date'),
  subtotal: integer('subtotal').notNull().default(0),
  gstAmount: integer('gst_amount').notNull().default(0),
  totalAmount: integer('total_amount').notNull().default(0),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const poLines = sqliteTable('po_lines', {
  id: text('id').primaryKey(),
  purchaseOrderId: text('purchase_order_id')
    .notNull()
    .references(() => purchaseOrders.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  quantity: real('quantity').notNull().default(1),
  unitPrice: integer('unit_price').notNull().default(0),
  amount: integer('amount').notNull().default(0),
  quantityReceived: real('quantity_received').notNull().default(0),
});

export const poReceipts = sqliteTable('po_receipts', {
  id: text('id').primaryKey(),
  purchaseOrderId: text('purchase_order_id')
    .notNull()
    .references(() => purchaseOrders.id),
  receiptDate: text('receipt_date').notNull(),
  receivedBy: text('received_by').references(() => users.id),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const poReceiptLines = sqliteTable('po_receipt_lines', {
  id: text('id').primaryKey(),
  receiptId: text('receipt_id')
    .notNull()
    .references(() => poReceipts.id, { onDelete: 'cascade' }),
  poLineId: text('po_line_id')
    .notNull()
    .references(() => poLines.id),
  quantityReceived: real('quantity_received').notNull(),
});

export const supplierPaymentRuns = sqliteTable('supplier_payment_runs', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  paymentDate: text('payment_date').notNull(),
  status: text('status').notNull().default('draft'),
  totalAmount: integer('total_amount').notNull().default(0),
  bankReference: text('bank_reference'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const supplierPaymentRunItems = sqliteTable('supplier_payment_run_items', {
  id: text('id').primaryKey(),
  paymentRunId: text('payment_run_id')
    .notNull()
    .references(() => supplierPaymentRuns.id, { onDelete: 'cascade' }),
  billId: text('bill_id')
    .notNull()
    .references(() => bills.id),
  amount: integer('amount').notNull(),
});

// ============================================================================
// PWA SUPPORT (Wave 24)
// ============================================================================

export const pushSubscriptions = sqliteTable('push_subscriptions', {
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
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  lastUsedAt: text('last_used_at'),
  errorCount: integer('error_count').notNull().default(0),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

export const notificationPreferences = sqliteTable('notification_preferences', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  transactionAlerts: integer('transaction_alerts', { mode: 'boolean' }).notNull().default(true),
  basReminders: integer('bas_reminders', { mode: 'boolean' }).notNull().default(true),
  budgetAlerts: integer('budget_alerts', { mode: 'boolean' }).notNull().default(true),
  taxReminders: integer('tax_reminders', { mode: 'boolean' }).notNull().default(true),
  billReminders: integer('bill_reminders', { mode: 'boolean' }).notNull().default(true),
  syncNotifications: integer('sync_notifications', { mode: 'boolean' }).notNull().default(false),
  teamNotifications: integer('team_notifications', { mode: 'boolean' }).notNull().default(true),
  systemNotifications: integer('system_notifications', { mode: 'boolean' }).notNull().default(true),
  largeTransactionThresholdCents: integer('large_transaction_threshold_cents')
    .notNull()
    .default(100000),
  budgetAlertThresholdPercent: integer('budget_alert_threshold_percent').notNull().default(80),
  pushEnabled: integer('push_enabled', { mode: 'boolean' }).notNull().default(true),
  emailEnabled: integer('email_enabled', { mode: 'boolean' }).notNull().default(false),
  quietHoursStart: text('quiet_hours_start'),
  quietHoursEnd: text('quiet_hours_end'),
  timezone: text('timezone').default('Australia/Sydney'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

export const offlineSyncLog = sqliteTable('offline_sync_log', {
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
  syncedAt: text('synced_at'),
  errorMessage: text('error_message'),
  retryCount: integer('retry_count').notNull().default(0),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
});

// ============================================================================
// CUSTOMER MANAGEMENT & INVOICING (Wave 7)
// ============================================================================

export const customers = sqliteTable('customers', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  businessName: text('business_name').notNull(),
  contactName: text('contact_name'),
  email: text('email'),
  phone: text('phone'),
  address: text('address'),
  city: text('city'),
  state: text('state'),
  postcode: text('postcode'),
  country: text('country').notNull().default('AU'),
  abn: text('abn'),
  paymentTermsDays: integer('payment_terms_days').notNull().default(30),
  notes: text('notes'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const customerContacts = sqliteTable('customer_contacts', {
  id: text('id').primaryKey(),
  customerId: text('customer_id')
    .notNull()
    .references(() => customers.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  role: text('role'),
  isPrimary: integer('is_primary', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const invoices = sqliteTable('invoices', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  customerId: text('customer_id')
    .notNull()
    .references(() => customers.id),
  invoiceNumber: text('invoice_number').notNull(),
  type: text('type').notNull().default('tax_invoice'),
  status: text('status').notNull().default('draft'),
  issueDate: text('issue_date').notNull(),
  dueDate: text('due_date').notNull(),
  subtotal: integer('subtotal').notNull().default(0),
  gstAmount: integer('gst_amount').notNull().default(0),
  totalAmount: integer('total_amount').notNull().default(0),
  amountPaid: integer('amount_paid').notNull().default(0),
  amountDue: integer('amount_due').notNull().default(0),
  currency: text('currency').notNull().default('AUD'),
  notes: text('notes'),
  termsAndConditions: text('terms_and_conditions'),
  pdfPath: text('pdf_path'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const invoiceLines = sqliteTable('invoice_lines', {
  id: text('id').primaryKey(),
  invoiceId: text('invoice_id')
    .notNull()
    .references(() => invoices.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  quantity: real('quantity').notNull().default(1),
  unitPrice: integer('unit_price').notNull().default(0),
  amount: integer('amount').notNull().default(0),
  gstRate: real('gst_rate').notNull().default(0.1),
  gstAmount: integer('gst_amount').notNull().default(0),
  accountCode: text('account_code'),
  taxCode: text('tax_code'),
});

export const invoiceNumberSequences = sqliteTable('invoice_number_sequences', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  prefix: text('prefix').notNull().default('INV-'),
  nextNumber: integer('next_number').notNull().default(1),
  format: text('format').notNull().default('{prefix}{number:06d}'),
});

export const invoicePayments = sqliteTable('invoice_payments', {
  id: text('id').primaryKey(),
  invoiceId: text('invoice_id')
    .notNull()
    .references(() => invoices.id, { onDelete: 'cascade' }),
  paymentDate: text('payment_date').notNull(),
  amount: integer('amount').notNull(),
  paymentMethod: text('payment_method'),
  reference: text('reference'),
  transactionId: text('transaction_id').references(() => transactions.id),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ============================================================================
// CDR Open Banking (Wave 18) — re-exported from db/cdr-schema.ts
// ============================================================================

export * from './db/cdr-schema.js';

// ============================================================================
// EMPLOYEE MANAGEMENT (Wave 4)
// ============================================================================

export const employees = sqliteTable('employees', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email'),
  phone: text('phone'),
  dateOfBirth: text('date_of_birth'),
  address: text('address'), // JSON
  taxFileNumber: text('tax_file_number'), // AES-256-GCM encrypted
  startDate: text('start_date').notNull(),
  endDate: text('end_date'),
  status: text('status').notNull().default('active'),
  employmentType: text('employment_type').notNull().default('full_time'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const employeeBankDetails = sqliteTable('employee_bank_details', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id')
    .notNull()
    .references(() => employees.id, { onDelete: 'cascade' }),
  bsb: text('bsb').notNull(), // AES-256-GCM encrypted
  accountNumber: text('account_number').notNull(), // AES-256-GCM encrypted
  accountName: text('account_name').notNull(),
  splitPercentage: real('split_percentage').notNull().default(100.0),
  isPrimary: integer('is_primary', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const employeeSuperFunds = sqliteTable('employee_super_funds', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id')
    .notNull()
    .references(() => employees.id, { onDelete: 'cascade' }),
  fundName: text('fund_name').notNull(),
  fundABN: text('fund_abn'),
  usi: text('usi'),
  memberNumber: text('member_number'),
  contributionRate: real('contribution_rate').notNull().default(11.5),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const employeeTaxDeclarations = sqliteTable('employee_tax_declarations', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id')
    .notNull()
    .references(() => employees.id, { onDelete: 'cascade' }),
  taxFreeThreshold: integer('tax_free_threshold', { mode: 'boolean' }).default(true),
  helpDebt: integer('help_debt', { mode: 'boolean' }).default(false),
  sfssDebt: integer('sfss_debt', { mode: 'boolean' }).default(false),
  claimDependents: integer('claim_dependents').default(0),
  taxOffsetEstimated: integer('tax_offset_estimated').default(0),
  effectiveDate: text('effective_date').notNull(),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const payCategories = sqliteTable('pay_categories', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type').notNull(),
  rateType: text('rate_type').notNull().default('hourly'),
  defaultRate: integer('default_rate').default(0),
  multiplier: real('multiplier').default(1.0),
  isTaxable: integer('is_taxable', { mode: 'boolean' }).default(true),
  isSuperBearing: integer('is_super_bearing', { mode: 'boolean' }).default(true),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const payStructures = sqliteTable('pay_structures', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id')
    .notNull()
    .references(() => employees.id, { onDelete: 'cascade' }),
  payCategoryId: text('pay_category_id')
    .notNull()
    .references(() => payCategories.id),
  rate: integer('rate').notNull(),
  hoursPerWeek: real('hours_per_week'),
  annualSalary: integer('annual_salary'),
  effectiveDate: text('effective_date').notNull(),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const employeeDocuments = sqliteTable('employee_documents', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id')
    .notNull()
    .references(() => employees.id, { onDelete: 'cascade' }),
  documentType: text('document_type').notNull(),
  fileName: text('file_name').notNull(),
  filePath: text('file_path').notNull(),
  fileSize: integer('file_size'),
  uploadedAt: text('uploaded_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

// Users & Auth
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserSetting = typeof userSettings.$inferSelect;
export type Session = typeof sessions.$inferSelect;

// Accounts
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type AccountBalanceHistoryRecord = typeof accountBalanceHistory.$inferSelect;

// Statements
export type Statement = typeof statements.$inferSelect;
export type NewStatement = typeof statements.$inferInsert;

// Transactions
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type TransactionHistoryRecord = typeof transactionHistory.$inferSelect;

// Transfers
export type TransferLink = typeof transferLinks.$inferSelect;

// Categorization
export type MerchantMemoryRecord = typeof merchantMemory.$inferSelect;
export type PendingCategorizationRecord = typeof pendingCategorization.$inferSelect;

// Reconciliation
export type ReconciliationAlert = typeof reconciliationAlerts.$inferSelect;

// Business
export type BusinessProfile = typeof businessProfiles.$inferSelect;

// Tax & BAS
export type BasPeriod = typeof basPeriods.$inferSelect;
export type BasCalculation = typeof basCalculations.$inferSelect;
export type TaxCode = typeof taxCodes.$inferSelect;
export type TaxBracket = typeof taxBrackets.$inferSelect;
export type Deduction = typeof deductions.$inferSelect;
export type CgtAsset = typeof cgtAssets.$inferSelect;
export type CgtEvent = typeof cgtEvents.$inferSelect;
export type DepreciableAsset = typeof depreciableAssets.$inferSelect;
export type DepreciationScheduleRecord = typeof depreciationSchedule.$inferSelect;
export type TaxYearSummaryRecord = typeof taxYearSummary.$inferSelect;

// Audit
export type AuditLogEntry = typeof auditLog.$inferSelect;

// Teams & Subscriptions
export type Team = typeof teams.$inferSelect;
export type TeamMember = typeof teamMembers.$inferSelect;
export type TeamInvitation = typeof teamInvitations.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;

// Exports
export type ExportHistoryRecord = typeof exportHistory.$inferSelect;

// Parser Metrics
export type ParserMetric = typeof parserMetrics.$inferSelect;
export type ParserAccuracyAggregate = typeof parserAccuracyAggregates.$inferSelect;
export type ParserFeedbackRecord = typeof parserFeedback.$inferSelect;

// Ledger
export type ChartOfAccountsEntry = typeof chartOfAccounts.$inferSelect;
export type JournalEntry = typeof journalEntries.$inferSelect;
export type JournalEntryLine = typeof journalEntryLines.$inferSelect;
export type AccountingPeriod = typeof accountingPeriods.$inferSelect;
export type AccountBalance = typeof accountBalances.$inferSelect;

// RAG
export type RagNamespace = typeof ragNamespaces.$inferSelect;
export type RagChunk = typeof ragChunks.$inferSelect;
export type RagDocument = typeof ragDocuments.$inferSelect;
export type RagCitation = typeof ragCitations.$inferSelect;

// Tax Offsets & Capital Losses
export type TaxOffset = typeof taxOffsets.$inferSelect;
export type NewTaxOffset = typeof taxOffsets.$inferInsert;
export type CapitalLoss = typeof capitalLosses.$inferSelect;
export type NewCapitalLoss = typeof capitalLosses.$inferInsert;

// Upload Queue
export type UploadQueueItem = typeof uploadQueue.$inferSelect;

// Dashboards & Charts (Wave 22)
export type DashboardLayout = typeof dashboardLayouts.$inferSelect;
export type NewDashboardLayout = typeof dashboardLayouts.$inferInsert;
export type SavedChart = typeof savedCharts.$inferSelect;
export type NewSavedChart = typeof savedCharts.$inferInsert;

// Agent Sessions, Mutations & Audit Log (Wave 2)
export type AgentSessionRecord = typeof agentSessions.$inferSelect;
export type NewAgentSessionRecord = typeof agentSessions.$inferInsert;
export type AgentMutationRecord = typeof agentMutations.$inferSelect;
export type NewAgentMutationRecord = typeof agentMutations.$inferInsert;
export type AgentAuditLogRecord = typeof agentAuditLog.$inferSelect;
export type NewAgentAuditLogRecord = typeof agentAuditLog.$inferInsert;

// Multi-Tenant (Wave 23)
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

// Cognee Multi-User
export type CogneeUserAccount = typeof cogneeUserAccounts.$inferSelect;
export type NewCogneeUserAccount = typeof cogneeUserAccounts.$inferInsert;
export type CogneeSession = typeof cogneeSessions.$inferSelect;
export type NewCogneeSession = typeof cogneeSessions.$inferInsert;

// Accounts Payable & Purchase Orders (Wave 10)
export type Supplier = typeof suppliers.$inferSelect;
export type NewSupplier = typeof suppliers.$inferInsert;
export type Bill = typeof bills.$inferSelect;
export type NewBill = typeof bills.$inferInsert;
export type BillLine = typeof billLines.$inferSelect;
export type NewBillLine = typeof billLines.$inferInsert;
export type BillPayment = typeof billPayments.$inferSelect;
export type NewBillPayment = typeof billPayments.$inferInsert;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type NewPurchaseOrder = typeof purchaseOrders.$inferInsert;
export type POLine = typeof poLines.$inferSelect;
export type NewPOLine = typeof poLines.$inferInsert;
export type POReceipt = typeof poReceipts.$inferSelect;
export type NewPOReceipt = typeof poReceipts.$inferInsert;
export type POReceiptLine = typeof poReceiptLines.$inferSelect;
export type NewPOReceiptLine = typeof poReceiptLines.$inferInsert;
export type SupplierPaymentRun = typeof supplierPaymentRuns.$inferSelect;
export type NewSupplierPaymentRun = typeof supplierPaymentRuns.$inferInsert;
export type SupplierPaymentRunItem = typeof supplierPaymentRunItems.$inferSelect;
export type NewSupplierPaymentRunItem = typeof supplierPaymentRunItems.$inferInsert;

// PWA Support (Wave 24)
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type NewPushSubscription = typeof pushSubscriptions.$inferInsert;
export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type NewNotificationPreference = typeof notificationPreferences.$inferInsert;
export type OfflineSyncLogRecord = typeof offlineSyncLog.$inferSelect;
export type NewOfflineSyncLogRecord = typeof offlineSyncLog.$inferInsert;

// Employee Management (Wave 4)
export type Employee = typeof employees.$inferSelect;
export type NewEmployee = typeof employees.$inferInsert;
export type EmployeeBankDetail = typeof employeeBankDetails.$inferSelect;
export type NewEmployeeBankDetail = typeof employeeBankDetails.$inferInsert;
export type EmployeeSuperFund = typeof employeeSuperFunds.$inferSelect;
export type NewEmployeeSuperFund = typeof employeeSuperFunds.$inferInsert;
export type EmployeeTaxDeclaration = typeof employeeTaxDeclarations.$inferSelect;
export type NewEmployeeTaxDeclaration = typeof employeeTaxDeclarations.$inferInsert;
export type PayCategory = typeof payCategories.$inferSelect;
export type NewPayCategory = typeof payCategories.$inferInsert;
export type PayStructure = typeof payStructures.$inferSelect;
export type NewPayStructure = typeof payStructures.$inferInsert;
export type EmployeeDocument = typeof employeeDocuments.$inferSelect;
export type NewEmployeeDocument = typeof employeeDocuments.$inferInsert;

// Customers & Invoicing (Wave 7)
export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type CustomerContact = typeof customerContacts.$inferSelect;
export type NewCustomerContact = typeof customerContacts.$inferInsert;
export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type InvoiceLine = typeof invoiceLines.$inferSelect;
export type NewInvoiceLine = typeof invoiceLines.$inferInsert;
export type InvoiceNumberSequence = typeof invoiceNumberSequences.$inferSelect;
export type InvoicePayment = typeof invoicePayments.$inferSelect;
export type NewInvoicePayment = typeof invoicePayments.$inferInsert;

// Market Intelligence (Wave 19)
export * from './db/market-schema.js';
