# Agent 3: Database Migration Builder

## Role
Verify and finalize Drizzle ORM schema updates after Agent 2 creates the migration SQL.

## Priority: WAVE 2 (After Agent 2 completes)

## Wait Condition
Check for `.agent-done-02` marker file before starting.

## Tasks

### 1. Verify schema.ts matches migration SQL
**File**: `server/src/schema.ts`

- [ ] Verify all 5 new sqliteTable definitions (`ownerEquityEvents`, `taxStrategies`, `loanScenarios`, `budgetTemplates`, `economicDataCache`) match 0012 migration column names, types (`text()` for TEXT, `integer()` for INTEGER, `real()` for REAL, `integer({mode:'boolean'})` for BOOLEAN), and foreign key references (users.id, accounts.id, transactions.id)
- [ ] Verify `transactions` table has 4 new claim columns: `claimType`, `claimAmount`, `claimMethod`, `substantiationStatus`

### 2. Verify postgres-schema.ts matches migration SQL
**File**: `server/src/db/postgres-schema.ts`

- [ ] Verify all 5 new pgTable definitions match their sqliteTable counterparts with PostgreSQL-specific types (`boolean()` instead of `integer({mode:'boolean'})`), and indexes defined in the third argument of pgTable (like transactions at line 203-214)
- [ ] Verify `transactions` pgTable has 4 new claim columns

### 3. Cross-reference foreign keys and naming
- [ ] Verify all FK references are valid: `ownerEquityEvents.userId` → `users.id` (schema.ts ~line 100), `ownerEquityEvents.accountId` → `accounts.id` (~line 150), `ownerEquityEvents.transactionId` → `transactions.id` (line 217). Verify no naming conflicts with existing `export const` declarations.

### 4. Test compilation and exports
- [ ] Run `cd server && npx tsc --noEmit` — must pass clean
- [ ] Verify all new table exports are accessible: `import { ownerEquityEvents, taxStrategies, loanScenarios, budgetTemplates, economicDataCache } from './schema.js'`

## Verification
- [ ] Both schema files compile without errors
- [ ] All 5 new tables + 4 new transaction columns present in both schemas
- [ ] Create marker file: `.agent-done-03`

## Dependencies
- **Requires**: Agent 2 (`.agent-done-02`)
- **Schema lock**: Only Agent 2 and Agent 3 may modify schema.ts and postgres-schema.ts
