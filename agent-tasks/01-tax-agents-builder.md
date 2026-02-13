# Agent 1: Tax Agents Builder

## Role
Build 3 new Claude agents + tax return calculation engine + tax optimizer service.

## Priority: WAVE 1 (Start Immediately)

## Files to CREATE

### 1. `server/src/services/tax-return.ts`
**Purpose**: 5 entity-specific tax return calculators
**Pattern**: Pure service class, imports from existing `server/src/services/tax.ts`
**Reference**: `docs/Curretn Claudecode plan.md` lines 161-267

- [ ] Create `TaxReturnService` class with 5 calculator methods:
  - `calculateSoleTraderReturn(userId, financialYear)` — Business P&L, owner equity, SBITO (16% of net small business income, max $1,000), LITO
  - `calculatePersonalReturn(userId, financialYear)` — Employment + business income, WFH/car deductions, HELP
  - `calculateCompanyReturn(userId, financialYear)` — 25% base rate entity (`businessProfiles.entityType` at schema.ts line 325), franking credits
  - `calculateTrustReturn(userId, financialYear)` — Beneficiary distributions, Section 100A warning
  - `calculateSMSFReturn(userId, financialYear)` — 15% concessional, exempt pension
- [ ] Wire imports: `DEDUCTION_RATES`, `calculateIncomeTax()`, `calculateMedicareLevy()`, `calculateLITO()` from `tax.ts` (line 35); `TransferDetector.detectOwnerContributions()` from `transfers/detector.ts` (line 407); Drizzle queries against `transactions` table (schema.ts line 217)

### 2. `server/src/services/tax-optimizer.ts`
**Purpose**: AI-powered tax strategy generation
**Reference**: `docs/Curretn Claudecode plan.md` lines 269-383

- [ ] Create `TaxOptimizerService` class with `generateStrategies(userId, financialYear)` returning `TaxStrategy[]` — 10 built-in strategy templates (prepay deductions, super top-up $27,500 cap, asset write-off <$20k, income splitting, motor vehicle 85c/88c, WFH $0.67/hr, salary sacrifice, CGT discount, negative gearing, HELP minimization). Each strategy: `{ name, description, estimatedSaving, confidence, atoRulingRef, applicableEntities }`. Store in `tax_strategies` table (created by Agent 2).

### 3. `server/src/services/claude/agents/tax-strategy.ts`
**Pattern**: Follow `server/src/services/claude/agents/payroll-agent.ts` exactly

- [ ] Create `TaxStrategyAgent extends ClaudeAgent<TaxStrategyInput, TaxStrategyOutput>` with system prompt (Australian tax expert, ATO compliance, multi-entity), 5 tools (`analyze_entity_structure`, `calculate_tax_scenarios`, `search_tax_rulings`, `generate_strategies`, `search_financial_context`), tool handlers wired to TaxReturnService + TaxOptimizerService + cogneeTools.search()

### 4. `server/src/services/claude/agents/personal-tax-claims.ts`

- [ ] Create `PersonalTaxClaimsAgent extends ClaudeAgent<PersonalTaxClaimsInput, PersonalTaxClaimsOutput>` with system prompt (ATO deduction rules, substantiation), 4 tools (`scan_transactions_for_claims`, `check_substantiation`, `calculate_claim_amount`, `search_ato_rulings`), claim categories (WFH, motor vehicle, tools, uniforms, self-education, travel, phone/internet). Output: `{ transactionId, claimType, claimAmount, claimMethod, substantiationStatus }[]`

### 5. `server/src/services/claude/agents/financial-planner.ts`

- [ ] Create `FinancialPlannerAgent extends ClaudeAgent<FinancialPlannerInput, FinancialPlannerOutput>` with system prompt (Australian financial planning), 5 tools (`analyze_spending_patterns`, `project_wealth`, `compare_debt_strategies`, `generate_budget`, `search_financial_context`), 4 risk profiles (conservative 4%, balanced 6%, growth 8%, aggressive 10%), debt strategies (avalanche vs snowball)

## Files to MODIFY

### 6. `server/src/services/claude/types.ts` (line 10-18)
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
  | 'payroll_agent';
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
  | 'financial_planner';
```

- [ ] Add 3 new AgentType entries at line 18 (before the semicolon)
- [ ] Add 6 new I/O interfaces after line 364: `TaxStrategyInput`, `TaxStrategyOutput`, `PersonalTaxClaimsInput`, `PersonalTaxClaimsOutput`, `FinancialPlannerInput`, `FinancialPlannerOutput`

### 7. `server/src/services/claude/config.ts` (lines 10-71)

- [ ] Add 3 entries to `AGENT_TOKEN_BUDGETS` (after line 58) and 3 entries to `AGENT_MODELS` (after line 70): tax_strategy (100K input, Sonnet 4.5), personal_tax_claims (50K input, Haiku 4.5), financial_planner (50K input, Sonnet 4.5)

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] All 3 new agents can be instantiated without errors
- [ ] TaxReturnService.calculateSoleTraderReturn() returns valid tax calculation
- [ ] Create marker file: `.agent-done-01`

## Dependencies
- **None** — can start immediately
- **Reuses**: tax.ts, transfers/detector.ts, base-agent.ts, cognee-tools.ts
