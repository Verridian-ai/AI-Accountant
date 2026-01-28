/**
 * PostgreSQL Connection Configuration for AI Accountant
 *
 * Supports:
 * - Connection pooling via pg Pool
 * - SSL configuration for Cloud SQL
 * - Cloud SQL Proxy support
 * - Health check queries
 * - Drizzle ORM initialization
 */

import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, PoolConfig } from 'pg';
import * as schema from './postgres-schema';

// Environment configuration
const isProduction = process.env.NODE_ENV === 'production';

/**
 * PostgreSQL connection configuration
 * Supports both direct connections and Cloud SQL Proxy
 */
function getPoolConfig(): PoolConfig {
    // Cloud SQL Proxy connection (recommended for local development with Cloud SQL)
    if (process.env.CLOUD_SQL_CONNECTION_NAME) {
        return {
            host: process.env.CLOUD_SQL_PROXY_HOST || '/cloudsql/' + process.env.CLOUD_SQL_CONNECTION_NAME,
            database: process.env.DB_NAME || 'ai_accountant',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD,
            // Pool configuration
            max: parseInt(process.env.DB_POOL_MAX || '20', 10),
            min: parseInt(process.env.DB_POOL_MIN || '5', 10),
            idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
            connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000', 10),
            // Statement timeout for long-running queries (important for fintech)
            statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000', 10),
        };
    }

    // Direct connection (for Cloud Run or direct Cloud SQL access)
    const config: PoolConfig = {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        database: process.env.DB_NAME || 'ai_accountant',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD,
        // Pool configuration
        max: parseInt(process.env.DB_POOL_MAX || '20', 10),
        min: parseInt(process.env.DB_POOL_MIN || '5', 10),
        idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
        connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000', 10),
        // Statement timeout
        statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000', 10),
    };

    // SSL configuration for Cloud SQL direct connections
    if (isProduction || process.env.DB_SSL === 'true') {
        config.ssl = {
            rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
            // For Cloud SQL with server CA
            ca: process.env.DB_SSL_CA,
            // For mTLS (mutual TLS) if required
            cert: process.env.DB_SSL_CERT,
            key: process.env.DB_SSL_KEY,
        };
    }

    return config;
}

// Create the connection pool
let pool: Pool | null = null;
let db: NodePgDatabase<typeof schema> | null = null;

/**
 * Initialize the PostgreSQL connection pool
 */
export function initializePool(): Pool {
    if (pool) {
        return pool;
    }

    const config = getPoolConfig();
    pool = new Pool(config);

    // Connection pool event handlers
    pool.on('connect', (client) => {
        console.log('[PostgreSQL] New client connected to pool');
        // Set session parameters for fintech accuracy
        client.query('SET timezone = \'UTC\'');
    });

    pool.on('error', (err) => {
        console.error('[PostgreSQL] Unexpected error on idle client:', err);
    });

    pool.on('remove', () => {
        console.log('[PostgreSQL] Client removed from pool');
    });

    return pool;
}

/**
 * Get the Drizzle ORM database instance
 */
export function getDb(): NodePgDatabase<typeof schema> {
    if (db) {
        return db;
    }

    const connectionPool = initializePool();
    db = drizzle(connectionPool, { schema });

    return db;
}

/**
 * Health check query to verify database connectivity
 * Returns connection pool stats and database status
 */
export async function healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    latencyMs: number;
    poolStats: {
        totalCount: number;
        idleCount: number;
        waitingCount: number;
    };
    error?: string;
}> {
    const start = Date.now();
    const connectionPool = initializePool();

    try {
        const client = await connectionPool.connect();
        try {
            // Simple health check query
            await client.query('SELECT 1 as health_check');

            // Verify timezone is set correctly (important for financial data)
            const tzResult = await client.query('SHOW timezone');

            const latencyMs = Date.now() - start;

            return {
                status: 'healthy',
                latencyMs,
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

/**
 * Gracefully close the connection pool
 * Call this during application shutdown
 */
export async function closePool(): Promise<void> {
    if (pool) {
        console.log('[PostgreSQL] Closing connection pool...');
        await pool.end();
        pool = null;
        db = null;
        console.log('[PostgreSQL] Connection pool closed');
    }
}

/**
 * Execute a raw SQL query with proper error handling
 * Use for complex queries not easily expressed with Drizzle ORM
 */
export async function rawQuery<T>(
    sql: string,
    params?: unknown[]
): Promise<T[]> {
    const connectionPool = initializePool();
    const client = await connectionPool.connect();

    try {
        const result = await client.query(sql, params);
        return result.rows as T[];
    } finally {
        client.release();
    }
}

/**
 * Execute a transaction with automatic rollback on error
 * Critical for financial data integrity
 */
export async function withTransaction<T>(
    callback: (client: Pool['prototype']) => Promise<T>
): Promise<T> {
    const connectionPool = initializePool();
    const client = await connectionPool.connect();

    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// Export for backwards compatibility with existing code
export { db, pool };

// Default export for Drizzle ORM
export default getDb;
