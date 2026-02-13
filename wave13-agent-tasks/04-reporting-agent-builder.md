# Agent 4: Reporting Agent Builder

## Role
Build the `financial_reporting` Claude agent with tools for generating financial statements, analyzing trends, and explaining variances.

## Priority: WAVE 13 (After Agents 1 and 2 complete)

## Wait Condition
Check for `.agent-done-W13-01` and `.agent-done-W13-02` marker files before starting.

## Files to CREATE

### 1. `server/src/services/claude/agents/financial-reporting.ts`
**Purpose**: AI agent that generates and interprets financial reports with natural language explanations
**Pattern**: Follow `server/src/services/claude/agents/tax-strategy.ts` exactly (extends ClaudeAgent)

- [ ] Create `FinancialReportingAgent extends ClaudeAgent<FinancialReportingInput, FinancialReportingOutput>` with:

#### System Prompt
```
You are an expert financial reporting analyst for an Australian small business accounting platform.
You generate professional-grade financial statements (P&L, Balance Sheet, Cash Flow, Trial Balance)
and provide clear, actionable analysis of the results.

Key responsibilities:
- Generate accurate financial reports from transaction data
- Identify significant trends, anomalies, and patterns
- Explain variances between periods in plain English
- Flag potential issues (declining margins, cash flow problems, unusual expenses)
- Provide recommendations based on financial data
- All monetary values are in AUD
- Follow Australian Accounting Standards (AASB) where applicable
```

#### Tools (5 total)

##### `generate_pnl`
- **Description**: Generate Profit & Loss statement for a date range
- **Input schema**: `{ userId: string, periodStart: string, periodEnd: string, accountId?: string }`
- **Handler**: Call `financialReportService.generateProfitAndLoss()`
- **Returns**: Full P&L report with revenue/expense categories and net profit

##### `generate_balance_sheet`
- **Description**: Generate Balance Sheet as at a specific date
- **Input schema**: `{ userId: string, asAtDate: string }`
- **Handler**: Call `financialReportService.generateBalanceSheet()`
- **Returns**: Balance sheet with assets, liabilities, equity sections and balance check

##### `generate_cash_flow`
- **Description**: Generate Cash Flow Statement for a date range
- **Input schema**: `{ userId: string, periodStart: string, periodEnd: string }`
- **Handler**: Call `financialReportService.generateCashFlow()`
- **Returns**: Cash flow report with operating, investing, financing sections

##### `analyze_trends`
- **Description**: Compare two periods and identify significant trends
- **Input schema**: `{ userId: string, currentStart: string, currentEnd: string, priorStart: string, priorEnd: string, reportType: string }`
- **Handler**: Call `financialReportService.comparePeriods()`
- **Returns**: Period comparison with variances and significant changes highlighted

##### `explain_variance`
- **Description**: Provide natural language explanation for a specific variance
- **Input schema**: `{ category: string, currentAmount: number, priorAmount: number, variancePercent: number }`
- **Handler**: Format variance data and return as context for the LLM to explain
- **Returns**: Structured variance data for AI interpretation (the agent's LLM generates the narrative)

#### Tool Handler Wiring
```typescript
import { FinancialReportService } from '../../financial-reports.js';

const reportService = new FinancialReportService();

// In tool handler switch:
case 'generate_pnl':
  return await reportService.generateProfitAndLoss(input.userId, input.periodStart, input.periodEnd, input.accountId);
case 'generate_balance_sheet':
  return await reportService.generateBalanceSheet(input.userId, input.asAtDate);
// ... etc
```

## Files to MODIFY

### 2. `server/src/services/claude/types.ts` (line 10-21)
**BEFORE**:
```typescript
export type AgentType =
  | 'statement_parser'
  // ... existing entries
  | 'financial_planner';
```
**AFTER**:
```typescript
export type AgentType =
  | 'statement_parser'
  // ... existing entries
  | 'financial_planner'
  | 'financial_reporting'
  | 'budgeting';
```

- [ ] Add 2 new AgentType entries: `'financial_reporting'` and `'budgeting'` (before the semicolon)
- [ ] Add 4 new I/O interfaces after existing ones:
```typescript
export interface FinancialReportingInput {
  userId: string;
  reportType: 'profit_and_loss' | 'balance_sheet' | 'cash_flow' | 'trial_balance' | 'comparison';
  periodStart?: string;
  periodEnd?: string;
  asAtDate?: string;
  accountId?: string;
  comparisonPeriodStart?: string;
  comparisonPeriodEnd?: string;
}

export interface FinancialReportingOutput {
  report: any;
  analysis: string;
  warnings: string[];
  recommendations: string[];
}

export interface BudgetingInput {
  userId: string;
  action: 'create_budget' | 'calculate_variance' | 'generate_forecast' | 'suggest_adjustments';
  budgetId?: string;
  periodStart?: string;
  periodEnd?: string;
  scenarioType?: string;
}

export interface BudgetingOutput {
  result: any;
  insights: string[];
  suggestions: string[];
}
```

### 3. `server/src/services/claude/config.ts` (lines 59-76 for token budgets, lines 80-92 for models)
- [ ] Add `financial_reporting` entry to `AGENT_TOKEN_BUDGETS`:
  ```typescript
  financial_reporting: {
    maxInputTokens: 100_000,
    maxOutputTokens: 8_000,
    maxToolCalls: 15,
    warningThresholdPercent: 80,
  },
  ```
- [ ] Add `budgeting` entry to `AGENT_TOKEN_BUDGETS`:
  ```typescript
  budgeting: {
    maxInputTokens: 50_000,
    maxOutputTokens: 8_000,
    maxToolCalls: 12,
    warningThresholdPercent: 80,
  },
  ```
- [ ] Add 2 entries to `AGENT_MODELS`:
  ```typescript
  financial_reporting: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929',
  budgeting: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929',
  ```

### 4. `server/src/services/claude/orchestrator.ts` (lines 12-22)
- [ ] Add import: `import { FinancialReportingAgent } from './agents/financial-reporting.js';`
- [ ] Add import for types: `FinancialReportingInput`, `FinancialReportingOutput`
- [ ] Register agent in the agent registry (follow existing pattern for other agents)

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `FinancialReportingAgent` can be instantiated
- [ ] All 5 tools are registered and have valid input schemas
- [ ] Agent type 'financial_reporting' appears in types.ts, config.ts, and orchestrator.ts
- [ ] Create marker file: `.agent-done-W13-04`

## Dependencies
- **Requires**: Agent 1 (`.agent-done-W13-01`), Agent 2 (`.agent-done-W13-02`)
- **Reuses**: base-agent.ts, financial-reports.ts, types.ts, config.ts, orchestrator.ts
- **IMPORTANT**: Coordinate with Agent 5 on types.ts and config.ts modifications (both add entries to same files)
