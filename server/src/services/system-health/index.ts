/**
 * System Health — Barrel Export
 *
 * Re-exports all types, health checkers, reporter utilities,
 * and the SystemHealthService class + singleton.
 */

export type {
  HealthCheckResult,
  SystemHealthReport,
  MetricFilter,
  DiskUsage,
  LatencyEntry,
} from './types.js';
export { CONFIG } from './types.js';

export { checkPostgres, checkCognee, checkServer, checkClient, checkRedis } from './checkers.js';

export {
  withTimeout,
  buildHealthReport,
  persistHealthChecks,
  collectMetrics,
  flushLatencyBuffer,
  getMetrics,
  getHealthHistory,
  getDiskUsage,
  cleanupOldData,
} from './reporter.js';

export { SystemHealthService, systemHealth } from './health-service.js';
