/**
 * MutationTools — SQL identifier validation + DB adapter interface
 *
 * Security boundary: all table/column names are validated against
 * a whitelist before any SQL is constructed (D01-CRIT-01).
 */

import { SAFE_IDENTIFIER_RE, MUTABLE_TABLES } from '../mutation-tools-constants.js';

/** Internal DB adapter shape used by MutationTools. */
export interface MutationDb {
  all(sql: string, params?: unknown[]): Promise<Array<Record<string, unknown>>>;
  run(sql: string, params?: unknown[]): Promise<{ changes?: number } | undefined>;
}

export function validateTableName(table: string): void {
  if (!SAFE_IDENTIFIER_RE.test(table)) {
    throw new Error(
      `Invalid table name: '${table}' — must be lowercase alphanumeric with underscores`,
    );
  }
  if (!MUTABLE_TABLES.has(table)) {
    throw new Error(`Table '${table}' is not in the mutation whitelist — mutation denied`);
  }
}

export function validateColumnNames(columns: string[]): void {
  for (const col of columns) {
    if (!SAFE_IDENTIFIER_RE.test(col)) {
      throw new Error(
        `Invalid column name: '${col}' — must be lowercase alphanumeric with underscores`,
      );
    }
  }
}
