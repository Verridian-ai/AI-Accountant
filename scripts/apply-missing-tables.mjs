#!/usr/bin/env node
/**
 * Apply missing tables SQL to Neon Cloud
 */

import pg from '../server/node_modules/pg/lib/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NEON_URL = 'postgresql://neondb_owner:npg_wmEJX7uUcHp3@ep-steep-waterfall-a7j76g5z.ap-southeast-2.aws.neon.tech/neondb?sslmode=require';

async function applyMissingTables() {
  const client = new Client({ connectionString: NEON_URL });
  
  try {
    await client.connect();
    console.log('✓ Connected to Neon Cloud\n');

    // Read SQL file
    const sqlFile = path.join(__dirname, 'create-missing-tables.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    console.log('📊 Applying missing tables SQL...\n');
    
    // Execute the SQL
    await client.query(sql);
    
    console.log('✅ All missing tables created successfully!\n');

    // Verify table count
    const result = await client.query(`
      SELECT count(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log(`📊 Total tables in Neon: ${result.rows[0].count}\n`);
    
    // List tenant tables to verify
    const tenantTables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%tenant%'
      ORDER BY table_name
    `);
    
    console.log('✅ Tenant tables created:');
    tenantTables.rows.forEach(r => console.log(`   - ${r.table_name}`));
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Details:', error.detail || '');
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMissingTables();

