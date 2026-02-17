/**
 * Tax Strategy Agent — Tool Definitions
 *
 * Anthropic tool schemas for entity structure analysis, tax scenario
 * calculation, ATO ruling search, strategy generation, ontology
 * exploration, deduction precedents, temporal search, cross-module
 * impact, and financial context search.
 */

import type Anthropic from '@anthropic-ai/sdk';

export const taxStrategyTools: Anthropic.Tool[] = [
  {
    name: 'analyze_entity_structure',
    description:
      "Analyze the user's business entity structure and determine optimal entity type for tax purposes.",
    input_schema: {
      type: 'object' as const,
      properties: {
        userId: { type: 'string' },
        entityType: {
          type: 'string',
          enum: ['sole_trader', 'personal', 'company', 'trust', 'smsf'],
        },
        financialYear: { type: 'string' },
      },
      required: ['userId', 'entityType', 'financialYear'],
    },
  },
  {
    name: 'calculate_tax_scenarios',
    description: 'Calculate tax liability under different entity structures for comparison.',
    input_schema: {
      type: 'object' as const,
      properties: {
        userId: { type: 'string' },
        financialYear: { type: 'string' },
        entityTypes: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['sole_trader', 'personal', 'company', 'trust', 'smsf'],
          },
        },
      },
      required: ['userId', 'financialYear', 'entityTypes'],
    },
  },
  {
    name: 'search_tax_rulings',
    description:
      'Search Cognee knowledge base for ATO tax rulings, legislation references, and precedents.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search query for tax rulings' },
      },
      required: ['query'],
    },
  },
  {
    name: 'generate_strategies',
    description: "Generate tax optimization strategies based on the user's financial position.",
    input_schema: {
      type: 'object' as const,
      properties: {
        userId: { type: 'string' },
        financialYear: { type: 'string' },
        entityType: {
          type: 'string',
          enum: ['sole_trader', 'personal', 'company', 'trust', 'smsf'],
        },
      },
      required: ['userId', 'financialYear', 'entityType'],
    },
  },
  {
    name: 'explore_tax_ontology',
    description:
      'Explore the tax ontology graph for relationships between tax concepts, rulings, deductions, and entity types.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Tax concept or question to explore in the ontology',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_deduction_precedents',
    description:
      'Search for deduction precedents using DataPoint-structured entity matching. Finds similar deduction claims from the knowledge graph.',
    input_schema: {
      type: 'object' as const,
      properties: {
        deductionType: {
          type: 'string',
          description: 'Type of deduction (e.g., "home office", "motor vehicle", "travel")',
        },
        entityType: {
          type: 'string',
          description: 'Entity type (e.g., "sole_trader", "company", "trust")',
        },
      },
      required: ['deductionType', 'entityType'],
    },
  },
  {
    name: 'temporal_tax_search',
    description:
      'Search tax strategies and deduction patterns for a specific financial year. Converts FY notation (e.g., "2024-25") to date range.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Tax strategy or deduction query' },
        financialYear: { type: 'string', description: 'Financial year (e.g., "2024-25")' },
      },
      required: ['query', 'financialYear'],
    },
  },
  {
    name: 'cross_module_tax_impact',
    description:
      'Assess cross-module tax impact from spending, compliance, and forecasts. Gathers context from tax, transactions, compliance, and forecasting modules.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Tax impact query' },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_financial_context',
    description:
      "Search Cognee for the user's financial context, transaction patterns, and history.",
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
