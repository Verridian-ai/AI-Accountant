/**
 * Database adapter - uses SQLite locally, PostgreSQL in production
 */
import { drizzle as drizzleSqlite } from 'drizzle-orm/libsql';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { createClient } from '@libsql/client';
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

// Export the database instance
export const db = isProduction ? createPgDb() : createSqliteDb();

function createSqliteDb() {
    console.log('[DB] Using SQLite (local)');
    const client = createClient({ url: process.env.DATABASE_URL || 'file:sqlite.db' });
    return drizzleSqlite(client);
}

function createPgDb() {
    console.log('[DB] Using PostgreSQL (production)');
    const pool = new Pool({
        host: process.env.DB_HOST || '/cloudsql/' + process.env.CLOUD_SQL_CONNECTION_NAME,
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'ai_accountant',
        user: process.env.DB_USER || 'app_user',
        password: process.env.DB_PASSWORD,
        ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
    });
    return drizzlePg(pool);
}
