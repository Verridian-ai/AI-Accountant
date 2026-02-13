# Agent 5: Matching Agent Builder

## Role
Build the `payment_matching` Claude agent with tools for finding match candidates, scoring matches, applying matching rules, and learning matching patterns.

## Priority: WAVE 14 (After Agents 1 and 3 complete)

## Wait Condition
Check for `.agent-done-W14-01` and `.agent-done-W14-03` marker files before starting.

## Files to CREATE

### 1. `server/src/services/claude/agents/payment-matching.ts`
**Purpose**: AI agent that intelligently matches OCR-extracted documents to bank transactions
**Pattern**: Follow `server/src/services/claude/agents/tax-strategy.ts` exactly (extends ClaudeAgent)

- [ ] Create `PaymentMatchingAgent extends ClaudeAgent<PaymentMatchingInput, PaymentMatchingOutput>` with:

#### System Prompt
```
You are an expert payment reconciliation agent for an Australian small business accounting platform.
You match invoices, receipts, and bills extracted via OCR against bank transaction records.

Key responsibilities:
- Find the most likely matching bank transaction for each document
- Score matches based on amount, date proximity, vendor name, and historical patterns
- Apply and manage matching rules for recurring payments
- Learn from confirmed matches to improve future accuracy
- Handle edge cases: partial payments, split transactions, GST-inclusive vs exclusive amounts

Matching intelligence:
- An invoice for $1,100 (incl GST) should match a bank debit of $1,100
- Vendor names in bank transactions are often abbreviated (e.g., "TELSTRA" vs "Telstra Corporation Ltd")
- Recurring bills (rent, utilities) typically arrive on similar dates each month
- Credit notes should match positive bank transactions (refunds)
- Payment timing: invoices are often paid 7-30 days after document date
- Multiple line items on one invoice match a single bank transaction
```

#### Tools (4 total)

##### `find_match_candidates`
- **Description**: Find potential bank transaction matches for an OCR-extracted document
- **Input schema**: `{ documentId: string, amountTolerance?: number, dateTolerance?: number, limit?: number }`
- **Handler**: Call `matchingService.findMatchCandidates(documentId, options)`
- **Returns**: Array of match candidates with scores, sorted by confidence DESC

##### `score_match`
- **Description**: Calculate a detailed match score between a document and a specific transaction
- **Input schema**: `{ documentId: string, transactionId: string }`
- **Handler**:
  1. Fetch document from `ocr_documents`
  2. Fetch transaction from `transactions`
  3. Call `matchingService.scoreMatch(document, transaction)`
- **Returns**: Detailed score breakdown with per-factor scores and overall confidence

##### `apply_matching_rules`
- **Description**: Apply user-defined matching rules to find definitive matches
- **Input schema**: `{ documentId: string }`
- **Handler**: Call `matchingService.applyRules(documentId)`
- **Returns**: Best rule-based match candidate, or null if no rules match

##### `learn_matching_pattern`
- **Description**: Learn from a confirmed match to create or refine matching rules
- **Input schema**: `{ matchId: string }`
- **Handler**:
  1. Call `matchingService.learnFromConfirmation(matchId)`
  2. Fetch the confirmed match to analyze the pattern
  3. Return analysis: what was learned, whether a new rule was created
- **Returns**: `{ learned: boolean, ruleCreated: boolean, ruleId?: string, pattern: { vendorName, averageAmount, typicalDayOfMonth } }`

#### Tool Handler Wiring
```typescript
import { PaymentMatchingService } from '../../payment-matching.js';

const matchingService = new PaymentMatchingService();

// In tool handler switch:
case 'find_match_candidates':
  return await matchingService.findMatchCandidates(input.documentId, {
    amountTolerance: input.amountTolerance,
    dateTolerance: input.dateTolerance,
    limit: input.limit,
  });
case 'score_match':
  const doc = await getDocument(input.documentId);
  const tx = await getTransaction(input.transactionId);
  return matchingService.scoreMatch(doc, tx);
case 'apply_matching_rules':
  return await matchingService.applyRules(input.documentId);
case 'learn_matching_pattern':
  await matchingService.learnFromConfirmation(input.matchId);
  return { learned: true };
```

## Files to MODIFY

### 2. `server/src/services/claude/types.ts`
- [ ] Verify `'payment_matching'` is added to `AgentType` union (Agent 4 adds this -- coordinate)
- [ ] Verify `PaymentMatchingInput` and `PaymentMatchingOutput` interfaces are present
- [ ] If Agent 4 has NOT run yet, add both entries yourself

### 3. `server/src/services/claude/config.ts`
- [ ] Verify `payment_matching` entry is in `AGENT_TOKEN_BUDGETS` and `AGENT_MODELS` (Agent 4 adds this)
- [ ] If Agent 4 has NOT run yet, add both entries yourself

### 4. `server/src/services/claude/orchestrator.ts`
- [ ] Add import: `import { PaymentMatchingAgent } from './agents/payment-matching.js';`
- [ ] Add import for types: `PaymentMatchingInput`, `PaymentMatchingOutput`
- [ ] Register agent in the agent registry (follow existing pattern)

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `PaymentMatchingAgent` can be instantiated
- [ ] All 4 tools are registered with valid input schemas
- [ ] `find_match_candidates` returns scored candidates
- [ ] `score_match` returns per-factor breakdown
- [ ] `learn_matching_pattern` can create new rules from confirmed matches
- [ ] Agent type 'payment_matching' appears in types.ts, config.ts, and orchestrator.ts
- [ ] Create marker file: `.agent-done-W14-05`

## Dependencies
- **Requires**: Agent 1 (`.agent-done-W14-01`), Agent 3 (`.agent-done-W14-03`)
- **Reuses**: base-agent.ts, payment-matching.ts, types.ts, config.ts, orchestrator.ts
- **Coordinate with**: Agent 4 on types.ts and config.ts modifications (both agents add to same union type)
