/**
 * Claude Agent Framework — Shared Types
 *
 * All types and interfaces for the Claude agent system.
 */

import type { BankId, AccountInfo, ParsedTransaction } from '../parsers/types.js';

// Agent type union
export type AgentType =
  | 'statement_parser'
  | 'transaction_categorizer'
  | 'gst_calculator'
  | 'account_reconciler'
  | 'budget_analyzer'
  | 'cross_account_tracer'
  | 'merchant_intelligence'
  | 'tax_strategy'
  | 'financial_planner'
  | 'market_intelligence'
  | 'tenant_routing'
  | 'payroll_agent'
  | 'personal_tax_claims'
  | 'inventory_agent'
  | 'bank_reconciler_agent'
  | 'ocr_processing'
  | 'payment_matching'
  | 'asset_management'
  | 'multi_entity'
  | 'financial_reporting'
  | 'budgeting'
  | 'forecasting'
  | 'compliance_monitoring'
  | 'cdr_product'
  | 'invoice_agent'
  | 'accounts_payable_agent';

// Token budget per agent
export interface TokenBudget {
  maxInputTokens: number;
  maxOutputTokens: number;
  maxToolCalls: number;
  warningThresholdPercent: number;
}

// Retry configuration
export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

// Agent progress event for SSE
export interface AgentProgressEvent {
  type: 'agent_progress';
  agent: AgentType;
  status: 'started' | 'tool_call' | 'completed' | 'error';
  data?: Record<string, unknown>;
  timestamp: string;
}

// Token usage tracking
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  toolCalls: number;
}

// --- Agent I/O Contracts ---

// 3.1 StatementParser
export interface StatementParserInput {
  statementId: number;
  extractedText: string;
  extractedImages?: string[];
  fileName: string;
}

export interface StatementParserOutput {
  bankId: BankId;
  bankConfidence: number;
  accountInfo: AccountInfo;
  transactions: ParsedTransaction[];
  parseMethod: 'bank_parser' | 'ai_vision' | 'ai_text';
  warnings: string[];
}

// 3.2 TransactionCategorizer
export interface CategorizerInput {
  transactions: Array<{
    id: number;
    date: string;
    description: string;
    amount: number;
    accountId: number;
    bankId: BankId;
  }>;
  existingMerchantMemory: Array<{
    pattern: string;
    category: string;
    gst: boolean;
  }>;
  // F10: Session context for conversational memory and feedback
  sessionId?: string;
  userId?: string;
}

export interface CategorizerOutput {
  results: Array<{
    transactionId: number;
    category: string;
    subCategory?: string;
    confidence: number;
    gstCategory: string;
    gstAmount?: number;
    aiReasoningNotes: string;
    merchantKey?: string;
    isRecurring?: boolean;
  }>;
  lowConfidenceIds: number[];
}

// 3.3 GSTCalculator
export interface GSTCalculatorInput {
  transactions: Array<{
    id: number;
    date: string;
    description: string;
    amount: number;
    category?: string;
    gstCategory?: string;
  }>;
  quarter: { year: number; quarter: 1 | 2 | 3 | 4 };
  accountId?: number;
  includePayg?: boolean;
  // F10: Session context for conversational memory and feedback
  sessionId?: string;
  userId?: string;
}

export interface GSTCalculatorOutput {
  basLabels: {
    G1: number;
    G2: number;
    G3: number;
    G10: number;
    G11: number;
    '1A': number;
    '1B': number;
    W1: number;
    W2: number;
    '5A': number;
    '7C': number;
    '7D': number;
  };
  gstPayable: number;
  totalPayable: number;
  transactionBreakdown: {
    gstApplicable: number;
    gstFree: number;
    inputTaxed: number;
    capitalAcquisitions: number;
    outOfScope: number;
  };
  warnings: string[];
}

// 3.4 AccountReconciler
export interface ReconcilerInput {
  accountId: number;
  statementIds?: number[];
  includeTransferDetection?: boolean;
  accounts?: Array<{
    id: number;
    accountNumber: string;
    bankId: string;
    accountName?: string;
  }>;
}

