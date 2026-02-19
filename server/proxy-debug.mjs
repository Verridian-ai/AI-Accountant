/**
 * Debug the wrapPgDb proxy chain to find where .all() breaks
 */
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { eq } from 'drizzle-orm';

const pool = new pg.Pool({
  connectionString: 'postgresql://neondb_owner:npg_wmEJX7uUcHp3@ep-steep-waterfall-a7j76g5z.ap-southeast-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false },
});

function coerceNumericStrings(row) {
  if (!row || typeof row !== 'object') return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (typeof v === 'string' && v !== '' && !isNaN(Number(v))) out[k] = Number(v);
    else out[k] = v;
  }
  return out;
}

function addSqliteCompat(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (obj.__pgWrapped) return obj;
  return new Proxy(obj, {
    get(target, prop, receiver) {
      if (prop === '__pgWrapped') return true;
      if (prop === 'get') {
        return async function () {
          const rows = await target;
          const row = Array.isArray(rows) ? (rows[0] ?? undefined) : rows;
          return coerceNumericStrings(row);
        };
      }
      if (prop === 'all') {
        return async function () {
          const rows = await target;
          const arr = Array.isArray(rows) ? rows : [rows];
          return arr.map(coerceNumericStrings);
        };
      }
      if (prop === 'run') {
        return async function () { return await target; };
      }
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === 'function') {
        return function (...args) {
          const result = Reflect.apply(value, target, args);
          if (result && typeof result === 'object') return addSqliteCompat(result);
          return result;
        };
      }
      return value;
    },
  });
}

function wrapPgDb(pgDb) {
  return new Proxy(pgDb, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === 'function') {
        return function (...args) {
          const result = Reflect.apply(value, target, args);
          if (result && typeof result === 'object') return addSqliteCompat(result);
          return result;
        };
      }
      return value;
    },
  });
}

const rawDb = drizzle(pool);
const db = wrapPgDb(rawDb);

// Define a simple table
const statements = sqliteTable('statements', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  filename: text('filename'),
  uploadDate: text('upload_date'),
  parsingStatus: text('parsing_status'),
});

// Test the chain step by step
console.log('Step 1: db.select()');
const s1 = db.select();
console.log('  __pgWrapped:', s1.__pgWrapped);
console.log('  has .from:', typeof s1.from);

console.log('Step 2: .from(statements)');
const s2 = s1.from(statements);
console.log('  __pgWrapped:', s2.__pgWrapped);
console.log('  has .where:', typeof s2.where);

console.log('Step 3: .where(...)');
const s3 = s2.where(eq(statements.userId, 'test-user'));
console.log('  __pgWrapped:', s3.__pgWrapped);
console.log('  has .orderBy:', typeof s3.orderBy);

console.log('Step 4: .orderBy(...)');
const s4 = s3.orderBy(statements.uploadDate);
console.log('  __pgWrapped:', s4.__pgWrapped);
console.log('  has .limit:', typeof s4.limit);

console.log('Step 5: .limit(10)');
const s5 = s4.limit(10);
console.log('  __pgWrapped:', s5.__pgWrapped);
console.log('  has .all:', typeof s5.all);
console.log('  has .offset:', typeof s5.offset);

console.log('Step 6: .offset(0)');
const s6 = s5.offset(0);
console.log('  __pgWrapped:', s6.__pgWrapped);
console.log('  has .all:', typeof s6.all);

if (typeof s6.all === 'function') {
  console.log('\nStep 7: calling .all()...');
  try {
    const rows = await s6.all();
    console.log(`  ✅ .all() returned ${rows.length} rows`);
  } catch (e) {
    console.log(`  ❌ .all() threw: ${e.message}`);
  }
} else {
  console.log('\n❌ .all() is not a function on the final chain!');
  console.log('  type:', typeof s6.all);
  // Check what properties exist
  const keys = [];
  for (const k of ['all', 'get', 'run', 'execute', 'then', 'catch']) {
    keys.push(`${k}:${typeof s6[k]}`);
  }
  console.log('  available:', keys.join(', '));
}

await pool.end();
