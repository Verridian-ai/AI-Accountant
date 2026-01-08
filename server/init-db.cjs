const { createClient } = require('@libsql/client');
const path = require('path');

async function main() {
  const dbPath = path.resolve(__dirname, 'sqlite.db');
  console.log('Opening DB at:', dbPath);

  const client = createClient({ url: `file:${dbPath}` });

  console.log('Initializing Database...');

  await client.execute(`
    CREATE TABLE IF NOT EXISTS statements (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        hash TEXT NOT NULL UNIQUE,
        upload_date TEXT NOT NULL,
        parsing_status TEXT NOT NULL DEFAULT 'PENDING',
        ai_model_used TEXT
    );
    `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        description TEXT NOT NULL,
        amount INTEGER NOT NULL,
        balance INTEGER,
        category TEXT,
        gst_applicable INTEGER DEFAULT 0,
        ai_reasoning_notes TEXT,
        confidence_score REAL DEFAULT 1.0,
        statement_id TEXT,
        FOREIGN KEY(statement_id) REFERENCES statements(id)
    );
    `);

  console.log('Database initialized successfully.');
}

main().catch(console.error);
