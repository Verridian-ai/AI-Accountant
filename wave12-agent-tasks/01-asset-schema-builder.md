# Agent 1: Asset Schema Builder

## Role
Create 10 new database tables for fixed assets and multi-entity consolidation, plus migration 0024.

## Priority: WAVE 1 (Start Immediately)

## Files to CREATE

### 1. `docker/migrations/0024_fixed_assets_multi_entity.sql`
**Purpose**: Add 10 new tables for fixed asset register, depreciation tracking, asset disposals, multi-entity hierarchy, inter-entity transactions, and consolidation snapshots.
**Existing migrations**: 0009_complete_schema.sql, 0010_add_missing_columns.sql, 0011_final_schema_sync.sql, 0012_tax_return_platform.sql

- [ ] Create migration SQL with 10 new tables:

  - `fixed_assets` (id TEXT PK, user_id TEXT FK→users.id, entity_id TEXT FK→entities.id NULL, account_id TEXT FK→accounts.id NULL, asset_name TEXT NOT NULL, asset_number TEXT UNIQUE, description TEXT, category TEXT NOT NULL CHECK IN ('plant_and_equipment','motor_vehicle','office_equipment','computer_equipment','furniture_fittings','building','land','leasehold_improvement','intangible','low_value_pool'), purchase_date TEXT NOT NULL, purchase_price INTEGER NOT NULL, residual_value INTEGER DEFAULT 0, useful_life_months INTEGER, depreciation_method TEXT NOT NULL CHECK IN ('straight_line','diminishing_value','instant_write_off','low_value_pool'), effective_life_years REAL, ato_effective_life_years REAL, opening_written_down_value INTEGER, current_written_down_value INTEGER, status TEXT NOT NULL DEFAULT 'active' CHECK IN ('active','disposed','fully_depreciated','written_off'), location TEXT, serial_number TEXT, supplier TEXT, invoice_reference TEXT, gst_claimed INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP + INDEX on user_id,status + INDEX on entity_id)

  - `asset_depreciation` (id TEXT PK, asset_id TEXT FK→fixed_assets.id NOT NULL, financial_year TEXT NOT NULL, period_start TEXT NOT NULL, period_end TEXT NOT NULL, opening_value INTEGER NOT NULL, depreciation_amount INTEGER NOT NULL, closing_value INTEGER NOT NULL, depreciation_rate REAL, method_used TEXT NOT NULL, is_adjustment INTEGER DEFAULT 0, adjustment_reason TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP + INDEX on asset_id,financial_year UNIQUE + INDEX on financial_year)

  - `asset_disposals` (id TEXT PK, asset_id TEXT FK→fixed_assets.id NOT NULL, disposal_date TEXT NOT NULL, disposal_method TEXT NOT NULL CHECK IN ('sale','scrapped','trade_in','theft','insurance_claim'), proceeds INTEGER DEFAULT 0, written_down_value_at_disposal INTEGER NOT NULL, profit_loss INTEGER NOT NULL, gst_on_proceeds INTEGER DEFAULT 0, buyer_details TEXT, invoice_reference TEXT, cgt_applicable INTEGER DEFAULT 0, cgt_discount_eligible INTEGER DEFAULT 0, notes TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP + INDEX on disposal_date)

  - `entities` (id TEXT PK, user_id TEXT FK→users.id NOT NULL, name TEXT NOT NULL, entity_type TEXT NOT NULL CHECK IN ('sole_trader','company','trust','partnership','smsf','individual'), abn TEXT, acn TEXT, tfn TEXT, parent_entity_id TEXT FK→entities.id NULL, is_consolidated_parent INTEGER DEFAULT 0, financial_year_end TEXT DEFAULT '06-30', reporting_currency TEXT DEFAULT 'AUD', status TEXT DEFAULT 'active' CHECK IN ('active','inactive','dormant'), address TEXT, contact_email TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP + INDEX on user_id + INDEX on parent_entity_id + UNIQUE on user_id,name)

  - `entity_accounts` (id TEXT PK, entity_id TEXT FK→entities.id NOT NULL, account_id TEXT FK→accounts.id NOT NULL, role TEXT NOT NULL DEFAULT 'operating' CHECK IN ('operating','savings','loan','offset','credit_card','investment','trust','super'), ownership_percentage REAL DEFAULT 100.0, linked_at TEXT DEFAULT CURRENT_TIMESTAMP + UNIQUE on entity_id,account_id)

  - `entity_settings` (id TEXT PK, entity_id TEXT FK→entities.id NOT NULL UNIQUE, bas_reporting_frequency TEXT DEFAULT 'quarterly' CHECK IN ('monthly','quarterly','annually'), gst_registered INTEGER DEFAULT 0, gst_method TEXT DEFAULT 'cash' CHECK IN ('cash','accrual'), tax_rate REAL, lodgement_due_dates TEXT, default_depreciation_method TEXT DEFAULT 'diminishing_value', instant_write_off_threshold INTEGER DEFAULT 2000000, chart_of_accounts_template TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)

  - `inter_entity_transactions` (id TEXT PK, user_id TEXT FK→users.id NOT NULL, from_entity_id TEXT FK→entities.id NOT NULL, to_entity_id TEXT FK→entities.id NOT NULL, from_transaction_id TEXT FK→transactions.id NULL, to_transaction_id TEXT FK→transactions.id NULL, amount INTEGER NOT NULL, description TEXT, transaction_date TEXT NOT NULL, transaction_type TEXT NOT NULL CHECK IN ('loan','management_fee','dividend','distribution','rent','service_fee','asset_transfer','capital_contribution'), status TEXT DEFAULT 'pending' CHECK IN ('pending','confirmed','eliminated','disputed'), confirmed_by_from INTEGER DEFAULT 0, confirmed_by_to INTEGER DEFAULT 0, elimination_group_id TEXT, notes TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP + INDEX on from_entity_id + INDEX on to_entity_id + INDEX on status + INDEX on elimination_group_id)

  - `consolidation_rules` (id TEXT PK, user_id TEXT FK→users.id NOT NULL, parent_entity_id TEXT FK→entities.id NOT NULL, rule_name TEXT NOT NULL, rule_type TEXT NOT NULL CHECK IN ('elimination','adjustment','reclassification','minority_interest'), description TEXT, criteria_json TEXT NOT NULL, action_json TEXT NOT NULL, is_active INTEGER DEFAULT 1, priority INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP + INDEX on parent_entity_id)

  - `consolidation_snapshots` (id TEXT PK, user_id TEXT FK→users.id NOT NULL, parent_entity_id TEXT FK→entities.id NOT NULL, financial_year TEXT NOT NULL, snapshot_date TEXT NOT NULL, status TEXT DEFAULT 'draft' CHECK IN ('draft','reviewed','finalized'), total_revenue INTEGER, total_expenses INTEGER, total_assets INTEGER, total_liabilities INTEGER, total_equity INTEGER, eliminations_applied INTEGER DEFAULT 0, adjustments_json TEXT, notes TEXT, created_by TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP + INDEX on parent_entity_id,financial_year + UNIQUE on parent_entity_id,financial_year,snapshot_date)

  - `consolidation_snapshot_lines` (id TEXT PK, snapshot_id TEXT FK→consolidation_snapshots.id NOT NULL, entity_id TEXT FK→entities.id NOT NULL, line_type TEXT NOT NULL CHECK IN ('revenue','expense','asset','liability','equity','elimination','adjustment'), category TEXT NOT NULL, description TEXT, amount INTEGER NOT NULL, is_elimination INTEGER DEFAULT 0, source_rule_id TEXT FK→consolidation_rules.id NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP + INDEX on snapshot_id + INDEX on entity_id)

