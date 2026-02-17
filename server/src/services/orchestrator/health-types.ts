/**
 * Health Monitoring Type Definitions
 *
 * Types and interfaces for agent health monitoring.
 */

import { AgentType, HealthState } from './types.js';

// ============================================================================
// HEALTH CHECK CONFIGURATION
// ============================================================================

export interface HealthCheckConfig {
  /** Interval between health checks (ms) */
  checkIntervalMs: number;
  /** Timeout for health check requests (ms) */
  checkTimeoutMs: number;
  /** Number of consecutive failures before marking unhealthy */
  failureThreshold: number;
  /** Number of consecutive successes before marking healthy */
  recoveryThreshold: number;
  /** Enable/disable background health checks */
  enabled: boolean;
}

export const DEFAULT_HEALTH_CONFIG: HealthCheckConfig = {
  checkIntervalMs: 30000, // 30 seconds
  checkTimeoutMs: 10000, // 10 seconds
  failureThreshold: 3,
  recoveryThreshold: 2,
  enabled: true,
};

export interface HealthCheckResult {
  healthy: boolean;
  responseTimeMs: number;
  error?: string;
  version?: string;
  details?: Record<string, unknown>;
}

export type HealthChangeListener = (
  agentType: AgentType,
  previousState: HealthState,
  currentState: HealthState,
) => void;

export interface HealthSummary {
  totalAgents: number;
  healthy: number;
  degraded: number;
  unhealthy: number;
  unknown: number;
  overallState: HealthState;
  agents: Record<
    AgentType,
    {
      state: HealthState;
      successRate: number;
      avgResponseTimeMs: number;
      activeRequests: number;
    }
  >;
}
