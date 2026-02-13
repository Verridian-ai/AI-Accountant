/**
 * Agent Monitoring Service (Wave 20)
 *
 * Tracks Claude agent executions, token usage, estimated costs,
 * success/failure rates, and provides analytics for the admin dashboard.
 */

import { db } from '../schema.js';
import { agentExecutions, agentConfigurations } from '../db/admin-schema.js';
import { eq, desc, sql, and, gte, lte } from 'drizzle-orm';
import { events } from '../events.js';
import { AGENT_MODELS, AGENT_TOKEN_BUDGETS } from './claude/config.js';
import type { AgentType } from './claude/types.js';
import type { AgentExecution, AgentConfiguration } from '../db/admin-schema.js';

// ============================================================================
// TOKEN COST CONSTANTS (USD per 1K tokens)
// ============================================================================

const TOKEN_COSTS: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-5-20250514': { input: 0.003, output: 0.015 },
  'claude-sonnet-4-5-20250929': { input: 0.003, output: 0.015 },
  'claude-haiku-4-5-20250514': { input: 0.001, output: 0.005 },
  'claude-haiku-4-5-20251001': { input: 0.001, output: 0.005 },
  'claude-opus-4-6': { input: 0.015, output: 0.075 },
  'google/gemini-3-flash-preview': { input: 0.0001, output: 0.0004 },
  default: { input: 0.003, output: 0.015 },
};

// ============================================================================
// INTERFACES
// ============================================================================

export interface ExecutionStartParams {
  agentType: string;
  agentName: string;
  inputSummary?: string;
  modelUsed: string;
  triggeredBy: 'system' | 'user' | 'scheduler' | 'pipeline' | 'chat';
  context?: Record<string, unknown>;
}

export interface ExecutionResult {
  status: 'completed' | 'failed' | 'timeout' | 'cancelled';
  outputSummary?: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  toolCallsCount: number;
  toolCalls?: Array<{ name: string; durationMs: number; success: boolean }>;
  errorMessage?: string;
  errorStack?: string;
}

export interface AgentStats {
  totalExecutions: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  totalTokensUsed: number;
  totalCostUsd: number;
  averageDurationMs: number;
  agentBreakdown: Array<{
    agentType: string;
    agentName: string;
    executionCount: number;
    successRate: number;
    avgDurationMs: number;
    totalTokens: number;
    totalCostUsd: number;
    lastExecution: string;
  }>;
  modelBreakdown: Array<{
    model: string;
    executionCount: number;
    totalTokens: number;
    totalCostUsd: number;
  }>;
  hourlyActivity: Array<{
    hour: string;
    count: number;
  }>;
}

export interface HistoryFilters {
  agentType?: string;
  status?: string;
  triggeredBy?: string;
  from?: string;
  to?: string;
  minDurationMs?: number;
  minCostUsd?: number;
  limit?: number;
  offset?: number;
  sortBy?: 'started_at' | 'duration_ms' | 'total_tokens' | 'estimated_cost_usd';
  sortOrder?: 'asc' | 'desc';
}

export interface RealTimeMetrics {
  activeExecutions: number;
  executionsLast1h: number;
  executionsLast24h: number;
  failuresLast1h: number;
  tokensLast24h: number;
  costLast24h: number;
  avgResponseTimeMs: number;
  slowestAgentType: string;
  busiestAgentType: string;
}

export interface CostReport {
  period: string;
  totalCostUsd: number;
  costByAgent: Record<string, number>;
  costByModel: Record<string, number>;
  costByDay: Array<{ date: string; cost: number }>;
  projectedMonthlyCost: number;
  topExpensiveExecutions: Array<{
    id: string;
    agentType: string;
    cost: number;
    tokens: number;
  }>;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

// ============================================================================
// SERVICE
// ============================================================================

class AgentMonitoringService {
  private retentionDays = 90;

  // --------------------------------------------------------------------------
  // Cost calculation
  // --------------------------------------------------------------------------

  private estimateCost(
    modelUsed: string,
    inputTokens: number,
    outputTokens: number
  ): number {
    const costs = TOKEN_COSTS[modelUsed] ?? TOKEN_COSTS.default;
    return (inputTokens / 1000) * costs.input + (outputTokens / 1000) * costs.output;
  }

  // --------------------------------------------------------------------------
  // Record execution start
  // --------------------------------------------------------------------------

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

  // --------------------------------------------------------------------------
  // Record execution complete
  // --------------------------------------------------------------------------

