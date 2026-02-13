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
// COGNEE MULTI-USER
// =============================================================================

export const cogneeUserAccounts = pgTable('cognee_user_accounts', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    cogneeEmail: text('cognee_email').notNull(),
    cogneeRefreshToken: text('cognee_refresh_token'), // Encrypted refresh token, NOT password (D02 CRIT-03)
    cogneeUserId: text('cognee_user_id'),
    datasetPrefix: text('dataset_prefix').notNull(),
    isActive: boolean('is_active').default(true),
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
    userIdIdx: uniqueIndex('cognee_user_accounts_user_id_unique').on(table.userId),
    emailIdx: uniqueIndex('cognee_user_accounts_email_unique').on(table.cogneeEmail),
}));

export const cogneeSessions = pgTable('cognee_sessions', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    sessionType: text('session_type').notNull().default('chat'),
    cogneeSessionId: text('cognee_session_id'),
    state: text('state').notNull().default('active'),
    contextData: text('context_data'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
}, (table) => ({
    userStateIdx: index('cognee_sessions_user_state_idx').on(table.userId, table.state),
    expiresIdx: index('cognee_sessions_expires_idx').on(table.expiresAt),
}));

// =============================================================================
// WAVE 2: Agent Sessions, Mutations & Audit Log
// =============================================================================

export const pgAgentSessions = pgTable('agent_sessions', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).defaultNow().notNull(),
    status: text('status').notNull().default('active'),
    context: text('context'),
    totalMutations: integer('total_mutations').notNull().default(0),
    confirmedMutations: integer('confirmed_mutations').notNull().default(0),
    rejectedMutations: integer('rejected_mutations').notNull().default(0),
    queryCount: integer('query_count').notNull().default(0),
    agentTypesUsed: text('agent_types_used'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
    userIdx: index('idx_pg_agent_sessions_user').on(table.userId),
    statusIdx: index('idx_pg_agent_sessions_status').on(table.status),
    lastActivityIdx: index('idx_pg_agent_sessions_last_activity').on(table.lastActivityAt),
}));

export const pgAgentMutations = pgTable('agent_mutations', {
    id: text('id').primaryKey(),
    sessionId: text('session_id').notNull().references(() => pgAgentSessions.id),
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
    requiresConfirmation: boolean('requires_confirmation').notNull().default(true),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    executedAt: timestamp('executed_at', { withTimezone: true }),
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),
    rejectionReason: text('rejection_reason'),
    errorMessage: text('error_message'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
    sessionIdx: index('idx_pg_agent_mutations_session').on(table.sessionId),
    statusIdx: index('idx_pg_agent_mutations_status').on(table.status),
    agentIdx: index('idx_pg_agent_mutations_agent').on(table.agentType),
    targetIdx: index('idx_pg_agent_mutations_target').on(table.targetTable),
    createdIdx: index('idx_pg_agent_mutations_created').on(table.createdAt),
    expiryIdx: index('idx_pg_agent_mutations_expiry').on(table.status, table.expiresAt),
}));

export const pgAgentAuditLog = pgTable('agent_audit_log', {
    id: text('id').primaryKey(),
    mutationId: text('mutation_id').references(() => pgAgentMutations.id),
    sessionId: text('session_id').references(() => pgAgentSessions.id),
    agentType: text('agent_type').notNull(),
    action: text('action').notNull(),
    targetTable: text('target_table'),
    targetId: text('target_id'),
    beforeState: text('before_state'),
    afterState: text('after_state'),
    metadata: text('metadata'),
    userId: text('user_id'),
    ipAddress: text('ip_address'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
    mutationIdx: index('idx_pg_agent_audit_mutation').on(table.mutationId),
    sessionIdx: index('idx_pg_agent_audit_session').on(table.sessionId),
    agentIdx: index('idx_pg_agent_audit_agent').on(table.agentType),
    actionIdx: index('idx_pg_agent_audit_action').on(table.action),
    createdIdx: index('idx_pg_agent_audit_created').on(table.createdAt),
    targetIdx: index('idx_pg_agent_audit_target').on(table.targetTable),
}));

// =============================================================================
// MULTI-TENANT (Wave 23)
// =============================================================================

