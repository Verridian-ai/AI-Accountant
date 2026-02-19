/**
 * pg-helpers.ts — Shared PostgreSQL column type re-exports for Drizzle pgTable() migrations.
 *
 * Migration cheatsheet (sqliteTable → pgTable):
 *   sqliteTable('name', cols)             →  pgTable('name', cols)
 *   integer('col', { mode: 'boolean' })   →  boolean('col')
 *   real('col')                           →  doublePrecision('col')
 *   text timestamps: keep text() for backward compatibility with existing service code
 *
 * NOTE: .references() callbacks to tables still on sqliteTable (e.g. users from core.ts)
 * must be omitted until those tables migrate in TASK-045/046.
 * DB-level FK constraints remain intact — they are defined in SQL migration files.
 */
export {
  pgTable,
  text,
  integer,
  boolean,
  doublePrecision,
  numeric,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
