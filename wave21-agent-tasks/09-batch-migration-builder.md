# Agent 9: Batch Migration Builder

## Role
Migrate Phase 2 agents to VercelAgent: `financial_planner`, `tax_strategy`, and `merchant_intelligence`. Apply the validated pattern from pilot migrations (Agents 4-5).

## Priority: WAVE 21 (After Agents 4, 5)

## Wait Condition
Check for `.agent-done-W21-04` and `.agent-done-W21-05` marker files before starting.

## Files to CREATE

### 1. `server/src/services/claude/agents/vercel/financial-planner.ts`
**Purpose**: Vercel AI SDK version of financial_planner
**Pattern**: Extend `VercelAgent<FinancialPlannerInput, FinancialPlannerOutput>` from `vercel-agent.ts`
**Reference**: Legacy at `server/src/services/claude/agents/financial-planner.ts`

- [ ] Create `VercelFinancialPlanner extends VercelAgent<FinancialPlannerInput, FinancialPlannerOutput>`:
  - System prompt: Copy from legacy financial-planner.ts
  - Output schema: Import `FinancialPlannerOutputSchema` from `schemas/planner-output.ts`
  - `getTools()`: Convert 5 tools via `adaptLegacyTool()`:
    - `analyze_spending_patterns`, `project_wealth`, `compare_debt_strategies`, `generate_budget`, `search_financial_context`
  - `buildPrompt(input)`: Format with user's financial data context
- [ ] Enable streaming: wealth projections streamed as they calculate
- [ ] Use `generateObject()` for structured projections output

### 2. `server/src/services/claude/agents/vercel/tax-strategy.ts`
**Purpose**: Vercel AI SDK version of tax_strategy
**Pattern**: Extend `VercelAgent<TaxStrategyInput, TaxStrategyOutput>`
**Reference**: Legacy at `server/src/services/claude/agents/tax-strategy.ts`

- [ ] Create `VercelTaxStrategy extends VercelAgent<TaxStrategyInput, TaxStrategyOutput>`:
  - System prompt: Copy from legacy tax-strategy.ts (Australian tax expert, ATO compliance)
  - Output schema: Import `TaxStrategyOutputSchema` from `schemas/tax-strategy-output.ts`
  - `getTools()`: Convert 5 tools:
    - `analyze_entity_structure`, `calculate_tax_scenarios`, `search_tax_rulings`, `generate_strategies`, `search_financial_context`
  - `buildPrompt(input)`: Format entity type, income, deductions for strategy analysis
- [ ] Enable streaming: strategy-by-strategy delivery
- [ ] Use `generateObject()` for structured strategy list output

### 3. `server/src/services/claude/agents/vercel/merchant-intelligence.ts`
**Purpose**: Vercel AI SDK version of merchant_intelligence
**Pattern**: Extend `VercelAgent<MerchantInput, MerchantIntelligenceOutput>`
**Reference**: Legacy at `server/src/services/claude/agents/merchant-intelligence.ts`

- [ ] Create `VercelMerchantIntelligence extends VercelAgent<MerchantInput, MerchantIntelligenceOutput>`:
  - System prompt: Copy from legacy merchant-intelligence.ts
  - Output schema: Import `MerchantIntelligenceOutputSchema` from `schemas/merchant-output.ts`
  - `getTools()`: Convert tools:
    - `lookup_abn`, `search_business_register`, `search_google_places`, `classify_merchant`, `search_cognee_merchants`
  - `buildPrompt(input)`: Format merchant description, amount, existing category
- [ ] Use `generateObject()` for structured merchant data output
- [ ] Enable Cognee learning loop: store validated merchant data back to Cognee

## Files to MODIFY

### 4. `server/src/services/claude/orchestrator.ts`
- [ ] Add imports for all 3 new Vercel agents
- [ ] Add dispatch cases for `financial_planner`, `tax_strategy`, `merchant_intelligence` with feature flag checks
- [ ] Pattern: Same as Agents 4-5 (check `VERCEL_MIGRATION_FLAGS`, fallback to legacy)

### 5. `server/src/services/claude/config.ts`
- [ ] Add to `VERCEL_MIGRATION_FLAGS`:
  ```typescript
  financial_planner: process.env.USE_VERCEL_SDK === 'true',
  tax_strategy: process.env.USE_VERCEL_SDK === 'true',
  merchant_intelligence: process.env.USE_VERCEL_SDK === 'true',
  ```

### 6. `server/src/services/streaming-registry.ts`
- [ ] Register all 3 new Vercel agents in the streaming registry

### 7. Seed data for `agent_migration_status`
- [ ] Insert 3 migration records:
  ```sql
  INSERT INTO agent_migration_status (agent_type, legacy_class, vercel_class, migration_phase) VALUES
  ('financial_planner', 'FinancialPlannerAgent', 'VercelFinancialPlanner', 'parallel'),
  ('tax_strategy', 'TaxStrategyAgent', 'VercelTaxStrategy', 'parallel'),
  ('merchant_intelligence', 'MerchantIntelligenceAgent', 'VercelMerchantIntelligence', 'parallel');
  ```

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] All 3 Vercel agents execute successfully with `USE_VERCEL_SDK=true`
- [ ] All 3 legacy agents still work with `USE_VERCEL_SDK=false`
- [ ] Structured output validates against Zod schemas for all 3 agents
- [ ] Streaming works for financial_planner and tax_strategy
- [ ] Migration status table shows 5 total agents tracked (2 pilot + 3 batch)
- [ ] Create marker file: `.agent-done-W21-09`

## Dependencies
- **Requires**: Agent 4 (`.agent-done-W21-04`) and Agent 5 (`.agent-done-W21-05`) to validate pattern
- **Reuses**: VercelAgent base class, tool-adapter, schema registry, streaming service
