/**
 * Agent Tracer — Core Implementation
 *
 * Distributed tracing for agent executions using Langfuse (optional).
 * Uses types from tracing-types.ts and helpers from tracing-local.ts.
 */

import { AgentType, TokenUsage } from './types.js';
import type {
  LangfuseClient,
  LangfuseTraceObject,
  TracerConfig,
  LocalTrace,
  TracingStats,
} from './tracing-types.js';
import { cleanupOldTraces, calculateTracingStats, createLocalTrace } from './tracing-local.js';

const DEFAULT_TRACER_CONFIG: TracerConfig = {
  enabled: !!process.env.LANGFUSE_PUBLIC_KEY,
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com',
  sampleRate: 1.0,
  includeToolCalls: true,
  includeTokenUsage: true,
  includeContext: false,
};

export class AgentTracer {
  private config: TracerConfig;
  private langfuse: LangfuseClient | null = null;
  private localTraces: Map<string, LocalTrace> = new Map();
  private activeTraces: Map<string, LangfuseTraceObject | LocalTrace> = new Map();

  private traceCount: number = 0;
  private errorCount: number = 0;
  private totalDurationMs: number = 0;

  private readonly MAX_LOCAL_TRACES = 1000;
  private readonly TRACE_RETENTION_MS = 30 * 60 * 1000;

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
      type LangfuseConstructor = new (config: {
        publicKey: string;
        secretKey: string;
        baseUrl?: string;
      }) => LangfuseClient;
      type LangfuseModule = { Langfuse: LangfuseConstructor };
      const { Langfuse } = await (import('langfuse') as unknown as Promise<LangfuseModule>);
      this.langfuse = new Langfuse({
        publicKey: this.config.publicKey,
        secretKey: this.config.secretKey,
        baseUrl: this.config.baseUrl,
      });
      console.log('Langfuse tracing initialized');
    } catch {
      console.log('Langfuse not available, using local tracing');
      this.langfuse = null;
    }
  }

  startTrace(requestId: string, agentType: AgentType, query: string, userId?: string): string {
    if (Math.random() > this.config.sampleRate) return requestId;

    this.traceCount++;

    if (this.langfuse) {
      const trace = this.langfuse.trace({
        name: `agent-${agentType}`,
        id: requestId,
        userId,
        metadata: { agentType, query: this.config.includeContext ? query : undefined },
        tags: ['agent', agentType],
      });
      this.activeTraces.set(requestId, trace);
    } else {
      const localTrace = createLocalTrace(requestId, agentType, query);
      this.localTraces.set(requestId, localTrace);
      this.activeTraces.set(requestId, localTrace);
    }

    return requestId;
  }

  addEvent(traceId: string, name: string, attributes?: Record<string, unknown>): void {
    const trace = this.activeTraces.get(traceId);
    if (!trace) return;

    if (this.isLangfuseTrace(trace)) {
      trace.event({ name, metadata: attributes });
    } else {
      trace.events.push({ name, timestamp: Date.now(), attributes });
    }
  }

  startSpan(traceId: string, name: string, attributes?: Record<string, unknown>): string {
    const spanId = `${traceId}-${name}-${Date.now()}`;
    const trace = this.activeTraces.get(traceId);
    if (!trace) return spanId;

    if (this.isLangfuseTrace(trace)) {
      trace.span({ name, metadata: attributes });
    } else {
      trace.spans.push({ name, startTime: Date.now(), attributes });
    }

    return spanId;
  }

  endSpan(traceId: string, _spanId: string, _output?: unknown): void {
    const trace = this.activeTraces.get(traceId);
    if (!trace) return;

    if (!this.isLangfuseTrace(trace)) {
      const span = trace.spans.find((s) => !s.endTime);
      if (span) span.endTime = Date.now();
    }
  }

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
        metadata: { durationMs: params.durationMs },
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

  endTrace(traceId: string, status: 'ok' | 'error', output?: unknown): void {
    const trace = this.activeTraces.get(traceId);
    if (!trace) return;

    if (this.isLangfuseTrace(trace)) {
      trace.update({
        metadata: { status, output: this.config.includeContext ? output : undefined },
      });
    } else {
      trace.endTime = Date.now();
      trace.status = status;
      this.totalDurationMs += trace.endTime - trace.startTime;
      if (status === 'error') this.errorCount++;
    }

    this.activeTraces.delete(traceId);

    if (this.traceCount % 100 === 0) {
      cleanupOldTraces(this.localTraces, this.MAX_LOCAL_TRACES, this.TRACE_RETENTION_MS);
    }
  }

  getTrace(traceId: string): LocalTrace | undefined {
    return this.localTraces.get(traceId);
  }

  getStats(): TracingStats {
    return calculateTracingStats(
      this.traceCount,
      this.errorCount,
      this.totalDurationMs,
      this.activeTraces.size,
      !!this.langfuse,
      this.config.sampleRate,
    );
  }

  async flush(): Promise<void> {
    if (this.langfuse) await this.langfuse.shutdownAsync();
  }

  updateConfig(config: Partial<TracerConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.enabled !== undefined || config.publicKey || config.secretKey) {
      this.initializeLangfuse();
    }
  }

  clearLocalTraces(): void {
    this.localTraces.clear();
  }

  private isLangfuseTrace(trace: LangfuseTraceObject | LocalTrace): trace is LangfuseTraceObject {
    return 'generation' in trace && typeof trace.generation === 'function';
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

export const agentTracer = new AgentTracer();

process.on('beforeExit', async () => {
  await agentTracer.flush();
});
