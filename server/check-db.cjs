const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.resolve(__dirname, 'sqlite.db');
const db = new Database(dbPath);

const stmts = db.prepare('SELECT * FROM statements').all();
console.log('Statements:', stmts);

const txs = db.prepare('SELECT * FROM transactions').all();
console.log('Transactions:', txs);
