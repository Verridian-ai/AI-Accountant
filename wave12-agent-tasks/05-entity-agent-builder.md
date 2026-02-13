# Agent 5: Entity Agent Builder

## Role
Build the `multi_entity` Claude agent with tools for entity context identification, inter-entity transaction detection, elimination calculation, and consolidated reporting.

## Priority: WAVE 2 (After Agent 3 completes)

## Wait Condition
Check for `.agent-done-W12-03` and `.agent-done-W12-04` marker files before starting.

## Context
- Agent base class: `server/src/services/claude/base-agent.ts` — all agents extend `ClaudeAgent<TInput, TOutput>`
- Existing agent pattern: `server/src/services/claude/agents/payroll-agent.ts`
- MultiEntityService: `server/src/services/multi-entity.ts` (created by Agent 3)
- ConsolidationService: `server/src/services/consolidation.ts` (created by Agent 3)
- Agent types already updated by Agent 4: `MultiEntityInput`, `MultiEntityOutput` in types.ts
- Agent config already updated by Agent 4: token budgets and model for `multi_entity`

## Files to CREATE

### 1. `server/src/services/claude/agents/multi-entity-agent.ts`
**Pattern**: Follow `server/src/services/claude/agents/payroll-agent.ts` exactly

- [ ] Create `MultiEntityAgent extends ClaudeAgent<MultiEntityInput, MultiEntityOutput>` with:

**System Prompt**:
```
You are an Australian multi-entity financial management specialist. You help businesses that operate through multiple legal entities (companies, trusts, partnerships, sole traders, SMSFs). Your expertise includes:

1. Identifying which entity a transaction belongs to based on account linkages and transaction patterns
2. Detecting inter-entity transactions (loans, management fees, dividends, distributions, rent, service fees)
3. Calculating consolidation eliminations for group reporting
4. Ensuring compliance with transfer pricing rules and Section 100A (trust) regulations
5. Managing inter-entity loan agreements and Division 7A compliance (company loans to shareholders)
6. Generating consolidated financial reports with proper eliminations

Key Australian rules to apply:
- Division 7A: Company loans to shareholders/associates must be on compliant terms (benchmark interest rate, max 7-year term unsecured, 25-year secured)
- Section 100A: Trust distributions made through reimbursement agreements may be assessed to trustee at top marginal rate
- Transfer pricing: Related party transactions must be at arm's length
- Consolidation: Eliminate inter-entity revenue/expenses, loans, dividends when preparing group reports

Use Australian financial year (July 1 - June 30). All amounts in cents.
```

**4 Tools**:

`identify_entity_context`:
```typescript
{
  name: 'identify_entity_context',
  description: 'Determine which entity a transaction or set of transactions belongs to based on account linkages and transaction patterns',
  input_schema: {
    type: 'object',
    properties: {
      userId: { type: 'string' },
      accountId: { type: 'string', description: 'The bank account the transaction is in' },
      transactionDescription: { type: 'string', description: 'Transaction description to analyze' },
      amount: { type: 'number', description: 'Transaction amount in cents' },
    },
    required: ['userId', 'accountId'],
  },
}
```
- Handler:
  1. Look up `entityAccounts` for the given accountId to find linked entity
  2. If no direct link, search Cognee: `cogneeTools.search('entity for account ' + accountId, 'entity_hierarchy')`
  3. If transaction description contains entity name or known keywords, use that as additional signal
  4. Return entity context with confidence score (1.0 for direct account link, 0.7 for Cognee match, 0.5 for keyword)

