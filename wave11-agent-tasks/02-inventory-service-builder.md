# Agent 2: Inventory Service Builder

## Role
Build the core inventory management service with COGS calculation (weighted average), stock management, warehouse transfers, and valuation reporting.

## Priority: WAVE 11 (Start Immediately)

## Files to CREATE

### 1. `server/src/services/inventory.ts`
**Purpose**: Full inventory management service with COGS calculation using weighted average method
**Pattern**: Follow `server/src/services/accounts.ts` — export singleton instance, use Drizzle queries against schema tables
**Reference**: Schema tables `inventoryItems`, `inventoryStock`, `inventoryMovements`, `warehouses` from `schema.ts`

- [ ] Create `InventoryService` class with the following methods:

#### Item Management
- [ ] `createItem(userId: string, data: { sku: string; name: string; description?: string; category?: string; unitOfMeasure?: string; costMethod?: string; salePriceCents?: number; gstApplicable?: boolean; reorderPoint?: number; reorderQuantity?: number; supplierName?: string; supplierAbn?: string }): Promise<InventoryItem>` — Insert into `inventoryItems`, generate UUID, validate unique SKU per user
- [ ] `updateItem(itemId: string, userId: string, updates: Partial<...>): Promise<InventoryItem>` — Partial update, validate ownership
- [ ] `getItem(itemId: string, userId: string): Promise<InventoryItem | null>` — Single item with stock levels
- [ ] `listItems(userId: string, filters?: { category?: string; isActive?: boolean; search?: string }): Promise<InventoryItem[]>` — List with optional filtering
- [ ] `deactivateItem(itemId: string, userId: string): Promise<void>` — Soft-delete (set isActive=false)

#### Warehouse Management
- [ ] `createWarehouse(userId: string, data: { name: string; location?: string; isDefault?: boolean }): Promise<Warehouse>` — Insert into `warehouses`, if isDefault=true, unset previous default
- [ ] `listWarehouses(userId: string): Promise<Warehouse[]>` — All active warehouses for user
- [ ] `getDefaultWarehouse(userId: string): Promise<Warehouse>` — Return default or first warehouse; create "Main Warehouse" if none exist

#### Stock Operations
- [ ] `adjustStock(userId: string, itemId: string, warehouseId: string, quantity: number, unitCostCents: number, movementType: string, notes?: string, referenceId?: string): Promise<InventoryMovement>` — Core stock operation:
  1. Validate item exists and belongs to user
  2. Create `inventory_movements` record
  3. Update `inventory_stock.quantity_on_hand` (upsert — create stock row if not exists)
  4. If movementType is 'purchase', recalculate weighted average cost on `inventory_items.current_cost_cents`
  5. Return the movement record

- [ ] `transferStock(userId: string, itemId: string, fromWarehouseId: string, toWarehouseId: string, quantity: number, notes?: string): Promise<{ outMovement: InventoryMovement; inMovement: InventoryMovement }>` — Create paired transfer_out/transfer_in movements, update both warehouse stock levels, use current cost for both movements

- [ ] `getStockLevels(userId: string, filters?: { warehouseId?: string; itemId?: string; belowReorderPoint?: boolean }): Promise<Array<{ item: InventoryItem; warehouseId: string; warehouseName: string; quantityOnHand: number; quantityReserved: number; quantityAvailable: number; valueCents: number }>>` — JOIN inventory_stock + inventory_items + warehouses, compute valueCents = quantityOnHand * currentCostCents, optionally filter for items below reorder point

#### COGS Calculation (Weighted Average)
- [ ] `calculateCOGS(userId: string, itemId: string, quantitySold: number): Promise<{ cogsCents: number; unitCostCents: number; newAverageCost: number }>` — Weighted average COGS:
  1. Get current `inventory_items.current_cost_cents` for the item
  2. COGS = quantitySold * currentCostCents
  3. Return breakdown
  - Formula for weighted average update on purchase: `newCost = ((existingQty * existingCost) + (purchaseQty * purchaseCost)) / (existingQty + purchaseQty)`

- [ ] `recalculateWeightedAverage(itemId: string, existingQty: number, existingCostCents: number, newQty: number, newCostCents: number): number` — Pure function, returns new weighted average cost in cents

#### Reporting
- [ ] `getMovementHistory(userId: string, filters?: { itemId?: string; warehouseId?: string; movementType?: string; startDate?: string; endDate?: string; limit?: number; offset?: number }): Promise<{ movements: InventoryMovement[]; total: number }>` — Paginated movement history with filters

- [ ] `getValuationReport(userId: string, asOfDate?: string): Promise<{ items: Array<{ itemId: string; sku: string; name: string; category: string; totalQuantity: number; unitCostCents: number; totalValueCents: number; costMethod: string }>; totalInventoryValueCents: number; categoryBreakdown: Array<{ category: string; totalValueCents: number; itemCount: number }> }>` — Full inventory valuation at a point in time, grouped by category

- [ ] Export singleton: `export const inventoryService = new InventoryService();`

#### Helper imports
```typescript
import { db, inventoryItems, inventoryStock, inventoryMovements, warehouses } from '../schema.js';
import { eq, and, desc, gte, lte, like, sql } from 'drizzle-orm';
import crypto from 'crypto';
import type { InventoryItem, Warehouse, InventoryMovement, InventoryStockRecord } from '../schema.js';
```

## Files to MODIFY

*None* — this is a standalone service file.

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `InventoryService.createItem()` can be called and returns a valid InventoryItem
- [ ] `InventoryService.adjustStock()` correctly updates stock levels and recalculates weighted average
- [ ] `InventoryService.calculateCOGS()` returns correct COGS for a given quantity
- [ ] `InventoryService.transferStock()` creates paired movements and updates both warehouses
- [ ] `InventoryService.getValuationReport()` returns correct total inventory value
- [ ] Create marker file: `.agent-done-W11-02`

## Dependencies
- **None** — can start immediately (uses schema types that Agent 1 creates, but can define local types as fallback)
- **Reuses**: schema.ts (inventoryItems, warehouses, inventoryStock, inventoryMovements), drizzle-orm queries
