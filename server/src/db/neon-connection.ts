/**
 * Neon Dual Connection Pools — Production + AI Masked Branch
 *
 * Two Drizzle-wrapped pg.Pool instances:
 *   1. Production pool — real data, used for writes, user-facing reads, and aggregate-tool queries
 *   2. AI masked pool  — deterministically pseudonymized names, used for all LLM/Cognee reads
 *
 * When USE_NEON=false, both pools fall back to DATABASE_URL (local PostgreSQL).
 * When NEON_AI_BRANCH_URL is not set, the masked pool falls back to the production pool.
 */

import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './postgres-schema.js';
import type { NeonHealthResult, PoolHealthStatus } from '../services/neon/masking-types.js';
import { logger } from '../lib/logger.js';

// ── Configuration ───────────────────────────────────────────

const USE_NEON = process.env.USE_NEON === 'true';

function getProductionUrl(): string {
  if (USE_NEON) {
    const url = process.env.NEON_DATABASE_URL;
    if (!url) throw new Error('[NeonConnection] USE_NEON=true but NEON_DATABASE_URL is not set');
    return url;
  }
  const url = process.env.DATABASE_URL ?? process.env.NEON_DATABASE_URL;
  if (!url) throw new Error('[NeonConnection] Neither DATABASE_URL nor NEON_DATABASE_URL is set');
  return url;
}

function getMaskedUrl(): string | null {
  if (!USE_NEON) return null;
  return process.env.NEON_AI_BRANCH_URL ?? null;
}

// ── Pool Defaults ───────────────────────────────────────────

interface PoolOptions {
  connectionString: string;
  max: number;
  min: number;
  label: string;
}

function createPool(opts: PoolOptions): Pool {
  const pool = new Pool({
    connectionString: opts.connectionString,
    ssl: opts.connectionString.includes('neon.tech') ? { rejectUnauthorized: false } : undefined,
    max: opts.max,
    min: opts.min,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 30_000,
  });

  pool.on('connect', (client) => {
    client.query("SET timezone = 'UTC'");
  });

  pool.on('error', (err) => {
    logger.error(`[NeonConnection:${opts.label}] Idle client error:`, err.message);
  });

  logger.info(`[NeonConnection] ${opts.label} pool created (max=${opts.max})`);
  return pool;
}

// ── Pool State ──────────────────────────────────────────────

let productionPool: Pool | null = null;
let maskedPool: Pool | null = null;
let productionDb: NodePgDatabase<typeof schema> | null = null;
let maskedDb: NodePgDatabase<typeof schema> | null = null;

// Track whether masked pool is a separate connection or same as production
let maskedIsSeparate = false;

// ── Initialization ──────────────────────────────────────────

function ensureProductionPool(): Pool {
  if (productionPool) return productionPool;

  productionPool = createPool({
    connectionString: getProductionUrl(),
    max: parseInt(process.env.DB_POOL_MAX ?? '20', 10),
    min: parseInt(process.env.DB_POOL_MIN ?? '2', 10),
    label: 'production',
  });

  return productionPool;
}

function ensureMaskedPool(): Pool {
  if (maskedPool) return maskedPool;

  const maskedUrl = getMaskedUrl();
  if (maskedUrl) {
    maskedPool = createPool({
      connectionString: maskedUrl,
      max: 10,
      min: 1,
      label: 'ai-masked',
    });
    maskedIsSeparate = true;
    logger.info('[NeonConnection] AI masked branch pool initialized (separate)');
  } else {
    // Fallback: share the production pool
    maskedPool = ensureProductionPool();
    maskedIsSeparate = false;
    logger.info(
      '[NeonConnection] AI masked branch not configured — falling back to production pool',
    );
  }

  return maskedPool;
}

// ── Public API ──────────────────────────────────────────────

/**
 * Get the production database (real data).
 * Used for: user-facing endpoints, writes, aggregate-tool queries.
 */
export function getProductionDb(): NodePgDatabase<typeof schema> {
  if (productionDb) return productionDb;
  productionDb = drizzle(ensureProductionPool(), { schema });
  return productionDb;
}

