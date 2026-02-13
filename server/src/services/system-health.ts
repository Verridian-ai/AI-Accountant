/**
 * System Health Monitoring Service (Wave 20)
 *
 * Provides health checks for all Docker services (Postgres, Cognee, Redis, Client, Server),
 * system metrics collection, API latency middleware, disk usage stats, and periodic monitoring.
 */

import os from 'os';
import crypto from 'crypto';
import { db } from '../schema.js';
import { systemMetrics, systemHealthChecks } from '../db/admin-schema.js';
import { sql, desc, gte, lte, eq, and } from 'drizzle-orm';

// ============================================================================
// TYPES
// ============================================================================

interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTimeMs: number;
  details: Record<string, any>;
  error?: string;
}

interface SystemHealthReport {
  overallStatus: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: HealthCheckResult[];
  uptime: number;
}

interface MetricFilter {
  startTime?: string;
  endTime?: string;
  source?: string;
  metricName?: string;
  aggregation?: 'avg' | 'min' | 'max' | 'sum';
  interval?: 'minute' | 'hour' | 'day';
  limit?: number;
}

interface DiskUsage {
  totalGb: number;
  usedGb: number;
  freeGb: number;
  usedPercent: number;
}

interface LatencyEntry {
  path: string;
  method: string;
  durationMs: number;
  statusCode: number;
  timestamp: string;
}

// ============================================================================
// CONFIG
// ============================================================================

const CONFIG = {
  checkIntervalMs: 60_000,     // Health checks every 60s
  metricsIntervalMs: 30_000,   // Metrics collection every 30s
  timeoutMs: 5_000,            // Individual check timeout
  retentionHours: 168,         // 7 days retention
  latencyBufferSize: 50,       // Flush after 50 entries
  latencyFlushIntervalMs: 15_000, // Or flush every 15s
};

const COGNEE_URL = process.env.COGNEE_API_URL || 'http://cognee:8000';
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';

// ============================================================================
// SERVICE
// ============================================================================

class SystemHealthService {
  private healthInterval: ReturnType<typeof setInterval> | null = null;
  private metricsInterval: ReturnType<typeof setInterval> | null = null;
  private latencyFlushInterval: ReturnType<typeof setInterval> | null = null;
  private latencyBuffer: LatencyEntry[] = [];
  private running = false;

  // --------------------------------------------------------------------------
  // Health Checks
  // --------------------------------------------------------------------------

  async checkPostgres(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const result = await withTimeout(async () => {
        // Test basic connectivity
        await db.select({ one: sql`1` }).from(sql`(SELECT 1) AS t`).get();

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
    } catch (err: any) {
      return {
        service: 'postgres',
        status: 'unhealthy',
        responseTimeMs: Date.now() - start,
        details: {},
        error: err.message ?? 'PostgreSQL check failed',
      };
    }
  }

  async checkCognee(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const result = await withTimeout(async () => {
        const res = await fetch(`${COGNEE_URL}/health`, { signal: AbortSignal.timeout(CONFIG.timeoutMs) });
        const healthy = res.ok;

        let datasetCount = 0;
        try {
          const dsRes = await fetch(`${COGNEE_URL}/api/v1/datasets`, { signal: AbortSignal.timeout(CONFIG.timeoutMs) });
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
    } catch (err: any) {
      return {
        service: 'cognee',
        status: 'degraded',
        responseTimeMs: Date.now() - start,
        details: {},
        error: err.message ?? 'Cognee check failed',
      };
    }
  }

  async checkServer(): Promise<HealthCheckResult> {
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
    } catch (err: any) {
      return {
        service: 'server',
        status: 'unhealthy',
        responseTimeMs: Date.now() - start,
        details: {},
        error: err.message ?? 'Server check failed',
      };
    }
  }

  async checkClient(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const result = await withTimeout(async () => {
        const res = await fetch('http://client:80/', { signal: AbortSignal.timeout(CONFIG.timeoutMs) });
        return { statusCode: res.status, healthy: res.ok };
      }, CONFIG.timeoutMs);

      return {
        service: 'client',
        status: result.healthy ? 'healthy' : 'degraded',
        responseTimeMs: Date.now() - start,
        details: result,
      };
    } catch (err: any) {
      // Client nginx may not be reachable outside Docker — graceful degradation
      return {
        service: 'client',
        status: 'degraded',
        responseTimeMs: Date.now() - start,
        details: { note: 'Client may not be reachable outside Docker' },
        error: err.message ?? 'Client check failed',
      };
    }
  }

  async checkRedis(): Promise<HealthCheckResult> {
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
    } catch (err: any) {
      return {
        service: 'redis',
        status: 'degraded',
        responseTimeMs: Date.now() - start,
        details: {},
        error: err.message ?? 'Redis check failed',
      };
    }
  }

