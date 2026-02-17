/**
 * MutationTools constants — TTL, validation patterns, mutable table whitelist.
 *
 * Extracted from mutation-tools.ts to comply with the 300-line enterprise standard.
 */

// ── Default TTL for unconfirmed mutations (15 minutes) ────────────
export const MUTATION_EXPIRY_MS = 15 * 60 * 1000;

// ── SQL Injection Prevention (D01-CRIT-01) ────────────────────────

/** Safe identifier regex: lowercase alpha + underscore, no special chars. */
export const SAFE_IDENTIFIER_RE = /^[a-z_][a-z0-9_]*$/;

/**
 * Whitelist of tables that agents are allowed to mutate.
 * Any table NOT in this set is rejected before SQL is built.
 */
export const MUTABLE_TABLES = new Set([
  'transactions',
  'accounts',
  'merchant_memory',
  'pending_categorization',
  'bas_calculations',
  'bas_periods',
  'transfer_links',
  'reconciliation_alerts',
  'deductions',
  'tax_strategies',
  'report_snapshots',
  'kpi_metrics',
  'budgets',
  'budget_lines',
  'budget_vs_actual',
  'forecast_scenarios',
  'forecast_periods',
  'ocr_documents',
  'ocr_line_items',
  'payment_matches',
  'payment_match_rules',
  'inventory_items',
  'inventory_stock',
  'inventory_movements',
  'bank_recon_matches',
  'bank_recon_rules',
  'bank_recon_sessions',
  'fixed_assets',
  'asset_depreciation',
  'asset_disposals',
  'inter_entity_transactions',
  'consolidation_snapshots',
  'consolidation_snapshot_lines',
  'wage_payments',
  'statements',
]);
