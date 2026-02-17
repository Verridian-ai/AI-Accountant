/**
 * BudgetAnalyzer Agent — Tool Definitions
 *
 * Anthropic tool schemas for spending analysis, recurring detection,
 * monthly averages, balance projection, anomaly detection, Cognee search,
 * and savings rate calculation.
 */

import type Anthropic from '@anthropic-ai/sdk';

export const budgetAnalyzerTools: Anthropic.Tool[] = [
  {
    name: 'analyze_spending_by_category',
    description: 'Get spending totals per category with month-over-month trends.',
    input_schema: {
      type: 'object' as const,
      properties: {
        transactions: {
          type: 'array',
          items: { type: 'object' },
        },
        period: {
          type: 'object',
          properties: {
            start: { type: 'string' },
            end: { type: 'string' },
          },
        },
      },
      required: ['transactions'],
    },
  },
  {
    name: 'identify_recurring',
    description: 'Detect subscriptions and regular payments by pattern matching.',
    input_schema: {
      type: 'object' as const,
      properties: {
        transactions: {
          type: 'array',
          items: { type: 'object' },
        },
      },
      required: ['transactions'],
    },
  },
  {
    name: 'calculate_monthly_averages',
    description: 'Calculate average income and expense per month.',
    input_schema: {
      type: 'object' as const,
      properties: {
        transactions: {
          type: 'array',
          items: { type: 'object' },
        },
        months: { type: 'number', description: 'Number of months to analyze' },
      },
      required: ['transactions'],
    },
  },
  {
    name: 'project_balance',
    description: 'Project future account balance based on historical patterns.',
    input_schema: {
      type: 'object' as const,
      properties: {
        currentBalance: { type: 'number' },
        transactions: { type: 'array', items: { type: 'object' } },
        months: { type: 'number', description: 'Months to project' },
      },
      required: ['currentBalance', 'transactions', 'months'],
    },
  },
  {
    name: 'find_anomalies',
    description: 'Find unusually large or unusual transactions.',
    input_schema: {
      type: 'object' as const,
      properties: {
        transactions: { type: 'array', items: { type: 'object' } },
        stdDevThreshold: {
          type: 'number',
          description: 'Standard deviation threshold (default 2)',
        },
      },
      required: ['transactions'],
    },
  },
  {
    name: 'search_financial_context',
    description: 'Search Cognee for historical financial context.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string' },
      },
      required: ['query'],
    },
  },
  {
    name: 'calculate_savings_rate',
    description: 'Calculate savings rate and compare to Australian benchmarks.',
    input_schema: {
      type: 'object' as const,
      properties: {
        income: { type: 'number', description: 'Total income in cents' },
        expenses: { type: 'number', description: 'Total expenses in cents' },
      },
      required: ['income', 'expenses'],
    },
  },
];
