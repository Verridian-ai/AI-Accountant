# Agent 8: Agent Integration

## Role
Integrate the mutation framework into the existing agent system by modifying the base agent class, orchestrator, and two key agents (transaction categorizer, GST calculator) to use `MutationTools` for database writes.

## Priority: SUB-WAVE 3 (After Agents 2, 4)

## Files to MODIFY

### 1. `server/src/services/claude/base-agent.ts`

#### Change 1: Add optional MutationTools property
**Add near other property declarations**:

```typescript
import type { MutationTools } from './mutation-tools.js';

// Inside the ClaudeAgent class:
protected mutationTools?: MutationTools;

/**
 * Set the MutationTools instance for this agent invocation.
 * Called by the orchestrator before invoke() when mutation support is needed.
 * Agents that don't use mutations are unaffected — this is backward-compatible.
 */
setMutationTools(tools: MutationTools): void {
  this.mutationTools = tools;
}

/**
 * Check if mutation tools are available for this invocation.
 */
protected hasMutationTools(): boolean {
  return this.mutationTools != null;
}
```

#### Key Requirements:
- [ ] `mutationTools` is `protected` and `optional` — backward compatible
- [ ] `setMutationTools()` is a public setter
- [ ] `hasMutationTools()` is a protected convenience check
- [ ] Do NOT modify `invoke()`, `executeToolCalls()`, or any existing method signature
- [ ] Do NOT change the constructor signature
- [ ] Do NOT change how tools are registered or executed
- [ ] Import is `type`-only to avoid circular dependencies: `import type { MutationTools } from './mutation-tools.js'`

### 2. `server/src/services/claude/orchestrator.ts`

#### Change 1: Import ConfirmationFlowService and MutationTools
```typescript
import { ConfirmationFlowService } from './confirmation-flow.js';
import { MutationTools } from './mutation-tools.js';
```

#### Change 2: Add ConfirmationFlowService instance
```typescript
private confirmationFlow?: ConfirmationFlowService;

/**
 * Initialize the mutation framework.
 * Called once during server startup, after db is available.
 */
initMutationFramework(db: any, eventEmitter?: any): void {
  this.confirmationFlow = new ConfirmationFlowService(db, eventEmitter);
}
```

#### Change 3: Inject MutationTools in invoke()
**Inside the existing `invoke()` method**, before the agent is called, add mutation tools injection:

```typescript
// In invoke(), before calling agent.invoke():
if (this.confirmationFlow) {
  const session = await this.confirmationFlow.getOrCreateSession({});
  const mutationTools = this.confirmationFlow.createMutationTools(session.id);
  agent.setMutationTools(mutationTools);
}
```

- [ ] Add AFTER the existing feature flag check and circuit breaker setup
- [ ] Add BEFORE the actual `agent.invoke()` call
- [ ] Only inject if `this.confirmationFlow` is initialized (backward compatible)
- [ ] Do NOT change the invoke() return type or signature

#### Change 4: Add method to get session mutations
```typescript
/**
 * Get mutations for a specific session.
 */
async getSessionMutations(sessionId: string): Promise<unknown[]> {
  if (!this.confirmationFlow) return [];
  return this.confirmationFlow.getPendingMutations(sessionId);
}
```

#### Key Requirements:
- [ ] `initMutationFramework()` is optional — orchestrator works without it
- [ ] Mutation tools injection happens silently — agents that don't use mutations ignore it
- [ ] Do NOT modify `processStatement()` — the PDF pipeline doesn't use mutations yet
- [ ] Do NOT modify `registerAgents()` — agent registration is unchanged
- [ ] Do NOT modify `routeAndDispatch()` beyond what Wave 1 already did
- [ ] Do NOT change any existing method signatures

### 3. `server/src/services/claude/agents/transaction-categorizer.ts`

#### Change: Use MutationTools for categorization updates
**In the tool handler that updates transaction categories**, wrap the DB write with mutation proposal:

```typescript
// BEFORE (direct DB write):
// await db.run('UPDATE transactions SET category = ? WHERE id = ?', [category, txId]);

// AFTER (mutation proposal):
if (this.mutationTools) {
  await this.mutationTools.proposeMutation({
    agentType: 'transaction_categorizer',
    mutationType: 'update',
    targetTable: 'transactions',
    targetId: txId,
    beforeState: { category: existingCategory },
    afterState: { category: newCategory, gst_category: gstCategory },
    description: `Categorize transaction ${txId} as '${newCategory}'`,
    confidence: confidenceScore,
    requiresConfirmation: confidenceScore < 0.9,
  });
} else {
  // Fallback: direct write (for backward compatibility)
  await db.run('UPDATE transactions SET category = ?, gst_category = ? WHERE id = ?',
    [newCategory, gstCategory, txId]);
}
```