export const tenants = pgTable('tenants', {
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
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
    slugIdx: uniqueIndex('tenants_slug_unique').on(table.slug),
}));

export const tenantMembers = pgTable('tenant_members', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('viewer'),
    displayName: text('display_name'),
    isPrimaryContact: boolean('is_primary_contact').notNull().default(false),
    invitedBy: text('invited_by').references(() => users.id),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow(),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
    tenantIdx: index('idx_tenant_members_tenant').on(table.tenantId),
    userIdx: index('idx_tenant_members_user').on(table.userId),
    tenantRoleIdx: index('idx_tenant_members_role').on(table.tenantId, table.role),
}));

export const tenantInvitations = pgTable('tenant_invitations', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: text('role').notNull().default('viewer'),
    invitedBy: text('invited_by').notNull().references(() => users.id),
    token: text('token').notNull().unique(),
    status: text('status').notNull().default('pending'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
    emailIdx: index('idx_tenant_invitations_email').on(table.email),
    tokenIdx: uniqueIndex('idx_tenant_invitations_token').on(table.token),
    tenantStatusIdx: index('idx_tenant_invitations_status').on(table.tenantId, table.status),
}));

export const permissions = pgTable('permissions', {
    id: text('id').primaryKey(),
    name: text('name').notNull().unique(),
    description: text('description'),
    resource: text('resource').notNull(),
    action: text('action').notNull(),
    isSystem: boolean('is_system').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
    nameIdx: uniqueIndex('permissions_name_unique').on(table.name),
}));

export const rolePermissions = pgTable('role_permissions', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    permissionId: text('permission_id').notNull().references(() => permissions.id, { onDelete: 'cascade' }),
    grantedBy: text('granted_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
    tenantRoleIdx: index('idx_role_permissions_tenant_role').on(table.tenantId, table.role),
}));

export const subscriptionPlans = pgTable('subscription_plans', {
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
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
    nameIdx: uniqueIndex('subscription_plans_name_unique').on(table.name),
}));

export const subscriptionHistory = pgTable('subscription_history', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    planId: text('plan_id').notNull().references(() => subscriptionPlans.id),
    status: text('status').notNull().default('active'),
    billingCycle: text('billing_cycle').notNull().default('monthly'),
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true }).notNull(),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }).notNull(),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    trialEnd: timestamp('trial_end', { withTimezone: true }),
    paymentMethodJson: text('payment_method_json'),
    usageJson: text('usage_json').default('{"members":0,"accounts":0,"transactions":0,"aiQueries":0,"storageMb":0}'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
    tenantIdx: index('idx_subscription_history_tenant').on(table.tenantId),
    tenantStatusIdx: index('idx_subscription_history_status').on(table.tenantId, table.status),
}));

export const apiRateLimits = pgTable('api_rate_limits', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    endpointPattern: text('endpoint_pattern').notNull(),
    requestsPerMinute: integer('requests_per_minute').notNull().default(60),
    requestsPerHour: integer('requests_per_hour').notNull().default(1000),
    requestsPerDay: integer('requests_per_day').notNull().default(10000),
    burstLimit: integer('burst_limit').notNull().default(10),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
    tenantIdx: index('idx_api_rate_limits_tenant').on(table.tenantId),
}));

// =============================================================================
// ACCOUNTS PAYABLE & PURCHASE ORDERS (Wave 10)
// =============================================================================

export const suppliers = pgTable('suppliers', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
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
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
    userActiveIdx: index('idx_suppliers_user_active').on(table.userId, table.isActive),
    userAbnIdx: index('idx_suppliers_user_abn').on(table.userId, table.abn),
}));

export const bills = pgTable('bills', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    supplierId: text('supplier_id').notNull().references(() => suppliers.id),
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
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
    userStatusIdx: index('idx_bills_user_status').on(table.userId, table.status),
    supplierIdx: index('idx_bills_supplier').on(table.supplierId),
    dueDateIdx: index('idx_bills_due_date').on(table.dueDate),
}));

