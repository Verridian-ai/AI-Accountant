# Agent 10: Testing & Validation

## Role
Run comprehensive verification of all Wave 2 deliverables: TypeScript compilation, migration validation, service verification, endpoint testing, UI component checks, and backward compatibility.

## Priority: SUB-WAVE 4 (After ALL other agents complete)

## Verification Checklist

### Phase 1: TypeScript Compilation
- [ ] Run `cd server && npx tsc --noEmit` — must pass with ZERO new errors
- [ ] Run `cd client && npx tsc --noEmit` — must pass with ZERO new errors
- [ ] If errors found: identify which agent's code caused them, fix the issues, and re-run

### Phase 2: Migration Validation
- [ ] Verify `docker/migrations/0014_agent_mutations.sql` exists
- [ ] Verify file starts with `BEGIN;` and ends with `COMMIT;`
- [ ] Verify 3 `CREATE TABLE IF NOT EXISTS` statements:
  - `agent_sessions` (created FIRST — referenced by FKs)
  - `agent_mutations` (references agent_sessions)
  - `agent_audit_log` (references agent_mutations and agent_sessions)
- [ ] Verify FK ordering: `agent_sessions` before `agent_mutations` before `agent_audit_log`
- [ ] Verify all indexes are created with `IF NOT EXISTS`
- [ ] Verify correct PG types: `BOOLEAN`, `TIMESTAMP WITH TIME ZONE`, `REAL`, `TEXT`
- [ ] Verify no SQLite-isms (`INTEGER` for booleans, etc.)
- [ ] Verify `docker-compose.yml` mounts the migration as `10-agent-mutations.sql`

### Phase 3: Dual Schema Definitions
- [ ] Verify `server/src/schema.ts` has 3 new `sqliteTable()` definitions:
  - `agentSessions`
  - `agentMutations`
  - `agentAuditLog`
- [ ] Verify SQLite uses `integer({ mode: 'boolean' })` for `requires_confirmation`
- [ ] Verify SQLite uses `integer({ mode: 'timestamp' })` for timestamp fields
- [ ] Verify `server/src/db/postgres-schema.ts` has 3 new `pgTable()` definitions:
  - `pgAgentSessions`
  - `pgAgentMutations`
  - `pgAgentAuditLog`
- [ ] Verify PG uses `boolean()` for boolean fields
- [ ] Verify PG uses `timestamp({ withTimezone: true })` for timestamp fields
- [ ] Verify PG uses `real()` for confidence field
- [ ] Verify type exports exist for all new tables

### Phase 4: Service Files
- [ ] Verify `server/src/services/claude/mutation-tools.ts` exists and exports:
  - `MutationTools` class
  - `MutationProposal` interface
  - `AgentMutation` interface
  - `MutationStatus` type
  - `MutationExecutionResult` interface
- [ ] Verify `server/src/services/claude/mutation-auth.ts` exists and exports:
  - `MutationAuthService` class
  - `MutationAuthDecision` interface
- [ ] Verify `server/src/services/claude/confirmation-flow.ts` exists and exports:
  - `ConfirmationFlowService` class
  - `AgentSession` interface
  - `CreateSessionOptions` interface
- [ ] Verify `server/src/services/claude/streaming.ts` exists and exports:
  - `StreamingService` class
  - `StreamWriter` interface
  - `StreamEvent` interface
  - `StreamEventType` type
- [ ] Verify `server/src/services/claude/audit.ts` exists and exports:
  - `AuditService` class
  - `AuditEntry` interface
  - `AuditAction` type
  - `AuditQueryOptions` interface

### Phase 5: API Endpoints
- [ ] Verify `POST /api/chat/stream` endpoint exists in `index.ts`
- [ ] Verify `POST /api/chat/confirm/:actionId` endpoint exists
- [ ] Verify `POST /api/chat/reject/:actionId` endpoint exists
- [ ] Verify `GET /api/chat/pending` endpoint exists
- [ ] Verify `GET /api/chat/history` endpoint exists
- [ ] Verify `GET /api/agent-audit` endpoint exists
- [ ] Verify all endpoints are placed AFTER the existing `POST /api/chat`
- [ ] Verify `ConfirmationFlowService` is initialized in index.ts
- [ ] Verify `AuditService` is initialized in index.ts
- [ ] Verify stale mutation expiration timer is started (`setInterval`)
- [ ] Verify `orchestrator.initMutationFramework()` is called during startup

