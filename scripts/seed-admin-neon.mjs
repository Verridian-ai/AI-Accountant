#!/usr/bin/env node
/**
 * Seed admin user in Neon Cloud database
 * Username: admin
 * Password: admin123
 */

import pg from '../server/node_modules/pg/lib/index.js';
import bcrypt from '../server/node_modules/bcryptjs/index.js';
import crypto from 'crypto';

const { Client } = pg;

const NEON_URL = 'postgresql://neondb_owner:npg_wmEJX7uUcHp3@ep-steep-waterfall-a7j76g5z.ap-southeast-2.aws.neon.tech/neondb?sslmode=require';

async function seedAdmin() {
  const client = new Client({ connectionString: NEON_URL });
  
  try {
    await client.connect();
    console.log('✓ Connected to Neon Cloud');

    // Create admin_users table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT,
        display_name TEXT,
        role TEXT NOT NULL DEFAULT 'admin',
        permissions TEXT NOT NULL DEFAULT '[]',
        is_active BOOLEAN NOT NULL DEFAULT true,
        last_login_at TEXT,
        login_count INTEGER NOT NULL DEFAULT 0,
        failed_login_count INTEGER NOT NULL DEFAULT 0,
        locked_until TEXT,
        mfa_secret TEXT,
        mfa_enabled BOOLEAN NOT NULL DEFAULT false,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    console.log('✓ admin_users table ready');

    // Check if admin already exists
    const existing = await client.query('SELECT id FROM admin_users WHERE username = $1', ['admin']);
    
    if (existing.rows.length > 0) {
      console.log('⚠ Admin user already exists, updating password...');
      const passwordHash = await bcrypt.hash('admin123', 10);
      await client.query(
        'UPDATE admin_users SET password_hash = $1, updated_at = $2 WHERE username = $3',
        [passwordHash, new Date().toISOString(), 'admin']
      );
      console.log('✓ Admin password updated');
    } else {
      // Create new admin user
      const id = crypto.randomUUID();
      const passwordHash = await bcrypt.hash('admin123', 10);
      const now = new Date().toISOString();
      
      await client.query(`
        INSERT INTO admin_users (
          id, username, email, password_hash, display_name, role, permissions,
          is_active, login_count, failed_login_count, mfa_enabled, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        id,
        'admin',
        'admin@goldledger.local',
        passwordHash,
        'Super Admin',
        'super_admin',
        JSON.stringify([
          'admin.users.manage',
          'admin.agents.manage',
          'admin.system.manage',
          'admin.cognee.manage',
          'admin.features.manage',
          'admin.metrics.view',
          'admin.logs.view',
        ]),
        true,
        0,
        0,
        false,
        now,
        now
      ]);
      console.log('✓ Admin user created');
    }

    console.log('\n✅ Admin credentials:');
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

seedAdmin();

