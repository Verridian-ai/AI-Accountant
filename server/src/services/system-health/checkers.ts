/**
 * System Health Monitoring — Individual Health Check Implementations
 */

import { db } from '../../schema.js';
import { sql } from 'drizzle-orm';
import { config } from '../../lib/config.js';
import type { HealthCheckResult } from './types.js';
import { CONFIG } from './types.js';
import { withTimeout } from './reporter.js';

const COGNEE_URL = config.cogneeApiUrl;
const REDIS_URL = config.redisUrl;

export async function checkPostgres(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const result = await withTimeout(async () => {
      // Test basic connectivity
      await db
        .select({ one: sql`1` })
        .from(sql`(SELECT 1) AS t`)
        .get();

      // Gather stats
      const connCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(sql`pg_stat_activity`)
        .get();

      const dbSize = await db
        .select({ size: sql<string>`pg_size_pretty(pg_database_size(current_database()))` })
        .from(sql`(SELECT 1) AS t`)
        .get();

      const tableCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(sql`information_schema.tables`)
        .where(sql`table_schema = 'public'`)
        .get();

      return {
        connections: connCount?.count ?? 0,
        databaseSize: dbSize?.size ?? 'unknown',
        tableCount: tableCount?.count ?? 0,
      };
    }, CONFIG.timeoutMs);

    return {
      service: 'postgres',
      status: 'healthy',
      responseTimeMs: Date.now() - start,
      details: result,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'PostgreSQL check failed';
    return {
      service: 'postgres',
      status: 'unhealthy',
      responseTimeMs: Date.now() - start,
      details: {},
      error: message,
    };
  }
}

export async function checkCognee(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const result = await withTimeout(async () => {
      const res = await fetch(`${COGNEE_URL}/health`, {
        signal: AbortSignal.timeout(CONFIG.timeoutMs),
      });
      const healthy = res.ok;

      let datasetCount = 0;
      try {
        const dsRes = await fetch(`${COGNEE_URL}/api/v1/datasets`, {
          signal: AbortSignal.timeout(CONFIG.timeoutMs),
        });
        if (dsRes.ok) {
          const datasets = await dsRes.json();
          datasetCount = Array.isArray(datasets) ? datasets.length : 0;
        }
      } catch {
        // Dataset count is non-critical
      }

      return { healthy, statusCode: res.status, datasetCount };
    }, CONFIG.timeoutMs);

    return {
      service: 'cognee',
      status: result.healthy ? 'healthy' : 'degraded',
      responseTimeMs: Date.now() - start,
      details: result,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Cognee check failed';
    return {
      service: 'cognee',
      status: 'degraded',
      responseTimeMs: Date.now() - start,
      details: {},
      error: message,
    };
  }
}

export async function checkServer(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const mem = process.memoryUsage();
    const cpu = process.cpuUsage();

    return {
      service: 'server',
      status: 'healthy',
      responseTimeMs: Date.now() - start,
      details: {
        memoryMb: {
          rss: Math.round(mem.rss / 1048576),
          heapUsed: Math.round(mem.heapUsed / 1048576),
          heapTotal: Math.round(mem.heapTotal / 1048576),
          external: Math.round(mem.external / 1048576),
        },
        cpuMicroseconds: {
          user: cpu.user,
          system: cpu.system,
        },
        uptimeSeconds: Math.round(process.uptime()),
        nodeVersion: process.version,
        pid: process.pid,
        platform: process.platform,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server check failed';
    return {
      service: 'server',
      status: 'unhealthy',
      responseTimeMs: Date.now() - start,
      details: {},
      error: message,
    };
  }
}

export async function checkClient(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const result = await withTimeout(async () => {
      const res = await fetch('http://client:80/', {
        signal: AbortSignal.timeout(CONFIG.timeoutMs),
      });
      return { statusCode: res.status, healthy: res.ok };
    }, CONFIG.timeoutMs);

    return {
      service: 'client',
      status: result.healthy ? 'healthy' : 'degraded',
      responseTimeMs: Date.now() - start,
      details: result,
    };
  } catch (err: unknown) {
    // Client nginx may not be reachable outside Docker — graceful degradation
    const message = err instanceof Error ? err.message : 'Client check failed';
    return {
      service: 'client',
      status: 'degraded',
      responseTimeMs: Date.now() - start,
      details: { note: 'Client may not be reachable outside Docker' },
      error: message,
    };
  }
}

export async function checkRedis(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const result = await withTimeout(async () => {
      // Parse redis URL for host/port
      const url = new URL(REDIS_URL);
      const host = url.hostname || 'redis';
      const port = parseInt(url.port || '6379', 10);

      // Use raw TCP socket to send PING command
      const { createConnection } = await import('net');
      return new Promise<{ pong: boolean }>((resolve, reject) => {
        const socket = createConnection({ host, port }, () => {
          socket.write('PING\r\n');
        });
        socket.setTimeout(CONFIG.timeoutMs);
        socket.on('data', (data) => {
          const response = data.toString().trim();
          socket.end();
          resolve({ pong: response === '+PONG' });
        });
        socket.on('error', (err) => {
          socket.destroy();
          reject(err);
        });
        socket.on('timeout', () => {
          socket.destroy();
          reject(new Error('Redis connection timed out'));
        });
      });
    }, CONFIG.timeoutMs);

    return {
      service: 'redis',
      status: result.pong ? 'healthy' : 'degraded',
      responseTimeMs: Date.now() - start,
      details: result,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Redis check failed';
    return {
      service: 'redis',
      status: 'degraded',
      responseTimeMs: Date.now() - start,
      details: {},
      error: message,
    };
  }
}
