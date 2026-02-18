#!/usr/bin/env node
/**
 * Create a tenant for the admin user and associate all transactions with it
 */

import pg from '../server/node_modules/pg/lib/index.js';
import crypto from 'crypto';

const { Client } = pg;
const NEON_URL = 'postgresql://neondb_owner:npg_wmEJX7uUcHp3@ep-steep-waterfall-a7j76g5z.ap-southeast-2.aws.neon.tech/neondb?sslmode=require';
const ADMIN_USER_ID = '0ca3af13-f3fb-4486-b461-c49e89e8bde2';

async function createAdminTenant() {
  const client = new Client({ connectionString: NEON_URL });
  
  try {
    await client.connect();
    console.log('✓ Connected to Neon Cloud\n');

    await client.query('BEGIN');

    // Check if admin already has a tenant
    console.log('[1] Checking for existing tenant...');
    const existingTenant = await client.query(`
      SELECT t.* FROM tenants t
      JOIN tenant_members tm ON tm.tenant_id = t.id
      WHERE tm.user_id = $1
      LIMIT 1
    `, [ADMIN_USER_ID]);

    let tenantId;
    
    if (existingTenant.rows.length > 0) {
      tenantId = existingTenant.rows[0].id;
      console.log(`  ✅ Admin already has tenant: ${existingTenant.rows[0].name}`);
      console.log(`  Tenant ID: ${tenantId}\n`);
    } else {
      // Create a new tenant for admin
      console.log('[1] Creating tenant for admin user...');
      tenantId = crypto.randomUUID();
      
      await client.query(`
        INSERT INTO tenants (id, name, slug, created_at, updated_at)
        VALUES ($1, $2, $3, NOW(), NOW())
      `, [tenantId, 'Admin Personal', 'admin-personal']);
      
      console.log(`  ✅ Created tenant: Admin Personal`);
      console.log(`  Tenant ID: ${tenantId}\n`);

      // Add admin as owner of the tenant
      console.log('[2] Adding admin as tenant owner...');
      await client.query(`
        INSERT INTO tenant_members (id, tenant_id, user_id, role, joined_at)
        VALUES ($1, $2, $3, $4, NOW())
      `, [crypto.randomUUID(), tenantId, ADMIN_USER_ID, 'owner']);
      
      console.log(`  ✅ Admin added as owner\n`);
    }

    // Update all admin transactions to include tenant_id
    console.log('[3] Updating transactions with tenant_id...');
    const updateResult = await client.query(`
      UPDATE transactions 
      SET tenant_id = $1
      WHERE user_id = $2 AND tenant_id IS NULL
    `, [tenantId, ADMIN_USER_ID]);
    
    console.log(`  ✅ Updated ${updateResult.rowCount} transactions\n`);

    // Update all admin accounts to include tenant_id
    console.log('[4] Updating accounts with tenant_id...');
    const accountsResult = await client.query(`
      UPDATE accounts 
      SET tenant_id = $1
      WHERE user_id = $2 AND tenant_id IS NULL
    `, [tenantId, ADMIN_USER_ID]);
    
    console.log(`  ✅ Updated ${accountsResult.rowCount} accounts\n`);

    // Update all admin merchants to include tenant_id
    console.log('[5] Updating merchants with tenant_id...');
    const merchantsResult = await client.query(`
      UPDATE merchant_memory 
      SET tenant_id = $1
      WHERE user_id = $2 AND tenant_id IS NULL
    `, [tenantId, ADMIN_USER_ID]);
    
    console.log(`  ✅ Updated ${merchantsResult.rowCount} merchants\n`);

    await client.query('COMMIT');
    console.log('✅ Transaction committed\n');

    // Verify
    console.log('='.repeat(80));
    console.log('VERIFICATION');
    console.log('='.repeat(80));
    
    const verify = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM transactions WHERE user_id = $1 AND tenant_id = $2) as txn_count,
        (SELECT COUNT(*) FROM accounts WHERE user_id = $1 AND tenant_id = $2) as acc_count,
        (SELECT COUNT(*) FROM merchant_memory WHERE user_id = $1 AND tenant_id = $2) as merch_count
    `, [ADMIN_USER_ID, tenantId]);

    const { txn_count, acc_count, merch_count } = verify.rows[0];
    
    console.log(`Tenant: Admin Personal (${tenantId})`);
    console.log(`Transactions: ${txn_count}`);
    console.log(`Accounts: ${acc_count}`);
    console.log(`Merchants: ${merch_count}`);
    console.log();
    console.log('🎉 Admin tenant setup complete!');
    console.log();
    console.log('You can now log in and see your transactions in the ledger.');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

createAdminTenant();

