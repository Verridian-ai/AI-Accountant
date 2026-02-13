# Wave 12 — Fixed Assets & Multi-Entity Consolidation — Orchestration Prompt

You are the **Team Lead** for Wave 12: Fixed Assets & Multi-Entity Consolidation. You coordinate 10 specialized agents to add fixed asset management with depreciation schedules and multi-entity (multi-company) consolidation to GoldLedger.

## Architecture References
- **Master plan**: `docs/wave0-master-plan.md`
- **Existing agents pattern**: `server/src/services/claude/agents/payroll-agent.ts`
- **Base class**: `server/src/services/claude/base-agent.ts` (ClaudeAgent<TInput, TOutput>)
- **Docker stack**: `docker-compose.yml` (5 services: postgres, redis, cognee, server, client)

## Current State (After Wave 11)
- 15 Claude agents (13 + inventory_agent + bank_reconciler_agent)
- Inventory module with COGS tracking operational
- Bank reconciliation with auto-matching and confidence scoring
- 13 migrations (0009–0023) applied

## Dependencies
- **Requires**: Wave 11 complete (inventory for asset linking)
- **Estimated Complexity**: HIGH

## Database Schema Changes

### New Tables (10 tables)
| Table | Columns |
|-------|---------|
| `fixed_assets` | id, userId, entityId, assetName, assetNumber, category (land/building/vehicle/equipment/furniture/computer/intangible), purchaseDate, purchaseCost, residualValue, usefulLifeYears, depreciationMethod (straight_line/diminishing_value/instant_write_off), status (active/disposed/written_off), location, serialNumber, notes |
| `asset_depreciation` | id, assetId, periodStart, periodEnd, depreciationAmount, accumulatedDepreciation, writtenDownValue, method, rate |
| `asset_disposals` | id, assetId, disposalDate, disposalAmount, writtenDownValueAtDisposal, gainLoss, disposalMethod (sale/scrap/trade_in), buyerName, notes |
| `entities` | id, userId, entityName, entityType (sole_trader/company/trust/partnership/smsf), abn, acn, tfn, registeredAddress, isActive, parentEntityId |
| `entity_accounts` | id, entityId, accountId, isPrimary |
| `entity_settings` | id, entityId, financialYearEnd, basReportingPeriod, gstRegistered, taxRate, defaultCurrency |
| `inter_entity_transactions` | id, fromEntityId, toEntityId, transactionDate, amount, description, category, status (pending/confirmed/eliminated), eliminatedInConsolidation |
| `consolidation_rules` | id, userId, parentEntityId, ruleType (elimination/adjustment/reclassification), description, sourceAccountCode, targetAccountCode, adjustmentAmount, isActive |
| `consolidation_snapshots` | id, userId, parentEntityId, periodEnd, status (draft/final), consolidatedProfitLoss, consolidatedNetAssets, generatedAt |
| `consolidation_snapshot_lines` | id, snapshotId, entityId, accountCode, entityAmount, eliminationAmount, consolidatedAmount |

**Migration**: `docker/migrations/0024_fixed_assets_multi_entity.sql`

## API Endpoints (24 endpoints)
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/assets | List fixed assets |
| POST | /api/assets | Register new asset |
| GET | /api/assets/:id | Get asset detail with depreciation history |
| PATCH | /api/assets/:id | Update asset |
| POST | /api/assets/:id/depreciate | Run depreciation for period |
| POST | /api/assets/depreciate-all | Batch depreciation run |
| POST | /api/assets/:id/dispose | Record disposal |
| GET | /api/assets/register | Asset register report |
| GET | /api/assets/depreciation-schedule | Depreciation schedule report |
| GET | /api/entities | List entities |
| POST | /api/entities | Create entity |
| GET | /api/entities/:id | Get entity detail |
| PATCH | /api/entities/:id | Update entity |
| POST | /api/entities/:id/accounts | Link account to entity |
| DELETE | /api/entities/:id/accounts/:accountId | Unlink account |
| GET | /api/entities/:id/settings | Get entity settings |
| PATCH | /api/entities/:id/settings | Update entity settings |
| GET | /api/inter-entity | List inter-entity transactions |
| POST | /api/inter-entity | Record inter-entity transaction |
| POST | /api/inter-entity/:id/confirm | Confirm transaction |
| GET | /api/consolidation/:parentId | Generate consolidation report |
| POST | /api/consolidation/:parentId/snapshot | Create consolidation snapshot |
| GET | /api/consolidation/rules | List consolidation rules |
| POST | /api/consolidation/rules | Create consolidation rule |

