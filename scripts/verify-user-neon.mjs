#!/usr/bin/env node
/**
 * Verify user exists in Neon Cloud database
 */

import pg from '../server/node_modules/pg/lib/index.js';

const { Client } = pg;

const NEON_URL = 'postgresql://neondb_owner:npg_wmEJX7uUcHp3@ep-steep-waterfall-a7j76g5z.ap-southeast-2.aws.neon.tech/neondb?sslmode=require';

async function verifyUser() {
  const client = new Client({ connectionString: NEON_URL });
  
  try {
    await client.connect();
    console.log('✓ Connected to Neon Cloud');

    // Check users table
    const users = await client.query('SELECT id, username, created_at FROM users');
    console.log('\n📋 Users in database:');
    console.table(users.rows);

    // Check admin_users table
    const adminUsers = await client.query('SELECT id, username, email, role, is_active FROM admin_users');
    console.log('\n👑 Admin users in database:');
    console.table(adminUsers.rows);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

verifyUser();