export const billLines = pgTable('bill_lines', {
    id: text('id').primaryKey(),
    billId: text('bill_id').notNull().references(() => bills.id, { onDelete: 'cascade' }),
    description: text('description').notNull(),
    quantity: real('quantity').notNull().default(1),
    unitPrice: integer('unit_price').notNull().default(0),
    amount: integer('amount').notNull().default(0),
    gstRate: real('gst_rate').default(0.1),
    gstAmount: integer('gst_amount').default(0),
    accountCode: text('account_code'),
    taxCode: text('tax_code'),
}, (table) => ({
    billIdx: index('idx_bill_lines_bill').on(table.billId),
}));

export const billPayments = pgTable('bill_payments', {
    id: text('id').primaryKey(),
    billId: text('bill_id').notNull().references(() => bills.id),
    paymentDate: text('payment_date').notNull(),
    amount: integer('amount').notNull(),
    paymentMethod: text('payment_method'),
    reference: text('reference'),
    transactionId: text('transaction_id').references(() => transactions.id),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
    billIdx: index('idx_bill_payments_bill').on(table.billId),
    transactionIdx: index('idx_bill_payments_transaction').on(table.transactionId),
}));

export const purchaseOrders = pgTable('purchase_orders', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    supplierId: text('supplier_id').notNull().references(() => suppliers.id),
    poNumber: text('po_number').notNull().unique(),
    status: text('status').notNull().default('draft'),
    issueDate: text('issue_date').notNull(),
    expectedDate: text('expected_date'),
    subtotal: integer('subtotal').notNull().default(0),
    gstAmount: integer('gst_amount').notNull().default(0),
    totalAmount: integer('total_amount').notNull().default(0),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
    userStatusIdx: index('idx_purchase_orders_user_status').on(table.userId, table.status),
    supplierIdx: index('idx_purchase_orders_supplier').on(table.supplierId),
    poNumberIdx: uniqueIndex('idx_purchase_orders_po_number').on(table.poNumber),
}));

export const poLines = pgTable('po_lines', {
    id: text('id').primaryKey(),
    purchaseOrderId: text('purchase_order_id').notNull().references(() => purchaseOrders.id, { onDelete: 'cascade' }),
    description: text('description').notNull(),
    quantity: real('quantity').notNull().default(1),
    unitPrice: integer('unit_price').notNull().default(0),
    amount: integer('amount').notNull().default(0),
    quantityReceived: real('quantity_received').notNull().default(0),
}, (table) => ({
    purchaseOrderIdx: index('idx_po_lines_purchase_order').on(table.purchaseOrderId),
}));

export const poReceipts = pgTable('po_receipts', {
    id: text('id').primaryKey(),
    purchaseOrderId: text('purchase_order_id').notNull().references(() => purchaseOrders.id),
    receiptDate: text('receipt_date').notNull(),
    receivedBy: text('received_by').references(() => users.id),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
    purchaseOrderIdx: index('idx_po_receipts_purchase_order').on(table.purchaseOrderId),
}));

export const poReceiptLines = pgTable('po_receipt_lines', {
    id: text('id').primaryKey(),
    receiptId: text('receipt_id').notNull().references(() => poReceipts.id, { onDelete: 'cascade' }),
    poLineId: text('po_line_id').notNull().references(() => poLines.id),
    quantityReceived: real('quantity_received').notNull(),
}, (table) => ({
    receiptIdx: index('idx_po_receipt_lines_receipt').on(table.receiptId),
    poLineIdx: index('idx_po_receipt_lines_po_line').on(table.poLineId),
}));

export const supplierPaymentRuns = pgTable('supplier_payment_runs', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    paymentDate: text('payment_date').notNull(),
    status: text('status').notNull().default('draft'),
    totalAmount: integer('total_amount').notNull().default(0),
    bankReference: text('bank_reference'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
    userStatusIdx: index('idx_supplier_payment_runs_user_status').on(table.userId, table.status),
    dateIdx: index('idx_supplier_payment_runs_date').on(table.paymentDate),
}));