## UI Components
### `client/src/features/assets/` — New feature folder
- AssetDashboard.tsx — Asset register with depreciation summary
- AssetRegister.tsx — Filterable/sortable asset list
- AssetForm.tsx — Create/edit asset with depreciation method selector
- DepreciationSchedule.tsx — Depreciation timeline chart
- AssetDisposal.tsx — Record asset disposal with gain/loss calculation
- AssetCategories.tsx — Category breakdown pie chart

### `client/src/features/entities/` — New feature folder
- EntityManager.tsx — Entity CRUD with hierarchy tree
- EntityDetail.tsx — Entity settings and linked accounts
- InterEntityTransactions.tsx — Inter-entity transaction log
- ConsolidationReport.tsx — Consolidated P&L and balance sheet
- ConsolidationWizard.tsx — Step-by-step consolidation process
- EntitySwitcher.tsx — Global entity context switcher (header component)

**Navigation**: Add `assets` and `entities` to TabId type

## New Claude Agents (2)
1. **`asset_management_agent`** — Calculates depreciation (straight-line, diminishing value, instant write-off <$20k), suggests optimal depreciation methods, flags end-of-life assets. Tools: `calculate_depreciation`, `suggest_depreciation_method`, `check_write_off_eligibility`, `generate_asset_report`.
2. **`multi_entity_agent`** — Routes queries to correct entity context, manages inter-entity eliminations, generates consolidated reports. Tools: `identify_entity_context`, `find_inter_entity_transactions`, `calculate_eliminations`, `generate_consolidation`.

## Cognee Integration
- **New datasets**: `asset_register`, `depreciation_schedules`, `entity_hierarchy`, `consolidation_patterns`
- Index assets for "What's the written-down value of our vehicles?"
- Index depreciation for "How much depreciation can I claim this FY?"
- Index entity hierarchy for "Show me consolidated P&L for the group"
- Use `GRAPH_COMPLETION` for cross-entity reasoning

## Testing Criteria
- [ ] Asset CRUD with depreciation method selection
- [ ] Straight-line depreciation calculation matches formula: (cost - residual) / useful_life
- [ ] Diminishing value: rate = 1 - (residual/cost)^(1/life), applied to WDV
- [ ] Instant write-off for assets under $20,000
- [ ] Asset disposal calculates correct gain/loss
- [ ] Entity hierarchy: parent-child relationships
- [ ] Inter-entity transactions flagged for elimination
- [ ] Consolidation eliminates inter-entity balances
- [ ] Entity switcher changes global context
- [ ] Chat answers "Calculate depreciation for my office equipment"
- [ ] `cd server && npx tsc --noEmit` passes clean

## Debate Findings Applied (D01–D05)

| Finding | Source | Resolution |
|---------|--------|------------|
| **CRITICAL: TFN stored in plaintext** — violates ATO TFN guidelines (Taxation Administration Act 1953 §8WA) | D02 CRIT-04 | MANDATORY: `entities.tfn` column MUST be encrypted at rest using AES-256-GCM before storage. Display must be masked as `***-***-XXX` (last 3 digits only). Access to TFN must be logged in audit trail. Create a helper function `encryptTFN(plaintext)` / `decryptTFN(ciphertext)` using a `TFN_ENCRYPTION_KEY` environment variable |
| Instant write-off threshold must be configurable, not hardcoded | D02 ATO-05 | The $20,000 threshold should be stored in a `ato_thresholds` config table (or JSON file) with effective date ranges, not hardcoded. Asset agent should load threshold dynamically based on asset purchase date and entity's eligible business size |
| Entity queries must include userId WHERE clause | D02 ISO-02 | All entity queries MUST include `WHERE userId = ?` — add RLS note for future Wave 23 PostgreSQL Row-Level Security |
| Consolidation endpoints must validate parent-child ownership chain | D02 ISO-02 | `GET /api/consolidation/:parentId` must verify requesting user owns the parent entity and all child entities before returning data |
| Entity context is a cross-cutting concern | D04 §2 D04-ISSUE-D04 | Entity context should be designed as middleware pattern (extracted from JWT or context header), not per-feature code. Create `entityContextMiddleware` that subsequent waves can reuse |
| Dual schema rule reminder | D04 S02 | ENFORCED: Every table in BOTH schema.ts AND postgres-schema.ts |
| POST /api/assets/depreciate-all should be async | D03 §Wave12 | IMPORTANT: Batch depreciation processes all active assets — return jobId, process in background |

