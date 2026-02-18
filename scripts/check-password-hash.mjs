#!/usr/bin/env node
/**
 * Check password hash in Neon Cloud database
 */

import pg from '../server/node_modules/pg/lib/index.js';
import bcrypt from '../server/node_modules/bcryptjs/index.js';

const { Client } = pg;

const NEON_URL = 'postgresql://neondb_owner:npg_wmEJX7uUcHp3@ep-steep-waterfall-a7j76g5z.ap-southeast-2.aws.neon.tech/neondb?sslmode=require';

async function checkPassword() {
  const client = new Client({ connectionString: NEON_URL });
  
  try {
    await client.connect();
    console.log('✓ Connected to Neon Cloud');

    // Get the user
    const result = await client.query('SELECT id, username, password_hash FROM users WHERE username = $1', ['admin']);
    
    if (result.rows.length === 0) {
      console.log('❌ User not found');
      return;
    }

    const user = result.rows[0];
    console.log('\n📋 User found:');
    console.log('  ID:', user.id);
    console.log('  Username:', user.username);
    console.log('  Password hash:', user.password_hash?.substring(0, 60) + '...');

    // Test password
    const testPassword = 'admin123';
    const isValid = await bcrypt.compare(testPassword, user.password_hash);
    
    console.log('\n🔐 Password test:');
    console.log('  Test password:', testPassword);
    console.log('  Match:', isValid ? '✅ YES' : '❌ NO');

    if (!isValid) {
      console.log('\n🔧 Regenerating password hash...');
      const newHash = await bcrypt.hash(testPassword, 10);
      await client.query('UPDATE users SET password_hash = $1 WHERE username = $2', [newHash, 'admin']);
      console.log('✅ Password hash updated');
      
      // Verify again
      const verifyResult = await client.query('SELECT password_hash FROM users WHERE username = $1', ['admin']);
      const verified = await bcrypt.compare(testPassword, verifyResult.rows[0].password_hash);
      console.log('✅ Verification:', verified ? 'SUCCESS' : 'FAILED');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

checkPassword();

