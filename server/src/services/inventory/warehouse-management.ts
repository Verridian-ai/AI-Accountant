/**
 * Inventory Warehouse Management
 *
 * CRUD operations for warehouses.
 */

import { db } from '../../schema.js';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import { ensureTables, getWarehouses } from './schema-loader.js';
import type { Warehouse } from './types.js';

/** Create a warehouse. If isDefault=true, unsets previous default. */
export async function createWarehouse(
  userId: string,
  data: { name: string; location?: string; isDefault?: boolean },
): Promise<Warehouse> {
  await ensureTables();
  const _warehouses = getWarehouses();

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
export async function listWarehouses(userId: string): Promise<Warehouse[]> {
  await ensureTables();
  const _warehouses = getWarehouses();
  if (!_warehouses) return [];

  const rows = await db
    .select()
    .from(_warehouses)
    .where(and(eq(_warehouses.userId, userId), eq(_warehouses.isActive, true)))
    .all();

  return rows as Warehouse[];
}

/** Return the default warehouse, or create "Main Warehouse" if none exist. */
export async function getDefaultWarehouse(userId: string): Promise<Warehouse> {
  await ensureTables();
  const _warehouses = getWarehouses();

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
  return createWarehouse(userId, { name: 'Main Warehouse', isDefault: true });
}
