export const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3501';
const API_URL = `${BASE_URL}/api`;

export interface UserSettings {
    userId: string;
    modelParsingText: string;
    modelParsingVision: string;
    modelCategorization: string;
    modelChat: string;
    modelEmbedding: string;
}

export const getAuthHeaders = (): HeadersInit => {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
};

export const getToken = (): string | null => localStorage.getItem('token');

export interface Transaction {
    id: string;
    date: string;
    description: string;
    amount: number;
    balance?: number;
    category?: string;
    gstApplicable: boolean;
    confidenceScore: number;
    aiReasoningNotes?: string;
    isEdited?: boolean;
    isTransfer?: boolean;
    transferLinkId?: string;
    isOwnerContribution?: boolean;
    merchantNormalized?: string;
    accountId?: string;
    parentTransactionId?: string;
    statementId?: string;
    userId?: string;
}


export interface Statement {
    id: string;
    filename: string;
    hash: string;
    uploadDate: string;
    parsingStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    aiModelUsed: string | null;
    errorMessage?: string | null;
    errorType?: 'PDF_READ_ERROR' | 'AI_PARSE_ERROR' | 'EMPTY_STATEMENT' | 'CRITICAL_ERROR' | null;
    errorDetails?: string | null;
    userId: string | null;
    // Statement period and validation fields
    periodStartDate?: string | null;
    periodEndDate?: string | null;
    openingBalance?: number | null;
    closingBalance?: number | null;
    transactionCount?: number | null;
    isComplete?: boolean;
    validationErrors?: string | null;
}

export interface StatementGapAnalysis {
    coverage: {
        earliestDate: string | null;
        latestDate: string | null;
        totalStatements: number;
        totalGaps: number;
        totalOverlaps: number;
        totalBalanceMismatches: number;
        hasIssues: boolean;
    };
    gaps: Array<{
        accountId: string | null;
        gapStart: string;
        gapEnd: string;
        gapDays: number;
        beforeStatement: string | null;
        afterStatement: string | null;
    }>;
    overlaps: Array<{
        accountId: string | null;
        statement1: string;
        statement2: string;
        overlapStart: string;
        overlapEnd: string;
        overlapDays: number;
    }>;
    balanceMismatches: Array<{
        accountId: string | null;
        statement1: string;
        statement2: string;
        expectedBalance: number;
        actualBalance: number;
        difference: number;
    }>;
    statements: Array<{
        id: string;
        filename: string;
        periodStartDate: string | null;
        periodEndDate: string | null;
        openingBalance: number | null;
        closingBalance: number | null;
        transactionCount: number | null;
        parsingStatus: string;
        accountId: string | null;
    }>;
}

export interface TransactionStats {
    totalIncome: number;
    totalExpenses: number;
    netFlow: number;
    transactionCount: number;
    categoryBreakdown: Record<string, number>;
}

export interface BatchFileStatus {
    id: string;
    filename: string;
    state: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
    statementId?: string;
    error?: string;
    retryCount?: number;
}

export interface BatchUploadResponse {
    message: string;
    jobId: string;
    fileCount: number;
    files: BatchFileStatus[];
}

export interface BatchJobStatus {
    id: string;
    state: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
    progress: {
        total: number;
        completed: number;
        failed: number;
        processing: number;
    };
    files: BatchFileStatus[];
    createdAt: string;
    startedAt?: string;
    completedAt?: string;
    error?: string;
}

