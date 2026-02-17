/**
 * Inventory Schema Loader
 *
 * Lazy-loads inventory table references from the schema module.
 * Agent 1 may not have added these to schema.ts yet,
 * so we dynamically import them at runtime.
 */

let _inventoryItems: any;
let _inventoryStock: any;
let _inventoryMovements: any;
let _warehouses: any;
let _tablesLoaded = false;

export async function ensureTables() {
  if (_tablesLoaded) return;
  try {
    const schema = await import('../../schema.js');
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
