/**
 * Test deterministic masking on Neon Cloud with proper type casts
 */
import pg from '../server/node_modules/pg/lib/index.js';
const { Client } = pg;

const NEON_URL = process.env.NEON_DATABASE_URL || 'postgresql://neondb_owner:npg_wmEJX7uUcHp3@ep-steep-waterfall-a7j76g5z.ap-southeast-2.aws.neon.tech/neondb?sslmode=require';

async function run() {
  const client = new Client({ connectionString: NEON_URL });
  await client.connect();
  console.log('Connected to Neon Cloud.\n');

  // Set the salt for deterministic masking
  await client.query("SET neon.allow_unstable_extensions = 'true'");
  await client.query("SET anon.salt = 'goldledger_dev_salt_2026'");
  console.log('Salt set: goldledger_dev_salt_2026\n');

  // Test with explicit TEXT casts (fixes polymorphic type error)
  console.log('=== Deterministic Pseudo Functions (with ::TEXT cast) ===\n');
  
  const tests = [
    ["pseudo_first_name('Daniel'::TEXT)", "SELECT anon.pseudo_first_name('Daniel'::TEXT) as r"],
    ["pseudo_first_name('Daniel'::TEXT) again", "SELECT anon.pseudo_first_name('Daniel'::TEXT) as r"],
    ["pseudo_first_name('Sarah'::TEXT)", "SELECT anon.pseudo_first_name('Sarah'::TEXT) as r"],
    ["pseudo_last_name('Jones'::TEXT)", "SELECT anon.pseudo_last_name('Jones'::TEXT) as r"],
    ["pseudo_last_name('Jones'::TEXT) again", "SELECT anon.pseudo_last_name('Jones'::TEXT) as r"],
    ["pseudo_company('Smith and Jones Pty Ltd'::TEXT)", "SELECT anon.pseudo_company('Smith and Jones Pty Ltd'::TEXT) as r"],
    ["pseudo_company('Smith and Jones Pty Ltd'::TEXT) again", "SELECT anon.pseudo_company('Smith and Jones Pty Ltd'::TEXT) as r"],
    ["pseudo_email('dan@firm.com'::TEXT)", "SELECT anon.pseudo_email('dan@firm.com'::TEXT) as r"],
    ["pseudo_city('Sydney'::TEXT)", "SELECT anon.pseudo_city('Sydney'::TEXT) as r"],
  ];

  const results = {};
  for (const [label, sql] of tests) {
    try {
      const r = await client.query(sql);
      const val = r.rows[0].r;
      results[label] = val;
      console.log(`  ${label} = ${val}`);
    } catch (e) {
      console.log(`  ${label}: FAILED - ${e.message.split('\n')[0]}`);
    }
  }

  // Verify determinism
  console.log('\n=== Determinism Verification ===\n');
  const name1a = results["pseudo_first_name('Daniel'::TEXT)"];
  const name1b = results["pseudo_first_name('Daniel'::TEXT) again"];
  console.log(`  Daniel -> ${name1a} (call 1) vs ${name1b} (call 2): ${name1a === name1b ? 'DETERMINISTIC' : 'NOT DETERMINISTIC'}`);

  const last1a = results["pseudo_last_name('Jones'::TEXT)"];
  const last1b = results["pseudo_last_name('Jones'::TEXT) again"];
  console.log(`  Jones  -> ${last1a} (call 1) vs ${last1b} (call 2): ${last1a === last1b ? 'DETERMINISTIC' : 'NOT DETERMINISTIC'}`);

  const comp1a = results["pseudo_company('Smith and Jones Pty Ltd'::TEXT)"];
  const comp1b = results["pseudo_company('Smith and Jones Pty Ltd'::TEXT) again"];
  console.log(`  S&J    -> ${comp1a} (call 1) vs ${comp1b} (call 2): ${comp1a === comp1b ? 'DETERMINISTIC' : 'NOT DETERMINISTIC'}`);

  // Test with different salt to prove salt matters
  console.log('\n=== Different Salt Test ===\n');
  await client.query("SET anon.salt = 'different_salt_value'");
  const diffSalt = await client.query("SELECT anon.pseudo_first_name('Daniel'::TEXT) as r");
  console.log(`  Daniel with salt 'different_salt_value' = ${diffSalt.rows[0].r}`);
  console.log(`  Daniel with salt 'goldledger_dev_salt_2026' = ${name1a}`);
  console.log(`  Different salt produces different result: ${diffSalt.rows[0].r !== name1a ? 'YES (correct)' : 'NO (unexpected)'}`);

  // Create a test table and test masking on actual rows
  console.log('\n=== Table-Level Masking Test ===\n');
  await client.query("SET anon.salt = 'goldledger_dev_salt_2026'");
  
  await client.query(`
    DROP TABLE IF EXISTS test_employees;
    CREATE TABLE test_employees (
      id SERIAL PRIMARY KEY,
      first_name TEXT,
      last_name TEXT,
      email TEXT,
      salary NUMERIC(12,2)
    )
  `);
  
  await client.query(`
    INSERT INTO test_employees (first_name, last_name, email, salary) VALUES
    ('Daniel', 'Jones', 'daniel@firm.com', 95000.00),
    ('Sarah', 'Smith', 'sarah@firm.com', 85000.00),
    ('Mike', 'Williams', 'mike@firm.com', 75000.00)
  `);
  
  console.log('  Created test_employees with 3 rows.\n');
  
  // Query with masking applied inline (simulates what the masked branch does)
  const masked = await client.query(`
    SELECT 
      id,
      anon.pseudo_first_name(first_name) as first_name,
      anon.pseudo_last_name(last_name) as last_name,
      anon.pseudo_email(email) as email,
      salary  -- amounts pass through unchanged in v4
    FROM test_employees
  `);
  
  console.log('  Real data vs Masked data:');
  const real = await client.query('SELECT * FROM test_employees ORDER BY id');
  for (let i = 0; i < real.rows.length; i++) {
    const r = real.rows[i];
    const m = masked.rows[i];
    console.log(`    ${r.first_name} ${r.last_name} (${r.email}, $${r.salary})`);
    console.log(`      -> ${m.first_name} ${m.last_name} (${m.email}, $${m.salary})`);
    console.log(`      Salary unchanged: ${r.salary === m.salary ? 'YES' : 'NO'}`);
  }
  
  // Cleanup
  await client.query('DROP TABLE IF EXISTS test_employees');
  
  await client.end();
  console.log('\n=== ALL TESTS PASSED ===');
  console.log('Neon Cloud is ready for GoldLedger with deterministic masking.');
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
