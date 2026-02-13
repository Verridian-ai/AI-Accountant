/**
 * Inventory Agent
 *
 * AI-powered inventory management: stock level analysis, COGS calculations,
 * reorder suggestions, and inventory context search via Cognee.
 * Uses weighted average costing method (standard for Australian small business).
 */

import Anthropic from '@anthropic-ai/sdk';
import { ClaudeAgent } from '../base-agent.js';
import { cogneeTools, COGNEE_DATASETS } from '../cognee-tools.js';
import { inventoryService } from '../../inventory.js';
import type { InventoryAgentInput, InventoryAgentOutput } from '../types.js';

export class InventoryAgent extends ClaudeAgent<InventoryAgentInput, InventoryAgentOutput> {
  protected systemPrompt = `You are an Australian small business inventory management specialist. You help businesses track stock levels, calculate Cost of Goods Sold (COGS) using the weighted average method, identify reorder needs, and optimize inventory turnover. You understand GST implications on inventory purchases and sales. Always provide amounts in AUD cents internally and format as dollars for display.

Key rules:
- All monetary amounts are in CENTS (integer). $1,000.00 = 100000 cents.
- COGS uses weighted average: unitCost = totalInventoryValue / totalQuantity.
- On purchase, recalculate: newCost = ((existingQty * existingCost) + (purchaseQty * purchaseCost)) / (existingQty + purchaseQty).
- On sale, COGS = quantitySold * currentCostCents. The average cost does NOT change on a sale.
- GST on inventory: purchases include input tax credits; sales attract GST if the item is GST-applicable.
- Financial years run July 1 to June 30 (e.g., FY 2024-25 = 1 Jul 2024 – 30 Jun 2025).
- Reorder alerts: flag items where quantityOnHand <= reorderPoint.
- Suggested reorder quantity comes from the item's reorderQuantity field (or a sensible default).

Use the available tools to gather data, then return a JSON object matching the InventoryAgentOutput schema with stockAlerts, cogsAnalysis, reorderRecommendations, valuationSummary, and a human-readable summary.`;

  protected tools: Anthropic.Tool[] = [
    {
      name: 'check_stock_levels',
      description:
        'Check current stock levels across warehouses with valuation. Optionally filter to items below their reorder point.',
      input_schema: {
        type: 'object' as const,
        properties: {
          userId: { type: 'string', description: 'User ID to query stock for' },
          warehouseId: {
            type: 'string',
            description: 'Optional warehouse ID to filter by',
          },
          belowReorderOnly: {
            type: 'boolean',
            description: 'If true, only return items below their reorder point',
          },
        },
        required: ['userId'],
      },
    },
    {
      name: 'calculate_cogs',
      description:
        'Calculate Cost of Goods Sold for an item using the weighted average method. Returns COGS breakdown with unit cost and total.',
      input_schema: {
        type: 'object' as const,
        properties: {
          userId: { type: 'string', description: 'User ID' },
          itemId: { type: 'string', description: 'Inventory item ID' },
          quantitySold: {
            type: 'number',
            description: 'Number of units sold',
          },
        },
        required: ['userId', 'itemId', 'quantitySold'],
      },
    },
    {
      name: 'suggest_reorder',
      description:
        'Get items that need reordering (below reorder point) with suggested quantities and estimated cost.',
      input_schema: {
        type: 'object' as const,
        properties: {
          userId: { type: 'string', description: 'User ID' },
        },
        required: ['userId'],
      },
    },
    {
      name: 'search_inventory_context',
      description:
        'Search the Cognee knowledge graph for relevant inventory context — supplier info, historical patterns, product details.',
      input_schema: {
        type: 'object' as const,
        properties: {
          query: {
            type: 'string',
            description: 'Search query for inventory context',
          },
        },
        required: ['query'],
      },
    },
  ];

  protected toolHandlers = new Map<string, (input: Record<string, unknown>) => Promise<unknown>>([
    [
      'check_stock_levels',
      async (input) => {
        const userId = input.userId as string;
        const warehouseId = input.warehouseId as string | undefined;
        const belowReorderOnly = input.belowReorderOnly as boolean | undefined;

        try {
          const levels = await inventoryService.getStockLevels(userId, {
            warehouseId,
            belowReorderPoint: belowReorderOnly,
          });

          return {
            stockLevels: levels.map((l) => ({
              itemId: l.item.id,
              sku: l.item.sku,
              name: l.item.name,
              category: l.item.category,
              warehouseId: l.warehouseId,
              warehouseName: l.warehouseName,
              quantityOnHand: l.quantityOnHand,
              quantityReserved: l.quantityReserved,
              quantityAvailable: l.quantityAvailable,
              valueCents: l.valueCents,
              unitCostCents: l.item.currentCostCents,
              reorderPoint: l.item.reorderPoint,
              reorderQuantity: l.item.reorderQuantity,
              gstApplicable: l.item.gstApplicable,
            })),
            totalItems: levels.length,
          };
        } catch (err) {
          return {
            error: err instanceof Error ? err.message : 'Failed to fetch stock levels',
            stockLevels: [],
            totalItems: 0,
          };
        }
      },
    ],
    [
      'calculate_cogs',
      async (input) => {
        const userId = input.userId as string;
        const itemId = input.itemId as string;
        const quantitySold = input.quantitySold as number;

        try {
          const result = await inventoryService.calculateCOGS(userId, itemId, quantitySold);

          return {
            itemId,
            quantitySold,
            unitCostCents: result.unitCostCents,
            totalCogsCents: result.cogsCents,
            newAverageCostCents: result.newAverageCost,
          };
        } catch (err) {
          return {
            error: err instanceof Error ? err.message : 'Failed to calculate COGS',
          };
        }
      },
    ],
    [
      'suggest_reorder',
      async (input) => {
        const userId = input.userId as string;

        try {
          const levels = await inventoryService.getStockLevels(userId, {
            belowReorderPoint: true,
          });

          const suggestions = levels.map((l) => {
            const suggestedQty = l.item.reorderQuantity ?? 10;
            return {
              itemId: l.item.id,
              sku: l.item.sku,
              name: l.item.name,
              currentStock: l.quantityOnHand,
              reorderPoint: l.item.reorderPoint ?? 0,
              suggestedQuantity: suggestedQty,
              estimatedCostCents: suggestedQty * l.item.currentCostCents,
              supplierName: l.item.supplierName,
              supplierAbn: l.item.supplierAbn,
              urgency:
                l.quantityOnHand === 0
                  ? 'critical'
                  : l.quantityOnHand <= (l.item.reorderPoint ?? 0) / 2
                    ? 'warning'
                    : 'info',
            };
          });

          return {
            reorderItems: suggestions,
            totalEstimatedCostCents: suggestions.reduce((sum, s) => sum + s.estimatedCostCents, 0),
          };
        } catch (err) {
          return {
            error: err instanceof Error ? err.message : 'Failed to generate reorder suggestions',
            reorderItems: [],
          };
        }
      },
    ],
    [
      'search_inventory_context',
      async (input) => {
        const query = input.query as string;

        try {
          const results = await cogneeTools.search(
            query,
            COGNEE_DATASETS.inventoryCatalog,
            'CHUNKS',
          );
          return { found: results.length > 0, results };
        } catch {
          return {
            found: false,
            results: [],
            error: 'Cognee search unavailable',
          };
        }
      },
    ],
  ]);

  constructor() {
    super('inventory_agent');
  }
}
