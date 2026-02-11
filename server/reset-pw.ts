import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve('sqlite.db');
console.log('DB path:', dbPath);
const db = new Database(dbPath);
const hash = bcrypt.hashSync('admin123', 10);
console.log('New hash:', hash);
const result = (db.prepare('UPDATE users SET password_hash = ? WHERE username = ?') as any).run(hash, 'ADMIN');
console.log('Updated rows:', result.changes);

// Verify
const user = db.prepare('SELECT password_hash FROM users WHERE username = ?').get('ADMIN') as any;
console.log('Stored hash:', user.password_hash);
console.log('Match:', bcrypt.compareSync('admin123', user.password_hash));
db.close();