  // --------------------------------------------------------------------------
  // Aggregated Health
  // --------------------------------------------------------------------------

  async runAllChecks(): Promise<SystemHealthReport> {
    const results = await Promise.allSettled([
      this.checkPostgres(),
      this.checkCognee(),
      this.checkServer(),
      this.checkClient(),
      this.checkRedis(),
    ]);

    const checks: HealthCheckResult[] = results.map((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      const services = ['postgres', 'cognee', 'server', 'client', 'redis'];
      return {
        service: services[i],
        status: 'unhealthy' as const,
        responseTimeMs: 0,
        details: {},
        error: r.reason?.message ?? 'Check failed unexpectedly',
      };
    });

    // Postgres down = unhealthy; non-critical services down = degraded
    const postgresCheck = checks.find(c => c.service === 'postgres');
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (postgresCheck?.status === 'unhealthy') {
      overallStatus = 'unhealthy';
    } else if (checks.some(c => c.status === 'unhealthy' || c.status === 'degraded')) {
      overallStatus = 'degraded';
    }

    const report: SystemHealthReport = {
      overallStatus,
      timestamp: new Date().toISOString(),
      checks,
      uptime: Math.round(process.uptime()),
    };

    // Persist checks to DB (fire-and-forget)
    this.persistHealthChecks(checks).catch(() => {});

    return report;
  }

  // --------------------------------------------------------------------------
  // Metrics Collection
  // --------------------------------------------------------------------------

  async collectMetrics(): Promise<void> {
    const now = new Date().toISOString();
    const mem = process.memoryUsage();
    const cpu = process.cpuUsage();
    const loadAvg = os.loadavg();

    const metrics = [
      { name: 'memory_rss_mb', type: 'gauge', value: mem.rss / 1048576, unit: 'MB', source: 'server' },
      { name: 'memory_heap_used_mb', type: 'gauge', value: mem.heapUsed / 1048576, unit: 'MB', source: 'server' },
      { name: 'memory_heap_total_mb', type: 'gauge', value: mem.heapTotal / 1048576, unit: 'MB', source: 'server' },
      { name: 'cpu_user_us', type: 'counter', value: cpu.user, unit: 'microseconds', source: 'server' },
      { name: 'cpu_system_us', type: 'counter', value: cpu.system, unit: 'microseconds', source: 'server' },
      { name: 'uptime_seconds', type: 'gauge', value: process.uptime(), unit: 'seconds', source: 'server' },
      { name: 'load_avg_1m', type: 'gauge', value: loadAvg[0], unit: 'load', source: 'os' },
      { name: 'load_avg_5m', type: 'gauge', value: loadAvg[1], unit: 'load', source: 'os' },
      { name: 'load_avg_15m', type: 'gauge', value: loadAvg[2], unit: 'load', source: 'os' },
      { name: 'free_memory_mb', type: 'gauge', value: os.freemem() / 1048576, unit: 'MB', source: 'os' },
      { name: 'total_memory_mb', type: 'gauge', value: os.totalmem() / 1048576, unit: 'MB', source: 'os' },
    ];

    try {
      for (const m of metrics) {
        await db.insert(systemMetrics).values({
          id: crypto.randomUUID(),
          metricName: m.name,
          metricType: m.type,
          value: m.value,
          unit: m.unit,
          source: m.source,
          tags: '{}',
          observationTime: now,
        }).run();
      }
    } catch (err: any) {
      console.error('[SystemHealth] Failed to collect metrics:', err.message);
    }
  }

  // --------------------------------------------------------------------------
  // API Latency Middleware
  // --------------------------------------------------------------------------

  requestLatencyMiddleware() {
    return async (c: any, next: () => Promise<void>) => {
      const start = Date.now();
      await next();
      const duration = Date.now() - start;

      this.latencyBuffer.push({
        path: c.req.path,
        method: c.req.method,
        durationMs: duration,
        statusCode: c.res.status,
        timestamp: new Date().toISOString(),
      });

      // Flush when buffer is full
      if (this.latencyBuffer.length >= CONFIG.latencyBufferSize) {
        this.flushLatencyBuffer();
      }
    };
  }

  private async flushLatencyBuffer(): Promise<void> {
    if (this.latencyBuffer.length === 0) return;

    const entries = [...this.latencyBuffer];
    this.latencyBuffer = [];

    try {
      for (const entry of entries) {
        await db.insert(systemMetrics).values({
          id: crypto.randomUUID(),
          metricName: 'api_latency_ms',
          metricType: 'histogram',
          value: entry.durationMs,
          unit: 'ms',
          source: 'api',
          tags: JSON.stringify({
            path: entry.path,
            method: entry.method,
            statusCode: entry.statusCode,
          }),
          observationTime: entry.timestamp,
        }).run();
      }
    } catch (err: any) {
      console.error('[SystemHealth] Failed to flush latency buffer:', err.message);
    }
  }

