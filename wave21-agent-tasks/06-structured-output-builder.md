# Agent 6: Structured Output Builder

## Role
Create Zod schemas for every agent output type and build a schema registry service. These schemas power Vercel AI SDK's `generateObject()` for type-safe, validated agent responses.

## Priority: WAVE 21 (Start Immediately)

## Files to CREATE

### 1. `server/src/services/claude/schemas/index.ts`
**Purpose**: Schema registry barrel export

- [ ] Export all schemas from this directory
- [ ] Export `SchemaRegistry` class

### 2. `server/src/services/claude/schemas/categorizer-output.ts`
**Purpose**: Zod schema for transaction_categorizer output
**Reference**: `CategorizerOutput` interface in `server/src/services/claude/types.ts`

```typescript
import { z } from 'zod';

export const CategorizerOutputSchema = z.object({
  transactionId: z.string(),
  category: z.string(),
  subCategory: z.string().optional(),
  confidence: z.number().min(0).max(1),
  gstCategory: z.enum(['GST-Free', 'GST', 'Input-Taxed', 'BAS-Excluded']).optional(),
  reasoning: z.string().optional(),
});

export const BatchCategorizerOutputSchema = z.object({
  results: z.array(CategorizerOutputSchema),
  totalProcessed: z.number(),
  averageConfidence: z.number(),
});
```

- [ ] Define schema matching existing `CategorizerOutput` type exactly

### 3. `server/src/services/claude/schemas/budget-output.ts`
**Purpose**: Zod schema for budget_analyzer output

- [ ] Define `BudgetAnalyzerOutputSchema` with: categories (array of {name, budgeted, actual, variance}), recommendations (string[]), totalIncome, totalExpenses, netPosition, period

### 4. `server/src/services/claude/schemas/gst-output.ts`
**Purpose**: Zod schema for gst_calculator output

- [ ] Define `GSTCalculatorOutputSchema` with: gstAmount, gstCategory, gstMethod, basReportingPeriod, explanation

### 5. `server/src/services/claude/schemas/tax-strategy-output.ts`
**Purpose**: Zod schema for tax_strategy agent output

- [ ] Define `TaxStrategyOutputSchema` with: strategies (array of {name, description, estimatedSaving, confidence, atoRulingRef, applicableEntities}), totalPotentialSaving, riskLevel

### 6. `server/src/services/claude/schemas/merchant-output.ts`
**Purpose**: Zod schema for merchant_intelligence agent output

- [ ] Define `MerchantIntelligenceOutputSchema` with: merchantName, abn, category, gstRegistered, businessType, confidence, enrichmentSource

### 7. `server/src/services/claude/schemas/reconciler-output.ts`
**Purpose**: Zod schema for account_reconciler agent output

- [ ] Define `ReconcilerOutputSchema` with: matchedPairs (array of {debitTxId, creditTxId, amount, confidence}), unmatchedTransactions, balanceDiscrepancy, reconciliationStatus

### 8. `server/src/services/claude/schemas/parser-output.ts`
**Purpose**: Zod schema for statement_parser agent output

- [ ] Define `ParserOutputSchema` with: transactions (array of {date, description, amount, balance, type}), accountInfo ({bsb, accountNumber, accountName}), statementPeriod, bankId

### 9. `server/src/services/claude/schemas/planner-output.ts`
**Purpose**: Zod schema for financial_planner agent output

- [ ] Define `FinancialPlannerOutputSchema` with: projections, budgetPlan, debtStrategies, riskProfile, recommendations

### 10. `server/src/services/claude/schemas/schema-registry.ts`
**Purpose**: Runtime schema registry service

- [ ] Create `SchemaRegistry` class with methods:
  - `registerSchema(agentType: AgentType, schema: z.ZodSchema, name: string): void` -- stores in memory map + persists to `structured_output_schemas` table
  - `getSchema(agentType: AgentType): z.ZodSchema | null` -- retrieves from memory map
  - `validateOutput(agentType: AgentType, output: unknown): { valid: boolean; errors?: z.ZodError }` -- validates output against registered schema
  - `listSchemas(): Array<{ agentType: AgentType; name: string; version: number }>` -- returns all registered schemas
  - `updateStats(agentType: AgentType, passed: boolean): void` -- updates validation_stats in DB
  - `initializeDefaults(): void` -- registers all built-in schemas on startup

## Files to MODIFY

None -- this agent only creates new files.

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] All 8 Zod schemas can parse valid sample data without errors
- [ ] All 8 Zod schemas reject invalid data with descriptive errors
- [ ] `SchemaRegistry.initializeDefaults()` registers all schemas
- [ ] `SchemaRegistry.validateOutput()` returns correct pass/fail for each agent type
- [ ] Create marker file: `.agent-done-W21-06`

## Dependencies
- **None** -- can start immediately (schemas are standalone)
- **Reuses**: Type definitions from `server/src/services/claude/types.ts`
