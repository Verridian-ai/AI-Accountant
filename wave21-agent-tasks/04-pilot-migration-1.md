# Agent 4: Pilot Migration 1 -- Budget Analyzer

## Role
Migrate `budget_analyzer` agent from legacy `ClaudeAgent` to `VercelAgent` with full streaming support. This is the first pilot migration to validate the Vercel AI SDK pattern before batch migration.

## Priority: WAVE 21 (After Agents 2, 3)

## Wait Condition
Check for `.agent-done-W21-02` and `.agent-done-W21-03` marker files before starting.

## Files to CREATE

### 1. `server/src/services/claude/agents/vercel/budget-analyzer.ts`
**Purpose**: Vercel AI SDK version of budget_analyzer
**Pattern**: Extend `VercelAgent<BudgetAnalyzerInput, BudgetAnalyzerOutput>` from `vercel-agent.ts`
**Reference**: Legacy implementation at `server/src/services/claude/agents/budget-analyzer.ts`

- [ ] Create `VercelBudgetAnalyzer extends VercelAgent<BudgetAnalyzerInput, BudgetAnalyzerOutput>`:
  - System prompt: Copy from legacy `budget-analyzer.ts` system prompt
  - Output schema: Zod schema for `BudgetAnalyzerOutput` (categories, recommendations, totals)
  - `getTools()`: Convert existing tools using `adaptLegacyTool()` from `tool-adapter.ts`:
    - `analyze_spending_patterns` -- queries transactions by category/period
    - `generate_budget` -- creates budget from historical data
    - `compare_periods` -- compares spending across months/quarters
    - `project_future` -- trend-based projections
    - `search_financial_context` -- Cognee search for financial insights
  - `buildPrompt(input)`: Format user request with transaction context
- [ ] Add streaming support: Override `stream()` to emit category-by-category updates
- [ ] Add structured output: Use `generateObject()` with Zod schema for typed results

### 2. `server/src/services/claude/agents/vercel/README.md`
**Purpose**: Document the Vercel migration pattern for other agents to follow

- [ ] Document: directory structure, base class usage, tool adaptation, streaming, structured output, fallback strategy

## Files to MODIFY

### 3. `server/src/services/claude/orchestrator.ts`
- [ ] Add import for `VercelBudgetAnalyzer`
- [ ] In the agent dispatch logic, add feature flag check:
  ```typescript
  if (process.env.USE_VERCEL_SDK === 'true' && agentType === 'budget_analyzer') {
    const vercelAgent = new VercelBudgetAnalyzer();
    return vercelAgent.executeWithFallback(input);
  }
  ```
- [ ] Keep legacy path as default -- Vercel is opt-in via env var

### 4. `server/src/services/claude/config.ts`
- [ ] Add `VERCEL_MIGRATION_FLAGS` object after line 117:
  ```typescript
  export const VERCEL_MIGRATION_FLAGS: Partial<Record<AgentType, boolean>> = {
    budget_analyzer: process.env.USE_VERCEL_SDK === 'true',
  };
  ```

### 5. `agent_migration_status` seed data
- [ ] Insert initial migration record:
  ```sql
  INSERT INTO agent_migration_status (agent_type, legacy_class, vercel_class, migration_phase)
  VALUES ('budget_analyzer', 'BudgetAnalyzerAgent', 'VercelBudgetAnalyzer', 'pilot');
  ```

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] With `USE_VERCEL_SDK=false`: Legacy agent runs as before (no regression)
- [ ] With `USE_VERCEL_SDK=true`: Vercel agent executes and returns structured BudgetAnalyzerOutput
- [ ] Streaming endpoint delivers token-by-token SSE events
- [ ] Fallback: If Vercel SDK errors, legacy agent handles the request
- [ ] `agent_migration_status` row updated with invocation count
- [ ] Create marker file: `.agent-done-W21-04`

## Dependencies
- **Requires**: Agent 2 (`.agent-done-W21-02`) for VercelAgent base, Agent 3 (`.agent-done-W21-03`) for streaming
- **Reuses**: Existing budget-analyzer.ts tools and system prompt
