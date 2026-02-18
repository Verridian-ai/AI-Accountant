/**
 * Simple typed query helpers — selectOne, selectMany, insert, update, deleteRows
 */

import type { SQL } from 'drizzle-orm';
import type { DbInstance, DrizzleTable } from './types.js';

/**
 * Type-safe single row select — returns the first matching row or undefined
 */
export async function selectOne<T extends DrizzleTable>(
  db: DbInstance,
  table: T,
  where?: SQL | undefined,
): Promise<T['$inferSelect'] | undefined> {
  const query = db.select().from(table);
  if (where) {
    query.where(where);
  }

  if (typeof query.get === 'function') {
    return (await query.get()) as T['$inferSelect'] | undefined;
  }

  const rows = await query;
  return Array.isArray(rows) ? rows[0] : rows;
}

/**
 * Type-safe multiple row select — returns all matching rows as an array
 */
export async function selectMany<T extends DrizzleTable>(
  db: DbInstance,
  table: T,
  where?: SQL | undefined,
): Promise<Array<T['$inferSelect']>> {
  const query = db.select().from(table);
  if (where) {
    query.where(where);
  }

  if (typeof query.all === 'function') {
    return (await query.all()) as Array<T['$inferSelect']>;
  }

  const rows = await query;
  return Array.isArray(rows) ? rows : [rows];
}

/**
 * Type-safe insert operation — inserts a single row or multiple rows
 */
export async function insert<T extends DrizzleTable>(
  db: DbInstance,
  table: T,
  values: T['$inferInsert'] | Array<T['$inferInsert']>,
): Promise<void> {
  const query = db.insert(table).values(values);

  if (typeof query.run === 'function') {
    await query.run();
  } else {
    await query;
  }
}

/**
 * Type-safe update operation — updates rows matching the WHERE clause
 */
export async function update<T extends DrizzleTable>(
  db: DbInstance,
  table: T,
  set: Partial<T['$inferInsert']>,
  where?: SQL | undefined,
): Promise<void> {
  const query = db.update(table).set(set as Record<string, unknown>);
  if (where) {
    query.where(where);
  }

  if (typeof query.run === 'function') {
    await query.run();
  } else {
    await query;
  }
}

/**
 * Type-safe delete operation — deletes rows matching the WHERE clause
 */
export async function deleteRows<T extends DrizzleTable>(
  db: DbInstance,
  table: T,
  where?: SQL | undefined,
): Promise<void> {
  const query = db.delete(table);
  if (where) {
    query.where(where);
  }

  if (typeof query.run === 'function') {
    await query.run();
  } else {
    await query;
  }
}