## Team Structure — 10 Agents

### Agent 1: asset-schema-builder [PRIORITY: WAVE 1]
**Role**: Create fixed asset and entity tables + migration SQL
**Task file**: `wave12-agent-tasks/01-asset-schema-builder.md`
**Dependencies**: None

### Agent 2: asset-service-builder [PRIORITY: WAVE 1]
**Role**: Build depreciation engine and asset register service
**Task file**: `wave12-agent-tasks/02-asset-service-builder.md`
**Creates**: server/src/services/fixed-assets.ts
**Dependencies**: None

### Agent 3: entity-service-builder [PRIORITY: WAVE 1]
**Role**: Build multi-entity management and consolidation engine
**Task file**: `wave12-agent-tasks/03-entity-service-builder.md`
**Creates**: server/src/services/multi-entity.ts, server/src/services/consolidation.ts
**Dependencies**: None

### Agent 4: asset-agent-builder [DEPENDS ON: Agent 2]
**Role**: Create asset_management_agent
**Task file**: `wave12-agent-tasks/04-asset-agent-builder.md`
**Creates**: server/src/services/claude/agents/asset-management-agent.ts
**Dependencies**: Agent 2

### Agent 5: entity-agent-builder [DEPENDS ON: Agent 3]
**Role**: Create multi_entity_agent
**Task file**: `wave12-agent-tasks/05-entity-agent-builder.md`
**Creates**: server/src/services/claude/agents/multi-entity-agent.ts
**Dependencies**: Agent 3

### Agent 6: cognee-datasets-builder [DEPENDS ON: Agent 1]
**Role**: Configure Cognee datasets for assets and entities
**Task file**: `wave12-agent-tasks/06-cognee-datasets-builder.md`
**Dependencies**: Schema must exist

### Agent 7: api-endpoints-builder [DEPENDS ON: Agents 2, 3, 4, 5]
**Role**: Wire 24 new API routes
**Task file**: `wave12-agent-tasks/07-api-endpoints-builder.md`
**Dependencies**: All backend services

### Agent 8: ui-assets-builder [DEPENDS ON: Agent 7]
**Role**: Build asset management UI
**Task file**: `wave12-agent-tasks/08-ui-assets-builder.md`
**Dependencies**: API routes

### Agent 9: ui-entities-builder [DEPENDS ON: Agent 7]
**Role**: Build entity management and consolidation UI
**Task file**: `wave12-agent-tasks/09-ui-entities-builder.md`
**Dependencies**: API routes

### Agent 10: testing-validation-agent [DEPENDS ON: All]
**Role**: Run verification and documentation
**Task file**: `wave12-agent-tasks/10-testing-validation-agent.md`
**Dependencies**: All agents

## Execution Priority Order

```
Sub-wave 1 (Parallel): Agent 1 + Agent 2 + Agent 3
Sub-wave 2 (After 1):  Agent 4 + Agent 5 + Agent 6
Sub-wave 3 (After 2):  Agent 7
Sub-wave 4 (After 3):  Agent 8 + Agent 9
Sub-wave 5 (After 4):  Agent 10
```

## START THE TEAM NOW

Spawn all 10 teammates and begin coordinating their work. Read each agent's task file from `wave12-agent-tasks/`.
