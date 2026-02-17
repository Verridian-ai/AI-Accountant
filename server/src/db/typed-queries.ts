/**
 * Typed Query Helpers for Database Operations
 *
 * Provides type-safe wrappers around Drizzle ORM query builders to restore
 * type safety lost by the wrapPgDb() proxy layer. These helpers ensure that
 * database operations return properly typed results instead of `any`.
 *
 * Architecture:
 * - Drizzle ORM provides excellent type inference for PostgreSQL
 * - wrapPgDb() proxy adds SQLite-compatible .get()/.all()/.run() methods
 * - These typed helpers wrap the proxy to restore type information
 *
 * Usage:
 * ```typescript
 * // Instead of:
 * const user = db.select().from(users).where(eq(users.id, id)).get(); // returns any
 *
 * // Use:
 * const user = await selectOne(db, users, eq(users.id, id)); // returns User | undefined
 * ```
 */

import type { SQL } from 'drizzle-orm';

/**
 * Type-safe single row select
 * Returns the first matching row or undefined
 *
 * @param db - Database instance (typed or proxied)
 * @param table - Table to query
 * @param where - WHERE clause condition(s)
 * @returns Promise resolving to the first row or undefined
 */
export async function selectOne<T extends Record<string, any>>(
  db: any,
  table: T,
  where?: SQL | undefined
): Promise<(typeof table)['$inferSelect'] | undefined> {
  const query = db.select().from(table);
  if (where) {
    query.where(where);
  }

  // Use .get() if available (SQLite compatibility), otherwise fetch and take first
  if (typeof query.get === 'function') {
    return await query.get();
  }

  const rows = await query;
  return Array.isArray(rows) ? rows[0] : rows;
}

/**
 * Type-safe multiple row select
 * Returns all matching rows as an array
 *
 * @param db - Database instance
 * @param table - Table to query
 * @param where - WHERE clause condition(s)
 * @returns Promise resolving to an array of rows
 */
export async function selectMany<T extends Record<string, any>>(
  db: any,
  table: T,
  where?: SQL | undefined
): Promise<Array<(typeof table)['$inferSelect']>> {
  const query = db.select().from(table);
  if (where) {
    query.where(where);
  }

  // Use .all() if available (SQLite compatibility), otherwise return directly
  if (typeof query.all === 'function') {
    return await query.all();
  }

  const rows = await query;
  return Array.isArray(rows) ? rows : [rows];
}

/**
 * Type-safe insert operation
 * Inserts a single row or multiple rows
 *
 * @param db - Database instance
 * @param table - Table to insert into
 * @param values - Row(s) to insert
 * @returns Promise resolving to void
 */
export async function insert<T extends Record<string, any>>(
  db: any,
  table: T,
  values: (typeof table)['$inferInsert'] | Array<(typeof table)['$inferInsert']>
): Promise<void> {
  const query = db.insert(table).values(values);

  // Use .run() if available, otherwise just await
  if (typeof query.run === 'function') {
    await query.run();
  } else {
    await query;
  }
}

/**
 * Type-safe update operation
 * Updates rows matching the WHERE clause
 *
 * @param db - Database instance
 * @param table - Table to update
 * @param set - Fields to update
 * @param where - WHERE clause condition(s)
 * @returns Promise resolving to void
 */
export async function update<T extends Record<string, any>>(
  db: any,
  table: T,
  set: Partial<(typeof table)['$inferInsert']>,
  where?: SQL | undefined
): Promise<void> {
  const query = db.update(table).set(set);
  if (where) {
    query.where(where);
  }

  // Use .run() if available, otherwise just await
  if (typeof query.run === 'function') {
    await query.run();
  } else {
    await query;
  }
}

/**
 * Type-safe delete operation
 * Deletes rows matching the WHERE clause
 *
 * @param db - Database instance
 * @param table - Table to delete from
 * @param where - WHERE clause condition(s)
 * @returns Promise resolving to void
 */
export async function deleteRows<T extends Record<string, any>>(
  db: any,
  table: T,
  where?: SQL | undefined
): Promise<void> {
  const query = db.delete(table);
  if (where) {
    query.where(where);
  }

  // Use .run() if available, otherwise just await
  if (typeof query.run === 'function') {
    await query.run();
  } else {
    await query;
  }
}

/**
 * Query builder that preserves type information
 *
 * Use this for complex queries that need custom SELECT clauses,
 * JOINs, ORDER BY, etc. It wraps the query chain to ensure the
 * final .get() or .all() call returns properly typed results.
 *
 * @param db - Database instance
 * @returns Chainable query builder with type preservation
 */
