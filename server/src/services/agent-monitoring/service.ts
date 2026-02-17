/**
 * Agent Monitoring Service (Wave 20)
 * Delegates analytics/config to agent-analytics.ts and agent-configurations.ts.
 */

import { db } from '../../schema.js';
import { agentExecutions } from '../../db/admin-schema.js';
import { eq, desc, sql, and, gte, lte } from 'drizzle-orm';
import { events } from '../../events.js';
import type { AgentExecution, AgentConfiguration } from '../../db/admin-schema.js';
import type {
  ExecutionStartParams,
  ExecutionResult,
  AgentStats,
  HistoryFilters,
  RealTimeMetrics,
  CostReport,
  PaginatedResult,
} from './types.js';
import { TOKEN_COSTS } from './constants.js';
import { getAgentStats, getCurrentMetrics, getCostReport } from './agent-analytics.js';
import { getAgentConfigurationList, updateAgentConfig } from './agent-configurations.js';

class AgentMonitoringService {
  private retentionDays = 90;

  private estimateCost(modelUsed: string, inputTokens: number, outputTokens: number): number {
    const costs = TOKEN_COSTS[modelUsed] ?? TOKEN_COSTS.default;
    return (inputTokens / 1000) * costs.input + (outputTokens / 1000) * costs.output;
  }

  async recordExecutionStart(params: ExecutionStartParams): Promise<string> {
    const id = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const now = new Date().toISOString();

    await db
      .insert(agentExecutions)
      .values({
        id,
        agentType: params.agentType,
        agentName: params.agentName,
        status: 'running',
        inputSummary: params.inputSummary ?? null,
        modelUsed: params.modelUsed,
        triggeredBy: params.triggeredBy,
        context: JSON.stringify(params.context ?? {}),
        startedAt: now,
        createdAt: now,
      })
      .run();

    return id;
  }

  async recordExecutionComplete(executionId: string, result: ExecutionResult): Promise<void> {
    const now = new Date().toISOString();

    const existing: AgentExecution | undefined = await db
      .select()
      .from(agentExecutions)
      .where(eq(agentExecutions.id, executionId))
      .get();

    let durationMs = 0;
    let modelUsed = 'default';
    if (existing) {
      modelUsed = existing.modelUsed ?? 'default';
      if (existing.startedAt) {
        durationMs = new Date(now).getTime() - new Date(existing.startedAt).getTime();
      }
    }

    const cost = this.estimateCost(modelUsed, result.inputTokens, result.outputTokens);

    await db
      .update(agentExecutions)
      .set({
        status: result.status,
        outputSummary: result.outputSummary ?? null,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        totalTokens: result.totalTokens,
        estimatedCostUsd: cost,
        toolCallsCount: result.toolCallsCount,
        toolCalls: JSON.stringify(result.toolCalls ?? []),
        errorMessage: result.errorMessage ?? null,
        errorStack: result.errorStack ?? null,
        durationMs,
        completedAt: now,
      })
      .where(eq(agentExecutions.id, executionId))
      .run();

    events.emit('update', {
      type: 'agent:execution:complete',
      executionId,
      agentType: existing?.agentType,
      status: result.status,
      durationMs,
      cost,
      timestamp: now,
    });
  }

  async withMonitoring<T>(params: ExecutionStartParams, fn: () => Promise<T>): Promise<T> {
    const executionId = await this.recordExecutionStart(params);
    const startTime = Date.now();

    try {
      const result = await fn();

      const usage = (result as any)?.usage;
      const inputTokens = usage?.inputTokens ?? 0;
      const outputTokens = usage?.outputTokens ?? 0;
      const toolCalls = usage?.toolCalls ?? 0;

      await this.recordExecutionComplete(executionId, {
        status: 'completed',
        outputSummary:
          typeof result === 'object' && result !== null
            ? JSON.stringify(result).slice(0, 500)
            : String(result).slice(0, 500),
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        toolCallsCount: toolCalls,
      });

      return result;
    } catch (err) {
      const elapsed = Date.now() - startTime;
      const isTimeout = elapsed > 120_000;

      await this.recordExecutionComplete(executionId, {
        status: isTimeout ? 'timeout' : 'failed',
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        toolCallsCount: 0,
        errorMessage: err instanceof Error ? err.message : String(err),
        errorStack: err instanceof Error ? err.stack : undefined,
      });

      throw err;
    }
  }

