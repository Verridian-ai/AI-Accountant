/**
 * Inventory Service — Singleton class facade
 *
 * Wraps the modular functions to preserve the original InventoryService class API.
 */

import type { InventoryItem, Warehouse, InventoryMovement } from './types.js';
import * as items from './item-management.js';
import * as warehouses from './warehouse-management.js';
import * as stock from './stock-operations.js';
import * as reporting from './reporting.js';

export class InventoryService {
  // Item management
  async createItem(
    userId: string,
    data: Parameters<typeof items.createItem>[1],
  ): Promise<InventoryItem> {
    return items.createItem(userId, data);
  }

  async updateItem(
    itemId: string,
    userId: string,
    updates: Partial<Omit<InventoryItem, 'id' | 'userId' | 'createdAt'>>,
  ): Promise<InventoryItem> {
    return items.updateItem(itemId, userId, updates);
  }

  async getItem(itemId: string, userId: string): Promise<InventoryItem | null> {
    return items.getItem(itemId, userId);
  }

  async listItems(
    userId: string,
    filters?: { category?: string; isActive?: boolean; search?: string },
  ): Promise<InventoryItem[]> {
    return items.listItems(userId, filters);
  }

  async deactivateItem(itemId: string, userId: string): Promise<void> {
    return items.deactivateItem(itemId, userId);
  }

  // Warehouse management
  async createWarehouse(
    userId: string,
    data: { name: string; location?: string; isDefault?: boolean },
  ): Promise<Warehouse> {
    return warehouses.createWarehouse(userId, data);
  }

  async listWarehouses(userId: string): Promise<Warehouse[]> {
    return warehouses.listWarehouses(userId);
  }

  async getDefaultWarehouse(userId: string): Promise<Warehouse> {
    return warehouses.getDefaultWarehouse(userId);
  }

  // Stock operations
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
    return stock.adjustStock(
      userId,
      itemId,
      warehouseId,
      quantity,
      unitCostCents,
      movementType,
      notes,
      referenceId,
    );
  }

  async transferStock(
    userId: string,
    itemId: string,
    fromWarehouseId: string,
    toWarehouseId: string,
    quantity: number,
    notes?: string,
  ) {
    return stock.transferStock(userId, itemId, fromWarehouseId, toWarehouseId, quantity, notes);
  }

  async getStockLevels(
    userId: string,
    filters?: { warehouseId?: string; itemId?: string; belowReorderPoint?: boolean },
  ) {
    return stock.getStockLevels(userId, filters);
  }

  recalculateWeightedAverage(
    _itemId: string,
    existingQty: number,
    existingCostCents: number,
    newQty: number,
    newCostCents: number,
  ): number {
    return stock.recalculateWeightedAverage(
      _itemId,
      existingQty,
      existingCostCents,
      newQty,
      newCostCents,
    );
  }

  // Reporting
  async calculateCOGS(userId: string, itemId: string, quantitySold: number) {
    return reporting.calculateCOGS(userId, itemId, quantitySold);
  }

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
  ) {
    return reporting.getMovementHistory(userId, filters);
  }

  async getValuationReport(userId: string, _asOfDate?: string) {
    return reporting.getValuationReport(userId, _asOfDate);
  }
}

export const inventoryService = new InventoryService();
