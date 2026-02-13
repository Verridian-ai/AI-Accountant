# Agent 5: Pilot Migration 2 -- Transaction Categorizer

## Role
Migrate `transaction_categorizer` agent to `VercelAgent` with Zod structured output for type-safe category assignments. This is the second pilot migration, validating structured output (`generateObject()`) specifically.

## Priority: WAVE 21 (After Agents 2, 6)

## Wait Condition
Check for `.agent-done-W21-02` and `.agent-done-W21-06` marker files before starting.

## Files to CREATE

### 1. `server/src/services/claude/agents/vercel/transaction-categorizer.ts`
**Purpose**: Vercel AI SDK version of transaction_categorizer with Zod structured output
**Pattern**: Extend `VercelAgent<CategorizerInput, CategorizerOutput>` from `vercel-agent.ts`
**Reference**: Legacy implementation at `server/src/services/claude/agents/transaction-categorizer.ts`

- [ ] Create `VercelTransactionCategorizer extends VercelAgent<CategorizerInput, CategorizerOutput>`:
  - System prompt: Copy from legacy `transaction-categorizer.ts`
  - Output schema: Import Zod schema from `server/src/services/claude/schemas/categorizer-output.ts` (created by Agent 6)
  - `getTools()`: Convert existing tools:
    - `categorize_transaction` -- assigns category from `categories.ts` constants
    - `search_merchant_history` -- Cognee search for merchant patterns
    - `check_similar_transactions` -- DB query for similar descriptions
    - `apply_gst_rules` -- GST classification based on category
  - `buildPrompt(input)`: Format transaction description, amount, merchant for categorization
- [ ] Use `generateObject()` instead of `generateText()` for guaranteed structured output:
  ```typescript
  const result = await generateObject({
    model: this.getModel(),
    schema: this.outputSchema,
    prompt: this.buildPrompt(input),
    system: this.systemPrompt,
  });
  ```
- [ ] Validate output against registered schema in `structured_output_schemas` table
- [ ] Record validation pass/fail stats

### 2. `server/src/services/claude/agents/vercel/categorizer-validator.ts`
**Purpose**: Post-categorization validation layer

- [ ] Export `validateCategorization(output: CategorizerOutput): ValidationResult`:
  - Check category exists in `categories.ts` constants
  - Check GST category matches expected for the assigned category
  - Check confidence score is between 0 and 1
  - Check no duplicate transaction IDs in batch output
- [ ] Export `reconcileWithLegacy(vercelOutput, legacyOutput): ComparisonResult` -- for A/B testing during pilot

## Files to MODIFY

### 3. `server/src/services/claude/orchestrator.ts`
- [ ] Add import for `VercelTransactionCategorizer`
- [ ] Add dispatch case for `transaction_categorizer` with Vercel flag check (same pattern as Agent 4)

### 4. `server/src/services/claude/config.ts`
- [ ] Add to `VERCEL_MIGRATION_FLAGS`:
  ```typescript
  transaction_categorizer: process.env.USE_VERCEL_SDK === 'true',
  ```

### 5. `server/src/services/pipeline.ts`
- [ ] In the categorization step, add parallel execution mode for A/B testing:
  ```typescript
  if (process.env.VERCEL_AB_TEST === 'true') {
    const [vercelResult, legacyResult] = await Promise.allSettled([
      vercelCategorizer.execute(input),
      legacyCategorizer.execute(input),
    ]);
    await reconcileWithLegacy(vercelResult, legacyResult);
  }
  ```

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `generateObject()` returns typed `CategorizerOutput` matching Zod schema
- [ ] Invalid outputs are rejected by Zod validation (test with malformed data)
- [ ] A/B test mode runs both engines and logs comparison
- [ ] Categories in output match `categories.ts` constants (single source of truth)
- [ ] `structured_output_schemas` row has updated validation_stats
- [ ] Create marker file: `.agent-done-W21-05`

## Dependencies
- **Requires**: Agent 2 (`.agent-done-W21-02`) for VercelAgent base, Agent 6 (`.agent-done-W21-06`) for Zod schemas
- **Reuses**: Existing transaction-categorizer.ts tools, categories.ts constants, pipeline.ts
