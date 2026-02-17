/**
 * migrate-to-neon.cjs — Migrate local PostgreSQL data to Neon Cloud
 * 
 * Exports schema + data from local Docker PostgreSQL, then imports into Neon Cloud.
 * Uses pg_dump via Docker exec and pg client for Neon.
 * 
 * Usage: node scripts/migrate-to-neon.cjs
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const pg = require('../server/node_modules/pg');

const ROOT = path.resolve(__dirname, '..');
const envFile = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
function envVal(key) {
  const m = envFile.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return m ? m[1].trim() : '';
}

const NEON_URL = envVal('NEON_DATABASE_URL');
const LOCAL_USER = envVal('POSTGRES_USER') || 'app_user';
const LOCAL_DB = envVal('POSTGRES_DB') || 'ai_accountant';

if (!NEON_URL) { console.error('ERROR: NEON_DATABASE_URL not set in .env'); process.exit(1); }

async function main() {
  console.log('=== GoldLedger: Local -> Neon Cloud Migration ===\n');
  
  // Step 1: Dump schema from local DB (schema only, no extensions, no ownership)
  console.log('[1/4] Dumping schema from local PostgreSQL...');
  const schemaDump = path.join(ROOT, 'scripts', '_neon_schema.sql');
  try {
    const schema = execSync(
      `docker compose exec -T postgres pg_dump -U ${LOCAL_USER} -d ${LOCAL_DB} --schema-only --no-owner --no-privileges --no-comments --no-tablespaces`,
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }
    );
    // Filter out extension statements, SET statements, and SELECT pg_catalog lines
    const cleaned = schema
      .split('\n')
      .filter(line => {
        const t = line.trim();
        if (t.startsWith('CREATE EXTENSION')) return false;
        if (t.startsWith('COMMENT ON EXTENSION')) return false;
        return true;
      })
      .join('\n');
    fs.writeFileSync(schemaDump, cleaned, 'utf8');
    console.log(`   Schema dumped (${(cleaned.length / 1024).toFixed(1)} KB)`);
  } catch (err) {
    console.error('   Failed to dump schema:', err.message);
    process.exit(1);
  }

  // Step 2: Dump data from local DB
  console.log('[2/4] Dumping data from local PostgreSQL...');
  const dataDump = path.join(ROOT, 'scripts', '_neon_data.sql');
  try {
    const data = execSync(
      `docker compose exec -T postgres pg_dump -U ${LOCAL_USER} -d ${LOCAL_DB} --data-only --no-owner --no-privileges --disable-triggers --inserts`,
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 100 * 1024 * 1024 }
    );
    fs.writeFileSync(dataDump, data, 'utf8');
    console.log(`   Data dumped (${(data.length / 1024).toFixed(1)} KB)`);
  } catch (err) {
    console.error('   Failed to dump data:', err.message);
    process.exit(1);
  }

  // Step 3: Connect to Neon and apply schema
  console.log('[3/4] Applying schema to Neon Cloud...');
  const neonClient = new pg.Client({ connectionString: NEON_URL });
  await neonClient.connect();

  // Extensions are already enabled from previous setup
  console.log('   Extensions already enabled (anon v2.5.1, uuid-ossp, pg_trgm).');
  
  const schemaSQL = fs.readFileSync(schemaDump, 'utf8');
  
  // Execute the entire schema as one transaction
  try {
    await neonClient.query('BEGIN');
    await neonClient.query(schemaSQL);
    await neonClient.query('COMMIT');
    console.log('   Schema applied successfully.');
  } catch (err) {
    await neonClient.query('ROLLBACK');
    console.log('   Bulk schema failed, trying statement by statement...');
    
    // Fall back to statement-by-statement
    const statements = schemaSQL.split(/;\s*\n/).filter(s => s.trim().length > 0);
    let applied = 0, skipped = 0;
    for (const stmt of statements) {
      const trimmed = stmt.trim();
      if (!trimmed || trimmed.startsWith('--') || trimmed === '') continue;
      // Skip SET, SELECT pg_catalog
      if (/^(SET |SELECT pg_catalog\.|CREATE EXTENSION)/i.test(trimmed)) { skipped++; continue; }
      try {
        await neonClient.query(trimmed + ';');
        applied++;
      } catch (err2) {
        if (err2.message.includes('already exists')) {
          skipped++;
        } else {
          skipped++;
          // Only log first few unique errors
          if (skipped <= 5) console.warn(`   WARN: ${err2.message.substring(0, 120)}`);
        }
      }
    }
    console.log(`   Schema: ${applied} applied, ${skipped} skipped.`);
  }

  // Step 4: Import data
  console.log('[4/4] Importing data to Neon Cloud...');
  const dataSQL = fs.readFileSync(dataDump, 'utf8');
  const lines = dataSQL.split('\n');
  
  let imported = 0, errors = 0, batch = [];
  const BATCH_SIZE = 50;
  
  async function flushBatch() {
    if (batch.length === 0) return;
    const sql = batch.join('\n');
    try {
      await neonClient.query(sql);
      imported += batch.length;
    } catch (err) {
      // Try one by one
      for (const stmt of batch) {
        try {
          await neonClient.query(stmt);
          imported++;
        } catch (err2) {
          if (!err2.message.includes('duplicate key')) {
            errors++;
          }
        }
      }
    }
    batch = [];
  }
  
  let currentStmt = '';
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('--') || trimmed === '' || trimmed.startsWith('SET ') || trimmed.startsWith('SELECT ')) {
      continue;
    }
    currentStmt += line + '\n';
    if (line.trim().endsWith(';')) {
      batch.push(currentStmt.trim());
      currentStmt = '';
      if (batch.length >= BATCH_SIZE) {
        await flushBatch();
        if ((imported + errors) % 500 === 0) {
          process.stdout.write(`   Progress: ${imported} imported, ${errors} errors...\r`);
        }
      }
    }
  }
  if (currentStmt.trim()) batch.push(currentStmt.trim());
  await flushBatch();
  
  console.log(`\n   Data: ${imported} statements imported, ${errors} errors.`);

  // Verify
  console.log('\n=== Verification ===');
  const tables = await neonClient.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
  console.log(`Neon tables: ${tables.rows.length}`);
  
  for (const tbl of ['transactions', 'accounts', 'users', 'statements', 'chart_of_accounts', 'journal_entries']) {
    try {
      const count = await neonClient.query(`SELECT count(*) as c FROM "${tbl}"`);
      console.log(`  ${tbl}: ${count.rows[0].c} rows`);
    } catch (e) {
      console.log(`  ${tbl}: ERROR - ${e.message.substring(0, 80)}`);
    }
  }

  await neonClient.end();
  
  // Clean up dump files
  try { fs.unlinkSync(schemaDump); } catch (_) {}
  try { fs.unlinkSync(dataDump); } catch (_) {}
  
  console.log('\n=== Migration Complete ===');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
