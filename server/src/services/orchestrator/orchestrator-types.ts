/**
 * Orchestrator Internal Types
 *
 * Internal types and error class for the agent orchestrator.
 */

import { ErrorCode, ERROR_CONFIG, AgentError } from './types.js';

// ============================================================================
// ERROR CLASS
// ============================================================================

export class AgentErrorImpl extends Error implements AgentError {
  code: ErrorCode;
  retryable: boolean;
  cause?: Error;
  context?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, retryable: boolean) {
    super(message);
    this.name = 'AgentError';
    this.code = code;
    this.retryable = retryable;
  }
}

// ============================================================================
// TYPES
// ============================================================================

export interface AgentExecutionResult {
  content: string;
  data?: Record<string, unknown>;
  toolCalls?: Array<{
    name: string;
    args: Record<string, unknown>;
    result?: unknown;
    durationMs: number;
  }>;
  agentTimeMs: number;
  modelUsed?: string;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  agentVersion?: string;
}

/**
 * Create an AgentError from an error code and message
 */
export function createAgentError(code: ErrorCode, message: string): AgentErrorImpl {
  const config = ERROR_CONFIG[code];
  return new AgentErrorImpl(code, message || config.defaultMessage, config.retryable);
}
