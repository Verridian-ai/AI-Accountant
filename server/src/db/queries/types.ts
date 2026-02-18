/**
 * Internal type definitions for the typed query layer
 *
 * These model the wrapPgDb() proxy shape so typed helpers can
 * preserve type information through the proxy boundary.
 */

import type { SQL } from 'drizzle-orm';

/** Minimal chainable query produced by the wrapPgDb() proxy */
export interface ProxiedQueryChain {
  where(condition: SQL | undefined): ProxiedQueryChain;
  set(data: Record<string, unknown>): ProxiedQueryChain;
  values(data: unknown): ProxiedQueryChain;
  from(table: unknown): ProxiedQueryChain;
  leftJoin(table: unknown, on: SQL): ProxiedQueryChain;
  orderBy(...columns: unknown[]): ProxiedQueryChain;
  limit(count: number): ProxiedQueryChain;
  offset(count: number): ProxiedQueryChain;
  onConflictDoNothing(): ProxiedQueryChain;
  get?(): Promise<unknown>;
  all?(): Promise<unknown[]>;
  run?(): Promise<unknown>;
  then: Promise<unknown>['then'];
  [key: string]: unknown;
}

/** Minimal DB instance shape returned by wrapPgDb() or drizzleSqlite() */
export interface DbInstance {
  select(fields?: Record<string, unknown>): ProxiedQueryChain;
  insert(table: unknown): ProxiedQueryChain;
  update(table: unknown): ProxiedQueryChain;
  delete(table: unknown): ProxiedQueryChain;
  transaction?<R>(cb: (tx: DbInstance) => Promise<R>): Promise<R>;
  [key: string]: unknown;
}

/**
 * Drizzle table shape — must have $inferSelect and $inferInsert.
 * Uses Record<string, any> because Drizzle's SQLiteTableWithColumns
 * has class-based column properties that lack a string index signature
 * compatible with Record<string, unknown>.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DrizzleTable = Record<string, any> & {
  $inferSelect: unknown;
  $inferInsert: unknown;
};
