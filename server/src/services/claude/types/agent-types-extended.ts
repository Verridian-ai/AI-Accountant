/**
 * Claude Agent Framework — Extended Agent I/O Contract Types
 *
 * Continuation of agent types: TaxStrategyOutput, FinancialPlanner,
 * TenantRouting, PayrollAgent, PersonalTaxClaims, InventoryAgent,
 * BankReconAgent, OCRProcessing, PaymentMatching, AssetManagement,
 * MultiEntity, FinancialReporting, Budgeting, Forecasting,
 * ComplianceMonitoring, CdrProduct, InvoiceAgent, AccountsPayable.
 */

export interface TaxStrategyOutput {
  entityType: string;
  financialYear: string;
  currentTaxPosition: {
    grossIncomeCents: number;
    deductionsCents: number;
    taxableIncomeCents: number;
    estimatedTaxCents: number;
    effectiveRate: number;
  };
  strategies: Array<{
    name: string;
    description: string;
    estimatedSavingCents: number;
    confidence: number;
    atoRulingRef?: string;
    applicableEntities: string[];
    implementationSteps: string[];
  }>;
  warnings: string[];
  summary: string;
}

// 3.11 FinancialPlannerAgent
export interface FinancialPlannerInput {
  userId: string;
  financialYear: string;
  transactions: Array<{
    id: string;
    date: string;
    description: string;
    amount: number; // cents
    category?: string;
  }>;
  riskProfile?: 'conservative' | 'balanced' | 'growth' | 'aggressive';
  goals?: string[];
  debts?: Array<{
    name: string;
    balanceCents: number;
    interestRate: number;
    minimumPaymentCents: number;
  }>;
}

export interface FinancialPlannerOutput {
  spendingAnalysis: {
    totalIncomeCents: number;
    totalExpensesCents: number;
    savingsRatePercent: number;
    topCategories: Array<{
      category: string;
      totalCents: number;
      percentOfIncome: number;
    }>;
  };
  budgetRecommendation: {
    needs: number; // percentage
    wants: number;
    savings: number;
    monthlyTargets: Array<{
      category: string;
      currentCents: number;
      recommendedCents: number;
    }>;
  };
  wealthProjection: Array<{
    year: number;
    projectedNetWorthCents: number;
    assumptions: string;
  }>;
  debtStrategy?: {
    method: 'avalanche' | 'snowball';
    totalInterestSavedCents: number;
    payoffMonths: number;
    order: Array<{
      debtName: string;
      payoffMonth: number;
    }>;
  };
  recommendations: string[];
  summary: string;
}

// 3.12 TenantRoutingAgent
export interface TenantRoutingInput {
  userId: string;
  tenantId?: string;
  tenantSlug?: string;
  requestedPermissions?: string[];
  requestedResources?: Array<{ type: string; ids: string[] }>;
  endpoint?: string;
}

export interface TenantRoutingOutput {
  tenantContext: {
    tenant: { id: string; name: string; slug: string };
    role: string;
    permissions: string[];
    subscription: { planName: string; status: string };
  };
  permissionsGranted: Record<string, boolean>;
  isolationViolations: Array<{
    resourceType: string;
    resourceId: string;
    reason: string;
  }>;
  rateLimitStatus: {
    allowed: boolean;
    remaining: number;
    resetAt: string;
  };
}

// ---------------------------------------------------------------------------
// Payroll Agent
// ---------------------------------------------------------------------------

export interface PayrollAgentInput {
  userId: string;
  transactions: Array<{
    id: string;
    date: string;
    description: string;
    amount: number;
    category?: string;
  }>;
  financialYear?: string;
  quarter?: number;
  employeeId?: string; // Wave 4: for employee-specific queries
  hoursWorked?: number; // Wave 4: for pay calculations
}

export interface PayrollAgentOutput {
  wagePayments: WagePaymentDetection[];
  superGuaranteeIssues: Array<{ description: string; amount: number }>;
  summary: string;
}

export interface WagePaymentDetection {
  transactionId: string;
  employeeName?: string;
  grossAmount: number;
  taxWithheld: number;
  superAmount: number;
  netAmount: number;
  payPeriod?: string;
  confidence: number;
}

// ---------------------------------------------------------------------------
// Personal Tax Claims Agent
// ---------------------------------------------------------------------------

export interface PersonalTaxClaimsInput {
  userId: string;
  financialYear: string;
  transactions: Array<{
    id: string;
    date: string;
    description: string;
    amount: number;
    category?: string;
  }>;
  occupation?: string;
  hasHomeOffice?: boolean;
  motorVehicleKm?: number;
}

export interface PersonalTaxClaimsOutput {
  claims: Array<{
    transactionId: string;
    claimType: string;
    claimAmount: number;
    method: string;
    confidence: number;
    atoReference?: string;
  }>;
  totalClaimable: number;
  summary: string;
}

// ---------------------------------------------------------------------------
// Inventory Agent
// ---------------------------------------------------------------------------

export interface InventoryAgentInput {
  userId: string;
  action: string;
  items?: Array<{ name: string; sku?: string; quantity: number; unitCost: number }>;
  dateRange?: { start: string; end: string };
}

export interface InventoryAgentOutput {
  results: Array<Record<string, unknown>>;
  totalValue: number;
  summary: string;
}

// ---------------------------------------------------------------------------
// Bank Reconciler Agent
// ---------------------------------------------------------------------------

export interface BankReconAgentInput {
  accountId: string;
  statementId?: string;
  dateRange?: { start: string; end: string };
}

export interface BankReconAgentOutput {
  reconciledCount: number;
  discrepancies: Array<{
    transactionId: string;
    expected: number;
    actual: number;
    type: string;
  }>;
  status: 'clean' | 'warnings' | 'errors';
  summary: string;
}

// ---------------------------------------------------------------------------
// OCR Processing Agent
// ---------------------------------------------------------------------------

export interface OCRProcessingInput {
  documentId: string;
  filePath: string;
  mimeType: string;
}

export interface OCRProcessingOutput {
  documentType: string;
  vendorName?: string;
  vendorAbn?: string;
  documentDate?: string;
  totalAmount: number;
  gstAmount: number;
  lineItems: Array<{
    description: string;
    amount: number;
    gstAmount: number;
  }>;
  confidence: number;
}

// ---------------------------------------------------------------------------
// Payment Matching Agent
// ---------------------------------------------------------------------------

export interface PaymentMatchingInput {
  documentId: string;
  transactionPool: Array<{
    id: string;
    date: string;
    description: string;
    amount: number;
  }>;
}

export interface PaymentMatchingOutput {
  matches: Array<{
    transactionId: string;
    score: number;
    method: string;
  }>;
  bestMatch?: { transactionId: string; score: number };
}

// ---------------------------------------------------------------------------
// Asset Management Agent
// ---------------------------------------------------------------------------

export interface AssetManagementInput {
  userId: string;
  action: 'register' | 'depreciate' | 'dispose' | 'revalue' | 'report';
  assetId?: string;
  data?: Record<string, unknown>;
}

export interface AssetManagementOutput {
  results: Array<Record<string, unknown>>;
  depreciation?: { annualAmount: number; method: string };
  summary: string;
}
