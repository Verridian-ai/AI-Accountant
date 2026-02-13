# Agent 4: Response Formatter Builder

## Role
Create the ResponseFormatter service that transforms raw agent output into structured, user-friendly chat responses with follow-up suggestions.

## Priority: SUB-WAVE 1 (Start Immediately)

## Files to CREATE

### 1. `server/src/services/claude/response-formatter.ts`
**Purpose**: Format raw agent output into structured chat responses compatible with the enhanced ChatResponse type.

#### Key Interface:
```typescript
export interface ChatResponse {
  answer: string;                    // Human-readable text response (ALWAYS present)
  agentType?: string;                // Which agent handled the query
  intentClassification?: {
    intent: string;
    confidence: number;
  };
  actions?: Array<{                  // Proposed actions for user to confirm/reject (Wave 2)
    id: string;
    type: string;
    description: string;
    data: unknown;
  }>;
  data?: unknown;                    // Structured data payload (tables, charts, etc.)
  suggestedFollowups?: string[];     // Suggested follow-up questions
}
```

#### Implementation:
```typescript
import { AgentType } from './types.js';
import { PipelineResult, AgentDispatchResult } from './agent-dispatcher.js';

export class ResponseFormatter {

  /**
   * Format a single agent dispatch result into a ChatResponse
   */
  formatSingle(
    agentType: AgentType,
    result: AgentDispatchResult,
    intent?: { intent: string; confidence: number }
  ): ChatResponse {
    // 1. Extract answer text from result
    // 2. Format structured data (tables, monetary values)
    // 3. Generate follow-up suggestions based on agent type
    // 4. Return ChatResponse (answer field is ALWAYS populated)
  }

  /**
   * Format a pipeline result (multi-agent) into a ChatResponse
   */
  formatPipeline(
    results: PipelineResult,
    intent?: { intent: string; confidence: number }
  ): ChatResponse {
    // 1. Combine answers from all agents in pipeline
    // 2. Use final agent's result as primary answer
    // 3. Include intermediate results as supplementary data
  }

  /**
   * Format an error into a ChatResponse
   * CRITICAL: Must return { answer: string }, NOT { error: string }
   */
  formatError(error: string | Error): ChatResponse {
    const message = error instanceof Error ? error.message : error;
    return {
      answer: `I encountered an issue processing your request: ${message}. Could you try rephrasing your question?`,
    };
  }

  /**
   * Generate contextual follow-up suggestions based on agent type
   */
  private generateFollowups(agentType: AgentType): string[] {
    const followupMap: Partial<Record<AgentType, string[]>> = {
      gst_calculator: [
        'Show me the BAS breakdown by label',
        'What are my input tax credits this quarter?',
        'Compare this quarter to last quarter',
      ],
      budget_analyzer: [
        'What are my top spending categories?',
        'Show recurring payments',
        'Forecast next month\'s cash flow',
      ],
      transaction_categorizer: [
        'Show uncategorized transactions',
        'What category has the most transactions?',
        'Review GST classifications',
      ],
      tax_strategy: [
        'What deductions am I missing?',
        'Calculate my tax for this year',
        'Show depreciation schedule',
      ],
      financial_reporting: [
        'Generate a balance sheet',
        'Show cash flow statement',
        'Compare to last period',
      ],
      payroll_agent: [
        'Show PAYG withholding summary',
        'What are total wage costs this month?',
        'Check super guarantee obligations',
      ],
      // Add mappings for remaining agents...
    };

    return followupMap[agentType] ?? [
      'Tell me more about this',
      'Show related transactions',
      'Export this data',
    ];
  }

  /**
   * Format monetary values consistently (AUD, 2 decimal places)
   */
  formatCurrency(cents: number): string {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(cents / 100);
  }

  /**
   * Extract a human-readable answer from raw agent output
   */
  private extractAnswer(agentType: AgentType, rawResult: unknown): string {
    if (typeof rawResult === 'string') return rawResult;

    // Try common response patterns
    const result = rawResult as Record<string, unknown>;

    if (result.summary && typeof result.summary === 'string') return result.summary;
    if (result.answer && typeof result.answer === 'string') return result.answer;
    if (result.analysis && typeof result.analysis === 'string') return result.analysis;
    if (result.message && typeof result.message === 'string') return result.message;

    // Fallback: JSON summary
    return `Analysis complete. The ${agentType} agent processed your request successfully.`;
  }
}
```

#### Error Response Rule:
**CRITICAL**: The `/api/chat` endpoint MUST always return `{ answer: string }` — even on errors. The `formatError()` method ensures this. Never return `{ error: string }` from the chat endpoint.

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `formatSingle()` always returns an object with an `answer` string
- [ ] `formatError()` wraps errors into `{ answer: "..." }` format
- [ ] `generateFollowups()` returns relevant suggestions per agent type
- [ ] `formatCurrency()` formats cents to AUD string correctly
- [ ] All interfaces are properly exported (`ChatResponse`, `ResponseFormatter`)
- [ ] Create marker file: `.agent-done-W01-04`

## Dependencies
- **None** — can start immediately
- **Reuses**: `types.ts` (AgentType), `agent-dispatcher.ts` interfaces (can define inline if not yet available)