export interface ReconcilerOutput {
  status: 'clean' | 'warnings' | 'errors';
  duplicates: Array<{
    transaction1Id: number;
    transaction2Id: number;
    confidence: number;
    reason: string;
  }>;
  balanceContinuity: {
    isContiguous: boolean;
    gaps: Array<{
      afterStatement: number;
      expectedOpening: number;
      actualOpening: number;
    }>;
  };
  transferMatches: Array<{
    sourceTransactionId: number;
    targetTransactionId: number;
    amount: number;
    confidence: number;
    matchReasons: string[];
  }>;
  unmatchedTransactions: Array<{
    id: number;
    date: string;
    description: string;
    amount: number;
  }>;
  runningBalanceErrors: Array<{
    transactionId: number;
    expected: number;
    actual: number;
  }>;
  summary: string;
}

// 3.5 BudgetAnalyzer
export interface BudgetAnalyzerInput {
  accountIds: number[];
  dateRange?: { start: string; end: string };
  focusAreas?: ('spending' | 'income' | 'savings' | 'recurring' | 'anomalies')[];
  includeProjections?: boolean;
  // F10: Session context for conversational memory and feedback
  sessionId?: string;
  userId?: string;
}

export interface BudgetAnalyzerOutput {
  insights: Array<{
    type: 'spending' | 'income' | 'savings' | 'warning' | 'opportunity';
    title: string;
    description: string;
    amount?: number;
    trend?: 'up' | 'down' | 'stable';
    confidence: number;
  }>;
  categoryBreakdown: Array<{
    category: string;
    total: number;
    percentage: number;
    monthOverMonth: number;
  }>;
  recurringExpenses: Array<{
    description: string;
    amount: number;
    frequency: 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'annual';
    nextExpected: string;
  }>;
  projections?: Array<{
    month: string;
    projectedBalance: number;
    confidence: number;
  }>;
  savingsRate: number;
  summary: string;
}

// 3.6 CrossAccountTracer
export interface CrossAccountTracerInput {
  accountIds: number[];
  dateRange?: { start: string; end: string };
  config?: {
    matchWindowDays?: number;
    amountToleranceCents?: number;
    minConfidence?: number;
  };
  includeFlowDiagram?: boolean;
}

export interface CrossAccountTracerOutput {
  transfers: Array<{
    sourceAccountId: number;
    targetAccountId: number;
    sourceTransactionId: number;
    targetTransactionId: number;
    amount: number;
    date: string;
    confidence: number;
    matchReasons: string[];
  }>;
  multiHopChains: Array<{
    path: number[];
    totalAmount: number;
    transactionIds: number[];
  }>;
  netFlows: Array<{
    fromAccountId: number;
    toAccountId: number;
    netAmount: number;
    transactionCount: number;
  }>;
  flowDiagram?: string;
  summary: string;
}

// 3.7 MerchantIntelligence
export interface MerchantIntelligenceInput {
  merchants: Array<{
    transactionId: number;
    description: string;
    amount: number;
    category?: string;
  }>;
  existingMappings: Array<{
    pattern: string;
    displayName: string;
    abn?: string;
    gstRegistered?: boolean;
    category?: string;
  }>;
  // F10: Session context for conversational memory and feedback
  sessionId?: string;
  userId?: string;
}

export interface MerchantIntelligenceOutput {
  results: Array<{
    transactionId: number;
    abbreviatedName: string;
    canonicalName: string;
    abn?: string;
    gstRegistered: boolean;
    industry?: string;
    defaultCategory: string;
    confidence: number;
    source: 'cognee' | 'online' | 'pattern' | 'unknown';
  }>;
  newMappings: Array<{
    abbreviatedName: string;
    canonicalName: string;
    abn?: string;
    gstRegistered: boolean;
    industry?: string;
    defaultCategory: string;
  }>;
  summary: string;
}

