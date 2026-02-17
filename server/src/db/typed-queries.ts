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

// ============================================================================
// INTERNAL TYPES — model the wrapPgDb() proxy shape
// ============================================================================

/** Minimal chainable query produced by the wrapPgDb() proxy */
interface ProxiedQueryChain {
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
interface DbInstance {
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
type DrizzleTable = Record<string, any> & {
  $inferSelect: unknown;
  $inferInsert: unknown;
};

// ============================================================================
// QUERY HELPERS
// ============================================================================

/**
 * Type-safe single row select
 * Returns the first matching row or undefined
 *
 * @param db - Database instance (typed or proxied)
 * @param table - Table to query
 * @param where - WHERE clause condition(s)
 * @returns Promise resolving to the first row or undefined
 */
export async function selectOne<T extends DrizzleTable>(
  db: DbInstance,
  table: T,
  where?: SQL | undefined
): Promise<T['$inferSelect'] | undefined> {
  const query = db.select().from(table);
  if (where) {
    query.where(where);
  }

  // Use .get() if available (SQLite compatibility), otherwise fetch and take first
  if (typeof query.get === 'function') {
    return await query.get() as T['$inferSelect'] | undefined;
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
export async function selectMany<T extends DrizzleTable>(
  db: DbInstance,
  table: T,
  where?: SQL | undefined
): Promise<Array<T['$inferSelect']>> {
  const query = db.select().from(table);
  if (where) {
    query.where(where);
  }

  // Use .all() if available (SQLite compatibility), otherwise return directly
  if (typeof query.all === 'function') {
    return await query.all() as Array<T['$inferSelect']>;
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
export async function insert<T extends DrizzleTable>(
  db: DbInstance,
  table: T,
  values: T['$inferInsert'] | Array<T['$inferInsert']>
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
export async function update<T extends DrizzleTable>(
  db: DbInstance,
  table: T,
  set: Partial<T['$inferInsert']>,
  where?: SQL | undefined
): Promise<void> {
  const query = db.update(table).set(set as Record<string, unknown>);
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
export async function deleteRows<T extends DrizzleTable>(
  db: DbInstance,
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
export function typedQuery(db: DbInstance) {
  return {
    /**
     * Start a SELECT query with full type inference
     */
    select<T extends DrizzleTable>() {
      return new TypedSelectBuilder<T>(db.select());
    },

    /**
     * Start an INSERT query with full type inference
     */
    insert<T extends DrizzleTable>(table: T) {
      return new TypedInsertBuilder<T>(db.insert(table), table);
    },

    /**
     * Start an UPDATE query with full type inference
     */
    update<T extends DrizzleTable>(table: T) {
      return new TypedUpdateBuilder<T>(db.update(table), table);
    },

    /**
     * Start a DELETE query with full type inference
     */
    delete<T extends DrizzleTable>(table: T) {
      return new TypedDeleteBuilder<T>(db.delete(table), table);
    },
  };
}

/**
 * Typed SELECT query builder
 * Preserves return types for complex SELECT queries
 */
class TypedSelectBuilder<T extends DrizzleTable> {
  private query: ProxiedQueryChain;

  constructor(query: ProxiedQueryChain) {
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

  leftJoin(table: unknown, on: SQL): this {
    this.query = this.query.leftJoin(table, on);
    return this;
  }

  orderBy(...columns: unknown[]): this {
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
      return await this.query.get() as T['$inferSelect'] | undefined;
    }
    const rows = await this.query;
    return Array.isArray(rows) ? rows[0] : rows;
  }

  /**
   * Execute and return all rows
   */
  async all(): Promise<Array<T['$inferSelect']>> {
    if (typeof this.query.all === 'function') {
      return await this.query.all() as Array<T['$inferSelect']>;
    }
    const rows = await this.query;
    return Array.isArray(rows) ? rows : [rows];
  }
}

/**
 * Typed INSERT query builder
 */
class TypedInsertBuilder<T extends DrizzleTable> {
  private query: ProxiedQueryChain;
  private table: T;

  constructor(query: ProxiedQueryChain, table: T) {
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
class TypedUpdateBuilder<T extends DrizzleTable> {
  private query: ProxiedQueryChain;
  private table: T;

  constructor(query: ProxiedQueryChain, table: T) {
    this.query = query;
    this.table = table;
  }

  set(data: Partial<T['$inferInsert']>): this {
    this.query = this.query.set(data as Record<string, unknown>);
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
class TypedDeleteBuilder<T extends DrizzleTable> {
  private query: ProxiedQueryChain;
  private table: T;

  constructor(query: ProxiedQueryChain, table: T) {
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
  db: DbInstance,
  callback: (tx: DbInstance) => Promise<T>
): Promise<T> {
  // If db has a transaction method, use it
  if (typeof db.transaction === 'function') {
    return await db.transaction(callback);
  }

  // Otherwise, just execute the callback (for compatibility)
  return await callback(db);
}
