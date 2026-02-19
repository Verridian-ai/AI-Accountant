import { pgTable, text, integer, boolean, doublePrecision } from 'drizzle-orm/pg-core';
import { users } from './core.js';
import { transactions } from './transactions.js';

// IMPORTANT — CURRENT_TIMESTAMP in PostgreSQL:
// The wrapPgDb() proxy stores the literal string 'CURRENT_TIMESTAMP' in PostgreSQL
// instead of evaluating it. All inserts MUST set timestamp fields explicitly:
//   createdAt: new Date().toISOString()   (see repositories/*.ts)

// ============================================================================
// BUSINESS PROFILES
// ============================================================================

export const businessProfiles = pgTable('business_profiles', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  businessName: text('business_name').notNull(),
  abn: text('abn'),
  entityType: text('entity_type').notNull().default('sole_trader'),
  industry: text('industry'),
  basFrequency: text('bas_frequency').default('quarterly'),
  gstRegistered: boolean('gst_registered').default(false),
  financialYearEnd: text('financial_year_end').default('06-30'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ============================================================================
// TAX & BAS
// ============================================================================

export const basPeriods = pgTable('bas_periods', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  financialYear: text('financial_year').notNull(),
  quarter: integer('quarter').notNull(),
  periodType: text('period_type').notNull().default('quarterly'),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  dueDate: text('due_date'),
  lodgementDue: text('lodgement_due'),
  lodgementDate: text('lodgement_date'),
  accountingMethod: text('accounting_method').notNull().default('cash'),
  status: text('status').notNull().default('draft'),
  lodgedAt: text('lodged_at'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const basCalculations = pgTable('bas_calculations', {
  id: text('id').primaryKey(),
  basPeriodId: text('bas_period_id')
    .notNull()
    .references(() => basPeriods.id, { onDelete: 'cascade' }),
  periodId: text('period_id').references(() => basPeriods.id, { onDelete: 'cascade' }),
  label: text('label'),
  value: integer('value').default(0),
  labelG1: integer('label_g1').default(0),
  labelG2: integer('label_g2').default(0),
  labelG3: integer('label_g3').default(0),
  labelG10: integer('label_g10').default(0),
  labelG11: integer('label_g11').default(0),
  label1A: integer('label_1a').default(0),
  label1B: integer('label_1b').default(0),
  labelW1: integer('label_w1').default(0),
  labelW2: integer('label_w2').default(0),
  label5A: integer('label_5a').default(0),
  label7C: integer('label_7c').default(0),
  label7D: integer('label_7d').default(0),
  amountOwing: integer('amount_owing').default(0),
  refundDue: integer('refund_due').default(0),
  calculatedAt: text('calculated_at').notNull().default('CURRENT_TIMESTAMP'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const taxCodes = pgTable('tax_codes', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  description: text('description').notNull(),
  rate: doublePrecision('rate').notNull(),
  isActive: boolean('is_active').default(true),
});

export const taxBrackets = pgTable('tax_brackets', {
  id: text('id').primaryKey(),
  taxYear: text('tax_year').notNull(),
  financialYear: text('financial_year'),
  minIncome: integer('min_income').notNull(),
  maxIncome: integer('max_income'),
  baseTax: integer('base_tax').notNull().default(0),
  rate: doublePrecision('rate').notNull(),
});

export const deductions = pgTable('deductions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  taxYear: text('tax_year').notNull(),
  financialYear: text('financial_year'),
  category: text('category').notNull(),
  subcategory: text('subcategory'),
  calculationMethod: text('calculation_method'),
  description: text('description').notNull(),
  amount: integer('amount').notNull(),
  transactionId: text('transaction_id').references(() => transactions.id),
  isVerified: boolean('is_verified').default(false),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const cgtAssets = pgTable('cgt_assets', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  assetName: text('asset_name').notNull(),
  assetType: text('asset_type').notNull(),
  quantity: doublePrecision('quantity').default(1),
  unitCost: integer('unit_cost'),
  acquisitionDate: text('acquisition_date').notNull(),
  acquisitionCost: integer('acquisition_cost').notNull(),
  acquisitionCostsIncidental: integer('acquisition_costs_incidental').default(0),
  improvementsCost: integer('improvements_cost').default(0),
  status: text('status').notNull().default('held'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const cgtEvents = pgTable('cgt_events', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  assetId: text('asset_id')
    .notNull()
    .references(() => cgtAssets.id, { onDelete: 'cascade' }),
  taxYear: text('tax_year').notNull(),
  eventType: text('event_type').notNull(),
  eventDate: text('event_date').notNull(),
  disposalDate: text('disposal_date'),
  disposalProceeds: integer('disposal_proceeds'),
  proceeds: integer('proceeds'),
  costBase: integer('cost_base'),
  capitalGainLoss: integer('capital_gain_loss'),
  capitalGainGross: integer('capital_gain_gross'),
  capitalGainNet: integer('capital_gain_net'),
  capitalLoss: integer('capital_loss'),
  discountApplied: boolean('discount_applied').default(false),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const depreciableAssets = pgTable('depreciable_assets', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  assetName: text('asset_name').notNull(),
  assetCategory: text('asset_category').notNull(),
  purchaseDate: text('purchase_date').notNull(),
  purchaseCost: integer('purchase_cost').notNull(),
  effectiveLife: integer('effective_life').notNull(),
  effectiveLifeYears: integer('effective_life_years'),
  depreciationMethod: text('depreciation_method').notNull().default('diminishing'),
  openingValue: integer('opening_value').notNull(),
  openingWrittenDownValue: integer('opening_written_down_value'),
  currentValue: integer('current_value').notNull(),
  currentWrittenDownValue: integer('current_written_down_value'),
  businessUsePercentage: doublePrecision('business_use_percentage').default(100),
  isInstantWriteOff: boolean('is_instant_write_off').default(false),
  isActive: boolean('is_active').default(true),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const depreciationSchedule = pgTable('depreciation_schedule', {
  id: text('id').primaryKey(),
  assetId: text('asset_id')
    .notNull()
    .references(() => depreciableAssets.id, { onDelete: 'cascade' }),
  financialYear: text('financial_year').notNull(),
  openingValue: integer('opening_value').notNull(),
  depreciationAmount: integer('depreciation_amount').notNull(),
  closingValue: integer('closing_value').notNull(),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const taxYearSummary = pgTable('tax_year_summary', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  taxYear: text('tax_year').notNull(),
  financialYear: text('financial_year'),
  grossIncome: integer('gross_income').default(0),
  totalDeductions: integer('total_deductions').default(0),
  taxableIncome: integer('taxable_income').default(0),
  taxPayable: integer('tax_payable').default(0),
  medicareLevy: integer('medicare_levy').default(0),
  taxOffsets: integer('tax_offsets').default(0),
  netTax: integer('net_tax').default(0),
  calculatedAt: text('calculated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ============================================================================
// TAX OFFSETS & CAPITAL LOSSES
// ============================================================================

export const taxOffsets = pgTable('tax_offsets', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  taxYear: text('tax_year').notNull(),
  offsetType: text('offset_type').notNull(),
  amount: integer('amount').notNull(),
  description: text('description'),
  createdAt: text('created_at').notNull(),
});

export const capitalLosses = pgTable('capital_losses', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  taxYear: text('tax_year').notNull(),
  assetDescription: text('asset_description').notNull(),
  acquisitionDate: text('acquisition_date'),
  disposalDate: text('disposal_date'),
  lossAmount: integer('loss_amount').notNull(),
  appliedAmount: integer('applied_amount'),
  carriedForward: boolean('carried_forward'),
  createdAt: text('created_at').notNull(),
});

// Type exports
export type BusinessProfile = typeof businessProfiles.$inferSelect;
export type BasPeriod = typeof basPeriods.$inferSelect;
export type BasCalculation = typeof basCalculations.$inferSelect;
export type TaxCode = typeof taxCodes.$inferSelect;
export type TaxBracket = typeof taxBrackets.$inferSelect;
export type Deduction = typeof deductions.$inferSelect;
export type CgtAsset = typeof cgtAssets.$inferSelect;
export type CgtEvent = typeof cgtEvents.$inferSelect;
export type DepreciableAsset = typeof depreciableAssets.$inferSelect;
export type DepreciationScheduleRecord = typeof depreciationSchedule.$inferSelect;
export type TaxYearSummaryRecord = typeof taxYearSummary.$inferSelect;
export type TaxOffset = typeof taxOffsets.$inferSelect;
export type NewTaxOffset = typeof taxOffsets.$inferInsert;
export type CapitalLoss = typeof capitalLosses.$inferSelect;
export type NewCapitalLoss = typeof capitalLosses.$inferInsert;
