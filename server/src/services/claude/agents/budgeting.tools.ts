/**
 * Budgeting Agent — Tool Definitions
 *
 * Anthropic tool schemas for budget creation, variance analysis,
 * forecast generation, adjustment suggestions, and Cognee searches.
 */

import type Anthropic from '@anthropic-ai/sdk';

export const budgetingTools: Anthropic.Tool[] = [
  {
    name: 'create_budget_from_history',
    description:
      'Generate a budget automatically from historical transaction patterns. Uses lookback period to calculate seasonal averages per category.',
    input_schema: {
      type: 'object' as const,
      properties: {
        userId: { type: 'string', description: 'User ID to create budget for' },
        name: { type: 'string', description: 'Budget name' },
        budgetType: {
          type: 'string',
          enum: ['annual', 'quarterly', 'monthly'],
          description: 'Budget period type',
        },
        periodStart: { type: 'string', description: 'Budget start date (YYYY-MM-DD)' },
        periodEnd: { type: 'string', description: 'Budget end date (YYYY-MM-DD)' },
        lookbackMonths: {
          type: 'number',
          description: 'Number of months of history to analyse (default 12)',
        },
        accountId: { type: 'string', description: 'Optional account ID filter' },
      },
      required: ['userId', 'name', 'budgetType', 'periodStart', 'periodEnd', 'lookbackMonths'],
    },
  },
  {
    name: 'calculate_variance',
    description:
      'Calculate budget vs actual spending for a specific budget. Returns variance per budget line with over/under indicators.',
    input_schema: {
      type: 'object' as const,
      properties: {
        budgetId: { type: 'string', description: 'Budget ID to calculate variance for' },
        includeDetails: {
          type: 'boolean',
          description: 'Include a high-level variance summary with health status',
        },
      },
      required: ['budgetId', 'includeDetails'],
    },
  },
  {
    name: 'generate_forecast',
    description:
      'Create a financial forecast under a specific scenario (optimistic, realistic, pessimistic, or custom). Returns forecast periods with amounts and confidence intervals per category.',
    input_schema: {
      type: 'object' as const,
      properties: {
        userId: { type: 'string', description: 'User ID' },
        name: { type: 'string', description: 'Scenario name' },
        scenarioType: {
          type: 'string',
          enum: ['optimistic', 'realistic', 'pessimistic', 'custom'],
          description: 'Forecast scenario type',
        },
        basePeriodStart: {
          type: 'string',
          description: 'Historical base period start (YYYY-MM-DD)',
        },
        basePeriodEnd: { type: 'string', description: 'Historical base period end (YYYY-MM-DD)' },
        forecastMonths: { type: 'number', description: 'Number of months to forecast' },
        assumptions: {
          type: 'object',
          description: 'Custom assumptions for the forecast',
          properties: {
            growthRate: { type: 'number', description: 'Monthly growth rate (e.g. 0.03 = 3%)' },
            inflationAdjust: { type: 'boolean', description: 'Whether to adjust for inflation' },
            seasonalWeight: {
              type: 'number',
              description: 'Seasonal weighting factor (1.0 = normal)',
            },
          },
        },
      },
      required: [
        'userId',
        'name',
        'scenarioType',
        'basePeriodStart',
        'basePeriodEnd',
        'forecastMonths',
      ],
    },
  },
  {
    name: 'suggest_budget_adjustments',
    description:
      'Analyze variance data and suggest specific budget adjustments. Identifies categories consistently over or under budget and proposes corrections.',
    input_schema: {
      type: 'object' as const,
      properties: {
        budgetId: {
          type: 'string',
          description: 'Budget ID to analyse for adjustment suggestions',
        },
      },
      required: ['budgetId'],
    },
  },
  {
    name: 'search_budget_patterns',
    description:
      'Search Cognee knowledge base for budget patterns, spending trends, and financial planning insights.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search query for budget/spending patterns' },
      },
      required: ['query'],
    },
  },
  {
    name: 'temporal_budget_search',
    description:
      'Search budget and spending patterns for a specific financial year. Converts FY notation (e.g., "2024-25") to date range.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Budget or spending query' },
        financialYear: { type: 'string', description: 'Financial year (e.g., "2024-25")' },
      },
      required: ['query', 'financialYear'],
    },
  },
  {
    name: 'cross_module_budget_context',
    description:
      'Gather cross-module context from transactions, tax, compliance, and forecasting modules to inform budget decisions.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Budget context query' },
      },
      required: ['query'],
    },
  },
];