### Phase 6: Agent Integration
- [ ] Verify `base-agent.ts` has:
  - `protected mutationTools?: MutationTools` property
  - `setMutationTools()` public method
  - `hasMutationTools()` protected method
  - NO changes to `invoke()` signature
  - NO changes to constructor
- [ ] Verify `orchestrator.ts` has:
  - `initMutationFramework()` method
  - `getSessionMutations()` method
  - MutationTools injection in `invoke()` (conditional)
  - NO changes to `processStatement()` or `registerAgents()`
- [ ] Verify `transaction-categorizer.ts`:
  - Uses `this.mutationTools.proposeMutation()` for category updates
  - Falls back to direct DB write when mutation tools unavailable
  - Includes confidence score in proposals
  - No changes to tool definitions or system prompt
- [ ] Verify `gst-calculator.ts`:
  - Uses `this.mutationTools.proposeMutation()` for GST updates
  - Sets `requiresConfirmation: true` for all GST mutations
  - Falls back to direct DB write when unavailable
  - No changes to tool definitions or system prompt

### Phase 7: MutationAuth Permission Matrix
- [ ] Verify `transaction_categorizer` can update `transactions`
- [ ] Verify `budget_analyzer` CANNOT update `transactions` (read-only agent)
- [ ] Verify auto-execute threshold for categorization is 0.9
- [ ] Verify financial tables (bas_calculations, tax_year_summary, etc.) always require confirmation
- [ ] Verify delete operations always require confirmation
- [ ] Verify all 21 agent types are covered in the permission matrix (or default to denied)

### Phase 8: UI Components
- [ ] Verify `client/src/features/chat/components/StreamingMessage.tsx` exists
- [ ] Verify `client/src/features/chat/components/ConfirmationCard.tsx` exists
- [ ] Verify `client/src/features/chat/components/AgentProgressBar.tsx` exists
- [ ] Verify `client/src/features/transactions/components/AuditTrailViewer.tsx` exists
- [ ] Verify `FloatingChat.tsx` has streaming state (`isStreaming`, `streamTokens`, `pendingMutations`, `sessionId`)
- [ ] Verify `FloatingChat.tsx` has `handleStreamingChat`, `handleConfirmMutation`, `handleRejectMutation`
- [ ] Verify `api.ts` has `streamChat()`, `confirmMutation()`, `rejectMutation()`, `fetchPendingMutations()`, `fetchAuditLog()`

### Phase 9: Backward Compatibility (BC-01 through BC-10)
- [ ] BC-01: No agent types removed from `types.ts` AgentType union
- [ ] BC-02: No schema tables removed from `schema.ts`
- [ ] BC-03: No existing migration files (0013, 0023-0029) modified
- [ ] BC-04: New pgTable definitions match dual schema pattern
- [ ] BC-05: No changes to ClaudeAgent base class invoke() signature
- [ ] BC-06: CogneeClient remains singleton with only additions
- [ ] BC-07: Migration 0014 uses correct numbering (after 0013, before 0015)
- [ ] BC-08: No changes to existing config.ts agent entries
- [ ] BC-09: No existing I/O interfaces modified in types.ts
- [ ] BC-10: Route namespaces `/api/chat/*` and `/api/agent-audit` don't collide with Wave 11-24

### Phase 10: SSE/Streaming
- [ ] Verify `streaming.ts` sets correct headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`
- [ ] Verify SSE wire format: `event: {type}\ndata: {json}\n\n`
- [ ] Verify existing `GET /api/events` SSE endpoint is NOT modified
- [ ] Verify heartbeat interval (30s default)
- [ ] Verify stream auto-closes on `sendComplete()`

### Phase 11: Marker Files
- [ ] Verify all 9 preceding marker files exist:
  - `.agent-done-W2-01` through `.agent-done-W2-09`
- [ ] Create final marker file: `.agent-done-W2-10`

## Fix Procedure
If any check fails:
1. Identify the root cause and which agent's code is responsible
2. Fix the issue directly (you have permission to edit any Wave 2 file)
3. Re-run the relevant tsc check to confirm the fix
4. Document what was fixed in a comment at the top of the marker file

## Verification Complete Criteria
ALL 11 phases must pass. Only then create `.agent-done-W2-10`.

## Dependencies
- **Requires**: ALL other agents (1-9) must complete first
- **This is the final agent** — it validates the entire wave
