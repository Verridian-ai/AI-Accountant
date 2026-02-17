/**
 * Vercel Tax Strategy — Tool Handler Implementations
 *
 * Contains the handler functions for entity analysis, tax scenarios,
 * ruling search, strategy generation, ontology exploration,
 * deduction precedents, temporal search, cross-module impact,
 * and financial context search.
 */

import { adaptLegacyTool } from '../../tool-adapter.js';
import { cogneeTools } from '../../cognee-tools.js';
import { taxReturnService } from '../../../tax-return.js';
import { taxOptimizerService } from '../../../tax-optimizer.js';
import type { ToolSet } from 'ai';

type EntityType = 'sole_trader' | 'personal' | 'company' | 'trust' | 'smsf';

export async function calculateForEntity(
  userId: string,
  financialYear: string,
  entityType: EntityType,
) {
  switch (entityType) {
    case 'sole_trader':
      return taxReturnService.calculateSoleTraderReturn(userId, financialYear);
    case 'personal':
      return taxReturnService.calculatePersonalReturn(userId, financialYear);
    case 'company':
      return taxReturnService.calculateCompanyReturn(userId, financialYear);
    case 'trust':
      return taxReturnService.calculateTrustReturn(userId, financialYear);
    case 'smsf':
      return taxReturnService.calculateSMSFReturn(userId, financialYear);
  }
}

export function buildTaxStrategyTools(): ToolSet {
  const tools: ToolSet = {};

  tools['analyze_entity_structure'] = adaptLegacyTool(
    'analyze_entity_structure',
    "Analyze the user's business entity structure and determine optimal entity type for tax purposes.",
    {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'User ID' },
        entityType: {
          type: 'string',
          description: 'Entity type: sole_trader, personal, company, trust, or smsf',
        },
        financialYear: { type: 'string', description: 'Financial year (e.g., "2024-25")' },
      },
      required: ['userId', 'entityType', 'financialYear'],
    },
    async (input) => {
      const userId = input.userId as string;
      const entityType = input.entityType as EntityType;
      const financialYear = input.financialYear as string;
      return calculateForEntity(userId, financialYear, entityType);
    },
  );

  tools['calculate_tax_scenarios'] = adaptLegacyTool(
    'calculate_tax_scenarios',
    'Calculate tax liability under different entity structures for comparison.',
    {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'User ID' },
        financialYear: { type: 'string', description: 'Financial year (e.g., "2024-25")' },
        entityTypes: {
          type: 'array',
          description:
            'Array of entity types to compare: sole_trader, personal, company, trust, smsf',
        },
      },
      required: ['userId', 'financialYear', 'entityTypes'],
    },
    async (input) => {
      const userId = input.userId as string;
      const financialYear = input.financialYear as string;
      const entityTypes = input.entityTypes as string[];

      const scenarios: Record<string, unknown> = {};
      for (const et of entityTypes) {
        scenarios[et] = await calculateForEntity(userId, financialYear, et as EntityType);
      }
      return scenarios;
    },
  );

  tools['search_tax_rulings'] = adaptLegacyTool(
    'search_tax_rulings',
    'Search Cognee knowledge base for ATO tax rulings, legislation references, and precedents.',
    {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query for tax rulings' },
      },
      required: ['query'],
    },
    async (input) => {
      const query = input.query as string;
      try {
        const results = await cogneeTools.search(query, 'tax_rulings', 'GRAPH_COMPLETION');
        return { found: results.length > 0, results };
      } catch {
        return { found: false, results: [], error: 'Cognee search unavailable' };
      }
    },
  );

  tools['generate_strategies'] = adaptLegacyTool(
    'generate_strategies',
    "Generate tax optimization strategies based on the user's financial position.",
    {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'User ID' },
        financialYear: { type: 'string', description: 'Financial year (e.g., "2024-25")' },
        entityType: {
          type: 'string',
          description: 'Entity type: sole_trader, personal, company, trust, or smsf',
        },
      },
      required: ['userId', 'financialYear', 'entityType'],
    },
    async (input) => {
      const userId = input.userId as string;
      const financialYear = input.financialYear as string;
      const entityType = input.entityType as EntityType;

      const strategies = await taxOptimizerService.generateStrategies(
        userId,
        financialYear,
        entityType,
      );
      return { strategies, count: strategies.length };
    },
  );

  tools['explore_tax_ontology'] = adaptLegacyTool(
    'explore_tax_ontology',
    'Explore the tax ontology graph for relationships between tax concepts, rulings, deductions, and entity types.',
    {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Tax concept or question to explore in the ontology',
        },
      },
      required: ['query'],
    },
    async (input) => {
      const query = input.query as string;
      try {
        const results = await cogneeTools.searchWithOntology(query, 'tax');
        return { found: results.length > 0, results };
      } catch {
        return { found: false, results: [], error: 'Cognee search unavailable' };
      }
    },
  );

  tools['search_deduction_precedents'] = adaptLegacyTool(
    'search_deduction_precedents',
    'Search for deduction precedents using DataPoint-structured entity matching.',
    {
      type: 'object',
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
    async (input) => {
      const deductionType = input.deductionType as string;
      const entityType = input.entityType as string;
      try {
        const results = await cogneeTools.searchWithDataPoint(
          `${deductionType} ${entityType}`,
          'TaxEvent',
        );
        return { found: results.length > 0, results };
      } catch {
        return { found: false, results: [], error: 'Cognee search unavailable' };
      }
    },
  );

  tools['temporal_tax_search'] = adaptLegacyTool(
    'temporal_tax_search',
    'Search tax strategies and deduction patterns for a specific financial year.',
    {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Tax strategy or deduction query' },
        financialYear: { type: 'string', description: 'Financial year (e.g., "2024-25")' },
      },
      required: ['query', 'financialYear'],
    },
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
        const results = await cogneeTools.temporalSearch(query, 'tax_strategies', timeRange);
        return { found: results.length > 0, results, period: timeRange };
      } catch {
        return { found: false, results: [], error: 'Temporal search unavailable' };
      }
    },
  );

  tools['cross_module_tax_impact'] = adaptLegacyTool(
    'cross_module_tax_impact',
    'Assess cross-module tax impact from spending, compliance, and forecasts.',
    {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Tax impact query' },
      },
      required: ['query'],
    },
    async (input) => {
      const query = input.query as string;
      try {
        const results = await cogneeTools.crossModuleSearch(query, [
          'tax',
          'transactions',
          'compliance',
          'forecasting',
        ]);
        return { found: results.length > 0, results };
      } catch {
        return { found: false, results: [], error: 'Cross-module search unavailable' };
      }
    },
  );

  tools['search_financial_context'] = adaptLegacyTool(
    'search_financial_context',
    "Search Cognee for the user's financial context, transaction patterns, and history.",
    {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query for financial context' },
        userId: { type: 'string', description: 'Optional user ID for user-specific context' },
      },
      required: ['query'],
    },
    async (input) => {
      const query = input.query as string;
      const userId = input.userId as string | undefined;
      const dataset = userId ? `transactions_user_${userId}` : 'financial_context';
      try {
        const results = await cogneeTools.search(query, dataset, 'CHUNKS');
        return { found: results.length > 0, results };
      } catch {
        return { found: false, results: [], error: 'Cognee search unavailable' };
      }
    },
  );

  return tools;
}
