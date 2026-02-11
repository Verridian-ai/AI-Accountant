import Database from 'better-sqlite3';

const db = new Database('sqlite.db');

console.log('Initializing Database...');

db.exec(`
  CREATE TABLE IF NOT EXISTS statements (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    hash TEXT NOT NULL UNIQUE,
    upload_date TEXT NOT NULL,
    parsing_status TEXT NOT NULL DEFAULT 'PENDING',
    ai_model_used TEXT
  );
`);

db.exec(`
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
