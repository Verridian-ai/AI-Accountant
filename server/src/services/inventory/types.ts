/**
 * Inventory Service Types
 */

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
