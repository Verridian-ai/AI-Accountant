/**
 * Asset Management Agent
 *
 * ATO Division 40 depreciation specialist — calculates depreciation using
 * straight-line, diminishing value, instant write-off, and low value pool methods.
 * Integrates with FixedAssetService for persistence and Cognee for RAG advice.
 */

import Anthropic from '@anthropic-ai/sdk';
import { ClaudeAgent } from '../../base-agent.js';
import { cogneeTools } from '../../cognee-tools.js';
import { fixedAssetService } from '../../../fixed-assets.js';
import type { AssetManagementInput, AssetManagementOutput } from '../../types.js';

/** SBE instant write-off threshold in cents ($20,000) */
const INSTANT_WRITE_OFF_THRESHOLD = 20_000_00;

/** SBE aggregated turnover threshold in cents ($10M) */
const SBE_TURNOVER_THRESHOLD = 10_000_000_00;

export class AssetManagementAgent extends ClaudeAgent<AssetManagementInput, AssetManagementOutput> {
  protected systemPrompt = `You are an Australian fixed asset management specialist. You help businesses:
1. Register and track depreciating assets per ATO Division 40 ITAA 1997
2. Calculate depreciation using straight-line or diminishing value methods
3. Apply instant asset write-off rules for small business entities (SBE threshold $20,000)
4. Manage the low value pool (assets with WDV < $1,000)
5. Calculate CGT implications on asset disposals
6. Generate ATO-compliant depreciation schedules for tax returns
7. Advise on optimal depreciation methods based on business circumstances

Always cite relevant ATO rulings (TR 2024/3 for effective lives, TD 2024/1 for write-offs).
Use Australian financial year (July 1 - June 30). All amounts in cents.`;

  protected tools: Anthropic.Tool[] = [
    {
      name: 'calculate_depreciation',
      description: 'Calculate depreciation for an asset or batch of assets for a financial year',
      input_schema: {
        type: 'object' as const,
        properties: {
          assetId: {
            type: 'string',
            description: 'Single asset ID, or omit for batch',
          },
          userId: { type: 'string' },
          financialYear: {
            type: 'string',
            description: 'e.g. 2024-25',
          },
          entityId: {
            type: 'string',
            description: 'Optional entity filter for batch',
          },
        },
        required: ['userId', 'financialYear'],
      },
    },
    {
      name: 'suggest_depreciation_method',
      description:
        'Analyze an asset and suggest the optimal depreciation method based on ATO rules and business circumstances',
      input_schema: {
        type: 'object' as const,
        properties: {
          assetCategory: { type: 'string' },
          purchasePrice: {
            type: 'number',
            description: 'In cents',
          },
          entityType: { type: 'string' },
          isSmallBusinessEntity: { type: 'boolean' },
          expectedUsefulLife: {
            type: 'number',
            description: 'Years',
          },
          businessUsePercentage: {
            type: 'number',
            description: '0-100',
          },
        },
        required: ['assetCategory', 'purchasePrice', 'entityType'],
      },
    },
    {
      name: 'check_write_off_eligibility',
      description:
        'Check if an asset qualifies for instant asset write-off under current ATO rules',
      input_schema: {
        type: 'object' as const,
        properties: {
          purchasePrice: {
            type: 'number',
            description: 'In cents',
          },
          purchaseDate: {
            type: 'string',
            description: 'ISO date',
          },
          entityType: { type: 'string' },
          aggregatedTurnover: {
            type: 'number',
            description: 'Annual turnover in cents',
          },
          isNewAsset: { type: 'boolean' },
        },
        required: ['purchasePrice', 'purchaseDate', 'entityType'],
      },
    },
    {
      name: 'generate_asset_report',
      description: 'Generate a comprehensive asset register report or depreciation schedule',
      input_schema: {
        type: 'object' as const,
        properties: {
          userId: { type: 'string' },
          reportType: {
            type: 'string',
            enum: ['register', 'depreciation_schedule', 'disposal_summary', 'category_breakdown'],
          },
          financialYear: { type: 'string' },
          entityId: { type: 'string' },
        },
        required: ['userId', 'reportType'],
      },
    },
  ];

