/**
 * Constants for CogneeTools: dataset names, shared dataset sets, config defaults.
 *
 * Extracted from cognee-tools.ts to comply with the 300-line enterprise standard.
 */

import type { CogneeToolConfig } from './cognee-tools-types.js';

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
