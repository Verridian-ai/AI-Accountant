/**
 * Deep schema diff — shows exact column mismatches between Neon and Drizzle schema
 * Focus on tables with data + tables actively queried by routes
 */
import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_wmEJX7uUcHp3@ep-steep-waterfall-a7j76g5z.ap-southeast-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const colsRes = await client.query(`
  SELECT table_name, column_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
  ORDER BY table_name, ordinal_position
`);
const neon = {};
for (const r of colsRes.rows) {
  if (!neon[r.table_name]) neon[r.table_name] = new Set();
  neon[r.table_name].add(r.column_name);
}

// Drizzle schema column definitions (snake_case DB names)
// Extracted from server/src/schema/*.ts
const drizzle = {
  users: ['id','username','password_hash','created_at','updated_at'],
  accounts: ['id','user_id','account_name','bsb','account_number','bank_name','account_type','balance','currency','is_active','created_at','updated_at','tenant_id'],
  transactions: ['id','user_id','account_id','statement_id','date','description','amount','balance','category','sub_category','merchant','notes','is_transfer','transfer_id','gst_amount','gst_applicable','tax_code','is_reconciled','reconciled_at','reconciled_by','split_from_id','is_split','split_total','split_remaining','confidence','source','created_at','updated_at','tenant_id'],
  statements: ['id','user_id','account_id','filename','original_filename','file_path','file_size','mime_type','bank_name','account_number','statement_date','start_date','end_date','transaction_count','status','error_message','created_at','updated_at'],
  bas_periods: ['id','user_id','financial_year','quarter','period_type','start_date','end_date','due_date','lodgement_due','lodgement_date','accounting_method','status','lodged_at','created_at','updated_at'],
  bas_calculations: ['id','bas_period_id','period_id','label','value','label_g1','label_g2','label_g3','label_g10','label_g11','label_1a','label_1b','label_w1','label_w2','label_5a','label_7c','label_7d','amount_owing','refund_due','calculated_at','created_at','updated_at'],
  tax_year_summary: ['id','user_id','financial_year','gross_income','total_deductions','taxable_income','tax_payable','medicare_levy','low_income_offset','total_tax','net_income','created_at','updated_at'],
  deductions: ['id','user_id','financial_year','category','description','amount','receipt_url','is_verified','created_at','updated_at'],
  tenants: ['id','name','slug','plan','is_active','owner_id','created_at','updated_at'],
  tenant_members: ['id','tenant_id','user_id','role','permissions','invited_by','joined_at','created_at'],
  admin_users: ['id','email','password_hash','name','role','permissions','is_active','last_login_at','created_at','updated_at'],
  invoices: ['id','user_id','tenant_id','invoice_number','customer_id','status','issue_date','due_date','subtotal','tax_amount','total','currency','notes','terms','created_at','updated_at'],
  invoice_lines: ['id','invoice_id','description','quantity','unit_price','tax_rate','tax_amount','total','account_code','created_at'],
  suppliers: ['id','user_id','tenant_id','name','abn','email','phone','address','payment_terms','bank_bsb','bank_account','is_active','created_at','updated_at'],
  bills: ['id','user_id','tenant_id','supplier_id','bill_number','status','issue_date','due_date','subtotal','tax_amount','total','currency','notes','created_at','updated_at'],
  bill_lines: ['id','bill_id','description','quantity','unit_price','tax_rate','tax_amount','total','account_code','created_at'],
  purchase_orders: ['id','user_id','tenant_id','supplier_id','po_number','status','issue_date','delivery_date','subtotal','tax_amount','total','notes','created_at','updated_at'],
  po_lines: ['id','po_id','description','quantity','unit_price','tax_rate','total','account_code','created_at'],
  journal_entries: ['id','user_id','tenant_id','entry_number','date','description','reference','status','created_at','updated_at'],
  journal_entry_lines: ['id','journal_entry_id','account_code','description','debit','credit','created_at'],
  chart_of_accounts: ['id','user_id','tenant_id','account_code','account_name','account_type','parent_code','is_active','created_at','updated_at'],
  merchant_memory: ['id','user_id','merchant_name','normalized_name','category','sub_category','confidence','occurrence_count','last_seen','created_at','updated_at'],
  pending_categorization: ['id','user_id','transaction_id','merchant','description','amount','suggested_category','suggested_sub_category','confidence','status','created_at'],
  reconciliation_alerts: ['id','user_id','account_id','alert_type','severity','message','transaction_id','is_resolved','resolved_at','created_at'],
};

// Compare
console.log('\n=== SCHEMA DRIFT REPORT ===\n');
let totalMissing = 0, totalExtra = 0;

for (const [tbl, drizzleCols] of Object.entries(drizzle)) {
  const neonCols = neon[tbl];
  if (!neonCols) {
    console.log(`❌ TABLE MISSING IN NEON: ${tbl}`);
    totalMissing++;
    continue;
  }
  
  const missingInNeon = drizzleCols.filter(c => !neonCols.has(c));
  const extraInNeon = [...neonCols].filter(c => !drizzleCols.includes(c));
  
  if (missingInNeon.length > 0 || extraInNeon.length > 0) {
    console.log(`\n📋 ${tbl}:`);
    if (missingInNeon.length > 0) {
      console.log(`  ❌ In Drizzle but MISSING in Neon: ${missingInNeon.join(', ')}`);
      totalMissing += missingInNeon.length;
    }
    if (extraInNeon.length > 0) {
      console.log(`  ➕ In Neon but NOT in Drizzle: ${extraInNeon.join(', ')}`);
      totalExtra += extraInNeon.length;
    }
  } else {
    console.log(`✅ ${tbl}: OK`);
  }
}

// Also check bas_calculations specifically — the code writes net_gst, total_payable etc
console.log('\n=== bas_calculations ACTUAL NEON COLUMNS ===');
console.log([...neon['bas_calculations']].join(', '));

console.log('\n=== bas_persistence.ts WRITES THESE COLUMNS ===');
const persistenceWrites = ['net_gst','fuel_tax_credit','total_payable','calculation_notes','label_g1','label_g2','label_g3','label_g10','label_g11','label_1a','label_1b','label_w1','label_w2','label_5a','label_7c','label_7d'];
for (const col of persistenceWrites) {
  console.log(`  ${col}: ${neon['bas_calculations']?.has(col) ? '✅' : '❌ MISSING'}`);
}

console.log(`\nTotal missing columns: ${totalMissing}`);
console.log(`Total extra columns in Neon: ${totalExtra}`);

await client.end();