  // --------------------------------------------------------------------------
  // Query Methods
  // --------------------------------------------------------------------------

  async getMetrics(filters: MetricFilter = {}): Promise<any[]> {
    try {
      const conditions: any[] = [];

      if (filters.startTime) {
        conditions.push(gte(systemMetrics.observationTime, filters.startTime));
      }
      if (filters.endTime) {
        conditions.push(lte(systemMetrics.observationTime, filters.endTime));
      }
      if (filters.source) {
        conditions.push(eq(systemMetrics.source, filters.source));
      }
      if (filters.metricName) {
        conditions.push(eq(systemMetrics.metricName, filters.metricName));
      }

      if (filters.aggregation) {
        const aggFn = {
          avg: sql`AVG(${systemMetrics.value})`,
          min: sql`MIN(${systemMetrics.value})`,
          max: sql`MAX(${systemMetrics.value})`,
          sum: sql`SUM(${systemMetrics.value})`,
        }[filters.aggregation];

        const intervalExpr = filters.interval === 'minute'
          ? sql`substr(${systemMetrics.observationTime}, 1, 16)`  // YYYY-MM-DDTHH:MM
          : filters.interval === 'hour'
          ? sql`substr(${systemMetrics.observationTime}, 1, 13)`  // YYYY-MM-DDTHH
          : sql`substr(${systemMetrics.observationTime}, 1, 10)`; // YYYY-MM-DD

        const query = db
          .select({
            period: intervalExpr,
            metricName: systemMetrics.metricName,
            value: aggFn,
            count: sql<number>`count(*)`,
          })
          .from(systemMetrics);

        if (conditions.length > 0) {
          return await (query as any).where(and(...conditions))
            .groupBy(intervalExpr, systemMetrics.metricName)
            .orderBy(desc(intervalExpr))
            .limit(filters.limit ?? 500)
            .all();
        }

        return await (query as any)
          .groupBy(intervalExpr, systemMetrics.metricName)
          .orderBy(desc(intervalExpr))
          .limit(filters.limit ?? 500)
          .all();
      }

      // Non-aggregated query
      const query = db
        .select()
        .from(systemMetrics);

      if (conditions.length > 0) {
        return await (query as any).where(and(...conditions))
          .orderBy(desc(systemMetrics.observationTime))
          .limit(filters.limit ?? 200)
          .all();
      }

      return await (query as any)
        .orderBy(desc(systemMetrics.observationTime))
        .limit(filters.limit ?? 200)
        .all();
    } catch (err: any) {
      console.error('[SystemHealth] Failed to get metrics:', err.message);
      return [];
    }
  }

  async getHealthHistory(serviceName?: string, hours: number = 24): Promise<any[]> {
    try {
      const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

      const conditions: any[] = [
        gte(systemHealthChecks.checkedAt, cutoff),
      ];

      if (serviceName) {
        conditions.push(eq(systemHealthChecks.serviceName, serviceName));
      }

      return await db
        .select()
        .from(systemHealthChecks)
        .where(and(...conditions))
        .orderBy(desc(systemHealthChecks.checkedAt))
        .limit(500)
        .all();
    } catch (err: any) {
      console.error('[SystemHealth] Failed to get health history:', err.message);
      return [];
    }
  }

  // --------------------------------------------------------------------------
  // Disk Usage
  // --------------------------------------------------------------------------

  getDiskUsage(): DiskUsage {
    try {
      const total = os.totalmem(); // Fallback: use memory as proxy in containers
      // os module doesn't expose disk stats directly; use a heuristic via /proc or statvfs
      // For portability, we try to read /proc/diskstats or use a simpler approach
      const freeMemMb = os.freemem() / (1024 * 1024 * 1024);
      const totalMemGb = os.totalmem() / (1024 * 1024 * 1024);

      // Try filesystem stats via Node's statfs (available in Node 18.15+)
      try {
        const fs = require('fs');
        const stats = fs.statfsSync('/');
        const totalGb = (stats.bsize * stats.blocks) / (1024 * 1024 * 1024);
        const freeGb = (stats.bsize * stats.bavail) / (1024 * 1024 * 1024);
        const usedGb = totalGb - freeGb;

        return {
          totalGb: Math.round(totalGb * 100) / 100,
          usedGb: Math.round(usedGb * 100) / 100,
          freeGb: Math.round(freeGb * 100) / 100,
          usedPercent: Math.round((usedGb / totalGb) * 10000) / 100,
        };
      } catch {
        // statfsSync not available — return memory-based approximation
        return {
          totalGb: Math.round(totalMemGb * 100) / 100,
          usedGb: Math.round((totalMemGb - freeMemMb) * 100) / 100,
          freeGb: Math.round(freeMemMb * 100) / 100,
          usedPercent: Math.round(((totalMemGb - freeMemMb) / totalMemGb) * 10000) / 100,
        };
      }
    } catch {
      return { totalGb: 0, usedGb: 0, freeGb: 0, usedPercent: 0 };
    }
  }

