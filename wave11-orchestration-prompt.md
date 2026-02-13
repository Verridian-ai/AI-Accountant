# Wave 11 — Inventory & Bank Reconciliation — Orchestration Prompt

You are the **Team Lead** for Wave 11: Inventory & Bank Reconciliation. You coordinate 10 specialized agents to add inventory management with COGS tracking and an enhanced bank reconciliation engine to GoldLedger.

## Architecture References
- **Master plan**: `docs/wave0-master-plan.md`
- **Implementation plan**: `docs/Agent planning chat.md` (Wave 11, lines 1288–1314)
- **Existing agents pattern**: `server/src/services/claude/agents/payroll-agent.ts`
- **Base class**: `server/src/services/claude/base-agent.ts` (ClaudeAgent<TInput, TOutput>)
- **Docker stack**: `docker-compose.yml` (5 services: postgres, redis, cognee, server, client)

## Current State (After Wave 10)
- 13 Claude agents (11 original + invoice_agent + accounts_payable_agent)
- SQLite + PostgreSQL dual schema synchronized
- AP module with suppliers, bills, purchase orders operational
- Cognee datasets: supplier_profiles, bill_patterns, ar_aging_patterns, invoice_patterns
- 12 migrations (0009–0022) applied

## Dependencies
- **Requires**: Wave 10 complete (AP and PO module for bill-to-inventory linking)
- **Estimated Complexity**: HIGH

## Database Schema Changes

### New Tables (7 tables)
| Table | Columns |
|-------|---------|
| `inventory_items` | id, userId, sku, name, description, category, costPrice, sellPrice, taxCode, trackInventory, isActive |
| `inventory_stock` | id, itemId, warehouseId, quantityOnHand, reorderPoint, reorderQuantity |
| `inventory_movements` | id, itemId, movementType (purchase/sale/adjustment/transfer), quantity, unitCost, reference, date, notes |
| `warehouses` | id, userId, name, address, isDefault |
| `bank_recon_rules` | id, userId, accountId, matchType (exact/contains/regex), pattern, targetCategory, targetGstCode, autoApply, priority |
| `bank_recon_sessions` | id, userId, accountId, statementId, status (in_progress/completed), matchedCount, unmatchedCount, startedAt, completedAt |
| `bank_recon_matches` | id, sessionId, transactionId, matchedEntityType (invoice/bill/transfer/manual), matchedEntityId, confidence, matchMethod (auto/suggested/manual), createdAt |

**Migration**: `docker/migrations/0023_inventory_bank_recon.sql`

## API Endpoints (22 endpoints)
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/inventory/items | List inventory items |
| POST | /api/inventory/items | Create item |
| GET | /api/inventory/items/:id | Get item detail |
| PATCH | /api/inventory/items/:id | Update item |
| GET | /api/inventory/stock | Stock levels summary |
| GET | /api/inventory/stock/:itemId | Stock for item across warehouses |
| POST | /api/inventory/stock/adjust | Stock adjustment |
| GET | /api/inventory/movements/:itemId | Movement history |
| GET | /api/inventory/warehouses | List warehouses |
| POST | /api/inventory/warehouses | Create warehouse |
| POST | /api/inventory/stock/transfer | Warehouse transfer |
| GET | /api/inventory/valuation | COGS / inventory valuation report |
| GET | /api/recon/sessions | List recon sessions |
| POST | /api/recon/sessions | Start recon session |
| GET | /api/recon/sessions/:id | Get session detail with matches |
| POST | /api/recon/sessions/:id/auto-match | Run auto-matching |
| POST | /api/recon/sessions/:id/match | Confirm a match |
| POST | /api/recon/sessions/:id/unmatch | Undo a match |
| POST | /api/recon/sessions/:id/complete | Complete session |
| GET | /api/recon/rules | List matching rules |
| POST | /api/recon/rules | Create matching rule |
| PATCH | /api/recon/rules/:id | Update rule |

## UI Components
### `client/src/features/inventory/` — New feature folder
- InventoryDashboard.tsx — Main inventory hub with tabs (Items, Stock, Movements, Warehouses)
- ItemList.tsx — Searchable item catalog with stock levels
- ItemDetail.tsx — Item profile with movement history chart
- ItemForm.tsx — Create/edit inventory item
- StockAdjustment.tsx — Manual stock adjustments with reason codes
- WarehouseManager.tsx — Warehouse CRUD and stock transfer
- InventoryValuation.tsx — COGS and valuation report (weighted average)

