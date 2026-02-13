# Agent 10: Testing & Validation Agent

## Role
Verify that all Wave 11 deliverables compile, all 22 API endpoints respond, both new Claude agents instantiate correctly, all UI components render, and all schema/type changes are consistent.

## Priority: WAVE 11 (LAST — After All Other Agents Complete)

## Verification Tasks

### 1. TypeScript Compilation — Server
- [ ] Run `cd /mnt/c/Users/Danie/Desktop/CBA\ Statements\ Parse/server && npx tsc --noEmit`
- [ ] If errors found, document each error with file path, line number, and error message
- [ ] Fix any type errors introduced by Wave 11 changes:
  - Missing imports in schema.ts, index.ts
  - AgentType union mismatch between types.ts and config.ts
  - Missing properties in I/O interfaces
  - Import path issues (.js extensions required for ESM)

### 2. TypeScript Compilation — Client
- [ ] Run `cd /mnt/c/Users/Danie/Desktop/CBA\ Statements\ Parse/client && npx tsc --noEmit`
- [ ] If errors found, fix type errors in:
  - api.ts (inventoryApi, reconApi methods)
  - App.tsx (TabId union, missing imports)
  - BottomNavigation.tsx (TabId union)
  - New component files (missing prop types, incorrect imports)

### 3. Schema Consistency Check
- [ ] Verify `server/src/schema.ts` has all 7 new sqliteTable definitions:
  - `inventoryItems`
  - `warehouses`
  - `inventoryStock`
  - `inventoryMovements`
  - `bankReconRules`
  - `bankReconSessions`
  - `bankReconMatches`
- [ ] Verify all 14 type exports exist (7 select types + 7 insert types)
- [ ] Verify `server/src/db/postgres-schema.ts` has matching pgTable definitions
- [ ] Verify `docker/migrations/0023_inventory_bank_recon.sql` exists and contains valid SQL
- [ ] Verify migration SQL matches schema.ts column definitions exactly (column names, types, defaults)

### 4. Service Instantiation Check
- [ ] Verify `server/src/services/inventory.ts` exports `inventoryService` singleton
- [ ] Verify `server/src/services/bank-reconciliation.ts` exports `bankReconciliationService` singleton
- [ ] Verify `inventoryService` has all expected methods:
  - createItem, updateItem, getItem, listItems, deactivateItem
  - createWarehouse, listWarehouses, getDefaultWarehouse
  - adjustStock, transferStock, getStockLevels
  - calculateCOGS, recalculateWeightedAverage
  - getMovementHistory, getValuationReport

- [ ] Verify `bankReconciliationService` has all expected methods:
  - startSession, getSession, listSessions, completeSession, abandonSession
  - autoMatch, suggestMatches
  - confirmMatch, rejectMatch, undoMatch, createManualMatch
  - getMatchRules, createMatchRule, updateMatchRule, deleteMatchRule, seedDefaultRules

### 5. Claude Agent Validation
- [ ] Verify `server/src/services/claude/agents/inventory-agent.ts` exists and exports InventoryAgent class
- [ ] Verify `server/src/services/claude/agents/bank-reconciler-agent.ts` exists and exports BankReconcilerAgent class
- [ ] Verify `types.ts` AgentType union includes `'inventory_agent'` and `'bank_reconciler_agent'`
- [ ] Verify `config.ts` AGENT_TOKEN_BUDGETS has entries for both new agents
- [ ] Verify `config.ts` AGENT_MODELS has entries for both new agents:
  - `inventory_agent` -> `'claude-haiku-4-5-20251001'`
  - `bank_reconciler_agent` -> Sonnet model

### 6. Cognee Datasets Validation
- [ ] Verify `cognee-tools.ts` COGNEE_DATASETS has 3 new entries:
  - `inventoryCatalog: 'inventory_catalog'`
  - `stockMovements: 'stock_movements'`
  - `reconPatterns: 'recon_patterns'`
- [ ] Verify CogneeTools class has new methods:
  - `indexInventoryItems`, `searchInventoryCatalog`
  - `indexStockMovements`, `searchStockPatterns`
  - `indexReconPatterns`, `searchReconPatterns`

