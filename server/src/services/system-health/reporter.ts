/**
 * System Health Monitoring — Health Report Generation, Metrics, and Query Methods
 */

import os from 'os';
import crypto from 'crypto';
import { db } from '../../schema.js';
import { systemMetrics, systemHealthChecks } from '../../db/admin-schema.js';
import { logger } from '../../lib/logger.js';
import type { HealthCheckResult, SystemHealthReport, DiskUsage, LatencyEntry } from './types.js';

// Re-export query functions for backward compatibility
export { getMetrics, getHealthHistory, cleanupOldData } from './metric-queries.js';

// ============================================================================
// UTILITY: Timeout wrapper
// ============================================================================

export function withTimeout<T>(fn: () => Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms);
    fn().then(
      (result) => {
        clearTimeout(timer);
        resolve(result);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

// ============================================================================
// Health Report Aggregation
// ============================================================================

export function buildHealthReport(checks: HealthCheckResult[]): SystemHealthReport {
  // Postgres down = unhealthy; non-critical services down = degraded
  const postgresCheck = checks.find((c) => c.service === 'postgres');
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  if (postgresCheck?.status === 'unhealthy') {
    overallStatus = 'unhealthy';
  } else if (checks.some((c) => c.status === 'unhealthy' || c.status === 'degraded')) {
    overallStatus = 'degraded';
  }

  return {
    overallStatus,
    timestamp: new Date().toISOString(),
    checks,
    uptime: Math.round(process.uptime()),
  };
}

// ============================================================================
// Persist Health Checks
// ============================================================================

export async function persistHealthChecks(checks: HealthCheckResult[]): Promise<void> {
  const now = new Date().toISOString();
  try {
    for (const check of checks) {
      await db
        .insert(systemHealthChecks)
        .values({
          id: crypto.randomUUID(),
          serviceName: check.service,
          checkType: 'periodic',
          status: check.status,
          responseTimeMs: check.responseTimeMs,
          details: JSON.stringify(check.details),
          errorMessage: check.error ?? null,
          checkedAt: now,
        })
        .run();
    }
  } catch (err: any) {
    logger.error('[SystemHealth] Failed to persist health checks:', err.message);
  }
}

// ============================================================================
// Metrics Collection
// ============================================================================

export async function collectMetrics(): Promise<void> {
  const now = new Date().toISOString();
  const mem = process.memoryUsage();
  const cpu = process.cpuUsage();
  const loadAvg = os.loadavg();

  const metrics = [
    {
      name: 'memory_rss_mb',
      type: 'gauge',
      value: mem.rss / 1048576,
      unit: 'MB',
      source: 'server',
    },
    {
      name: 'memory_heap_used_mb',
      type: 'gauge',
      value: mem.heapUsed / 1048576,
      unit: 'MB',
      source: 'server',
    },
    {
      name: 'memory_heap_total_mb',
      type: 'gauge',
      value: mem.heapTotal / 1048576,
      unit: 'MB',
      source: 'server',
    },
    {
      name: 'cpu_user_us',
      type: 'counter',
      value: cpu.user,
      unit: 'microseconds',
      source: 'server',
    },
    {
      name: 'cpu_system_us',
      type: 'counter',
      value: cpu.system,
      unit: 'microseconds',
      source: 'server',
    },
    {
      name: 'uptime_seconds',
      type: 'gauge',
      value: process.uptime(),
      unit: 'seconds',
      source: 'server',
    },
    { name: 'load_avg_1m', type: 'gauge', value: loadAvg[0], unit: 'load', source: 'os' },
    { name: 'load_avg_5m', type: 'gauge', value: loadAvg[1], unit: 'load', source: 'os' },
    { name: 'load_avg_15m', type: 'gauge', value: loadAvg[2], unit: 'load', source: 'os' },
    {
      name: 'free_memory_mb',
      type: 'gauge',
      value: os.freemem() / 1048576,
      unit: 'MB',
      source: 'os',
    },
    {
      name: 'total_memory_mb',
      type: 'gauge',
      value: os.totalmem() / 1048576,
      unit: 'MB',
      source: 'os',
    },
  ];

  try {
    for (const m of metrics) {
      await db
        .insert(systemMetrics)
        .values({
          id: crypto.randomUUID(),
          metricName: m.name,
          metricType: m.type,
          value: m.value,
          unit: m.unit,
          source: m.source,
          tags: '{}',
          observationTime: now,
        })
        .run();
    }
  } catch (err: any) {
    logger.error('[SystemHealth] Failed to collect metrics:', err.message);
  }
}

// ============================================================================
// Latency Buffer
// ============================================================================

export async function flushLatencyBuffer(entries: LatencyEntry[]): Promise<void> {
  if (entries.length === 0) return;

  try {
    for (const entry of entries) {
      await db
        .insert(systemMetrics)
        .values({
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
        })
        .run();
    }
  } catch (err: any) {
    logger.error('[SystemHealth] Failed to flush latency buffer:', err.message);
  }
}

// ============================================================================
// Disk Usage
// ============================================================================

export function getDiskUsage(): DiskUsage {
  try {
    const freeMemMb = os.freemem() / (1024 * 1024 * 1024);
    const totalMemGb = os.totalmem() / (1024 * 1024 * 1024);

    // Try filesystem stats via Node's statfs (available in Node 18.15+)
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
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
