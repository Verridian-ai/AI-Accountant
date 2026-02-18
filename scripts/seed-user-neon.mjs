#!/usr/bin/env node
/**
 * Seed regular user in Neon Cloud database
 * Username: admin
 * Password: admin123
 */

import pg from '../server/node_modules/pg/lib/index.js';
import bcrypt from '../server/node_modules/bcryptjs/index.js';
import crypto from 'crypto';

const { Client } = pg;

const NEON_URL = 'postgresql://neondb_owner:npg_wmEJX7uUcHp3@ep-steep-waterfall-a7j76g5z.ap-southeast-2.aws.neon.tech/neondb?sslmode=require';

async function seedUser() {
  const client = new Client({ connectionString: NEON_URL });
  
  try {
    await client.connect();
    console.log('✓ Connected to Neon Cloud');

    // Create users table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    console.log('✓ users table ready');

    // Check if user already exists
    const existing = await client.query('SELECT id FROM users WHERE username = $1', ['admin']);
    
    if (existing.rows.length > 0) {
      console.log('⚠ User already exists, updating password...');
      const passwordHash = await bcrypt.hash('admin123', 10);
      await client.query(
        'UPDATE users SET password_hash = $1, updated_at = $2 WHERE username = $3',
        [passwordHash, new Date().toISOString(), 'admin']
      );
      console.log('✓ User password updated');
    } else {
      // Create new user
      const id = crypto.randomUUID();
      const passwordHash = await bcrypt.hash('admin123', 10);
      const now = new Date().toISOString();
      
      await client.query(`
        INSERT INTO users (id, username, password_hash, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5)
      `, [id, 'admin', passwordHash, now, now]);
      console.log('✓ User created');
    }

    console.log('\n✅ User credentials:');
    console.log('   Username: admin');
    console.log('   Password: admin123');
    console.log('\n   Login at: http://localhost:8080');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seedUser();

