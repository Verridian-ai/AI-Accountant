#!/usr/bin/env node
/**
 * Check Neon database schema for accounts, transactions, and merchant_memory tables
 */

import pg from '../server/node_modules/pg/lib/index.js';

const { Client } = pg;
const NEON_URL = 'postgresql://neondb_owner:npg_wmEJX7uUcHp3@ep-steep-waterfall-a7j76g5z.ap-southeast-2.aws.neon.tech/neondb?sslmode=require';

async function checkSchema() {
  const client = new Client({ connectionString: NEON_URL });
  
  try {
    await client.connect();
    console.log('✓ Connected to Neon Cloud\n');

    const tables = ['accounts', 'transactions', 'merchant_memory'];

    for (const table of tables) {
      console.log(`\n${table.toUpperCase()} TABLE COLUMNS:`);
      console.log('='.repeat(80));
      
      const result = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [table]);

      if (result.rows.length === 0) {
        console.log(`  ⚠️  Table '${table}' not found`);
      } else {
        result.rows.forEach(col => {
          console.log(`  ${col.column_name.padEnd(30)} ${col.data_type.padEnd(20)} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkSchema();

