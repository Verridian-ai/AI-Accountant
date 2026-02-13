# Agent 6: DataPoint Models Builder

## Role
Define 8 custom DataPoint models for financial entities and build an indexing pipeline that registers them with Cognee via the Wave 16 DataPoint service.

## Priority: SUB-WAVE 2 (After Agent 2 completes)

## Files to CREATE

### 1. `server/src/services/cognee/datapoint-models.ts`
**Purpose**: Define 8 domain-specific DataPoint schemas and an indexing pipeline
**Pattern**: Follow Wave 16's predefined DataPoints in `cognee-datapoints.ts`

```typescript
/**
 * Wave 3: Custom DataPoint Models for Financial Entity Extraction
 *
 * These DataPoint models define the schema for entities that Cognee extracts
 * during cognify operations. They tell Cognee what to look for in financial data.
 */

// 1. TransactionNode — individual financial transactions
export const TransactionNodeDataPoint = {
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

// 2. AccountNode — bank/business accounts
export const AccountNodeDataPoint = {
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

// 3. CategoryNode — transaction categories
export const CategoryNodeDataPoint = {
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

// 4. GSTRuleNode — GST rules and rulings
export const GSTRuleNodeDataPoint = {
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

// 5. PatternNode — spending/income patterns
export const PatternNodeDataPoint = {
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

// 6. BASPeriodNode — BAS reporting periods
export const BASPeriodNodeDataPoint = {
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

// 7. MerchantNode — merchant profiles
export const MerchantNodeDataPoint = {
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

// 8. DeductionNode — tax deductions
export const DeductionNodeDataPoint = {
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

// All DataPoint models as array
export const ALL_DATAPOINT_MODELS = [
  TransactionNodeDataPoint,
  AccountNodeDataPoint,
  CategoryNodeDataPoint,
  GSTRuleNodeDataPoint,
  PatternNodeDataPoint,
  BASPeriodNodeDataPoint,
  MerchantNodeDataPoint,
  DeductionNodeDataPoint,
];

/**
 * Register all 8 DataPoint models with Cognee via the DataPoint service
 * Should be called during user initialization (POST /api/cognee/init-user)
 */
export async function registerAllDataPoints(
  dataPointService: any, // CogneeDataPointService
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
```

## Files to MODIFY

### 2. `server/src/services/cognee-datapoints.ts`
**Purpose**: Extend Wave 16 DataPoint service with `createOrUpdateDataPoint` method and bulk registration
**CRITICAL**: Read the file first. It already has 3 predefined DataPoints. Do NOT remove them.

#### Step 1: Add createOrUpdateDataPoint method
```typescript
/**
 * Create or update a DataPoint config (Wave 3)
 * Upserts by (userId, name) — idempotent for re-registration
 */
async createOrUpdateDataPoint(config: {
  userId: string;
  name: string;
  description: string;
  fields: string; // JSON string of field definitions
  targetDataset: string;
}): Promise<void> {
  // Check if exists
  const existing = await this.getByName(config.userId, config.name);
  if (existing) {
    // Update
    await db.update(datapointConfigs)
      .set({ description: config.description, fields: config.fields, targetDataset: config.targetDataset })
      .where(eq(datapointConfigs.id, existing.id));
  } else {
    // Insert
    await db.insert(datapointConfigs).values({
      id: crypto.randomUUID(),
      userId: config.userId,
      name: config.name,
      description: config.description,
      schemaDefinition: config.fields,
      targetDataset: config.targetDataset,
      createdAt: new Date().toISOString(),
    });
  }
}
```

#### Step 2: Add bulk registration convenience method
```typescript
/**
 * Register all Wave 3 DataPoint models for a user (Wave 3)
 */
async registerWave3DataPoints(userId: string, datasetPrefix: string): Promise<number> {
  const { ALL_DATAPOINT_MODELS, registerAllDataPoints } = await import('./cognee/datapoint-models.js');
  await registerAllDataPoints(this, userId, datasetPrefix);
  return ALL_DATAPOINT_MODELS.length;
}
```

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `datapoint-models.ts` exports all 8 DataPoint definitions
- [ ] `ALL_DATAPOINT_MODELS` array has exactly 8 entries
- [ ] `registerAllDataPoints()` iterates and calls createOrUpdateDataPoint for each
- [ ] Existing 3 predefined DataPoints (FinancialTransaction, BusinessRelationship, TaxEvent) preserved
- [ ] Create marker file: `.agent-done-W03-06`

## Dependencies
- **Agent 2** must complete CogneeClient multi-user changes
- **Reuses**: Wave 16 `cognee-datapoints.ts` patterns, `datapoint_configs` table
