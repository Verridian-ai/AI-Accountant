#!/usr/bin/env node
/**
 * Create indexes for tenant_id columns for better query performance
 */

import pg from '../server/node_modules/pg/lib/index.js';

const { Client } = pg;
const NEON_URL = 'postgresql://neondb_owner:npg_wmEJX7uUcHp3@ep-steep-waterfall-a7j76g5z.ap-southeast-2.aws.neon.tech/neondb?sslmode=require';

async function createIndexes() {
  const client = new Client({ connectionString: NEON_URL });
  
  try {
    await client.connect();
    console.log('✓ Connected to Neon Cloud\n');
    console.log('Creating indexes for tenant_id columns...\n');

    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_transactions_tenant_id ON transactions(tenant_id)',
      'CREATE INDEX IF NOT EXISTS idx_transactions_user_tenant ON transactions(user_id, tenant_id)',
      'CREATE INDEX IF NOT EXISTS idx_accounts_tenant_id ON accounts(tenant_id)',
      'CREATE INDEX IF NOT EXISTS idx_accounts_user_tenant ON accounts(user_id, tenant_id)',
      'CREATE INDEX IF NOT EXISTS idx_merchant_memory_tenant_id ON merchant_memory(tenant_id)',
      'CREATE INDEX IF NOT EXISTS idx_user_categories_tenant_id ON user_categories(tenant_id)',
      'CREATE INDEX IF NOT EXISTS idx_bas_periods_tenant_id ON bas_periods(tenant_id)',
      'CREATE INDEX IF NOT EXISTS idx_budgets_tenant_id ON budgets(tenant_id)',
      'CREATE INDEX IF NOT EXISTS idx_suppliers_tenant_id ON suppliers(tenant_id)',
      'CREATE INDEX IF NOT EXISTS idx_bills_tenant_id ON bills(tenant_id)',
      'CREATE INDEX IF NOT EXISTS idx_employees_tenant_id ON employees(tenant_id)',
      'CREATE INDEX IF NOT EXISTS idx_payroll_runs_tenant_id ON payroll_runs(tenant_id)',
      'CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id ON invoices(tenant_id)',
      'CREATE INDEX IF NOT EXISTS idx_customers_tenant_id ON customers(tenant_id)',
      'CREATE INDEX IF NOT EXISTS idx_role_permissions_tenant_id ON role_permissions(tenant_id)',
      'CREATE INDEX IF NOT EXISTS idx_role_permissions_tenant_role ON role_permissions(tenant_id, role)',
    ];

    let successCount = 0;
    let skipCount = 0;

    for (const indexSql of indexes) {
      try {
        await client.query(indexSql);
        const indexName = indexSql.match(/idx_\w+/)[0];
        console.log(`✅ ${indexName}`);
        successCount++;
      } catch (err) {
        if (err.code === '42P01') {
          // Table doesn't exist
          const indexName = indexSql.match(/idx_\w+/)[0];
          console.log(`⏭️  ${indexName} (table not found)`);
          skipCount++;
        } else {
          console.log(`❌ ${err.message}`);
        }
      }
    }

    console.log();
    console.log('='.repeat(80));
    console.log(`✅ Created: ${successCount} indexes`);
    console.log(`⏭️  Skipped: ${skipCount} (table missing)`);
    console.log('🎉 Index creation complete!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

createIndexes();

