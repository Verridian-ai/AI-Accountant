/**
 * Database connection for GoldLedger
 * Uses Neon Cloud PostgreSQL exclusively via Drizzle ORM.
 *
 * The wrapPgDb / addSqliteCompat proxy adds .get() / .all() / .run()
 * shims so all existing service code continues to work unchanged.
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

// ============================================================================
// NEON CLOUD CONNECTION
// ============================================================================

const neonUrl = process.env.NEON_DATABASE_URL;

if (!neonUrl) {
  throw new Error(
    '[DB] NEON_DATABASE_URL is not set. Add it to server/.env — see NEON_MIGRATION_COMPLETE.md',
  );
}

console.log('[DB] Connecting to Neon Cloud PostgreSQL');

export const pool = new pg.Pool({
  connectionString: neonUrl,
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// ============================================================================
// SQLITE COMPAT PROXY
// Adds .get() / .all() / .run() to Drizzle Postgres query chains so all
// existing service code works without modification.
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addSqliteCompat(obj: Record<string, unknown>): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (obj.__pgWrapped) return obj;

  return new Proxy(obj, {
    get(target, prop, receiver) {
      if (prop === '__pgWrapped') return true;
      if (prop === 'get') {
        return async function () {
          const rows = await (target as unknown as Promise<unknown>);
          return Array.isArray(rows) ? (rows[0] ?? undefined) : rows;
        };
      }
      if (prop === 'all') {
        return async function () {
          const rows = await (target as unknown as Promise<unknown>);
          return Array.isArray(rows) ? rows : [rows];
        };
      }
      if (prop === 'run') {
        return async function () {
          return await (target as unknown as Promise<unknown>);
        };
      }
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === 'function') {
        return function (this: unknown, ...args: unknown[]) {
          const result = Reflect.apply(value as (...a: unknown[]) => unknown, target, args);
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function wrapPgDb(pgDb: any): any {
  return new Proxy(pgDb, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === 'function') {
        return function (this: unknown, ...args: unknown[]) {
          const result = Reflect.apply(value as (...a: unknown[]) => unknown, target, args);
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

export const db = wrapPgDb(drizzle(pool));
