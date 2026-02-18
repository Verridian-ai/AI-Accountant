/**
 * Database connection for AI Accountant
 * Used with Drizzle ORM + better-sqlite3/libsql (local) or PostgreSQL (production)
 */

import { drizzle as drizzleSqlite } from 'drizzle-orm/libsql';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { createClient } from '@libsql/client';
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

// ============================================================================
// DATABASE CONNECTION
// ============================================================================

const isProduction = process.env.NODE_ENV === 'production';
const dbUrl = process.env.DATABASE_URL || 'file:sqlite.db';
const usePostgres =
  isProduction || dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://');

/**
 * Create a Proxy wrapper around the PostgreSQL db to intercept query chains
 * and add .get() / .all() / .run() methods that are SQLite-specific.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Proxy wraps Drizzle's dynamic PG database object
function wrapPgDb(pgDb: any): any {
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === 'function') {
        return function (this: unknown, ...args: unknown[]) {
          const result = Reflect.apply(value as (...args: unknown[]) => unknown, target, args);
          // Wrap the result in a proxy to add .get()/.all()/.run()
          if (
            result &&
            typeof result === 'object' &&
            typeof (result as PromiseLike<unknown>).then === 'function'
          ) {
            return addSqliteCompat(result as Record<string, unknown>);
          }
          if (result && typeof result === 'object') {
            return addSqliteCompat(result as Record<string, unknown>);
          }
          return result;
        };
      }
      return value;
    },
  };
  return new Proxy(pgDb, handler);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Proxy wraps dynamic Drizzle query chain objects
function addSqliteCompat(obj: Record<string, unknown>): any {
  if (!obj || typeof obj !== 'object') return obj;
  // Avoid double-wrapping
  if (obj.__pgWrapped) return obj;

  return new Proxy(obj, {
    get(target, prop, receiver) {
      if (prop === '__pgWrapped') return true;
      if (prop === 'get') {
        return async function () {
          const rows = await (target as unknown as PromiseLike<unknown>);
          return Array.isArray(rows) ? (rows[0] ?? undefined) : rows;
        };
      }
      if (prop === 'all') {
        return async function () {
          const rows = await (target as unknown as PromiseLike<unknown>);
          return Array.isArray(rows) ? rows : [rows];
        };
      }
      if (prop === 'run') {
        return async function () {
          return await (target as unknown as PromiseLike<unknown>);
        };
      }
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === 'function') {
        return function (this: unknown, ...args: unknown[]) {
          const result = Reflect.apply(value as (...args: unknown[]) => unknown, target, args);
          if (result && typeof result === 'object') {
            return addSqliteCompat(result as Record<string, unknown>);
          }
          return result;
        };
      }
      return value;
    },
  });
}

function createDb() {
  if (usePostgres) {
    console.log('[DB] Using PostgreSQL');
    const pool = new pg.Pool({
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'ai_accountant',
      user: process.env.DB_USER || 'app_user',
      password: process.env.DB_PASSWORD,
      ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
      max: 20,
    });
    const pgDb = drizzlePg(pool);
    console.log('[DB] PostgreSQL compatibility layer applied (get/all/run via Proxy)');
    return wrapPgDb(pgDb);
  } else {
    console.log('[DB] Using SQLite');
    const client = createClient({ url: dbUrl });
    return drizzleSqlite(client);
  }
}

export const db = createDb();
