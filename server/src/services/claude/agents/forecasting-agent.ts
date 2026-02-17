/**
 * Forecasting Agent
 *
 * Analyzes historical transaction patterns to generate cash flow forecasts,
 * detect seasonal trends, and identify spending anomalies. Enhanced with
 * temporal search for time-aware pattern recognition and cross-module
 * context gathering.
 *
 * Tool handlers delegate to CashFlowForecastService for DB-backed forecasting
 * with linear regression, seasonal decomposition, and ML-weighted ensemble models.
 */

import Anthropic from '@anthropic-ai/sdk';
import { ClaudeAgent } from '../base-agent.js';
import { cogneeTools } from '../cognee-tools.js';
import { CashFlowForecastService } from '../../cash-flow-forecast.js';
import type { ForecastingInput, ForecastingOutput } from '../types.js';

export class ForecastingAgent extends ClaudeAgent<ForecastingInput, ForecastingOutput> {
  private forecastService = new CashFlowForecastService();

  protected systemPrompt = `You are an Australian financial forecasting AI agent. Your role is to:

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

  protected tools: Anthropic.Tool[] = [
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

  protected toolHandlers = new Map<string, (input: Record<string, unknown>) => Promise<unknown>>([
    [
      'analyze_historical_patterns',
      async (input) => {
        const transactions = input.transactions as Array<{
          date: string;
          amount: number;
          category?: string;
        }>;
        const months = (input.months as number) ?? 12;

        const monthlyTotals: Record<string, { income: number; expenses: number }> = {};
        const categoryTotals: Record<string, number> = {};

        for (const tx of transactions) {
          const month = tx.date?.slice(0, 7) ?? 'unknown';
          if (!monthlyTotals[month]) monthlyTotals[month] = { income: 0, expenses: 0 };

          if (tx.amount > 0) {
            monthlyTotals[month].income += tx.amount;
          } else {
            monthlyTotals[month].expenses += Math.abs(tx.amount);
          }

          const cat = tx.category ?? 'Uncategorised';
          categoryTotals[cat] = (categoryTotals[cat] ?? 0) + Math.abs(tx.amount);
        }

        const monthKeys = Object.keys(monthlyTotals).sort().slice(-months);
        const validMonths = monthKeys.length || 1;
        const totalIncome = monthKeys.reduce((s, k) => s + monthlyTotals[k].income, 0);
        const totalExpenses = monthKeys.reduce((s, k) => s + monthlyTotals[k].expenses, 0);

        return {
          monthlyTotals,
          avgMonthlyIncomeCents: Math.round(totalIncome / validMonths),
          avgMonthlyExpensesCents: Math.round(totalExpenses / validMonths),
          topCategories: Object.entries(categoryTotals)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10),
          monthsAnalyzed: validMonths,
        };
      },
    ],
    [
      'detect_seasonality',
      async (input) => {
        const monthlyTotals = input.monthlyTotals as Record<
          string,
          { income: number; expenses: number }
        >;

        // Group by calendar month (1-12) to find seasonal patterns
        const monthGroups: Record<number, { income: number[]; expenses: number[] }> = {};
        for (const [key, val] of Object.entries(monthlyTotals)) {
          const monthNum = parseInt(key.slice(5, 7), 10);
          if (!monthGroups[monthNum]) monthGroups[monthNum] = { income: [], expenses: [] };
          monthGroups[monthNum].income.push(val.income);
          monthGroups[monthNum].expenses.push(val.expenses);
        }

        const patterns: Array<{ pattern: string; months: number[]; impact: string }> = [];

        // Detect high-expense months
        const allAvgs = Object.entries(monthGroups).map(([m, vals]) => ({
          month: parseInt(m, 10),
          avgExpense: vals.expenses.reduce((s, v) => s + v, 0) / vals.expenses.length,
        }));
        const overallAvg = allAvgs.reduce((s, v) => s + v.avgExpense, 0) / allAvgs.length;

        const highMonths = allAvgs.filter((m) => m.avgExpense > overallAvg * 1.2);
        if (highMonths.length > 0) {
          patterns.push({
            pattern: 'High spending months',
            months: highMonths.map((m) => m.month),
            impact: `Spending ${Math.round((highMonths[0].avgExpense / overallAvg - 1) * 100)}% above average`,
          });
        }

        const lowMonths = allAvgs.filter((m) => m.avgExpense < overallAvg * 0.8);
        if (lowMonths.length > 0) {
          patterns.push({
            pattern: 'Low spending months',
            months: lowMonths.map((m) => m.month),
            impact: `Spending ${Math.round((1 - lowMonths[0].avgExpense / overallAvg) * 100)}% below average`,
          });
        }

        return { patterns, monthAverages: allAvgs };
      },
    ],
    [
      'generate_forecast',
      async (input) => {
        const avgIncome = input.avgMonthlyIncomeCents as number;
        const avgExpenses = input.avgMonthlyExpensesCents as number;
        const currentBalance = (input.currentBalanceCents as number) ?? 0;
        const months = (input.forecastMonths as number) ?? 6;
        const seasonalAdj = (input.seasonalAdjustments as Record<string, number>) ?? {};

        const forecasts: Array<{
          month: string;
          projectedIncomeCents: number;
          projectedExpensesCents: number;
          projectedBalanceCents: number;
          confidence: number;
        }> = [];

        let balance = currentBalance;
        const now = new Date();
        for (let i = 1; i <= months; i++) {
          const date = new Date(now);
          date.setMonth(date.getMonth() + i);
          const monthKey = date.toISOString().slice(0, 7);
          const monthNum = date.getMonth() + 1;
          const adj = seasonalAdj[String(monthNum)] ?? 1.0;

          const income = Math.round(avgIncome * adj);
          const expenses = Math.round(avgExpenses * adj);
          balance += income - expenses;

          // Confidence decreases with distance
          const confidence = Math.max(0.3, 1.0 - i * 0.1);

          forecasts.push({
            month: monthKey,
            projectedIncomeCents: income,
            projectedExpensesCents: expenses,
            projectedBalanceCents: balance,
            confidence: Math.round(confidence * 100) / 100,
          });
        }

        return { forecasts };
      },
    ],
    [
      'generate_service_forecast',
      async (input) => {
        const userId = input.userId as string;
        const accountId = (input.accountId as string) ?? null;
        const type = (input.type as 'linear' | 'seasonal' | 'ml_weighted') ?? 'seasonal';
        const startDate = input.startDate as string;
        const endDate = input.endDate as string;
        const granularity =
          (input.granularity as 'daily' | 'weekly' | 'monthly' | 'quarterly') ?? 'monthly';
        const confidenceLevel = input.confidenceLevel as number | undefined;
        const categoryBreakdown = input.categoryBreakdown as boolean | undefined;

        try {
          const result = await this.forecastService.generateForecast(userId, accountId, {
            type,
            startDate,
            endDate,
            granularity,
            confidenceLevel,
            categoryBreakdown,
          });
          return {
            success: true,
            forecastId: result.id,
            forecastType: result.forecastType,
            startDate: result.startDate,
            endDate: result.endDate,
            granularity: result.granularity,
            confidenceLevel: result.confidenceLevel,
            periodsGenerated: result.periods.length,
            periods: result.periods,
          };
        } catch (err: unknown) {
          return { success: false, error: err instanceof Error ? err.message : 'Forecast generation failed' };
        }
      },
    ],
    [
      'compare_forecasts',
      async (input) => {
        const forecastIds = input.forecastIds as string[];
        try {
          const comparison = await this.forecastService.compareForecasts(forecastIds);
          return { success: true, ...comparison };
        } catch (err: unknown) {
          return { success: false, error: err instanceof Error ? err.message : 'Comparison failed' };
        }
      },
    ],
    [
      'get_forecast_accuracy',
      async (input) => {
        const forecastId = input.forecastId as string;
        try {
          // First backfill actuals, then calculate accuracy
          await this.forecastService.updateActuals(forecastId);
          const accuracy = await this.forecastService.calculateAccuracy(forecastId);
          return { success: true, forecastId, ...accuracy };
        } catch (err: unknown) {
          return { success: false, error: err instanceof Error ? err.message : 'Accuracy calculation failed' };
        }
      },
    ],
    [
      'list_forecasts',
      async (input) => {
        const userId = input.userId as string;
        const status = input.status as string | undefined;
        try {
          const forecasts = await this.forecastService.getForecasts(userId, status);
          return { success: true, count: forecasts.length, forecasts };
        } catch (err: unknown) {
          return { success: false, error: err instanceof Error ? err.message : 'Failed to list forecasts' };
        }
      },
    ],
    [
      'temporal_forecast_search',
      async (input) => {
        const query = input.query as string;
        const timeStart = input.timeStart as string;
        const timeEnd = input.timeEnd as string | undefined;
        try {
          const results = await cogneeTools.temporalSearch(query, 'budget_patterns', {
            start: timeStart,
            end: timeEnd ?? '',
          });
          return { found: results.length > 0, results };
        } catch {
          return { found: false, results: [], error: 'Temporal search unavailable' };
        }
      },
    ],
    [
      'cross_module_forecast_context',
      async (input) => {
        const query = input.query as string;
        const modules = (input.modules as string[]) ?? ['transactions', 'compliance', 'tax'];
        try {
          const results = await cogneeTools.crossModuleSearch(query, modules);
          return { found: results.length > 0, results };
        } catch {
          return { found: false, results: [], error: 'Cross-module search unavailable' };
        }
      },
    ],
    [
      'search_forecast_patterns',
      async (input) => {
        const query = input.query as string;
        try {
          const results = await cogneeTools.search(query, 'budget_patterns', 'GRAPH_COMPLETION');
          return { found: results.length > 0, results };
        } catch {
          return { found: false, results: [], error: 'Cognee search unavailable' };
        }
      },
    ],
  ]);

  constructor() {
    super('forecasting');
  }
}
