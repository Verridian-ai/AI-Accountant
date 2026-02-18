/**
 * Cognee Cloud Dataset Definitions
 *
 * Defines all 39 datasets for GoldLedger knowledge graph.
 */

export interface DatasetDefinition {
  name: string;
  description: string;
  category: 'shared' | 'tenant' | 'dynamic';
  isPublic: boolean;
}

// ============================================================================
// SHARED KNOWLEDGE DATASETS (6 datasets)
// ============================================================================

export const SHARED_DATASETS: DatasetDefinition[] = [
  {
    name: 'gst_rules',
    description: 'ATO GST rulings, tax rules, and GST-free/input-taxed categories',
    category: 'shared',
    isPublic: true,
  },
  {
    name: 'ato_rulings',
    description: 'Australian Tax Office rulings, interpretations, and guidance',
    category: 'shared',
    isPublic: true,
  },
  {
    name: 'tax_tables',
    description: 'Tax brackets, offsets, Medicare levy rates, and HELP/HECS thresholds',
    category: 'shared',
    isPublic: true,
  },
  {
    name: 'deduction_patterns',
    description: 'Common tax deduction patterns and ATO substantiation requirements',
    category: 'shared',
    isPublic: true,
  },
  {
    name: 'award_rates',
    description: 'Award wage rates, penalty rates, and allowances for payroll',
    category: 'shared',
    isPublic: true,
  },
  {
    name: 'stp_compliance',
    description: 'Single Touch Payroll compliance rules and reporting requirements',
    category: 'shared',
    isPublic: true,
  },
];

// ============================================================================
// PER-TENANT FINANCIAL DATA DATASETS (33 datasets)
// ============================================================================

export const TENANT_DATASETS: DatasetDefinition[] = [
  // Core Banking & Transactions
  {
    name: 'bank_transactions',
    description: 'All financial transactions from bank statements',
    category: 'tenant',
    isPublic: false,
  },
  {
    name: 'bank_formats',
    description: 'Statement parser format definitions and column mappings',
    category: 'tenant',
    isPublic: false,
  },
  {
    name: 'merchant_mappings',
    description: 'Merchant name normalization and canonical name mappings',
    category: 'tenant',
    isPublic: false,
  },
  {
    name: 'merchant_corrections',
    description: 'User corrections to merchant categorization and GST classification',
    category: 'tenant',
    isPublic: false,
  },
  {
    name: 'transfer_patterns',
    description: 'Inter-account transfer detection patterns and rules',
    category: 'tenant',
    isPublic: false,
  },

  // Financial Reporting & Analysis
  {
    name: 'financial_reports',
    description: 'Generated financial reports, P&L, balance sheets',
    category: 'tenant',
    isPublic: false,
  },
  {
    name: 'budget_templates',
    description: 'Budget templates and forecasting models',
    category: 'tenant',
    isPublic: false,
  },
  {
    name: 'kpi_history',
    description: 'KPI metrics tracked over time',
    category: 'tenant',
    isPublic: false,
  },
  {
    name: 'forecast_patterns',
    description: 'Revenue and expense forecasting patterns',
    category: 'tenant',
    isPublic: false,
  },
  {
    name: 'anomaly_history',
    description: 'Detected financial anomalies and alerts',
    category: 'tenant',
    isPublic: false,
  },
  {
    name: 'compliance_rulings',
    description: 'Compliance check results and audit findings',
    category: 'tenant',
    isPublic: false,
  },
  {
    name: 'temporal_patterns',
    description: 'Time-based spending patterns and seasonality',
    category: 'tenant',
    isPublic: false,
  },

  // Intelligence & Insights
  {
    name: 'cross_module_insights',
    description: 'Cross-module intelligence and correlations',
    category: 'tenant',
    isPublic: false,
  },
  {
    name: 'module_relationships',
    description: 'Module connection metadata and dependencies',
    category: 'tenant',
    isPublic: false,
  },

  // Consumer Data Right (CDR)
  {
    name: 'cdr_products',
    description: 'Consumer Data Right product data from banks',
    category: 'tenant',
    isPublic: false,
  },
  {
    name: 'cdr_rates',
    description: 'CDR interest rates and fee schedules',
    category: 'tenant',
    isPublic: false,
  },
  {
    name: 'banking_product_knowledge',
    description: 'Banking product intelligence and comparisons',
    category: 'tenant',
    isPublic: false,
  },

  // Market Data
  {
    name: 'market_intelligence',
    description: 'Market analysis and industry benchmarks',
    category: 'tenant',
    isPublic: false,
  },
  {
    name: 'market_sentiment',
    description: 'Sentiment analysis of market conditions',
    category: 'tenant',
    isPublic: false,
  },
  {
    name: 'rba_statistics',
    description: 'Reserve Bank of Australia statistics and rates',
    category: 'tenant',
    isPublic: false,
  },
  {
    name: 'abs_statistics',
    description: 'Australian Bureau of Statistics economic data',
    category: 'tenant',
    isPublic: false,
  },
  {
    name: 'asx_market_data',
    description: 'ASX market data for investment tracking',
    category: 'tenant',
    isPublic: false,
  },

  // Inventory & Operations
  {
    name: 'inventory_catalog',
    description: 'Inventory items and stock management',
    category: 'tenant',
    isPublic: false,
  },
  {
    name: 'recon_patterns',
    description: 'Reconciliation patterns and matching rules',
    category: 'tenant',
    isPublic: false,
  },

  // OCR & Document Processing
  {
    name: 'ocr_extractions',
    description: 'OCR document extractions and parsed data',
    category: 'tenant',
    isPublic: false,
  },

  // Customers & Invoicing
  {
    name: 'customer_profiles',
    description: 'Customer profiles and contact information',
    category: 'tenant',
    isPublic: false,
  },
  {
    name: 'invoice_history',
    description: 'Invoice records and payment history',
    category: 'tenant',
    isPublic: false,
  },

  // Suppliers & Payables
  {
    name: 'supplier_profiles',
    description: 'Supplier profiles and payment terms',
    category: 'tenant',
    isPublic: false,
  },
  {
    name: 'bill_patterns',
    description: 'Bill payment patterns and schedules',
    category: 'tenant',
    isPublic: false,
  },

  // Payroll
  {
    name: 'employee_profiles',
    description: 'Employee profiles and employment details',
    category: 'tenant',
    isPublic: false,
  },
  {
    name: 'pay_structures',
    description: 'Payroll structures, rates, and allowances',
    category: 'tenant',
    isPublic: false,
  },

  // Feedback & Learning
  {
    name: 'search_feedback',
    description: 'User search feedback for memify enrichment',
    category: 'tenant',
    isPublic: false,
  },
];

// ============================================================================
// ALL DATASETS
// ============================================================================

export const ALL_DATASETS = [...SHARED_DATASETS, ...TENANT_DATASETS];

export function getDatasetByName(name: string): DatasetDefinition | undefined {
  return ALL_DATASETS.find((d) => d.name === name);
}

export function getSharedDatasets(): DatasetDefinition[] {
  return SHARED_DATASETS;
}

export function getTenantDatasets(): DatasetDefinition[] {
  return TENANT_DATASETS;
}

export function getDatasetNames(): string[] {
  return ALL_DATASETS.map((d) => d.name);
}
