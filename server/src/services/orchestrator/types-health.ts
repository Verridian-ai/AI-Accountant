/**
 * Health Monitoring & Cache Type Definitions
 *
 * Types for agent health monitoring, caching, and tracing subsystems.
 */

import type { AgentType, AgentResponse, ErrorCode } from './types-core.js';

// ============================================================================
// HEALTH MONITORING
// ============================================================================

export type HealthState = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface AgentHealth {
  /** Agent identifier */
  agentType: AgentType;
  /** Current health state */
  state: HealthState;
  /** Last health check timestamp */
  lastCheckAt: string;
  /** Last successful execution timestamp */
  lastSuccessAt?: string;
  /** Health metrics */
  metrics: HealthMetrics;
  /** Recent errors */
  recentErrors: ErrorSummary[];
}

export interface HealthMetrics {
  /** Total requests processed */
  totalRequests: number;
  /** Successful requests */
  successCount: number;
  /** Failed requests */
  errorCount: number;
  /** Timeout count */
  timeoutCount: number;
  /** Success rate (0-1) */
  successRate: number;
  /** Average response time in ms */
  avgResponseTimeMs: number;
  /** 95th percentile response time */
  p95ResponseTimeMs: number;
  /** Currently active requests */
  activeRequests: number;
  /** Queue depth */
  queueDepth: number;
}

export interface ErrorSummary {
  /** Error code */
  code: ErrorCode;
  /** Error count */
  count: number;
  /** Last occurrence timestamp */
  lastOccurrence: string;
  /** Sample error message */
  sampleMessage: string;
}

// Health state thresholds
export const HEALTH_THRESHOLDS = {
  /** Success rate threshold for healthy state */
  healthySuccessRate: 0.95,
  /** Success rate threshold for degraded state */
  degradedSuccessRate: 0.8,
  /** Maximum p95 response time for healthy state (ms) */
  healthyP95Ms: 30000,
  /** Maximum p95 response time for degraded state (ms) */
  degradedP95Ms: 60000,
  /** Maximum error count before degraded */
  maxErrorsBeforeDegraded: 3,
  /** Maximum error count before unhealthy */
  maxErrorsBeforeUnhealthy: 10,
};

// ============================================================================
// CACHING
// ============================================================================

export interface CacheEntry {
  /** Cache key */
  key: string;
  /** Cached response */
  response: AgentResponse;
  /** Creation timestamp */
  createdAt: string;
  /** Expiration timestamp */
  expiresAt: string;
  /** Number of cache hits */
  hitCount: number;
  /** Last access timestamp */
  lastAccessedAt: string;
}

export interface CacheConfig {
  /** Maximum cache entries */
  maxEntries: number;
  /** Default TTL in milliseconds */
  defaultTtlMs: number;
  /** Enable/disable caching */
  enabled: boolean;
}

export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  maxEntries: 1000,
  defaultTtlMs: 5 * 60 * 1000, // 5 minutes
  enabled: true,
};

export interface CacheStats {
  /** Total cache entries */
  totalEntries: number;
  /** Total cache hits */
  totalHits: number;
  /** Total cache misses */
  totalMisses: number;
  /** Hit rate (0-1) */
  hitRate: number;
  /** Cache size in bytes (approximate) */
  sizeBytes: number;
  /** Oldest entry timestamp */
  oldestEntry?: string;
  /** Entries by agent type */
  entriesByAgent: Record<AgentType, number>;
}

// ============================================================================
// TRACING
// ============================================================================

export interface TraceSpan {
  /** Span ID */
  spanId: string;
  /** Parent span ID */
  parentSpanId?: string;
  /** Trace ID */
  traceId: string;
  /** Span name */
  name: string;
  /** Start timestamp */
  startTime: string;
  /** End timestamp */
  endTime?: string;
  /** Duration in ms */
  durationMs?: number;
  /** Span attributes */
  attributes: Record<string, unknown>;
  /** Span events */
  events: TraceEvent[];
  /** Span status */
  status: 'ok' | 'error' | 'unset';
}

export interface TraceEvent {
  /** Event name */
  name: string;
  /** Event timestamp */
  timestamp: string;
  /** Event attributes */
  attributes?: Record<string, unknown>;
}

// ============================================================================
// ORCHESTRATOR INTERFACE
// ============================================================================

export interface IAgentOrchestrator {
  /** Execute a single agent request */
  execute(request: import('./types-core.js').AgentRequest): Promise<AgentResponse>;

  /** Execute multiple requests concurrently */
  executeConcurrent(requests: import('./types-core.js').AgentRequest[]): Promise<AgentResponse[]>;

  /** Execute requests sequentially */
  executeSequential(requests: import('./types-core.js').AgentRequest[]): Promise<AgentResponse[]>;

  /** Get agent health status */
  getHealth(agentType?: AgentType): Promise<AgentHealth | AgentHealth[]>;

  /** Get cache statistics */
  getCacheStats(): Promise<CacheStats>;

  /** Clear cache */
  clearCache(agentType?: AgentType): Promise<void>;

  /** Cancel a running request */
  cancel(requestId: string): Promise<boolean>;
}
