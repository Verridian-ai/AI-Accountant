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
const usePostgres = isProduction || dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://');

/**
 * Create a Proxy wrapper around the PostgreSQL db to intercept query chains
 * and add .get() / .all() / .run() methods that are SQLite-specific.
 */
function wrapPgDb(pgDb: any): any {
    const handler: ProxyHandler<any> = {
        get(target, prop, receiver) {
            const value = Reflect.get(target, prop, receiver);
            if (typeof value === 'function') {
                return function (this: any, ...args: any[]) {
                    const result = value.apply(target, args);
                    // Wrap the result in a proxy to add .get()/.all()/.run()
                    if (result && typeof result === 'object' && typeof result.then === 'function') {
                        return addSqliteCompat(result);
                    }
                    if (result && typeof result === 'object') {
                        return addSqliteCompat(result);
                    }
                    return result;
                };
            }
            return value;
        },
    };
    return new Proxy(pgDb, handler);
}

function addSqliteCompat(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    // Avoid double-wrapping
    if (obj.__pgWrapped) return obj;

    return new Proxy(obj, {
        get(target, prop, receiver) {
            if (prop === '__pgWrapped') return true;
            if (prop === 'get') {
                return async function () {
                    const rows = await target;
                    return Array.isArray(rows) ? rows[0] ?? undefined : rows;
                };
            }
            if (prop === 'all') {
                return async function () {
                    const rows = await target;
                    return Array.isArray(rows) ? rows : [rows];
                };
            }
            if (prop === 'run') {
                return async function () {
                    return await target;
                };
            }
            const value = Reflect.get(target, prop, receiver);
            if (typeof value === 'function') {
                return function (this: any, ...args: any[]) {
                    const result = value.apply(target, args);
                    if (result && typeof result === 'object') {
                        return addSqliteCompat(result);
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
  userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  modelParsingText: text('model_parsing_text').notNull().default('google/gemini-3-flash-preview'),
  modelParsingVision: text('model_parsing_vision').notNull().default('google/gemini-3-flash-preview'),
  modelCategorization: text('model_categorization').notNull().default('google/gemini-3-flash-preview'),
  modelChat: text('model_chat').notNull().default('google/gemini-3-flash-preview'),
  modelEmbedding: text('model_embedding').notNull().default('openai/text-embedding-3-large'),
});

// ============================================================================
// ACCOUNTS
// ============================================================================

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
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
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const accountBalanceHistory = sqliteTable('account_balance_history', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
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
  statementId: text('statement_id').primaryKey().references(() => statements.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
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
  merchantNormalized: text('merchant_normalized'),
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
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sourceTransactionId: text('source_transaction_id').notNull().references(() => transactions.id, { onDelete: 'cascade' }),
  destinationTransactionId: text('destination_transaction_id').notNull().references(() => transactions.id, { onDelete: 'cascade' }),
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
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
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
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  transactionId: text('transaction_id').notNull().references(() => transactions.id, { onDelete: 'cascade' }),
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
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
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
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
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
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
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
  basPeriodId: text('bas_period_id').notNull().references(() => basPeriods.id, { onDelete: 'cascade' }),
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
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
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
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
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
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  assetId: text('asset_id').notNull().references(() => cgtAssets.id, { onDelete: 'cascade' }),
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
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
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
  assetId: text('asset_id').notNull().references(() => depreciableAssets.id, { onDelete: 'cascade' }),
  financialYear: text('financial_year').notNull(),
  openingValue: integer('opening_value').notNull(),
  depreciationAmount: integer('depreciation_amount').notNull(),
  closingValue: integer('closing_value').notNull(),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const taxYearSummary = sqliteTable('tax_year_summary', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
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
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
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
  ownerId: text('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const teamMembers = sqliteTable('team_members', {
  id: text('id').primaryKey(),
  teamId: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('viewer'),
  joinedAt: text('joined_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const teamInvitations = sqliteTable('team_invitations', {
  id: text('id').primaryKey(),
  teamId: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  role: text('role').notNull().default('viewer'),
  token: text('token').notNull().unique(),
  invitedBy: text('invited_by').notNull().references(() => users.id),
  status: text('status').notNull().default('pending'),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const subscriptions = sqliteTable('subscriptions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
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
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
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
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const parserFeedback = sqliteTable('parser_feedback', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  statementId: text('statement_id').references(() => statements.id, { onDelete: 'set null' }),
  transactionId: text('transaction_id').references(() => transactions.id, { onDelete: 'set null' }),
  feedbackType: text('feedback_type').notNull(),
  originalValue: text('original_value'),
  correctedValue: text('corrected_value'),
  fieldName: text('field_name'),
  notes: text('notes'),
  status: text('status').notNull().default('pending'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ============================================================================
// LEDGER & ACCOUNTING
// ============================================================================

export const chartOfAccounts = sqliteTable('chart_of_accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  parentId: text('parent_id'),
  isSystem: integer('is_system', { mode: 'boolean' }).default(false),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const journalEntries = sqliteTable('journal_entries', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
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
  entryId: text('entry_id').notNull().references(() => journalEntries.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull().references(() => chartOfAccounts.id),
  debit: integer('debit').default(0),
  credit: integer('credit').default(0),
  description: text('description'),
  lineOrder: integer('line_order').notNull().default(0),
});

export const accountingPeriods = sqliteTable('accounting_periods', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  status: text('status').notNull().default('open'),
  closedAt: text('closed_at'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const accountBalances = sqliteTable('account_balances', {
  id: text('id').primaryKey(),
  chartAccountId: text('chart_account_id').notNull().references(() => chartOfAccounts.id, { onDelete: 'cascade' }),
  periodId: text('period_id').notNull().references(() => accountingPeriods.id, { onDelete: 'cascade' }),
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
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  chunkCount: integer('chunk_count').default(0),
  lastUpdated: text('last_updated').notNull().default('CURRENT_TIMESTAMP'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const ragChunks = sqliteTable('rag_chunks', {
  id: text('id').primaryKey(),
  namespaceId: text('namespace_id').notNull().references(() => ragNamespaces.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  contentHash: text('content_hash').notNull(),
  chunkType: text('chunk_type').notNull(),
  metadata: text('metadata'),
  embedding: text('embedding'),
  sourceId: text('source_id'),
  sourceType: text('source_type'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const ragDocuments = sqliteTable('rag_documents', {
  id: text('id').primaryKey(),
  namespaceId: text('namespace_id').notNull().references(() => ragNamespaces.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  sourceType: text('source_type').notNull(),
  sourceId: text('source_id'),
  version: integer('version').notNull().default(1),
  chunkCount: integer('chunk_count').default(0),
  status: text('status').notNull().default('indexed'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const ragCitations = sqliteTable('rag_citations', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  queryId: text('query_id').notNull(),
  chunkId: text('chunk_id').notNull().references(() => ragChunks.id, { onDelete: 'cascade' }),
  relevanceScore: real('relevance_score'),
  usedInResponse: integer('used_in_response', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ============================================================================
// UPLOAD QUEUE
// ============================================================================

export const uploadQueue = sqliteTable('upload_queue', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
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

// Upload Queue
export type UploadQueueItem = typeof uploadQueue.$inferSelect;