### `client/src/features/reconciliation/` — New feature folder
- ReconciliationWorkspace.tsx — Side-by-side bank statement vs ledger
- ReconciliationSession.tsx — Session management (start, resume, complete)
- MatchSuggestions.tsx — AI-suggested matches with confidence scores
- ReconciliationRules.tsx — Auto-matching rule configuration
- ReconciliationSummary.tsx — Session completion summary and discrepancy report

**Navigation**: Add `inventory` and `reconciliation` to TabId type in BottomNavigation.tsx

## New Claude Agents (2)
1. **`inventory_agent`** — Tracks stock, calculates COGS (weighted average), generates reorder suggestions. Tools: `check_stock_levels`, `calculate_cogs`, `suggest_reorder`, `search_inventory_context`.
2. **`bank_reconciler_agent`** — Enhanced version of existing `account_reconciler`. Runs auto-matching with confidence scoring across invoices, bills, and transfers. Tools: `find_matches`, `score_match_confidence`, `apply_matching_rules`, `search_recon_patterns`.

## Cognee Integration
- **New datasets**: `inventory_catalog`, `stock_movements`, `recon_patterns`
- Index items for "What's my stock level for Widget X?"
- Index movements for COGS calculation queries
- Index recon patterns for "Which transactions don't match?"
- Use `GRAPH_COMPLETION` for multi-entity matching reasoning

## Testing Criteria
- [ ] Item CRUD lifecycle with stock tracking
- [ ] Stock adjustment updates quantityOnHand correctly
- [ ] COGS calculated using weighted average method
- [ ] Warehouse transfer: decrements source, increments destination
- [ ] Auto-match identifies exact amount + date matches
- [ ] Suggested matches have confidence > 70%
- [ ] Manual match overrides auto-match
- [ ] Recon session tracks matched vs unmatched counts accurately
- [ ] Chat answers "What's my inventory value?" via inventory agent
- [ ] Chat answers "Start reconciliation for account X" via recon agent
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `cd client && npx tsc --noEmit` passes clean

## Team Structure — 10 Agents

### Agent 1: inventory-schema-builder [PRIORITY: WAVE 1]
**Role**: Create inventory and warehouse tables in dual schema + migration SQL
**Task file**: `wave11-agent-tasks/01-inventory-schema-builder.md`
**Creates**: docker/migrations/0023_inventory_bank_recon.sql
**Modifies**: server/src/schema.ts, server/src/db/postgres-schema.ts
**Dependencies**: None — can start immediately

### Agent 2: inventory-service-builder [PRIORITY: WAVE 1]
**Role**: Build inventory tracking service with COGS calculation
**Task file**: `wave11-agent-tasks/02-inventory-service-builder.md`
**Creates**: server/src/services/inventory.ts
**Dependencies**: None — can start immediately

### Agent 3: bank-recon-engine-builder [PRIORITY: WAVE 1]
**Role**: Build matching rules engine with auto-match and confidence scoring
**Task file**: `wave11-agent-tasks/03-bank-recon-engine-builder.md`
**Creates**: server/src/services/bank-reconciliation.ts
**Dependencies**: None — can start immediately

### Agent 4: inventory-agent-builder [DEPENDS ON: Agent 2]
**Role**: Create inventory_agent Claude agent
**Task file**: `wave11-agent-tasks/04-inventory-agent-builder.md`
**Creates**: server/src/services/claude/agents/inventory-agent.ts
**Modifies**: server/src/services/claude/types.ts, server/src/services/claude/config.ts
**Dependencies**: Agent 2 must complete inventory service first

### Agent 5: bank-recon-agent-builder [DEPENDS ON: Agent 3]
**Role**: Create bank_reconciler_agent Claude agent
**Task file**: `wave11-agent-tasks/05-bank-recon-agent-builder.md`
**Creates**: server/src/services/claude/agents/bank-reconciler-agent.ts
**Modifies**: server/src/services/claude/types.ts, server/src/services/claude/config.ts
**Dependencies**: Agent 3 must complete recon engine first

### Agent 6: cognee-datasets-builder [DEPENDS ON: Agent 1]
**Role**: Configure Cognee datasets for inventory and reconciliation
**Task file**: `wave11-agent-tasks/06-cognee-datasets-builder.md`
**Modifies**: server/src/services/claude/cognee-tools.ts, server/src/services/cognee_client.ts
**Dependencies**: Schema must exist

