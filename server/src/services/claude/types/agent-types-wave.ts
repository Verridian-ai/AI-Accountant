/**
 * Claude Agent Framework — Wave Agent I/O Contract Types
 *
 * Later-wave agent types: MultiEntity, FinancialReporting,
 * Budgeting, Forecasting, ComplianceMonitoring, CdrProduct,
 * InvoiceAgent, AccountsPayable.
 */

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
