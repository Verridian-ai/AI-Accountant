/**
 * Agent Monitoring — Analytics, Stats, Cost Reports
 */

import { db } from '../../schema.js';
import { agentExecutions } from '../../db/admin-schema.js';
import { eq, and, gte, lte } from 'drizzle-orm';
import type { AgentExecution } from '../../db/admin-schema.js';
import type { AgentStats, RealTimeMetrics, CostReport } from './types.js';

// --------------------------------------------------------------------------
// Agent statistics
// --------------------------------------------------------------------------

export async function getAgentStats(timeRange?: { from: string; to: string }): Promise<AgentStats> {
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
      lastExecution:
        execs
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
      const hour = r.startedAt.slice(0, 13);
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
// Real-time metrics
// --------------------------------------------------------------------------

export async function getCurrentMetrics(): Promise<RealTimeMetrics> {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const activeRows: AgentExecution[] = await db
    .select()
    .from(agentExecutions)
    .where(eq(agentExecutions.status, 'running'))
    .all();
  const last1h: AgentExecution[] = await db
    .select()
    .from(agentExecutions)
    .where(gte(agentExecutions.startedAt, oneHourAgo))
    .all();
  const last24h: AgentExecution[] = await db
    .select()
    .from(agentExecutions)
    .where(gte(agentExecutions.startedAt, oneDayAgo))
    .all();

  const failuresLast1h = last1h.filter(
    (r) => r.status === 'failed' || r.status === 'timeout',
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

  const agentDurations = new Map<string, number[]>();
  const agentCounts = new Map<string, number>();
  for (const r of last24h) {
    agentCounts.set(r.agentType, (agentCounts.get(r.agentType) ?? 0) + 1);
    if (r.durationMs) {
      const list = agentDurations.get(r.agentType) ?? [];
      list.push(r.durationMs);
      agentDurations.set(r.agentType, list);
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

export async function getCostReport(period: 'daily' | 'weekly' | 'monthly'): Promise<CostReport> {
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

  const costByAgent: Record<string, number> = {};
  for (const r of rows) {
    costByAgent[r.agentType] = (costByAgent[r.agentType] ?? 0) + (r.estimatedCostUsd ?? 0);
  }

  const costByModel: Record<string, number> = {};
  for (const r of rows) {
    const model = r.modelUsed ?? 'unknown';
    costByModel[model] = (costByModel[model] ?? 0) + (r.estimatedCostUsd ?? 0);
  }

  const dayMap = new Map<string, number>();
  for (const r of rows) {
    const day = (r.startedAt ?? r.createdAt).slice(0, 10);
    dayMap.set(day, (dayMap.get(day) ?? 0) + (r.estimatedCostUsd ?? 0));
  }
  const costByDay = Array.from(dayMap.entries())
    .map(([date, cost]) => ({ date, cost }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const dailyAvg = daysBack > 0 ? totalCostUsd / daysBack : 0;
  const projectedMonthlyCost = dailyAvg * 30;

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