export const supplierPaymentRunItems = pgTable('supplier_payment_run_items', {
    id: text('id').primaryKey(),
    paymentRunId: text('payment_run_id').notNull().references(() => supplierPaymentRuns.id, { onDelete: 'cascade' }),
    billId: text('bill_id').notNull().references(() => bills.id),
    amount: integer('amount').notNull(),
}, (table) => ({
    runIdx: index('idx_supplier_payment_run_items_run').on(table.paymentRunId),
    billIdx: index('idx_supplier_payment_run_items_bill').on(table.billId),
}));

// =============================================================================
// PWA SUPPORT (Wave 24)
// =============================================================================

export const pushSubscriptions = pgTable('push_subscriptions', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull().unique(),
    keysJson: text('keys_json').notNull(),
    userAgent: text('user_agent'),
    deviceName: text('device_name'),
    isActive: boolean('is_active').notNull().default(true),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    errorCount: integer('error_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
    userIdx: index('idx_pg_push_subscriptions_user').on(table.userId),
    tenantIdx: index('idx_pg_push_subscriptions_tenant').on(table.tenantId),
    activeIdx: index('idx_pg_push_subscriptions_active').on(table.isActive),
    endpointIdx: uniqueIndex('pg_push_subscriptions_endpoint_unique').on(table.endpoint),
}));

export const notificationPreferences = pgTable('notification_preferences', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    transactionAlerts: boolean('transaction_alerts').notNull().default(true),
    basReminders: boolean('bas_reminders').notNull().default(true),
    budgetAlerts: boolean('budget_alerts').notNull().default(true),
    taxReminders: boolean('tax_reminders').notNull().default(true),
    billReminders: boolean('bill_reminders').notNull().default(true),
    syncNotifications: boolean('sync_notifications').notNull().default(false),
    teamNotifications: boolean('team_notifications').notNull().default(true),
    systemNotifications: boolean('system_notifications').notNull().default(true),
    largeTransactionThresholdCents: integer('large_transaction_threshold_cents').notNull().default(100000),
    budgetAlertThresholdPercent: integer('budget_alert_threshold_percent').notNull().default(80),
    pushEnabled: boolean('push_enabled').notNull().default(true),
    emailEnabled: boolean('email_enabled').notNull().default(false),
    quietHoursStart: text('quiet_hours_start'),
    quietHoursEnd: text('quiet_hours_end'),
    timezone: text('timezone').default('Australia/Sydney'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
    userTenantIdx: index('idx_pg_notification_preferences_user_tenant').on(table.userId, table.tenantId),
    userTenantUniqueIdx: uniqueIndex('pg_notification_preferences_user_tenant_unique').on(table.userId, table.tenantId),
}));

export const offlineSyncLog = pgTable('offline_sync_log', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
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
    syncedAt: timestamp('synced_at', { withTimezone: true }),
    errorMessage: text('error_message'),
    retryCount: integer('retry_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
    userIdx: index('idx_pg_offline_sync_user').on(table.userId),
    statusIdx: index('idx_pg_offline_sync_status').on(table.syncStatus),
    deviceIdx: index('idx_pg_offline_sync_device').on(table.deviceId),
    pendingIdx: index('idx_pg_offline_sync_pending').on(table.syncStatus, table.createdAt),
}));

// =============================================================================
// EMPLOYEE MANAGEMENT (Wave 4)
// =============================================================================

export const pgEmployees = pgTable('employees', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
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
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
    userStatusIdx: index('idx_employees_user_status').on(table.userId, table.status),
    userNameIdx: index('idx_employees_user_name').on(table.userId, table.lastName, table.firstName),
}));

export const pgEmployeeBankDetails = pgTable('employee_bank_details', {
    id: text('id').primaryKey(),
    employeeId: text('employee_id').notNull().references(() => pgEmployees.id, { onDelete: 'cascade' }),
    bsb: text('bsb').notNull(), // AES-256-GCM encrypted
    accountNumber: text('account_number').notNull(), // AES-256-GCM encrypted
    accountName: text('account_name').notNull(),
    splitPercentage: real('split_percentage').notNull().default(100.0),
    isPrimary: boolean('is_primary').default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
    employeeIdx: index('idx_employee_bank_details_employee').on(table.employeeId),
}));

