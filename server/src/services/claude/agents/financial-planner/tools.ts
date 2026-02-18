/**
 * Financial Planner Agent — Tool Definitions
 *
 * Anthropic tool schemas for spending analysis, wealth projection,
 * debt strategy comparison, budget generation, and Cognee search.
 */

import type Anthropic from '@anthropic-ai/sdk';

export const financialPlannerTools: Anthropic.Tool[] = [
  {
    name: 'analyze_spending_patterns',
    description:
      'Analyze transaction data to identify spending patterns, income sources, and category breakdowns.',
    input_schema: {
      type: 'object' as const,
      properties: {
        transactions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              date: { type: 'string' },
              description: { type: 'string' },
              amount: { type: 'number' },
              category: { type: 'string' },
            },
            required: ['id', 'amount'],
          },
        },
      },
      required: ['transactions'],
    },
  },
  {
    name: 'project_wealth',
    description:
      'Project future net worth based on current savings rate, investment returns, and time horizon.',
    input_schema: {
      type: 'object' as const,
      properties: {
        currentSavingsCents: { type: 'number' },
        monthlySavingsCents: { type: 'number' },
        riskProfile: {
          type: 'string',
          enum: ['conservative', 'balanced', 'growth', 'aggressive'],
        },
        yearsToProject: { type: 'number' },
      },
      required: ['currentSavingsCents', 'monthlySavingsCents', 'riskProfile'],
    },
  },
  {
    name: 'compare_debt_strategies',
    description:
      'Compare avalanche (highest interest first) vs snowball (smallest balance first) debt repayment strategies.',
    input_schema: {
      type: 'object' as const,
      properties: {
        debts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              balanceCents: { type: 'number' },
              interestRate: {
                type: 'number',
                description: 'Annual interest rate as decimal (e.g., 0.05 for 5%)',
              },
              minimumPaymentCents: { type: 'number' },
            },
            required: ['name', 'balanceCents', 'interestRate', 'minimumPaymentCents'],
          },
        },
        extraPaymentCents: {
          type: 'number',
          description: 'Extra monthly payment beyond minimums',
        },
      },
      required: ['debts'],
    },
  },
  {
    name: 'generate_budget',
    description: 'Generate a personalized monthly budget based on income and spending analysis.',
    input_schema: {
      type: 'object' as const,
      properties: {
        monthlyIncomeCents: { type: 'number' },
        currentSpendingByCategory: {
          type: 'object',
          additionalProperties: { type: 'number' },
        },
        riskProfile: {
          type: 'string',
          enum: ['conservative', 'balanced', 'growth', 'aggressive'],
        },
      },
      required: ['monthlyIncomeCents', 'currentSpendingByCategory'],
    },
  },
  {
    name: 'search_financial_patterns',
    description:
      'Search knowledge graph for financial transaction patterns using DataPoint-structured entity matching.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search query for financial patterns' },
        patternType: {
          type: 'string',
          description: 'Optional pattern type filter (e.g., "spending", "income", "savings")',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'temporal_financial_search',
    description: 'Search financial patterns from specific time periods for planning context.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Financial pattern query' },
        timeRange: {
          type: 'object',
          description: 'Time range to search within',
          properties: {
            start: { type: 'string', description: 'Start date (ISO format)' },
            end: { type: 'string', description: 'End date (ISO format)' },
          },
          required: ['start', 'end'],
        },
      },
      required: ['query', 'timeRange'],
    },
  },
  {
    name: 'cross_module_planning_context',
    description:
      'Gather comprehensive planning context from all relevant modules including transactions, forecasting, tax, and analytics.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Planning context query' },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_financial_context',
    description: 'Search Cognee for financial advice, benchmarks, and context.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string' },
        userId: { type: 'string' },
      },
      required: ['query'],
    },
  },
];
