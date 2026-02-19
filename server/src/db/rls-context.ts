/**
 * RLS context helpers — set app.user_id session variable so PostgreSQL RLS
 * policies (in rls-policies.sql) filter rows automatically.
 *
 * IMPORTANT: always uses SET LOCAL so the variable is scoped to the current
 * transaction only (safe with connection pooling).
 */
import type { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger.js';

/**
 * Execute `fn` inside a transaction with `app.user_id` set to `userId`.
 *
 * All queries executed on the provided `PoolClient` will be filtered by RLS
 * to rows owned by this user.
 *
 * @example
 * const rows = await withUserContext(pool, userId, async (client) => {
 *   const { rows } = await client.query('SELECT * FROM transactions');
 *   return rows;
 * });
 */
export async function withUserContext<T>(
  pool: Pool,
  userId: string,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // SET LOCAL scopes the GUC to this transaction only — safe for pooled connections
    await client.query('SET LOCAL app.user_id = $1', [userId]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      logger.error('[RLS] Rollback failed', rollbackErr);
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Execute `fn` inside a transaction with `app.user_id` cleared (empty string).
 *
 * Used for admin/system operations that should bypass user-scoped RLS.
 * The `goldledger_app` role still has RLS enforced, but with no user_id set
 * the `gl_current_user_id()` function returns NULL, so no rows match.
 *
 * For full bypass, use the `neondb_owner` / superuser connection pool directly.
 */
export async function withSystemContext<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL app.user_id = ''");
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      logger.error('[RLS] Rollback failed (system context)', rollbackErr);
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Set `app.user_id` for an already-acquired client (must be inside a transaction).
 *
 * Use this when you need to reuse an existing client rather than acquiring a new one.
 * You are responsible for calling BEGIN/COMMIT/ROLLBACK around this.
 */
export async function setRlsUserId(client: PoolClient, userId: string): Promise<void> {
  await client.query('SET LOCAL app.user_id = $1', [userId]);
}

/**
 * Clear `app.user_id` for an already-acquired client (reverts to no user context).
 */
export async function clearRlsUserId(client: PoolClient): Promise<void> {
  await client.query("SET LOCAL app.user_id = ''");
}
