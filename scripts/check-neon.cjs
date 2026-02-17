const pg = require('../server/node_modules/pg');
const client = new pg.Client({ 
  connectionString: 'postgresql://neondb_owner:npg_wmEJX7uUcHp3@ep-steep-waterfall-a7j76g5z.ap-southeast-2.aws.neon.tech/neondb?sslmode=require' 
});

client.connect()
  .then(() => client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"))
  .then(r => {
    console.log('Neon tables:', r.rows.length);
    r.rows.forEach(row => console.log('  -', row.tablename));
    return client.query("SELECT extname, extversion FROM pg_extension ORDER BY extname");
  })
  .then(r => {
    console.log('\nExtensions:');
    r.rows.forEach(row => console.log('  - ' + row.extname + ' v' + row.extversion));
    return client.end();
  })
  .catch(e => { console.error(e.message); process.exit(1); });
