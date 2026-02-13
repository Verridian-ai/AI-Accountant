# Agent 10: Testing & Validation

## Role
Run comprehensive verification of all Wave 1 deliverables: TypeScript compilation, migration validation, endpoint testing, and backward compatibility checks.

## Priority: SUB-WAVE 4 (After ALL other agents complete)

## Verification Checklist

### Phase 1: TypeScript Compilation
- [ ] Run `cd server && npx tsc --noEmit` — must pass with ZERO new errors
- [ ] Run `cd client && npx tsc --noEmit` — must pass with ZERO new errors
- [ ] If errors found: identify which agent's code caused them, fix the issues, and re-run

### Phase 2: Migration Validation
- [ ] Verify `docker/migrations/0013_postgres_schema_sync.sql` exists
- [ ] Verify file starts with `BEGIN;` and ends with `COMMIT;`
- [ ] Verify all 33 `CREATE TABLE IF NOT EXISTS` statements are present:
  - business_profiles, bas_periods, bas_calculations, tax_codes, tax_brackets
  - deductions, cgt_assets, cgt_events, depreciable_assets, depreciation_schedule
  - tax_year_summary, audit_log, sessions, teams, team_members
  - team_invitations, subscriptions, export_history, parser_metrics, parser_accuracy_aggregates
  - parser_feedback, chart_of_accounts, journal_entries, journal_entry_lines, accounting_periods
  - account_balances, rag_namespaces, rag_chunks, rag_documents, rag_citations
  - tax_offsets, capital_losses, upload_queue
- [ ] Verify `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS ownership_tag TEXT;`
- [ ] Verify `ALTER TABLE transactions` adds all 6 missing columns
- [ ] Verify all recommended indexes are created (per R04)
- [ ] Check SQL syntax is valid PostgreSQL (no SQLite-isms like `INTEGER` for booleans)

### Phase 3: PostgreSQL Schema Definitions
- [ ] Verify `server/src/db/postgres-schema.ts` has 33 new `pgTable()` definitions
- [ ] Verify each pgTable uses correct PG types:
  - `boolean()` for boolean fields (NOT `integer({ mode: 'boolean' })`)
  - `timestamp({ withTimezone: true })` for timestamp fields
  - `real()` for decimal numbers
- [ ] Verify type exports exist for all new tables

### Phase 4: New Service Files
- [ ] Verify `server/src/services/claude/intent-router.ts` exists and exports:
  - `IntentRouter` class
  - `IntentClassification` interface
- [ ] Verify `server/src/services/claude/agent-dispatcher.ts` exists and exports:
  - `AgentDispatcher` class
  - `AgentDispatchResult` interface
  - `PipelineResult` interface
- [ ] Verify `server/src/services/claude/response-formatter.ts` exists and exports:
  - `ResponseFormatter` class
  - `ChatResponse` interface

### Phase 5: Route Registration
- [ ] Verify `server/src/routes/agent-routes-extended.ts` exists
- [ ] Verify it contains 8 route handlers (7 POST + 1 GET)
- [ ] Verify `index.ts` imports and mounts the extended routes BEFORE the wildcard `:type/run`
- [ ] Verify all POST routes have Zod validation

### Phase 6: Chat Endpoint
- [ ] Verify the `POST /api/chat` handler in `index.ts` uses:
  - IntentRouter for classification
  - AgentDispatcher for execution
  - ResponseFormatter for response formatting
- [ ] Verify the response always includes `{ answer: string }` (backward compatible)
- [ ] Verify error responses use `formatError()` (returns `{ answer: "..." }` not `{ error: "..." }`)

### Phase 7: UI Components
- [ ] Verify `client/src/features/chat/components/AgentResponseCard.tsx` exists
- [ ] Verify `client/src/features/chat/components/IntentDebugPanel.tsx` exists
- [ ] Verify `client/src/features/chat/components/AgentRoutingIndicator.tsx` exists
- [ ] Verify `FloatingChat.tsx` has enhanced message type with `agentType`, `intentClassification` fields
- [ ] Verify `ChatInterface.tsx` conditionally renders `AgentResponseCard` for agent-typed messages
- [ ] Verify `api.ts` has updated `ChatApiResponse` interface with enhanced fields

### Phase 8: Cognee Integration
- [ ] Verify `cognee-tools.ts` has `searchForAgent()` method
- [ ] Verify all 21 agent types have search strategy mappings
- [ ] Verify unknown agent types fall back to generic CHUNKS search

### Phase 9: Orchestrator
- [ ] Verify `orchestrator.ts` has `routeAndDispatch()` method
- [ ] Verify old `analyze()` method still exists as deprecated wrapper
- [ ] Verify `getAgentStatus()` method exists
- [ ] Verify all 21 existing agents are still registered (no agents removed)

### Phase 10: Backward Compatibility (BC-01 through BC-10)
- [ ] BC-01: No agent types removed from `types.ts` AgentType union
- [ ] BC-02: No schema tables removed from `schema.ts`
- [ ] BC-03: No existing migration files (0023-0029) modified
- [ ] BC-04: New pgTable definitions match dual schema pattern
- [ ] BC-05: No changes to ClaudeAgent base class
- [ ] BC-06: CogneeClient remains singleton with only additions (no modifications)
- [ ] BC-07: Migration 0013 uses correct numbering
- [ ] BC-08: No changes to existing config.ts agent entries
- [ ] BC-09: No existing I/O interfaces modified in types.ts
- [ ] BC-10: No route namespace collisions with Wave 11-24 routes

### Phase 11: Marker Files
- [ ] Verify all 9 preceding marker files exist:
  - `.agent-done-W01-01` through `.agent-done-W01-09`
- [ ] Create final marker file: `.agent-done-W01-10`

## Fix Procedure
If any check fails:
1. Identify the root cause and which agent's code is responsible
2. Fix the issue directly (you have permission to edit any Wave 1 file)
3. Re-run the relevant tsc check to confirm the fix
4. Document what was fixed in a comment at the top of the marker file

## Verification Complete Criteria
ALL 11 phases must pass. Only then create `.agent-done-W01-10`.

## Dependencies
- **Requires**: ALL other agents (1-9) must complete first
- **This is the final agent** — it validates the entire wave
