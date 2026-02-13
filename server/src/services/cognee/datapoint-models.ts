/**
 * Wave 3: Custom DataPoint Models for Financial Entity Extraction
 *
 * These DataPoint models define the schema for entities that Cognee extracts
 * during cognify operations. They tell Cognee what to look for in financial data.
 *
 * 8 domain-specific models covering:
 *   1. TransactionNode — individual financial transactions
 *   2. AccountNode — bank/business accounts
 *   3. CategoryNode — transaction categories with tax properties
 *   4. GSTRuleNode — GST rules and ATO rulings
 *   5. PatternNode — spending/income patterns
 *   6. BASPeriodNode — BAS reporting periods
 *   7. MerchantNode — merchant profiles
 *   8. DeductionNode — tax deductions
 */

// ============================================================================
// DataPoint Model Type
// ============================================================================

export interface DataPointModelField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date';
  description: string;
}

export interface DataPointModel {
  name: string;
  description: string;
  fields: DataPointModelField[];
  target_dataset: string;
}

// ============================================================================
// 1. TransactionNode — individual financial transactions
// ============================================================================

export const TransactionNodeDataPoint: DataPointModel = {
  name: 'TransactionNode',
  description: 'A financial transaction from a bank statement or ledger',
  fields: [
    { name: 'amount', type: 'number', description: 'Transaction amount in cents' },
    { name: 'merchant', type: 'string', description: 'Merchant or payee name' },
    { name: 'category', type: 'string', description: 'Transaction category' },
    { name: 'date', type: 'string', description: 'Transaction date (ISO 8601)' },
    { name: 'gst_amount', type: 'number', description: 'GST component in cents' },
    { name: 'account_id', type: 'string', description: 'Account identifier' },
    { name: 'is_debit', type: 'boolean', description: 'Whether this is a debit transaction' },
  ],
  target_dataset: 'bank_transactions',
};

// ============================================================================
// 2. AccountNode — bank/business accounts
// ============================================================================

export const AccountNodeDataPoint: DataPointModel = {
  name: 'AccountNode',
  description: 'A bank or business account',
  fields: [
    { name: 'account_number', type: 'string', description: 'Account number (masked)' },
    { name: 'account_type', type: 'string', description: 'Account type (savings, business, credit)' },
    { name: 'balance', type: 'number', description: 'Current balance in cents' },
    { name: 'bank_name', type: 'string', description: 'Bank name' },
    { name: 'bsb', type: 'string', description: 'BSB number' },
  ],
  target_dataset: 'financial_insights',
};

// ============================================================================
// 3. CategoryNode — transaction categories
// ============================================================================

export const CategoryNodeDataPoint: DataPointModel = {
  name: 'CategoryNode',
  description: 'A transaction category with tax properties',
  fields: [
    { name: 'name', type: 'string', description: 'Category name' },
    { name: 'parent', type: 'string', description: 'Parent category' },
    { name: 'tax_deductible', type: 'boolean', description: 'Whether expenses in this category are tax deductible' },
    { name: 'gst_applicable', type: 'boolean', description: 'Whether GST applies to this category' },
    { name: 'category_type', type: 'string', description: 'income, expense, or transfer' },
  ],
  target_dataset: 'financial_insights',
};

// ============================================================================
// 4. GSTRuleNode — GST rules and rulings
// ============================================================================

export const GSTRuleNodeDataPoint: DataPointModel = {
  name: 'GSTRuleNode',
  description: 'An Australian GST rule or ATO ruling',
  fields: [
    { name: 'rule_type', type: 'string', description: 'Rule type (input_taxed, gst_free, standard, export)' },
    { name: 'rate', type: 'number', description: 'GST rate (0.0 or 0.1)' },
    { name: 'description', type: 'string', description: 'Rule description' },
    { name: 'ato_reference', type: 'string', description: 'ATO ruling reference number' },
    { name: 'applies_to', type: 'string', description: 'Category or transaction types this rule applies to' },
  ],
  target_dataset: 'tax_rulings',
};

// ============================================================================
// 5. PatternNode — spending/income patterns
// ============================================================================

