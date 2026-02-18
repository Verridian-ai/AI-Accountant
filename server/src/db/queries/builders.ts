/**
 * Typed query builder classes for complex queries with JOINs, ORDER BY, etc.
 *
 * The four builder classes are internal implementation details.
 * Only the `typedQuery` factory is exported.
 */

import type { SQL } from 'drizzle-orm';
import type { DbInstance, DrizzleTable, ProxiedQueryChain } from './types.js';

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

  async get(): Promise<T['$inferSelect'] | undefined> {
    if (typeof this.query.get === 'function') {
      return (await this.query.get()) as T['$inferSelect'] | undefined;
    }
    const rows = await this.query;
    return Array.isArray(rows) ? rows[0] : rows;
  }

  async all(): Promise<Array<T['$inferSelect']>> {
    if (typeof this.query.all === 'function') {
      return (await this.query.all()) as Array<T['$inferSelect']>;
    }
    const rows = await this.query;
    return Array.isArray(rows) ? rows : [rows];
  }
}

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
 * Query builder that preserves type information.
 *
 * Use for complex queries needing custom SELECT clauses, JOINs, ORDER BY, etc.
 */
export function typedQuery(db: DbInstance) {
  return {
    select<T extends DrizzleTable>() {
      return new TypedSelectBuilder<T>(db.select());
    },
    insert<T extends DrizzleTable>(table: T) {
      return new TypedInsertBuilder<T>(db.insert(table), table);
    },
    update<T extends DrizzleTable>(table: T) {
      return new TypedUpdateBuilder<T>(db.update(table), table);
    },
    delete<T extends DrizzleTable>(table: T) {
      return new TypedDeleteBuilder<T>(db.delete(table), table);
    },
  };
}