### Agent 7: api-endpoints-builder [DEPENDS ON: Agents 2, 3, 4, 5]
**Role**: Wire 22 new API routes in server/src/index.ts
**Task file**: `wave11-agent-tasks/07-api-endpoints-builder.md`
**Modifies**: server/src/index.ts
**Dependencies**: All backend services must exist

### Agent 8: ui-inventory-builder [DEPENDS ON: Agent 7]
**Role**: Build inventory UI components
**Task file**: `wave11-agent-tasks/08-ui-inventory-builder.md`
**Creates**: 7 new .tsx components in client/src/features/inventory/
**Modifies**: client/src/api.ts, client/src/App.tsx
**Dependencies**: API routes must exist

### Agent 9: ui-recon-builder [DEPENDS ON: Agent 7]
**Role**: Build reconciliation UI components
**Task file**: `wave11-agent-tasks/09-ui-recon-builder.md`
**Creates**: 5 new .tsx components in client/src/features/reconciliation/
**Modifies**: client/src/api.ts, client/src/App.tsx, BottomNavigation.tsx
**Dependencies**: API routes must exist

### Agent 10: testing-validation-agent [DEPENDS ON: All]
**Role**: Run verification plan and documentation updates
**Task file**: `wave11-agent-tasks/10-testing-validation-agent.md`
**Dependencies**: All agents must complete

## Coordination Rules

1. **Schema lock**: Only Agent 1 modifies schema.ts and postgres-schema.ts
2. **types.ts lock**: Only Agents 4 and 5 modify types.ts (Agent 4 first, then Agent 5)
3. **index.ts lock**: Only Agent 7 modifies server/src/index.ts
4. **api.ts lock**: Only Agents 8 and 9 modify client/src/api.ts (Agent 8 first, then Agent 9)
5. **Pattern compliance**: All new agents follow payroll-agent.ts pattern
6. **Dual schema**: Every table in BOTH schema.ts AND postgres-schema.ts
7. **Test before done**: `cd server && npx tsc --noEmit` must pass
8. **Marker naming**: Use `.agent-done-W11-{NN}` format (wave-prefixed to avoid collisions with other waves)
9. **Zod validation**: All new API endpoints MUST use Zod schemas for request body validation via `zValidator` middleware (D02-API-01)
10. **Index discipline**: Migration SQL MUST include CREATE INDEX for composite query patterns — at minimum: `inventory_movements(item_id, date)`, `bank_recon_matches(session_id, confidence DESC)` (D03-§2.2)
11. **Pagination standard**: All list endpoints MUST support `?page=1&limit=50` pagination pattern, returning `{ data: T[], total: number }` (D03-§4.3)
12. **ReDoS prevention**: `bank_recon_rules.pattern` regex patterns must be sanitized — limit pattern length to 256 chars, reject patterns with nested quantifiers (D02-§Wave11)

## Debate Findings Applied (D01–D05)

| Finding | Source | Resolution |
|---------|--------|------------|
| Marker naming collision | D05 §6 (P0) | Fixed: `.agent-done-W11-{NN}` format |
| Missing indexes | D03 §2.2 | Added index discipline to coordination rules + migration |
| Zod validation missing | D02 API-01 | Added Zod requirement to coordination rules |
| Pagination not standardized | D03 §4.3 | Added pagination standard to coordination rules |
| ReDoS risk in recon rules | D02 §Wave11 | Added regex sanitization requirement |
| bank_reconciler_agent vs account_reconciler | D04 AG02 | Clarified: bank_reconciler_agent SUPPLEMENTS (does not replace) account_reconciler. account_reconciler handles basic balance checks; bank_reconciler_agent handles multi-strategy matching with confidence scoring |
| Agent I/O contracts missing | D04 AG03 | Already specified in task files 04 and 05 (InventoryAgentInput/Output, BankReconAgentInput/Output) |

## Execution Priority Order

```
Sub-wave 1 (Parallel): Agent 1 + Agent 2 + Agent 3
Sub-wave 2 (After 1):  Agent 4 + Agent 5 + Agent 6
Sub-wave 3 (After 2):  Agent 7
Sub-wave 4 (After 3):  Agent 8 + Agent 9
Sub-wave 5 (After 4):  Agent 10
```

## START THE TEAM NOW

Spawn all 10 teammates and begin coordinating their work according to the sub-wave execution order above. Read each agent's task file from `wave11-agent-tasks/` for detailed atomic tasks.