export const pgEmployeeSuperFunds = pgTable('employee_super_funds', {
    id: text('id').primaryKey(),
    employeeId: text('employee_id').notNull().references(() => pgEmployees.id, { onDelete: 'cascade' }),
    fundName: text('fund_name').notNull(),
    fundABN: text('fund_abn'),
    usi: text('usi'),
    memberNumber: text('member_number'),
    contributionRate: real('contribution_rate').notNull().default(11.5),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
    employeeIdx: index('idx_employee_super_funds_employee').on(table.employeeId),
}));

export const pgEmployeeTaxDeclarations = pgTable('employee_tax_declarations', {
    id: text('id').primaryKey(),
    employeeId: text('employee_id').notNull().references(() => pgEmployees.id, { onDelete: 'cascade' }),
    taxFreeThreshold: boolean('tax_free_threshold').default(true),
    helpDebt: boolean('help_debt').default(false),
    sfssDebt: boolean('sfss_debt').default(false),
    claimDependents: integer('claim_dependents').default(0),
    taxOffsetEstimated: integer('tax_offset_estimated').default(0),
    effectiveDate: text('effective_date').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
    employeeDateIdx: index('idx_employee_tax_declarations_employee_date').on(table.employeeId, table.effectiveDate),
}));

export const pgPayCategories = pgTable('pay_categories', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: text('type').notNull(),
    rateType: text('rate_type').notNull().default('hourly'),
    defaultRate: integer('default_rate').default(0),
    multiplier: real('multiplier').default(1.0),
    isTaxable: boolean('is_taxable').default(true),
    isSuperBearing: boolean('is_super_bearing').default(true),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
    userTypeIdx: index('idx_pay_categories_user_type').on(table.userId, table.type),
    userActiveIdx: index('idx_pay_categories_user_active').on(table.userId, table.isActive),
}));

export const pgPayStructures = pgTable('pay_structures', {
    id: text('id').primaryKey(),
    employeeId: text('employee_id').notNull().references(() => pgEmployees.id, { onDelete: 'cascade' }),
    payCategoryId: text('pay_category_id').notNull().references(() => pgPayCategories.id),
    rate: integer('rate').notNull(),
    hoursPerWeek: real('hours_per_week'),
    annualSalary: integer('annual_salary'),
    effectiveDate: text('effective_date').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
    employeeDateIdx: index('idx_pay_structures_employee_date').on(table.employeeId, table.effectiveDate),
    payCategoryIdx: index('idx_pay_structures_pay_category').on(table.payCategoryId),
}));

export const pgEmployeeDocuments = pgTable('employee_documents', {
    id: text('id').primaryKey(),
    employeeId: text('employee_id').notNull().references(() => pgEmployees.id, { onDelete: 'cascade' }),
    documentType: text('document_type').notNull(),
    fileName: text('file_name').notNull(),
    filePath: text('file_path').notNull(),
    fileSize: integer('file_size'),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
    employeeTypeIdx: index('idx_employee_documents_employee_type').on(table.employeeId, table.documentType),
}));

// =============================================================================
// CUSTOMER MANAGEMENT & INVOICING (Wave 7)
// =============================================================================

export const pgCustomers = pgTable('customers', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
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
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
    userActiveIdx: index('idx_customers_user_active').on(table.userId, table.isActive),
    userAbnIdx: index('idx_customers_user_abn').on(table.userId, table.abn),
    userEmailIdx: index('idx_customers_user_email').on(table.userId, table.email),
}));

export const pgCustomerContacts = pgTable('customer_contacts', {
    id: text('id').primaryKey(),
    customerId: text('customer_id').notNull().references(() => pgCustomers.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    email: text('email'),
    phone: text('phone'),
    role: text('role'),
    isPrimary: boolean('is_primary').default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
    customerIdx: index('idx_customer_contacts_customer').on(table.customerId),
}));

export const pgInvoices = pgTable('invoices', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    customerId: text('customer_id').notNull().references(() => pgCustomers.id),
    invoiceNumber: text('invoice_number').notNull().unique(),
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
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
    userStatusIdx: index('idx_invoices_user_status').on(table.userId, table.status),
    customerIdx: index('idx_invoices_customer').on(table.customerId),
    dueDateIdx: index('idx_invoices_due_date').on(table.dueDate),
}));

