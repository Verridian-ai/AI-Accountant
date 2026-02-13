# Agent W16-09: Agent Tool Upgrader

## Role
Update existing Claude agents with DataPoint-aware Cognee tools. Integrate ontology context and feedback submission into agent workflows.

## Priority: WAVE 16 (After W16-06 completes cognee tools extension)

## Wait Condition
Check for `.agent-done-W16-06` marker file before starting.

## Context
- Existing agents at `server/src/services/claude/agents/`: transaction-categorizer.ts, gst-calculator.ts, merchant-intelligence.ts, financial-planner.ts, tax-strategy.ts, personal-tax-claims.ts, cross-account-tracer.ts, budget-analyzer.ts, account-reconciler.ts, statement-parser.ts, payroll-agent.ts
- New Cognee tools: `searchWithDataPoint()`, `searchWithOntology()`, `submitSearchFeedback()`, `exploreGraph()` (from W16-06 cognee-tools.ts)
- Wave 15 agents: forecasting-agent.ts, compliance-monitoring-agent.ts

## Files to MODIFY

### 1. `server/src/services/claude/agents/transaction-categorizer.ts`
- [ ] Add new tool: `search_transaction_patterns`
  - Parameters: `{ query: string, category?: string }`
  - Handler: calls `cogneeTools.searchWithDataPoint(query, 'FinancialTransaction')` to find similar transactions
  - Use case: improving categorization accuracy by finding patterns in previously categorized transactions
- [ ] Add feedback hook: after categorization, if confidence <0.7, call `cogneeTools.submitSearchFeedback()` with the result for future learning

### 2. `server/src/services/claude/agents/merchant-intelligence.ts`
- [ ] Add new tool: `explore_merchant_graph`
  - Parameters: `{ merchantName: string }`
  - Handler: calls `cogneeTools.searchWithDataPoint(merchantName, 'BusinessRelationship')` to find related businesses
  - Use case: enriching merchant profiles with relationship context (parent companies, subsidiaries, industry peers)
- [ ] Add new tool: `get_merchant_ontology_context`
  - Parameters: `{ merchantName: string }`
  - Handler: calls `cogneeTools.searchWithOntology(merchantName, 'relationship')` to find connections
  - Use case: understanding merchant's position in business relationship graph

### 3. `server/src/services/claude/agents/gst-calculator.ts`
- [ ] Add new tool: `search_tax_events`
  - Parameters: `{ query: string, period?: string }`
  - Handler: calls `cogneeTools.searchWithDataPoint(query, 'TaxEvent')` to find relevant tax events
  - Use case: finding precedents for GST classification decisions
- [ ] Update system prompt: add mention of DataPoint-enhanced search capabilities for more accurate GST classification

### 4. `server/src/services/claude/agents/tax-strategy.ts`
- [ ] Add new tool: `explore_tax_ontology`
  - Parameters: `{ query: string }`
  - Handler: calls `cogneeTools.searchWithOntology(query, 'tax')` to find tax relationship context
  - Use case: discovering tax optimization opportunities through graph relationships (e.g., entity structures, related rulings)
- [ ] Add new tool: `search_deduction_precedents`
  - Parameters: `{ deductionType: string, entityType: string }`
  - Handler: calls `cogneeTools.searchWithDataPoint(deductionType + ' ' + entityType, 'TaxEvent')` filtered by context
  - Use case: finding historical deduction patterns for strategy validation

### 5. `server/src/services/claude/agents/financial-planner.ts`
- [ ] Add new tool: `search_financial_patterns`
  - Parameters: `{ query: string, patternType?: string }`
  - Handler: calls `cogneeTools.searchWithDataPoint(query, 'FinancialTransaction')` for spending/income pattern analysis
  - Use case: enriching wealth projections with historical pattern context from knowledge graph

### 6. `server/src/services/claude/agents/cross-account-tracer.ts`
- [ ] Add new tool: `explore_relationship_graph`
  - Parameters: `{ entityName: string }`
  - Handler: calls `cogneeTools.searchWithOntology(entityName, 'relationship')` to find connections between accounts/entities
  - Use case: tracing fund flows through business relationship graph

### 7. `server/src/services/claude/agents/forecasting-agent.ts` (Wave 15)
- [ ] Add new tool: `search_forecast_history`
  - Parameters: `{ query: string }`
  - Handler: calls `cogneeTools.searchWithDataPoint(query, 'RecurringPattern')` for historical patterns
  - Use case: improving forecast accuracy by referencing recurring payment patterns in knowledge graph

### 8. `server/src/services/claude/agents/compliance-monitoring-agent.ts` (Wave 15)
- [ ] Add new tool: `search_compliance_ontology`
  - Parameters: `{ query: string }`
  - Handler: calls `cogneeTools.searchWithOntology(query, 'compliance')` for compliance relationship context
  - Use case: understanding compliance obligation dependencies and related requirements

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] All modified agents still instantiate without errors via orchestrator
- [ ] New tools are registered and appear in agent tool lists
- [ ] `search_transaction_patterns` tool handler calls `searchWithDataPoint` correctly
- [ ] `explore_merchant_graph` tool handler calls `searchWithDataPoint` with 'BusinessRelationship'
- [ ] `search_tax_events` tool handler calls `searchWithDataPoint` with 'TaxEvent'
- [ ] Feedback hooks in transaction-categorizer fire for low-confidence results
- [ ] No breaking changes to existing agent tools or behaviors
- [ ] Create marker file: `.agent-done-W16-09`

## Dependencies
- **Requires**: W16-06 (`.agent-done-W16-06`) -- extended cognee-tools.ts must be available
- **IMPORTANT**: This agent modifies multiple agent files -- no other Wave 16 agent should touch these files
- **Reuses**: All existing agent files, cognee-tools.ts (read-only reference to new methods)
