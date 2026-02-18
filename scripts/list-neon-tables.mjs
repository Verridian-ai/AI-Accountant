#!/usr/bin/env node
/**
 * List all tables in Neon Cloud database
 */

import pg from '../server/node_modules/pg/lib/index.js';

const { Client } = pg;

const NEON_URL = 'postgresql://neondb_owner:npg_wmEJX7uUcHp3@ep-steep-waterfall-a7j76g5z.ap-southeast-2.aws.neon.tech/neondb?sslmode=require';

async function listTables() {
  const client = new Client({ connectionString: NEON_URL });
  
  try {
    await client.connect();
    console.log('✓ Connected to Neon Cloud');

    // List all tables
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('\n📋 Tables in Neon database:');
    console.table(result.rows);
    console.log(`\nTotal: ${result.rows.length} tables`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

listTables();

