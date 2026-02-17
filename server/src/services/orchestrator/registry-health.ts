/**
 * Agent Registry Health Management
 *
 * Health tracking, metrics calculation, and error recording
 * for agents in the registry.
 */

import type { AgentType, AgentHealth, HealthState, ErrorCode } from './types.js';
import { HEALTH_THRESHOLDS } from './types.js';

// ============================================================================
// METRICS WINDOW
// ============================================================================

export interface MetricsWindow {
  responseTimes: number[];
  windowStartTime: number;
  windowDurationMs: number;
}

// ============================================================================
// HEALTH MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Initialize health state for an agent
 */
export function createInitialHealth(agentType: AgentType): AgentHealth {
  return {
    agentType,
    state: 'unknown',
    lastCheckAt: new Date().toISOString(),
    metrics: {
      totalRequests: 0,
      successCount: 0,
      errorCount: 0,
      timeoutCount: 0,
      successRate: 1,
      avgResponseTimeMs: 0,
      p95ResponseTimeMs: 0,
      activeRequests: 0,
      queueDepth: 0,
    },
    recentErrors: [],
  };
}

/**
 * Initialize metrics window for an agent
 */
export function createInitialMetricsWindow(): MetricsWindow {
  return {
    responseTimes: [],
    windowStartTime: Date.now(),
    windowDurationMs: 5 * 60 * 1000, // 5 minutes
  };
}

/**
 * Add a response time to the metrics window and update health metrics
 */
export function addResponseTime(
  health: AgentHealth,
  metricsWindow: MetricsWindow,
  responseTimeMs: number,
): void {
  // Clean old entries
  const now = Date.now();
  if (now - metricsWindow.windowStartTime > metricsWindow.windowDurationMs) {
    metricsWindow.responseTimes = [];
    metricsWindow.windowStartTime = now;
  }

  metricsWindow.responseTimes.push(responseTimeMs);

  const times = metricsWindow.responseTimes;
  if (times.length === 0) {
    health.metrics.avgResponseTimeMs = 0;
    health.metrics.p95ResponseTimeMs = 0;
    return;
  }

  health.metrics.avgResponseTimeMs = times.reduce((a, b) => a + b, 0) / times.length;

  // Calculate p95
  const sorted = [...times].sort((a, b) => a - b);
  const p95Index = Math.min(Math.floor(sorted.length * 0.95), sorted.length - 1);
  health.metrics.p95ResponseTimeMs = sorted[p95Index] ?? 0;
}

/**
 * Add a recent error to the health state
 */
export function addRecentError(health: AgentHealth, errorCode: string, errorMessage: string): void {
  const validErrorCodes: ErrorCode[] = [
    'TIMEOUT',
    'PROCESS_CRASHED',
    'INVALID_RESPONSE',
    'MODEL_ERROR',
    'VALIDATION_ERROR',
    'RATE_LIMITED',
    'AGENT_UNAVAILABLE',
    'CONTEXT_TOO_LARGE',
    'UNKNOWN_ERROR',
  ];
  const validatedCode: ErrorCode = validErrorCodes.includes(errorCode as ErrorCode)
    ? (errorCode as ErrorCode)
    : 'UNKNOWN_ERROR';

  const existing = health.recentErrors.find((e) => e.code === validatedCode);
  if (existing) {
    existing.count++;
    existing.lastOccurrence = new Date().toISOString();
    existing.sampleMessage = errorMessage;
  } else {
    health.recentErrors.push({
      code: validatedCode,
      count: 1,
      lastOccurrence: new Date().toISOString(),
      sampleMessage: errorMessage,
    });
  }

  // Keep only last 10 error types
  if (health.recentErrors.length > 10) {
    health.recentErrors = health.recentErrors.slice(-10);
  }
}

/**
 * Recalculate health state based on current metrics
 */
export function recalculateHealth(health: AgentHealth): void {
  const metrics = health.metrics;

  // Calculate success rate
  metrics.successRate =
    metrics.totalRequests > 0 ? metrics.successCount / metrics.totalRequests : 1;

  // Determine health state
  let state: HealthState = 'unknown';

  if (metrics.totalRequests === 0) {
    state = 'unknown';
  } else if (
    metrics.successRate >= HEALTH_THRESHOLDS.healthySuccessRate &&
    metrics.p95ResponseTimeMs <= HEALTH_THRESHOLDS.healthyP95Ms &&
    metrics.errorCount <= HEALTH_THRESHOLDS.maxErrorsBeforeDegraded
  ) {
    state = 'healthy';
  } else if (
    metrics.successRate >= HEALTH_THRESHOLDS.degradedSuccessRate &&
    metrics.p95ResponseTimeMs <= HEALTH_THRESHOLDS.degradedP95Ms &&
    metrics.errorCount <= HEALTH_THRESHOLDS.maxErrorsBeforeUnhealthy
  ) {
    state = 'degraded';
  } else {
    state = 'unhealthy';
  }

  health.state = state;
  health.lastCheckAt = new Date().toISOString();
}
