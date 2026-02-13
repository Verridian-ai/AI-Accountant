# Agent 7: Orchestrator Updater

## Role
Update the AgentOrchestrator to replace the stub `analyze()` method with proper intent-routed dispatch using the new IntentRouter.

## Priority: SUB-WAVE 2 (After Agent 2)

## Files to MODIFY

### 1. `server/src/services/claude/orchestrator.ts`

#### Change 1: Import IntentRouter
**Add import near top of file**:
```typescript
import { IntentRouter, IntentClassification } from './intent-router.js';
```

#### Change 2: Add IntentRouter instance
**In the constructor or initialization section, add**:
```typescript
private intentRouter: IntentRouter;

// In constructor or init method:
this.intentRouter = new IntentRouter();
```

#### Change 3: Replace `analyze()` stub
**BEFORE** (current stub — routes everything to budget_analyzer):
```typescript
async analyze(query: string, context?: Record<string, unknown>): Promise<unknown> {
  return this.invoke('budget_analyzer', { query, ...context });
}
```

**AFTER** (intent-routed dispatch):
```typescript
/**
 * Classify user query and route to the appropriate agent(s).
 * Replaces the previous hardcoded budget_analyzer routing.
 */
async routeAndDispatch(
  query: string,
  context?: Record<string, unknown>
): Promise<{
  classification: IntentClassification;
  result: unknown;
  agentType: AgentType;
}> {
  // Step 1: Classify intent
  const classification = await this.intentRouter.classify(query, {
    recentTransactions: context?.recentTransactions as number | undefined,
    accountIds: context?.accountIds as string[] | undefined,
    hasUnprocessedStatements: context?.hasUnprocessedStatements as boolean | undefined,
  });

  // Step 2: Execute primary agent
  let result: unknown;
  try {
    result = await this.invoke(classification.primaryAgent, {
      query,
      ...classification.extractedParams,
      ...context,
    });
  } catch (error) {
    console.error(`[Orchestrator] Primary agent ${classification.primaryAgent} failed:`, error);
    // Fallback to budget_analyzer for general analysis
    result = await this.invoke('budget_analyzer', { query, ...context });
    return {
      classification: { ...classification, primaryAgent: 'budget_analyzer' as AgentType },
      result,
      agentType: 'budget_analyzer' as AgentType,
    };
  }

  // Step 3: Execute secondary agents if multi-agent
  if (classification.secondaryAgents.length > 0) {
    for (const secondaryAgent of classification.secondaryAgents) {
      try {
        const secondaryResult = await this.invoke(secondaryAgent, {
          query,
          previousResult: result,
          ...classification.extractedParams,
          ...context,
        });
        result = secondaryResult;
      } catch (error) {
        console.warn(`[Orchestrator] Secondary agent ${secondaryAgent} failed, continuing:`, error);
        // Secondary agents failing is non-fatal — continue with primary result
      }
    }
  }

  return {
    classification,
    result,
    agentType: classification.primaryAgent,
  };
}

/**
 * @deprecated Use routeAndDispatch() instead. Kept for backward compatibility.
 */
async analyze(query: string, context?: Record<string, unknown>): Promise<unknown> {
  const { result } = await this.routeAndDispatch(query, context);
  return result;
}
```

#### Change 4: Add `getAgentStatus()` method
**Add a new method for the `/api/agents/status` endpoint**:
```typescript
/**
 * Get health/status for all registered agents
 */
getAgentStatus(): Array<{
  agentType: AgentType;
  isRegistered: boolean;
  isEnabled: boolean;
}> {
  const allTypes = Array.from(this.agents.keys());
  return allTypes.map(agentType => ({
    agentType,
    isRegistered: true,
    isEnabled: true, // Check feature flags if applicable
  }));
}
```

#### Key Requirements:
- [ ] Keep the old `analyze()` method as a deprecated wrapper around `routeAndDispatch()`
- [ ] `routeAndDispatch()` returns the classification alongside the result (for UI display)
- [ ] Primary agent failure falls back to `budget_analyzer`
- [ ] Secondary agent failures are logged but don't break the pipeline
- [ ] The `getAgentStatus()` method returns info for ALL registered agents
- [ ] Do NOT change the `invoke()` method — it works correctly
- [ ] Do NOT change the `processStatement()` method — it's the PDF parsing pipeline
- [ ] Do NOT change `registerAgents()` — all 21 agents are already registered

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `routeAndDispatch("How much did I spend on fuel?")` routes to `budget_analyzer`
- [ ] `routeAndDispatch("Calculate BAS for Q2")` routes to `gst_calculator`
- [ ] `analyze()` still works (deprecated but functional)
- [ ] `getAgentStatus()` returns all registered agents
- [ ] Primary agent failure falls back gracefully
- [ ] Secondary agent failure doesn't break pipeline
- [ ] Create marker file: `.agent-done-W01-07`

## Dependencies
- **Requires**: Agent 2 (IntentRouter must be created)
- **Reuses**: Existing orchestrator patterns, `invoke()` method
