/**
 * Agent Orchestrator Core Type Definitions
 *
 * Core type system for agent configuration, requests, responses, and errors.
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
