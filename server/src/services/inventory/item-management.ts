/**
 * Inventory Item Management
 *
 * CRUD operations for inventory items.
 */

import { db } from '../../schema.js';
import { eq, and, like } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import crypto from 'crypto';
import { ensureTables, getInventoryItems } from './schema-loader.js';
import type { InventoryItem } from './types.js';

/** Create a new inventory item. SKU must be unique per user. */
export async function createItem(
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
  const _inventoryItems = getInventoryItems();

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
export async function updateItem(
  itemId: string,
  userId: string,
  updates: Partial<Omit<InventoryItem, 'id' | 'userId' | 'createdAt'>>,
): Promise<InventoryItem> {
  await ensureTables();
  const _inventoryItems = getInventoryItems();

  const existing = await getItem(itemId, userId);
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
export async function getItem(itemId: string, userId: string): Promise<InventoryItem | null> {
  await ensureTables();
  const _inventoryItems = getInventoryItems();

  if (!_inventoryItems) return null;

  const row = await db
    .select()
    .from(_inventoryItems)
    .where(and(eq(_inventoryItems.id, itemId), eq(_inventoryItems.userId, userId)))
    .get();

  return (row as InventoryItem) ?? null;
}

/** List items with optional filters. */
export async function listItems(
  userId: string,
  filters?: { category?: string; isActive?: boolean; search?: string },
): Promise<InventoryItem[]> {
  await ensureTables();
  const _inventoryItems = getInventoryItems();
  if (!_inventoryItems) return [];

  const conditions: SQL[] = [eq(_inventoryItems.userId, userId)];

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
export async function deactivateItem(itemId: string, userId: string): Promise<void> {
  await ensureTables();
  const _inventoryItems = getInventoryItems();
  if (!_inventoryItems) return;

  const item = await getItem(itemId, userId);
  if (!item) {
    throw new Error(`Item ${itemId} not found or access denied`);
  }

  await db
    .update(_inventoryItems)
    .set({ isActive: false, updatedAt: new Date().toISOString() })
    .where(and(eq(_inventoryItems.id, itemId), eq(_inventoryItems.userId, userId)))
    .run();
}