`find_inter_entity_transactions`:
```typescript
{
  name: 'find_inter_entity_transactions',
  description: 'Scan transactions to find potential inter-entity transfers, loans, and related-party dealings',
  input_schema: {
    type: 'object',
    properties: {
      userId: { type: 'string' },
      financialYear: { type: 'string', description: 'e.g. 2024-25' },
      entityIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Entity IDs to scan. If omitted, scans all user entities.',
      },
    },
    required: ['userId', 'financialYear'],
  },
}
```
- Handler:
  1. Fetch entity hierarchy for user via `multiEntityService.getEntityHierarchy(userId)`
  2. Get all accounts for each entity
  3. Query transactions where description references another entity's name, ABN, or known accounts
  4. Match outgoing transactions from Entity A's accounts with incoming transactions in Entity B's accounts by amount/date proximity (within 3 business days, exact amount match)
  5. Check for known patterns: "MANAGEMENT FEE", "DIVIDEND", "DISTRIBUTION", "LOAN", "RENT", "SERVICE FEE"
  6. For each match, create a potential inter-entity transaction record via `multiEntityService.recordInterEntityTransaction()`
  7. Search Cognee for historical patterns: `cogneeTools.search('inter-entity ' + entityName, 'consolidation_patterns')`
  8. Return matches with confidence scores

`calculate_eliminations`:
```typescript
{
  name: 'calculate_eliminations',
  description: 'Calculate consolidation eliminations for confirmed inter-entity transactions',
  input_schema: {
    type: 'object',
    properties: {
      userId: { type: 'string' },
      parentEntityId: { type: 'string', description: 'The consolidated parent entity' },
      financialYear: { type: 'string' },
      includeUnconfirmed: { type: 'boolean', description: 'Include pending transactions in elimination calc', default: false },
    },
    required: ['userId', 'parentEntityId', 'financialYear'],
  },
}
```
- Handler:
  1. Fetch confirmed inter-entity transactions for the financial year
  2. If includeUnconfirmed, also include pending transactions (mark as estimated)
  3. Group by transaction type:
     - Management fees: Eliminate revenue in receiving entity + expense in paying entity
     - Loans: Eliminate receivable in lending entity + payable in borrowing entity
     - Dividends: Eliminate dividend income in parent + equity reduction in subsidiary
     - Rent: Eliminate rental income + rental expense
     - Service fees: Same as management fees
  4. Check for Division 7A compliance on loan-type transactions:
     - Flag if no interest charged or below benchmark rate
     - Flag if term exceeds 7 years (unsecured) or 25 years (secured)
  5. Return elimination entries with amounts and rule references

`generate_consolidation`:
```typescript
{
  name: 'generate_consolidation',
  description: 'Generate a full consolidated financial report for a parent entity and all subsidiaries',
  input_schema: {
    type: 'object',
    properties: {
      userId: { type: 'string' },
      parentEntityId: { type: 'string' },
      financialYear: { type: 'string' },
      snapshotNotes: { type: 'string', description: 'Notes to attach to the consolidation snapshot' },
    },
    required: ['userId', 'parentEntityId', 'financialYear'],
  },
}
```
- Handler:
  1. Call `consolidationService.generateConsolidation({ userId, parentEntityId, financialYear })`
  2. Format results with:
     - Per-entity P&L breakdown
     - Elimination summary
     - Consolidated totals (revenue - expenses = net profit, after eliminations)
     - Consolidated balance sheet summary (assets - liabilities = equity)
  3. Search Cognee for historical patterns: `cogneeTools.search('consolidation ' + financialYear, 'consolidation_patterns')`
  4. Return formatted consolidation with snapshot ID for future reference

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] MultiEntityAgent can be instantiated without errors
- [ ] All 4 tools are registered and have valid schemas
- [ ] identify_entity_context returns correct entity for linked account
- [ ] find_inter_entity_transactions detects matching transfers between entity accounts
- [ ] calculate_eliminations correctly nets out inter-entity management fee
- [ ] generate_consolidation creates a snapshot with correct totals
- [ ] Create marker file: `.agent-done-W12-05`

## Dependencies
- **Requires**: Agent 3 (`.agent-done-W12-03`) — needs MultiEntityService and ConsolidationService
- **Requires**: Agent 4 (`.agent-done-W12-04`) — needs types.ts and config.ts updates (MultiEntityInput/Output, token budgets)
- **IMPORTANT**: This agent does NOT modify types.ts or config.ts — Agent 4 already added the entries
- **Reuses**: base-agent.ts, cognee-tools.ts, multi-entity.ts, consolidation.ts
