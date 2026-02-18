#!/usr/bin/env node
/**
 * Seed admin transaction data to Neon Cloud PostgreSQL
 * 
 * Seeds:
 * - 6,520 transactions
 * - 2 accounts
 * - 27 merchants
 * 
 * All data is inserted into Neon Cloud database for direct application queries.
 */

import pg from '../server/node_modules/pg/lib/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NEON_URL = 'postgresql://neondb_owner:npg_wmEJX7uUcHp3@ep-steep-waterfall-a7j76g5z.ap-southeast-2.aws.neon.tech/neondb?sslmode=require';
const ADMIN_USER_ID = '0ca3af13-f3fb-4486-b461-c49e89e8bde2';

async function seedAdminData() {
  const client = new Client({ connectionString: NEON_URL });
  
  try {
    await client.connect();
    console.log('✓ Connected to Neon Cloud\n');

    // Load JSON files
    console.log('Loading exported data...');
    const transactionsPath = path.join(__dirname, '..', 'admin-transactions.json');
    const accountsPath = path.join(__dirname, '..', 'admin-accounts.json');
    const merchantsPath = path.join(__dirname, '..', 'admin-merchants.json');

    const transactions = JSON.parse(fs.readFileSync(transactionsPath, 'utf8'));
    const accounts = JSON.parse(fs.readFileSync(accountsPath, 'utf8'));
    const merchants = JSON.parse(fs.readFileSync(merchantsPath, 'utf8'));

    console.log(`  ✅ Loaded ${transactions.length} transactions`);
    console.log(`  ✅ Loaded ${accounts.length} accounts`);
    console.log(`  ✅ Loaded ${merchants.length} merchants\n`);

    // Start transaction
    await client.query('BEGIN');

    // Seed accounts first (transactions reference accounts)
    console.log('[1/3] Seeding accounts...');
    let accountsInserted = 0;
    let accountsSkipped = 0;

    for (const account of accounts) {
      try {
        // Generate account_number_hash from account_number
        const accountHash = account.account_number_hash || `hash_${account.account_number}`;

        await client.query(`
          INSERT INTO accounts (
            id, user_id, account_number, account_number_hash, account_name,
            account_type, bank_name, current_balance, is_active,
            created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (id) DO NOTHING
        `, [
          account.id,
          account.user_id,
          account.account_number,
          accountHash,
          account.account_name,
          account.account_type,
          account.bank_name,
          account.balance || account.current_balance || 0,
          account.is_active !== false,
          account.created_at || new Date().toISOString(),
          account.updated_at || new Date().toISOString()
        ]);
        accountsInserted++;
      } catch (err) {
        if (err.code === '23505') { // Duplicate key
          accountsSkipped++;
        } else {
          throw err;
        }
      }
    }

    console.log(`  ✅ Inserted: ${accountsInserted} accounts`);
    console.log(`  ⚠️  Skipped: ${accountsSkipped} (already exist)\n`);

    // Seed merchants
    console.log('[2/3] Seeding merchants...');
    let merchantsInserted = 0;
    let merchantsSkipped = 0;

    for (const merchant of merchants) {
      try {
        await client.query(`
          INSERT INTO merchant_memory (
            id, user_id, merchant_pattern, merchant_display_name, category,
            gst_applicable, times_used, last_used, is_user_confirmed, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (id) DO UPDATE SET
            times_used = EXCLUDED.times_used,
            last_used = EXCLUDED.last_used
        `, [
          merchant.id,
          merchant.user_id,
          merchant.original_name || merchant.merchant_pattern,
          merchant.canonical_name || merchant.merchant_display_name,
          merchant.category || 'Uncategorized',
          merchant.gst_applicable !== false,
          merchant.frequency || merchant.times_used || 0,
          merchant.last_used || new Date().toISOString(),
          merchant.is_user_confirmed !== false,
          merchant.created_at || new Date().toISOString()
        ]);
        merchantsInserted++;
      } catch (err) {
        if (err.code === '23505') {
          merchantsSkipped++;
        } else {
          console.log(`    ⚠️  Merchant error: ${err.message}`);
          merchantsSkipped++;
        }
      }
    }

    console.log(`  ✅ Inserted: ${merchantsInserted} merchants`);
    console.log(`  ⚠️  Skipped: ${merchantsSkipped} (already exist)\n`);

    // Seed transactions
    console.log('[3/3] Seeding transactions...');
    console.log('  This may take a few minutes for 6,520 transactions...\n');
    
    let transactionsInserted = 0;
    let transactionsSkipped = 0;
    let errors = 0;

    for (let i = 0; i < transactions.length; i++) {
      const txn = transactions[i];

      try {
        await client.query(`
          INSERT INTO transactions (
            id, user_id, account_id, date, description, amount,
            balance, category, gst_amount, gst_applicable, merchant_normalized
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (id) DO NOTHING
        `, [
          txn.id,
          txn.user_id,
          txn.account_id,
          txn.date,
          txn.description,
          txn.amount,
          txn.balance,
          txn.category,
          txn.gst_amount,
          txn.gst_applicable !== false,
          txn.merchant_name || txn.merchant_normalized
        ]);
        transactionsInserted++;
      } catch (err) {
        if (err.code === '23505') {
          transactionsSkipped++;
        } else {
          errors++;
          if (errors <= 5) {
            console.log(`    ⚠️  Transaction ${i + 1} error: ${err.message}`);
          }
        }
      }

      // Progress indicator
      if ((i + 1) % 500 === 0) {
        process.stdout.write(`  Progress: ${i + 1}/${transactions.length} transactions processed\r`);
      }
    }

    console.log(`\n  ✅ Inserted: ${transactionsInserted} transactions`);
    console.log(`  ⚠️  Skipped: ${transactionsSkipped} (already exist)`);
    console.log(`  ❌ Errors: ${errors}\n`);

    // Commit transaction
    await client.query('COMMIT');
    console.log('✅ Transaction committed\n');

    // Verify data
    console.log('Verifying seeded data...');
    const verifyResults = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM accounts WHERE user_id = $1) as account_count,
        (SELECT COUNT(*) FROM merchant_memory WHERE user_id = $1) as merchant_count,
        (SELECT COUNT(*) FROM transactions WHERE user_id = $1) as transaction_count
    `, [ADMIN_USER_ID]);

    const { account_count, merchant_count, transaction_count } = verifyResults.rows[0];

    console.log('='.repeat(80));
    console.log('VERIFICATION RESULTS');
    console.log('='.repeat(80));
    console.log(`Accounts in Neon:     ${account_count}`);
    console.log(`Merchants in Neon:    ${merchant_count}`);
    console.log(`Transactions in Neon: ${transaction_count}`);
    console.log();

    if (transaction_count >= transactions.length) {
      console.log('🎉 All data seeded successfully!');
    } else {
      console.log(`⚠️  Expected ${transactions.length} transactions, found ${transaction_count}`);
    }

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error:', error.message);
    console.error('Transaction rolled back.');
    process.exit(1);
  } finally {
    await client.end();
  }
}

seedAdminData();

