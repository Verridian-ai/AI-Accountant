# Agent 4: Asset Agent Builder

## Role
Build the `asset_management` Claude agent with ATO-compliant depreciation tools and asset intelligence.

## Priority: WAVE 2 (After Agent 2 completes)

## Wait Condition
Check for `.agent-done-W12-02` marker file before starting.

## Context
- Agent base class: `server/src/services/claude/base-agent.ts` — all agents extend `ClaudeAgent<TInput, TOutput>`
- Existing agent pattern: `server/src/services/claude/agents/payroll-agent.ts` (line 1-57 for imports/structure)
- Cognee tools: `server/src/services/claude/cognee-tools.ts` — `cogneeTools.search()` for RAG
- Agent types: `server/src/services/claude/types.ts` — AgentType union at line 10-21
- Agent config: `server/src/services/claude/config.ts` — token budgets at line 10-77, models at line 80-92
- Fixed asset service: `server/src/services/fixed-assets.ts` (created by Agent 2)

## Files to CREATE

### 1. `server/src/services/claude/agents/asset-management-agent.ts`
**Pattern**: Follow `server/src/services/claude/agents/payroll-agent.ts` exactly

- [ ] Create `AssetManagementAgent extends ClaudeAgent<AssetManagementInput, AssetManagementOutput>` with:

**System Prompt**:
```
You are an Australian fixed asset management specialist. You help businesses:
1. Register and track depreciating assets per ATO Division 40 ITAA 1997
2. Calculate depreciation using straight-line or diminishing value methods
3. Apply instant asset write-off rules for small business entities (SBE threshold $20,000)
4. Manage the low value pool (assets with WDV < $1,000)
5. Calculate CGT implications on asset disposals
6. Generate ATO-compliant depreciation schedules for tax returns
7. Advise on optimal depreciation methods based on business circumstances

Always cite relevant ATO rulings (TR 2024/3 for effective lives, TD 2024/1 for write-offs).
Use Australian financial year (July 1 - June 30). All amounts in cents.
```

**4 Tools**:

`calculate_depreciation`:
```typescript
{
  name: 'calculate_depreciation',
  description: 'Calculate depreciation for an asset or batch of assets for a financial year',
  input_schema: {
    type: 'object',
    properties: {
      assetId: { type: 'string', description: 'Single asset ID, or omit for batch' },
      userId: { type: 'string' },
      financialYear: { type: 'string', description: 'e.g. 2024-25' },
      entityId: { type: 'string', description: 'Optional entity filter for batch' },
    },
    required: ['userId', 'financialYear'],
  },
}
```
- Handler: If assetId provided, call `fixedAssetService.calculateDepreciation(assetId, financialYear)`. Otherwise call `fixedAssetService.runBatchDepreciation(userId, financialYear, entityId)`.

`suggest_depreciation_method`:
```typescript
{
  name: 'suggest_depreciation_method',
  description: 'Analyze an asset and suggest the optimal depreciation method based on ATO rules and business circumstances',
  input_schema: {
    type: 'object',
    properties: {
      assetCategory: { type: 'string' },
      purchasePrice: { type: 'number', description: 'In cents' },
      entityType: { type: 'string' },
      isSmallBusinessEntity: { type: 'boolean' },
      expectedUsefulLife: { type: 'number', description: 'Years' },
      businessUsePercentage: { type: 'number', description: '0-100' },
    },
    required: ['assetCategory', 'purchasePrice', 'entityType'],
  },
}
```
- Handler: Apply ATO decision tree:
  1. If isSmallBusinessEntity && purchasePrice < $20,000 (2,000,000 cents) → instant write-off
  2. If asset WDV will fall below $1,000 within 2 years → low value pool
  3. If entityType === 'company' → diminishing value (front-loads deductions for companies)
  4. If expectedUsefulLife > 10 years → straight line (more predictable)
  5. Default → diminishing value (ATO preferred for most scenarios)
  - Search Cognee for any custom advice: `cogneeTools.search('depreciation method ' + assetCategory, 'asset_register')`

`check_write_off_eligibility`:
```typescript
{
  name: 'check_write_off_eligibility',
  description: 'Check if an asset qualifies for instant asset write-off under current ATO rules',
  input_schema: {
    type: 'object',
    properties: {
      purchasePrice: { type: 'number', description: 'In cents' },
      purchaseDate: { type: 'string', description: 'ISO date' },
      entityType: { type: 'string' },
      aggregatedTurnover: { type: 'number', description: 'Annual turnover in cents' },
      isNewAsset: { type: 'boolean' },
    },
    required: ['purchasePrice', 'purchaseDate', 'entityType'],
  },
}
```
- Handler: Check ATO thresholds by date range:
  - 2023-07-01 to 2024-06-30: $20,000 threshold for SBEs (turnover < $10M)
  - 2024-07-01 onwards: Check current threshold (may change — use Cognee search for latest)
  - Temporary full expensing ended 30 June 2023
  - Return: `{ eligible, threshold, reason, atoReference }`