export const api = {
    fetchTransactions: async (options?: { limit?: number; offset?: number; accountId?: string }): Promise<{ transactions: Transaction[]; total: number }> => {
        const params = new URLSearchParams();
        if (options?.limit) params.set('limit', String(options.limit));
        if (options?.offset) params.set('offset', String(options.offset));
        if (options?.accountId) params.set('accountId', options.accountId);
        const qs = params.toString();
        const res = await fetch(`${API_URL}/transactions${qs ? `?${qs}` : ''}`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch transactions');
        return res.json();
    },

    fetchStatements: async (): Promise<Statement[]> => {
        const res = await fetch(`${API_URL}/statements`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch statements');
        return res.json();
    },

    sendChatMessage: async (query: string): Promise<{ answer: string }> => {
        const res = await fetch(`${API_URL}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ query })
        });
        if (!res.ok) throw new Error('Failed to send chat message');
        return res.json();
    },

    calculateStats: (transactions: Transaction[]): TransactionStats => {
        // Exclude transfers from income/expense calculations
        const nonTransfers = transactions.filter(t => !t.isTransfer);

        const income = nonTransfers
            .filter(t => t.amount > 0)
            .reduce((sum, t) => sum + t.amount, 0);
        const expenses = nonTransfers
            .filter(t => t.amount < 0)
            .reduce((sum, t) => sum + Math.abs(t.amount), 0);

        const categoryBreakdown: Record<string, number> = {};
        nonTransfers.forEach(t => {
            const cat = t.category || 'Uncategorized';
            categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + Math.abs(t.amount);
        });

        return {
            totalIncome: income,
            totalExpenses: expenses,
            netFlow: income - expenses,
            transactionCount: transactions.length,
            categoryBreakdown
        };
    },

    updateTransaction: async (id: string, updates: Partial<Transaction>): Promise<void> => {
        const res = await fetch(`${API_URL}/transactions/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify(updates)
        });
        if (!res.ok) throw new Error('Failed to update transaction');
    },

    splitTransaction: async (id: string, splits: Array<{ category: string, amount: number, description: string, gst: boolean }>): Promise<void> => {
        const res = await fetch(`${API_URL}/transactions/${id}/split`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ splits })
        });
        if (!res.ok) throw new Error('Failed to split transaction');
    },

    deleteTransaction: async (id: string): Promise<void> => {
        const res = await fetch(`${API_URL}/transactions/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed to delete transaction');
    },

    uploadStatement: async (file: File): Promise<{
        id: string;
        message: string;
        isDuplicate?: boolean;
        existingFilename?: string;
        uploadedOn?: string;
    }> => {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(`${API_URL}/statements/upload`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: formData
        });
        if (res.status === 409) {
            const data = await res.json();
            return {
                id: data.id,
                message: 'Duplicate file',
                isDuplicate: true,
                existingFilename: data.existingFilename,
                uploadedOn: data.uploadedOn
            };
        }
        if (!res.ok) {
            const error = await res.json().catch(() => ({ error: 'Upload failed' }));
            throw new Error(error.error || 'Upload failed');
        }
        return res.json();
    },

    reprocessStatement: async (id: string): Promise<void> => {
        const res = await fetch(`${API_URL}/statements/${id}/reprocess`, {
            method: 'POST',
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed to reprocess statement');
    },

    uploadBatch: async (files: File[]): Promise<BatchUploadResponse> => {
        const formData = new FormData();
        files.forEach(file => formData.append('files', file));
        const res = await fetch(`${API_URL}/statements/batch`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: formData
        });
        if (!res.ok) {
            const error = await res.json().catch(() => ({ error: 'Batch upload failed' }));
            throw new Error(error.error || 'Batch upload failed');
        }
        return res.json();
    },

    getBatchStatus: async (jobId: string): Promise<BatchJobStatus> => {
        const res = await fetch(`${API_URL}/statements/batch/${jobId}`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed to get batch status');
        return res.json();
    },

    cancelBatch: async (jobId: string): Promise<{ cancelled: boolean }> => {
        const res = await fetch(`${API_URL}/statements/batch/${jobId}/cancel`, {
            method: 'POST',
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed to cancel batch');
        return res.json();
    },

    retryBatch: async (jobId: string): Promise<{ retried: boolean }> => {
        const res = await fetch(`${API_URL}/statements/batch/${jobId}/retry`, {
            method: 'POST',
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed to retry batch');
        return res.json();
    },

    fetchStatementGapAnalysis: async (): Promise<StatementGapAnalysis> => {
        const res = await fetch(`${API_URL}/statements/gap-analysis`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch gap analysis');
        return res.json();
    },

    login: async (username: string, password: string): Promise<{ token: string; user: { id: string; username: string } }> => {
        const res = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        if (!res.ok) {
            const error = await res.json().catch(() => ({ error: 'Login failed' }));
            throw new Error(error.error || 'Login failed');
        }
        return res.json();
    },

    register: async (username: string, password: string): Promise<{ token: string; user: { id: string; username: string } }> => {
        const res = await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        if (!res.ok) {
            const error = await res.json().catch(() => ({ error: 'Registration failed' }));
            throw new Error(error.error || 'Registration failed');
        }
        return res.json();
    },

    fetchSettings: async (): Promise<UserSettings> => {
        const res = await fetch(`${API_URL}/settings`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch settings');
        return res.json();
    },

    updateSettings: async (settings: UserSettings): Promise<void> => {
        const res = await fetch(`${API_URL}/settings`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify(settings)
        });
        if (!res.ok) throw new Error('Failed to update settings');
    },

    getCurrentUser: async (): Promise<{ id: string; username: string }> => {
        const res = await fetch(`${BASE_URL}/auth/me`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch user');
        const data = await res.json();
        return data.user;
    },

    // Account Management
    fetchAccounts: async (): Promise<Account[]> => {
        const res = await fetch(`${API_URL}/accounts`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch accounts');
        return res.json();
    },

    createAccount: async (data: CreateAccountRequest): Promise<{ id: string; accountNumber: string }> => {
        const res = await fetch(`${API_URL}/accounts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const error = await res.json().catch(() => ({ error: 'Failed to create account' }));
            throw new Error(error.error || 'Failed to create account');
        }
        return res.json();
    },

    updateAccount: async (id: string, updates: Partial<Account>): Promise<void> => {
        const res = await fetch(`${API_URL}/accounts/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify(updates)
        });
        if (!res.ok) throw new Error('Failed to update account');
    },

    // Pending Categorizations
    fetchPendingCategorizations: async (): Promise<PendingCategorization[]> => {
        const res = await fetch(`${API_URL}/pending-categorizations`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch pending categorizations');
        return res.json();
    },

    resolveCategorization: async (id: string, action: 'approve' | 'reject' | 'modify', category?: string, gstApplicable?: boolean): Promise<void> => {
        const res = await fetch(`${API_URL}/pending-categorizations/${id}/resolve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ action, category, gstApplicable })
        });
        if (!res.ok) throw new Error('Failed to resolve categorization');
    },

    // Merchant Memory
    fetchMerchantMemory: async (): Promise<MerchantMemory[]> => {
        const res = await fetch(`${API_URL}/merchant-memory`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch merchant memory');
        return res.json();
    },

    updateMerchantMemory: async (id: string, updates: Partial<MerchantMemory>): Promise<void> => {
        const res = await fetch(`${API_URL}/merchant-memory/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify(updates)
        });
        if (!res.ok) throw new Error('Failed to update merchant memory');
    },

    deleteMerchantMemory: async (id: string): Promise<void> => {
        const res = await fetch(`${API_URL}/merchant-memory/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed to delete merchant memory');
    },

    // Transfer Links
    fetchTransfers: async (): Promise<TransferLink[]> => {
        const res = await fetch(`${API_URL}/transfers`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch transfers');
        return res.json();
    },

    createTransferLink: async (sourceTransactionId: string, destinationTransactionId: string): Promise<{ id: string }> => {
        const res = await fetch(`${API_URL}/transfers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ sourceTransactionId, destinationTransactionId })
        });
        if (!res.ok) throw new Error('Failed to create transfer link');
        return res.json();
    },

    deleteTransferLink: async (id: string): Promise<void> => {
        const res = await fetch(`${API_URL}/transfers/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed to delete transfer link');
    },

    // Balance History
    fetchBalanceHistory: async (accountId: string): Promise<BalanceHistoryEntry[]> => {
        const res = await fetch(`${API_URL}/accounts/${accountId}/balance-history`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch balance history');
        return res.json();
    },

    // Reconciliation Alerts
    fetchReconciliationAlerts: async (showResolved = false): Promise<ReconciliationAlert[]> => {
        const res = await fetch(`${API_URL}/reconciliation-alerts?showResolved=${showResolved}`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch reconciliation alerts');
        return res.json();
    },

    resolveReconciliationAlert: async (id: string, notes?: string): Promise<void> => {
        const res = await fetch(`${API_URL}/reconciliation-alerts/${id}/resolve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ notes })
        });
        if (!res.ok) throw new Error('Failed to resolve alert');
    },

    // Credit Card Analytics
    fetchCreditCardAnalytics: async (accountId: string): Promise<CreditCardAnalytics> => {
        const res = await fetch(`${API_URL}/accounts/${accountId}/credit-analytics`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch credit card analytics');
        return res.json();
    },

    // Debt Reduction Recommendations
    fetchDebtRecommendations: async (monthlyBudget: number): Promise<DebtRecommendations> => {
        const res = await fetch(`${API_URL}/debt-recommendations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ monthlyBudget })
        });
        if (!res.ok) throw new Error('Failed to fetch debt recommendations');
        return res.json();
    }
};

// Account types
export interface Account {
    id: string;
    userId: string;
    accountNumber: string;
    accountNumberHash: string;
    accountName: string;
    accountType: string;
    bankName: string | null;
    currentBalance: number | null;
    interestRate: number | null;
    creditLimit: number | null;
    minimumPayment: number | null;
    paymentDueDay: number | null;
    linkedPaymentAccountId: string | null;
    isActive: boolean;
    ownershipTag?: 'personal' | 'business';
    createdAt: string;
    updatedAt: string;
}

export interface CreateAccountRequest {
    accountNumber: string;
    accountName: string;
    accountType: string;
    bankName?: string;
    interestRate?: number;
    creditLimit?: number;
    minimumPayment?: number;
    paymentDueDay?: number;
}

export interface PendingCategorization {
    id: string;
    userId: string;
    transactionId: string;
    suggestedCategory: string | null;
    suggestedConfidence: number | null;
    aiReasoning: string | null;
    status: string;
    transaction?: Transaction;
}

export interface MerchantMemory {
    id: string;
    userId: string;
    merchantPattern: string;
    merchantDisplayName: string | null;
    category: string;
    gstApplicable: boolean;
    timesUsed: number;
    lastUsed: string;
    isUserConfirmed: boolean;
}

export interface TransferLink {
    id: string;
    userId: string;
    sourceTransactionId: string;
    destinationTransactionId: string;
    sourceAccountId: string | null;
    destinationAccountId: string | null;
    amount: number;
    transferDate: string;
    confidence: number;
    isUserConfirmed: boolean;
    createdAt: string;
    sourceTransaction?: Transaction;
    destinationTransaction?: Transaction;
}

export interface BalanceHistoryEntry {
    id: string;
    accountId: string;
    balance: number;
    balanceDate: string;
    source: 'statement' | 'calculated' | 'manual';
    statementId: string | null;
    notes: string | null;
    createdAt: string;
}

export interface ReconciliationAlert {
    id: string;
    userId: string;
    accountId: string;
    alertType: 'balance_mismatch' | 'missing_transaction' | 'duplicate';
    expectedValue: number | null;
    actualValue: number | null;
    difference: number | null;
    description: string;
    statementId: string | null;
    isResolved: boolean;
    resolvedAt: string | null;
    resolutionNotes: string | null;
    createdAt: string;
}

export interface CreditCardAnalytics {
    accountId: string;
    accountName: string;
    creditLimit: number | null;
    currentBalance: number | null;
    interestRate: number | null;
    minimumPayment: number | null;
    totalInterestPaid: number;
    totalPayments: number;
    totalSpending: number;
    avgMonthlySpending: number;
    utilization: number | null;
    transactionCount: number;
    interestTransactionCount: number;
    recentInterestCharges: Array<{
        date: string;
        amount: number;
        description: string;
    }>;
}

export interface DebtStrategy {
    name: string;
    description: string;
    totalMonths: number;
    totalInterestPaid: number;
    monthlyPayment: number;
    payoffOrder: Array<{
        accountId: string;
        accountName: string;
        monthsToPayoff: number;
        interestPaid: number;
    }>;
    projections: Array<{
        month: number;
        totalDebt: number;
        interestPaid: number;
    }>;
}

export interface DebtRecommendations {
    message?: string;
    aggressive: DebtStrategy | null;
    moderate: DebtStrategy | null;
    minimum: DebtStrategy | null;
}

// BAS Types
export interface BASQuarter {
    id: string;
    year: number;
    quarter: 1 | 2 | 3 | 4;
    startDate: string;
    endDate: string;
    lodgementDueDate: string;
    status: 'pending' | 'draft' | 'lodged';
}

export interface BASCalculation {
    periodId: string;
    // Sales
    g1_total_sales: number;
    g2_export_sales: number;
    g3_gst_free_sales: number;
    g4_input_taxed_sales: number;
    g5_g2_to_g4: number;
    g6_total_taxable_sales: number;
    g7_adjustments: number;
    g8_total_sales_subject_gst: number;
    g9_gst_on_sales: number;
    // Purchases
    g10_capital_purchases: number;
    g11_non_capital_purchases: number;
    g12_g10_plus_g11: number;
    g13_purchases_no_gst_credit: number;
    g14_estimated_purchases: number;
    g15_total_purchases: number;
    g16_g12_minus_g15: number;
    g17_adjustments: number;
    g18_total_purchases_credit: number;
    g19_gst_credits: number;
    g20_net_gst: number;
    // PAYG
    w1_gross_wages: number;
    w2_amounts_withheld: number;
    payg_instalment_5a: number;
    // Other
    fuel_tax_credits_7c: number;
    wine_equalisation_7d: number;
    net_amount_payable: number;
    net_refund: number;
}

export interface TaxBracket {
    id: string;
    taxYear: string;
    entityType: string;
    minIncome: number;
    maxIncome: number | null;
    baseTax: number;
    marginalRate: number;
}

export interface Deduction {
    id: string;
    userId: string;
    taxYear: string;
    category: string;
    description: string;
    amountCents: number;
    method?: string;
    linkedTransactionId?: string;
    createdAt: string;
}

export interface CGTAsset {
    id: string;
    userId: string;
    assetName: string;
    assetType: string;
    acquisitionDate: string;
    acquisitionCostCents: number;
    incidentalCostsCents: number;
    improvementsCents: number;
    quantity: number;
    unitCostCents?: number;
    isDisposed: boolean;
    createdAt: string;
}

export interface CGTEvent {
    id: string;
    userId: string;
    assetId: string;
    disposalDate: string;
    disposalProceedsCents: number;
    disposalCostsCents: number;
    quantityDisposed: number;
    costBaseCents: number;
    capitalGainGrossCents: number;
    discountEligible: boolean;
    discountAmountCents: number;
    capitalGainNetCents: number;
    capitalLossCents: number;
    taxYear: string;
    createdAt: string;
}

export interface DepreciableAsset {
    id: string;
    userId: string;
    assetName: string;
    assetType: string;
    purchaseDate: string;
    purchaseCostCents: number;
    effectiveLifeYears: number;
    depreciationMethod: string;
    businessUsePercent: number;
    openingValueCents: number;
    currentValueCents: number;
    isActive: boolean;
    createdAt: string;
}

export interface TaxSummary {
    id: string;
    userId: string;
    taxYear: string;
    grossIncomeCents: number;
    totalDeductionsCents: number;
    taxableIncomeCents: number;
    netCapitalGainCents: number;
    carriedForwardLossesCents: number;
    taxPayableCents: number;
    taxWithheldCents: number;
    taxRefundCents: number;
    medicareLevy: number;
    medicareSurcharge: number;
    isFinalized: boolean;
}

export interface TaxCalculationResult {
    gross_income: number;
    taxable_income: number;
    income_tax: number;
    medicare_levy: number;
    medicare_surcharge: number;
    lito: number;
    total_tax: number;
    effective_rate: number;
    marginal_rate: number;
    brackets_breakdown: Array<{
        bracket: string;
        income_in_bracket: number;
        tax_for_bracket: number;
    }>;
}

export interface ConsolidatedReport {
    period: string;
    startDate: string;
    endDate: string;
    summary: {
        totalIncome: number;
        totalExpenses: number;
        netFlow: number;
        transactionCount: number;
        transferCount: number;
    };
    gst: {
        gstTransactionCount: number;
        totalGSTCollected: number;
        totalGSTPaid: number;
        estimatedGSTPayable: number;
    };
    categories: Array<{
        category: string;
        income: number;
        expenses: number;
        count: number;
        net: number;
    }>;
}

export interface SupportedBank {
    bankId: string;
    bankName: string;
    displayName: string;
}

// BAS API methods
export const basApi = {
    fetchQuarters: async (): Promise<BASQuarter[]> => {
        const res = await fetch(`${API_URL}/bas/quarters`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch quarters');
        return res.json();
    },

    calculateBAS: async (quarter: string, method: 'accrual' | 'cash' = 'accrual'): Promise<BASCalculation> => {
        const res = await fetch(`${API_URL}/bas/${quarter}/calculate?method=${method}`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed to calculate BAS');
        return res.json();
    },

    saveBAS: async (quarter: string, data: Partial<BASCalculation>): Promise<{ success: boolean }> => {
        const res = await fetch(`${API_URL}/bas/${quarter}/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Failed to save BAS');
        return res.json();
    },

    fetchHistory: async (): Promise<BASQuarter[]> => {
        const res = await fetch(`${API_URL}/bas/history`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch BAS history');
        return res.json();
    },

    fetchTaxCodes: async (): Promise<Array<{ code: string; description: string; rate: number }>> => {
        const res = await fetch(`${API_URL}/bas/tax-codes`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch tax codes');
        return res.json();
    },

    categorizeGST: async (updates: Array<{ transactionId: string; gstCategory: string; gstAmount: number }>): Promise<{ success: boolean; updated: number }> => {
        const res = await fetch(`${API_URL}/transactions/categorize-gst`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ updates })
        });
        if (!res.ok) throw new Error('Failed to categorize GST');
        return res.json();
    }
};

// Tax API methods
export const taxApi = {
    calculateTax: async (year: string, grossIncome: number, entityType: string = 'individual', hasPrivateHealth: boolean = false): Promise<TaxCalculationResult> => {
        const params = new URLSearchParams({
            grossIncome: grossIncome.toString(),
            entityType,
            hasPrivateHealth: hasPrivateHealth.toString()
        });
        const res = await fetch(`${API_URL}/tax/calculate/${year}?${params}`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed to calculate tax');
        return res.json();
    },

    fetchBrackets: async (year: string): Promise<TaxBracket[]> => {
        const res = await fetch(`${API_URL}/tax/brackets/${year}`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch tax brackets');
        return res.json();
    },

    fetchDeductions: async (year: string): Promise<Deduction[]> => {
        const res = await fetch(`${API_URL}/tax/deductions/${year}`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch deductions');
        return res.json();
    },

    addDeduction: async (data: Omit<Deduction, 'id' | 'userId' | 'createdAt'>): Promise<{ id: string; success: boolean }> => {
        const res = await fetch(`${API_URL}/tax/deductions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Failed to add deduction');
        return res.json();
    },

    fetchCGTAssets: async (): Promise<CGTAsset[]> => {
        const res = await fetch(`${API_URL}/tax/assets`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch CGT assets');
        return res.json();
    },

    addCGTAsset: async (data: Omit<CGTAsset, 'id' | 'userId' | 'isDisposed' | 'createdAt'>): Promise<{ id: string; success: boolean }> => {
        const res = await fetch(`${API_URL}/tax/assets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Failed to add CGT asset');
        return res.json();
    },

    fetchCGTEvents: async (taxYear?: string): Promise<CGTEvent[]> => {
        const url = taxYear ? `${API_URL}/tax/cgt?taxYear=${taxYear}` : `${API_URL}/tax/cgt`;
        const res = await fetch(url, {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch CGT events');
        return res.json();
    },

    recordDisposal: async (data: {
        assetId: string;
        acquisitionDate: string;
        acquisitionCostCents: number;
        disposalDate: string;
        disposalProceedsCents: number;
        disposalCostsCents?: number;
        quantityDisposed?: number;
        carriedForwardLossesCents?: number;
    }): Promise<CGTEvent> => {
        const res = await fetch(`${API_URL}/tax/cgt/disposal`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Failed to record disposal');
        return res.json();
    },

    fetchDepreciableAssets: async (): Promise<DepreciableAsset[]> => {
        const res = await fetch(`${API_URL}/tax/depreciation/assets`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch depreciable assets');
        return res.json();
    },

    addDepreciableAsset: async (data: Omit<DepreciableAsset, 'id' | 'userId' | 'currentValueCents' | 'isActive' | 'createdAt'>): Promise<{ id: string; success: boolean }> => {
        const res = await fetch(`${API_URL}/tax/depreciation/assets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Failed to add depreciable asset');
        return res.json();
    },

    calculateDepreciation: async (assetId: string): Promise<any> => {
        const res = await fetch(`${API_URL}/tax/depreciation/calculate/${assetId}`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed to calculate depreciation');
        return res.json();
    },

    fetchTaxSummary: async (year: string): Promise<TaxSummary> => {
        const res = await fetch(`${API_URL}/tax/summary/${year}`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch tax summary');
        return res.json();
    }
};

// Multi-bank API methods
export const multiBankApi = {
    fetchSupportedBanks: async (): Promise<SupportedBank[]> => {
        const res = await fetch(`${API_URL}/banks`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch supported banks');
        return res.json();
    },

    detectBank: async (pdfText: string): Promise<{
        detections: Array<{ bankId: string; bankName: string; confidence: number }>;
        bestMatch: { bankId: string; bankName: string; confidence: number } | null;
        confidence: 'high' | 'medium' | 'low' | 'none';
        recommendedAction: string;
    }> => {
        const res = await fetch(`${API_URL}/statements/detect-bank`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ pdfText })
        });
        if (!res.ok) throw new Error('Failed to detect bank');
        return res.json();
    },

    fetchConsolidatedSummary: async (): Promise<{
        accounts: Array<Account & { transactionCount: number; totalIncome: number; totalExpenses: number; netFlow: number }>;
        totals: { totalAccounts: number; totalTransactions: number; totalIncome: number; totalExpenses: number; netWorth: number };
    }> => {
        const res = await fetch(`${API_URL}/accounts/consolidated`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch consolidated summary');
        return res.json();
    },

    autoDetectTransfers: async (): Promise<{
        matchesFound: number;
        matches: Array<{
            sourceTransaction: Transaction;
            targetTransaction: Transaction;
            confidence: number;
            reasons: string[];
        }>;
    }> => {
        const res = await fetch(`${API_URL}/transfers/auto-detect`, {
            method: 'POST',
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed to auto-detect transfers');
        return res.json();
    },

    bulkLinkTransfers: async (pairs: Array<{ sourceTransactionId: string; destinationTransactionId: string; confidence?: number }>): Promise<{ success: boolean; created: number; linkIds: string[] }> => {
        const res = await fetch(`${API_URL}/transfers/bulk-link`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ pairs })
        });
        if (!res.ok) throw new Error('Failed to bulk link transfers');
        return res.json();
    },

    fetchConsolidatedReport: async (period: string): Promise<ConsolidatedReport> => {
        const res = await fetch(`${API_URL}/reports/consolidated/${period}`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch consolidated report');
        return res.json();
    }
};

// GST & BAS Enhanced API methods
export const gstApi = {
    fetchReviewQueue: async (): Promise<import('./features/gst/types').GSTReviewItem[]> => {
        const res = await fetch(`${API_URL}/gst/review-queue`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch GST review queue');
        return res.json();
    },

    approveClassification: async (id: number, gstCategory: string): Promise<void> => {
        const res = await fetch(`${API_URL}/gst/classify/${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ gstCategory })
        });
        if (!res.ok) throw new Error('Failed to approve GST classification');
    },

    bulkApprove: async (ids: number[]): Promise<void> => {
        const res = await fetch(`${API_URL}/gst/bulk-approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ ids })
        });
        if (!res.ok) throw new Error('Failed to bulk approve GST');
    },

    fetchSummary: async (period: string): Promise<import('./features/gst/types').GSTSummaryData> => {
        const res = await fetch(`${API_URL}/gst/summary?period=${encodeURIComponent(period)}`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch GST summary');
        return res.json();
    },

    fetchBASCalculation: async (quarter: string, method?: string): Promise<import('./features/gst/types').BASCalculationEnhanced> => {
        const params = new URLSearchParams({ quarter });
        if (method) params.set('method', method);
        const res = await fetch(`${API_URL}/bas/calculate?${params}`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch BAS calculation');
        return res.json();
    },

    saveBASdraft: async (quarter: string, data: import('./features/gst/types').BASCalculationEnhanced): Promise<void> => {
        const res = await fetch(`${API_URL}/bas/${quarter}/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Failed to save BAS draft');
    },

    updateBASStatus: async (quarter: string, status: string): Promise<void> => {
        const res = await fetch(`${API_URL}/bas/${quarter}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ status })
        });
        if (!res.ok) throw new Error('Failed to update BAS status');
    },

    fetchBASComparison: async (q1: string, q2: string): Promise<import('./features/gst/types').BASComparisonData> => {
        const res = await fetch(`${API_URL}/bas/compare?q1=${encodeURIComponent(q1)}&q2=${encodeURIComponent(q2)}`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch BAS comparison');
        return res.json();
    },

    fetchBASDrillDown: async (quarter: string, label: string): Promise<any[]> => {
        const res = await fetch(`${API_URL}/bas/${quarter}/drill-down/${label}`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch BAS drill-down');
        return res.json();
    },

    fetchInputTaxCredits: async (period: string): Promise<import('./features/gst/types').InputTaxCredit[]> => {
        const res = await fetch(`${API_URL}/gst/input-tax-credits?period=${encodeURIComponent(period)}`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch input tax credits');
        return res.json();
    },
};

// Analytics & Cross-Account API methods
export const analyticsApi = {
    // Transfer matching endpoints
    fetchTransferMatches: async (): Promise<import('./features/transfers/types').TransferMatch[]> => {
        const res = await fetch(`${API_URL}/transfers/matches`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch transfer matches');
        return res.json();
    },

    confirmTransfer: async (id: string): Promise<void> => {
        const res = await fetch(`${API_URL}/transfers/matches/${id}/confirm`, {
            method: 'POST',
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed to confirm transfer');
    },

    rejectTransfer: async (id: string): Promise<void> => {
        const res = await fetch(`${API_URL}/transfers/matches/${id}/reject`, {
            method: 'POST',
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed to reject transfer');
    },

    fetchMoneyFlow: async (period: string): Promise<import('./features/transfers/types').MoneyFlow[]> => {
        const res = await fetch(`${API_URL}/transfers/flow/${encodeURIComponent(period)}`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch money flow');
        return res.json();
    },

    fetchNetPosition: async (accountAId: number, accountBId: number, dateRange?: { start: string; end: string }): Promise<import('./features/transfers/types').NetPosition> => {
        const params = new URLSearchParams({
            accountA: accountAId.toString(),
            accountB: accountBId.toString(),
        });
        if (dateRange) {
            params.set('start', dateRange.start);
            params.set('end', dateRange.end);
        }
        const res = await fetch(`${API_URL}/transfers/net-position?${params}`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch net position');
        return res.json();
    },

    // Analytics endpoints
    fetchCategoryBreakdown: async (period: string): Promise<import('./features/analytics/types').CategoryBreakdownItem[]> => {
        const res = await fetch(`${API_URL}/analytics/category-breakdown?period=${encodeURIComponent(period)}`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch category breakdown');
        return res.json();
    },

    fetchRecurringPayments: async (): Promise<import('./features/analytics/types').RecurringPayment[]> => {
        const res = await fetch(`${API_URL}/analytics/recurring-payments`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch recurring payments');
        return res.json();
    },

    fetchSpendingTrends: async (months: number): Promise<import('./features/analytics/types').SpendingTrend[]> => {
        const res = await fetch(`${API_URL}/analytics/spending-trends?months=${months}`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch spending trends');
        return res.json();
    },

    fetchBudgets: async (period: string): Promise<import('./features/analytics/types').Budget[]> => {
        const res = await fetch(`${API_URL}/analytics/budgets?period=${encodeURIComponent(period)}`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch budgets');
        return res.json();
    },

    saveBudget: async (budget: Partial<import('./features/analytics/types').Budget>): Promise<void> => {
        const res = await fetch(`${API_URL}/analytics/budgets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify(budget)
        });
        if (!res.ok) throw new Error('Failed to save budget');
    },

    fetchBudgetVsActual: async (period: string): Promise<import('./features/analytics/types').Budget[]> => {
        const res = await fetch(`${API_URL}/analytics/budget-vs-actual?period=${encodeURIComponent(period)}`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch budget vs actual');
        return res.json();
    },

    fetchAnomalies: async (): Promise<import('./features/analytics/types').Anomaly[]> => {
        const res = await fetch(`${API_URL}/analytics/anomalies`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch anomalies');
        return res.json();
    },

    dismissAnomaly: async (id: string, reason?: string): Promise<void> => {
        const res = await fetch(`${API_URL}/analytics/anomalies/${id}/dismiss`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ reason })
        });
        if (!res.ok) throw new Error('Failed to dismiss anomaly');
    },

    fetchCashFlowForecast: async (months: number): Promise<import('./features/analytics/types').CashFlowForecast[]> => {
        const res = await fetch(`${API_URL}/analytics/cash-flow-forecast?months=${months}`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch cash flow forecast');
        return res.json();
    },
};
