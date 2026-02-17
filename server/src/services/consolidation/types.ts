/**
 * Consolidation Types & Table Definitions
 *
 * All interfaces, type definitions, local table schemas,
 * and the category-to-line-type mapping for the consolidation module.
 */

import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// ============================================================================
// LOCAL TABLE DEFINITIONS
// (Mirrors schema.ts definitions added by Agent 1 -- will be replaced with
//  imports once schema.ts is updated)
// ============================================================================

export const entities = sqliteTable('entities', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  entityType: text('entity_type').notNull(),
  parentEntityId: text('parent_entity_id'),
  isConsolidatedParent: integer('is_consolidated_parent', { mode: 'boolean' }).default(false),
  financialYearEnd: text('financial_year_end').default('06-30'),
  status: text('status').default('active'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

export const entityAccounts = sqliteTable('entity_accounts', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull(),
  accountId: text('account_id').notNull(),
  role: text('role').notNull().default('operating'),
  ownershipPercentage: real('ownership_percentage').default(100.0),
});

export const interEntityTransactions = sqliteTable('inter_entity_transactions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  fromEntityId: text('from_entity_id').notNull(),
  toEntityId: text('to_entity_id').notNull(),
  amount: integer('amount').notNull(),
  description: text('description'),
  transactionDate: text('transaction_date').notNull(),
  transactionType: text('transaction_type').notNull(),
  status: text('status').default('pending'),
  confirmedByFrom: integer('confirmed_by_from', { mode: 'boolean' }).default(false),
  confirmedByTo: integer('confirmed_by_to', { mode: 'boolean' }).default(false),
  eliminationGroupId: text('elimination_group_id'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
});

export const consolidationRules = sqliteTable('consolidation_rules', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  parentEntityId: text('parent_entity_id').notNull(),
  ruleName: text('rule_name').notNull(),
  ruleType: text('rule_type').notNull(),
  description: text('description'),
  criteriaJson: text('criteria_json').notNull(),
  actionJson: text('action_json').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  priority: integer('priority').default(0),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

export const consolidationSnapshots = sqliteTable('consolidation_snapshots', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  parentEntityId: text('parent_entity_id').notNull(),
  financialYear: text('financial_year').notNull(),
  snapshotDate: text('snapshot_date').notNull(),
  status: text('status').default('draft'),
  totalRevenue: integer('total_revenue'),
  totalExpenses: integer('total_expenses'),
  totalAssets: integer('total_assets'),
  totalLiabilities: integer('total_liabilities'),
  totalEquity: integer('total_equity'),
  eliminationsApplied: integer('eliminations_applied').default(0),
  adjustmentsJson: text('adjustments_json'),
  notes: text('notes'),
  createdBy: text('created_by'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
});

export const consolidationSnapshotLines = sqliteTable('consolidation_snapshot_lines', {
  id: text('id').primaryKey(),
  snapshotId: text('snapshot_id').notNull(),
  entityId: text('entity_id').notNull(),
  lineType: text('line_type').notNull(),
  category: text('category').notNull(),
  description: text('description'),
  amount: integer('amount').notNull(),
  isElimination: integer('is_elimination', { mode: 'boolean' }).default(false),
  sourceRuleId: text('source_rule_id'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
});

export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  date: text('date').notNull(),
  description: text('description').notNull(),
  amount: integer('amount').notNull(),
  category: text('category'),
  accountId: text('account_id'),
  userId: text('user_id'),
});

// ============================================================================
// TYPES
// ============================================================================

export interface ConsolidationRule {
  id: string;
  userId: string;
  parentEntityId: string;
  ruleName: string;
  ruleType: 'elimination' | 'adjustment' | 'reclassification' | 'minority_interest';
  description: string | null;
  criteriaJson: string;
  actionJson: string;
  isActive: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConsolidationSnapshot {
  id: string;
  userId: string;
  parentEntityId: string;
  financialYear: string;
  snapshotDate: string;
  status: 'draft' | 'reviewed' | 'finalized';
  totalRevenue: number;
  totalExpenses: number;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  eliminationsApplied: number;
  adjustmentsJson: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface ConsolidationSnapshotLine {
  id: string;
  snapshotId: string;
  entityId: string;
  lineType: 'revenue' | 'expense' | 'asset' | 'liability' | 'equity' | 'elimination' | 'adjustment';
  category: string;
  description: string | null;
  amount: number;
  isElimination: boolean;
  sourceRuleId: string | null;
  createdAt: string;
}

export interface RuleCriteria {
  matchType:
    | 'inter_entity_revenue'
    | 'inter_entity_loan'
    | 'inter_entity_dividend'
    | 'category_match'
    | 'amount_threshold';
  matchEntities?: string[];
  matchCategories?: string[];
  amountThreshold?: number;
}

export interface RuleAction {
  actionType: 'eliminate' | 'adjust' | 'reclassify';
  targetCategory?: string;
  adjustmentPercent?: number;
}

// Category-to-line-type mapping for Australian chart of accounts
export const CATEGORY_LINE_TYPE_MAP: Record<string, ConsolidationSnapshotLine['lineType']> = {
  'Sales Revenue': 'revenue',
  'Service Revenue': 'revenue',
  'Interest Income': 'revenue',
  'Other Income': 'revenue',
  'Business Income': 'revenue',
  'Rental Income': 'revenue',
  'Export Revenue': 'revenue',
  'Cost of Goods Sold': 'expense',
  'Direct Labour': 'expense',
  'Freight Costs': 'expense',
  Materials: 'expense',
  'Advertising & Marketing': 'expense',
  'Bank Fees': 'expense',
  'Computer & IT': 'expense',
  Depreciation: 'expense',
  Entertainment: 'expense',
  Insurance: 'expense',
  'Interest Expense': 'expense',
  'Motor Vehicle Expenses': 'expense',
  'Office Supplies': 'expense',
  'Professional Fees': 'expense',
  Rent: 'expense',
  'Repairs & Maintenance': 'expense',
  Subscriptions: 'expense',
  'Telephone & Internet': 'expense',
  Travel: 'expense',
  Utilities: 'expense',
  'Wages & Salaries': 'expense',
  Superannuation: 'expense',
  'Work from Home Expenses': 'expense',
  Miscellaneous: 'expense',
  'General Expenses': 'expense',
  'Dining & Takeaway': 'expense',
  Groceries: 'expense',
  'Medical & Health': 'expense',
  Fuel: 'expense',
  'Clothing & Personal': 'expense',
  Education: 'expense',
  'Pet Care': 'expense',
  'Charity & Donations': 'expense',
  'Home & Garden': 'expense',
  Tax: 'expense',
  'Tax Payments': 'expense',
  'Software & Subscriptions': 'expense',
  'Travel & Accommodation': 'expense',
};

export function getLineTypeForCategory(category: string): ConsolidationSnapshotLine['lineType'] {
  return CATEGORY_LINE_TYPE_MAP[category] ?? 'expense';
}