For the **batch categorization tool** (`batch_categorize`):
```typescript
if (this.mutationTools) {
  const proposals = transactions.map(tx => ({
    agentType: 'transaction_categorizer' as const,
    mutationType: 'batch_update' as const,
    targetTable: 'transactions',
    targetId: tx.id,
    beforeState: { category: tx.existingCategory },
    afterState: { category: tx.newCategory, gst_category: tx.gstCategory },
    description: `Batch categorize: ${tx.description} → '${tx.newCategory}'`,
    confidence: tx.confidence,
    requiresConfirmation: tx.confidence < 0.9,
  }));
  await this.mutationTools.batchProposeMutations(proposals);
} else {
  // Fallback: direct batch write
  for (const tx of transactions) {
    await db.run('UPDATE transactions SET category = ?, gst_category = ? WHERE id = ?',
      [tx.newCategory, tx.gstCategory, tx.id]);
  }
}
```

#### Key Requirements:
- [ ] Check `this.mutationTools` before using — fallback to direct write if not available
- [ ] Include `confidence` score in proposals for auto-execute decisions
- [ ] Include `beforeState` for audit trail
- [ ] Keep the existing direct-write path as fallback
- [ ] Do NOT change the tool definitions or system prompt
- [ ] Do NOT change the input/output types

### 4. `server/src/services/claude/agents/gst-calculator.ts`

#### Change: Use MutationTools for GST category updates
**In the tool handler that sets GST categories**:

```typescript
// When updating GST category on a transaction:
if (this.mutationTools) {
  await this.mutationTools.proposeMutation({
    agentType: 'gst_calculator',
    mutationType: 'update',
    targetTable: 'transactions',
    targetId: txId,
    beforeState: { gst_amount: existingGst, gst_category: existingGstCat },
    afterState: { gst_amount: calculatedGst, gst_category: gstCategory },
    description: `Set GST for transaction ${txId}: $${calculatedGst} (${gstCategory})`,
    confidence: 0.85, // GST calculations have moderate confidence
    requiresConfirmation: true, // GST ALWAYS requires confirmation (financial)
  });
} else {
  // Fallback: direct write
  await db.run(
    'UPDATE transactions SET gst_amount = ?, gst_category = ? WHERE id = ?',
    [calculatedGst, gstCategory, txId]
  );
}
```

For **BAS calculation updates**:
```typescript
if (this.mutationTools) {
  await this.mutationTools.proposeMutation({
    agentType: 'gst_calculator',
    mutationType: 'create',
    targetTable: 'bas_calculations',
    afterState: basCalculation,
    description: `Generate BAS calculation for ${period}`,
    confidence: 0.9,
    requiresConfirmation: true, // BAS is always financial = always confirm
  });
} else {
  // Fallback: direct insert
  await db.run('INSERT INTO bas_calculations ...', [...]);
}
```

#### Key Requirements:
- [ ] GST mutations ALWAYS set `requiresConfirmation: true` (financial compliance)
- [ ] Include before/after state for GST amount and category
- [ ] BAS calculations use 'create' mutation type
- [ ] Keep fallback for when mutation tools aren't available
- [ ] Do NOT change tool definitions, system prompt, or I/O types

### 5. `server/src/index.ts` — Initialize mutation framework

**Add near the server startup section** (after db initialization, before route registration):

```typescript
// Initialize mutation framework
orchestrator.initMutationFramework(db, eventEmitter);
```

- [ ] Single line addition after orchestrator is created
- [ ] Uses existing `db` and `eventEmitter` variables

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `base-agent.ts` has `setMutationTools()` and `hasMutationTools()` methods
- [ ] `orchestrator.ts` has `initMutationFramework()` and `getSessionMutations()` methods
- [ ] `invoke()` injects MutationTools when available
- [ ] `transaction-categorizer.ts` proposes mutations instead of direct writes
- [ ] `gst-calculator.ts` proposes mutations with `requiresConfirmation: true`
- [ ] Both agents fall back to direct writes when MutationTools is not available
- [ ] No existing method signatures changed
- [ ] No existing agent types removed
- [ ] No tool definitions changed
- [ ] Create marker file: `.agent-done-W2-08`

## Dependencies
- **Requires**: Agent 2 (MutationTools), Agent 4 (ConfirmationFlowService)
- **Blocks**: Agent 10 (Testing needs all integrations)
