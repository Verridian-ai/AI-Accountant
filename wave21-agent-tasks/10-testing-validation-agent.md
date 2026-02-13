# Agent 10: Testing & Validation Agent

## Role
Run the full verification plan for Wave 21 (Vercel AI SDK Migration). Validate streaming, structured output, legacy fallback, and migration tracking across all migrated agents.

## Priority: WAVE 21 FINAL (After ALL Wave 21 agents complete)

## Wait Condition
Check for ALL marker files: `.agent-done-W21-01` through `.agent-done-W21-09` before starting.

## Verification Tasks

### 1. Compilation
- [ ] Run `cd server && npx tsc --noEmit` (zero errors)
- [ ] Run `cd client && npx tsc --noEmit` (zero errors)
- [ ] Run `docker compose config` (validates docker-compose.yml)

### 2. Schema & Migration
- [ ] Run migration 0033 against PostgreSQL:
  ```bash
  docker compose exec postgres psql -U app_user -d ai_accountant -f /docker-entrypoint-initdb.d/0033_vercel_ai_sdk.sql
  ```
- [ ] Verify 3 new tables exist: `\dt agent_stream_sessions`, `\dt structured_output_schemas`, `\dt agent_migration_status`
- [ ] Verify indexes exist on all 3 tables

### 3. Vercel AI SDK Base Class
- [ ] Verify `VercelAgent` can be instantiated by extending it in a test class
- [ ] Verify `getAnthropicProvider()` returns valid provider (requires ANTHROPIC_API_KEY)
- [ ] Verify `adaptLegacyTool()` correctly converts tool format from ClaudeAgent to Vercel SDK

### 4. Streaming
- [ ] Test streaming endpoint:
  ```bash
  curl -N -H "Accept: text/event-stream" \
    -X POST http://localhost:3501/api/stream/agent/budget_analyzer \
    -H "Content-Type: application/json" \
    -d '{"period":"2024-01","userId":"default"}'
  ```
- [ ] Verify SSE events arrive in correct format: `event: token\ndata: {...}\n\n`
- [ ] Verify `[DONE]` event arrives with token count and latency
- [ ] Verify session recorded in `agent_stream_sessions` table
- [ ] Test cancellation: `DELETE /api/stream/session/:sessionId` stops stream within 1 second

### 5. Structured Output
- [ ] Test generateObject for transaction_categorizer:
  ```bash
  curl -X POST http://localhost:3501/api/stream/agent/transaction_categorizer \
    -H "Content-Type: application/json" \
    -d '{"transactions":[{"id":"test1","description":"WOOLWORTHS 1234","amount":-45.60}]}'
  ```
- [ ] Verify output matches `CategorizerOutputSchema` (category, confidence, gstCategory)
- [ ] Test schema validation endpoint: `POST /api/schemas/transaction_categorizer/validate`
- [ ] Verify invalid output is rejected with descriptive Zod errors

### 6. Legacy Fallback
- [ ] Set `USE_VERCEL_SDK=false`, verify all agents use legacy ClaudeAgent path
- [ ] Set `USE_VERCEL_SDK=true`, simulate Vercel SDK error, verify fallback to legacy
- [ ] Verify `agent_migration_status.rollback_count` increments on fallback

### 7. Migration Dashboard
- [ ] `GET /api/migration/status` returns status for all 5 migrated agents
- [ ] `GET /api/migration/benchmarks` returns latency and error rate comparisons
- [ ] `POST /api/migration/rollback/budget_analyzer` forces agent to legacy mode

### 8. UI Components
- [ ] StreamingChat renders and connects to streaming endpoint
- [ ] SessionHistory lists past sessions with correct data
- [ ] MigrationDashboard shows migration phases for all agents
- [ ] SchemaExplorer lists all registered schemas
- [ ] All components use neumorphic dark theme (neu-raised, neu-inset, gold accents)

### 9. Performance Baseline
- [ ] Record baseline latency for each migrated agent (both legacy and Vercel)
- [ ] Record baseline error rates
- [ ] Store in `agent_migration_status` table

### 10. Generate Verification Report
```
GOLDLEDGER WAVE 21 VERIFICATION REPORT
=======================================
Date: [timestamp]
Schema:           [PASS/FAIL] - 3 tables, indexes, FK references
Base Class:       [PASS/FAIL] - VercelAgent, provider, tool adapter
Streaming:        [PASS/FAIL] - SSE delivery, cancellation, session tracking
Structured Output:[PASS/FAIL] - Zod schemas, generateObject, validation
Pilot Migration:  [PASS/FAIL] - budget_analyzer, transaction_categorizer
Batch Migration:  [PASS/FAIL] - financial_planner, tax_strategy, merchant_intelligence
Legacy Fallback:  [PASS/FAIL] - Automatic fallback on Vercel error
API Endpoints:    [PASS/FAIL] - 12 routes accessible
UI Components:    [PASS/FAIL] - 5 streaming components render
Performance:      [PASS/FAIL] - Baseline latency recorded
Build:            [PASS/FAIL] - Server + Client + Docker clean
```

- [ ] Create marker file: `.agent-done-W21-10`

## Dependencies
- **Requires**: ALL Wave 21 agents (`.agent-done-W21-01` through `.agent-done-W21-09`)
- **Docker must be running**: `docker compose up -d`
