/**
 * Agent Tracing Integration
 *
 * Provides distributed tracing for agent executions using Langfuse.
 * Tracks requests, tool calls, token usage, and performance metrics.
 */

import { AgentType, TraceSpan, TraceEvent, TokenUsage } from './types.js';

// ============================================================================
// LANGFUSE CLIENT (Optional dependency)
// ============================================================================

interface LangfuseClient {
  trace: (params: LangfuseTraceParams) => LangfuseTraceObject;
  shutdownAsync: () => Promise<void>;
}

interface LangfuseTraceParams {
  name: string;
  id?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

interface LangfuseTraceObject {
  id: string;
  generation: (params: LangfuseGenerationParams) => LangfuseGenerationObject;
  span: (params: LangfuseSpanParams) => LangfuseSpanObject;
  event: (params: LangfuseEventParams) => void;
  update: (params: Partial<LangfuseTraceParams>) => void;
}

interface LangfuseGenerationParams {
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

interface LangfuseGenerationObject {
  end: (params?: { output?: unknown }) => void;
}

interface LangfuseSpanParams {
  name: string;
  metadata?: Record<string, unknown>;
}

interface LangfuseSpanObject {
  end: (params?: { output?: unknown }) => void;
}

interface LangfuseEventParams {
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

const DEFAULT_TRACER_CONFIG: TracerConfig = {
  enabled: !!process.env.LANGFUSE_PUBLIC_KEY,
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com',
  sampleRate: 1.0,
  includeToolCalls: true,
  includeTokenUsage: true,
  includeContext: false, // Don't include potentially sensitive context by default
};

// ============================================================================
// IN-MEMORY TRACE STORAGE (Fallback when Langfuse not available)
// ============================================================================

interface LocalTrace {
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

// ============================================================================
// AGENT TRACER
// ============================================================================

export class AgentTracer {
  private config: TracerConfig;
  private langfuse: LangfuseClient | null = null;
  private localTraces: Map<string, LocalTrace> = new Map();
  private activeTraces: Map<string, LangfuseTraceObject | LocalTrace> = new Map();

  // Metrics
  private traceCount: number = 0;
  private errorCount: number = 0;
  private totalDurationMs: number = 0;

  // Memory management
  private readonly MAX_LOCAL_TRACES = 1000;
  private readonly TRACE_RETENTION_MS = 30 * 60 * 1000; // 30 minutes

  constructor(config?: Partial<TracerConfig>) {
    this.config = { ...DEFAULT_TRACER_CONFIG, ...config };
    this.initializeLangfuse();
  }

  private async initializeLangfuse(): Promise<void> {
    if (!this.config.enabled || !this.config.publicKey || !this.config.secretKey) {
      console.log('Langfuse tracing disabled or not configured');
      return;
    }

    try {
      // Dynamic import to make Langfuse optional
      // @ts-expect-error - langfuse is an optional dependency
      const { Langfuse } = await import('langfuse');
      this.langfuse = new Langfuse({
        publicKey: this.config.publicKey,
        secretKey: this.config.secretKey,
        baseUrl: this.config.baseUrl,
      }) as LangfuseClient;
      console.log('Langfuse tracing initialized');
    } catch (error) {
      console.log('Langfuse not available, using local tracing');
      this.langfuse = null;
    }
  }

  /**
   * Start a new trace
   */
  startTrace(requestId: string, agentType: AgentType, query: string, userId?: string): string {
    // Check sample rate
    if (Math.random() > this.config.sampleRate) {
      return requestId;
    }

    this.traceCount++;

    if (this.langfuse) {
      const trace = this.langfuse.trace({
        name: `agent-${agentType}`,
        id: requestId,
        userId,
        metadata: {
          agentType,
          query: this.config.includeContext ? query : undefined,
        },
        tags: ['agent', agentType],
      });
      this.activeTraces.set(requestId, trace);
    } else {
      // Use local trace
      const localTrace: LocalTrace = {
        id: requestId,
        agentType,
        query,
        startTime: Date.now(),
        status: 'unset',
        events: [],
        generations: [],
        spans: [],
      };
      this.localTraces.set(requestId, localTrace);
      this.activeTraces.set(requestId, localTrace);
    }

    return requestId;
  }

  /**
   * Add an event to the current trace
   */
  addEvent(traceId: string, name: string, attributes?: Record<string, unknown>): void {
    const trace = this.activeTraces.get(traceId);
    if (!trace) return;

    if (this.isLangfuseTrace(trace)) {
      trace.event({
        name,
        metadata: attributes,
      });
    } else {
      trace.events.push({
        name,
        timestamp: Date.now(),
        attributes,
      });
    }
  }

  /**
   * Start a span within the trace
   */
  startSpan(traceId: string, name: string, attributes?: Record<string, unknown>): string {
    const spanId = `${traceId}-${name}-${Date.now()}`;
    const trace = this.activeTraces.get(traceId);
    if (!trace) return spanId;

    if (this.isLangfuseTrace(trace)) {
      trace.span({
        name,
        metadata: attributes,
      });
    } else {
      trace.spans.push({
        name,
        startTime: Date.now(),
        attributes,
      });
    }

    return spanId;
  }

  /**
   * End a span
   */
  endSpan(traceId: string, spanId: string, output?: unknown): void {
    const trace = this.activeTraces.get(traceId);
    if (!trace) return;

    if (!this.isLangfuseTrace(trace)) {
      // Find and update local span
      const span = trace.spans.find((s) => !s.endTime);
      if (span) {
        span.endTime = Date.now();
      }
    }
  }

