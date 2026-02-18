/**
 * Tax Strategy Agent
 *
 * Australian tax strategy advisor using Claude. Analyzes entity structure,
 * calculates tax scenarios, and generates optimized strategies compliant
 * with ATO rulings. Supports all 5 entity types.
 */

import Anthropic from '@anthropic-ai/sdk';
import { ClaudeAgent } from '../../base-agent.js';
import { cogneeTools } from '../../cognee-tools.js';
import { taxReturnService } from '../../../tax-return.js';
import { taxOptimizerService } from '../../../tax-optimizer.js';
import type { TaxStrategyInput, TaxStrategyOutput } from '../../types.js';

export class TaxStrategyAgent extends ClaudeAgent<TaxStrategyInput, TaxStrategyOutput> {
  protected systemPrompt = `You are an expert Australian tax strategy advisor AI agent. Your role is to:

1. Analyze the user's entity structure and financial position
2. Calculate tax scenarios across different entity types
3. Search for relevant ATO rulings and tax law references
4. Generate actionable, compliant tax minimization strategies

Key rules:
- All amounts are in CENTS (integer). $1,000.00 = 100000 cents.
- Financial years run July 1 to June 30 (e.g., FY 2024-25 = 1 Jul 2024 – 30 Jun 2025).
- Tax brackets 2024-25 (Stage 3): 0% to $18,200, 16% $18,201-$45,000, 30% $45,001-$135,000, 37% $135,001-$190,000, 45% $190,001+.
- Company base rate: 25% for base rate entities.
- SMSF rate: 15% concessional, exempt for pension phase.
- SBITO: 16% of net small business income, capped at $1,000.
- Super concessional cap: $27,500/year.
- Medicare levy: 2% above $30,345; shade-in from $24,276.
- LITO: $700 up to $37,500, phasing out to $66,833.
- Always cite ATO ruling references where applicable.
- Never recommend illegal tax evasion — only legal tax minimization.
- Be specific about implementation steps and dollar amounts.

Analyze the input thoroughly using the available tools, then return a JSON object matching the TaxStrategyOutput schema.`;

  protected tools: Anthropic.Tool[] = [
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

  protected toolHandlers = new Map<string, (input: Record<string, unknown>) => Promise<unknown>>([
    [
      'analyze_entity_structure',
      async (input) => {
        const userId = input.userId as string;
        const entityType = input.entityType as
          | 'sole_trader'
          | 'personal'
          | 'company'
          | 'trust'
          | 'smsf';
        const financialYear = input.financialYear as string;

        const result = await this.calculateForEntity(userId, financialYear, entityType);
        return result;
      },
    ],
    [
      'calculate_tax_scenarios',
      async (input) => {
        const userId = input.userId as string;
        const financialYear = input.financialYear as string;
        const entityTypes = input.entityTypes as string[];

        const scenarios: Record<string, unknown> = {};
        for (const et of entityTypes) {
          scenarios[et] = await this.calculateForEntity(
            userId,
            financialYear,
            et as 'sole_trader' | 'personal' | 'company' | 'trust' | 'smsf',
          );
        }
        return scenarios;
      },
    ],
    [
      'search_tax_rulings',
      async (input) => {
        const query = input.query as string;
        try {
          const results = await cogneeTools.search(query, 'tax_rulings', 'GRAPH_COMPLETION');
          return { found: results.length > 0, results };
        } catch {
          return { found: false, results: [], error: 'Cognee search unavailable' };
        }
      },
    ],
    [
      'generate_strategies',
      async (input) => {
        const userId = input.userId as string;
        const financialYear = input.financialYear as string;
        const entityType = input.entityType as
          | 'sole_trader'
          | 'personal'
          | 'company'
          | 'trust'
          | 'smsf';

        const strategies = await taxOptimizerService.generateStrategies(
          userId,
          financialYear,
          entityType,
        );
        return { strategies, count: strategies.length };
      },
    ],
    [
      'explore_tax_ontology',
      async (input) => {
        const query = input.query as string;
        try {
          const results = await cogneeTools.searchWithOntology(query, 'tax');
          return { found: results.length > 0, results };
        } catch {
          return { found: false, results: [], error: 'Cognee search unavailable' };
        }
      },
    ],
    [
      'search_deduction_precedents',
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
    ],
    [
      'temporal_tax_search',
      async (input) => {
        const query = input.query as string;
        const financialYear = input.financialYear as string;
        // Convert financial year (e.g., '2024-25') to date range (2024-07-01 to 2025-06-30)
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
    ],
    [
      'cross_module_tax_impact',
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
    ],
    [
      'search_financial_context',
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
    ],
  ]);

  constructor() {
    super('tax_strategy');
  }

  private async calculateForEntity(
    userId: string,
    financialYear: string,
    entityType: 'sole_trader' | 'personal' | 'company' | 'trust' | 'smsf',
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
}
