# Agent 5: Bank Reconciliation Agent Builder

## Role
Build a Claude AI agent for intelligent bank reconciliation — finding matches between bank transactions and ledger entries, scoring match confidence, applying and learning matching rules, and searching reconciliation patterns via Cognee.

## Priority: WAVE 11 (After Agent 3)

## Files to CREATE

### 1. `server/src/services/claude/agents/bank-reconciler-agent.ts`
**Purpose**: Claude agent that provides AI-powered reconciliation analysis and match suggestions
**Pattern**: Follow `server/src/services/claude/agents/payroll-agent.ts` EXACTLY — extends `ClaudeAgent<BankReconAgentInput, BankReconAgentOutput>`, uses Anthropic SDK tool definitions, wires tool handlers to BankReconciliationService + CogneeTools

- [ ] Import structure:
```typescript
import Anthropic from '@anthropic-ai/sdk';
import { ClaudeAgent } from '../base-agent.js';
import { cogneeTools, COGNEE_DATASETS } from '../cognee-tools.js';
import { bankReconciliationService } from '../../bank-reconciliation.js';
import type { BankReconAgentInput, BankReconAgentOutput } from '../types.js';
```

- [ ] Create `BankReconcilerAgent extends ClaudeAgent<BankReconAgentInput, BankReconAgentOutput>` with:

#### System Prompt
```
You are an Australian bank reconciliation specialist. You help businesses match bank statement transactions against their internal accounting ledger entries. You understand Australian banking conventions (BSB/account numbers, BPAY references, direct debit patterns, EFT descriptions). You score match confidence using amount proximity, date proximity, and description similarity. When uncertain, you flag transactions for manual review rather than making incorrect matches. All amounts are in AUD cents internally.
```

#### Tool Definitions (4 tools)
- [ ] `find_matches` — Parameters: `{ sessionId: string; userId: string; bankTransactionId?: string }`. If bankTransactionId is provided, calls `bankReconciliationService.suggestMatches()` for that specific transaction. Otherwise calls `bankReconciliationService.autoMatch()` for the whole session. Returns match candidates with confidence scores.
- [ ] `score_match_confidence` — Parameters: `{ bankAmount: number; bankDate: string; bankDescription: string; ledgerAmount: number; ledgerDate: string; ledgerReference: string }`. Computes and returns individual scoring components (amount_score, date_score, description_score, combined_score) so the agent can reason about match quality.
- [ ] `apply_matching_rules` — Parameters: `{ sessionId: string; userId: string; matchId: string; action: 'confirm' | 'reject' | 'undo' }`. Calls the appropriate method on bankReconciliationService (confirmMatch, rejectMatch, undoMatch). Returns updated match status.
- [ ] `search_recon_patterns` — Parameters: `{ query: string }`. Calls `cogneeTools.search(query, COGNEE_DATASETS.reconPatterns, 'GRAPH_COMPLETION')`. Returns relevant reconciliation patterns from knowledge graph (e.g., historical matching rules, common discrepancy patterns).

#### Tool Handlers
- [ ] Wire each tool to the corresponding service method
- [ ] For `score_match_confidence`, call the private scoring methods on BankReconciliationService or reimplement scoring logic locally
- [ ] Format results as structured JSON for the agent to interpret
- [ ] Handle errors gracefully — return error messages to the agent, don't throw

#### Output Processing
- [ ] Parse the agent's final response into `BankReconAgentOutput` structure
- [ ] Include matchResults, unmatchedItems, discrepancies, suggestedRules, summary

## Files to MODIFY

### 2. `server/src/services/claude/types.ts` (line 10-22, after inventory_agent)
**BEFORE**:
```typescript
  | 'inventory_agent';
```
**AFTER**:
```typescript
  | 'inventory_agent'
  | 'bank_reconciler_agent';
```

- [ ] Add `'bank_reconciler_agent'` to the AgentType union

- [ ] Add I/O interfaces after InventoryAgentOutput:

```typescript
// 3.13 BankReconcilerAgent
export interface BankReconAgentInput {
  userId: string;
  sessionId: string;
  action: 'auto_match' | 'suggest_matches' | 'analyze_discrepancies' | 'review_unmatched';
  bankTransactionId?: string;
  context?: {
    accountId: string;
    periodStart: string;
    periodEnd: string;
    statementBalanceCents?: number;
  };
}

export interface BankReconAgentOutput {
  matchResults: Array<{
    bankTransactionId: string;
    ledgerEntryId: string | null;
    matchType: 'auto' | 'suggested' | 'manual' | 'unmatched';
    confidence: number;
    matchReasons: string[];
    status: 'confirmed' | 'pending' | 'rejected';
  }>;
  unmatchedItems: Array<{
    transactionId: string;
    date: string;
    description: string;
    amountCents: number;
    side: 'bank' | 'ledger';
    possibleReasons: string[];
  }>;
  discrepancies: Array<{
    type: 'timing' | 'amount' | 'missing' | 'duplicate';
    description: string;
    amountCents: number;
    suggestedResolution: string;
  }>;
  suggestedRules: Array<{
    name: string;
    matchType: string;
    matchConfig: Record<string, unknown>;
    reasoning: string;
  }>;
  reconciliationStatus: {
    totalBankTransactions: number;
    totalLedgerEntries: number;
    matched: number;
    unmatched: number;
    differenceCents: number;
  };
  summary: string;
}
```

### 3. `server/src/services/claude/config.ts`
**BEFORE** (AGENT_TOKEN_BUDGETS, after inventory_agent entry):
```typescript
  inventory_agent: {
    maxInputTokens: 50_000,
    maxOutputTokens: 8_000,
    maxToolCalls: 10,
    warningThresholdPercent: 80,
  },
};
```
**AFTER**:
```typescript
  inventory_agent: {
    maxInputTokens: 50_000,
    maxOutputTokens: 8_000,
    maxToolCalls: 10,
    warningThresholdPercent: 80,
  },
  bank_reconciler_agent: {
    maxInputTokens: 80_000,
    maxOutputTokens: 8_000,
    maxToolCalls: 15,
    warningThresholdPercent: 80,
  },
};
```

**BEFORE** (AGENT_MODELS, after inventory_agent entry):
```typescript
  inventory_agent: 'claude-haiku-4-5-20251001',
};
```
**AFTER**:
```typescript
  inventory_agent: 'claude-haiku-4-5-20251001',
  bank_reconciler_agent: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929',
};
```

Note: Bank reconciliation uses Sonnet (not Haiku) because matching accuracy is critical and the reasoning requirements are higher.

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `BankReconcilerAgent` can be instantiated with `new BankReconcilerAgent()`
- [ ] `AgentType` includes `'bank_reconciler_agent'`
- [ ] `AGENT_TOKEN_BUDGETS.bank_reconciler_agent` returns correct budget (80K input)
- [ ] `AGENT_MODELS.bank_reconciler_agent` returns Sonnet model
- [ ] Create marker file: `.agent-done-W11-05`

## Dependencies
- **Agent 3** (bank-reconciliation.ts must exist for imports)
- **Agent 4** (types.ts must already have inventory_agent added — coordinate ordering)
- **Reuses**: base-agent.ts, cognee-tools.ts, types.ts, config.ts
