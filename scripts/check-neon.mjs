import pg from 'pg';
const { Client } = pg;

const client = new Client({ 
  connectionString: 'postgresql://neondb_owner:npg_wmEJX7uUcHp3@ep-steep-waterfall-a7j76g5z.ap-southeast-2.aws.neon.tech/neondb?sslmode=require' 
});

await client.connect();
const r = await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
console.log(`Neon tables: ${r.rows.length}`);
r.rows.forEach(row => console.log(`  - ${row.tablename}`));

const ext = await client.query("SELECT extname, extversion FROM pg_extension ORDER BY extname");
console.log(`\nExtensions:`);
ext.rows.forEach(row => console.log(`  - ${row.extname} v${row.extversion}`));

await client.end();
