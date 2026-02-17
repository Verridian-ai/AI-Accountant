/**
 * Cognee Tools — Types & Constants
 *
 * Tool-specific types, AP data interfaces, dataset constants,
 * shared/row-filtered dataset sets, and default configuration.
 */

// Wave 3: Shared reference datasets — never per-user prefixed.
// These contain global data (ATO rules, GST tables) shared across all users.
export const SHARED_DATASETS = new Set([
  'gst_rules',
  'ato_rulings',
  'award_rates',
  'stp_compliance',
  'tax_tables',
  'deduction_patterns',
]);

// Wave 3: Row-filtered datasets — no prefix, use user_id metadata filtering.
// Multiple users contribute to the same dataset; filtering happens at query time.
export const ROW_FILTERED_DATASETS = new Set(['merchant_data', 'matching_patterns']);

// ── AP Data Interfaces (Wave 10) ────────────────────────────────────
export interface SupplierProfileData {
  businessName: string;
  abn?: string;
  contactName?: string;
  email?: string;
  paymentTermsDays: number;
  typicalCategories: string[];
  averageSpendCents: number;
  paymentReliability: string; // 'excellent' | 'good' | 'fair' | 'poor'
}

export interface BillPatternData {
  supplierName: string;
  billNumber: string;
  totalAmountCents: number;
  gstAmountCents: number;
  lineItems: Array<{ description: string; amountCents: number }>;
  issueDate: string;
  dueDate: string;
  paidDate?: string;
  daysToPay?: number;
}

export interface POHistoryData {
  poNumber: string;
  supplierName: string;
  totalAmountCents: number;
  lineItems: Array<{ description: string; quantity: number; unitPriceCents: number }>;
  receivedDate?: string;
  matchedBillNumber?: string;
  matchStatus?: string;
}

export interface CogneeToolConfig {
  searchTopK: number;
  indexBatchSize: number;
  datasetPrefix: string;
  userId?: string; // Wave 3: user context for per-user isolation
  tenantId?: string; // Wave 23: tenant context for multi-tenant isolation
}

export const DEFAULT_CONFIG: CogneeToolConfig = {
  searchTopK: 5,
  indexBatchSize: 50,
  datasetPrefix: '',
};

/**
 * Named dataset constants used across agents and indexers.
 * Provides a typed, single source of truth for dataset name strings.
 */
export const COGNEE_DATASETS = {
  // Core transaction datasets
  bankTransactions: 'bank_transactions',
  bankFormats: 'bank_formats',
  merchantMappings: 'merchant_mappings',
  merchantCorrections: 'merchant_corrections',
  transferPatterns: 'transfer_patterns',
  searchFeedback: 'search_feedback',

  // GST & tax reference (shared — never per-user prefixed)
  gstRules: 'gst_rules',
  atoRulings: 'ato_rulings',
  taxTables: 'tax_tables',
  deductionPatterns: 'deduction_patterns',

  // Payroll reference (shared)
  awardRates: 'award_rates',
  stpCompliance: 'stp_compliance',

  // Row-filtered (shared mutable)
  merchantData: 'merchant_data',
  matchingPatterns: 'matching_patterns',

  // Financial reporting & budgets
  financialReports: 'financial_reports',
  budgetTemplates: 'budget_templates',
  kpiHistory: 'kpi_history',

  // Forecasting & compliance
  forecastPatterns: 'forecast_patterns',
  anomalyHistory: 'anomaly_history',
  complianceRulings: 'compliance_rulings',

  // Knowledge graph
  temporalPatterns: 'temporal_patterns',
  crossModuleInsights: 'cross_module_insights',
  moduleRelationships: 'module_relationships',

  // CDR / banking products
  cdrProducts: 'cdr_products',
  cdrRates: 'cdr_rates',
  bankingProductKnowledge: 'banking_product_knowledge',

  // Market intelligence
  marketIntelligence: 'market_intelligence',
  marketSentiment: 'market_sentiment',
  rbaStatistics: 'rba_statistics',
  absStatistics: 'abs_statistics',
  asxMarketData: 'asx_market_data',

  // Inventory & reconciliation
  inventoryCatalog: 'inventory_catalog',
  reconPatterns: 'recon_patterns',

  // OCR & document processing
  ocrExtractions: 'ocr_extractions',

  // Invoicing domain (Wave 7)
  customerProfiles: 'customer_profiles',
  invoiceHistory: 'invoice_history',

  // Accounts payable (Wave 10)
  supplierProfiles: 'supplier_profiles',
  billPatterns: 'bill_patterns',

  // Wave 4: Payroll datasets
  employeeProfiles: 'employee_profiles',
  payStructures: 'pay_structures',

  // DataPoint & ontology prefixed datasets
  datapointPrefix: 'datapoint_',
  ontologyPrefix: 'ontology_',
} as const;
