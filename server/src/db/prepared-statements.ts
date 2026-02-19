/**
 * Drizzle Prepared Statements — hot-path fixed-structure queries
 *
 * Uses Drizzle's `.prepare()` API with the node-postgres extended query protocol.
 * Each connection in the pool independently caches the parse tree on first use;
 * subsequent calls on the same connection skip the parse phase entirely.
 *
 * IMPORTANT: Only fixed-structure queries can be prepared.
 * Queries with dynamic optional WHERE clauses (e.g. findMany with filters)
 * must remain as regular Drizzle builder calls.
 *
 * Naming convention: <table>_<operation> (all lowercase, underscores).
 */

import { placeholder, eq, and, desc } from 'drizzle-orm';
import { db } from '../schema.js';
import { users, userSettings, accounts, statements, transactions } from '../schema.js';

// ============================================================================
// USERS
// ============================================================================

/** Look up a user by primary key — called on every authenticated request */
export const users_getById = db
  .select()
  .from(users)
  .where(eq(users.id, placeholder('id')))
  .prepare('users_get_by_id');

/** Look up a user by username — called on every login */
export const users_findByUsername = db
  .select()
  .from(users)
  .where(eq(users.username, placeholder('username')))
  .prepare('users_find_by_username');

// ============================================================================
// USER SETTINGS
// ============================================================================

/** Get settings row for a user */
export const userSettings_getByUserId = db
  .select()
  .from(userSettings)
  .where(eq(userSettings.userId, placeholder('userId')))
  .prepare('user_settings_get_by_user_id');

// ============================================================================
// ACCOUNTS
// ============================================================================

/** Look up an account by primary key, scoped to user */
export const accounts_findById = db
  .select()
  .from(accounts)
  .where(and(eq(accounts.id, placeholder('id')), eq(accounts.userId, placeholder('userId'))))
  .prepare('accounts_find_by_id');

/** Look up an account by hash (duplicate detection), scoped to user */
export const accounts_findByHash = db
  .select()
  .from(accounts)
  .where(
    and(
      eq(accounts.userId, placeholder('userId')),
      eq(accounts.accountNumberHash, placeholder('hash')),
    ),
  )
  .prepare('accounts_find_by_hash');

// ============================================================================
// STATEMENTS
// ============================================================================

/** Look up a statement by primary key */
export const statements_getById = db
  .select()
  .from(statements)
  .where(eq(statements.id, placeholder('id')))
  .prepare('statements_get_by_id');

/** Find a statement by hash (for duplicate detection) */
export const statements_findByHash = db
  .select()
  .from(statements)
  .where(eq(statements.hash, placeholder('hash')))
  .prepare('statements_find_by_hash');

/** Get all statements for a user, most recent first (capped at 1000) */
export const statements_getByUserId = db
  .select()
  .from(statements)
  .where(eq(statements.userId, placeholder('userId')))
  .orderBy(desc(statements.uploadDate))
  .limit(1000)
  .prepare('statements_get_by_user_id');

// ============================================================================
// TRANSACTIONS
// ============================================================================

/** Look up a single transaction by ID, scoped to user */
export const transactions_findById = db
  .select()
  .from(transactions)
  .where(
    and(eq(transactions.id, placeholder('id')), eq(transactions.userId, placeholder('userId'))),
  )
  .prepare('transactions_find_by_id');

/** Find all transactions belonging to a statement */
export const transactions_findByStatementId = db
  .select()
  .from(transactions)
  .where(eq(transactions.statementId, placeholder('statementId')))
  .prepare('transactions_find_by_statement_id');
