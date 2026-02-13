# Agent 3: Agent Dispatcher Builder

## Role
Create the AgentDispatcher service that executes classified intents by invoking the correct agent(s) through the orchestrator, supporting single-agent and multi-agent pipelines.

## Priority: SUB-WAVE 1 (Start Immediately)

## Files to CREATE

### 1. `server/src/services/claude/agent-dispatcher.ts`
**Purpose**: Execute agent invocations based on IntentClassification results, supporting single-agent dispatch and multi-agent sequential pipelines.

#### Key Interface:
```typescript
export interface AgentDispatchResult {
  success: boolean;
  agentType: AgentType;
  result: unknown;
  usage?: { inputTokens: number; outputTokens: number; toolCalls: number };
  duration: number;  // ms
  error?: string;
}

export interface PipelineResult {
  results: AgentDispatchResult[];
  finalResult: unknown;
  totalDuration: number;
}
```

#### Implementation:
```typescript
import { AgentOrchestrator } from './orchestrator.js';
import { IntentClassification } from './intent-router.js';
import { AgentType } from './types.js';

export class AgentDispatcher {
  private orchestrator: AgentOrchestrator;

  constructor(orchestrator: AgentOrchestrator) {
    this.orchestrator = orchestrator;
  }

  /**
   * Dispatch a single agent invocation
   */
  async dispatchSingle(
    agentType: AgentType,
    input: Record<string, unknown>,
    options?: { timeout?: number; emitProgress?: boolean }
  ): Promise<AgentDispatchResult> {
    // 1. Validate agent type exists in orchestrator registry
    // 2. Start timer
    // 3. Invoke orchestrator.invoke(agentType, input)
    // 4. Catch errors → return { success: false, error }
    // 5. Return result with timing
  }

  /**
   * Dispatch based on IntentClassification (single or multi-agent pipeline)
   */
  async dispatchIntent(
    classification: IntentClassification,
    userQuery: string,
    context?: Record<string, unknown>
  ): Promise<PipelineResult> {
    // 1. Build input from extractedParams + userQuery + context
    // 2. If no secondaryAgents: single dispatch
    // 3. If secondaryAgents: sequential pipeline
    //    - Run primaryAgent first
    //    - Pass primaryAgent result as `previousResult` to each secondary
    //    - Collect all results
    // 4. Return PipelineResult with all agent results + final result
  }

  /**
   * Execute a multi-agent pipeline sequentially
   */
  async executePipeline(
    agents: AgentType[],
    initialInput: Record<string, unknown>
  ): Promise<PipelineResult> {
    const results: AgentDispatchResult[] = [];
    let currentInput = initialInput;
    const startTime = Date.now();

    for (const agentType of agents) {
      const result = await this.dispatchSingle(agentType, currentInput);
      results.push(result);

      if (!result.success) {
        // Pipeline fails on first error
        return { results, finalResult: result.error, totalDuration: Date.now() - startTime };
      }

      // Chain results: pass previous agent's output as input to next
      currentInput = { ...currentInput, previousResult: result.result };
    }

    return {
      results,
      finalResult: results[results.length - 1]?.result,
      totalDuration: Date.now() - startTime,
    };
  }
}
```

#### Error Handling:
- If agent is not registered in orchestrator → return descriptive error
- If agent circuit breaker is tripped → return fallback message
- If timeout exceeded → abort and return timeout error
- Always capture duration for performance monitoring

#### SSE Progress Events:
- Emit `agent:dispatch:start` when beginning dispatch
- Emit `agent:dispatch:progress` with agent type when pipeline moves to next agent
- Emit `agent:dispatch:complete` with final result
- Use existing SSE EventEmitter pattern from `server/src/index.ts` (line ~1059)

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `dispatchSingle()` correctly invokes orchestrator for a single agent
- [ ] `dispatchIntent()` handles single-agent classification (no secondaryAgents)
- [ ] `executePipeline()` chains multiple agents sequentially with result passing
- [ ] Error handling returns `{ success: false, error }` without throwing
- [ ] All interfaces are properly exported
- [ ] Create marker file: `.agent-done-W01-03`

## Dependencies
- **None** — can start immediately (references IntentClassification interface but doesn't import the class)
- **Reuses**: `orchestrator.ts` (AgentOrchestrator singleton), `types.ts` (AgentType)
