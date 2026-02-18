/**
 * Data Classification Registry
 *
 * Classifies every Cognee dataset as PUBLIC or PRIVATE to determine
 * whether data must flow through the masked Neon AI branch before
 * reaching a cloud LLM, or can be sent freely.
 *
 * PUBLIC  = published domain knowledge (ATO rulings, GST rules, CDR rates)
 * PRIVATE = client-specific financial data (transactions, merchants, accounts)
 */

// ---------------------------------------------------------------------------
// Classification enum
// ---------------------------------------------------------------------------

export const DataClassification = {
  PUBLIC: 'public',
  PRIVATE: 'private',
} as const;

export type DataClassificationType = (typeof DataClassification)[keyof typeof DataClassification];

// ---------------------------------------------------------------------------
// Dataset → classification mapping
// ---------------------------------------------------------------------------

export const DATASET_CLASSIFICATION: Record<string, DataClassificationType> = {
  // PUBLIC — flows freely to LLMs, no masking required
  tax_rulings: DataClassification.PUBLIC,
  gst_rules: DataClassification.PUBLIC,
  ato_rulings: DataClassification.PUBLIC,
  deduction_patterns: DataClassification.PUBLIC,
  cdr_products: DataClassification.PUBLIC,
  cdr_rates: DataClassification.PUBLIC,
  banking_product_knowledge: DataClassification.PUBLIC,
  compliance_rulings: DataClassification.PUBLIC,

  // PRIVATE — must use masked Neon AI branch
  bank_transactions: DataClassification.PRIVATE,
  merchant_data: DataClassification.PRIVATE,
  financial_insights: DataClassification.PRIVATE,
  forecast_patterns: DataClassification.PRIVATE,
  transaction_patterns: DataClassification.PRIVATE,
  merchant_mappings: DataClassification.PRIVATE,
  anomaly_history: DataClassification.PRIVATE,
  ocr_extractions: DataClassification.PRIVATE,
  matching_patterns: DataClassification.PRIVATE,
  temporal_patterns: DataClassification.PRIVATE,
  cross_module_insights: DataClassification.PRIVATE,
  module_relationships: DataClassification.PRIVATE,
  kpi_history: DataClassification.PRIVATE,
  budget_templates: DataClassification.PRIVATE,
  financial_reports: DataClassification.PRIVATE,
};

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

/** Returns true if the dataset contains only public-domain knowledge. */
export function isPublicDataset(datasetName: string): boolean {
  return DATASET_CLASSIFICATION[datasetName] === DataClassification.PUBLIC;
}

/** Returns true if the dataset contains client-specific PII/financial data. */
export function isPrivateDataset(datasetName: string): boolean {
  return DATASET_CLASSIFICATION[datasetName] === DataClassification.PRIVATE;
}

/**
 * Returns true if data from this dataset must go through the masked Neon AI
 * branch before being sent to a cloud LLM.  Unknown datasets default to
 * requiring masking (safe default).
 */
export function requiresMasking(datasetName: string): boolean {
  return !isPublicDataset(datasetName);
}

/**
 * Determines which data source should be queried for a given dataset.
 *
 * - `'public_docs'`    — public knowledge, no DB query needed (Cognee only)
 * - `'neon_masked'`    — private data via the deterministically masked AI branch
 * - `'neon_production'` — real data (only for user-facing endpoints + aggregate tool)
 */
export function getDataSource(
  datasetName: string,
): 'neon_production' | 'neon_masked' | 'public_docs' {
  if (isPublicDataset(datasetName)) return 'public_docs';
  return 'neon_masked';
}