  // --------------------------------------------------------------------------
  // Background Monitoring
  // --------------------------------------------------------------------------

  start(): void {
    if (this.running) return;
    this.running = true;
    console.log('[SystemHealth] Starting background monitoring');

    // Health checks every 60s
    this.healthInterval = setInterval(() => {
      this.runAllChecks().catch(err => {
        console.error('[SystemHealth] Background health check failed:', err.message);
      });
    }, CONFIG.checkIntervalMs);

    // Metrics collection every 30s
    this.metricsInterval = setInterval(() => {
      this.collectMetrics().catch(err => {
        console.error('[SystemHealth] Background metrics collection failed:', err.message);
      });
    }, CONFIG.metricsIntervalMs);

    // Latency buffer flush every 15s
    this.latencyFlushInterval = setInterval(() => {
      this.flushLatencyBuffer().catch(err => {
        console.error('[SystemHealth] Latency buffer flush failed:', err.message);
      });
    }, CONFIG.latencyFlushIntervalMs);

    // Cleanup old data daily
    setInterval(() => {
      this.cleanupOldData().catch(err => {
        console.error('[SystemHealth] Cleanup failed:', err.message);
      });
    }, 24 * 60 * 60 * 1000);

    // Run initial check after a brief delay (let other services start)
    setTimeout(() => {
      this.runAllChecks().catch(() => {});
      this.collectMetrics().catch(() => {});
    }, 5000);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    console.log('[SystemHealth] Stopping background monitoring');

    if (this.healthInterval) clearInterval(this.healthInterval);
    if (this.metricsInterval) clearInterval(this.metricsInterval);
    if (this.latencyFlushInterval) clearInterval(this.latencyFlushInterval);

    this.healthInterval = null;
    this.metricsInterval = null;
    this.latencyFlushInterval = null;

    // Flush remaining latency entries
    this.flushLatencyBuffer().catch(() => {});
  }

  // --------------------------------------------------------------------------
  // Cleanup
  // --------------------------------------------------------------------------

  async cleanupOldData(): Promise<{ deletedMetrics: number; deletedChecks: number }> {
    const cutoff = new Date(Date.now() - CONFIG.retentionHours * 60 * 60 * 1000).toISOString();
    let deletedMetrics = 0;
    let deletedChecks = 0;

    try {
      await db.delete(systemMetrics)
        .where(lte(systemMetrics.observationTime, cutoff))
        .run();
      // Can't easily get deleted count from drizzle .run(), so estimate
      deletedMetrics = -1; // Indicates cleanup ran

      await db.delete(systemHealthChecks)
        .where(lte(systemHealthChecks.checkedAt, cutoff))
        .run();
      deletedChecks = -1;

      console.log(`[SystemHealth] Cleaned up data older than ${CONFIG.retentionHours}h`);
    } catch (err: any) {
      console.error('[SystemHealth] Cleanup failed:', err.message);
    }

    return { deletedMetrics, deletedChecks };
  }

  // --------------------------------------------------------------------------
  // Private Helpers
  // --------------------------------------------------------------------------

  private async persistHealthChecks(checks: HealthCheckResult[]): Promise<void> {
    const now = new Date().toISOString();
    try {
      for (const check of checks) {
        await db.insert(systemHealthChecks).values({
          id: crypto.randomUUID(),
          serviceName: check.service,
          checkType: 'periodic',
          status: check.status,
          responseTimeMs: check.responseTimeMs,
          details: JSON.stringify(check.details),
          errorMessage: check.error ?? null,
          checkedAt: now,
        }).run();
      }
    } catch (err: any) {
      console.error('[SystemHealth] Failed to persist health checks:', err.message);
    }
  }
}

// ============================================================================
// UTILITY: Timeout wrapper
// ============================================================================

function withTimeout<T>(fn: () => Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms);
    fn().then(
      (result) => { clearTimeout(timer); resolve(result); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

// ============================================================================
// SINGLETON
// ============================================================================

export const systemHealth = new SystemHealthService();
