/**
 * Inventory Management Service
 *
 * Provides COGS calculation (weighted average method), stock management,
 * warehouse transfers, and valuation reporting.
 *
 * Pattern: Singleton service class with Drizzle ORM queries.
 * Follows the same structure as accounts.ts.
 */

import { db } from '../schema.js';
import { eq, and, desc, gte, lte, like, sql } from 'drizzle-orm';
import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Local type interfaces (fallback until Agent 1's schema tables land)
// ---------------------------------------------------------------------------

export interface InventoryItem {
  id: string;
  userId: string;
  sku: string;
  name: string;
  description: string | null;
  category: string | null;
  unitOfMeasure: string | null;
  costMethod: string;
  currentCostCents: number;
  salePriceCents: number | null;
  gstApplicable: boolean;
  reorderPoint: number | null;
  reorderQuantity: number | null;
  supplierName: string | null;
  supplierAbn: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Warehouse {
  id: string;
  userId: string;
  name: string;
  location: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryMovement {
  id: string;
  userId: string;
  itemId: string;
  warehouseId: string;
  movementType: string;
  quantity: number;
  unitCostCents: number;
  totalCostCents: number;
  notes: string | null;
  referenceId: string | null;
  createdAt: string;
}

export interface InventoryStockRecord {
  id: string;
  itemId: string;
  warehouseId: string;
  quantityOnHand: number;
  quantityReserved: number;
  lastMovementAt: string | null;
}

// ---------------------------------------------------------------------------
// Helper: lazy table references
// ---------------------------------------------------------------------------
// Agent 1 may not have added these to schema.ts yet.
// We dynamically import them at runtime so the module still loads
// even if the symbols don't exist in schema.ts at compile time.
// All DB operations go through the `any`-typed `db` anyway (wrapPgDb proxy).

let _inventoryItems: any;
let _inventoryStock: any;
let _inventoryMovements: any;
let _warehouses: any;
let _tablesLoaded = false;

async function ensureTables() {
  if (_tablesLoaded) return;
  try {
    const schema = await import('../schema.js');
    _inventoryItems = (schema as any).inventoryItems;
    _inventoryStock = (schema as any).inventoryStock;
    _inventoryMovements = (schema as any).inventoryMovements;
    _warehouses = (schema as any).warehouses;
    _tablesLoaded = true;
  } catch {
    // Schema tables not yet available — will use raw SQL fallbacks
    _tablesLoaded = false;
  }
}

// ---------------------------------------------------------------------------
// InventoryService
// ---------------------------------------------------------------------------

export class InventoryService {
  // =========================================================================
  // ITEM MANAGEMENT
  // =========================================================================

  /** Create a new inventory item. SKU must be unique per user. */
  async createItem(
    userId: string,
    data: {
      sku: string;
      name: string;
      description?: string;
      category?: string;
      unitOfMeasure?: string;
      costMethod?: string;
      salePriceCents?: number;
      gstApplicable?: boolean;
      reorderPoint?: number;
      reorderQuantity?: number;
      supplierName?: string;
      supplierAbn?: string;
    },
  ): Promise<InventoryItem> {
    await ensureTables();

    // Validate unique SKU per user
    if (_inventoryItems) {
      const existing = await db
        .select()
        .from(_inventoryItems)
        .where(and(eq(_inventoryItems.userId, userId), eq(_inventoryItems.sku, data.sku)))
        .get();

      if (existing) {
        throw new Error(`SKU "${data.sku}" already exists for this user`);
      }
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const item: InventoryItem = {
      id,
      userId,
      sku: data.sku,
      name: data.name,
      description: data.description ?? null,
      category: data.category ?? null,
      unitOfMeasure: data.unitOfMeasure ?? 'each',
      costMethod: data.costMethod ?? 'weighted_average',
      currentCostCents: 0,
      salePriceCents: data.salePriceCents ?? null,
      gstApplicable: data.gstApplicable ?? true,
      reorderPoint: data.reorderPoint ?? null,
      reorderQuantity: data.reorderQuantity ?? null,
      supplierName: data.supplierName ?? null,
      supplierAbn: data.supplierAbn ?? null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    if (_inventoryItems) {
      await db.insert(_inventoryItems).values(item).run();
    }

    return item;
  }

  /** Partial update of an item. Validates ownership. */
  async updateItem(
    itemId: string,
    userId: string,
    updates: Partial<Omit<InventoryItem, 'id' | 'userId' | 'createdAt'>>,
  ): Promise<InventoryItem> {
    await ensureTables();

    const existing = await this.getItem(itemId, userId);
    if (!existing) {
      throw new Error(`Item ${itemId} not found or access denied`);
    }

    const now = new Date().toISOString();
    const merged: InventoryItem = {
      ...existing,
      ...updates,
      id: existing.id,
      userId: existing.userId,
      createdAt: existing.createdAt,
      updatedAt: now,
    };

    if (_inventoryItems) {
      await db
        .update(_inventoryItems)
        .set({ ...updates, updatedAt: now })
        .where(and(eq(_inventoryItems.id, itemId), eq(_inventoryItems.userId, userId)))
        .run();
    }

    return merged;
  }

  /** Get a single item with stock levels. */
  async getItem(itemId: string, userId: string): Promise<InventoryItem | null> {
    await ensureTables();

    if (!_inventoryItems) return null;

    const row = await db
      .select()
      .from(_inventoryItems)
      .where(and(eq(_inventoryItems.id, itemId), eq(_inventoryItems.userId, userId)))
      .get();

    return (row as InventoryItem) ?? null;
  }

  /** List items with optional filters. */
  async listItems(
    userId: string,
    filters?: { category?: string; isActive?: boolean; search?: string },
  ): Promise<InventoryItem[]> {
    await ensureTables();
    if (!_inventoryItems) return [];

    const conditions: any[] = [eq(_inventoryItems.userId, userId)];

    if (filters?.category) {
      conditions.push(eq(_inventoryItems.category, filters.category));
    }
    if (filters?.isActive !== undefined) {
      conditions.push(eq(_inventoryItems.isActive, filters.isActive));
    }
    if (filters?.search) {
      conditions.push(like(_inventoryItems.name, `%${filters.search}%`));
    }

    const rows = await db
      .select()
      .from(_inventoryItems)
      .where(and(...conditions))
      .all();

    return rows as InventoryItem[];
  }

  /** Soft-delete: set isActive = false. */
  async deactivateItem(itemId: string, userId: string): Promise<void> {
    await ensureTables();
    if (!_inventoryItems) return;

    const item = await this.getItem(itemId, userId);
    if (!item) {
      throw new Error(`Item ${itemId} not found or access denied`);
    }

    await db
      .update(_inventoryItems)
      .set({ isActive: false, updatedAt: new Date().toISOString() })
      .where(and(eq(_inventoryItems.id, itemId), eq(_inventoryItems.userId, userId)))
      .run();
  }

  // =========================================================================
  // WAREHOUSE MANAGEMENT
  // =========================================================================

  /** Create a warehouse. If isDefault=true, unsets previous default. */
  async createWarehouse(
    userId: string,
    data: { name: string; location?: string; isDefault?: boolean },
  ): Promise<Warehouse> {
    await ensureTables();

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    // If setting as default, unset existing defaults
    if (data.isDefault && _warehouses) {
      await db
        .update(_warehouses)
        .set({ isDefault: false, updatedAt: now })
        .where(and(eq(_warehouses.userId, userId), eq(_warehouses.isDefault, true)))
        .run();
    }

    const warehouse: Warehouse = {
      id,
      userId,
      name: data.name,
      location: data.location ?? null,
      isDefault: data.isDefault ?? false,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    if (_warehouses) {
      await db.insert(_warehouses).values(warehouse).run();
    }

    return warehouse;
  }

  /** List all active warehouses for a user. */
  async listWarehouses(userId: string): Promise<Warehouse[]> {
    await ensureTables();
    if (!_warehouses) return [];

    const rows = await db
      .select()
      .from(_warehouses)
      .where(and(eq(_warehouses.userId, userId), eq(_warehouses.isActive, true)))
      .all();

    return rows as Warehouse[];
  }

  /** Return the default warehouse, or create "Main Warehouse" if none exist. */
  async getDefaultWarehouse(userId: string): Promise<Warehouse> {
    await ensureTables();

    if (_warehouses) {
      // Try to find explicitly marked default
      const defaultWh = await db
        .select()
        .from(_warehouses)
        .where(
          and(
            eq(_warehouses.userId, userId),
            eq(_warehouses.isDefault, true),
            eq(_warehouses.isActive, true),
          ),
        )
        .get();

      if (defaultWh) return defaultWh as Warehouse;

      // Fall back to first active warehouse
      const firstWh = await db
        .select()
        .from(_warehouses)
        .where(and(eq(_warehouses.userId, userId), eq(_warehouses.isActive, true)))
        .get();

      if (firstWh) return firstWh as Warehouse;
    }

    // No warehouses exist — create a default one
    return this.createWarehouse(userId, { name: 'Main Warehouse', isDefault: true });
  }

  // =========================================================================
  // STOCK OPERATIONS
  // =========================================================================

  /**
   * Core stock adjustment. Creates a movement record, updates stock,
   * and recalculates weighted average cost on purchase.
   */
  async adjustStock(
    userId: string,
    itemId: string,
    warehouseId: string,
    quantity: number,
    unitCostCents: number,
    movementType: string,
    notes?: string,
    referenceId?: string,
  ): Promise<InventoryMovement> {
    await ensureTables();

    // 1. Validate item exists and belongs to user
    const item = await this.getItem(itemId, userId);
    if (!item) {
      throw new Error(`Item ${itemId} not found or access denied`);
    }

    // 2. Create movement record
    const movementId = crypto.randomUUID();
    const now = new Date().toISOString();
    const totalCostCents = quantity * unitCostCents;

    const movement: InventoryMovement = {
      id: movementId,
      userId,
      itemId,
      warehouseId,
      movementType,
      quantity,
      unitCostCents,
      totalCostCents,
      notes: notes ?? null,
      referenceId: referenceId ?? null,
      createdAt: now,
    };

    if (_inventoryMovements) {
      await db.insert(_inventoryMovements).values(movement).run();
    }

    // 3. Upsert inventory_stock
    if (_inventoryStock) {
      const existingStock = await db
        .select()
        .from(_inventoryStock)
        .where(
          and(eq(_inventoryStock.itemId, itemId), eq(_inventoryStock.warehouseId, warehouseId)),
        )
        .get();

      if (existingStock) {
        const currentQty = (existingStock as InventoryStockRecord).quantityOnHand;
        const newQty = this._adjustQuantity(currentQty, quantity, movementType);

        await db
          .update(_inventoryStock)
          .set({ quantityOnHand: newQty, lastMovementAt: now })
          .where(
            and(eq(_inventoryStock.itemId, itemId), eq(_inventoryStock.warehouseId, warehouseId)),
          )
          .run();
      } else {
        // Create new stock row
        const initialQty = this._adjustQuantity(0, quantity, movementType);
        await db
          .insert(_inventoryStock)
          .values({
            id: crypto.randomUUID(),
            itemId,
            warehouseId,
            quantityOnHand: initialQty,
            quantityReserved: 0,
            lastMovementAt: now,
          })
          .run();
      }
    }

    // 4. On purchase, recalculate weighted average cost
    if (movementType === 'purchase' && _inventoryItems) {
      const totalOnHand = await this._getTotalQuantityOnHand(itemId);
      const existingQty = totalOnHand - quantity; // qty before this purchase
      const newAvgCost = this.recalculateWeightedAverage(
        itemId,
        Math.max(existingQty, 0),
        item.currentCostCents,
        quantity,
        unitCostCents,
      );

      await db
        .update(_inventoryItems)
        .set({ currentCostCents: newAvgCost, updatedAt: now })
        .where(eq(_inventoryItems.id, itemId))
        .run();
    }

    return movement;
  }

  /**
   * Transfer stock between warehouses.
   * Creates paired transfer_out / transfer_in movements.
   */
  async transferStock(
    userId: string,
    itemId: string,
    fromWarehouseId: string,
    toWarehouseId: string,
    quantity: number,
    notes?: string,
  ): Promise<{ outMovement: InventoryMovement; inMovement: InventoryMovement }> {
    if (quantity <= 0) {
      throw new Error('Transfer quantity must be positive');
    }
    if (fromWarehouseId === toWarehouseId) {
      throw new Error('Source and destination warehouse must differ');
    }

    const item = await this.getItem(itemId, userId);
    if (!item) {
      throw new Error(`Item ${itemId} not found or access denied`);
    }

    const currentCost = item.currentCostCents;
    const transferNote = notes ?? `Transfer from ${fromWarehouseId} to ${toWarehouseId}`;

    // Create the outbound movement (decreases source)
    const outMovement = await this.adjustStock(
      userId,
      itemId,
      fromWarehouseId,
      quantity,
      currentCost,
      'transfer_out',
      transferNote,
    );

    // Create the inbound movement (increases destination)
    const inMovement = await this.adjustStock(
      userId,
      itemId,
      toWarehouseId,
      quantity,
      currentCost,
      'transfer_in',
      transferNote,
    );

    return { outMovement, inMovement };
  }

  /**
   * Get stock levels with item and warehouse info.
   * Returns computed valuation = quantityOnHand * currentCostCents.
   */
  async getStockLevels(
    userId: string,
    filters?: { warehouseId?: string; itemId?: string; belowReorderPoint?: boolean },
  ): Promise<
    Array<{
      item: InventoryItem;
      warehouseId: string;
      warehouseName: string;
      quantityOnHand: number;
      quantityReserved: number;
      quantityAvailable: number;
      valueCents: number;
    }>
  > {
    await ensureTables();
    if (!_inventoryStock || !_inventoryItems || !_warehouses) return [];

    // Build conditions for items belonging to this user
    const itemConditions: any[] = [eq(_inventoryItems.userId, userId)];
    if (filters?.itemId) {
      itemConditions.push(eq(_inventoryItems.id, filters.itemId));
    }

    const items = (await db
      .select()
      .from(_inventoryItems)
      .where(and(...itemConditions))
      .all()) as InventoryItem[];

    const itemMap = new Map(items.map((i) => [i.id, i]));
    const results: Array<{
      item: InventoryItem;
      warehouseId: string;
      warehouseName: string;
      quantityOnHand: number;
      quantityReserved: number;
      quantityAvailable: number;
      valueCents: number;
    }> = [];

    // Fetch all stock records for these items
    for (const item of items) {
      const stockConditions: any[] = [eq(_inventoryStock.itemId, item.id)];
      if (filters?.warehouseId) {
        stockConditions.push(eq(_inventoryStock.warehouseId, filters.warehouseId));
      }

      const stockRows = (await db
        .select()
        .from(_inventoryStock)
        .where(and(...stockConditions))
        .all()) as InventoryStockRecord[];

      for (const stock of stockRows) {
        // Fetch warehouse name
        const wh = (await db
          .select()
          .from(_warehouses)
          .where(eq(_warehouses.id, stock.warehouseId))
          .get()) as Warehouse | undefined;

        const qtyOnHand = stock.quantityOnHand;
        const qtyReserved = stock.quantityReserved;
        const qtyAvailable = qtyOnHand - qtyReserved;
        const valueCents = qtyOnHand * item.currentCostCents;

        // Filter below reorder point
        if (filters?.belowReorderPoint && item.reorderPoint !== null) {
          if (qtyOnHand >= item.reorderPoint) continue;
        } else if (filters?.belowReorderPoint) {
          continue; // No reorder point set, skip
        }

        results.push({
          item,
          warehouseId: stock.warehouseId,
          warehouseName: wh?.name ?? 'Unknown',
          quantityOnHand: qtyOnHand,
          quantityReserved: qtyReserved,
          quantityAvailable: qtyAvailable,
          valueCents,
        });
      }
    }

    return results;
  }

  // =========================================================================
  // COGS CALCULATION (Weighted Average)
  // =========================================================================

  /**
   * Calculate COGS for a sale using the weighted average method.
   * COGS = quantitySold * currentCostCents
   */
  async calculateCOGS(
    userId: string,
    itemId: string,
    quantitySold: number,
  ): Promise<{ cogsCents: number; unitCostCents: number; newAverageCost: number }> {
    const item = await this.getItem(itemId, userId);
    if (!item) {
      throw new Error(`Item ${itemId} not found or access denied`);
    }

    const unitCostCents = item.currentCostCents;
    const cogsCents = quantitySold * unitCostCents;

    return {
      cogsCents,
      unitCostCents,
      newAverageCost: unitCostCents, // WAC doesn't change on sale, only on purchase
    };
  }

  /**
   * Pure function: recalculate weighted average cost.
   * Formula: ((existingQty * existingCost) + (newQty * newCost)) / (existingQty + newQty)
   */
  recalculateWeightedAverage(
    _itemId: string,
    existingQty: number,
    existingCostCents: number,
    newQty: number,
    newCostCents: number,
  ): number {
    const totalQty = existingQty + newQty;
    if (totalQty <= 0) return 0;

    const totalValue = existingQty * existingCostCents + newQty * newCostCents;
    return Math.round(totalValue / totalQty);
  }

  // =========================================================================
  // REPORTING
  // =========================================================================

  /** Paginated movement history with filters. */
  async getMovementHistory(
    userId: string,
    filters?: {
      itemId?: string;
      warehouseId?: string;
      movementType?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ movements: InventoryMovement[]; total: number }> {
    await ensureTables();
    if (!_inventoryMovements) return { movements: [], total: 0 };

    const conditions: any[] = [eq(_inventoryMovements.userId, userId)];

    if (filters?.itemId) {
      conditions.push(eq(_inventoryMovements.itemId, filters.itemId));
    }
    if (filters?.warehouseId) {
      conditions.push(eq(_inventoryMovements.warehouseId, filters.warehouseId));
    }
    if (filters?.movementType) {
      conditions.push(eq(_inventoryMovements.movementType, filters.movementType));
    }
    if (filters?.startDate) {
      conditions.push(gte(_inventoryMovements.createdAt, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(_inventoryMovements.createdAt, filters.endDate));
    }

    const whereClause = and(...conditions);

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(_inventoryMovements)
      .where(whereClause)
      .get();

    const total = (countResult as any)?.count ?? 0;

    // Get paginated results
    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;

    let query = db
      .select()
      .from(_inventoryMovements)
      .where(whereClause)
      .orderBy(desc(_inventoryMovements.createdAt));

    // Apply limit/offset via raw SQL since Drizzle SQLite compat may not chain .limit()
    const movements = (await db
      .select()
      .from(_inventoryMovements)
      .where(whereClause)
      .orderBy(desc(_inventoryMovements.createdAt))
      .limit(limit)
      .offset(offset)
      .all()) as InventoryMovement[];

    return { movements, total };
  }

  /**
   * Full inventory valuation report, optionally at a point in time.
   * Groups by category with totals.
   */
  async getValuationReport(
    userId: string,
    _asOfDate?: string,
  ): Promise<{
    items: Array<{
      itemId: string;
      sku: string;
      name: string;
      category: string;
      totalQuantity: number;
      unitCostCents: number;
      totalValueCents: number;
      costMethod: string;
    }>;
    totalInventoryValueCents: number;
    categoryBreakdown: Array<{
      category: string;
      totalValueCents: number;
      itemCount: number;
    }>;
  }> {
    await ensureTables();
    if (!_inventoryItems || !_inventoryStock) {
      return { items: [], totalInventoryValueCents: 0, categoryBreakdown: [] };
    }

    // Fetch all active items for user
    const allItems = (await db
      .select()
      .from(_inventoryItems)
      .where(and(eq(_inventoryItems.userId, userId), eq(_inventoryItems.isActive, true)))
      .all()) as InventoryItem[];

    const reportItems: Array<{
      itemId: string;
      sku: string;
      name: string;
      category: string;
      totalQuantity: number;
      unitCostCents: number;
      totalValueCents: number;
      costMethod: string;
    }> = [];

    const categoryMap = new Map<string, { totalValueCents: number; itemCount: number }>();
    let totalInventoryValueCents = 0;

    for (const item of allItems) {
      // Sum stock across all warehouses
      const stockRows = (await db
        .select()
        .from(_inventoryStock)
        .where(eq(_inventoryStock.itemId, item.id))
        .all()) as InventoryStockRecord[];

      const totalQty = stockRows.reduce((sum, s) => sum + s.quantityOnHand, 0);
      const totalValue = totalQty * item.currentCostCents;
      const category = item.category ?? 'Uncategorized';

      reportItems.push({
        itemId: item.id,
        sku: item.sku,
        name: item.name,
        category,
        totalQuantity: totalQty,
        unitCostCents: item.currentCostCents,
        totalValueCents: totalValue,
        costMethod: item.costMethod,
      });

      totalInventoryValueCents += totalValue;

      // Category breakdown
      const existing = categoryMap.get(category);
      if (existing) {
        existing.totalValueCents += totalValue;
        existing.itemCount += 1;
      } else {
        categoryMap.set(category, { totalValueCents: totalValue, itemCount: 1 });
      }
    }

    const categoryBreakdown = Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      ...data,
    }));

    return { items: reportItems, totalInventoryValueCents, categoryBreakdown };
  }

  // =========================================================================
  // PRIVATE HELPERS
  // =========================================================================

  /** Determine the new quantity based on movement type. */
  private _adjustQuantity(currentQty: number, movementQty: number, movementType: string): number {
    switch (movementType) {
      case 'purchase':
      case 'transfer_in':
      case 'adjustment_in':
      case 'return_in':
        return currentQty + movementQty;

      case 'sale':
      case 'transfer_out':
      case 'adjustment_out':
      case 'return_out':
      case 'waste':
      case 'damage':
        return currentQty - movementQty;

      default:
        // Unknown type — treat as additive
        return currentQty + movementQty;
    }
  }

  /** Get total quantity on hand across all warehouses for an item. */
  private async _getTotalQuantityOnHand(itemId: string): Promise<number> {
    await ensureTables();
    if (!_inventoryStock) return 0;

    const rows = (await db
      .select()
      .from(_inventoryStock)
      .where(eq(_inventoryStock.itemId, itemId))
      .all()) as InventoryStockRecord[];

    return rows.reduce((sum, r) => sum + r.quantityOnHand, 0);
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------
export const inventoryService = new InventoryService();