  /**
   * Log a generation (LLM call)
   */
  logGeneration(
    traceId: string,
    name: string,
    params: {
      model?: string;
      input?: unknown;
      output?: unknown;
      tokenUsage?: TokenUsage;
      durationMs?: number;
    },
  ): void {
    const trace = this.activeTraces.get(traceId);
    if (!trace) return;

    if (this.isLangfuseTrace(trace)) {
      const generation = trace.generation({
        name,
        model: params.model,
        input: this.config.includeContext ? params.input : undefined,
        output: params.output,
        usage:
          this.config.includeTokenUsage && params.tokenUsage
            ? {
                promptTokens: params.tokenUsage.promptTokens,
                completionTokens: params.tokenUsage.completionTokens,
                totalTokens: params.tokenUsage.totalTokens,
              }
            : undefined,
        metadata: {
          durationMs: params.durationMs,
        },
      });
      generation.end({ output: params.output });
    } else {
      trace.generations.push({
        name,
        model: params.model,
        tokenUsage: params.tokenUsage,
        durationMs: params.durationMs,
      });
    }
  }

  /**
   * Log a tool call
   */
  logToolCall(
    traceId: string,
    toolName: string,
    params: {
      args?: Record<string, unknown>;
      result?: unknown;
      durationMs: number;
      error?: string;
    },
  ): void {
    if (!this.config.includeToolCalls) return;

    this.addEvent(traceId, `tool:${toolName}`, {
      args: this.config.includeContext ? params.args : undefined,
      result: params.result,
      durationMs: params.durationMs,
      error: params.error,
    });
  }

  /**
   * End a trace
   */
  endTrace(traceId: string, status: 'ok' | 'error', output?: unknown): void {
    const trace = this.activeTraces.get(traceId);
    if (!trace) return;

    if (this.isLangfuseTrace(trace)) {
      trace.update({
        metadata: {
          status,
          output: this.config.includeContext ? output : undefined,
        },
      });
    } else {
      trace.endTime = Date.now();
      trace.status = status;

      // Calculate duration
      const durationMs = trace.endTime - trace.startTime;
      this.totalDurationMs += durationMs;

      if (status === 'error') {
        this.errorCount++;
      }
    }

    this.activeTraces.delete(traceId);

    // Periodically cleanup old traces (every 100 completed traces)
    if (this.traceCount % 100 === 0) {
      this.cleanupOldTraces();
    }
  }

  /**
   * Get trace by ID (local traces only)
   */
  getTrace(traceId: string): LocalTrace | undefined {
    return this.localTraces.get(traceId);
  }

  /**
   * Get tracing statistics
   */
  getStats(): TracingStats {
    const activeCount = this.activeTraces.size;
    const avgDurationMs = this.traceCount > 0 ? this.totalDurationMs / this.traceCount : 0;

    return {
      totalTraces: this.traceCount,
      activeTraces: activeCount,
      errorCount: this.errorCount,
      errorRate: this.traceCount > 0 ? this.errorCount / this.traceCount : 0,
      avgDurationMs,
      langfuseEnabled: !!this.langfuse,
      sampleRate: this.config.sampleRate,
    };
  }

  /**
   * Flush pending traces (for Langfuse)
   */
  async flush(): Promise<void> {
    if (this.langfuse) {
      await this.langfuse.shutdownAsync();
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<TracerConfig>): void {
    this.config = { ...this.config, ...config };

    if (config.enabled !== undefined || config.publicKey || config.secretKey) {
      this.initializeLangfuse();
    }
  }

  /**
   * Clear local traces (for testing/maintenance)
   */
  clearLocalTraces(): void {
    this.localTraces.clear();
  }

  /**
   * Cleanup old traces to prevent memory leaks
   */
  private cleanupOldTraces(): void {
    const now = Date.now();
    const tracesToDelete: string[] = [];

    for (const [id, trace] of this.localTraces.entries()) {
      // Remove traces older than retention period
      if (trace.endTime && now - trace.endTime > this.TRACE_RETENTION_MS) {
        tracesToDelete.push(id);
      }
    }

    for (const id of tracesToDelete) {
      this.localTraces.delete(id);
    }

    // If still over limit, remove oldest completed traces
    if (this.localTraces.size > this.MAX_LOCAL_TRACES) {
      const completedTraces = Array.from(this.localTraces.entries())
        .filter(([_, trace]) => trace.endTime !== undefined)
        .sort((a, b) => (a[1].endTime || 0) - (b[1].endTime || 0));

      const toRemove = completedTraces.slice(0, this.localTraces.size - this.MAX_LOCAL_TRACES);
      for (const [id] of toRemove) {
        this.localTraces.delete(id);
      }
    }
  }

  private isLangfuseTrace(trace: LangfuseTraceObject | LocalTrace): trace is LangfuseTraceObject {
    return 'generation' in trace && typeof trace.generation === 'function';
  }
}

// ============================================================================
// TYPES
// ============================================================================

export interface TracingStats {
  totalTraces: number;
  activeTraces: number;
  errorCount: number;
  errorRate: number;
  avgDurationMs: number;
  langfuseEnabled: boolean;
  sampleRate: number;
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const agentTracer = new AgentTracer();

// Cleanup on process exit
process.on('beforeExit', async () => {
  await agentTracer.flush();
});
