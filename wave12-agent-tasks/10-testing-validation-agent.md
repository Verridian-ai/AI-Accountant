# Agent 10: Testing & Validation Agent

## Role
Run the full verification plan for Wave 12: validate depreciation math, consolidation eliminations, dual schema consistency, API routes, and frontend compilation.

## Priority: WAVE 5 (After ALL agents complete)

## Wait Condition
Check for ALL marker files: `.agent-done-W12-01` through `.agent-done-W12-09` before starting.

## Verification Tasks

### 1. Compilation Checks
- [ ] **Server TypeScript**: Run `cd server && npx tsc --noEmit` (zero new errors)
- [ ] **Client TypeScript**: Run `cd client && npx tsc --noEmit` (zero new errors)
- [ ] **Docker config**: Run `docker compose config` (validates without errors)

### 2. Schema Consistency
- [ ] **Migration SQL**: Verify `docker/migrations/0024_fixed_assets_multi_entity.sql` is syntactically valid:
  ```bash
  docker compose exec postgres psql -U app_user -d ai_accountant -f /docker-entrypoint-initdb.d/0024_fixed_assets_multi_entity.sql
  ```
- [ ] **10 new tables exist**: Verify via `\dt` in psql:
  - `fixed_assets`, `asset_depreciation`, `asset_disposals`
  - `entities`, `entity_accounts`, `entity_settings`
  - `inter_entity_transactions`, `consolidation_rules`, `consolidation_snapshots`, `consolidation_snapshot_lines`
- [ ] **Dual schema alignment**: Compare `server/src/schema.ts` sqliteTable definitions against `server/src/db/postgres-schema.ts` pgTable definitions — all 10 tables must have matching columns (names, types, constraints)
- [ ] **Type exports**: Verify all 20 type exports (10 Select + 10 Insert) are accessible:
  ```typescript
  import { FixedAsset, NewFixedAsset, AssetDepreciation, NewAssetDepreciation, AssetDisposal, NewAssetDisposal, Entity, NewEntity, EntityAccount, NewEntityAccount, EntitySetting, NewEntitySetting, InterEntityTransaction, NewInterEntityTransaction, ConsolidationRule, NewConsolidationRule, ConsolidationSnapshot, NewConsolidationSnapshot, ConsolidationSnapshotLine, NewConsolidationSnapshotLine } from './schema.js';
  ```

### 3. Depreciation Math Validation
- [ ] **Straight Line**: Test $50,000 asset (5,000,000 cents), 5yr useful life, $5,000 residual (500,000 cents):
  - Expected: ($5,000,000 - $500,000) / 60 months * 12 = $900,000/year = $9,000.00/year
  ```bash
  curl -X POST localhost:3501/api/assets -H 'Content-Type: application/json' -d '{"userId":"test","assetName":"Test SL Asset","category":"office_equipment","purchaseDate":"2024-07-01","purchasePrice":5000000,"residualValue":500000,"depreciationMethod":"straight_line","usefulLifeMonths":60}'
  curl -X POST localhost:3501/api/assets/[ASSET_ID]/depreciation/2024-25
  # Verify depreciationAmount = 900000
  ```

- [ ] **Diminishing Value**: Test $50,000 asset (5,000,000 cents), 5yr effective life:
  - DV rate = 200% / 5 = 40%
  - Year 1 (full year): $5,000,000 * 0.40 = $2,000,000 ($20,000.00)
  ```bash
  curl -X POST localhost:3501/api/assets -H 'Content-Type: application/json' -d '{"userId":"test","assetName":"Test DV Asset","category":"computer_equipment","purchaseDate":"2024-07-01","purchasePrice":5000000,"depreciationMethod":"diminishing_value","effectiveLifeYears":5}'
  curl -X POST localhost:3501/api/assets/[ASSET_ID]/depreciation/2024-25
  # Verify depreciationAmount = 2000000
  ```

- [ ] **Instant Write-Off**: Test $15,000 asset (1,500,000 cents) for SBE:
  - Expected: Full $1,500,000 deduction in purchase year
  ```bash
  curl -X POST localhost:3501/api/assets -H 'Content-Type: application/json' -d '{"userId":"test","assetName":"Test WriteOff","category":"computer_equipment","purchaseDate":"2024-09-15","purchasePrice":1500000,"depreciationMethod":"instant_write_off"}'
  curl -X POST localhost:3501/api/assets/[ASSET_ID]/depreciation/2024-25
  # Verify depreciationAmount = 1500000
  ```