export function typedQuery(db: any) {
  return {
    /**
     * Start a SELECT query with full type inference
     */
    select<T extends Record<string, any>>() {
      return new TypedSelectBuilder<T>(db.select());
    },

    /**
     * Start an INSERT query with full type inference
     */
    insert<T extends Record<string, any>>(table: T) {
      return new TypedInsertBuilder<T>(db.insert(table), table);
    },

    /**
     * Start an UPDATE query with full type inference
     */
    update<T extends Record<string, any>>(table: T) {
      return new TypedUpdateBuilder<T>(db.update(table), table);
    },

    /**
     * Start a DELETE query with full type inference
     */
    delete<T extends Record<string, any>>(table: T) {
      return new TypedDeleteBuilder<T>(db.delete(table), table);
    },
  };
}

/**
 * Typed SELECT query builder
 * Preserves return types for complex SELECT queries
 */
class TypedSelectBuilder<T extends Record<string, any>> {
  private query: any;

  constructor(query: any) {
    this.query = query;
  }

  from(table: T): this {
    this.query = this.query.from(table);
    return this;
  }

  where(condition: SQL): this {
    this.query = this.query.where(condition);
    return this;
  }

  leftJoin(table: any, on: SQL): this {
    this.query = this.query.leftJoin(table, on);
    return this;
  }

  orderBy(...columns: any[]): this {
    this.query = this.query.orderBy(...columns);
    return this;
  }

  limit(count: number): this {
    this.query = this.query.limit(count);
    return this;
  }

  offset(count: number): this {
    this.query = this.query.offset(count);
    return this;
  }

  /**
   * Execute and return the first row
   */
  async get(): Promise<T['$inferSelect'] | undefined> {
    if (typeof this.query.get === 'function') {
      return await this.query.get();
    }
    const rows = await this.query;
    return Array.isArray(rows) ? rows[0] : rows;
  }

  /**
   * Execute and return all rows
   */
  async all(): Promise<Array<T['$inferSelect']>> {
    if (typeof this.query.all === 'function') {
      return await this.query.all();
    }
    const rows = await this.query;
    return Array.isArray(rows) ? rows : [rows];
  }
}

/**
 * Typed INSERT query builder
 */
class TypedInsertBuilder<T extends Record<string, any>> {
  private query: any;
  private table: T;

  constructor(query: any, table: T) {
    this.query = query;
    this.table = table;
  }

  values(data: T['$inferInsert'] | Array<T['$inferInsert']>): this {
    this.query = this.query.values(data);
    return this;
  }

  onConflictDoNothing(): this {
    this.query = this.query.onConflictDoNothing();
    return this;
  }

  async run(): Promise<void> {
    if (typeof this.query.run === 'function') {
      await this.query.run();
    } else {
      await this.query;
    }
  }
}

/**
 * Typed UPDATE query builder
 */
class TypedUpdateBuilder<T extends Record<string, any>> {
  private query: any;
  private table: T;

  constructor(query: any, table: T) {
    this.query = query;
    this.table = table;
  }

  set(data: Partial<T['$inferInsert']>): this {
    this.query = this.query.set(data);
    return this;
  }

  where(condition: SQL): this {
    this.query = this.query.where(condition);
    return this;
  }

  async run(): Promise<void> {
    if (typeof this.query.run === 'function') {
      await this.query.run();
    } else {
      await this.query;
    }
  }
}

/**
 * Typed DELETE query builder
 */
class TypedDeleteBuilder<T extends Record<string, any>> {
  private query: any;
  private table: T;

  constructor(query: any, table: T) {
    this.query = query;
    this.table = table;
  }

  where(condition: SQL): this {
    this.query = this.query.where(condition);
    return this;
  }

  async run(): Promise<void> {
    if (typeof this.query.run === 'function') {
      await this.query.run();
    } else {
      await this.query;
    }
  }
}

/**
 * Type-safe transaction wrapper
 * Executes a callback within a database transaction
 *
 * @param db - Database instance
 * @param callback - Function to execute within the transaction
 * @returns Promise resolving to the callback's return value
 */
export async function withTypedTransaction<T>(
  db: any,
  callback: (tx: any) => Promise<T>
): Promise<T> {
  // If db has a transaction method, use it
  if (typeof db.transaction === 'function') {
    return await db.transaction(callback);
  }

  // Otherwise, just execute the callback (for compatibility)
  return await callback(db);
}
