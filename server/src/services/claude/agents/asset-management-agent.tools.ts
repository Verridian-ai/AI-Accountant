/**
 * Asset Management Agent — Tool Definitions & Constants
 *
 * Anthropic tool schemas for depreciation calculation, method suggestion,
 * write-off eligibility checking, and asset report generation.
 */

import type Anthropic from '@anthropic-ai/sdk';

/** SBE instant write-off threshold in cents ($20,000) */
export const INSTANT_WRITE_OFF_THRESHOLD = 20_000_00;

/** SBE aggregated turnover threshold in cents ($10M) */
export const SBE_TURNOVER_THRESHOLD = 10_000_000_00;

export const assetManagementTools: Anthropic.Tool[] = [
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
    description: 'Check if an asset qualifies for instant asset write-off under current ATO rules',
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
