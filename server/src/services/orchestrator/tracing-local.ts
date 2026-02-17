/**
 * Local Tracing Utilities
 *
 * Local trace management, cleanup, and statistics
 * for the agent tracing system when Langfuse is not available.
 */

import type { LocalTrace, TracingStats } from './tracing-types.js';
import type { AgentType } from './types.js';

/**
 * Cleanup old traces to prevent memory leaks
 */
export function cleanupOldTraces(
  localTraces: Map<string, LocalTrace>,
  maxTraces: number,
  retentionMs: number,
): void {
  const now = Date.now();
  const tracesToDelete: string[] = [];

  for (const [id, trace] of localTraces.entries()) {
    if (trace.endTime && now - trace.endTime > retentionMs) {
      tracesToDelete.push(id);
    }
  }

  for (const id of tracesToDelete) {
    localTraces.delete(id);
  }

  // If still over limit, remove oldest completed traces
  if (localTraces.size > maxTraces) {
    const completedTraces = Array.from(localTraces.entries())
      .filter(([_, trace]) => trace.endTime !== undefined)
      .sort((a, b) => (a[1].endTime || 0) - (b[1].endTime || 0));

    const toRemove = completedTraces.slice(0, localTraces.size - maxTraces);
    for (const [id] of toRemove) {
      localTraces.delete(id);
    }
  }
}

/**
 * Calculate tracing statistics
 */
export function calculateTracingStats(
  traceCount: number,
  errorCount: number,
  totalDurationMs: number,
  activeTraceCount: number,
  langfuseEnabled: boolean,
  sampleRate: number,
): TracingStats {
  const avgDurationMs = traceCount > 0 ? totalDurationMs / traceCount : 0;

  return {
    totalTraces: traceCount,
    activeTraces: activeTraceCount,
    errorCount,
    errorRate: traceCount > 0 ? errorCount / traceCount : 0,
    avgDurationMs,
    langfuseEnabled,
    sampleRate,
  };
}

/**
 * Create a new local trace object
 */
export function createLocalTrace(
  requestId: string,
  agentType: AgentType,
  query: string,
): LocalTrace {
  return {
    id: requestId,
    agentType,
    query,
    startTime: Date.now(),
    status: 'unset',
    events: [],
    generations: [],
    spans: [],
  };
}
