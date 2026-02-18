#!/usr/bin/env node
/**
 * Migrate full PostgreSQL schema from local Docker to Neon Cloud
 * This will create all missing tables in Neon
 */

import { execSync } from 'child_process';
import pg from '../server/node_modules/pg/lib/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NEON_URL = 'postgresql://neondb_owner:npg_wmEJX7uUcHp3@ep-steep-waterfall-a7j76g5z.ap-southeast-2.aws.neon.tech/neondb?sslmode=require';
const LOCAL_USER = 'app_user';
const LOCAL_DB = 'ai_accountant';

async function migrateSchema() {
  console.log('🚀 Starting full schema migration to Neon Cloud\n');
  
  try {
    // Step 1: Dump schema from local PostgreSQL
    console.log('[1/3] Dumping schema from local PostgreSQL...');
    const schemaDump = path.join(__dirname, '_neon_full_schema.sql');
    
    try {
      const schema = execSync(
        `docker compose exec -T postgres pg_dump -U ${LOCAL_USER} -d ${LOCAL_DB} --schema-only --no-owner --no-privileges --no-comments`,
        { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }
      );
      
      // Clean up the schema
      const cleaned = schema
        .split('\n')
        .filter(line => {
          const t = line.trim();
          // Skip extension creation (Neon already has these)
          if (t.startsWith('CREATE EXTENSION')) return false;
          if (t.startsWith('COMMENT ON EXTENSION')) return false;
          if (t.startsWith('SET ')) return false;
          if (t.startsWith('SELECT pg_catalog')) return false;
          if (t.startsWith('\\restrict')) return false;
          return true;
        })
        .join('\n');
      
      fs.writeFileSync(schemaDump, cleaned, 'utf8');
      console.log(`   ✅ Schema dumped (${(cleaned.length / 1024).toFixed(1)} KB)`);
      console.log(`   📄 Saved to: ${schemaDump}\n`);
    } catch (err) {
      console.error('   ❌ Failed to dump schema:', err.message);
      process.exit(1);
    }

    // Step 2: Connect to Neon
    console.log('[2/3] Connecting to Neon Cloud...');
    const client = new Client({ connectionString: NEON_URL });
    await client.connect();
    console.log('   ✅ Connected\n');

    // Step 3: Apply schema to Neon
    console.log('[3/3] Applying schema to Neon Cloud...');
    const schemaSQL = fs.readFileSync(schemaDump, 'utf8');

    // Try to apply the entire schema in one go
    console.log(`   📊 Applying full schema (${(schemaSQL.length / 1024).toFixed(1)} KB)...\n`);

    let created = 0;
    let skipped = 0;
    let errors = 0;

    try {
      await client.query(schemaSQL);
      console.log(`   ✅ Schema applied successfully in bulk!`);
      created = 1;
    } catch (err) {
      console.log(`   ⚠️  Bulk apply failed, trying statement-by-statement...`);
      console.log(`   Error: ${err.message.substring(0, 100)}\n`);

      // Fall back to statement-by-statement
      // Smart split that handles $$ delimiters
      const statements = [];
      let current = '';
      let inDollarQuote = false;

      for (const line of schemaSQL.split('\n')) {
        current += line + '\n';

        // Track $$ delimiters
        if (line.includes('$$')) {
          inDollarQuote = !inDollarQuote;
        }

        // End of statement if we see ; and not in dollar quote
        if (line.trim().endsWith(';') && !inDollarQuote) {
          statements.push(current.trim());
          current = '';
        }
      }

      console.log(`   📊 Processing ${statements.length} SQL statements...\n`);

      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        if (!stmt || stmt.startsWith('--') || stmt === '') continue;

        try {
          await client.query(stmt);
          created++;

          // Show progress every 20 statements
          if ((i + 1) % 20 === 0) {
            process.stdout.write(`   Progress: ${i + 1}/${statements.length} statements processed\r`);
          }
        } catch (err) {
          if (err.message.includes('already exists') || err.code === '42P07' || err.code === '42710') {
            skipped++;
          } else {
            errors++;
            if (errors <= 10) {
              console.log(`   ⚠️  [${i+1}] ${err.message.substring(0, 120)}`);
            }
          }
        }
      }
    }
    
    console.log(`\n\n   ✅ Schema migration complete!`);
    console.log(`   📊 Results:`);
    console.log(`      - Created: ${created} objects`);
    console.log(`      - Skipped: ${skipped} (already exist)`);
    console.log(`      - Errors:  ${errors}\n`);

    // Step 4: Verify tables
    console.log('[4/4] Verifying tables in Neon...');
    const result = await client.query(`
      SELECT count(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log(`   ✅ Total tables in Neon: ${result.rows[0].count}\n`);
    
    await client.end();
    
    console.log('🎉 Migration completed successfully!\n');
    console.log('Next steps:');
    console.log('  1. Verify login works: node scripts/test-login.mjs');
    console.log('  2. Check app at: http://localhost:8080\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

migrateSchema();