// Market Intelligence Agent I/O
export interface MarketIntelInput {
  query: string;
  context?: {
    userPortfolio?: Array<{ asset: string; type: string; value: number }>;
    businessType?: string;
    interestRateExposure?: { variableDebt: number; fixedDebt: number };
    timeHorizon?: 'short_term' | 'medium_term' | 'long_term';
  };
}

export interface MarketIntelOutput {
  briefing: string;
  keyIndicators: Array<{
    name: string;
    value: number;
    unit: string;
    trend: 'up' | 'down' | 'stable';
    significance: string;
  }>;
  marketSentiment: {
    overall: string;
    score: number;
    drivers: string[];
  };
  recommendations: Array<{
    action: string;
    rationale: string;
    urgency: 'immediate' | 'soon' | 'monitor';
    confidence: number;
  }>;
  warnings: string[];
  disclaimer: string;
}

// 3.9 TaxStrategyAgent
export interface TaxStrategyInput {
  userId: string;
  financialYear: string;
  entityType: 'sole_trader' | 'personal' | 'company' | 'trust' | 'smsf';
  transactions: Array<{
    id: string;
    date: string;
    description: string;
    amount: number; // cents
    category?: string;
    gstCategory?: string;
  }>;
  businessIncome?: number; // cents
  businessExpenses?: number; // cents
  personalIncome?: number; // cents
  // F10: Session context for conversational memory and feedback
  sessionId?: string;
  userId?: string;
}

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
  // F10: Session context for conversational memory and feedback
  sessionId?: string;
  userId?: string;
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

// ---------------------------------------------------------------------------
// Multi-Entity Agent
// ---------------------------------------------------------------------------

export interface MultiEntityInput {
  userId: string;
  action: 'consolidate' | 'eliminate' | 'report' | 'audit';
  entityIds?: string[];
  period?: { start: string; end: string };
}

export interface MultiEntityOutput {
  consolidatedResults: Record<string, unknown>;
  eliminations: Array<{ description: string; amount: number }>;
  summary: string;
}

// ---------------------------------------------------------------------------
// Financial Reporting Agent
// ---------------------------------------------------------------------------

export interface FinancialReportingInput {
  userId: string;
  reportType: 'profit_and_loss' | 'balance_sheet' | 'cash_flow' | 'trial_balance';
  period: { start: string; end: string };
  comparisonPeriod?: { start: string; end: string };
}

export interface FinancialReportingOutput {
  reportData: Record<string, unknown>;
  kpis: Array<{ name: string; value: number; trend: string }>;
  summary: string;
}

// ---------------------------------------------------------------------------
// Budgeting Agent
// ---------------------------------------------------------------------------

export interface BudgetingInput {
  userId: string;
  action: 'create' | 'analyze' | 'forecast' | 'compare';
  budgetId?: string;
  period?: { start: string; end: string };
}

export interface BudgetingOutput {
  budget?: Record<string, unknown>;
  variance?: Array<{ category: string; budgeted: number; actual: number; variance: number }>;
  recommendations: string[];
  summary: string;
}

// ---------------------------------------------------------------------------
// Forecasting Agent
// ---------------------------------------------------------------------------

export interface ForecastingInput {
  userId: string;
  forecastType: 'cash_flow' | 'revenue' | 'expense' | 'scenario';
  horizonMonths: number;
  scenarioType?: string;
}

export interface ForecastingOutput {
  periods: Array<{
    period: string;
    predicted: number;
    confidenceLower: number;
    confidenceUpper: number;
  }>;
  accuracy: number;
  method: string;
  summary: string;
}

// ---------------------------------------------------------------------------
// Compliance Monitoring Agent
// ---------------------------------------------------------------------------

export interface ComplianceMonitoringInput {
  userId: string;
  checkType?: string;
  financialYear?: string;
  period?: string;
}

export interface ComplianceMonitoringOutput {
  obligations: Array<{
    type: string;
    dueDate: string;
    status: string;
    riskLevel: string;
  }>;
  riskScore: number;
  recommendations: string[];
  summary: string;
}

// ---------------------------------------------------------------------------
// CDR Product Agent
// ---------------------------------------------------------------------------

