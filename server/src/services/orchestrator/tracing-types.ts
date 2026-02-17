/**
 * Agent Tracing Type Definitions
 *
 * Types and interfaces for distributed tracing integration.
 */

import { AgentType, TokenUsage } from './types.js';

// ============================================================================
// LANGFUSE CLIENT (Optional dependency)
// ============================================================================

export interface LangfuseClient {
  trace: (params: LangfuseTraceParams) => LangfuseTraceObject;
  shutdownAsync: () => Promise<void>;
}

export interface LangfuseTraceParams {
  name: string;
  id?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

export interface LangfuseTraceObject {
  id: string;
  generation: (params: LangfuseGenerationParams) => LangfuseGenerationObject;
  span: (params: LangfuseSpanParams) => LangfuseSpanObject;
  event: (params: LangfuseEventParams) => void;
  update: (params: Partial<LangfuseTraceParams>) => void;
}

export interface LangfuseGenerationParams {
  name: string;
  model?: string;
  input?: unknown;
  output?: unknown;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  metadata?: Record<string, unknown>;
}

export interface LangfuseGenerationObject {
  end: (params?: { output?: unknown }) => void;
}

export interface LangfuseSpanParams {
  name: string;
  metadata?: Record<string, unknown>;
}

export interface LangfuseSpanObject {
  end: (params?: { output?: unknown }) => void;
}

export interface LangfuseEventParams {
  name: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// TRACER CONFIGURATION
// ============================================================================

export interface TracerConfig {
  /** Enable/disable tracing */
  enabled: boolean;
  /** Langfuse public key */
  publicKey?: string;
  /** Langfuse secret key */
  secretKey?: string;
  /** Langfuse base URL */
  baseUrl?: string;
  /** Sample rate (0-1) */
  sampleRate: number;
  /** Include tool call details */
  includeToolCalls: boolean;
  /** Include token usage */
  includeTokenUsage: boolean;
  /** Include context in traces */
  includeContext: boolean;
}

// ============================================================================
// IN-MEMORY TRACE STORAGE (Fallback when Langfuse not available)
// ============================================================================

export interface LocalTrace {
  id: string;
  agentType: AgentType;
  query: string;
  startTime: number;
  endTime?: number;
  status: 'ok' | 'error' | 'unset';
  events: Array<{
    name: string;
    timestamp: number;
    attributes?: Record<string, unknown>;
  }>;
  generations: Array<{
    name: string;
    model?: string;
    tokenUsage?: TokenUsage;
    durationMs?: number;
  }>;
  spans: Array<{
    name: string;
    startTime: number;
    endTime?: number;
    attributes?: Record<string, unknown>;
  }>;
}

export interface TracingStats {
  totalTraces: number;
  activeTraces: number;
  errorCount: number;
  errorRate: number;
  avgDurationMs: number;
  langfuseEnabled: boolean;
  sampleRate: number;
}