  async recordExecutionComplete(
    executionId: string,
    result: ExecutionResult
  ): Promise<void> {
    const now = new Date().toISOString();

    // Fetch start record to compute duration
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

  // --------------------------------------------------------------------------
  // Monitoring wrapper
  // --------------------------------------------------------------------------

  async withMonitoring<T>(
    params: ExecutionStartParams,
    fn: () => Promise<T>
  ): Promise<T> {
    const executionId = await this.recordExecutionStart(params);
    const startTime = Date.now();

    try {
      const result = await fn();

      // Extract token usage if the result carries it
      const usage = (result as any)?.usage;
      const inputTokens = usage?.inputTokens ?? 0;
      const outputTokens = usage?.outputTokens ?? 0;
      const toolCalls = usage?.toolCalls ?? 0;

      await this.recordExecutionComplete(executionId, {
        status: 'completed',
        outputSummary: typeof result === 'object' && result !== null
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

  // --------------------------------------------------------------------------
  // Agent statistics
  // --------------------------------------------------------------------------

  async getAgentStats(timeRange?: { from: string; to: string }): Promise<AgentStats> {
    const from = timeRange?.from ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const to = timeRange?.to ?? new Date().toISOString();

    const rows: AgentExecution[] = await db
      .select()
      .from(agentExecutions)
      .where(and(gte(agentExecutions.startedAt, from), lte(agentExecutions.startedAt, to)))
      .all();

    const totalExecutions = rows.length;
    const successCount = rows.filter((r) => r.status === 'completed').length;
    const failureCount = rows.filter((r) => r.status === 'failed' || r.status === 'timeout').length;
    const successRate = totalExecutions > 0 ? (successCount / totalExecutions) * 100 : 0;
    const totalTokensUsed = rows.reduce((sum, r) => sum + (r.totalTokens ?? 0), 0);
    const totalCostUsd = rows.reduce((sum, r) => sum + (r.estimatedCostUsd ?? 0), 0);
    const durations = rows.map((r) => r.durationMs ?? 0).filter((d) => d > 0);
    const averageDurationMs =
      durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

    // Agent breakdown
    const agentMap = new Map<string, AgentExecution[]>();
    for (const r of rows) {
      const list = agentMap.get(r.agentType) ?? [];
      list.push(r);
      agentMap.set(r.agentType, list);
    }

    const agentBreakdown = Array.from(agentMap.entries()).map(([agentType, execs]) => {
      const successes = execs.filter((e) => e.status === 'completed').length;
      const agentDurations = execs.map((e) => e.durationMs ?? 0).filter((d) => d > 0);
      return {
        agentType,
        agentName: execs[0]?.agentName ?? agentType,
        executionCount: execs.length,
        successRate: execs.length > 0 ? (successes / execs.length) * 100 : 0,
        avgDurationMs:
          agentDurations.length > 0
            ? agentDurations.reduce((a, b) => a + b, 0) / agentDurations.length
            : 0,
        totalTokens: execs.reduce((s, e) => s + (e.totalTokens ?? 0), 0),
        totalCostUsd: execs.reduce((s, e) => s + (e.estimatedCostUsd ?? 0), 0),
        lastExecution: execs
          .map((e) => e.startedAt ?? '')
          .sort()
          .pop() ?? '',
      };
    });

    // Model breakdown
    const modelMap = new Map<string, AgentExecution[]>();
    for (const r of rows) {
      const model = r.modelUsed ?? 'unknown';
      const list = modelMap.get(model) ?? [];
      list.push(r);
      modelMap.set(model, list);
    }

    const modelBreakdown = Array.from(modelMap.entries()).map(([model, execs]) => ({
      model,
      executionCount: execs.length,
      totalTokens: execs.reduce((s, e) => s + (e.totalTokens ?? 0), 0),
      totalCostUsd: execs.reduce((s, e) => s + (e.estimatedCostUsd ?? 0), 0),
    }));

    // Hourly activity
    const hourMap = new Map<string, number>();
    for (const r of rows) {
      if (r.startedAt) {
        const hour = r.startedAt.slice(0, 13); // "2026-02-12T15"
        hourMap.set(hour, (hourMap.get(hour) ?? 0) + 1);
      }
    }
    const hourlyActivity = Array.from(hourMap.entries())
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour.localeCompare(b.hour));

    return {
      totalExecutions,
      successCount,
      failureCount,
      successRate,
      totalTokensUsed,
      totalCostUsd,
      averageDurationMs,
      agentBreakdown,
      modelBreakdown,
      hourlyActivity,
    };
  }

  // --------------------------------------------------------------------------
  // Execution history
  // --------------------------------------------------------------------------

  async getExecutionHistory(
    filters: HistoryFilters
  ): Promise<PaginatedResult<AgentExecution>> {
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

    // Sort mapping
    const sortCol =
      filters.sortBy === 'duration_ms'
        ? agentExecutions.durationMs
        : filters.sortBy === 'total_tokens'
          ? agentExecutions.totalTokens
          : filters.sortBy === 'estimated_cost_usd'
            ? agentExecutions.estimatedCostUsd
            : agentExecutions.startedAt;

    const sortFn = filters.sortOrder === 'asc' ? sql`${sortCol} asc` : desc(sortCol);

    let query = db
      .select()
      .from(agentExecutions)
      .orderBy(sortFn)
      .limit(limit)
      .offset(offset);

    if (whereClause) {
      query = query.where(whereClause);
    }

    const data: AgentExecution[] = await query.all();

    // Count total
    let countQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(agentExecutions);
    if (whereClause) {
      countQuery = countQuery.where(whereClause);
    }
    const countResult = await countQuery.get();
    const total = (countResult as any)?.count ?? 0;

    // Post-filter for numeric thresholds (simpler than SQL for PG/SQLite compat)
    let filtered = data;
    if (filters.minDurationMs) {
      filtered = filtered.filter((r) => (r.durationMs ?? 0) >= filters.minDurationMs!);
    }
    if (filters.minCostUsd) {
      filtered = filtered.filter((r) => (r.estimatedCostUsd ?? 0) >= filters.minCostUsd!);
    }

    return { data: filtered, total, limit, offset };
  }

  // --------------------------------------------------------------------------
  // Real-time metrics
  // --------------------------------------------------------------------------

  async getCurrentMetrics(): Promise<RealTimeMetrics> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    // Active (running) executions
    const activeRows: AgentExecution[] = await db
      .select()
      .from(agentExecutions)
      .where(eq(agentExecutions.status, 'running'))
      .all();

    // Last 1 hour
    const last1h: AgentExecution[] = await db
      .select()
      .from(agentExecutions)
      .where(gte(agentExecutions.startedAt, oneHourAgo))
      .all();

    // Last 24 hours
    const last24h: AgentExecution[] = await db
      .select()
      .from(agentExecutions)
      .where(gte(agentExecutions.startedAt, oneDayAgo))
      .all();

    const failuresLast1h = last1h.filter(
      (r) => r.status === 'failed' || r.status === 'timeout'
    ).length;

    const tokensLast24h = last24h.reduce((s, r) => s + (r.totalTokens ?? 0), 0);
    const costLast24h = last24h.reduce((s, r) => s + (r.estimatedCostUsd ?? 0), 0);

    const completedDurations = last24h
      .filter((r) => r.status === 'completed' && r.durationMs)
      .map((r) => r.durationMs!);
    const avgResponseTimeMs =
      completedDurations.length > 0
        ? completedDurations.reduce((a, b) => a + b, 0) / completedDurations.length
        : 0;

    // Slowest and busiest agents
    const agentDurations = new Map<string, number[]>();
    const agentCounts = new Map<string, number>();
    for (const r of last24h) {
      const at = r.agentType;
      agentCounts.set(at, (agentCounts.get(at) ?? 0) + 1);
      if (r.durationMs) {
        const list = agentDurations.get(at) ?? [];
        list.push(r.durationMs);
        agentDurations.set(at, list);
      }
    }

    let slowestAgentType = 'none';
    let maxAvgDuration = 0;
    for (const [at, durs] of agentDurations) {
      const avg = durs.reduce((a, b) => a + b, 0) / durs.length;
      if (avg > maxAvgDuration) {
        maxAvgDuration = avg;
        slowestAgentType = at;
      }
    }

    let busiestAgentType = 'none';
    let maxCount = 0;
    for (const [at, count] of agentCounts) {
      if (count > maxCount) {
        maxCount = count;
        busiestAgentType = at;
      }
    }

    return {
      activeExecutions: activeRows.length,
      executionsLast1h: last1h.length,
      executionsLast24h: last24h.length,
      failuresLast1h,
      tokensLast24h,
      costLast24h,
      avgResponseTimeMs,
      slowestAgentType,
      busiestAgentType,
    };
  }

  // --------------------------------------------------------------------------
  // Cost report
  // --------------------------------------------------------------------------

  async getCostReport(period: 'daily' | 'weekly' | 'monthly'): Promise<CostReport> {
    const now = new Date();
    let daysBack: number;
    switch (period) {
      case 'daily':
        daysBack = 1;
        break;
      case 'weekly':
        daysBack = 7;
        break;
      case 'monthly':
        daysBack = 30;
        break;
    }

    const fromDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000).toISOString();

    const rows: AgentExecution[] = await db
      .select()
      .from(agentExecutions)
      .where(gte(agentExecutions.startedAt, fromDate))
      .all();

    const totalCostUsd = rows.reduce((s, r) => s + (r.estimatedCostUsd ?? 0), 0);

    // Cost by agent
    const costByAgent: Record<string, number> = {};
    for (const r of rows) {
      costByAgent[r.agentType] = (costByAgent[r.agentType] ?? 0) + (r.estimatedCostUsd ?? 0);
    }

    // Cost by model
    const costByModel: Record<string, number> = {};
    for (const r of rows) {
      const model = r.modelUsed ?? 'unknown';
      costByModel[model] = (costByModel[model] ?? 0) + (r.estimatedCostUsd ?? 0);
    }

    // Cost by day
    const dayMap = new Map<string, number>();
    for (const r of rows) {
      const day = (r.startedAt ?? r.createdAt).slice(0, 10);
      dayMap.set(day, (dayMap.get(day) ?? 0) + (r.estimatedCostUsd ?? 0));
    }
    const costByDay = Array.from(dayMap.entries())
      .map(([date, cost]) => ({ date, cost }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Projected monthly cost
    const dailyAvg = daysBack > 0 ? totalCostUsd / daysBack : 0;
    const projectedMonthlyCost = dailyAvg * 30;

    // Top expensive executions
    const topExpensiveExecutions = rows
      .filter((r) => r.estimatedCostUsd > 0)
      .sort((a, b) => (b.estimatedCostUsd ?? 0) - (a.estimatedCostUsd ?? 0))
      .slice(0, 10)
      .map((r) => ({
        id: r.id,
        agentType: r.agentType,
        cost: r.estimatedCostUsd ?? 0,
        tokens: r.totalTokens ?? 0,
      }));

    return {
      period,
      totalCostUsd,
      costByAgent,
      costByModel,
      costByDay,
      projectedMonthlyCost,
      topExpensiveExecutions,
    };
  }

  // --------------------------------------------------------------------------
  // Cleanup
  // --------------------------------------------------------------------------

  async cleanupOldExecutions(): Promise<number> {
    const cutoff = new Date(
      Date.now() - this.retentionDays * 24 * 60 * 60 * 1000
    ).toISOString();

    // Count first
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(agentExecutions)
      .where(lte(agentExecutions.createdAt, cutoff))
      .get();
    const count = (countResult as any)?.count ?? 0;

    if (count > 0) {
      await db
        .delete(agentExecutions)
        .where(lte(agentExecutions.createdAt, cutoff))
        .run();
    }

    return count;
  }

  // --------------------------------------------------------------------------
  // Agent configurations
  // --------------------------------------------------------------------------

  async getAgentConfigurations(): Promise<AgentConfiguration[]> {
    const configs: AgentConfiguration[] = await db
      .select()
      .from(agentConfigurations)
      .all();

    if (configs.length === 0) {
      await this.seedAgentConfigurations();
      return db.select().from(agentConfigurations).all();
    }

    return configs;
  }

  async updateAgentConfiguration(
    agentType: string,
    updates: Partial<Pick<AgentConfiguration,
      'displayName' | 'description' | 'isEnabled' | 'model' |
      'maxInputTokens' | 'maxOutputTokens' | 'temperature' |
      'systemPromptOverride' | 'toolsEnabled' | 'rateLimitPerMinute' |
      'rateLimitPerHour' | 'circuitBreakerThreshold' | 'circuitBreakerRecoveryMs' |
      'customConfig'
    >>
  ): Promise<AgentConfiguration | null> {
    await db
      .update(agentConfigurations)
      .set({ ...updates, updatedAt: new Date().toISOString() })
      .where(eq(agentConfigurations.agentType, agentType))
      .run();

    const updated: AgentConfiguration | undefined = await db
      .select()
      .from(agentConfigurations)
      .where(eq(agentConfigurations.agentType, agentType))
      .get();

    return updated ?? null;
  }

  private async seedAgentConfigurations(): Promise<void> {
    const agentTypes = Object.keys(AGENT_MODELS) as AgentType[];
    const now = new Date().toISOString();

    for (const agentType of agentTypes) {
      const model = AGENT_MODELS[agentType];
      const budget = AGENT_TOKEN_BUDGETS[agentType];

      await db
        .insert(agentConfigurations)
        .values({
          id: `config_${agentType}`,
          agentType,
          displayName: agentType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          description: `Configuration for ${agentType} agent`,
          isEnabled: true,
          model,
          maxInputTokens: budget.maxInputTokens,
          maxOutputTokens: budget.maxOutputTokens,
          temperature: 0.1,
          toolsEnabled: '[]',
          rateLimitPerMinute: 10,
          rateLimitPerHour: 100,
          circuitBreakerThreshold: 5,
          circuitBreakerRecoveryMs: 60000,
          customConfig: '{}',
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }
  }
}

export const agentMonitoring = new AgentMonitoringService();
