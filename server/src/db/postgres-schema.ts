/**
 * PostgreSQL Schema for AI Accountant
 *
 * Key differences from SQLite:
 * - Uses SERIAL for auto-increment (though we use UUID text IDs)
 * - Uses NUMERIC(12,2) for currency amounts (Australian dollars with cent precision)
 * - Uses TIMESTAMPTZ for timestamps (timezone-aware)
 * - Uses REAL for percentages and confidence scores
 * - Uses BOOLEAN instead of INTEGER for boolean flags
 */

import {
    pgTable,
    text,
    integer,
    real,
    boolean,
    numeric,
    timestamp,
    index,
    uniqueIndex,
} from 'drizzle-orm/pg-core';

// =============================================================================
// USERS & AUTHENTICATION
// =============================================================================

export const users = pgTable(
    'users',
    {
        id: text('id').primaryKey(),
        username: text('username').notNull().unique(),
        passwordHash: text('password_hash').notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => ({
        usernameIdx: uniqueIndex('users_username_unique').on(table.username),
    })
);

export const userSettings = pgTable('user_settings', {
    userId: text('user_id')
        .primaryKey()
        .references(() => users.id, { onDelete: 'cascade' }),
    modelParsingText: text('model_parsing_text')
        .notNull()
        .default('google/gemini-3-flash-preview'),
    modelParsingVision: text('model_parsing_vision')
        .notNull()
        .default('google/gemini-3-flash-preview'),
    modelCategorization: text('model_categorization')
        .notNull()
        .default('google/gemini-3-flash-preview'),
    modelChat: text('model_chat')
        .notNull()
        .default('google/gemini-3-flash-preview'),
    modelEmbedding: text('model_embedding')
        .notNull()
        .default('openai/text-embedding-3-large'),
});

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
    })
);

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
            table.balanceDate
        ),
    })
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
        periodIdx: index('statements_period_idx').on(
            table.periodStartDate,
            table.periodEndDate
        ),
    })
);

export const statementAccounts = pgTable(
    'statement_accounts',
    {
        statementId: text('statement_id')
            .primaryKey()
            .references(() => statements.id, { onDelete: 'cascade' }),
        accountId: text('account_id')
            .notNull()
            .references(() => accounts.id, { onDelete: 'cascade' }),
    }
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
        transferIdx: index('transactions_transfer_idx').on(
            table.isTransfer,
            table.transferLinkId
        ),
    })
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
        transactionIdIdx: index('transaction_history_transaction_idx').on(
            table.transactionId
        ),
        timestampIdx: index('transaction_history_timestamp_idx').on(table.timestamp),
    })
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
    })
);

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
        userCategoriesIdx: index('user_categories_idx').on(
            table.userId,
            table.categoryName
        ),
    })
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
        userPatternIdx: index('merchant_user_pattern_idx').on(
            table.userId,
            table.merchantPattern
        ),
        categoryIdx: index('merchant_category_idx').on(table.category),
    })
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
    })
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
    })
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
    })
);

// =============================================================================
// TYPE EXPORTS FOR DRIZZLE
// =============================================================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type UserSettings = typeof userSettings.$inferSelect;
export type NewUserSettings = typeof userSettings.$inferInsert;

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;

export type Statement = typeof statements.$inferSelect;
export type NewStatement = typeof statements.$inferInsert;

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

export type TransferLink = typeof transferLinks.$inferSelect;
export type NewTransferLink = typeof transferLinks.$inferInsert;

export type MerchantMemory = typeof merchantMemory.$inferSelect;
export type NewMerchantMemory = typeof merchantMemory.$inferInsert;

export type ReconciliationAlert = typeof reconciliationAlerts.$inferSelect;
export type NewReconciliationAlert = typeof reconciliationAlerts.$inferInsert;