export const pgInvoiceLines = pgTable('invoice_lines', {
    id: text('id').primaryKey(),
    invoiceId: text('invoice_id').notNull().references(() => pgInvoices.id, { onDelete: 'cascade' }),
    description: text('description').notNull(),
    quantity: real('quantity').notNull().default(1),
    unitPrice: integer('unit_price').notNull().default(0),
    amount: integer('amount').notNull().default(0),
    gstRate: real('gst_rate').notNull().default(0.1),
    gstAmount: integer('gst_amount').notNull().default(0),
    accountCode: text('account_code'),
    taxCode: text('tax_code'),
}, (table) => ({
    invoiceIdx: index('idx_invoice_lines_invoice').on(table.invoiceId),
}));

export const pgInvoiceNumberSequences = pgTable('invoice_number_sequences', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    prefix: text('prefix').notNull().default('INV-'),
    nextNumber: integer('next_number').notNull().default(1),
    format: text('format').notNull().default('{prefix}{number:06d}'),
}, (table) => ({
    userIdx: uniqueIndex('idx_invoice_sequences_user').on(table.userId),
}));

export const pgInvoicePayments = pgTable('invoice_payments', {
    id: text('id').primaryKey(),
    invoiceId: text('invoice_id').notNull().references(() => pgInvoices.id, { onDelete: 'cascade' }),
    paymentDate: text('payment_date').notNull(),
    amount: integer('amount').notNull(),
    paymentMethod: text('payment_method'),
    reference: text('reference'),
    transactionId: text('transaction_id').references(() => transactions.id),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
    invoiceIdx: index('idx_invoice_payments_invoice').on(table.invoiceId),
    transactionIdx: index('idx_invoice_payments_transaction').on(table.transactionId),
}));

// =============================================================================
// TYPE EXPORTS FOR DRIZZLE
// =============================================================================

export type PgAgentSession = typeof pgAgentSessions.$inferSelect;
export type NewPgAgentSession = typeof pgAgentSessions.$inferInsert;
export type PgAgentMutation = typeof pgAgentMutations.$inferSelect;
export type NewPgAgentMutation = typeof pgAgentMutations.$inferInsert;
export type PgAgentAuditLog = typeof pgAgentAuditLog.$inferSelect;
export type NewPgAgentAuditLog = typeof pgAgentAuditLog.$inferInsert;

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

// Multi-Tenant (Wave 23)
export type PgTenant = typeof tenants.$inferSelect;
export type NewPgTenant = typeof tenants.$inferInsert;
export type PgTenantMember = typeof tenantMembers.$inferSelect;
export type NewPgTenantMember = typeof tenantMembers.$inferInsert;
export type PgTenantInvitation = typeof tenantInvitations.$inferSelect;
export type NewPgTenantInvitation = typeof tenantInvitations.$inferInsert;
export type PgPermission = typeof permissions.$inferSelect;
export type NewPgPermission = typeof permissions.$inferInsert;
export type PgRolePermission = typeof rolePermissions.$inferSelect;
export type NewPgRolePermission = typeof rolePermissions.$inferInsert;
export type PgSubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type NewPgSubscriptionPlan = typeof subscriptionPlans.$inferInsert;
export type PgSubscriptionHistory = typeof subscriptionHistory.$inferSelect;
export type NewPgSubscriptionHistory = typeof subscriptionHistory.$inferInsert;
export type PgApiRateLimit = typeof apiRateLimits.$inferSelect;
export type NewPgApiRateLimit = typeof apiRateLimits.$inferInsert;

// Cognee Multi-User
export type PgCogneeUserAccount = typeof cogneeUserAccounts.$inferSelect;
export type NewPgCogneeUserAccount = typeof cogneeUserAccounts.$inferInsert;
export type PgCogneeSession = typeof cogneeSessions.$inferSelect;
export type NewPgCogneeSession = typeof cogneeSessions.$inferInsert;