export const PatternNodeDataPoint: DataPointModel = {
  name: 'PatternNode',
  description: 'A detected financial pattern or trend',
  fields: [
    { name: 'pattern_type', type: 'string', description: 'Type: recurring, seasonal, anomaly, trend' },
    { name: 'frequency', type: 'string', description: 'Frequency: daily, weekly, monthly, quarterly, annual' },
    { name: 'amount_range_min', type: 'number', description: 'Minimum amount in cents' },
    { name: 'amount_range_max', type: 'number', description: 'Maximum amount in cents' },
    { name: 'entities', type: 'string', description: 'Related merchants/categories (comma-separated)' },
    { name: 'confidence', type: 'number', description: 'Detection confidence 0.0-1.0' },
  ],
  target_dataset: 'transaction_patterns',
};

// ============================================================================
// 6. BASPeriodNode — BAS reporting periods
// ============================================================================

export const BASPeriodNodeDataPoint: DataPointModel = {
  name: 'BASPeriodNode',
  description: 'A BAS reporting period with GST calculations',
  fields: [
    { name: 'quarter', type: 'string', description: 'BAS quarter (Q1-Q4)' },
    { name: 'financial_year', type: 'string', description: 'Financial year (e.g. 2025-26)' },
    { name: 'gst_collected', type: 'number', description: 'GST collected (G1) in cents' },
    { name: 'gst_paid', type: 'number', description: 'GST paid on purchases in cents' },
    { name: 'net_gst', type: 'number', description: 'Net GST payable/refundable in cents' },
    { name: 'total_sales', type: 'number', description: 'Total sales in cents' },
  ],
  target_dataset: 'financial_insights',
};

// ============================================================================
// 7. MerchantNode — merchant profiles
// ============================================================================

export const MerchantNodeDataPoint: DataPointModel = {
  name: 'MerchantNode',
  description: 'A merchant or vendor profile',
  fields: [
    { name: 'name', type: 'string', description: 'Merchant name (normalized)' },
    { name: 'abn', type: 'string', description: 'Australian Business Number' },
    { name: 'category', type: 'string', description: 'Primary category' },
    { name: 'avg_amount', type: 'number', description: 'Average transaction amount in cents' },
    { name: 'frequency', type: 'string', description: 'Transaction frequency (weekly, monthly, etc.)' },
    { name: 'total_spend', type: 'number', description: 'Total lifetime spend in cents' },
  ],
  target_dataset: 'merchant_data',
};

// ============================================================================
// 8. DeductionNode — tax deductions
// ============================================================================

export const DeductionNodeDataPoint: DataPointModel = {
  name: 'DeductionNode',
  description: 'A tax deduction claim',
  fields: [
    { name: 'type', type: 'string', description: 'Deduction type (work-related, self-education, home-office, etc.)' },
    { name: 'category', type: 'string', description: 'ATO deduction category (D1-D15)' },
    { name: 'amount', type: 'number', description: 'Deduction amount in cents' },
    { name: 'tax_year', type: 'string', description: 'Financial year' },
    { name: 'ato_ruling', type: 'string', description: 'Relevant ATO ruling' },
    { name: 'substantiation', type: 'string', description: 'Evidence type (receipt, logbook, etc.)' },
  ],
  target_dataset: 'deduction_patterns',
};

// ============================================================================
// All Models Array
// ============================================================================

export const ALL_DATAPOINT_MODELS: DataPointModel[] = [
  TransactionNodeDataPoint,
  AccountNodeDataPoint,
  CategoryNodeDataPoint,
  GSTRuleNodeDataPoint,
  PatternNodeDataPoint,
  BASPeriodNodeDataPoint,
  MerchantNodeDataPoint,
  DeductionNodeDataPoint,
];

// ============================================================================
// Registration Pipeline
// ============================================================================

/**
 * Register all 8 DataPoint models with Cognee via the DataPoint service.
 * Should be called during user initialization (POST /api/cognee/init-user).
 *
 * Uses createOrUpdateDataPoint for idempotent upsert — safe to call multiple times.
 */
export async function registerAllDataPoints(
  dataPointService: { createOrUpdateDataPoint: (config: {
    userId: string;
    name: string;
    description: string;
    fields: string;
    targetDataset: string;
  }) => Promise<void> },
  userId: string,
  datasetPrefix: string
): Promise<void> {
  for (const model of ALL_DATAPOINT_MODELS) {
    const prefixedDataset = datasetPrefix
      ? `${datasetPrefix}_${model.target_dataset}`
      : model.target_dataset;

    await dataPointService.createOrUpdateDataPoint({
      userId,
      name: model.name,
      description: model.description,
      fields: JSON.stringify(model.fields),
      targetDataset: prefixedDataset,
    });
  }
}
