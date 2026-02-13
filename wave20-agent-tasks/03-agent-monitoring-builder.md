# Agent 3: Agent Monitoring Builder

## Role
Build an agent monitoring service that tracks all Claude agent executions, measures token usage and estimated costs, records success/failure rates, and provides execution analytics for the admin dashboard.

## Priority: WAVE 20 (After Agent 1)

## Wait Condition
Check for `.agent-done-W20-01` marker file before starting.

## Files to CREATE

### 1. `server/src/services/agent-monitoring.ts`
**Purpose**: Track agent executions, token usage, costs, and performance metrics
**Pattern**: Service class with database operations

- [ ] Create `AgentMonitoringService` class:
  ```typescript
  interface AgentMonitoringConfig {
    costPerInputToken: Record<string, number>;    // model -> cost per 1K input tokens
    costPerOutputToken: Record<string, number>;   // model -> cost per 1K output tokens
    retentionDays: number;                        // default: 90
  }
  ```

- [ ] **Cost Estimation Constants** (USD per 1K tokens):
  ```typescript
  const TOKEN_COSTS = {
    'claude-sonnet-4-5-20250514': { input: 0.003, output: 0.015 },
    'claude-haiku-4-5-20250514': { input: 0.001, output: 0.005 },
    'claude-opus-4-6': { input: 0.015, output: 0.075 },
    'google/gemini-3-flash-preview': { input: 0.0001, output: 0.0004 },
    'default': { input: 0.003, output: 0.015 }
  };
  ```

- [ ] **Record Execution Start**: `async recordExecutionStart(params: ExecutionStartParams): Promise<string>`
  ```typescript
  interface ExecutionStartParams {
    agentType: string;
    agentName: string;
    inputSummary?: string;
    modelUsed: string;
    triggeredBy: 'system' | 'user' | 'scheduler' | 'pipeline' | 'chat';
    context?: Record<string, any>;
  }
  ```
  - Insert record into `agent_executions` with status 'running'
  - Return execution ID

- [ ] **Record Execution Complete**: `async recordExecutionComplete(executionId: string, result: ExecutionResult): Promise<void>`
  ```typescript
  interface ExecutionResult {
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
  ```
  - Update `agent_executions` record with completion data
  - Calculate `estimated_cost_usd` from token counts and model
  - Set `duration_ms` = completedAt - startedAt
  - Set `completed_at` timestamp
  - Emit SSE event: `agent:execution:complete`

- [ ] **Execution Wrapper**: `async withMonitoring<T>(params: ExecutionStartParams, fn: () => Promise<T>): Promise<T>`
  - Convenience wrapper that auto-records start/complete/failure:
    ```typescript
    const executionId = await this.recordExecutionStart(params);
    try {
      const result = await fn();
      await this.recordExecutionComplete(executionId, { status: 'completed', ... });
      return result;
    } catch (err) {
      await this.recordExecutionComplete(executionId, { status: 'failed', errorMessage: String(err) });
      throw err;
    }
    ```

- [ ] **Agent Statistics**: `async getAgentStats(timeRange?: { from: string; to: string }): Promise<AgentStats>`
  ```typescript
  interface AgentStats {
    totalExecutions: number;
    successCount: number;
    failureCount: number;
    successRate: number;              // percentage
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
  ```
  - Aggregate from `agent_executions` table
  - Group by agent type, model, hour
  - Default time range: last 24 hours

- [ ] **Execution History**: `async getExecutionHistory(filters: HistoryFilters): Promise<PaginatedResult<AgentExecution>>`
  ```typescript
  interface HistoryFilters {
    agentType?: string;
    status?: string;
    triggeredBy?: string;
    from?: string;
    to?: string;
    minDurationMs?: number;
    minCostUsd?: number;
    limit?: number;                   // default: 50
    offset?: number;                  // default: 0
    sortBy?: 'started_at' | 'duration_ms' | 'total_tokens' | 'estimated_cost_usd';
    sortOrder?: 'asc' | 'desc';
  }
  ```

- [ ] **Real-time Metrics**: `async getCurrentMetrics(): Promise<RealTimeMetrics>`
  ```typescript
  interface RealTimeMetrics {
    activeExecutions: number;
    executionsLast1h: number;
    executionsLast24h: number;
    failuresLast1h: number;
    tokensLast24h: number;
    costLast24h: number;
    avgResponseTimeMs: number;
    slowestAgentType: string;
    busiestAgentType: string;
    circuitBreakerStatus: Record<string, 'closed' | 'open' | 'half-open'>;
  }
  ```
  - Query recent executions for real-time dashboard
  - Include circuit breaker status from AI service

- [ ] **Cost Tracking**: `async getCostReport(period: 'daily' | 'weekly' | 'monthly'): Promise<CostReport>`
  ```typescript
  interface CostReport {
    period: string;
    totalCostUsd: number;
    costByAgent: Record<string, number>;
    costByModel: Record<string, number>;
    costByDay: Array<{ date: string; cost: number }>;
    projectedMonthlyCost: number;
    topExpensiveExecutions: Array<{ id: string; agentType: string; cost: number; tokens: number }>;
  }
  ```
  - Aggregate costs by period
  - Project monthly cost from recent daily average
  - Identify top expensive executions

- [ ] **Cleanup**: `async cleanupOldExecutions(): Promise<number>`
  - Delete executions older than `retentionDays`
  - Return count of deleted records
  - Designed to run via scheduler

- [ ] **Agent Configuration**: `async getAgentConfigurations(): Promise<AgentConfiguration[]>`
  - Return all agent configurations from `agent_configurations` table
  - If empty, seed from `AGENT_TOKEN_BUDGETS` and `AGENT_MODELS` in config.ts

  `async updateAgentConfiguration(agentType: string, updates: Partial<AgentConfiguration>): Promise<AgentConfiguration>`
  - Update agent config (model, token limits, temperature, enabled status)
  - Validate changes before persisting

## Files to MODIFY

### 2. `server/src/services/claude/orchestrator.ts`
- [ ] Import `AgentMonitoringService`
- [ ] Wrap all agent executions with `agentMonitoring.withMonitoring()`:
  ```typescript
  // Before:
  const result = await agent.execute(input);

  // After:
  const result = await agentMonitoring.withMonitoring(
    { agentType: agent.type, agentName: agent.name, modelUsed: agent.model, triggeredBy: 'system' },
    () => agent.execute(input)
  );
  ```
- [ ] Ensure token counts from Anthropic API responses are captured

### 3. `server/src/services/claude/config.ts`
- [ ] Add function to export agent configs for seeding `agent_configurations` table:
  ```typescript
  export function getDefaultAgentConfigs(): AgentConfiguration[] { ... }
  ```

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `recordExecutionStart()` creates record in `agent_executions` table
- [ ] `recordExecutionComplete()` updates record with tokens, cost, duration
- [ ] `withMonitoring()` wrapper correctly records both success and failure
- [ ] `getAgentStats()` returns correct aggregated statistics
- [ ] `getCostReport()` calculates costs correctly for each model
- [ ] Estimated cost matches expected values (e.g., 1000 Sonnet input tokens = $0.003)
- [ ] Execution history filters work (by agent type, status, time range)
- [ ] Cleanup removes records older than retention period
- [ ] Create marker file: `.agent-done-W20-03`

## Dependencies
- **Requires**: Agent 1 (`.agent-done-W20-01`) for admin schema/tables
- **Reuses**: Agent orchestrator, Claude config constants, SSE event patterns
