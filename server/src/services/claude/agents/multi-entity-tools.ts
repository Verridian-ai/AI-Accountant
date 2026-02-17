/**
 * Multi-Entity Agent tool definitions — Anthropic tool schemas.
 *
 * Extracted from multi-entity-agent.ts to comply with the 300-line enterprise standard.
 */

import Anthropic from '@anthropic-ai/sdk';

/** Division 7A benchmark interest rate by FY start year */
export const DIV7A_BENCHMARK_RATES: Record<number, number> = {
  2022: 0.0447,
  2023: 0.0747,
  2024: 0.0847,
  2025: 0.0847, // estimate
};

export const MULTI_ENTITY_SYSTEM_PROMPT = `You are an Australian multi-entity financial management specialist. You help businesses that operate through multiple legal entities (companies, trusts, partnerships, sole traders, SMSFs). Your expertise includes:

1. Identifying which entity a transaction belongs to based on account linkages and transaction patterns
2. Detecting inter-entity transactions (loans, management fees, dividends, distributions, rent, service fees)
3. Calculating consolidation eliminations for group reporting
4. Ensuring compliance with transfer pricing rules and Section 100A (trust) regulations
5. Managing inter-entity loan agreements and Division 7A compliance (company loans to shareholders)
6. Generating consolidated financial reports with proper eliminations

Key Australian rules to apply:
- Division 7A: Company loans to shareholders/associates must be on compliant terms (benchmark interest rate, max 7-year term unsecured, 25-year secured)
- Section 100A: Trust distributions made through reimbursement agreements may be assessed to trustee at top marginal rate
- Transfer pricing: Related party transactions must be at arm's length
- Consolidation: Eliminate inter-entity revenue/expenses, loans, dividends when preparing group reports

Use Australian financial year (July 1 - June 30). All amounts in cents.`;

export const MULTI_ENTITY_TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: 'identify_entity_context',
    description:
      'Determine which entity a transaction or set of transactions belongs to based on account linkages and transaction patterns',
    input_schema: {
      type: 'object' as const,
      properties: {
        userId: { type: 'string' },
        accountId: { type: 'string', description: 'The bank account the transaction is in' },
        transactionDescription: {
          type: 'string',
          description: 'Transaction description to analyze',
        },
        amount: { type: 'number', description: 'Transaction amount in cents' },
      },
      required: ['userId', 'accountId'],
    },
  },
  {
    name: 'find_inter_entity_transactions',
    description:
      'Scan transactions to find potential inter-entity transfers, loans, and related-party dealings',
    input_schema: {
      type: 'object' as const,
      properties: {
        userId: { type: 'string' },
        financialYear: { type: 'string', description: 'e.g. 2024-25' },
        entityIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Entity IDs to scan. If omitted, scans all user entities.',
        },
      },
      required: ['userId', 'financialYear'],
    },
  },
  {
    name: 'calculate_eliminations',
    description: 'Calculate consolidation eliminations for confirmed inter-entity transactions',
    input_schema: {
      type: 'object' as const,
      properties: {
        userId: { type: 'string' },
        parentEntityId: { type: 'string', description: 'The consolidated parent entity' },
        financialYear: { type: 'string' },
        includeUnconfirmed: {
          type: 'boolean',
          description: 'Include pending transactions in elimination calc',
        },
      },
      required: ['userId', 'parentEntityId', 'financialYear'],
    },
  },
  {
    name: 'generate_consolidation',
    description:
      'Generate a full consolidated financial report for a parent entity and all subsidiaries',
    input_schema: {
      type: 'object' as const,
      properties: {
        userId: { type: 'string' },
        parentEntityId: { type: 'string' },
        financialYear: { type: 'string' },
        snapshotNotes: {
          type: 'string',
          description: 'Notes to attach to the consolidation snapshot',
        },
      },
      required: ['userId', 'parentEntityId', 'financialYear'],
    },
  },
];
