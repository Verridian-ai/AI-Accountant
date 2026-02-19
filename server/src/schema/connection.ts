/**
 * Database connection for GoldLedger
 * Uses Neon Cloud PostgreSQL exclusively via Drizzle ORM.
 *
 * The wrapPgDb / addSqliteCompat proxy adds .get() / .all() / .run()
 * shims so all existing service code continues to work unchanged.
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { getProductionPool } from '../db/neon-connection.js';

// ============================================================================
// NEON CLOUD CONNECTION — single pool managed by db/neon-connection.ts
// ============================================================================

export const pool = getProductionPool();

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