## Files to MODIFY

### 2. `server/src/schema.ts` (after line 1077, before EOF)
**Current state**: 1077 lines, last content is `NewEconomicDataCacheEntry` type export at line 1077

- [ ] Add 10 new `sqliteTable` definitions matching migration SQL above:
  - `fixedAssets` — all TEXT/INTEGER columns using `text()`, `integer()`, `real()` Drizzle helpers
  - `assetDepreciation` — `integer({mode:'boolean'})` for `isAdjustment`
  - `assetDisposals` — `integer({mode:'boolean'})` for `cgtApplicable`, `cgtDiscountEligible`
  - `entities` — `integer({mode:'boolean'})` for `isConsolidatedParent`
  - `entityAccounts` — `real()` for `ownershipPercentage`
  - `entitySettings` — `integer({mode:'boolean'})` for `gstRegistered`, `integer()` for `instantWriteOffThreshold`
  - `interEntityTransactions` — `integer({mode:'boolean'})` for `confirmedByFrom`, `confirmedByTo`
  - `consolidationRules` — `integer({mode:'boolean'})` for `isActive`
  - `consolidationSnapshots` — all `integer()` for financial totals
  - `consolidationSnapshotLines` — `integer({mode:'boolean'})` for `isElimination`

- [ ] Add type exports after table definitions:
```typescript
// Fixed Assets
export type FixedAsset = typeof fixedAssets.$inferSelect;
export type NewFixedAsset = typeof fixedAssets.$inferInsert;
export type AssetDepreciation = typeof assetDepreciation.$inferSelect;
export type NewAssetDepreciation = typeof assetDepreciation.$inferInsert;
export type AssetDisposal = typeof assetDisposals.$inferSelect;
export type NewAssetDisposal = typeof assetDisposals.$inferInsert;

// Multi-Entity
export type Entity = typeof entities.$inferSelect;
export type NewEntity = typeof entities.$inferInsert;
export type EntityAccount = typeof entityAccounts.$inferSelect;
export type NewEntityAccount = typeof entityAccounts.$inferInsert;
export type EntitySetting = typeof entitySettings.$inferSelect;
export type NewEntitySetting = typeof entitySettings.$inferInsert;
export type InterEntityTransaction = typeof interEntityTransactions.$inferSelect;
export type NewInterEntityTransaction = typeof interEntityTransactions.$inferInsert;

// Consolidation
export type ConsolidationRule = typeof consolidationRules.$inferSelect;
export type NewConsolidationRule = typeof consolidationRules.$inferInsert;
export type ConsolidationSnapshot = typeof consolidationSnapshots.$inferSelect;
export type NewConsolidationSnapshot = typeof consolidationSnapshots.$inferInsert;
export type ConsolidationSnapshotLine = typeof consolidationSnapshotLines.$inferSelect;
export type NewConsolidationSnapshotLine = typeof consolidationSnapshotLines.$inferInsert;
```