/**
 * Get the AI masked database (deterministically pseudonymized).
 * Used for: all LLM/Cognee reads where PII must be hidden.
 * Falls back to production if NEON_AI_BRANCH_URL is not set.
 */
export function getMaskedDb(): NodePgDatabase<typeof schema> {
  if (maskedDb) return maskedDb;
  maskedDb = drizzle(ensureMaskedPool(), { schema });
  return maskedDb;
}

/**
 * Smart read selector.
 * Returns masked DB when USE_NEON=true and masked branch is configured.
 * Otherwise returns production DB.
 */
export function getReadDb(): NodePgDatabase<typeof schema> {
  if (USE_NEON && getMaskedUrl()) {
    return getMaskedDb();
  }
  return getProductionDb();
}

/**
 * Check if a separate masked branch is configured and active.
 */
export function isMaskedBranchActive(): boolean {
  return maskedIsSeparate;
}

// ── Pool Hot-Swap (for branch refresh) ──────────────────────

/**
 * Hot-swap the AI masked connection pool to a new branch.
 * Called by NeonBranchManager after creating a fresh anonymized branch.
 *
 * This is an atomic swap — the old pool continues serving existing
 * queries until they complete, then is drained and closed.
 */
export async function swapMaskedPool(newConnectionString: string): Promise<void> {
  const oldPool = maskedIsSeparate ? maskedPool : null;

  const newPool = createPool({
    connectionString: newConnectionString,
    max: 10,
    min: 1,
    label: 'ai-masked-swapped',
  });

  // Verify the new pool connects before swapping
  const testClient = await newPool.connect();
  try {
    await testClient.query('SELECT 1 AS swap_test');
  } finally {
    testClient.release();
  }

  // Atomic swap
  maskedPool = newPool;
  maskedDb = drizzle(newPool, { schema });
  maskedIsSeparate = true;

  // Drain old pool (if it was separate)
  if (oldPool) {
    try {
      await oldPool.end();
      logger.info('[NeonConnection] Old masked pool drained');
    } catch (err) {
      logger.error('[NeonConnection] Error draining old masked pool:', err);
    }
  }

  logger.info('[NeonConnection] Masked pool hot-swapped to new branch');
}

// ── Health Check ────────────────────────────────────────────

async function checkPoolHealth(pool: Pool, _label: string): Promise<PoolHealthStatus> {
  const start = Date.now();
  try {
    const client = await pool.connect();
    try {
      await client.query('SELECT 1 AS health_check');
      return {
        status: 'healthy',
        latencyMs: Date.now() - start,
        poolStats: {
          totalCount: pool.totalCount,
          idleCount: pool.idleCount,
          waitingCount: pool.waitingCount,
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
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount,
      },
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Health check for both connection pools.
 */
export async function neonHealthCheck(): Promise<NeonHealthResult> {
  const prodPool = ensureProductionPool();
  const production = await checkPoolHealth(prodPool, 'production');

  let masked: PoolHealthStatus;
  if (maskedIsSeparate && maskedPool) {
    masked = await checkPoolHealth(maskedPool, 'ai-masked');
  } else {
    masked = {
      status: 'not_configured',
      latencyMs: 0,
      poolStats: { totalCount: 0, idleCount: 0, waitingCount: 0 },
    };
  }

  return {
    production,
    masked,
    useNeon: USE_NEON,
    maskedBranchConfigured: maskedIsSeparate,
  };
}

// ── Graceful Shutdown ───────────────────────────────────────

/**
 * Close all connection pools. Call on server shutdown.
 */
export async function closePools(): Promise<void> {
  const closePromises: Promise<void>[] = [];

  if (maskedIsSeparate && maskedPool) {
    closePromises.push(maskedPool.end());
  }
  if (productionPool) {
    closePromises.push(productionPool.end());
  }

  await Promise.all(closePromises);

  productionPool = null;
  maskedPool = null;
  productionDb = null;
  maskedDb = null;
  maskedIsSeparate = false;

  logger.info('[NeonConnection] All pools closed');
}
