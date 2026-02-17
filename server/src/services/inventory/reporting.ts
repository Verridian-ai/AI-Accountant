/**
 * Inventory Reporting
 *
 * COGS calculation, movement history, and valuation reports.
 */

import { db } from '../../schema.js';
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';
import {
  ensureTables,
  getInventoryItems,
  getInventoryStock,
  getInventoryMovements,
} from './schema-loader.js';
import { getItem } from './item-management.js';
import type { InventoryItem, InventoryMovement, InventoryStockRecord } from './types.js';

/**
 * Calculate COGS for a sale using the weighted average method.
 * COGS = quantitySold * currentCostCents
 */
export async function calculateCOGS(
  userId: string,
  itemId: string,
  quantitySold: number,
): Promise<{ cogsCents: number; unitCostCents: number; newAverageCost: number }> {
  const item = await getItem(itemId, userId);
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

/** Paginated movement history with filters. */
export async function getMovementHistory(
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
  const _inventoryMovements = getInventoryMovements();
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

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(_inventoryMovements)
    .where(whereClause)
    .get();

  const total = (countResult as any)?.count ?? 0;

  const limit = filters?.limit ?? 50;
  const offset = filters?.offset ?? 0;

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
 * Full inventory valuation report.
 * Groups by category with totals.
 */
export async function getValuationReport(
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
  const _inventoryItems = getInventoryItems();
  const _inventoryStock = getInventoryStock();
  if (!_inventoryItems || !_inventoryStock) {
    return { items: [], totalInventoryValueCents: 0, categoryBreakdown: [] };
  }

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