- [ ] **Pro-rata (Part Year)**: Test asset purchased January 1 (halfway through FY):
  - Days from Jan 1 to Jun 30 = 181 days
  - SL: ($5,000,000 - $500,000) / 5 * (181/365) = $446,027 (approximately)
  ```bash
  curl -X POST localhost:3501/api/assets -H 'Content-Type: application/json' -d '{"userId":"test","assetName":"Test ProRata","category":"office_equipment","purchaseDate":"2025-01-01","purchasePrice":5000000,"residualValue":500000,"depreciationMethod":"straight_line","usefulLifeMonths":60}'
  curl -X POST localhost:3501/api/assets/[ASSET_ID]/depreciation/2024-25
  # Verify depreciationAmount is approximately 446027 (within 1% tolerance)
  ```

- [ ] **Disposal Profit/Loss**: Test disposal of asset with WDV $1,000,000, sold for $1,500,000:
  - Expected profit = $1,500,000 - $1,000,000 = $500,000
  ```bash
  curl -X POST localhost:3501/api/assets/[ASSET_ID]/dispose -H 'Content-Type: application/json' -d '{"disposalDate":"2025-03-15","disposalMethod":"sale","proceeds":1500000}'
  # Verify profitLoss = 500000 (positive = profit)
  ```

### 4. Multi-Entity Validation
- [ ] **Create Entities**: Create parent company + child trust + child sole trader
  ```bash
  curl -X POST localhost:3501/api/entities -H 'Content-Type: application/json' -d '{"userId":"test","name":"Test Holdings Pty Ltd","entityType":"company","isConsolidatedParent":true}'
  curl -X POST localhost:3501/api/entities -H 'Content-Type: application/json' -d '{"userId":"test","name":"Test Family Trust","entityType":"trust","parentEntityId":"[PARENT_ID]"}'
  curl -X POST localhost:3501/api/entities -H 'Content-Type: application/json' -d '{"userId":"test","name":"Test Sole Trader","entityType":"sole_trader","parentEntityId":"[PARENT_ID]"}'
  ```

- [ ] **Entity Hierarchy**: Verify parent-child nesting
  ```bash
  curl localhost:3501/api/entities?userId=test
  # Verify rootEntities contains parent, children array has 2 entries
  ```

- [ ] **Link Accounts**: Link existing accounts to entities
  ```bash
  curl -X POST localhost:3501/api/entities/[ENTITY_ID]/accounts -H 'Content-Type: application/json' -d '{"accountId":"[ACCOUNT_ID]","role":"operating"}'
  ```

- [ ] **Inter-Entity Transaction**: Record and confirm a management fee
  ```bash
  curl -X POST localhost:3501/api/entities/inter-entity-transactions -H 'Content-Type: application/json' -d '{"userId":"test","fromEntityId":"[TRUST_ID]","toEntityId":"[COMPANY_ID]","amount":1000000,"description":"Monthly management fee","transactionDate":"2025-01-15","transactionType":"management_fee"}'
  # Status should be 'pending'
  curl -X PATCH localhost:3501/api/entities/inter-entity-transactions/[TX_ID]/confirm -H 'Content-Type: application/json' -d '{"entityId":"[TRUST_ID]","confirmed":true}'
  curl -X PATCH localhost:3501/api/entities/inter-entity-transactions/[TX_ID]/confirm -H 'Content-Type: application/json' -d '{"entityId":"[COMPANY_ID]","confirmed":true}'
  # Status should now be 'confirmed'
  ```

### 5. Consolidation Elimination Validation
- [ ] **Generate Consolidation**: With confirmed inter-entity management fee of $10,000:
  ```bash
  curl -X POST localhost:3501/api/consolidation/generate -H 'Content-Type: application/json' -d '{"userId":"test","parentEntityId":"[PARENT_ID]","financialYear":"2024-25"}'
  ```
  - Verify: Company shows $10,000 management fee revenue
  - Verify: Trust shows $10,000 management fee expense
  - Verify: Elimination entry removes $10,000 from both sides
  - Verify: Consolidated net impact = $0 for management fee
  - Verify: Snapshot status = 'draft'

- [ ] **Finalize Snapshot**:
  ```bash
  curl -X POST localhost:3501/api/consolidation/snapshots/[SNAPSHOT_ID]/finalize
  # Verify status = 'finalized'
  ```

