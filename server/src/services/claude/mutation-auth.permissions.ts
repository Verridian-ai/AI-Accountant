/**
 * Mutation Auth — Permission Matrix & Auto-Execute Rules
 *
 * Defines which agents can propose mutations to which tables,
 * and the conditions under which mutations can auto-execute.
 */

import type { AgentType } from './types.js';

/** Table-level permission for an agent. */
export interface TablePermission {
  read: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
}

/** Auto-execution rule — when can a mutation skip user confirmation? */
export interface AutoExecuteRule {
  agentType: AgentType;
  mutationType: string;
  targetTable: string;
  minConfidence: number;
}

/**
 * Agent -> Table permission matrix.
 *
 * DENY-BY-DEFAULT: Any agent NOT listed here is automatically denied all mutations.
 * Any agent listed here is denied for tables NOT in their entry.
 * Any agent listed for a table is denied for operations not explicitly set to `true`.
 *
 * This is enforced in MutationAuthService.canPropose() — callers never need to add
 * their own fallback; an absent entry is always treated as denied.
 *
 * When adding a new agent, you MUST add an explicit entry here even if the agent is
 * read-only (use all-false permissions). Do NOT add a generic catch-all.
 */
export const PERMISSION_MATRIX: Record<string, Record<string, TablePermission>> = {
  // ── Categorization agents ──
  transaction_categorizer: {
    transactions: { read: true, create: false, update: true, delete: false },
    merchant_memory: { read: true, create: true, update: true, delete: false },
    pending_categorization: { read: true, create: true, update: true, delete: true },
  },

  // ── GST agent ──
  gst_calculator: {
    transactions: { read: true, create: false, update: true, delete: false },
    bas_calculations: { read: true, create: true, update: true, delete: false },
    bas_periods: { read: true, create: true, update: true, delete: false },
  },

  // ── Statement parser ──
  statement_parser: {
    transactions: { read: true, create: true, update: false, delete: false },
    statements: { read: true, create: false, update: true, delete: false },
    accounts: { read: true, create: true, update: true, delete: false },
  },

  // ── Reconciliation ──
  account_reconciler: {
    transactions: { read: true, create: false, update: true, delete: false },
    reconciliation_alerts: { read: true, create: true, update: true, delete: false },
    transfer_links: { read: true, create: true, update: false, delete: false },
  },

  // ── Cross-account tracer ──
  cross_account_tracer: {
    transfer_links: { read: true, create: true, update: true, delete: false },
    transactions: { read: true, create: false, update: true, delete: false },
  },

  // ── Merchant intelligence ──
  merchant_intelligence: {
    merchant_memory: { read: true, create: true, update: true, delete: false },
    transactions: { read: true, create: false, update: true, delete: false },
  },

  // ── Budget analyzer (read-only) ──
  budget_analyzer: {
    transactions: { read: true, create: false, update: false, delete: false },
  },

  // ── Payroll ──
  payroll_agent: {
    wage_payments: { read: true, create: true, update: true, delete: false },
    transactions: { read: true, create: false, update: true, delete: false },
  },

  // ── Tax strategy ──
  tax_strategy: {
    tax_strategies: { read: true, create: true, update: true, delete: false },
    deductions: { read: true, create: true, update: true, delete: false },
  },

  // ── Personal tax claims ──
  personal_tax_claims: {
    deductions: { read: true, create: true, update: true, delete: false },
    transactions: { read: true, create: false, update: true, delete: false },
  },

  // ── Financial planner (read-only) ──
  financial_planner: {
    transactions: { read: true, create: false, update: false, delete: false },
  },

  // ── Financial reporting ──
  financial_reporting: {
    report_snapshots: { read: true, create: true, update: false, delete: false },
    kpi_metrics: { read: true, create: true, update: true, delete: false },
  },

  // ── Budgeting ──
  budgeting: {
    budgets: { read: true, create: true, update: true, delete: false },
    budget_lines: { read: true, create: true, update: true, delete: true },
    budget_vs_actual: { read: true, create: true, update: true, delete: false },
  },

  // ── Forecasting ──
  forecasting: {
    forecast_scenarios: { read: true, create: true, update: true, delete: false },
    forecast_periods: { read: true, create: true, update: true, delete: false },
  },

  // ── Compliance monitoring (read-only) ──
  compliance_monitoring: {
    transactions: { read: true, create: false, update: false, delete: false },
  },

  // ── OCR Processing ──
  ocr_processing: {
    ocr_documents: { read: true, create: true, update: true, delete: false },
    ocr_line_items: { read: true, create: true, update: true, delete: true },
  },

  // ── Payment matching ──
  payment_matching: {
    payment_matches: { read: true, create: true, update: true, delete: false },
    payment_match_rules: { read: true, create: true, update: true, delete: false },
  },

  // ── Inventory ──
  inventory_agent: {
    inventory_items: { read: true, create: true, update: true, delete: false },
    inventory_stock: { read: true, create: true, update: true, delete: false },
    inventory_movements: { read: true, create: true, update: false, delete: false },
  },

  // ── Bank reconciler ──
  bank_reconciler_agent: {
    bank_recon_matches: { read: true, create: true, update: true, delete: false },
    bank_recon_rules: { read: true, create: true, update: true, delete: false },
    bank_recon_sessions: { read: true, create: true, update: true, delete: false },
  },

  // ── Asset management ──
  asset_management: {
    fixed_assets: { read: true, create: true, update: true, delete: false },
    asset_depreciation: { read: true, create: true, update: true, delete: false },
    asset_disposals: { read: true, create: true, update: false, delete: false },
  },

  // ── Multi-entity ──
  multi_entity: {
    inter_entity_transactions: { read: true, create: true, update: true, delete: false },
    consolidation_snapshots: { read: true, create: true, update: false, delete: false },
    consolidation_snapshot_lines: { read: true, create: true, update: false, delete: false },
  },

  // ── CDR Product (read-only — external data) ──
  // Intentionally empty: CDR products come from external APIs. The agent reads
  // external rate data and never writes to the local database. Any mutation
  // attempt by cdr_product will be denied by MutationAuthService.canPropose().
  cdr_product: {},
};