### 7. API Endpoint Registration (22 endpoints)
- [ ] Verify `server/src/index.ts` imports `inventoryService` and `bankReconciliationService`
- [ ] Verify 12 inventory endpoints are registered:
  1. `GET /api/inventory/items`
  2. `POST /api/inventory/items`
  3. `GET /api/inventory/items/:id`
  4. `PUT /api/inventory/items/:id`
  5. `DELETE /api/inventory/items/:id`
  6. `POST /api/inventory/items/:id/adjust`
  7. `POST /api/inventory/items/:id/transfer`
  8. `GET /api/inventory/stock`
  9. `GET /api/inventory/movements`
  10. `GET /api/inventory/warehouses`
  11. `POST /api/inventory/warehouses`
  12. `GET /api/inventory/valuation`
- [ ] Verify 10 reconciliation endpoints are registered:
  1. `GET /api/recon/sessions`
  2. `POST /api/recon/sessions`
  3. `GET /api/recon/sessions/:id`
  4. `POST /api/recon/sessions/:id/auto-match`
  5. `POST /api/recon/sessions/:id/complete`
  6. `POST /api/recon/matches/:id/confirm`
  7. `POST /api/recon/matches/:id/undo`
  8. `POST /api/recon/matches/manual`
  9. `GET /api/recon/rules`
  10. `POST /api/recon/rules`
- [ ] All endpoints use authMiddleware

### 8. UI Component Validation
- [ ] Verify 7 inventory component files exist:
  1. `client/src/features/inventory/components/InventoryDashboard.tsx`
  2. `client/src/features/inventory/components/InventoryItemList.tsx`
  3. `client/src/features/inventory/components/StockLevelPanel.tsx`
  4. `client/src/features/inventory/components/MovementHistory.tsx`
  5. `client/src/features/inventory/components/WarehouseManager.tsx`
  6. `client/src/features/inventory/components/ValuationReport.tsx`
  7. `client/src/features/inventory/components/COGSCalculator.tsx`
- [ ] Verify 5 reconciliation component files exist:
  1. `client/src/features/reconciliation/components/ReconDashboard.tsx`
  2. `client/src/features/reconciliation/components/ReconMatchingWorkspace.tsx`
  3. `client/src/features/reconciliation/components/ReconMatchSuggestions.tsx`
  4. `client/src/features/reconciliation/components/ReconRulesManager.tsx`
  5. `client/src/features/reconciliation/components/ReconSummaryCard.tsx`
- [ ] Verify `api.ts` has both `inventoryApi` and `reconApi` objects
- [ ] Verify `App.tsx` activeTab union includes `'inventory'` and `'recon'`
- [ ] Verify `BottomNavigation.tsx` TabId includes `'inventory'` and `'recon'`

### 9. Cross-Agent Integration Check
- [ ] Verify inventory-agent.ts imports from inventory.ts (not circular)
- [ ] Verify bank-reconciler-agent.ts imports from bank-reconciliation.ts (not circular)
- [ ] Verify both agents import from cognee-tools.ts using the new COGNEE_DATASETS entries
- [ ] Verify index.ts schema import includes all 7 new table names
- [ ] Verify no duplicate route paths in index.ts

### 10. Fix Any Issues Found
- [ ] For each issue found in steps 1-9, apply the minimal fix
- [ ] Re-run `tsc --noEmit` for both server and client after fixes
- [ ] Document all fixes applied in a summary

## Files to MODIFY (Only if fixes needed)
- `server/src/schema.ts` — Missing type exports or table definitions
- `server/src/db/postgres-schema.ts` — Missing pgTable definitions
- `server/src/services/claude/types.ts` — AgentType union gaps
- `server/src/services/claude/config.ts` — Missing token budget/model entries
- `server/src/index.ts` — Missing imports or route registrations
- `client/src/api.ts` — Missing or incorrect API methods
- `client/src/App.tsx` — Missing tab entries or imports
- `client/src/components/layout/BottomNavigation.tsx` — TabId union
- Any component files with type errors

## Verification
- [ ] `cd server && npx tsc --noEmit` passes with ZERO new errors
- [ ] `cd client && npx tsc --noEmit` passes with ZERO new errors
- [ ] All 7 schema tables verified
- [ ] All 22 API endpoints verified
- [ ] Both Claude agents verified
- [ ] All 3 Cognee datasets verified
- [ ] All 12 UI components verified
- [ ] Create marker file: `.agent-done-W11-10`

## Dependencies
- **ALL agents (1-9)** must complete before this agent runs
- This is the final validation gate for Wave 11
