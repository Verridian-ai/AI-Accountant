# Agent 2: Docker Services Builder

## Role
Add Redis service to Docker stack, create migration 0012, update both Drizzle schemas.

## Priority: WAVE 1 (Start Immediately)

## Files to CREATE

### 1. `docker/migrations/0012_tax_return_platform.sql`
**Purpose**: Add new tables + ALTER transactions for tax return platform
**Reference**: `docs/Curretn Claudecode plan.md` lines 71-159
**Existing migrations**: 0009_complete_schema.sql, 0010_add_missing_columns.sql, 0011_final_schema_sync.sql

- [ ] Create migration SQL with 5 new tables and 1 ALTER:
  - `owner_equity_events` (id, user_id FK, account_id FK, transaction_id FK, event_type CHECK contribution/drawing, amount, detected_by, confirmed, financial_year, notes, timestamps + index on user_id,financial_year)
  - `tax_strategies` (id, user_id FK, financial_year, strategy_name, description, estimated_saving, confidence, ato_ruling_ref, applicable_entities, status CHECK suggested/applied/dismissed, created_at + index)
  - `loan_scenarios` (id, user_id FK, loan_type CHECK 6 types, principal, rate, term_months, frequency, offset_balance, extra_repayment, results_json, created_at)
  - `budget_templates` (id, user_id FK, name, entity_type, categories_json, is_active, created_at)
  - `economic_data_cache` (id, data_source, data_key, data_value, fetched_at, expires_at, UNIQUE source+key + index)
  - ALTER transactions: add claim_type TEXT, claim_amount INTEGER DEFAULT 0, claim_method TEXT, substantiation_status TEXT DEFAULT 'none'

## Files to MODIFY

### 2. `docker-compose.yml`

- [ ] Add Redis 7 Alpine service (port 6379, redis-data volume, cba-network, healthcheck) after postgres service (line 47)
- [ ] Add redis-data volume to volumes section and migration mount `0012_tax_return_platform.sql` to postgres volumes (after line 39)

### 3. `server/src/schema.ts` — Add new tables (after line 971)

- [ ] Add 5 new sqliteTable definitions matching migration SQL: `ownerEquityEvents`, `taxStrategies`, `loanScenarios`, `budgetTemplates`, `economicDataCache`
- [ ] Add 4 claim columns to `transactions` table (after line 234): claimType text(), claimAmount integer(), claimMethod text(), substantiationStatus text()

### 4. `server/src/db/postgres-schema.ts` — Add new tables (after line 480)

- [ ] Add 5 new pgTable definitions matching migration SQL (use `boolean()` not `integer({mode:'boolean'})`)
- [ ] Add 4 claim columns to `transactions` pgTable (after line 201)

## Verification
- [ ] `docker compose config` validates without errors
- [ ] Migration SQL is syntactically valid
- [ ] `cd server && npx tsc --noEmit` passes (schema changes compile)
- [ ] Create marker file: `.agent-done-02`

## Dependencies
- **None** — can start immediately
- **IMPORTANT**: Only this agent and Agent 3 may touch schema.ts and postgres-schema.ts
