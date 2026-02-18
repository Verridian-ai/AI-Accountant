#!/usr/bin/env node
/**
 * Full audit of Neon database schema vs required schema
 */

import pg from '../server/node_modules/pg/lib/index.js';
import fs from 'fs';

const { Client } = pg;

const NEON_URL = 'postgresql://neondb_owner:npg_wmEJX7uUcHp3@ep-steep-waterfall-a7j76g5z.ap-southeast-2.aws.neon.tech/neondb?sslmode=require';

// Expected tables from Drizzle schema
const REQUIRED_TABLES = [
  // Core
  'users', 'user_settings', 'sessions', 'audit_log',
  
  // Banking
  'accounts', 'statements', 'statement_accounts', 'transactions', 
  'transaction_history', 'transfer_links', 'merchant_memory',
  'pending_categorization', 'reconciliation_alerts',
  
  // Business
  'business_profiles', 'bas_periods', 'bas_calculations',
  
  // Tax
  'tax_codes', 'tax_brackets', 'deductions', 'tax_offsets', 
  'capital_losses', 'tax_year_summary',
  
  // CGT
  'cgt_assets', 'cgt_events',
  
  // Depreciation
  'depreciable_assets', 'depreciation_schedule',
  
  // Teams
  'teams', 'team_members', 'team_invitations',
  
  // Subscriptions
  'subscriptions', 'subscription_plans', 'subscription_history',
  
  // Export & Metrics
  'export_history', 'parser_metrics', 'parser_accuracy_aggregates', 'parser_feedback',
  
  // Accounting
  'chart_of_accounts', 'journal_entries', 'journal_entry_lines',
  'accounting_periods', 'account_balances',
  
  // RAG
  'rag_namespaces', 'rag_chunks', 'rag_documents', 'rag_citations',
  
  // Queue
  'upload_queue',
  
  // Dashboard
  'dashboard_layouts', 'saved_charts',
  
  // Cognee
  'cognee_user_accounts', 'cognee_sessions', 'datapoint_configs',
  'graph_schemas', 'cognee_feedback',
  
  // Agents
  'agent_sessions', 'agent_mutations', 'agent_audit_log',
  
  // Multi-tenant
  'tenants', 'tenant_members', 'tenant_invitations',
  'permissions', 'role_permissions', 'api_rate_limits',
  
  // Financial Planning
  'owner_equity_events', 'economic_data_cache', 'report_snapshots',
  'budgets', 'budget_lines', 'budget_vs_actual',
  'forecast_scenarios', 'forecast_periods', 'kpi_metrics',
  
  // OCR
  'ocr_documents', 'ocr_line_items',
  
  // Payments
  'payment_match_rules', 'payment_matches', 'document_queue',
  
  // Cash Flow
  'cash_flow_forecasts', 'cash_flow_forecast_periods',
  
  // Compliance
  'anomaly_alerts', 'compliance_checks', 'compliance_schedules',
  
  // Intelligence
  'temporal_queries', 'cross_module_insights', 'intelligence_subscriptions',
  'module_connections',
  
  // Payables
  'suppliers', 'bills', 'bill_lines', 'bill_payments',
  'purchase_orders', 'po_lines', 'po_receipts', 'po_receipt_lines',
  'supplier_payment_runs', 'supplier_payment_run_items',
  
  // PWA
  'push_subscriptions', 'notification_preferences', 'offline_sync_log',
  
  // Invoicing
  'customers', 'customer_contacts', 'invoices', 'invoice_lines',
  
  // Categorization
  'user_categories',
  
  // Payroll
  'employees', 'payroll_runs', 'payroll_run_items', 'leave_balances',
  'leave_requests', 'superannuation_funds', 'super_contributions',
  
  // Admin
  'admin_users',
];

async function auditSchema() {
  const client = new Client({ connectionString: NEON_URL });
  
  try {
    await client.connect();
    console.log('✓ Connected to Neon Cloud\n');

    // Get all existing tables
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    const existingTables = result.rows.map(r => r.table_name);
    
    console.log(`📊 AUDIT RESULTS`);
    console.log(`═══════════════════════════════════════════════════\n`);
    console.log(`Required tables: ${REQUIRED_TABLES.length}`);
    console.log(`Existing tables: ${existingTables.length}\n`);
    
    // Find missing tables
    const missingTables = REQUIRED_TABLES.filter(t => !existingTables.includes(t));
    const extraTables = existingTables.filter(t => !REQUIRED_TABLES.includes(t));
    
    if (missingTables.length > 0) {
      console.log(`❌ MISSING TABLES (${missingTables.length}):`);
      console.log(`───────────────────────────────────────────────────`);
      missingTables.forEach(t => console.log(`  - ${t}`));
      console.log('');
    } else {
      console.log(`✅ All required tables exist!\n`);
    }
    
    if (extraTables.length > 0) {
      console.log(`ℹ️  EXTRA TABLES (${extraTables.length}):`);
      console.log(`───────────────────────────────────────────────────`);
      extraTables.forEach(t => console.log(`  - ${t}`));
      console.log('');
    }
    
    // Save report
    const report = {
      timestamp: new Date().toISOString(),
      required: REQUIRED_TABLES.length,
      existing: existingTables.length,
      missing: missingTables,
      extra: extraTables,
      existingTables: existingTables,
    };
    
    fs.writeFileSync('neon-schema-audit.json', JSON.stringify(report, null, 2));
    console.log(`📄 Full report saved to: neon-schema-audit.json\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

auditSchema();

