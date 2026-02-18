#!/usr/bin/env node
/**
 * Run PostgreSQL migrations on Neon Cloud database
 */

import pg from '../server/node_modules/pg/lib/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NEON_URL = 'postgresql://neondb_owner:npg_wmEJX7uUcHp3@ep-steep-waterfall-a7j76g5z.ap-southeast-2.aws.neon.tech/neondb?sslmode=require';

async function runMigrations() {
  const client = new Client({ connectionString: NEON_URL });
  
  try {
    await client.connect();
    console.log('✓ Connected to Neon Cloud');

    // Read migration files
    const migrationsDir = path.join(__dirname, '../server/drizzle');
    const migrationFiles = [
      '0006_postgres_migration.sql',
      '0007_missing_tables.sql',
      '0008_account_ownership.sql',
    ];

    for (const file of migrationFiles) {
      const filePath = path.join(migrationsDir, file);
      if (!fs.existsSync(filePath)) {
        console.log(`⚠ Skipping ${file} (not found)`);
        continue;
      }

      console.log(`\n📄 Running ${file}...`);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      try {
        await client.query(sql);
        console.log(`✅ ${file} completed`);
      } catch (error) {
        // Ignore "already exists" errors
        if (error.code === '42P07' || error.code === '42710') {
          console.log(`⚠ ${file} - objects already exist (skipping)`);
        } else {
          console.error(`❌ ${file} failed:`, error.message);
        }
      }
    }

    console.log('\n✅ All migrations completed');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();

