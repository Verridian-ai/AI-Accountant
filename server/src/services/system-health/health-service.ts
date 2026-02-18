/**
 * System Health Monitoring — Main Service
 */

import { logger } from '../../lib/logger.js';
import type { Context } from 'hono';
import type {
  HealthCheckResult,
  SystemHealthReport,
  MetricFilter,
  DiskUsage,
  LatencyEntry,
} from './types.js';
import { CONFIG } from './types.js';
import { checkPostgres, checkCognee, checkServer, checkClient, checkRedis } from './checkers.js';
import {
  buildHealthReport,
  persistHealthChecks,
  collectMetrics as collectMetricsFn,
  flushLatencyBuffer,
  getMetrics as getMetricsFn,
  getHealthHistory as getHealthHistoryFn,
  getDiskUsage as getDiskUsageFn,
  cleanupOldData as cleanupOldDataFn,
} from './reporter.js';

export class SystemHealthService {
  private healthInterval: ReturnType<typeof setInterval> | null = null;
  private metricsInterval: ReturnType<typeof setInterval> | null = null;
  private latencyFlushInterval: ReturnType<typeof setInterval> | null = null;
  private latencyBuffer: LatencyEntry[] = [];
  private running = false;

  // --------------------------------------------------------------------------
  // Health Checks (delegated to checkers module)
  // --------------------------------------------------------------------------

  checkPostgres(): Promise<HealthCheckResult> {
    return checkPostgres();
  }

  checkCognee(): Promise<HealthCheckResult> {
    return checkCognee();
  }

  checkServer(): Promise<HealthCheckResult> {
    return checkServer();
  }

  checkClient(): Promise<HealthCheckResult> {
    return checkClient();
  }

  checkRedis(): Promise<HealthCheckResult> {
    return checkRedis();
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

    const report = buildHealthReport(checks);

    // Persist checks to DB (fire-and-forget)
    persistHealthChecks(checks).catch(() => {});

    return report;
  }

  // --------------------------------------------------------------------------
  // Metrics Collection
  // --------------------------------------------------------------------------

  async collectMetrics(): Promise<void> {
    return collectMetricsFn();
  }

  // --------------------------------------------------------------------------
  // API Latency Middleware
  // --------------------------------------------------------------------------

  requestLatencyMiddleware() {
    return async (c: Context, next: () => Promise<void>) => {
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
        this.doFlushLatencyBuffer();
      }
    };
  }

  private async doFlushLatencyBuffer(): Promise<void> {
    if (this.latencyBuffer.length === 0) return;

    const entries = [...this.latencyBuffer];
    this.latencyBuffer = [];
    return flushLatencyBuffer(entries);
  }

  // --------------------------------------------------------------------------
  // Query Methods
  // --------------------------------------------------------------------------

  async getMetrics(filters: MetricFilter = {}): Promise<any[]> {
    return getMetricsFn(filters);
  }

  async getHealthHistory(serviceName?: string, hours: number = 24): Promise<any[]> {
    return getHealthHistoryFn(serviceName, hours);
  }

  // --------------------------------------------------------------------------
  // Disk Usage
  // --------------------------------------------------------------------------

  getDiskUsage(): DiskUsage {
    return getDiskUsageFn();
  }

  // --------------------------------------------------------------------------
  // Background Monitoring
  // --------------------------------------------------------------------------

  start(): void {
    if (this.running) return;
    this.running = true;
    logger.info('[SystemHealth] Starting background monitoring');

    // Health checks every 60s
    this.healthInterval = setInterval(() => {
      this.runAllChecks().catch((err) => {
        logger.error('[SystemHealth] Background health check failed:', err.message);
      });
    }, CONFIG.checkIntervalMs);

    // Metrics collection every 30s
    this.metricsInterval = setInterval(() => {
      this.collectMetrics().catch((err) => {
        logger.error('[SystemHealth] Background metrics collection failed:', err.message);
      });
    }, CONFIG.metricsIntervalMs);

    // Latency buffer flush every 15s
    this.latencyFlushInterval = setInterval(() => {
      this.doFlushLatencyBuffer().catch((err) => {
        logger.error('[SystemHealth] Latency buffer flush failed:', err.message);
      });
    }, CONFIG.latencyFlushIntervalMs);

    // Cleanup old data daily
    setInterval(
      () => {
        this.cleanupOldData().catch((err) => {
          logger.error('[SystemHealth] Cleanup failed:', err.message);
        });
      },
      24 * 60 * 60 * 1000,
    );

    // Run initial check after a brief delay (let other services start)
    setTimeout(() => {
      this.runAllChecks().catch(() => {});
      this.collectMetrics().catch(() => {});
    }, 5000);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    logger.info('[SystemHealth] Stopping background monitoring');

    if (this.healthInterval) clearInterval(this.healthInterval);
    if (this.metricsInterval) clearInterval(this.metricsInterval);
    if (this.latencyFlushInterval) clearInterval(this.latencyFlushInterval);

    this.healthInterval = null;
    this.metricsInterval = null;
    this.latencyFlushInterval = null;

    // Flush remaining latency entries
    this.doFlushLatencyBuffer().catch(() => {});
  }

  // --------------------------------------------------------------------------
  // Cleanup
  // --------------------------------------------------------------------------

  async cleanupOldData(): Promise<{ deletedMetrics: number; deletedChecks: number }> {
    return cleanupOldDataFn();
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

export const systemHealth = new SystemHealthService();
