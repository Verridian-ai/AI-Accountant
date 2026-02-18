#!/usr/bin/env node
/**
 * Add tenant_id columns to transactions, accounts, and merchant_memory tables
 */

import pg from '../server/node_modules/pg/lib/index.js';

const { Client } = pg;
const NEON_URL = 'postgresql://neondb_owner:npg_wmEJX7uUcHp3@ep-steep-waterfall-a7j76g5z.ap-southeast-2.aws.neon.tech/neondb?sslmode=require';

async function addTenantColumns() {
  const client = new Client({ connectionString: NEON_URL });
  
  try {
    await client.connect();
    console.log('✓ Connected to Neon Cloud\n');

    // Check and add tenant_id to transactions
    console.log('[1] Adding tenant_id to transactions table...');
    try {
      await client.query(`
        ALTER TABLE transactions 
        ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id)
      `);
      console.log('  ✅ Column added to transactions\n');
    } catch (err) {
      console.log(`  ⚠️  ${err.message}\n`);
    }

    // Check and add tenant_id to accounts
    console.log('[2] Adding tenant_id to accounts table...');
    try {
      await client.query(`
        ALTER TABLE accounts 
        ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id)
      `);
      console.log('  ✅ Column added to accounts\n');
    } catch (err) {
      console.log(`  ⚠️  ${err.message}\n`);
    }

    // Check and add tenant_id to merchant_memory
    console.log('[3] Adding tenant_id to merchant_memory table...');
    try {
      await client.query(`
        ALTER TABLE merchant_memory 
        ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id)
      `);
      console.log('  ✅ Column added to merchant_memory\n');
    } catch (err) {
      console.log(`  ⚠️  ${err.message}\n`);
    }

    // Check and add tenant_id to role_permissions
    console.log('[4] Adding tenant_id to role_permissions table...');
    try {
      await client.query(`
        ALTER TABLE role_permissions
        ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id)
      `);
      console.log('  ✅ Column added to role_permissions\n');
    } catch (err) {
      console.log(`  ⚠️  ${err.message}\n`);
    }

    // Create indexes for better query performance
    console.log('[5] Creating indexes...');
    try {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_transactions_tenant_id ON transactions(tenant_id)
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_accounts_tenant_id ON accounts(tenant_id)
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_merchant_memory_tenant_id ON merchant_memory(tenant_id)
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_role_permissions_tenant_id ON role_permissions(tenant_id)
      `);
      console.log('  ✅ Indexes created\n');
    } catch (err) {
      console.log(`  ⚠️  ${err.message}\n`);
    }

    console.log('='.repeat(80));
    console.log('✅ Schema migration complete!');
    console.log('='.repeat(80));
    console.log();
    console.log('Next step: Run create-admin-tenant.mjs to associate data with tenant');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

addTenantColumns();

