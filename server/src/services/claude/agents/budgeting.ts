/**
 * Budgeting Agent
 *
 * AI agent that automates budget creation from historical transaction
 * data, monitors spending vs budget, generates multi-scenario forecasts,
 * and suggests actionable budget adjustments. Uses BudgetService and
 * ForecastingService for data operations.
 */

import Anthropic from '@anthropic-ai/sdk';
import { ClaudeAgent } from '../base-agent.js';
import { cogneeTools } from '../cognee-tools.js';
import { BudgetService } from '../../budgets.js';
import { ForecastingService } from '../../forecasting.js';
import type { BudgetingInput, BudgetingOutput } from '../types.js';

const budgetService = new BudgetService();
const forecastingService = new ForecastingService();

export class BudgetingAgent extends ClaudeAgent<BudgetingInput, BudgetingOutput> {
  protected systemPrompt = `You are an expert budget analyst and financial planner for an Australian small business accounting platform.
You help users create realistic budgets from their transaction history, monitor actual vs budgeted spending,
generate forward-looking forecasts under multiple scenarios, and suggest actionable adjustments.

Key responsibilities:
- Create budgets based on historical spending patterns with seasonal adjustments
- Calculate and explain budget variances clearly
- Generate multi-scenario forecasts (optimistic, realistic, pessimistic)
- Suggest specific, actionable budget adjustments
- Flag categories with consistent overspending
- Identify savings opportunities
- All monetary values are in AUD cents (integer). $1,000.00 = 100000 cents.
- Consider Australian financial year (July-June) cycles

Analyze the input thoroughly using the available tools, then return a JSON object matching the BudgetingOutput schema.`;

  protected tools: Anthropic.Tool[] = [
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

  protected toolHandlers = new Map<string, (input: Record<string, unknown>) => Promise<unknown>>([
    [
      'create_budget_from_history',
      async (input) => {
        const userId = input.userId as string;
        const name = input.name as string;
        const budgetType = input.budgetType as 'annual' | 'quarterly' | 'monthly';
        const periodStart = input.periodStart as string;
        const periodEnd = input.periodEnd as string;
        const lookbackMonths = input.lookbackMonths as number;
        const accountId = input.accountId as string | undefined;

        const budget = await budgetService.createBudget(userId, {
          name,
          budgetType,
          periodStart,
          periodEnd,
          accountId,
          autoGenerate: true,
          lookbackMonths,
        });

        return {
          budgetId: budget.id,
          name: budget.name,
          budgetType: budget.budgetType,
          periodStart: budget.periodStart,
          periodEnd: budget.periodEnd,
          totalAmount: budget.totalAmount,
          linesCount: budget.lines?.length ?? 0,
          lines: budget.lines,
        };
      },
    ],
    [
      'calculate_variance',
      async (input) => {
        const budgetId = input.budgetId as string;
        const includeDetails = input.includeDetails as boolean;

        const variance = await budgetService.calculateVariance(budgetId);

        if (includeDetails) {
          const summary = await budgetService.getVarianceSummary(budgetId);
          return { lines: variance, summary };
        }

        return { lines: variance };
      },
    ],
    [
      'generate_forecast',
      async (input) => {
        const userId = input.userId as string;
        const name = input.name as string;
        const scenarioType = input.scenarioType as
          | 'optimistic'
          | 'realistic'
          | 'pessimistic'
          | 'custom';
        const basePeriodStart = input.basePeriodStart as string;
        const basePeriodEnd = input.basePeriodEnd as string;
        const forecastMonths = input.forecastMonths as number;
        const assumptions = input.assumptions as
          | {
              growthRate?: number;
              inflationAdjust?: boolean;
              seasonalWeight?: number;
            }
          | undefined;

        const scenario = await forecastingService.createScenario(userId, {
          name,
          scenarioType,
          basePeriodStart,
          basePeriodEnd,
          forecastMonths,
          assumptions,
        });

        const periods = await forecastingService.generateForecast(scenario.id);

        return {
          scenarioId: scenario.id,
          scenarioType: scenario.scenarioType,
          assumptions: scenario.assumptions,
          periodsCount: periods.length,
          periods,
        };
      },
    ],
    [
      'suggest_budget_adjustments',
      async (input) => {
        const budgetId = input.budgetId as string;

        const summary = await budgetService.getVarianceSummary(budgetId);
        const suggestions: Array<{
          category: string;
          currentBudgeted: number;
          suggestedAmount: number;
          reason: string;
          confidenceScore: number;
        }> = [];

        // Analyse over-budget categories: suggest increasing to 110% of actual average
        for (const cat of summary.overBudgetCategories) {
          const actual = summary.topVariances.find((v) => v.category === cat.category);
          if (actual && cat.percent > 10) {
            suggestions.push({
              category: cat.category,
              currentBudgeted: actual.budgeted,
              suggestedAmount: Math.round(actual.actual * 1.1),
              reason: `Consistently over budget by ${cat.percent.toFixed(1)}%. Suggest increasing to 110% of actual spending to accommodate real patterns.`,
              confidenceScore: Math.min(0.95, 0.6 + cat.percent / 100),
            });
          }
        }

        // Analyse under-budget categories: suggest reducing to 90% of actual average
        for (const cat of summary.underBudgetCategories) {
          const actual = summary.topVariances.find((v) => v.category === cat.category);
          if (actual && Math.abs(cat.percent) > 30) {
            suggestions.push({
              category: cat.category,
              currentBudgeted: actual.budgeted,
              suggestedAmount: Math.round(actual.actual * 0.9),
              reason: `Under budget by ${Math.abs(cat.percent).toFixed(1)}% (utilisation below 70%). Suggest reducing to 90% of actual to free up budget capacity.`,
              confidenceScore: Math.min(0.9, 0.5 + Math.abs(cat.percent) / 200),
            });
          }
        }

        return {
          budgetId,
          health: summary.health,
          totalBudgeted: summary.totalBudgeted,
          totalActual: summary.totalActual,
          totalVariance: summary.totalVariance,
          suggestions,
          suggestionsCount: suggestions.length,
        };
      },
    ],
    [
      'search_budget_patterns',
      async (input) => {
        const query = input.query as string;
        try {
          const results = await cogneeTools.search(query, 'budget_patterns', 'CHUNKS');
          return { found: results.length > 0, results };
        } catch {
          return { found: false, results: [], error: 'Cognee search unavailable' };
        }
      },
    ],
    [
      'temporal_budget_search',
      async (input) => {
        const query = input.query as string;
        const financialYear = input.financialYear as string;
        const match = financialYear.match(/^(\d{4})-(\d{2})$/);
        if (!match) {
          return {
            found: false,
            results: [],
            error: `Invalid financial year format: ${financialYear}. Expected "2024-25".`,
          };
        }
        const startYear = parseInt(match[1], 10);
        const timeRange = { start: `${startYear}-07-01`, end: `${startYear + 1}-06-30` };
        try {
          const results = await cogneeTools.temporalSearch(query, 'budget_patterns', timeRange);
          return { found: results.length > 0, results, period: timeRange };
        } catch {
          return { found: false, results: [], error: 'Temporal search unavailable' };
        }
      },
    ],
    [
      'cross_module_budget_context',
      async (input) => {
        const query = input.query as string;
        try {
          const results = await cogneeTools.crossModuleSearch(query, [
            'transactions',
            'tax',
            'compliance',
            'forecasting',
          ]);
          return { found: results.length > 0, results };
        } catch {
          return { found: false, results: [], error: 'Cross-module search unavailable' };
        }
      },
    ],
  ]);

  constructor() {
    super('budgeting');
  }
}
