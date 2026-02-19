/**
 * Schema Audit — compares actual Neon columns vs Drizzle schema definitions
 * Run: node schema-audit.mjs
 */
import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_wmEJX7uUcHp3@ep-steep-waterfall-a7j76g5z.ap-southeast-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false },
});

await client.connect();

// 1. Get ALL tables in public schema
const tablesRes = await client.query(`
  SELECT table_name 
  FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  ORDER BY table_name
`);
const tables = tablesRes.rows.map(r => r.table_name);
console.log(`\n=== NEON TABLES (${tables.length} total) ===`);
console.log(tables.join(', '));

// 2. Get ALL columns for ALL tables
const colsRes = await client.query(`
  SELECT table_name, column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_schema = 'public'
  ORDER BY table_name, ordinal_position
`);

const neonSchema = {};
for (const row of colsRes.rows) {
  if (!neonSchema[row.table_name]) neonSchema[row.table_name] = [];
  neonSchema[row.table_name].push(row.column_name);
}

// 3. Print each table's columns
console.log('\n=== NEON COLUMN DETAILS ===');
for (const [tbl, cols] of Object.entries(neonSchema)) {
  console.log(`\n${tbl}:`);
  console.log('  ' + cols.join(', '));
}

// 4. Row counts for all tables
console.log('\n=== ROW COUNTS ===');
for (const tbl of tables) {
  try {
    const r = await client.query(`SELECT COUNT(*) as n FROM "${tbl}"`);
    const n = r.rows[0].n;
    if (Number(n) > 0) console.log(`  ${tbl}: ${n} rows`);
    else console.log(`  ${tbl}: (empty)`);
  } catch (e) {
    console.log(`  ${tbl}: ERROR - ${e.message}`);
  }
}

// 5. Check specific problem columns from the error
console.log('\n=== PROBLEM COLUMN CHECKS ===');
const checks = [
  ['bas_calculations', 'period_id'],
  ['bas_calculations', 'bas_period_id'],
  ['bas_calculations', 'net_gst'],
  ['bas_calculations', 'total_payable'],
  ['bas_calculations', 'fuel_tax_credit'],
  ['bas_calculations', 'calculation_notes'],
  ['bas_periods', 'lodgement_due'],
  ['bas_periods', 'lodgement_date'],
  ['bas_periods', 'period_type'],
  ['transactions', 'user_id'],
  ['transactions', 'account_id'],
  ['transactions', 'is_transfer'],
  ['accounts', 'user_id'],
  ['accounts', 'is_active'],
];
for (const [tbl, col] of checks) {
  const exists = neonSchema[tbl]?.includes(col);
  console.log(`  ${tbl}.${col}: ${exists ? '✅ EXISTS' : '❌ MISSING'}`);
}

// 6. Check for tables the code expects but don't exist in Neon
const expectedTables = [
  'users', 'accounts', 'transactions', 'transaction_history',
  'bas_periods', 'bas_calculations', 'tax_year_summary', 'tax_codes', 'tax_brackets',
  'deductions', 'cgt_assets', 'cgt_events', 'depreciable_assets', 'depreciation_schedule',
  'statements', 'tenants', 'tenant_members', 'admin_users',
  'invoices', 'invoice_items', 'suppliers', 'bills', 'bill_items',
  'purchase_orders', 'po_items', 'pay_categories', 'pay_runs', 'pay_slips',
  'inventory_items', 'inventory_movements', 'journal_entries', 'journal_lines',
  'forecast_scenarios', 'forecast_periods', 'kpi_metrics', 'cross_module_insights',
  'reconciliation_alerts', 'module_connections', 'rag_documents', 'rag_chunks',
  'rag_citations', 'system_metrics', 'user_activity_log',
];
console.log('\n=== EXPECTED TABLES CHECK ===');
for (const tbl of expectedTables) {
  const exists = tables.includes(tbl);
  if (!exists) console.log(`  ❌ MISSING TABLE: ${tbl}`);
}
const missingCount = expectedTables.filter(t => !tables.includes(t)).length;
console.log(`  ${expectedTables.length - missingCount}/${expectedTables.length} expected tables exist`);

await client.end();
console.log('\n✅ Audit complete');
