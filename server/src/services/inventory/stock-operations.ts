/**
 * Inventory Stock Operations
 *
 * Stock adjustments, transfers, and stock level queries.
 */

import { db } from '../../schema.js';
import { eq, and } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import crypto from 'crypto';
import {
  ensureTables,
  getInventoryItems,
  getInventoryStock,
  getInventoryMovements,
  getWarehouses,
} from './schema-loader.js';
import { getItem } from './item-management.js';
import type { InventoryItem, InventoryMovement, InventoryStockRecord, Warehouse } from './types.js';

/** Determine the new quantity based on movement type. */
function adjustQuantity(currentQty: number, movementQty: number, movementType: string): number {
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
      return currentQty + movementQty;
  }
}

/** Get total quantity on hand across all warehouses for an item. */
async function getTotalQuantityOnHand(itemId: string): Promise<number> {
  await ensureTables();
  const _inventoryStock = getInventoryStock();
  if (!_inventoryStock) return 0;

  const rows = (await db
    .select()
    .from(_inventoryStock)
    .where(eq(_inventoryStock.itemId, itemId))
    .all()) as InventoryStockRecord[];

  return rows.reduce((sum, r) => sum + r.quantityOnHand, 0);
}

/**
 * Pure function: recalculate weighted average cost.
 * Formula: ((existingQty * existingCost) + (newQty * newCost)) / (existingQty + newQty)
 */
export function recalculateWeightedAverage(
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

/**
 * Core stock adjustment. Creates a movement record, updates stock,
 * and recalculates weighted average cost on purchase.
 */
export async function adjustStock(
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
  const _inventoryItems = getInventoryItems();
  const _inventoryStock = getInventoryStock();
  const _inventoryMovements = getInventoryMovements();

  const item = await getItem(itemId, userId);
  if (!item) {
    throw new Error(`Item ${itemId} not found or access denied`);
  }

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

  if (_inventoryStock) {
    const existingStock = await db
      .select()
      .from(_inventoryStock)
      .where(and(eq(_inventoryStock.itemId, itemId), eq(_inventoryStock.warehouseId, warehouseId)))
      .get();

    if (existingStock) {
      const currentQty = (existingStock as InventoryStockRecord).quantityOnHand;
      const newQty = adjustQuantity(currentQty, quantity, movementType);
      await db
        .update(_inventoryStock)
        .set({ quantityOnHand: newQty, lastMovementAt: now })
        .where(
          and(eq(_inventoryStock.itemId, itemId), eq(_inventoryStock.warehouseId, warehouseId)),
        )
        .run();
    } else {
      const initialQty = adjustQuantity(0, quantity, movementType);
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

  if (movementType === 'purchase' && _inventoryItems) {
    const totalOnHand = await getTotalQuantityOnHand(itemId);
    const existingQty = totalOnHand - quantity;
    const newAvgCost = recalculateWeightedAverage(
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
export async function transferStock(
  userId: string,
  itemId: string,
  fromWarehouseId: string,
  toWarehouseId: string,
  quantity: number,
  notes?: string,
): Promise<{ outMovement: InventoryMovement; inMovement: InventoryMovement }> {
  if (quantity <= 0) throw new Error('Transfer quantity must be positive');
  if (fromWarehouseId === toWarehouseId) {
    throw new Error('Source and destination warehouse must differ');
  }

  const item = await getItem(itemId, userId);
  if (!item) throw new Error(`Item ${itemId} not found or access denied`);

  const currentCost = item.currentCostCents;
  const transferNote = notes ?? `Transfer from ${fromWarehouseId} to ${toWarehouseId}`;

  const outMovement = await adjustStock(
    userId,
    itemId,
    fromWarehouseId,
    quantity,
    currentCost,
    'transfer_out',
    transferNote,
  );
  const inMovement = await adjustStock(
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
 */
export async function getStockLevels(
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
  const _inventoryItems = getInventoryItems();
  const _inventoryStock = getInventoryStock();
  const _warehouses = getWarehouses();
  if (!_inventoryStock || !_inventoryItems || !_warehouses) return [];

  const itemConditions: SQL[] = [eq(_inventoryItems.userId, userId)];
  if (filters?.itemId) itemConditions.push(eq(_inventoryItems.id, filters.itemId));

  const items = (await db
    .select()
    .from(_inventoryItems)
    .where(and(...itemConditions))
    .all()) as InventoryItem[];

  const results: Array<{
    item: InventoryItem;
    warehouseId: string;
    warehouseName: string;
    quantityOnHand: number;
    quantityReserved: number;
    quantityAvailable: number;
    valueCents: number;
  }> = [];

  for (const item of items) {
    const stockConditions: SQL[] = [eq(_inventoryStock.itemId, item.id)];
    if (filters?.warehouseId)
      stockConditions.push(eq(_inventoryStock.warehouseId, filters.warehouseId));

    const stockRows = (await db
      .select()
      .from(_inventoryStock)
      .where(and(...stockConditions))
      .all()) as InventoryStockRecord[];

    for (const stock of stockRows) {
      const wh = (await db
        .select()
        .from(_warehouses)
        .where(eq(_warehouses.id, stock.warehouseId))
        .get()) as Warehouse | undefined;

      const qtyOnHand = stock.quantityOnHand;
      const qtyReserved = stock.quantityReserved;
      const qtyAvailable = qtyOnHand - qtyReserved;
      const valueCents = qtyOnHand * item.currentCostCents;

      if (filters?.belowReorderPoint && item.reorderPoint !== null) {
        if (qtyOnHand >= item.reorderPoint) continue;
      } else if (filters?.belowReorderPoint) {
        continue;
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
