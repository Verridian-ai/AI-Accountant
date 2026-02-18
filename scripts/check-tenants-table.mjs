#!/usr/bin/env node
/**
 * Check if tenants and tenant_members tables exist in Neon
 */

import pg from '../server/node_modules/pg/lib/index.js';

const { Client } = pg;

const NEON_URL = 'postgresql://neondb_owner:npg_wmEJX7uUcHp3@ep-steep-waterfall-a7j76g5z.ap-southeast-2.aws.neon.tech/neondb?sslmode=require';

async function checkTables() {
  const client = new Client({ connectionString: NEON_URL });
  
  try {
    await client.connect();
    console.log('✓ Connected to Neon Cloud');

    // Check for tenants table
    const tenants = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%tenant%'
      ORDER BY table_name
    `);
    
    console.log('\n📋 Tenant-related tables:');
    console.table(tenants.rows);

    // Check if tenant_members exists
    const hasTenantMembers = tenants.rows.some(r => r.table_name === 'tenant_members');
    console.log('\n✅ tenant_members exists:', hasTenantMembers);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

checkTables();

