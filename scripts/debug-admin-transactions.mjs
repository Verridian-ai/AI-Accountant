#!/usr/bin/env node
/**
 * Debug admin transactions in Neon Cloud
 * Check if transactions are visible and queryable
 */

import pg from '../server/node_modules/pg/lib/index.js';

const { Client } = pg;
const NEON_URL = 'postgresql://neondb_owner:npg_wmEJX7uUcHp3@ep-steep-waterfall-a7j76g5z.ap-southeast-2.aws.neon.tech/neondb?sslmode=require';
const ADMIN_USER_ID = '0ca3af13-f3fb-4486-b461-c49e89e8bde2';

async function debugTransactions() {
  const client = new Client({ connectionString: NEON_URL });
  
  try {
    await client.connect();
    console.log('✓ Connected to Neon Cloud\n');

    // Check admin user exists
    console.log('[1] Checking admin user...');
    const userCheck = await client.query(`
      SELECT id, username FROM users WHERE id = $1
    `, [ADMIN_USER_ID]);
    
    if (userCheck.rows.length === 0) {
      console.log('❌ Admin user not found!');
      return;
    }
    
    console.log(`  ✅ Admin user found: ${userCheck.rows[0].username}`);
    console.log(`  ID: ${userCheck.rows[0].id}\n`);

    // Check accounts
    console.log('[2] Checking accounts...');
    const accountsCheck = await client.query(`
      SELECT id, account_name, account_number, bank_name, is_active
      FROM accounts 
      WHERE user_id = $1
    `, [ADMIN_USER_ID]);
    
    console.log(`  ✅ Found ${accountsCheck.rows.length} accounts:`);
    accountsCheck.rows.forEach(acc => {
      console.log(`    - ${acc.account_name} (${acc.bank_name})`);
      console.log(`      ID: ${acc.id}`);
      console.log(`      Active: ${acc.is_active}`);
    });
    console.log();

    // Check transactions count
    console.log('[3] Checking transactions...');
    const txnCount = await client.query(`
      SELECT COUNT(*) as count FROM transactions WHERE user_id = $1
    `, [ADMIN_USER_ID]);
    
    console.log(`  ✅ Total transactions: ${txnCount.rows[0].count}\n`);

    // Check transactions by account
    console.log('[4] Transactions by account...');
    const txnByAccount = await client.query(`
      SELECT 
        account_id,
        COUNT(*) as count,
        MIN(date) as earliest,
        MAX(date) as latest
      FROM transactions 
      WHERE user_id = $1
      GROUP BY account_id
    `, [ADMIN_USER_ID]);
    
    txnByAccount.rows.forEach(row => {
      console.log(`  Account: ${row.account_id}`);
      console.log(`    Count: ${row.count}`);
      console.log(`    Date range: ${row.earliest} to ${row.latest}`);
    });
    console.log();

    // Get sample transactions
    console.log('[5] Sample transactions (latest 10)...');
    const samples = await client.query(`
      SELECT id, date, description, amount, category, account_id
      FROM transactions 
      WHERE user_id = $1
      ORDER BY date DESC
      LIMIT 10
    `, [ADMIN_USER_ID]);
    
    samples.rows.forEach((txn, i) => {
      console.log(`  ${i + 1}. ${txn.date} - ${txn.description}`);
      console.log(`     Amount: $${(txn.amount / 100).toFixed(2)}`);
      console.log(`     Category: ${txn.category || 'Uncategorized'}`);
      console.log(`     Account: ${txn.account_id}`);
    });
    console.log();

    // Check if there are any NULL user_ids
    console.log('[6] Checking for orphaned transactions...');
    const orphaned = await client.query(`
      SELECT COUNT(*) as count FROM transactions WHERE user_id IS NULL
    `);
    console.log(`  Transactions with NULL user_id: ${orphaned.rows[0].count}\n`);

    // Check if there are transactions for other users
    console.log('[7] Checking all users with transactions...');
    const allUsers = await client.query(`
      SELECT 
        u.id,
        u.username,
        COUNT(t.id) as transaction_count
      FROM users u
      LEFT JOIN transactions t ON t.user_id = u.id
      GROUP BY u.id, u.username
      ORDER BY transaction_count DESC
    `);
    
    console.log('  Users with transactions:');
    allUsers.rows.forEach(user => {
      console.log(`    - ${user.username}: ${user.transaction_count} transactions`);
    });
    console.log();

    console.log('='.repeat(80));
    console.log('DIAGNOSIS');
    console.log('='.repeat(80));
    
    if (txnCount.rows[0].count === '0') {
      console.log('❌ No transactions found for admin user!');
      console.log('   The seeding may have failed or used wrong user_id.');
    } else if (accountsCheck.rows.length === 0) {
      console.log('❌ No accounts found for admin user!');
      console.log('   Transactions exist but no accounts to display them in.');
    } else if (accountsCheck.rows.some(acc => !acc.is_active)) {
      console.log('⚠️  Some accounts are inactive!');
      console.log('   The UI may be filtering out inactive accounts.');
    } else {
      console.log('✅ Data looks good!');
      console.log(`   ${txnCount.rows[0].count} transactions across ${accountsCheck.rows.length} accounts.`);
      console.log('   Check the frontend query to see why they are not displaying.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

debugTransactions();

