/**
 * Agent Monitoring — Type Definitions
 */

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
