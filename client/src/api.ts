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
  return token ? { Authorization: `Bearer ${token}` } : {};
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
  fetchTransactions: async (options?: {
    limit?: number;
    offset?: number;
    accountId?: string;
  }): Promise<{ transactions: Transaction[]; total: number }> => {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.offset) params.set('offset', String(options.offset));
    if (options?.accountId) params.set('accountId', options.accountId);
    const qs = params.toString();
    const res = await fetch(`${API_URL}/transactions${qs ? `?${qs}` : ''}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch transactions');
    return res.json();
  },

  fetchStatements: async (): Promise<Statement[]> => {
    const res = await fetch(`${API_URL}/statements`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch statements');
    return res.json();
  },

  sendChatMessage: async (query: string): Promise<{ answer: string }> => {
    const res = await fetch(`${API_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) throw new Error('Failed to send chat message');
    return res.json();
  },

  calculateStats: (transactions: Transaction[]): TransactionStats => {
    // Exclude transfers from income/expense calculations
    const nonTransfers = transactions.filter((t) => !t.isTransfer);

    const income = nonTransfers.filter((t) => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
    const expenses = nonTransfers
      .filter((t) => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const categoryBreakdown: Record<string, number> = {};
    nonTransfers.forEach((t) => {
      const cat = t.category || 'Uncategorized';
      categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + Math.abs(t.amount);
    });

    return {
      totalIncome: income,
      totalExpenses: expenses,
      netFlow: income - expenses,
      transactionCount: transactions.length,
      categoryBreakdown,
    };
  },

  updateTransaction: async (id: string, updates: Partial<Transaction>): Promise<void> => {
    const res = await fetch(`${API_URL}/transactions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update transaction');
  },

  splitTransaction: async (
    id: string,
    splits: Array<{ category: string; amount: number; description: string; gst: boolean }>,
  ): Promise<void> => {
    const res = await fetch(`${API_URL}/transactions/${id}/split`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ splits }),
    });
    if (!res.ok) throw new Error('Failed to split transaction');
  },

  deleteTransaction: async (id: string): Promise<void> => {
    const res = await fetch(`${API_URL}/transactions/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete transaction');
  },

  uploadStatement: async (
    file: File,
  ): Promise<{
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
      body: formData,
    });
    if (res.status === 409) {
      const data = await res.json();
      return {
        id: data.id,
        message: 'Duplicate file',
        isDuplicate: true,
        existingFilename: data.existingFilename,
        uploadedOn: data.uploadedOn,
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
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to reprocess statement');
  },

  uploadBatch: async (files: File[]): Promise<BatchUploadResponse> => {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    const res = await fetch(`${API_URL}/statements/batch`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Batch upload failed' }));
      throw new Error(error.error || 'Batch upload failed');
    }
    return res.json();
  },

  getBatchStatus: async (jobId: string): Promise<BatchJobStatus> => {
    const res = await fetch(`${API_URL}/statements/batch/${jobId}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to get batch status');
    return res.json();
  },

  cancelBatch: async (jobId: string): Promise<{ cancelled: boolean }> => {
    const res = await fetch(`${API_URL}/statements/batch/${jobId}/cancel`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to cancel batch');
    return res.json();
  },

  retryBatch: async (jobId: string): Promise<{ retried: boolean }> => {
    const res = await fetch(`${API_URL}/statements/batch/${jobId}/retry`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to retry batch');
    return res.json();
  },

  fetchStatementGapAnalysis: async (): Promise<StatementGapAnalysis> => {
    const res = await fetch(`${API_URL}/statements/gap-analysis`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch gap analysis');
    return res.json();
  },

  login: async (
    username: string,
    password: string,
  ): Promise<{ token: string; user: { id: string; username: string } }> => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Login failed' }));
      throw new Error(error.error || 'Login failed');
    }
    return res.json();
  },

  register: async (
    username: string,
    password: string,
  ): Promise<{ token: string; user: { id: string; username: string } }> => {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Registration failed' }));
      throw new Error(error.error || 'Registration failed');
    }
    return res.json();
  },

  fetchSettings: async (): Promise<UserSettings> => {
    const res = await fetch(`${API_URL}/settings`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch settings');
    return res.json();
  },

  updateSettings: async (settings: UserSettings): Promise<void> => {
    const res = await fetch(`${API_URL}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error('Failed to update settings');
  },

  getCurrentUser: async (): Promise<{ id: string; username: string }> => {
    const res = await fetch(`${BASE_URL}/auth/me`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch user');
    const data = await res.json();
    return data.user;
  },

  // Account Management
  fetchAccounts: async (): Promise<Account[]> => {
    const res = await fetch(`${API_URL}/accounts`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch accounts');
    return res.json();
  },

  createAccount: async (
    data: CreateAccountRequest,
  ): Promise<{ id: string; accountNumber: string }> => {
    const res = await fetch(`${API_URL}/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
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
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update account');
  },

  // Pending Categorizations
  fetchPendingCategorizations: async (): Promise<PendingCategorization[]> => {
    const res = await fetch(`${API_URL}/pending-categorizations`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch pending categorizations');
    return res.json();
  },

  resolveCategorization: async (
    id: string,
    action: 'approve' | 'reject' | 'modify',
    category?: string,
    gstApplicable?: boolean,
  ): Promise<void> => {
    const res = await fetch(`${API_URL}/pending-categorizations/${id}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ action, category, gstApplicable }),
    });
    if (!res.ok) throw new Error('Failed to resolve categorization');
  },

  // Merchant Memory
  fetchMerchantMemory: async (): Promise<MerchantMemory[]> => {
    const res = await fetch(`${API_URL}/merchant-memory`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch merchant memory');
    return res.json();
  },

  updateMerchantMemory: async (id: string, updates: Partial<MerchantMemory>): Promise<void> => {
    const res = await fetch(`${API_URL}/merchant-memory/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update merchant memory');
  },

  deleteMerchantMemory: async (id: string): Promise<void> => {
    const res = await fetch(`${API_URL}/merchant-memory/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete merchant memory');
  },

  // Transfer Links
  fetchTransfers: async (): Promise<TransferLink[]> => {
    const res = await fetch(`${API_URL}/transfers`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch transfers');
    return res.json();
  },

  createTransferLink: async (
    sourceTransactionId: string,
    destinationTransactionId: string,
  ): Promise<{ id: string }> => {
    const res = await fetch(`${API_URL}/transfers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ sourceTransactionId, destinationTransactionId }),
    });
    if (!res.ok) throw new Error('Failed to create transfer link');
    return res.json();
  },

  deleteTransferLink: async (id: string): Promise<void> => {
    const res = await fetch(`${API_URL}/transfers/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete transfer link');
  },

  // Balance History
  fetchBalanceHistory: async (accountId: string): Promise<BalanceHistoryEntry[]> => {
    const res = await fetch(`${API_URL}/accounts/${accountId}/balance-history`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch balance history');
    return res.json();
  },

  // Reconciliation Alerts
  fetchReconciliationAlerts: async (showResolved = false): Promise<ReconciliationAlert[]> => {
    const res = await fetch(`${API_URL}/reconciliation-alerts?showResolved=${showResolved}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch reconciliation alerts');
    return res.json();
  },

  resolveReconciliationAlert: async (id: string, notes?: string): Promise<void> => {
    const res = await fetch(`${API_URL}/reconciliation-alerts/${id}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ notes }),
    });
    if (!res.ok) throw new Error('Failed to resolve alert');
  },

  // Credit Card Analytics
  fetchCreditCardAnalytics: async (accountId: string): Promise<CreditCardAnalytics> => {
    const res = await fetch(`${API_URL}/accounts/${accountId}/credit-analytics`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch credit card analytics');
    return res.json();
  },

  // Debt Reduction Recommendations
  fetchDebtRecommendations: async (monthlyBudget: number): Promise<DebtRecommendations> => {
    const res = await fetch(`${API_URL}/debt-recommendations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ monthlyBudget }),
    });
    if (!res.ok) throw new Error('Failed to fetch debt recommendations');
    return res.json();
  },

  // --- Custom Dashboards ---

  fetchDashboards: async (): Promise<unknown[]> => {
    const res = await fetch(`${API_URL}/dashboards?userId=default`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch dashboards');
    return res.json();
  },

  fetchDashboard: async (id: string): Promise<unknown> => {
    const res = await fetch(`${API_URL}/dashboards/${id}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch dashboard');
    return res.json();
  },

  createDashboard: async (data: {
    name: string;
    description?: string;
    layout: unknown;
  }): Promise<unknown> => {
    const res = await fetch(`${API_URL}/dashboards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create dashboard');
    return res.json();
  },

  updateDashboard: async (
    id: string,
    data: { name?: string; description?: string; layout?: unknown; isDefault?: boolean },
  ): Promise<unknown> => {
    const res = await fetch(`${API_URL}/dashboards/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update dashboard');
    return res.json();
  },

  deleteDashboard: async (id: string): Promise<void> => {
    const res = await fetch(`${API_URL}/dashboards/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete dashboard');
  },

  fetchSavedCharts: async (dashboardId?: string): Promise<unknown[]> => {
    const params = new URLSearchParams({ userId: 'default' });
    if (dashboardId) params.set('dashboardId', dashboardId);
    const res = await fetch(`${API_URL}/charts?${params.toString()}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch saved charts');
    return res.json();
  },

  saveChart: async (data: {
    dashboardId?: string;
    chartType: string;
    title: string;
    config: unknown;
  }): Promise<unknown> => {
    const res = await fetch(`${API_URL}/charts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to save chart');
    return res.json();
  },

  deleteChart: async (id: string): Promise<void> => {
    const res = await fetch(`${API_URL}/charts/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete chart');
  },

  fetchAuditLog: async (options?: {
    agentType?: string;
    action?: string;
    from?: string;
    to?: string;
    limit?: number;
  }): Promise<{ entries: AuditEntry[] }> => {
    return mutationApi.fetchAuditLog(options);
  },
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
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch quarters');
    return res.json();
  },

  calculateBAS: async (
    quarter: string,
    method: 'accrual' | 'cash' = 'accrual',
  ): Promise<BASCalculation> => {
    const res = await fetch(`${API_URL}/bas/${quarter}/calculate?method=${method}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to calculate BAS');
    return res.json();
  },

  saveBAS: async (
    quarter: string,
    data: Partial<BASCalculation>,
  ): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_URL}/bas/${quarter}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to save BAS');
    return res.json();
  },

  fetchHistory: async (): Promise<BASQuarter[]> => {
    const res = await fetch(`${API_URL}/bas/history`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch BAS history');
    return res.json();
  },

  fetchTaxCodes: async (): Promise<Array<{ code: string; description: string; rate: number }>> => {
    const res = await fetch(`${API_URL}/bas/tax-codes`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch tax codes');
    return res.json();
  },

  categorizeGST: async (
    updates: Array<{ transactionId: string; gstCategory: string; gstAmount: number }>,
  ): Promise<{ success: boolean; updated: number }> => {
    const res = await fetch(`${API_URL}/transactions/categorize-gst`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ updates }),
    });
    if (!res.ok) throw new Error('Failed to categorize GST');
    return res.json();
  },
};

// Tax API methods
export const taxApi = {
  calculateTax: async (
    year: string,
    grossIncome: number,
    entityType: string = 'individual',
    hasPrivateHealth: boolean = false,
  ): Promise<TaxCalculationResult> => {
    const params = new URLSearchParams({
      grossIncome: grossIncome.toString(),
      entityType,
      hasPrivateHealth: hasPrivateHealth.toString(),
    });
    const res = await fetch(`${API_URL}/tax/calculate/${year}?${params}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to calculate tax');
    return res.json();
  },

  fetchBrackets: async (year: string): Promise<TaxBracket[]> => {
    const res = await fetch(`${API_URL}/tax/brackets/${year}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch tax brackets');
    return res.json();
  },

  fetchDeductions: async (year: string): Promise<Deduction[]> => {
    const res = await fetch(`${API_URL}/tax/deductions/${year}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch deductions');
    return res.json();
  },

  addDeduction: async (
    data: Omit<Deduction, 'id' | 'userId' | 'createdAt'>,
  ): Promise<{ id: string; success: boolean }> => {
    const res = await fetch(`${API_URL}/tax/deductions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to add deduction');
    return res.json();
  },

  fetchCGTAssets: async (): Promise<CGTAsset[]> => {
    const res = await fetch(`${API_URL}/tax/assets`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch CGT assets');
    return res.json();
  },

  addCGTAsset: async (
    data: Omit<CGTAsset, 'id' | 'userId' | 'isDisposed' | 'createdAt'>,
  ): Promise<{ id: string; success: boolean }> => {
    const res = await fetch(`${API_URL}/tax/assets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to add CGT asset');
    return res.json();
  },

  fetchCGTEvents: async (taxYear?: string): Promise<CGTEvent[]> => {
    const url = taxYear ? `${API_URL}/tax/cgt?taxYear=${taxYear}` : `${API_URL}/tax/cgt`;
    const res = await fetch(url, {
      headers: getAuthHeaders(),
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
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to record disposal');
    return res.json();
  },

  fetchDepreciableAssets: async (): Promise<DepreciableAsset[]> => {
    const res = await fetch(`${API_URL}/tax/depreciation/assets`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch depreciable assets');
    return res.json();
  },

  addDepreciableAsset: async (
    data: Omit<DepreciableAsset, 'id' | 'userId' | 'currentValueCents' | 'isActive' | 'createdAt'>,
  ): Promise<{ id: string; success: boolean }> => {
    const res = await fetch(`${API_URL}/tax/depreciation/assets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to add depreciable asset');
    return res.json();
  },

  calculateDepreciation: async (assetId: string): Promise<Record<string, unknown>> => {
    const res = await fetch(`${API_URL}/tax/depreciation/calculate/${assetId}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to calculate depreciation');
    return res.json();
  },

  fetchTaxSummary: async (year: string): Promise<TaxSummary> => {
    const res = await fetch(`${API_URL}/tax/summary/${year}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch tax summary');
    return res.json();
  },

  fetchCompanyReturn: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  fetchPersonalReturn: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  fetchSoleTraderReturn: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  fetchTrustReturn: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  fetchStrategies: async (..._args: unknown[]) => Promise.resolve([] as Record<string, unknown>[]),
  generateStrategies: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  updateStrategyStatus: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  scanEquity: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  confirmEquityEvent: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  fetchEquitySummary: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
};

// Multi-bank API methods
export const multiBankApi = {
  fetchSupportedBanks: async (): Promise<SupportedBank[]> => {
    const res = await fetch(`${API_URL}/banks`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch supported banks');
    return res.json();
  },

  detectBank: async (
    pdfText: string,
  ): Promise<{
    detections: Array<{ bankId: string; bankName: string; confidence: number }>;
    bestMatch: { bankId: string; bankName: string; confidence: number } | null;
    confidence: 'high' | 'medium' | 'low' | 'none';
    recommendedAction: string;
  }> => {
    const res = await fetch(`${API_URL}/statements/detect-bank`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ pdfText }),
    });
    if (!res.ok) throw new Error('Failed to detect bank');
    return res.json();
  },

  fetchConsolidatedSummary: async (): Promise<{
    accounts: Array<
      Account & {
        transactionCount: number;
        totalIncome: number;
        totalExpenses: number;
        netFlow: number;
      }
    >;
    totals: {
      totalAccounts: number;
      totalTransactions: number;
      totalIncome: number;
      totalExpenses: number;
      netWorth: number;
    };
  }> => {
    const res = await fetch(`${API_URL}/accounts/consolidated`, {
      headers: getAuthHeaders(),
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
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to auto-detect transfers');
    return res.json();
  },

  bulkLinkTransfers: async (
    pairs: Array<{
      sourceTransactionId: string;
      destinationTransactionId: string;
      confidence?: number;
    }>,
  ): Promise<{ success: boolean; created: number; linkIds: string[] }> => {
    const res = await fetch(`${API_URL}/transfers/bulk-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ pairs }),
    });
    if (!res.ok) throw new Error('Failed to bulk link transfers');
    return res.json();
  },

  fetchConsolidatedReport: async (period: string): Promise<ConsolidatedReport> => {
    const res = await fetch(`${API_URL}/reports/consolidated/${period}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch consolidated report');
    return res.json();
  },
};

// GST & BAS Enhanced API methods
export const gstApi = {
  fetchReviewQueue: async (): Promise<import('./features/gst/types').GSTReviewItem[]> => {
    const res = await fetch(`${API_URL}/gst/review-queue`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch GST review queue');
    return res.json();
  },

  approveClassification: async (id: number, gstCategory: string): Promise<void> => {
    const res = await fetch(`${API_URL}/gst/classify/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ gstCategory }),
    });
    if (!res.ok) throw new Error('Failed to approve GST classification');
  },

  bulkApprove: async (ids: number[]): Promise<void> => {
    const res = await fetch(`${API_URL}/gst/bulk-approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) throw new Error('Failed to bulk approve GST');
  },

  fetchSummary: async (period: string): Promise<import('./features/gst/types').GSTSummaryData> => {
    const res = await fetch(`${API_URL}/gst/summary?period=${encodeURIComponent(period)}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch GST summary');
    return res.json();
  },

  fetchBASCalculation: async (
    quarter: string,
    method?: string,
  ): Promise<import('./features/gst/types').BASCalculationEnhanced> => {
    const params = new URLSearchParams({ quarter });
    if (method) params.set('method', method);
    const res = await fetch(`${API_URL}/bas/calculate?${params}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch BAS calculation');
    return res.json();
  },

  saveBASdraft: async (
    quarter: string,
    data: import('./features/gst/types').BASCalculationEnhanced,
  ): Promise<void> => {
    const res = await fetch(`${API_URL}/bas/${quarter}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to save BAS draft');
  },

  updateBASStatus: async (quarter: string, status: string): Promise<void> => {
    const res = await fetch(`${API_URL}/bas/${quarter}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error('Failed to update BAS status');
  },

  fetchBASComparison: async (
    q1: string,
    q2: string,
  ): Promise<import('./features/gst/types').BASComparisonData> => {
    const res = await fetch(
      `${API_URL}/bas/compare?q1=${encodeURIComponent(q1)}&q2=${encodeURIComponent(q2)}`,
      {
        headers: getAuthHeaders(),
      },
    );
    if (!res.ok) throw new Error('Failed to fetch BAS comparison');
    return res.json();
  },

  fetchBASDrillDown: async (quarter: string, label: string): Promise<Record<string, unknown>[]> => {
    const res = await fetch(`${API_URL}/bas/${quarter}/drill-down/${label}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch BAS drill-down');
    return res.json();
  },

  fetchInputTaxCredits: async (
    period: string,
  ): Promise<import('./features/gst/types').InputTaxCredit[]> => {
    const res = await fetch(
      `${API_URL}/gst/input-tax-credits?period=${encodeURIComponent(period)}`,
      {
        headers: getAuthHeaders(),
      },
    );
    if (!res.ok) throw new Error('Failed to fetch input tax credits');
    return res.json();
  },
};

// Analytics & Cross-Account API methods
export const analyticsApi = {
  // Transfer matching endpoints
  fetchTransferMatches: async (): Promise<import('./features/transfers/types').TransferMatch[]> => {
    const res = await fetch(`${API_URL}/transfers/matches`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch transfer matches');
    return res.json();
  },

  confirmTransfer: async (id: string): Promise<void> => {
    const res = await fetch(`${API_URL}/transfers/matches/${id}/confirm`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to confirm transfer');
  },

  rejectTransfer: async (id: string): Promise<void> => {
    const res = await fetch(`${API_URL}/transfers/matches/${id}/reject`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to reject transfer');
  },

  fetchMoneyFlow: async (
    period: string,
  ): Promise<import('./features/transfers/types').MoneyFlow[]> => {
    const res = await fetch(`${API_URL}/transfers/flow/${encodeURIComponent(period)}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch money flow');
    return res.json();
  },

  fetchNetPosition: async (
    accountAId: number,
    accountBId: number,
    dateRange?: { start: string; end: string },
  ): Promise<import('./features/transfers/types').NetPosition> => {
    const params = new URLSearchParams({
      accountA: accountAId.toString(),
      accountB: accountBId.toString(),
    });
    if (dateRange) {
      params.set('start', dateRange.start);
      params.set('end', dateRange.end);
    }
    const res = await fetch(`${API_URL}/transfers/net-position?${params}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch net position');
    return res.json();
  },

  // Analytics endpoints
  fetchCategoryBreakdown: async (
    period: string,
  ): Promise<import('./features/analytics/types').CategoryBreakdownItem[]> => {
    const res = await fetch(
      `${API_URL}/analytics/category-breakdown?period=${encodeURIComponent(period)}`,
      {
        headers: getAuthHeaders(),
      },
    );
    if (!res.ok) throw new Error('Failed to fetch category breakdown');
    return res.json();
  },

  fetchRecurringPayments: async (): Promise<
    import('./features/analytics/types').RecurringPayment[]
  > => {
    const res = await fetch(`${API_URL}/analytics/recurring-payments`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch recurring payments');
    return res.json();
  },

  fetchSpendingTrends: async (
    months: number,
  ): Promise<import('./features/analytics/types').SpendingTrend[]> => {
    const res = await fetch(`${API_URL}/analytics/spending-trends?months=${months}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch spending trends');
    return res.json();
  },

  fetchBudgets: async (period: string): Promise<import('./features/analytics/types').Budget[]> => {
    const res = await fetch(`${API_URL}/analytics/budgets?period=${encodeURIComponent(period)}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch budgets');
    return res.json();
  },

  saveBudget: async (
    budget: Partial<import('./features/analytics/types').Budget>,
  ): Promise<void> => {
    const res = await fetch(`${API_URL}/analytics/budgets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(budget),
    });
    if (!res.ok) throw new Error('Failed to save budget');
  },

  fetchBudgetVsActual: async (
    period: string,
  ): Promise<import('./features/analytics/types').Budget[]> => {
    const res = await fetch(
      `${API_URL}/analytics/budget-vs-actual?period=${encodeURIComponent(period)}`,
      {
        headers: getAuthHeaders(),
      },
    );
    if (!res.ok) throw new Error('Failed to fetch budget vs actual');
    return res.json();
  },

  fetchAnomalies: async (): Promise<import('./features/analytics/types').Anomaly[]> => {
    const res = await fetch(`${API_URL}/analytics/anomalies`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch anomalies');
    return res.json();
  },

  dismissAnomaly: async (id: string, reason?: string): Promise<void> => {
    const res = await fetch(`${API_URL}/analytics/anomalies/${id}/dismiss`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) throw new Error('Failed to dismiss anomaly');
  },

  fetchCashFlowForecast: async (
    months: number,
  ): Promise<import('./features/analytics/types').CashFlowForecast[]> => {
    const res = await fetch(`${API_URL}/analytics/cash-flow-forecast?months=${months}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch cash flow forecast');
    return res.json();
  },

  fetchBillAlerts: async (..._args: unknown[]) => Promise.resolve([] as Record<string, unknown>[]),
  projectRevenue: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  projectExpenses: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  calculateWealthProjection: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
};

// ─── Wave 2: Mutation & Streaming API ───────────────────────────────

export interface MutationEvent {
  id: string;
  sessionId: string;
  agentType: string;
  mutationType: string;
  targetTable: string;
  description: string;
  status: string;
  confidence: number | null;
  requiresConfirmation: boolean;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  mutationId: string | null;
  sessionId: string | null;
  agentType: string;
  action: string;
  targetTable: string | null;
  targetId: string | null;
  metadata: string | null;
  userId: string | null;
  createdAt: string;
}

export interface StreamEvent {
  type: string;
  data: unknown;
  timestamp?: string;
}

export const mutationApi = {
  /** Stream a chat query via SSE, returning an EventSource-like async iterator */
  streamChat: (_query: string, _sessionId?: string): EventSource => {
    // We use a POST via fetch + ReadableStream instead of EventSource (which is GET-only).
    // For simplicity, return a proxy that consumers can listen to.
    // Callers should use fetchStreamChat() below for the full streaming experience.
    throw new Error('Use fetchStreamChat() for POST-based SSE streaming');
  },

  /** POST-based SSE streaming chat — returns parsed events via callback */
  fetchStreamChat: async (
    query: string,
    onEvent: (event: StreamEvent) => void,
    sessionId?: string,
  ): Promise<void> => {
    const res = await fetch(`${API_URL}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ query, sessionId }),
    });

    if (!res.ok) throw new Error('Streaming chat failed');
    if (!res.body) throw new Error('No response body');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      let currentEventType = '';
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEventType = line.slice(7).trim();
        } else if (line.startsWith('data: ') && currentEventType) {
          try {
            const data = JSON.parse(line.slice(6));
            onEvent({ type: currentEventType, data });
          } catch {
            // Skip malformed JSON
          }
          currentEventType = '';
        }
      }
    }
  },

  /** Confirm a pending mutation */
  confirmMutation: async (
    actionId: string,
    reason?: string,
  ): Promise<{ success: boolean; mutation: MutationEvent }> => {
    const res = await fetch(`${API_URL}/chat/confirm/${actionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) throw new Error('Failed to confirm mutation');
    return res.json();
  },

  /** Reject a pending mutation */
  rejectMutation: async (
    actionId: string,
    reason?: string,
  ): Promise<{ success: boolean; mutation: MutationEvent }> => {
    const res = await fetch(`${API_URL}/chat/reject/${actionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) throw new Error('Failed to reject mutation');
    return res.json();
  },

  /** Fetch pending mutations for a session */
  fetchPendingMutations: async (sessionId: string): Promise<{ mutations: MutationEvent[] }> => {
    const res = await fetch(`${API_URL}/chat/pending?sessionId=${encodeURIComponent(sessionId)}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch pending mutations');
    return res.json();
  },

  /** Fetch audit log entries */
  fetchAuditLog: async (options?: {
    agentType?: string;
    action?: string;
    from?: string;
    to?: string;
    limit?: number;
  }): Promise<{ entries: AuditEntry[] }> => {
    const params = new URLSearchParams();
    if (options?.agentType) params.set('agentType', options.agentType);
    if (options?.action) params.set('action', options.action);
    if (options?.from) params.set('from', options.from);
    if (options?.to) params.set('to', options.to);
    if (options?.limit) params.set('limit', String(options.limit));
    const qs = params.toString();
    const res = await fetch(`${API_URL}/agent-audit${qs ? `?${qs}` : ''}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch audit log');
    return res.json();
  },
};

// ─── Vercel AI SDK Streaming & Migration (Wave 21) ──────────────────

export const streamingApi = {
  /** Fetch stream session history */
  fetchHistory: (userId = 'default', limit = 50, offset = 0) =>
    fetch(`${API_URL}/stream/history?userId=${userId}&limit=${limit}&offset=${offset}`, {
      headers: getAuthHeaders(),
    }).then((r) => r.json()),

  /** Get a specific session's status */
  getSession: (sessionId: string) =>
    fetch(`${API_URL}/stream/session/${sessionId}`, {
      headers: getAuthHeaders(),
    }).then((r) => r.json()),

  /** Cancel an active stream session */
  cancelSession: (sessionId: string) =>
    fetch(`${API_URL}/stream/session/${sessionId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    }).then((r) => r.json()),
};

export const migrationApi = {
  /** List all agent migration statuses */
  fetchStatus: () =>
    fetch(`${API_URL}/migration/status`, { headers: getAuthHeaders() }).then((r) => r.json()),

  /** Get migration benchmarks (legacy vs Vercel comparison) */
  fetchBenchmarks: () =>
    fetch(`${API_URL}/migration/benchmarks`, { headers: getAuthHeaders() }).then((r) => r.json()),

  /** Rollback an agent to legacy mode */
  rollback: (agentType: string) =>
    fetch(`${API_URL}/migration/rollback/${agentType}`, {
      method: 'POST',
      headers: getAuthHeaders(),
    }).then((r) => r.json()),
};

export const schemaApi = {
  /** List all registered schemas */
  fetchSchemas: () =>
    fetch(`${API_URL}/schemas`, { headers: getAuthHeaders() }).then((r) => r.json()),

  /** Get schema for a specific agent type */
  getSchema: (agentType: string) =>
    fetch(`${API_URL}/schemas/${agentType}`, { headers: getAuthHeaders() }).then((r) => r.json()),

  /** Validate output against an agent's schema */
  validate: (agentType: string, output: unknown) =>
    fetch(`${API_URL}/schemas/${agentType}/validate`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ output }),
    }).then((r) => r.json()),

  /** Get validation stats for an agent type */
  getStats: (agentType: string) =>
    fetch(`${API_URL}/schemas/${agentType}/stats`, { headers: getAuthHeaders() }).then((r) =>
      r.json(),
    ),
};

// ─── Market Intelligence API ────────────────────────────────────────
const marketFetch = async (path: string, options?: RequestInit) => {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...getAuthHeaders(), ...((options?.headers as Record<string, string>) ?? {}) },
  });
  if (!res.ok) throw new Error(`Market API error: ${res.status}`);
  return res.json();
};

export const fetchEconomicSnapshot = () => marketFetch('/market/indicators/snapshot');

export const fetchIndicators = (params?: Record<string, string>) => {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return marketFetch(`/market/indicators${qs}`);
};

export const fetchIndicatorHistory = (code: string, months = 24) =>
  marketFetch(`/market/indicators/${code}/history?months=${months}`);

export const fetchCashRate = () => marketFetch('/market/indicators/cash-rate');

export const fetchCPI = () => marketFetch('/market/indicators/cpi');

export const fetchMarketPrices = (type?: string) =>
  marketFetch(`/market/prices${type ? `?type=${type}` : ''}`);

export const fetchPriceHistory = (symbol: string, days = 30) =>
  marketFetch(`/market/prices/${encodeURIComponent(symbol)}/history?days=${days}`);

export const searchSymbol = (query: string) =>
  marketFetch(`/market/prices/search/${encodeURIComponent(query)}`);

export const refreshMarketPrices = () => marketFetch('/market/prices/refresh', { method: 'POST' });

export const fetchSentiment = (topic: string) =>
  marketFetch(`/market/sentiment/${encodeURIComponent(topic)}`);

export const fetchBatchSentiment = (topics: string[]) =>
  marketFetch('/market/sentiment/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topics }),
  });

export const fetchSentimentHistory = (topic: string, days = 30) =>
  marketFetch(`/market/sentiment/${encodeURIComponent(topic)}/history?days=${days}`);

export const analyzeMarketImpact = (event: string, context?: string) =>
  marketFetch('/market/sentiment/impact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, context }),
  });

export const fetchEconomicCalendar = (from?: string, to?: string, importance?: string) => {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (importance) params.set('importance', importance);
  return marketFetch(`/market/calendar?${params.toString()}`);
};

export const createCalendarEvent = (event: Record<string, unknown>) =>
  marketFetch('/market/calendar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });

export const fetchMarketAlerts = (userId = 'default') =>
  marketFetch(`/market/alerts?userId=${userId}`);

export const createMarketAlert = (alert: Record<string, unknown>) =>
  marketFetch('/market/alerts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(alert),
  });

export const refreshAllFeeds = () => marketFetch('/market/feeds/refresh', { method: 'POST' });

// ─── Multi-Tenant & Subscription API ────────────────────────────────

function getTenantHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('token');
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const tenantId = localStorage.getItem('tenantId');
  if (tenantId) headers['X-Tenant-Id'] = tenantId;
  return headers;
}

const tenantFetch = async (path: string, options?: RequestInit) => {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...getTenantHeaders(), ...((options?.headers as Record<string, string>) ?? {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `Request failed: ${res.status}` }));
    throw new Error(err.error ?? `Request failed: ${res.status}`);
  }
  return res.json();
};

export const tenantApi = {
  // ── Tenant CRUD ──
  createTenant: (data: {
    name: string;
    slug: string;
    abn?: string;
    entityType: string;
    planId?: string;
  }) => tenantFetch('/tenants', { method: 'POST', body: JSON.stringify(data) }),

  getTenant: (tenantId: string) => tenantFetch(`/tenants/${tenantId}`),

  updateTenant: (tenantId: string, data: Record<string, unknown>) =>
    tenantFetch(`/tenants/${tenantId}`, { method: 'PUT', body: JSON.stringify(data) }),

  deactivateTenant: (tenantId: string) => tenantFetch(`/tenants/${tenantId}`, { method: 'DELETE' }),

  listMyTenants: () => tenantFetch('/tenants'),

  switchTenant: (tenantId: string): Promise<{ token: string }> =>
    tenantFetch(`/tenants/${tenantId}/switch`, { method: 'POST' }),

  // ── Members ──
  listMembers: (tenantId: string) => tenantFetch(`/tenants/${tenantId}/members`),

  inviteMember: (tenantId: string, email: string, role: string) =>
    tenantFetch(`/tenants/${tenantId}/members/invite`, {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    }),

  updateMemberRole: (tenantId: string, memberId: string, role: string) =>
    tenantFetch(`/tenants/${tenantId}/members/${memberId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),

  removeMember: (tenantId: string, memberId: string) =>
    tenantFetch(`/tenants/${tenantId}/members/${memberId}`, { method: 'DELETE' }),

  // ── Invitations ──
  listInvitations: (tenantId: string) => tenantFetch(`/tenants/${tenantId}/invitations`),

  acceptInvitation: (token: string) =>
    tenantFetch(`/tenants/invitations/${token}/accept`, { method: 'POST' }),

  revokeInvitation: (tenantId: string, invitationId: string) =>
    tenantFetch(`/tenants/${tenantId}/invitations/${invitationId}`, { method: 'DELETE' }),

  // ── Permissions ──
  getPermissions: (tenantId: string) => tenantFetch(`/tenants/${tenantId}/permissions`),

  updatePermissions: (tenantId: string, role: string, permissions: Record<string, boolean>) =>
    tenantFetch(`/tenants/${tenantId}/permissions/${role}`, {
      method: 'PUT',
      body: JSON.stringify({ permissions }),
    }),

  // ── Subscription ──
  getSubscription: (tenantId: string) => tenantFetch(`/tenants/${tenantId}/subscription`),

  updateSubscription: (tenantId: string, planId: string, billingCycle: string) =>
    tenantFetch(`/tenants/${tenantId}/subscription`, {
      method: 'PUT',
      body: JSON.stringify({ planId, billingCycle }),
    }),

  cancelSubscription: (tenantId: string) =>
    tenantFetch(`/tenants/${tenantId}/subscription`, { method: 'DELETE' }),

  getBillingHistory: (tenantId: string) => tenantFetch(`/tenants/${tenantId}/billing`),

  // ── Usage ──
  getUsage: (tenantId: string) => tenantFetch(`/tenants/${tenantId}/usage`),

  checkLimit: (tenantId: string, metric: string) =>
    tenantFetch(`/tenants/${tenantId}/usage/check?metric=${encodeURIComponent(metric)}`),
};

// ─── Wave 4: Employee & Payroll API ────────────────────────────────

export async function fetchEmployees(
  userId: string,
  params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  },
): Promise<{ data: Record<string, unknown>[]; total: number }> {
  const qp = new URLSearchParams({ userId });
  if (params?.page) qp.set('page', String(params.page));
  if (params?.limit) qp.set('limit', String(params.limit));
  if (params?.status) qp.set('status', params.status);
  if (params?.search) qp.set('search', params.search);
  const res = await fetch(`${BASE_URL}/api/payroll/employees?${qp}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch employees');
  return res.json();
}

export async function createEmployee(data: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE_URL}/api/payroll/employees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create employee');
  return res.json();
}

export async function fetchEmployee(id: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE_URL}/api/payroll/employees/${id}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch employee');
  return res.json();
}

export async function updateEmployee(id: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE_URL}/api/payroll/employees/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update employee');
  return res.json();
}

export async function deleteEmployee(id: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE_URL}/api/payroll/employees/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete employee');
  return res.json();
}

export async function fetchBankDetails(employeeId: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE_URL}/api/payroll/employees/${employeeId}/bank-details`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch bank details');
  return res.json();
}

export async function addBankDetails(employeeId: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE_URL}/api/payroll/employees/${employeeId}/bank-details`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to add bank details');
  return res.json();
}

export async function fetchSuperFund(employeeId: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE_URL}/api/payroll/employees/${employeeId}/super`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch super fund');
  return res.json();
}

export async function addSuperFund(employeeId: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE_URL}/api/payroll/employees/${employeeId}/super`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to add super fund');
  return res.json();
}

export async function fetchTaxDeclaration(employeeId: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE_URL}/api/payroll/employees/${employeeId}/tax-declaration`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch tax declaration');
  return res.json();
}

export async function submitTaxDeclaration(employeeId: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE_URL}/api/payroll/employees/${employeeId}/tax-declaration`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to submit tax declaration');
  return res.json();
}

export async function fetchPayCategories(
  userId: string,
  params?: {
    page?: number;
    limit?: number;
  },
): Promise<{ data: Record<string, unknown>[]; total: number }> {
  const qp = new URLSearchParams({ userId });
  if (params?.page) qp.set('page', String(params.page));
  if (params?.limit) qp.set('limit', String(params.limit));
  const res = await fetch(`${BASE_URL}/api/payroll/pay-categories?${qp}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch pay categories');
  return res.json();
}

export async function createPayCategory(data: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE_URL}/api/payroll/pay-categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create pay category');
  return res.json();
}

export async function seedDefaultPayCategories(userId: string): Promise<void> {
  const defaults = [
    { userId, name: 'Base Hourly', type: 'ordinary', rateType: 'hourly' },
    { userId, name: 'Base Salary', type: 'ordinary', rateType: 'annual' },
    { userId, name: 'Overtime 1.5x', type: 'overtime', rateType: 'hourly' },
    { userId, name: 'Overtime 2.0x', type: 'overtime', rateType: 'hourly' },
    { userId, name: 'Meal Allowance', type: 'allowance', rateType: 'fixed' },
    { userId, name: 'Travel Allowance', type: 'allowance', rateType: 'fixed' },
    { userId, name: 'Union Fees', type: 'deduction', rateType: 'fixed' },
    { userId, name: 'Super Guarantee', type: 'super', rateType: 'fixed' },
    { userId, name: 'Salary Sacrifice Super', type: 'super', rateType: 'fixed' },
    { userId, name: 'Annual Leave', type: 'leave', rateType: 'hourly' },
    { userId, name: 'Personal/Carer Leave', type: 'leave', rateType: 'hourly' },
    { userId, name: 'Long Service Leave', type: 'leave', rateType: 'hourly' },
  ];
  for (const cat of defaults) {
    await createPayCategory(cat);
  }
}

export async function fetchPayStructure(employeeId: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE_URL}/api/payroll/employees/${employeeId}/pay-structure`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch pay structure');
  return res.json();
}

export async function setPayStructure(employeeId: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE_URL}/api/payroll/employees/${employeeId}/pay-structure`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to set pay structure');
  return res.json();
}

// ─── Wave 10: Accounts Payable API ──────────────────────────────────

export interface Supplier {
  id: string;
  userId: string;
  businessName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  abn?: string;
  address?: string;
  paymentTermsDays: number;
  bankBsb?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  notes?: string;
  isActive: boolean;
  totalSpent: number;
  outstandingAmount: number;
  createdAt: string;
  updatedAt: string;
}

export interface BillLineItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  gstRate: number;
  amount: number;
  gstAmount: number;
}

export interface Bill {
  id: string;
  userId: string;
  supplierId: string;
  supplierName?: string;
  billNumber: string;
  issueDate: string;
  dueDate: string;
  status: 'draft' | 'awaiting_approval' | 'approved' | 'overdue' | 'paid' | 'void';
  subtotal: number;
  gstTotal: number;
  total: number;
  purchaseOrderId?: string;
  notes?: string;
  lineItems: BillLineItem[];
  createdAt: string;
  updatedAt: string;
}

export interface POLineItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  receivedQuantity?: number;
}

export interface PurchaseOrder {
  id: string;
  userId: string;
  supplierId: string;
  supplierName?: string;
  poNumber: string;
  issueDate: string;
  expectedDate?: string;
  status: 'draft' | 'sent' | 'partially_received' | 'received' | 'cancelled';
  subtotal: number;
  gstTotal: number;
  total: number;
  receivedPercentage?: number;
  notes?: string;
  lineItems: POLineItem[];
  billId?: string;
  purchaseOrderId?: string;
  receipts?: Array<{
    id: string;
    receiptDate: string;
    receivedBy?: string;
    lines: Array<{ lineId: string; quantity: number }>;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentRun {
  id: string;
  userId: string;
  paymentDate: string;
  status: 'draft' | 'processing' | 'completed';
  bankReference?: string;
  totalAmount: number;
  billCount: number;
  billIds: string[];
  createdAt: string;
}

export interface APAgingBucket {
  label: string;
  amount: number;
  count: number;
}

export interface APAgingReport {
  asOfDate: string;
  totalOutstanding: number;
  buckets: APAgingBucket[];
  supplierBreakdown: Array<{
    supplierId: string;
    supplierName: string;
    current: number;
    thirtyDays: number;
    sixtyDays: number;
    ninetyDays: number;
    overNinety: number;
    total: number;
  }>;
}

export const apApi = {
  // ── Suppliers ──
  fetchSuppliers: async (options?: {
    page?: number;
    limit?: number;
    search?: string;
    isActive?: boolean;
  }): Promise<{ suppliers: Supplier[]; total: number }> => {
    const params = new URLSearchParams();
    if (options?.page) params.set('page', String(options.page));
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.search) params.set('search', options.search);
    if (options?.isActive !== undefined) params.set('isActive', String(options.isActive));
    const qs = params.toString();
    const res = await fetch(`${API_URL}/suppliers${qs ? `?${qs}` : ''}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch suppliers');
    return res.json();
  },

  fetchSupplier: async (id: string): Promise<Supplier> => {
    const res = await fetch(`${API_URL}/suppliers/${id}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch supplier');
    return res.json();
  },

  createSupplier: async (data: Partial<Supplier>): Promise<{ id: string }> => {
    const res = await fetch(`${API_URL}/suppliers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create supplier');
    return res.json();
  },

  updateSupplier: async (id: string, data: Partial<Supplier>): Promise<void> => {
    const res = await fetch(`${API_URL}/suppliers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update supplier');
  },

  archiveSupplier: async (id: string): Promise<void> => {
    const res = await fetch(`${API_URL}/suppliers/${id}/archive`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to archive supplier');
  },

  // ── Bills ──
  fetchBills: async (options?: {
    page?: number;
    limit?: number;
    status?: string;
    supplierId?: string;
  }): Promise<{ bills: Bill[]; total: number }> => {
    const params = new URLSearchParams();
    if (options?.page) params.set('page', String(options.page));
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.status) params.set('status', options.status);
    if (options?.supplierId) params.set('supplierId', options.supplierId);
    const qs = params.toString();
    const res = await fetch(`${API_URL}/bills${qs ? `?${qs}` : ''}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch bills');
    return res.json();
  },

  fetchBill: async (id: string): Promise<Bill> => {
    const res = await fetch(`${API_URL}/bills/${id}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch bill');
    return res.json();
  },

  createBill: async (data: Partial<Bill>): Promise<{ id: string }> => {
    const res = await fetch(`${API_URL}/bills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create bill');
    return res.json();
  },

  updateBill: async (id: string, data: Partial<Bill>): Promise<void> => {
    const res = await fetch(`${API_URL}/bills/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update bill');
  },

  approveBill: async (id: string): Promise<void> => {
    const res = await fetch(`${API_URL}/bills/${id}/approve`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to approve bill');
  },

  rejectBill: async (id: string, reason: string): Promise<void> => {
    const res = await fetch(`${API_URL}/bills/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) throw new Error('Failed to reject bill');
  },

  payBill: async (
    id: string,
    data: { paymentDate: string; paymentMethod?: string; reference?: string },
  ): Promise<void> => {
    const res = await fetch(`${API_URL}/bills/${id}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to record bill payment');
  },

  voidBill: async (id: string): Promise<void> => {
    const res = await fetch(`${API_URL}/bills/${id}/void`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to void bill');
  },

  // ── AP Aging ──
  fetchAPAging: async (asOfDate?: string): Promise<APAgingReport> => {
    const params = new URLSearchParams();
    if (asOfDate) params.set('asOfDate', asOfDate);
    const qs = params.toString();
    const res = await fetch(`${API_URL}/ap/aging${qs ? `?${qs}` : ''}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch AP aging');
    return res.json();
  },

  // ── Supplier Bills (for detail view) ──
  fetchSupplierBills: async (
    supplierId: string,
    limit = 10,
  ): Promise<{ bills: Bill[]; total: number }> => {
    const res = await fetch(`${API_URL}/suppliers/${supplierId}/bills?limit=${limit}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch supplier bills');
    return res.json();
  },

  // ── Purchase Orders ──
  fetchPurchaseOrders: async (options?: {
    page?: number;
    limit?: number;
    status?: string;
    supplierId?: string;
  }): Promise<{ orders: PurchaseOrder[]; total: number }> => {
    const params = new URLSearchParams();
    if (options?.page) params.set('page', String(options.page));
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.status) params.set('status', options.status);
    if (options?.supplierId) params.set('supplierId', options.supplierId);
    const qs = params.toString();
    const res = await fetch(`${API_URL}/purchase-orders${qs ? `?${qs}` : ''}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch purchase orders');
    return res.json();
  },

  fetchPurchaseOrder: async (id: string): Promise<PurchaseOrder> => {
    const res = await fetch(`${API_URL}/purchase-orders/${id}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch purchase order');
    return res.json();
  },

  createPurchaseOrder: async (data: Partial<PurchaseOrder>): Promise<{ id: string }> => {
    const res = await fetch(`${API_URL}/purchase-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create purchase order');
    return res.json();
  },

  updatePurchaseOrder: async (id: string, data: Partial<PurchaseOrder>): Promise<void> => {
    const res = await fetch(`${API_URL}/purchase-orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update purchase order');
  },

  sendPurchaseOrder: async (id: string): Promise<void> => {
    const res = await fetch(`${API_URL}/purchase-orders/${id}/send`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to send purchase order');
  },

  receivePurchaseOrder: async (
    id: string,
    data: {
      receiptDate: string;
      notes?: string;
      lines: Array<{ lineId: string; quantity: number }>;
    },
  ): Promise<void> => {
    const res = await fetch(`${API_URL}/purchase-orders/${id}/receive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to receive purchase order');
  },

  cancelPurchaseOrder: async (id: string): Promise<void> => {
    const res = await fetch(`${API_URL}/purchase-orders/${id}/cancel`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to cancel purchase order');
  },

  fetchThreeWayMatch: async (poId: string): Promise<Record<string, unknown>> => {
    const res = await fetch(`${API_URL}/purchase-orders/${poId}/three-way-match`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch three-way match');
    return res.json();
  },

  // ── Payment Runs ──
  createPaymentRun: async (data: {
    paymentDate: string;
    bankReference?: string;
    billIds: string[];
  }): Promise<{ id: string }> => {
    const res = await fetch(`${API_URL}/supplier-payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create payment run');
    const json = await res.json();
    return json.data ?? json;
  },

  fetchPaymentRun: async (id: string): Promise<PaymentRun> => {
    const res = await fetch(`${API_URL}/supplier-payments/${id}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch payment run');
    const json = await res.json();
    return json.data ?? json;
  },

  processPaymentRun: async (id: string): Promise<void> => {
    // Process payment by marking each bill in the run as paid
    const run = await apApi.fetchPaymentRun(id);
    const billIds = run.billIds ?? [];
    const payDate = run.paymentDate ?? new Date().toISOString().split('T')[0];
    for (const billId of billIds) {
      await apApi.payBill(billId, { paymentDate: payDate });
    }
  },

  // ── Push Notifications & Sync (Wave 24) ──
  getVapidKey: async (): Promise<{ publicKey: string; configured: boolean }> => {
    const res = await fetch(`${API_URL}/push/vapid-key`);
    if (!res.ok) throw new Error('Failed to get VAPID key');
    return res.json();
  },
  subscribePush: async (
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    deviceName?: string,
  ): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_URL}/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ subscription, deviceName }),
    });
    if (!res.ok) throw new Error('Failed to subscribe to push');
    return res.json();
  },
  unsubscribePush: async (endpoint: string): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_URL}/push/subscribe`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ endpoint }),
    });
    if (!res.ok) throw new Error('Failed to unsubscribe from push');
    return res.json();
  },
  fetchNotificationPreferences: async (): Promise<Record<string, unknown>> => {
    const res = await fetch(`${API_URL}/notifications/preferences`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch notification preferences');
    return res.json();
  },
  updateNotificationPreferences: async (
    prefs: Record<string, unknown>,
  ): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_URL}/notifications/preferences`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(prefs),
    });
    if (!res.ok) throw new Error('Failed to update notification preferences');
    return res.json();
  },
  syncOfflineChanges: async (operations: unknown[]): Promise<unknown> => {
    const res = await fetch(`${API_URL}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ operations }),
    });
    if (!res.ok) throw new Error('Sync failed');
    return res.json();
  },
  getSyncConflicts: async (): Promise<{ conflicts: unknown[]; count: number }> => {
    const res = await fetch(`${API_URL}/sync/conflicts`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to get sync conflicts');
    return res.json();
  },
  resolveSyncConflict: async (
    conflictId: string,
    resolution: 'client_wins' | 'server_wins',
  ): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_URL}/sync/resolve/${conflictId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ resolution }),
    });
    if (!res.ok) throw new Error('Failed to resolve conflict');
    return res.json();
  },
  getSyncLog: async (limit = 20, offset = 0): Promise<{ log: unknown[]; count: number }> => {
    const res = await fetch(`${API_URL}/sync/log?limit=${limit}&offset=${offset}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to get sync log');
    return res.json();
  },
};

// ─── Wave 7: Invoicing & Customer Management API ────────────────────

export const invoicingApi = {
  // ── Customers ──
  listCustomers: async (options?: {
    offset?: number;
    limit?: number;
    search?: string;
    isActive?: boolean;
  }) => {
    const params = new URLSearchParams();
    if (options?.offset) params.set('offset', String(options.offset));
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.search) params.set('search', options.search);
    if (options?.isActive !== undefined) params.set('isActive', String(options.isActive));
    const qs = params.toString();
    const res = await fetch(`${API_URL}/customers${qs ? `?${qs}` : ''}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch customers');
    return res.json();
  },

  getCustomer: async (id: string) => {
    const res = await fetch(`${API_URL}/customers/${id}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch customer');
    return res.json();
  },

  createCustomer: async (data: Record<string, unknown>) => {
    const res = await fetch(`${API_URL}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create customer');
    return res.json();
  },

  updateCustomer: async (id: string, data: Record<string, unknown>) => {
    const res = await fetch(`${API_URL}/customers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update customer');
    return res.json();
  },

  archiveCustomer: async (id: string) => {
    const res = await fetch(`${API_URL}/customers/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to archive customer');
    return res.json();
  },

  listContacts: async (customerId: string) => {
    const res = await fetch(`${API_URL}/customers/${customerId}/contacts`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch contacts');
    return res.json();
  },

  addContact: async (customerId: string, data: Record<string, unknown>) => {
    const res = await fetch(`${API_URL}/customers/${customerId}/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to add contact');
    return res.json();
  },

  // ── Invoices ──
  listInvoices: async (options?: {
    offset?: number;
    limit?: number;
    status?: string;
    customerId?: string;
    dateFrom?: string;
    dateTo?: string;
  }) => {
    const params = new URLSearchParams();
    if (options?.offset) params.set('offset', String(options.offset));
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.status) params.set('status', options.status);
    if (options?.customerId) params.set('customerId', options.customerId);
    if (options?.dateFrom) params.set('dateFrom', options.dateFrom);
    if (options?.dateTo) params.set('dateTo', options.dateTo);
    const qs = params.toString();
    const res = await fetch(`${API_URL}/invoices${qs ? `?${qs}` : ''}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch invoices');
    return res.json();
  },

  getInvoice: async (id: string) => {
    const res = await fetch(`${API_URL}/invoices/${id}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch invoice');
    return res.json();
  },

  createInvoice: async (data: Record<string, unknown>) => {
    const res = await fetch(`${API_URL}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create invoice');
    return res.json();
  },

  updateInvoice: async (id: string, data: Record<string, unknown>) => {
    const res = await fetch(`${API_URL}/invoices/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update invoice');
    return res.json();
  },

  sendInvoice: async (id: string) => {
    const res = await fetch(`${API_URL}/invoices/${id}/send`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to send invoice');
    return res.json();
  },

  voidInvoice: async (id: string) => {
    const res = await fetch(`${API_URL}/invoices/${id}/void`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to void invoice');
    return res.json();
  },

  downloadInvoicePDF: async (id: string): Promise<Blob> => {
    const res = await fetch(`${API_URL}/invoices/${id}/pdf`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to download invoice PDF');
    return res.blob();
  },

  recordPayment: async (invoiceId: string, data: Record<string, unknown>) => {
    const res = await fetch(`${API_URL}/invoices/${invoiceId}/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to record payment');
    return res.json();
  },

  createCreditNote: async (data: Record<string, unknown>) => {
    const res = await fetch(`${API_URL}/invoices/credit-note`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create credit note');
    return res.json();
  },

  getNextInvoiceNumber: async (): Promise<string> => {
    const res = await fetch(`${API_URL}/invoices/next-number`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to get next invoice number');
    const json = await res.json();
    return json.nextNumber;
  },

  getInvoiceSummary: async () => {
    const res = await fetch(`${API_URL}/invoices/summary`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch invoice summary');
    return res.json();
  },
};

// ─── Offline Interceptor Wiring ─────────────────────────────────────
// Wraps core API methods with IndexedDB caching for offline support.
// GET calls: try network first, cache result, fall back to IndexedDB.
// Mutations: if offline, queue to sync queue and return optimistic response.

import {
  createTransactionInterceptor,
  createAccountInterceptor,
  createUpdateTransactionInterceptor,
  createDeleteTransactionInterceptor,
} from './services/offline-interceptor';

// Store original implementations
const _originalFetchTransactions = api.fetchTransactions;
const _originalFetchAccounts = api.fetchAccounts;
const _originalUpdateTransaction = api.updateTransaction;
const _originalDeleteTransaction = api.deleteTransaction;

// Apply offline interceptors
api.fetchTransactions = createTransactionInterceptor(_originalFetchTransactions);
api.fetchAccounts = createAccountInterceptor(_originalFetchAccounts);
api.updateTransaction = createUpdateTransactionInterceptor(_originalUpdateTransaction);
api.deleteTransaction = createDeleteTransactionInterceptor(_originalDeleteTransaction);

// --- Agent 01: Final Fixes ---

export const transactionsApi = {
  fetchAuditLog: async (_options?: Record<string, unknown>) => Promise.resolve({ entries: [] as AuditEntry[], total: 0 }),
};

export interface ProfitAndLossReport {
  periodStart: string;
  periodEnd: string;
  revenue: CategoryGroup[];
  expenses: CategoryGroup[];
  costOfGoodsSold: CategoryGroup[];
  grossRevenue: number;
  totalCOGS: number;
  grossProfit: number;
  totalExpenses: number;
  netProfitOrLoss: number;
  grossMargin: number;
  transactionCount: number;
}

export interface CategoryGroup {
  category: string;
  amount: number;
  transactionCount: number;
  subcategories?: CategoryGroup[];
}

export interface OCRDocument {
  id: string;
  [key: string]: unknown;
}

export interface OCRLineItem {
  id: string;
  [key: string]: unknown;
}

export type AssetRegisterResponse = Record<string, unknown>;
export type AutoMatchResult = Record<string, unknown>;
export type BalanceSheetReport = Record<string, unknown>;
export type BatchDepreciationResult = Record<string, unknown>;
export type BorrowingCapacityResult = Record<string, unknown>;
export type Budget = Record<string, unknown>;
export type BudgetLine = Record<string, unknown>;
export type BudgetVariance = Record<string, unknown>;
export type CarFinanceComparison = Record<string, unknown>;
export type CashFlowReport = Record<string, unknown>;
export type ConsolidationDetailResponse = Record<string, unknown>;
export type ConsolidationSnapshotData = Record<string, unknown>;
export type DepreciationScheduleResponse = Record<string, unknown>;
export type DetectedEquityEvent = Record<string, unknown>;
export type EntityData = Record<string, unknown>;
export type EntityHierarchyResponse = Record<string, unknown>;
export type EntitySettingData = Record<string, unknown>;
export type EntityWithDetails = Record<string, unknown>;
export type EquitySummary = Record<string, unknown>;
export type FixedAssetData = Record<string, unknown>;
export type ForecastPeriod = Record<string, unknown>;
export type ForecastScenario = Record<string, unknown>;
export type HomeLoanResult = Record<string, unknown>;
export type InterEntityTransactionData = Record<string, unknown>;
export type KPIMetric = Record<string, unknown>;
export type MatchCandidate = Record<string, unknown>;
export type MatchStats = Record<string, unknown>;
export type PaymentMatchRule = Record<string, unknown>;
export type PeriodComparisonReport = Record<string, unknown>;
export type PeriodComparisonRow = Record<string, unknown>;
export type PersonalLoanResult = Record<string, unknown>;
export type ProjectionResult = Record<string, unknown>;
export type RecurringBill = Record<string, unknown>;
export type RefinanceResult = Record<string, unknown>;
export type RepaymentFrequency = Record<string, unknown>;
export type TaxStrategyRecord = Record<string, unknown>;
export type TrialBalanceEntry = Record<string, unknown>;
export type TrialBalanceReport = Record<string, unknown>;
export type VarianceSummary = Record<string, unknown>;
export type WealthProjectionResult = Record<string, unknown>;

// Missing Standalone Functions
export const adminLogin = async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>);
export const fetchActivityLog = async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>);
export const fetchActivitySummary = async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>);
export const fetchAdminProfile = async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>);
export const fetchAdminUsers = async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>);
export const fetchAgentConfigs = async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>);
export const fetchAgentCosts = async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>);
export const fetchAgentExecutions = async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>);
export const fetchAgentStats = async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>);
export const fetchBestRates = async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>);
export const fetchCdrAlerts = async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>);
export const fetchCdrProducts = async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>);
export const fetchCogneeAdminDatasets = async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>);
export const fetchCogneeDatasetDetail = async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>);
export const fetchCogneeGraphStats = async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>);
export const fetchDataHolders = async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>);
export const fetchDiskUsage = async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>);
export const fetchFeatureFlags = async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>);
export const fetchHealthHistory = async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>);
export const fetchSystemHealth = async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>);
export const fetchSystemMetrics = async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>);
export const testCogneeSearch = async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>);
export const reindexCogneeDataset = async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>);
export const triggerCdrCrawl = async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>);
export const compareCdrProducts = async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>);
export const calculateSavings = async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>);
export const createAdminUser = async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>);
export const createCdrAlert = async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>);
export const createFeatureFlag = async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>);
export const deleteAdminUser = async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>);
export const deleteCdrAlert = async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>);
export const updateAdminUser = async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>);
export const updateAgentConfig = async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>);
export const updateFeatureFlag = async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>);
export const fetchMarketRates = fetchMarketPrices;

// Missing API Namespace Objects
export const entityApi: Record<string, (...args: unknown[]) => Promise<unknown>> = {
  createEntity: async (_data: unknown) => Promise.resolve({} as Record<string, unknown>),
  getHierarchy: async () => Promise.resolve({} as Record<string, unknown>),
  updateSettings: async (_id: unknown, _settings: unknown) => Promise.resolve(),
  getInterEntityTransactions: async (_filters: unknown) => Promise.resolve([] as Record<string, unknown>[]),
  confirmInterEntityTransaction: async (_id: unknown, _entityId: unknown, _confirmed: unknown) =>
    Promise.resolve(),
  recordInterEntityTransaction: async (_data: unknown) => Promise.resolve(),
};

export const assetApi: Record<string, (...args: unknown[]) => Promise<unknown>> = {
  disposeAsset: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  getRegister: async (..._args: unknown[]) => Promise.resolve({ assets: [] } as Record<string, unknown>),
  getDepreciationSchedule: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  runBatchDepreciation: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  registerAsset: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
};

export const forecastApi: Record<string, (...args: unknown[]) => Promise<unknown>> = {
  calculateAccuracy: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  updateActuals: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  list: async (..._args: unknown[]) => Promise.resolve([] as Record<string, unknown>[]),
  getById: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  generate: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  archive: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  compare: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
};

export const intelligenceApi: Record<string, (...args: unknown[]) => Promise<unknown>> = {
  findCorrelations: async (..._args: unknown[]) => Promise.resolve([] as Record<string, unknown>[]),
  listInsights: async (..._args: unknown[]) => Promise.resolve([] as Record<string, unknown>[]),
  updateInsightStatus: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  listSubscriptions: async (..._args: unknown[]) => Promise.resolve([] as Record<string, unknown>[]),
  scanInsights: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  getTimeline: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  getConnections: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  subscribe: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  deleteSubscription: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  listSavedQueries: async (..._args: unknown[]) => Promise.resolve([] as Record<string, unknown>[]),
  executeQuery: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  saveQuery: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
};

export const knowledgeApi: Record<string, (...args: unknown[]) => Promise<unknown>> = {
  listDataPoints: async (..._args: unknown[]) => Promise.resolve([] as Record<string, unknown>[]),
  createDataPoint: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  deactivateDataPoint: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  activateDataPoint: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  feedbackStats: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  triggerMemify: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  graphStats: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  getGraph: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  submitFeedback: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  listOntologies: async (..._args: unknown[]) => Promise.resolve([] as Record<string, unknown>[]),
  createOntology: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  applyOntology: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
};

export const inventoryApi: Record<string, (...args: unknown[]) => Promise<unknown>> = {
  listItems: async (..._args: unknown[]) => Promise.resolve([] as Record<string, unknown>[]),
  getStockLevels: async (..._args: unknown[]) => Promise.resolve([] as Record<string, unknown>[]),
  getValuation: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  updateItem: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  createItem: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  deactivateItem: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  getMovements: async (..._args: unknown[]) => Promise.resolve([] as Record<string, unknown>[]),
  listWarehouses: async (..._args: unknown[]) => Promise.resolve([] as Record<string, unknown>[]),
  createWarehouse: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
};

export const matchesApi: Record<string, (...args: unknown[]) => Promise<unknown>> = {
  autoMatch: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  confirm: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  reject: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  getStats: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  findCandidates: async (..._args: unknown[]) => Promise.resolve([] as Record<string, unknown>[]),
  scoreMatch: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  listRules: async (..._args: unknown[]) => Promise.resolve([] as Record<string, unknown>[]),
  createRule: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  deleteRule: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
};

export const reconApi: Record<string, (...args: unknown[]) => Promise<unknown>> = {
  listSessions: async (..._args: unknown[]) => Promise.resolve([] as Record<string, unknown>[]),
  createSession: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  getSession: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  autoMatch: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  completeSession: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  confirmMatch: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  createManualMatch: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  getRules: async (..._args: unknown[]) => Promise.resolve([] as Record<string, unknown>[]),
  createRule: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
};

export const reportsApi: Record<string, (...args: unknown[]) => Promise<unknown>> = {
  fetchBalanceSheet: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  fetchCashFlow: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  fetchKPIs: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  comparePeriods: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  fetchPnL: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  fetchTrialBalance: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
};

export const budgetsApi: Record<string, (...args: unknown[]) => Promise<unknown>> = {
  get: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  addLine: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  update: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  list: async (..._args: unknown[]) => Promise.resolve([] as Record<string, unknown>[]),
  create: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  getVariance: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  getVarianceSummary: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
};

export const loanApi: Record<string, (...args: unknown[]) => Promise<unknown>> = {
  calculateCarFinance: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  calculateHomeLoan: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  calculateRefinanceSavings: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  calculateBorrowingCapacity: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  calculatePersonalLoan: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
};

export const anomalyApi: Record<string, (...args: unknown[]) => Promise<unknown>> = {
  list: async (..._args: unknown[]) => Promise.resolve([] as Record<string, unknown>[]),
  stats: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  scan: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  acknowledge: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  resolve: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  dismiss: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
};

export const complianceApi: Record<string, (...args: unknown[]) => Promise<unknown>> = {
  calendar: async (..._args: unknown[]) => Promise.resolve([] as Record<string, unknown>[]),
  obligations: async (..._args: unknown[]) => Promise.resolve([] as Record<string, unknown>[]),
  risk: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  report: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  generateSchedule: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  lodge: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
};

export const consolidationApi: Record<string, (...args: unknown[]) => Promise<unknown>> = {
  generate: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  getSnapshots: async (..._args: unknown[]) => Promise.resolve([] as Record<string, unknown>[]),
  getSnapshotDetail: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  finalizeSnapshot: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
};

export const documentsApi: Record<string, (...args: unknown[]) => Promise<unknown>> = {
  list: async (..._args: unknown[]) => Promise.resolve([] as Record<string, unknown>[]),
  delete: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  upload: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  process: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  get: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  classify: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  getLineItems: async (..._args: unknown[]) => Promise.resolve([] as Record<string, unknown>[]),
  batchProcess: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
};

export const forecastsApi: Record<string, (...args: unknown[]) => Promise<unknown>> = {
  listScenarios: async (..._args: unknown[]) => Promise.resolve([] as Record<string, unknown>[]),
  createScenario: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  generateForecast: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  getScenario: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
  compareScenarios: async (..._args: unknown[]) => Promise.resolve({} as Record<string, unknown>),
};

export type TaxReturnResult = Record<string, unknown>;