`generate_asset_report`:
```typescript
{
  name: 'generate_asset_report',
  description: 'Generate a comprehensive asset register report or depreciation schedule',
  input_schema: {
    type: 'object',
    properties: {
      userId: { type: 'string' },
      reportType: { type: 'string', enum: ['register', 'depreciation_schedule', 'disposal_summary', 'category_breakdown'] },
      financialYear: { type: 'string' },
      entityId: { type: 'string' },
    },
    required: ['userId', 'reportType'],
  },
}
```
- Handler: Call appropriate FixedAssetService methods based on reportType:
  - `register` → `getAssetRegister(userId, { entityId })`
  - `depreciation_schedule` → `getDepreciationSchedule(userId, financialYear, entityId)`
  - `disposal_summary` → query `assetDisposals` for FY with profit/loss summary
  - `category_breakdown` → `getAssetRegister(userId)` then group by category with totals

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
  | 'asset_management'
  | 'multi_entity';
```

- [ ] Add 2 new AgentType entries at line 21 (before the semicolon)
- [ ] Add 4 new I/O interfaces after line 500 (end of file):

```typescript
// Asset Management Agent I/O
export interface AssetManagementInput {
  userId: string;
  entityId?: string;
  financialYear?: string;
  query: string;
  assets?: Array<{
    id: string;
    name: string;
    category: string;
    purchasePrice: number;
    purchaseDate: string;
    method: string;
    currentWDV: number;
  }>;
}

export interface AssetManagementOutput {
  depreciationResults?: Array<{
    assetId: string;
    assetName: string;
    method: string;
    openingValue: number;
    depreciation: number;
    closingValue: number;
  }>;
  methodRecommendation?: {
    recommendedMethod: string;
    reason: string;
    atoReference: string;
    estimatedFirstYearDeduction: number;
  };
  writeOffEligibility?: {
    eligible: boolean;
    threshold: number;
    reason: string;
    atoReference: string;
  };
  report?: Record<string, unknown>;
  summary: string;
}

// Multi-Entity Agent I/O
export interface MultiEntityInput {
  userId: string;
  entityId?: string;
  parentEntityId?: string;
  financialYear?: string;
  query: string;
  transactionContext?: Array<{
    id: string;
    date: string;
    amount: number;
    description: string;
    accountId: string;
  }>;
}

export interface MultiEntityOutput {
  entityContext?: {
    entityId: string;
    entityName: string;
    entityType: string;
    confidence: number;
  };
  interEntityMatches?: Array<{
    fromEntityId: string;
    toEntityId: string;
    amount: number;
    transactionType: string;
    matchConfidence: number;
  }>;
  eliminations?: Array<{
    description: string;
    amount: number;
    ruleApplied: string;
  }>;
  consolidation?: {
    totalRevenue: number;
    totalExpenses: number;
    netProfit: number;
    eliminationsTotal: number;
  };
  summary: string;
}
```

### 3. `server/src/services/claude/config.ts` (lines 59-76 and 80-92)

- [ ] Add 2 entries to `AGENT_TOKEN_BUDGETS` (after `financial_planner` entry at line 76):
```typescript
  asset_management: {
    maxInputTokens: 50_000,
    maxOutputTokens: 8_000,
    maxToolCalls: 12,
    warningThresholdPercent: 80,
  },
  multi_entity: {
    maxInputTokens: 100_000,
    maxOutputTokens: 8_000,
    maxToolCalls: 15,
    warningThresholdPercent: 80,
  },
```

- [ ] Add 2 entries to `AGENT_MODELS` (after `financial_planner` entry at line 91):
```typescript
  asset_management: 'claude-haiku-4-5-20251001',
  multi_entity: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929',
```

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] AssetManagementAgent can be instantiated without errors
- [ ] All 4 tools are registered and have valid schemas
- [ ] Tool handlers correctly delegate to FixedAssetService methods
- [ ] types.ts has `asset_management` and `multi_entity` in AgentType union
- [ ] config.ts has token budgets and models for both new agents
- [ ] Create marker file: `.agent-done-W12-04`

## Dependencies
- **Requires**: Agent 2 (`.agent-done-W12-02`) — needs FixedAssetService
- **IMPORTANT**: Only this agent and Agent 5 may modify types.ts and config.ts in Wave 12
- **Reuses**: base-agent.ts, cognee-tools.ts, fixed-assets.ts