export interface CdrProductInput {
  query: string;
  productCategory?: string;
  loanAmount?: number;
  loanTermMonths?: number;
}

export interface CdrProductOutput {
  products: Array<{
    productId: string;
    name: string;
    brand: string;
    rate: number;
    comparison_rate?: number;
  }>;
  recommendations: string[];
  summary: string;
}

// ---------------------------------------------------------------------------
// Invoice Agent
// ---------------------------------------------------------------------------

export interface InvoiceAgentInput {
  userId: string;
  action:
    | 'create_invoice'
    | 'update_invoice'
    | 'generate_pdf'
    | 'send_invoice'
    | 'track_payment'
    | 'list_overdue'
    | 'search_customers'
    | 'general_query';
  invoiceId?: string;
  customerId?: string;
  lineItems?: Array<{
    description: string;
    quantity: number;
    unitPriceCents: number;
    gstApplicable?: boolean;
  }>;
  dueDate?: string;
  notes?: string;
  query?: string;
}

export interface InvoiceAgentOutput {
  invoice?: {
    id: string;
    invoiceNumber: string;
    customerId: string;
    customerName: string;
    subtotalCents: number;
    gstCents: number;
    totalCents: number;
    status: string;
    issueDate: string;
    dueDate: string;
  };
  pdfUrl?: string;
  overdueInvoices?: Array<{
    invoiceId: string;
    invoiceNumber: string;
    customerName: string;
    amountDueCents: number;
    daysPastDue: number;
  }>;
  customers?: Array<{
    id: string;
    businessName: string;
    outstandingCents: number;
  }>;
  summary: string;
}

// ---------------------------------------------------------------------------
// Accounts Payable Agent
// ---------------------------------------------------------------------------

export interface AccountsPayableInput {
  userId: string;
  action:
    | 'enter_bill'
    | 'create_po'
    | 'schedule_payment'
    | 'match_receipt'
    | 'aging_report'
    | 'approve_payment'
    | 'three_way_match';
  billId?: string;
  supplierId?: string;
  purchaseOrderId?: string;
  amount?: number;
  dueDate?: string;
  lineItems?: Array<{
    description: string;
    quantity: number;
    unitPriceCents: number;
    gstRate?: number;
  }>;
}

export interface AccountsPayableOutput {
  bill?: {
    id: string;
    supplierId: string;
    supplierName: string;
    totalCents: number;
    gstCents: number;
    dueDate: string;
    status: string;
    purchaseOrderId?: string;
  };
  purchaseOrder?: {
    id: string;
    poNumber: string;
    supplierId: string;
    supplierName: string;
    totalCents: number;
    status: string;
    linesReceived: number;
    linesTotal: number;
  };
  agingReport?: {
    current: { count: number; totalCents: number };
    days30: { count: number; totalCents: number };
    days60: { count: number; totalCents: number };
    days90Plus: { count: number; totalCents: number };
  };
  threeWayMatch?: {
    poNumber: string;
    billNumber: string;
    receiptDate: string;
    poTotalCents: number;
    receiptTotalCents: number;
    billTotalCents: number;
    discrepancies: string[];
    matchStatus: 'matched' | 'discrepancy' | 'partial';
  };
  paymentSchedule?: Array<{
    billId: string;
    supplierName: string;
    amountCents: number;
    scheduledDate: string;
  }>;
  summary: string;
}

// ---------------------------------------------------------------------------
// Streaming session types (Wave 21)
// ---------------------------------------------------------------------------

/** Represents a streaming session's public state. */
export interface StreamSession {
  id: string;
  agentType: AgentType;
  status: 'pending' | 'streaming' | 'completed' | 'errored' | 'cancelled';
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latencyMs?: number;
}

// ---------------------------------------------------------------------------
// Vercel AI SDK types
// ---------------------------------------------------------------------------

/** Wraps the output of a Vercel-based agent execution. */
export interface VercelAgentExecutionResult<T> {
  output: T;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latencyMs: number;
  framework: 'vercel' | 'legacy';
}
