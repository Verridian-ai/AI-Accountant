# Agent 4: Inventory Agent Builder

## Role
Build a Claude AI agent for intelligent inventory management — stock level analysis, COGS calculations, reorder suggestions, and inventory context search via Cognee.

## Priority: WAVE 11 (After Agent 2)

## Files to CREATE

### 1. `server/src/services/claude/agents/inventory-agent.ts`
**Purpose**: Claude agent that provides AI-powered inventory analysis and recommendations
**Pattern**: Follow `server/src/services/claude/agents/payroll-agent.ts` EXACTLY — extends `ClaudeAgent<InventoryAgentInput, InventoryAgentOutput>`, uses Anthropic SDK tool definitions, wires tool handlers to InventoryService + CogneeTools

- [ ] Import structure:
```typescript
import Anthropic from '@anthropic-ai/sdk';
import { ClaudeAgent } from '../base-agent.js';
import { cogneeTools, COGNEE_DATASETS } from '../cognee-tools.js';
import { inventoryService } from '../../inventory.js';
import type { InventoryAgentInput, InventoryAgentOutput } from '../types.js';
```

- [ ] Create `InventoryAgent extends ClaudeAgent<InventoryAgentInput, InventoryAgentOutput>` with:

#### System Prompt
```
You are an Australian small business inventory management specialist. You help businesses track stock levels, calculate Cost of Goods Sold (COGS) using the weighted average method, identify reorder needs, and optimize inventory turnover. You understand GST implications on inventory purchases and sales. Always provide amounts in AUD cents internally and format as dollars for display.
```

#### Tool Definitions (4 tools)
- [ ] `check_stock_levels` — Parameters: `{ userId: string; warehouseId?: string; belowReorderOnly?: boolean }`. Calls `inventoryService.getStockLevels()`. Returns stock levels with valuation.
- [ ] `calculate_cogs` — Parameters: `{ userId: string; itemId: string; quantitySold: number }`. Calls `inventoryService.calculateCOGS()`. Returns COGS breakdown with unit cost and total.
- [ ] `suggest_reorder` — Parameters: `{ userId: string }`. Calls `inventoryService.getStockLevels(userId, { belowReorderPoint: true })`. Returns items that need reordering with suggested quantities and estimated cost.
- [ ] `search_inventory_context` — Parameters: `{ query: string }`. Calls `cogneeTools.search(query, COGNEE_DATASETS.inventoryCatalog, 'CHUNKS')`. Returns relevant inventory context from knowledge graph.

#### Tool Handlers
- [ ] Wire each tool to the corresponding service method
- [ ] Format results as structured JSON for the agent to interpret
- [ ] Handle errors gracefully — return error messages to the agent, don't throw

#### Output Processing
- [ ] Parse the agent's final response into `InventoryAgentOutput` structure
- [ ] Include stockAlerts, cogsAnalysis, reorderRecommendations, summary

## Files to MODIFY

### 2. `server/src/services/claude/types.ts` (line 10-21)
**BEFORE**:
```typescript
export type AgentType =
  | 'statement_parser'
  | 'transaction_categorizer'
  | 'gst_calculator'
  | 'account_reconciler'
  | 'budget_analyzer'
  | 'cross_account_tracer'
  | 'merchant_intelligence'
  | 'payroll_agent'
  | 'tax_strategy'
  | 'personal_tax_claims'
  | 'financial_planner';
```
**AFTER**:
```typescript
export type AgentType =
  | 'statement_parser'
  | 'transaction_categorizer'
  | 'gst_calculator'
  | 'account_reconciler'
  | 'budget_analyzer'
  | 'cross_account_tracer'
  | 'merchant_intelligence'
  | 'payroll_agent'
  | 'tax_strategy'
  | 'personal_tax_claims'
  | 'financial_planner'
  | 'inventory_agent';
```

- [ ] Add `'inventory_agent'` to the AgentType union (line 21, before the semicolon)

- [ ] Add I/O interfaces after line 500 (after FinancialPlannerOutput):

```typescript
// 3.12 InventoryAgent
export interface InventoryAgentInput {
  userId: string;
  action: 'check_stock' | 'calculate_cogs' | 'suggest_reorder' | 'analyze_turnover' | 'valuation_report';
  itemId?: string;
  warehouseId?: string;
  quantitySold?: number;
  dateRange?: { start: string; end: string };
}

export interface InventoryAgentOutput {
  stockAlerts: Array<{
    itemId: string;
    sku: string;
    itemName: string;
    currentQuantity: number;
    reorderPoint: number;
    suggestedReorderQty: number;
    estimatedCostCents: number;
    urgency: 'critical' | 'warning' | 'info';
  }>;
  cogsAnalysis?: {
    itemId: string;
    quantitySold: number;
    unitCostCents: number;
    totalCogsCents: number;
    marginPercent: number;
  };
  reorderRecommendations: Array<{
    itemId: string;
    sku: string;
    name: string;
    currentStock: number;
    reorderPoint: number;
    suggestedQuantity: number;
    estimatedCostCents: number;
    supplierName?: string;
  }>;
  valuationSummary?: {
    totalInventoryValueCents: number;
    itemCount: number;
    categoryBreakdown: Array<{ category: string; valueCents: number }>;
  };
  summary: string;
}
```

### 3. `server/src/services/claude/config.ts` (lines 59-77 and 80-92)
**BEFORE** (AGENT_TOKEN_BUDGETS, after financial_planner entry at line 76):
```typescript
  financial_planner: {
    maxInputTokens: 50_000,
    maxOutputTokens: 8_000,
    maxToolCalls: 12,
    warningThresholdPercent: 80,
  },
};
```
**AFTER**:
```typescript
  financial_planner: {
    maxInputTokens: 50_000,
    maxOutputTokens: 8_000,
    maxToolCalls: 12,
    warningThresholdPercent: 80,
  },
  inventory_agent: {
    maxInputTokens: 50_000,
    maxOutputTokens: 8_000,
    maxToolCalls: 10,
    warningThresholdPercent: 80,
  },
};
```

**BEFORE** (AGENT_MODELS, after financial_planner entry at line 91):
```typescript
  financial_planner: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929',
};
```
**AFTER**:
```typescript
  financial_planner: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929',
  inventory_agent: 'claude-haiku-4-5-20251001',
};
```

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `InventoryAgent` can be instantiated with `new InventoryAgent()`
- [ ] `AgentType` includes `'inventory_agent'`
- [ ] `AGENT_TOKEN_BUDGETS.inventory_agent` returns correct budget
- [ ] `AGENT_MODELS.inventory_agent` returns `'claude-haiku-4-5-20251001'`
- [ ] Create marker file: `.agent-done-W11-04`

## Dependencies
- **Agent 2** (inventory.ts must exist for imports)
- **Reuses**: base-agent.ts, cognee-tools.ts, types.ts, config.ts
