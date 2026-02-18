#!/usr/bin/env node
/**
 * Apply tenant table fixes to Neon Cloud
 */

import pg from '../server/node_modules/pg/lib/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NEON_URL = 'postgresql://neondb_owner:npg_wmEJX7uUcHp3@ep-steep-waterfall-a7j76g5z.ap-southeast-2.aws.neon.tech/neondb?sslmode=require';

async function applyFix() {
  const client = new Client({ connectionString: NEON_URL });
  
  try {
    await client.connect();
    console.log('✓ Connected to Neon Cloud\n');

    // Read SQL file
    const sqlFile = path.join(__dirname, 'fix-tenant-tables.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    console.log('📊 Fixing tenant tables...\n');
    
    // Execute the SQL
    await client.query(sql);
    
    console.log('✅ Tenant tables fixed successfully!\n');

    // Verify
    const result = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'tenant_members' 
      ORDER BY ordinal_position
    `);
    
    console.log('✅ tenant_members columns:');
    result.rows.forEach(r => console.log(`   - ${r.column_name}`));
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Details:', error.detail || '');
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyFix();

