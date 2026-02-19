/**
 * PgDb — PostgreSQL-native adapter for raw SQL queries.
 *
 * Replaces the broken SQLite-compat `db.execute()` / `db` pattern
 * used by MutationTools, ConfirmationFlowService, and AuditService.
 *
 * Converts `?` placeholders to PostgreSQL `$1, $2, ...` syntax
 * and delegates to the underlying pg.Pool.
 */

import type pg from 'pg';

export interface PgDbAdapter {
  all(sql: string, params?: unknown[]): Promise<Array<Record<string, unknown>>>;
  run(sql: string, params?: unknown[]): Promise<{ changes?: number } | undefined>;
  execute(sql: string, params?: unknown[]): Promise<{ changes?: number } | undefined>;
}

/**
 * Convert SQLite-style `?` placeholders to PostgreSQL `$1, $2, ...` syntax.
 */
function convertPlaceholders(sql: string): string {
  let index = 0;
  return sql.replace(/\?/g, () => {
    index++;
    return `$${index}`;
  });
}

/**
 * Create a PgDb adapter from a pg.Pool instance.
 *
 * Usage:
 *   import { pool } from '../schema/connection.js';
 *   const pgDb = createPgDb(pool);
 *   const confirmationFlow = new ConfirmationFlowService(pgDb);
 */
export function createPgDb(pool: pg.Pool): PgDbAdapter {
  return {
    async all(sql: string, params?: unknown[]): Promise<Array<Record<string, unknown>>> {
      const pgSql = convertPlaceholders(sql);
      const result = await pool.query(pgSql, params ?? []);
      return result.rows;
    },

    async run(sql: string, params?: unknown[]): Promise<{ changes?: number } | undefined> {
      const pgSql = convertPlaceholders(sql);
      const result = await pool.query(pgSql, params ?? []);
      return { changes: result.rowCount ?? 0 };
    },

    async execute(sql: string, params?: unknown[]): Promise<{ changes?: number } | undefined> {
      const pgSql = convertPlaceholders(sql);
      const result = await pool.query(pgSql, params ?? []);
      return { changes: result.rowCount ?? 0 };
    },
  };
}
