/**
 * Forecasting Agent tool definitions — Anthropic tool schemas and system prompt.
 *
 * Extracted from forecasting-agent.ts to comply with the 300-line enterprise standard.
 */

import Anthropic from '@anthropic-ai/sdk';

export const FORECASTING_SYSTEM_PROMPT = `You are an Australian financial forecasting AI agent. Your role is to:

1. Analyze historical transaction data to identify patterns and trends
2. Generate cash flow forecasts for future months
3. Detect seasonal spending patterns (e.g., holidays, BAS quarters, EOFY)
4. Identify anomalies where actual spending deviated significantly from patterns
5. Use temporal search to find historically similar periods for better accuracy

Key rules:
- All amounts are in CENTS (integer). $1,000.00 = 100000 cents.
- Australian financial year runs July-June.
- BAS quarters: Q1=Jul-Sep, Q2=Oct-Dec, Q3=Jan-Mar, Q4=Apr-Jun.
- Consider Australian seasonal patterns: Christmas spending (Dec), tax time (Jun-Jul), school terms.
- Be practical and data-driven — base forecasts on actual transaction patterns.
- Include confidence scores that reflect data quality and pattern strength.

Your workflow:
1. Use analyze_historical_patterns to understand past income/expense trends
2. Use temporal_forecast_search to find patterns from specific historical periods
3. Use cross_module_forecast_context to gather tax, compliance, and spending context
4. Use detect_seasonality to identify recurring patterns
5. Use generate_forecast to project future months (inline) OR generate_service_forecast for DB-persisted multi-model forecasting
6. Use compare_forecasts to evaluate different model types against each other
7. Use get_forecast_accuracy to check how past forecasts performed
8. Compile results with anomaly detection and summary

Return a JSON object matching the ForecastingOutput schema.`;

export const FORECASTING_TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: 'analyze_historical_patterns',
    description:
      'Analyze historical transaction data to identify income/expense trends and patterns.',
    input_schema: {
      type: 'object' as const,
      properties: {
        transactions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              date: { type: 'string' },
              amount: { type: 'number' },
              category: { type: 'string' },
            },
          },
        },
        months: { type: 'number', description: 'Number of months to analyze' },
      },
      required: ['transactions'],
    },
  },
  {
    name: 'detect_seasonality',
    description: 'Detect seasonal spending patterns from historical data.',
    input_schema: {
      type: 'object' as const,
      properties: {
        monthlyTotals: {
          type: 'object',
          additionalProperties: {
            type: 'object',
            properties: {
              income: { type: 'number' },
              expenses: { type: 'number' },
            },
          },
        },
      },
      required: ['monthlyTotals'],
    },
  },
  {
    name: 'generate_forecast',
    description:
      'Generate a quick cash flow forecast for future months based on averages and seasonal adjustments. For a more accurate DB-persisted forecast, use generate_service_forecast instead.',
    input_schema: {
      type: 'object' as const,
      properties: {
        avgMonthlyIncomeCents: { type: 'number' },
        avgMonthlyExpensesCents: { type: 'number' },
        currentBalanceCents: { type: 'number' },
        forecastMonths: { type: 'number' },
        seasonalAdjustments: {
          type: 'object',
          additionalProperties: { type: 'number' },
        },
      },
      required: ['avgMonthlyIncomeCents', 'avgMonthlyExpensesCents', 'forecastMonths'],
    },
  },
  {
    name: 'generate_service_forecast',
    description:
      'Generate a DB-persisted cash flow forecast using the CashFlowForecastService. Supports 3 model types: linear (trend extrapolation), seasonal (additive decomposition), ml_weighted (ensemble). Returns forecast periods with confidence bands.',
    input_schema: {
      type: 'object' as const,
      properties: {
        userId: { type: 'string', description: 'User ID to fetch historical transactions for' },
        accountId: { type: 'string', description: 'Optional account ID to scope the forecast' },
        type: {
          type: 'string',
          enum: ['linear', 'seasonal', 'ml_weighted'],
          description: 'Forecast model type',
        },
        startDate: { type: 'string', description: 'Forecast start date (ISO format YYYY-MM-DD)' },
        endDate: { type: 'string', description: 'Forecast end date (ISO format YYYY-MM-DD)' },
        granularity: {
          type: 'string',
          enum: ['daily', 'weekly', 'monthly', 'quarterly'],
          description: 'Period granularity',
        },
        confidenceLevel: { type: 'number', description: 'Confidence level 0-1 (default 0.85)' },
        categoryBreakdown: { type: 'boolean', description: 'Include per-category breakdown' },
      },
      required: ['userId', 'type', 'startDate', 'endDate', 'granularity'],
    },
  },
  {
    name: 'compare_forecasts',
    description:
      'Compare multiple forecasts side-by-side with accuracy metrics (MAE, RMSE, MAPE) and a recommendation for the best model.',
    input_schema: {
      type: 'object' as const,
      properties: {
        forecastIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of forecast IDs to compare',
        },
      },
      required: ['forecastIds'],
    },
  },
  {
    name: 'get_forecast_accuracy',
    description:
      'Calculate accuracy metrics for a forecast by comparing predicted vs actual values for completed periods.',
    input_schema: {
      type: 'object' as const,
      properties: {
        forecastId: { type: 'string', description: 'ID of the forecast to evaluate' },
      },
      required: ['forecastId'],
    },
  },
  {
    name: 'list_forecasts',
    description: 'List all forecasts for a user, optionally filtered by status.',
    input_schema: {
      type: 'object' as const,
      properties: {
        userId: { type: 'string', description: 'User ID' },
        status: { type: 'string', description: 'Optional status filter (active, archived)' },
      },
      required: ['userId'],
    },
  },
  {
    name: 'temporal_forecast_search',
    description:
      'Search historical forecast patterns for specific time periods. Useful for finding how similar periods performed historically.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search query for forecast patterns' },
        timeStart: { type: 'string', description: 'Start date (ISO format)' },
        timeEnd: { type: 'string', description: 'End date (ISO format)' },
        granularity: {
          type: 'string',
          description: 'Optional granularity (daily, weekly, monthly)',
        },
      },
      required: ['query', 'timeStart'],
    },
  },
  {
    name: 'cross_module_forecast_context',
    description:
      'Gather context from multiple modules (transactions, compliance, tax) that might affect forecast accuracy.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Context query' },
        modules: {
          type: 'array',
          items: { type: 'string' },
          description: 'Modules to search (defaults to transactions, compliance, tax)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_forecast_patterns',
    description: 'Search Cognee for known forecast patterns and budget benchmarks.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string' },
      },
      required: ['query'],
    },
  },
];