### 3. `server/src/db/postgres-schema.ts` (after line 622, before EOF)
**Current state**: 622 lines, last content is `NewEconomicDataCacheEntry` type export at line 622

- [ ] Add 10 new `pgTable` definitions matching the `sqliteTable` definitions but with PostgreSQL-specific types:
  - Use `boolean()` instead of `integer({mode:'boolean'})`
  - Use `timestamp('col', { withTimezone: true })` instead of `text()` for date columns
  - Use `doublePrecision()` or `numeric()` instead of `real()` where appropriate
  - Define indexes in the third argument of `pgTable()` (follow existing pattern at line 203-214)

- [ ] Add matching type exports after table definitions (same as schema.ts list above)

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] Migration SQL is syntactically valid (`docker compose exec postgres psql -U app_user -d ai_accountant -f /docker-entrypoint-initdb.d/0024_fixed_assets_multi_entity.sql`)
- [ ] All 10 new table exports are accessible from both schema files
- [ ] No naming conflicts with existing `export const` declarations in either schema file
- [ ] Create marker file: `.agent-done-W12-01`

## Dependencies
- **None** — can start immediately
- **IMPORTANT**: Only this agent may modify schema.ts and postgres-schema.ts in Wave 12
- **Schema lock**: No other Wave 12 agent should touch schema files