/**
 * Specific scenarios where mutations can auto-execute.
 * These are intentionally conservative — financial safety matters.
 */
export const AUTO_EXECUTE_RULES: AutoExecuteRule[] = [
  // Transaction categorization with high confidence
  {
    agentType: 'transaction_categorizer' as AgentType,
    mutationType: 'update',
    targetTable: 'transactions',
    minConfidence: 0.9,
  },
  // Merchant memory updates (learning from user corrections)
  {
    agentType: 'merchant_intelligence' as AgentType,
    mutationType: 'create',
    targetTable: 'merchant_memory',
    minConfidence: 0.85,
  },
  {
    agentType: 'merchant_intelligence' as AgentType,
    mutationType: 'update',
    targetTable: 'merchant_memory',
    minConfidence: 0.85,
  },
  // Transfer link detection with high confidence
  {
    agentType: 'cross_account_tracer' as AgentType,
    mutationType: 'create',
    targetTable: 'transfer_links',
    minConfidence: 0.95,
  },
  // Batch categorization updates
  {
    agentType: 'transaction_categorizer' as AgentType,
    mutationType: 'batch_update',
    targetTable: 'transactions',
    minConfidence: 0.9,
  },
];

/**
 * Financial-sensitive tables where mutations ALWAYS require confirmation.
 * Even if an auto-execute rule exists, financial tables override it.
 */
export const FINANCIAL_TABLES = new Set([
  'bas_calculations',
  'bas_periods',
  'tax_year_summary',
  'deductions',
  'cgt_assets',
  'cgt_events',
  'tax_offsets',
  'capital_losses',
  'tax_strategies',
  'journal_entries',
  'journal_entry_lines',
  'account_balances',
  'wage_payments',
]);