### 6. Agent Registration Validation
- [ ] Verify 2 new agents in `types.ts`: `asset_management`, `multi_entity` in AgentType union
- [ ] Verify 2 entries in `config.ts` AGENT_TOKEN_BUDGETS: asset_management (50K), multi_entity (100K)
- [ ] Verify 2 entries in AGENT_MODELS: asset_management (Haiku), multi_entity (Sonnet)
- [ ] Verify agent files exist: `agents/asset-management-agent.ts`, `agents/multi-entity-agent.ts`

### 7. Cognee Dataset Validation
- [ ] Verify COGNEE_DATASETS has 4 new entries: assetRegister, depreciationSchedules, entityHierarchy, consolidationPatterns
- [ ] Verify 4 indexing helpers: indexAssetRegister, indexDepreciationSchedule, indexEntityHierarchy, indexConsolidationPatterns
- [ ] Verify 4 search helpers: searchAssetRegister, searchDepreciationSchedules, searchEntityHierarchy, searchConsolidationPatterns

### 8. Frontend Validation
- [ ] Navigate to Assets tab — AssetsDashboard renders
- [ ] Navigate to Entities tab — EntitiesDashboard renders
- [ ] Verify 12 new components exist:
  - `client/src/features/assets/components/`: AssetsDashboard, AssetRegisterTable, DepreciationScheduleView, AssetDisposalForm, RegisterAssetForm, AssetSummaryCards
  - `client/src/features/entities/components/`: EntitiesDashboard, EntityHierarchyView, CreateEntityForm, InterEntityTransactionsView, ConsolidationView, EntitySettingsPanel
- [ ] Verify `api.ts` has: assetApi (8 methods), entityApi (11 methods), consolidationApi (4 methods)
- [ ] Styling matches existing neumorphic dark theme with gold (#FFCC00) accents

### 9. API Route Validation
- [ ] Verify 24 routes respond (no 404s):
  - 8 asset routes: POST /api/assets, GET /api/assets, GET /api/assets/:id, PATCH /api/assets/:id, POST /api/assets/:id/depreciation/:year, POST /api/assets/depreciation/batch/:year, POST /api/assets/:id/dispose, GET /api/assets/schedule/:year
  - 8 entity routes: POST /api/entities, GET /api/entities, GET /api/entities/:id, PATCH /api/entities/:id, PATCH /api/entities/:id/settings, POST /api/entities/:id/accounts, DELETE /api/entities/:id/accounts/:accountId, POST /api/entities/inter-entity-transactions
  - 2 inter-entity routes: GET /api/entities/inter-entity-transactions, PATCH /api/entities/inter-entity-transactions/:id/confirm
  - 6 consolidation routes: POST /api/consolidation/generate, GET /api/consolidation/snapshots, GET /api/consolidation/snapshots/:id, POST /api/consolidation/snapshots/:id/finalize, POST /api/consolidation/rules, GET /api/consolidation/rules

### 10. Generate Verification Report
```
GOLDLEDGER WAVE 12 VERIFICATION REPORT
=======================================
Date: [timestamp]
Wave: 12 — Fixed Assets & Multi-Entity Consolidation

Schema:           [PASS/FAIL] - [details: 10 tables, dual schema alignment]
Depreciation:     [PASS/FAIL] - [details: SL, DV, write-off, pro-rata, disposal]
Entities:         [PASS/FAIL] - [details: hierarchy, account linking, settings]
Inter-Entity:     [PASS/FAIL] - [details: recording, confirmation, dispute]
Consolidation:    [PASS/FAIL] - [details: generation, eliminations, finalization]
Agents:           [PASS/FAIL] - [details: 2 new agents, types, config]
Cognee:           [PASS/FAIL] - [details: 4 datasets, indexing, search helpers]
API Routes:       [PASS/FAIL] - [details: 24 routes, no 404s, correct methods]
Frontend:         [PASS/FAIL] - [details: 12 components, 2 new tabs, styling]
Build:            [PASS/FAIL] - [details: server tsc, client tsc, docker config]
```

- [ ] Create marker file: `.agent-done-W12-10`

## Dependencies
- **Requires**: ALL agents (`.agent-done-W12-01` through `.agent-done-W12-09`)
- **Docker must be running**: `docker compose up -d`
- **Test data cleanup**: After validation, optionally clean up test entities and assets