// Accounts Payable & Purchase Orders (Wave 10)
export type PgSupplier = typeof suppliers.$inferSelect;
export type NewPgSupplier = typeof suppliers.$inferInsert;
export type PgBill = typeof bills.$inferSelect;
export type NewPgBill = typeof bills.$inferInsert;
export type PgBillLine = typeof billLines.$inferSelect;
export type NewPgBillLine = typeof billLines.$inferInsert;
export type PgBillPayment = typeof billPayments.$inferSelect;
export type NewPgBillPayment = typeof billPayments.$inferInsert;
export type PgPurchaseOrder = typeof purchaseOrders.$inferSelect;
export type NewPgPurchaseOrder = typeof purchaseOrders.$inferInsert;
export type PgPOLine = typeof poLines.$inferSelect;
export type NewPgPOLine = typeof poLines.$inferInsert;
export type PgPOReceipt = typeof poReceipts.$inferSelect;
export type NewPgPOReceipt = typeof poReceipts.$inferInsert;
export type PgPOReceiptLine = typeof poReceiptLines.$inferSelect;
export type NewPgPOReceiptLine = typeof poReceiptLines.$inferInsert;
export type PgSupplierPaymentRun = typeof supplierPaymentRuns.$inferSelect;
export type NewPgSupplierPaymentRun = typeof supplierPaymentRuns.$inferInsert;
export type PgSupplierPaymentRunItem = typeof supplierPaymentRunItems.$inferSelect;
export type NewPgSupplierPaymentRunItem = typeof supplierPaymentRunItems.$inferInsert;

// PWA Support (Wave 24)
export type PgPushSubscription = typeof pushSubscriptions.$inferSelect;
export type NewPgPushSubscription = typeof pushSubscriptions.$inferInsert;
export type PgNotificationPreference = typeof notificationPreferences.$inferSelect;
export type NewPgNotificationPreference = typeof notificationPreferences.$inferInsert;
export type PgOfflineSyncLog = typeof offlineSyncLog.$inferSelect;
export type NewPgOfflineSyncLog = typeof offlineSyncLog.$inferInsert;

// Employee Management (Wave 4)
export type PgEmployee = typeof pgEmployees.$inferSelect;
export type NewPgEmployee = typeof pgEmployees.$inferInsert;
export type PgEmployeeBankDetail = typeof pgEmployeeBankDetails.$inferSelect;
export type NewPgEmployeeBankDetail = typeof pgEmployeeBankDetails.$inferInsert;
export type PgEmployeeSuperFund = typeof pgEmployeeSuperFunds.$inferSelect;
export type NewPgEmployeeSuperFund = typeof pgEmployeeSuperFunds.$inferInsert;
export type PgEmployeeTaxDeclaration = typeof pgEmployeeTaxDeclarations.$inferSelect;
export type NewPgEmployeeTaxDeclaration = typeof pgEmployeeTaxDeclarations.$inferInsert;
export type PgPayCategory = typeof pgPayCategories.$inferSelect;
export type NewPgPayCategory = typeof pgPayCategories.$inferInsert;
export type PgPayStructure = typeof pgPayStructures.$inferSelect;
export type NewPgPayStructure = typeof pgPayStructures.$inferInsert;
export type PgEmployeeDocument = typeof pgEmployeeDocuments.$inferSelect;
export type NewPgEmployeeDocument = typeof pgEmployeeDocuments.$inferInsert;

// Customers & Invoicing (Wave 7)
export type PgCustomer = typeof pgCustomers.$inferSelect;
export type NewPgCustomer = typeof pgCustomers.$inferInsert;
export type PgCustomerContact = typeof pgCustomerContacts.$inferSelect;
export type NewPgCustomerContact = typeof pgCustomerContacts.$inferInsert;
export type PgInvoice = typeof pgInvoices.$inferSelect;
export type NewPgInvoice = typeof pgInvoices.$inferInsert;
export type PgInvoiceLine = typeof pgInvoiceLines.$inferSelect;
export type NewPgInvoiceLine = typeof pgInvoiceLines.$inferInsert;
export type PgInvoiceNumberSequence = typeof pgInvoiceNumberSequences.$inferSelect;
export type NewPgInvoiceNumberSequence = typeof pgInvoiceNumberSequences.$inferInsert;
export type PgInvoicePayment = typeof pgInvoicePayments.$inferSelect;
export type NewPgInvoicePayment = typeof pgInvoicePayments.$inferInsert;
