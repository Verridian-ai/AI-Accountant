/**
 * Neon DB Setup Script
 * Creates extensions, tests connection, and enables anon for masking
 */
import pg from '../server/node_modules/pg/lib/index.js';
const { Client } = pg;

const NEON_URL = process.env.NEON_DATABASE_URL || 'postgresql://neondb_owner:npg_wmEJX7uUcHp3@ep-steep-waterfall-a7j76g5z.ap-southeast-2.aws.neon.tech/neondb?sslmode=require';

async function run() {
  console.log('Connecting to Neon Cloud...');
  const client = new Client({ connectionString: NEON_URL });
  
  try {
    await client.connect();
    console.log('Connected successfully!');
    
    // Check version
    const version = await client.query('SELECT version()');
    console.log('PostgreSQL:', version.rows[0].version.split(',')[0]);
    
    // Enable extensions
    console.log('\nEnabling extensions...');
    
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    console.log('  uuid-ossp: OK');
    
    await client.query('CREATE EXTENSION IF NOT EXISTS "pg_trgm"');
    console.log('  pg_trgm: OK');
    
    await client.query("SET neon.allow_unstable_extensions = 'true'");
    await client.query('CREATE EXTENSION IF NOT EXISTS anon CASCADE');
    console.log('  anon: OK');
    
    const initResult = await client.query('SELECT anon.init()');
    console.log('  anon.init(): OK');
    
    // Try different approaches to set the salt
    console.log('\nTesting salt configuration approaches...');
    
    // Approach 1: Session-level SET
    try {
      await client.query("SET anon.salt = 'goldledger_dev_salt_2026'");
      console.log('  SET anon.salt (session): OK');
    } catch (e) {
      console.log('  SET anon.salt (session): FAILED -', e.message);
    }
    
    // Approach 2: Check current salt
    try {
      const salt = await client.query("SHOW anon.salt");
      console.log('  Current anon.salt:', salt.rows[0].anon_salt || salt.rows[0]['anon.salt'] || JSON.stringify(salt.rows[0]));
    } catch (e) {
      console.log('  SHOW anon.salt: FAILED -', e.message);
    }
    
    // Test basic anon functions (some don't need salt)
    console.log('\nTesting anon functions...');
    
    const tests = [
      ["anon.fake_first_name()", "SELECT anon.fake_first_name() as result"],
      ["anon.fake_last_name()", "SELECT anon.fake_last_name() as result"],
      ["anon.fake_company()", "SELECT anon.fake_company() as result"],
      ["anon.fake_email()", "SELECT anon.fake_email() as result"],
      ["anon.partial('123-456-789', 0, '***-***-***', 0)", "SELECT anon.partial('123-456-789', 0, '***-***-***', 0) as result"],
      ["anon.pseudo_first_name('Daniel')", "SELECT anon.pseudo_first_name('Daniel') as result"],
      ["anon.pseudo_last_name('Jones')", "SELECT anon.pseudo_last_name('Jones') as result"],
      ["anon.pseudo_company('Smith and Jones')", "SELECT anon.pseudo_company('Smith and Jones') as result"],
      ["anon.pseudo_email('dan@firm.com')", "SELECT anon.pseudo_email('dan@firm.com') as result"],
    ];
    
    for (const [label, sql] of tests) {
      try {
        const r = await client.query(sql);
        console.log(`  ${label} = ${r.rows[0].result}`);
      } catch (e) {
        console.log(`  ${label}: FAILED - ${e.message.split('\n')[0]}`);
      }
    }
    
    // Test determinism (run same pseudo function twice)
    console.log('\nDeterminism test (pseudo_first_name called twice with same input):');
    try {
      const t1 = await client.query("SELECT anon.pseudo_first_name('Daniel') as r");
      const t2 = await client.query("SELECT anon.pseudo_first_name('Daniel') as r");
      console.log(`  Call 1: ${t1.rows[0].r}`);
      console.log(`  Call 2: ${t2.rows[0].r}`);
      console.log(`  Deterministic: ${t1.rows[0].r === t2.rows[0].r ? 'YES' : 'NO'}`);
    } catch (e) {
      console.log(`  FAILED: ${e.message.split('\n')[0]}`);
    }
    
    // List installed extensions
    const exts = await client.query("SELECT extname, extversion FROM pg_extension ORDER BY extname");
    console.log('\nInstalled extensions:');
    exts.rows.forEach(r => console.log(`  ${r.extname} v${r.extversion}`));
    
    // Check available anon functions
    const funcs = await client.query(`
      SELECT routine_name FROM information_schema.routines 
      WHERE routine_schema = 'anon' 
      ORDER BY routine_name
    `);
    console.log(`\nAvailable anon functions: ${funcs.rows.length} total`);
    const uniqueNames = [...new Set(funcs.rows.map(r => r.routine_name))];
    console.log('  ' + uniqueNames.slice(0, 30).join(', '));
    if (uniqueNames.length > 30) console.log(`  ... and ${uniqueNames.length - 30} more`);
    
    await client.end();
    console.log('\n=== NEON SETUP COMPLETE ===');
    
  } catch (err) {
    console.error('Error:', err.message);
    try { await client.end(); } catch(_) {}
    process.exit(1);
  }
}

run().catch(console.error);
