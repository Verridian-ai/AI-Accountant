#!/usr/bin/env node
/**
 * Export all transaction data from admin account
 * 
 * Exports:
 * - Transactions (6200+)
 * - Accounts
 * - Merchant data
 * - Categories
 */

import pg from '../server/node_modules/pg/lib/index.js';
import fs from 'fs';

const { Client } = pg;

// Use Neon Cloud database
const NEON_URL = 'postgresql://neondb_owner:npg_wmEJX7uUcHp3@ep-steep-waterfall-a7j76g5z.ap-southeast-2.aws.neon.tech/neondb?sslmode=require';

async function exportAdminData() {
  const client = new Client({ connectionString: NEON_URL });
  
  try {
    await client.connect();
    console.log('✓ Connected to Neon Cloud\n');

    // Get admin user ID
    const adminUser = await client.query(`
      SELECT * FROM users WHERE username = 'admin' OR id = 'admin' LIMIT 1
    `);

    if (adminUser.rows.length === 0) {
      console.log('❌ Admin user not found');
      return;
    }

    const adminId = adminUser.rows[0].id;
    console.log(`Admin User ID: ${adminId}`);
    console.log(`Admin Username: ${adminUser.rows[0].username}\n`);

    // Export transactions
    console.log('[1/4] Exporting transactions...');
    const transactions = await client.query(`
      SELECT * FROM transactions 
      WHERE user_id = $1 
      ORDER BY date DESC
    `, [adminId]);
    
    console.log(`  ✅ Found ${transactions.rows.length} transactions`);
    fs.writeFileSync('admin-transactions.json', JSON.stringify(transactions.rows, null, 2));
    console.log(`  📄 Saved to: admin-transactions.json\n`);

    // Export accounts
    console.log('[2/4] Exporting accounts...');
    const accounts = await client.query(`
      SELECT * FROM accounts 
      WHERE user_id = $1 
      ORDER BY created_at
    `, [adminId]);
    
    console.log(`  ✅ Found ${accounts.rows.length} accounts`);
    fs.writeFileSync('admin-accounts.json', JSON.stringify(accounts.rows, null, 2));
    console.log(`  📄 Saved to: admin-accounts.json\n`);

    // Export merchant memory
    console.log('[3/4] Exporting merchant memory...');
    const merchants = await client.query(`
      SELECT * FROM merchant_memory
      WHERE user_id = $1
      ORDER BY created_at DESC
    `, [adminId]);
    
    console.log(`  ✅ Found ${merchants.rows.length} merchants`);
    fs.writeFileSync('admin-merchants.json', JSON.stringify(merchants.rows, null, 2));
    console.log(`  📄 Saved to: admin-merchants.json\n`);

    // Export user categories
    console.log('[4/4] Exporting user categories...');
    const categories = await client.query(`
      SELECT * FROM user_categories
      WHERE user_id = $1
    `, [adminId]);
    
    console.log(`  ✅ Found ${categories.rows.length} categories`);
    fs.writeFileSync('admin-categories.json', JSON.stringify(categories.rows, null, 2));
    console.log(`  📄 Saved to: admin-categories.json\n`);

    // Summary
    console.log('='.repeat(80));
    console.log('EXPORT SUMMARY');
    console.log('='.repeat(80));
    console.log(`Transactions: ${transactions.rows.length}`);
    console.log(`Accounts: ${accounts.rows.length}`);
    console.log(`Merchants: ${merchants.rows.length}`);
    console.log(`Categories: ${categories.rows.length}`);
    console.log();
    
    // Sample transaction
    if (transactions.rows.length > 0) {
      console.log('Sample Transaction:');
      const sample = transactions.rows[0];
      console.log(`  Date: ${sample.date}`);
      console.log(`  Description: ${sample.description}`);
      console.log(`  Amount: $${(sample.amount / 100).toFixed(2)}`);
      console.log(`  Category: ${sample.category || 'Uncategorized'}`);
      console.log();
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

exportAdminData();

