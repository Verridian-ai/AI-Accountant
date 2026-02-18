/**
 * Type-safe transaction wrapper
 */

import type { DbInstance } from './types.js';

/**
 * Executes a callback within a database transaction.
 * Falls back to direct execution if the db instance has no transaction support.
 */
export async function withTypedTransaction<T>(
  db: DbInstance,
  callback: (tx: DbInstance) => Promise<T>,
): Promise<T> {
  if (typeof db.transaction === 'function') {
    return await db.transaction(callback);
  }
  return await callback(db);
}