  protected toolHandlers = new Map<string, (input: Record<string, unknown>) => Promise<unknown>>([
    [
      'calculate_depreciation',
      async (input) => {
        const assetId = input.assetId as string | undefined;
        const userId = input.userId as string;
        const financialYear = input.financialYear as string;
        const entityId = input.entityId as string | undefined;

        if (assetId) {
          const result = await fixedAssetService.calculateDepreciation(assetId, financialYear);
          return {
            mode: 'single',
            assetId,
            ...result,
          };
        }

        const batchResult = await fixedAssetService.runBatchDepreciation(
          userId,
          financialYear,
          entityId,
        );
        return {
          mode: 'batch',
          ...batchResult,
        };
      },
    ],
    [
      'suggest_depreciation_method',
      async (input) => {
        const assetCategory = input.assetCategory as string;
        const purchasePrice = input.purchasePrice as number;
        const entityType = input.entityType as string;
        const isSmallBusinessEntity = (input.isSmallBusinessEntity as boolean) ?? false;
        const expectedUsefulLife = (input.expectedUsefulLife as number) ?? 10;
        const businessUsePercentage = (input.businessUsePercentage as number) ?? 100;

        let recommendedMethod: string;
        let reason: string;
        let atoReference: string;
        let estimatedFirstYearDeduction: number;

        // ATO decision tree
        if (isSmallBusinessEntity && purchasePrice < INSTANT_WRITE_OFF_THRESHOLD) {
          // Rule 1: SBE instant write-off
          recommendedMethod = 'instant_write_off';
          reason = `Asset cost ($${(purchasePrice / 100).toFixed(2)}) is under the $20,000 SBE instant write-off threshold. Full deduction in the year of purchase.`;
          atoReference = 'TD 2024/1 — Instant asset write-off for SBEs';
          estimatedFirstYearDeduction = Math.round(purchasePrice * (businessUsePercentage / 100));
        } else if (expectedUsefulLife <= 2) {
          // Rule 2: Short life → low value pool likely
          recommendedMethod = 'low_value_pool';
          reason = `Asset WDV will fall below $1,000 within 2 years. Low value pool (37.5% first year, 30% subsequent) is more efficient.`;
          atoReference = 'Div 40 ITAA 1997 s.40-425 — Low value pool';
          estimatedFirstYearDeduction = Math.round(
            purchasePrice * 0.375 * (businessUsePercentage / 100),
          );
        } else if (entityType === 'company') {
          // Rule 3: Companies benefit from front-loaded deductions
          recommendedMethod = 'diminishing_value';
          reason = `Companies benefit from front-loaded deductions via diminishing value method (200% rate). Higher deductions in early years reduce taxable income faster.`;
          atoReference = 'TR 2024/3 — Effective life, Div 40 s.40-72 DV formula';
          const dvRate = 2 / expectedUsefulLife;
          estimatedFirstYearDeduction = Math.round(
            purchasePrice * dvRate * (businessUsePercentage / 100),
          );
        } else if (expectedUsefulLife > 10) {
          // Rule 4: Long-life assets → straight line for predictability
          recommendedMethod = 'straight_line';
          reason = `Asset has a long effective life (${expectedUsefulLife} years). Straight-line method provides predictable, even deductions for better budget planning.`;
          atoReference = 'TR 2024/3 — Effective life, Div 40 s.40-70 SL formula';
          estimatedFirstYearDeduction = Math.round(
            (purchasePrice / expectedUsefulLife) * (businessUsePercentage / 100),
          );
        } else {
          // Rule 5: Default to diminishing value (ATO preferred)
          recommendedMethod = 'diminishing_value';
          reason = `Diminishing value is the ATO default method for most assets. Provides higher deductions in early years when the asset depreciates fastest.`;
          atoReference = 'TR 2024/3 — Effective life, Div 40 s.40-72 DV formula';
          const dvRate = 2 / expectedUsefulLife;
          estimatedFirstYearDeduction = Math.round(
            purchasePrice * dvRate * (businessUsePercentage / 100),
          );
        }

        // Search Cognee for any domain-specific advice
        let cogneeAdvice: string | null = null;
        try {
          const results = await cogneeTools.search(
            'depreciation method ' + assetCategory,
            'asset_register',
          );
          if (results.length > 0) {
            cogneeAdvice = JSON.stringify(results.slice(0, 3));
          }
        } catch {
          // Cognee unavailable — proceed without RAG
        }

        return {
          recommendedMethod,
          reason,
          atoReference,
          estimatedFirstYearDeduction,
          businessUsePercentage,
          cogneeAdvice,
        };
      },
    ],
    [
      'check_write_off_eligibility',
      async (input) => {
        const purchasePrice = input.purchasePrice as number;
        const purchaseDate = input.purchaseDate as string;
        const entityType = input.entityType as string;
        const aggregatedTurnover = (input.aggregatedTurnover as number) ?? 0;

        const purchaseDateObj = new Date(purchaseDate);
        const purchaseYear = purchaseDateObj.getFullYear();
        const purchaseMonth = purchaseDateObj.getMonth(); // 0-indexed

        // Determine FY of purchase
        const fyStartYear = purchaseMonth >= 6 ? purchaseYear : purchaseYear - 1;

        let eligible = false;
        let threshold = 0;
        let reason: string;
        let atoReference: string;

        // Temporary full expensing ended 30 June 2023
        if (fyStartYear < 2023) {
          // Pre-2023: temporary full expensing (no cap for eligible entities)
          eligible = true;
          threshold = Number.MAX_SAFE_INTEGER;
          reason =
            'Temporary full expensing applied (no cost limit) for assets first used or installed ready for use by 30 June 2023.';
          atoReference = 'Treasury Laws Amendment (2021 Measures No. 2)';
        } else if (fyStartYear === 2023) {
          // FY 2023-24: $20,000 threshold for SBEs
          const isSBE =
            aggregatedTurnover > 0
              ? aggregatedTurnover < SBE_TURNOVER_THRESHOLD
              : entityType === 'sole_trader' || entityType === 'small_business';

          threshold = INSTANT_WRITE_OFF_THRESHOLD;

          if (!isSBE) {
            eligible = false;
            reason = `Instant asset write-off is only available to small business entities (aggregated turnover < $10M). Entity type: ${entityType}.`;
          } else if (purchasePrice >= threshold) {
            eligible = false;
            reason = `Asset cost ($${(purchasePrice / 100).toFixed(2)}) exceeds the $20,000 instant write-off threshold for FY 2023-24.`;
          } else {
            eligible = true;
            reason = `Asset qualifies for instant write-off: cost ($${(purchasePrice / 100).toFixed(2)}) is under $20,000 threshold and entity qualifies as SBE.`;
          }
          atoReference = 'TD 2024/1 — Instant asset write-off';
        } else {
          // FY 2024-25 onwards: check latest threshold via Cognee
          threshold = INSTANT_WRITE_OFF_THRESHOLD; // default to $20,000 until updated
          let cogneeThreshold: number | null = null;

          try {
            const results = await cogneeTools.search(
              'instant asset write-off threshold ' +
                `${fyStartYear}-${String(fyStartYear + 1).slice(2)}`,
              'ato_rulings',
            );
            if (results.length > 0) {
              // Try to extract threshold from Cognee results
              const thresholdMatch = JSON.stringify(results).match(/\$(\d[\d,]*)/);
              if (thresholdMatch) {
                cogneeThreshold = parseFloat(thresholdMatch[1].replace(/,/g, '')) * 100;
              }
            }
          } catch {
            // Cognee unavailable
          }

          if (cogneeThreshold !== null) {
            threshold = cogneeThreshold;
          }

          const isSBE =
            aggregatedTurnover > 0
              ? aggregatedTurnover < SBE_TURNOVER_THRESHOLD
              : entityType === 'sole_trader' || entityType === 'small_business';

          if (!isSBE) {
            eligible = false;
            reason = `Instant asset write-off is only available to small business entities (aggregated turnover < $10M).`;
          } else if (purchasePrice >= threshold) {
            eligible = false;
            reason = `Asset cost ($${(purchasePrice / 100).toFixed(2)}) exceeds the $${(threshold / 100).toFixed(0)} threshold for FY ${fyStartYear}-${String(fyStartYear + 1).slice(2)}.`;
          } else {
            eligible = true;
            reason = `Asset qualifies for instant write-off: cost under $${(threshold / 100).toFixed(0)} threshold for SBE in FY ${fyStartYear}-${String(fyStartYear + 1).slice(2)}.`;
          }
          atoReference =
            cogneeThreshold !== null
              ? 'ATO — Updated instant write-off threshold (via Cognee)'
              : 'TD 2024/1 — Instant asset write-off (default threshold)';
        }

        return { eligible, threshold, reason, atoReference };
      },
    ],
    [
      'generate_asset_report',
      async (input) => {
        const userId = input.userId as string;
        const reportType = input.reportType as string;
        const financialYear = input.financialYear as string | undefined;
        const entityId = input.entityId as string | undefined;

        switch (reportType) {
          case 'register': {
            const register = await fixedAssetService.getAssetRegister(
              userId,
              entityId ? { entityId } : undefined,
            );
            return {
              reportType: 'register',
              ...register,
            };
          }

          case 'depreciation_schedule': {
            if (!financialYear) {
              return {
                error: 'financialYear is required for depreciation_schedule report',
              };
            }
            const schedule = await fixedAssetService.getDepreciationSchedule(
              userId,
              financialYear,
              entityId,
            );
            return {
              reportType: 'depreciation_schedule',
              ...schedule,
            };
          }

          case 'disposal_summary': {
            // Get all disposed assets and summarize
            const disposed = await fixedAssetService.getAssetRegister(userId, {
              status: 'disposed',
              entityId,
            });
            // Disposal records aren't queried directly here
            return {
              reportType: 'disposal_summary',
              disposedAssets: disposed.assets,
              totalDisposedCount: disposed.assets.length,
              totalOriginalCost: disposed.summary.totalCost,
              totalWDVAtDisposal: disposed.summary.totalWDV,
            };
          }

          case 'category_breakdown': {
            const all = await fixedAssetService.getAssetRegister(
              userId,
              entityId ? { entityId } : undefined,
            );
            return {
              reportType: 'category_breakdown',
              categories: all.summary.byCategory,
              totalAssets: all.summary.totalAssets,
              totalCost: all.summary.totalCost,
              totalWDV: all.summary.totalWDV,
              totalDepreciation: all.summary.totalDepreciationToDate,
            };
          }

          default:
            return {
              error: `Unknown report type: ${reportType}. Use: register, depreciation_schedule, disposal_summary, category_breakdown`,
            };
        }
      },
    ],
  ]);

  constructor() {
    super('asset_management');
  }
}
