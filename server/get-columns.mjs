import pg from 'pg';
const { Client } = pg;
const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_wmEJX7uUcHp3@ep-steep-waterfall-a7j76g5z.ap-southeast-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false },
});
await client.connect();
const tables = ['bills','bill_lines','bill_payments','invoices','invoice_lines','purchase_orders','po_lines','suppliers','journal_entries','journal_entry_lines','chart_of_accounts','tenants','tenant_members','admin_users','merchant_memory','pending_categorization','reconciliation_alerts','tax_year_summary','deductions'];
for (const tbl of tables) {
  const r = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,[tbl]);
  if (r.rows.length === 0) { console.log(`${tbl}: NOT FOUND`); continue; }
  console.log(`\n${tbl}:`);
  console.log('  ' + r.rows.map(c=>`${c.column_name}(${c.data_type})`).join(', '));
}
await client.end();
