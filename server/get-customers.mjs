import pg from 'pg';
const { Client } = pg;
const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_wmEJX7uUcHp3@ep-steep-waterfall-a7j76g5z.ap-southeast-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false },
});
await client.connect();
const tables = ['customers','customer_contacts','invoice_payments'];
for (const tbl of tables) {
  const r = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,[tbl]);
  if (r.rows.length === 0) { console.log(`${tbl}: NOT FOUND`); continue; }
  console.log(`${tbl}: ${r.rows.map(c=>c.column_name).join(', ')}`);
}
await client.end();
