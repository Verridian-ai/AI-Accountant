/**
 * PostgreSQL Connection — Neon Cloud
 * All accounting data lives in Neon Cloud PostgreSQL.
 */

import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './postgres-schema';
import dotenv from 'dotenv';
dotenv.config();

const neonUrl = process.env.NEON_DATABASE_URL;

if (!neonUrl) {
  throw new Error('[DB] NEON_DATABASE_URL is not set. Add it to server/.env');
}

// Create the connection pool
let pool: Pool | null = null;
let db: NodePgDatabase<typeof schema> | null = null;

export function initializePool(): Pool {
  if (pool) return pool;

  console.log('[PostgreSQL] Connecting to Neon Cloud');
  pool = new Pool({
    connectionString: neonUrl,
    ssl: { rejectUnauthorized: false },
    max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    min: parseInt(process.env.DB_POOL_MIN || '2', 10),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000', 10),
    statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000', 10),
  });

  pool.on('connect', (client) => {
    client.query("SET timezone = 'UTC'");
  });

  pool.on('error', (err) => {
    console.error('[PostgreSQL] Idle client error:', err);
  });

  return pool;
}

export function getDb(): NodePgDatabase<typeof schema> {
  if (db) return db;
  db = drizzle(initializePool(), { schema });
  return db;
}

export async function healthCheck(): Promise<{
  status: 'healthy' | 'unhealthy';
  latencyMs: number;
  poolStats: { totalCount: number; idleCount: number; waitingCount: number };
  error?: string;
}> {
  const start = Date.now();
  const connectionPool = initializePool();

  try {
    const client = await connectionPool.connect();
    try {
      await client.query('SELECT 1 as health_check');
      return {
        status: 'healthy',
        latencyMs: Date.now() - start,
        poolStats: {
          totalCount: connectionPool.totalCount,
          idleCount: connectionPool.idleCount,
          waitingCount: connectionPool.waitingCount,
        },
      };
    } finally {
      client.release();
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      latencyMs: Date.now() - start,
      poolStats: {
        totalCount: connectionPool.totalCount,
        idleCount: connectionPool.idleCount,
        waitingCount: connectionPool.waitingCount,
      },
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
  }
}

export async function rawQuery<T>(sql: string, params?: unknown[]): Promise<T[]> {
  const client = await initializePool().connect();
  try {
    const result = await client.query(sql, params as unknown[]);
    return result.rows as T[];
  } finally {
    client.release();
  }
}

export async function withTransaction<T>(callback: (client: unknown) => Promise<T>): Promise<T> {
  const client = await initializePool().connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    (client as { release: () => void }).release();
  }
}

export { db, pool };
export default getDb;
