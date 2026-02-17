/**
 * System Health Monitoring — Type Definitions
 */

export interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTimeMs: number;
  details: Record<string, any>;
  error?: string;
}

export interface SystemHealthReport {
  overallStatus: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: HealthCheckResult[];
  uptime: number;
}

export interface MetricFilter {
  startTime?: string;
  endTime?: string;
  source?: string;
  metricName?: string;
  aggregation?: 'avg' | 'min' | 'max' | 'sum';
  interval?: 'minute' | 'hour' | 'day';
  limit?: number;
}

export interface DiskUsage {
  totalGb: number;
  usedGb: number;
  freeGb: number;
  usedPercent: number;
}

export interface LatencyEntry {
  path: string;
  method: string;
  durationMs: number;
  statusCode: number;
  timestamp: string;
}

export const CONFIG = {
  checkIntervalMs: 60_000, // Health checks every 60s
  metricsIntervalMs: 30_000, // Metrics collection every 30s
  timeoutMs: 5_000, // Individual check timeout
  retentionHours: 168, // 7 days retention
  latencyBufferSize: 50, // Flush after 50 entries
  latencyFlushIntervalMs: 15_000, // Or flush every 15s
};