  async getExecutionHistory(filters: HistoryFilters): Promise<PaginatedResult<AgentExecution>> {
    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;

    const conditions: ReturnType<typeof eq>[] = [];

    if (filters.agentType) {
      conditions.push(eq(agentExecutions.agentType, filters.agentType));
    }
    if (filters.status) {
      conditions.push(eq(agentExecutions.status, filters.status));
    }
    if (filters.triggeredBy) {
      conditions.push(eq(agentExecutions.triggeredBy, filters.triggeredBy));
    }
    if (filters.from) {
      conditions.push(gte(agentExecutions.startedAt, filters.from));
    }
    if (filters.to) {
      conditions.push(lte(agentExecutions.startedAt, filters.to));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const sortCol =
      filters.sortBy === 'duration_ms'
        ? agentExecutions.durationMs
        : filters.sortBy === 'total_tokens'
          ? agentExecutions.totalTokens
          : filters.sortBy === 'estimated_cost_usd'
            ? agentExecutions.estimatedCostUsd
            : agentExecutions.startedAt;

    const sortFn = filters.sortOrder === 'asc' ? sql`${sortCol} asc` : desc(sortCol);

    let query = db.select().from(agentExecutions).orderBy(sortFn).limit(limit).offset(offset);

    if (whereClause) {
      query = query.where(whereClause);
    }

    const data: AgentExecution[] = await query.all();

    let countQuery = db.select({ count: sql<number>`count(*)` }).from(agentExecutions);
    if (whereClause) {
      countQuery = countQuery.where(whereClause);
    }
    const countResult = await countQuery.get();
    const total = (countResult as any)?.count ?? 0;

    let filtered = data;
    if (filters.minDurationMs) {
      filtered = filtered.filter((r) => (r.durationMs ?? 0) >= filters.minDurationMs!);
    }
    if (filters.minCostUsd) {
      filtered = filtered.filter((r) => (r.estimatedCostUsd ?? 0) >= filters.minCostUsd!);
    }

    return { data: filtered, total, limit, offset };
  }

  // --- Delegated: Analytics ---

  async getAgentStats(timeRange?: { from: string; to: string }): Promise<AgentStats> {
    return getAgentStats(timeRange);
  }

  async getCurrentMetrics(): Promise<RealTimeMetrics> {
    return getCurrentMetrics();
  }

  async getCostReport(period: 'daily' | 'weekly' | 'monthly'): Promise<CostReport> {
    return getCostReport(period);
  }

  // --- Cleanup ---

  async cleanupOldExecutions(): Promise<number> {
    const cutoff = new Date(Date.now() - this.retentionDays * 24 * 60 * 60 * 1000).toISOString();

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(agentExecutions)
      .where(lte(agentExecutions.createdAt, cutoff))
      .get();
    const count = (countResult as any)?.count ?? 0;

    if (count > 0) {
      await db.delete(agentExecutions).where(lte(agentExecutions.createdAt, cutoff)).run();
    }

    return count;
  }

  // --- Delegated: Agent Configurations ---

  async getAgentConfigurations(): Promise<AgentConfiguration[]> {
    return getAgentConfigurationList();
  }

  async updateAgentConfiguration(
    agentType: string,
    updates: Partial<
      Pick<
        AgentConfiguration,
        | 'displayName'
        | 'description'
        | 'isEnabled'
        | 'model'
        | 'maxInputTokens'
        | 'maxOutputTokens'
        | 'temperature'
        | 'systemPromptOverride'
        | 'toolsEnabled'
        | 'rateLimitPerMinute'
        | 'rateLimitPerHour'
        | 'circuitBreakerThreshold'
        | 'circuitBreakerRecoveryMs'
        | 'customConfig'
      >
    >,
  ): Promise<AgentConfiguration | null> {
    return updateAgentConfig(agentType, updates);
  }
}

export const agentMonitoring = new AgentMonitoringService();
