/**
 * Agent Orchestrator Type Definitions
 *
 * Core type system for the agent orchestration layer that manages
 * Python agent execution with timeouts, retries, caching, and health monitoring.
 */

// ============================================================================
// AGENT CONFIGURATION
// ============================================================================

export type AgentType = 'financial-analyst' | 'bas' | 'tax' | 'reconciliation';

export interface AgentConfig {
  /** Unique agent identifier */
  id: AgentType;
  /** Human-readable agent name */
  name: string;
  /** Agent description */
  description: string;
  /** Path to Python agent script */
  scriptPath: string;
  /** Default timeout in milliseconds */
  timeoutMs: number;
  /** Maximum retry attempts */
  maxRetries: number;
  /** Base delay for exponential backoff (ms) */
  retryDelayMs: number;
  /** Agent capabilities for routing */
  capabilities: string[];
  /** Model type preference */
  modelType: 'reasoning' | 'fast' | 'code' | 'vision';
  /** Priority (higher = preferred) */
  priority: number;
}

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

export interface AgentRequest {
  /** Unique request identifier */
  requestId: string;
  /** Target agent type */
  agentType: AgentType;
  /** User query/command */
  query: string;
  /** User ID for context isolation */
  userId: string;
  /** Optional context data */
  context?: AgentContext;
  /** Request-specific timeout override */
  timeoutMs?: number;
  /** Skip cache lookup */
  skipCache?: boolean;
  /** Priority level (1-10, 10 = highest) */
  priority?: number;
}

export interface AgentContext {
  /** Transaction IDs to include */
  transactionIds?: string[];
  /** Account IDs to include */
  accountIds?: string[];
  /** Date range filter */
  dateRange?: {
    start: string;
    end: string;
  };
  /** Previous conversation turns */
  conversationHistory?: ConversationTurn[];
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface AgentResponse {
  /** Original request ID */
  requestId: string;
  /** Agent that handled the request */
  agentType: AgentType;
  /** Response content */
  content: string;
  /** Structured data if applicable */
  data?: Record<string, unknown>;
  /** Tool calls made during execution */
  toolCalls?: ToolCall[];
  /** Execution metadata */
  metadata: ResponseMetadata;
  /** Whether response came from cache */
  fromCache: boolean;
  /** Response status */
  status: ResponseStatus;
}

export type ResponseStatus = 'success' | 'error' | 'timeout' | 'cancelled';

export interface ResponseMetadata {
  /** Total execution time in ms */
  executionTimeMs: number;
  /** Time spent in agent process */
  agentTimeMs: number;
  /** Number of retry attempts */
  retryCount: number;
  /** Model used for generation */
  modelUsed?: string;
  /** Token usage if available */
  tokenUsage?: TokenUsage;
  /** Agent version hash */
  agentVersion?: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ToolCall {
  /** Tool name */
  name: string;
  /** Tool arguments */
  args: Record<string, unknown>;
  /** Tool result */
  result?: unknown;
  /** Execution time in ms */
  durationMs: number;
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

export type ErrorCode =
  | 'TIMEOUT'
  | 'PROCESS_CRASHED'
  | 'INVALID_RESPONSE'
  | 'MODEL_ERROR'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'AGENT_UNAVAILABLE'
  | 'CONTEXT_TOO_LARGE'
  | 'UNKNOWN_ERROR';

export interface AgentError {
  /** Error code for programmatic handling */
  code: ErrorCode;
  /** Human-readable error message */
  message: string;
  /** Whether the error is retryable */
  retryable: boolean;
  /** Original error if available */
  cause?: Error;
  /** Stack trace */
  stack?: string;
  /** Additional error context */
  context?: Record<string, unknown>;
}

export const ERROR_CONFIG: Record<ErrorCode, { retryable: boolean; defaultMessage: string }> = {
  TIMEOUT: { retryable: true, defaultMessage: 'Agent execution timed out' },
  PROCESS_CRASHED: { retryable: true, defaultMessage: 'Agent process terminated unexpectedly' },
  INVALID_RESPONSE: { retryable: false, defaultMessage: 'Agent returned invalid response format' },
  MODEL_ERROR: { retryable: true, defaultMessage: 'LLM API error occurred' },
  VALIDATION_ERROR: { retryable: false, defaultMessage: 'Request validation failed' },
  RATE_LIMITED: { retryable: true, defaultMessage: 'Rate limit exceeded' },
  AGENT_UNAVAILABLE: { retryable: false, defaultMessage: 'Agent is not available' },
  CONTEXT_TOO_LARGE: { retryable: false, defaultMessage: 'Context exceeds maximum size' },
  UNKNOWN_ERROR: { retryable: false, defaultMessage: 'An unknown error occurred' },
};

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
  degradedSuccessRate: 0.80,
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
  execute(request: AgentRequest): Promise<AgentResponse>;

  /** Execute multiple requests concurrently */
  executeConcurrent(requests: AgentRequest[]): Promise<AgentResponse[]>;

  /** Execute requests sequentially */
  executeSequential(requests: AgentRequest[]): Promise<AgentResponse[]>;

  /** Get agent health status */
  getHealth(agentType?: AgentType): Promise<AgentHealth | AgentHealth[]>;

  /** Get cache statistics */
  getCacheStats(): Promise<CacheStats>;

  /** Clear cache */
  clearCache(agentType?: AgentType): Promise<void>;

  /** Cancel a running request */
  cancel(requestId: string): Promise<boolean>;
}

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
