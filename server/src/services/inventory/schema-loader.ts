import type { DrizzleTable } from '../../db/queries/types.js';

/**
 * Inventory Schema Loader
 *
 * Lazy-loads inventory table references from the schema module.
 * Agent 1 may not have added these to schema.ts yet,
 * so we dynamically import them at runtime.
 *
 * Note: These variables are intentionally untyped — they hold Drizzle table
 * objects whose column accessors (.userId, .id, etc.) require dynamic property
 * access. Same irreducible pattern as wrapPgDb() in schema.ts.
 */

let _inventoryItems: DrizzleTable | undefined;
let _inventoryStock: DrizzleTable | undefined;
let _inventoryMovements: DrizzleTable | undefined;
let _warehouses: DrizzleTable | undefined;
let _tablesLoaded = false;

export async function ensureTables() {
  if (_tablesLoaded) return;
  try {
    const schema: Record<string, unknown> = await import('../../schema.js');
    _inventoryItems = schema.inventoryItems as DrizzleTable;
    _inventoryStock = schema.inventoryStock as DrizzleTable;
    _inventoryMovements = schema.inventoryMovements as DrizzleTable;
    _warehouses = schema.warehouses as DrizzleTable;
    _tablesLoaded = true;
  } catch {
    // Schema tables not yet available — will use raw SQL fallbacks
    _tablesLoaded = false;
  }
}

export function getInventoryItems() {
  return _inventoryItems;
}
export function getInventoryStock() {
  return _inventoryStock;
}
export function getInventoryMovements() {
  return _inventoryMovements;
}
export function getWarehouses() {
  return _warehouses;
}
