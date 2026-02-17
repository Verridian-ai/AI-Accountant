/**
 * Merchant Intelligence Agent tool definitions — Anthropic tool schemas.
 *
 * Extracted from merchant-intelligence.ts to comply with the 300-line enterprise standard.
 */

import Anthropic from '@anthropic-ai/sdk';

export const MERCHANT_INTEL_TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: 'search_cognee_merchant',
    description: 'Search Cognee knowledge graph for previously learned merchant mappings.',
    input_schema: {
      type: 'object' as const,
      properties: {
        merchantName: {
          type: 'string',
          description: 'The abbreviated merchant name from the bank statement',
        },
      },
      required: ['merchantName'],
    },
  },
  {
    name: 'resolve_merchant_name',
    description:
      'Resolve an abbreviated merchant name to its canonical business name using known patterns and heuristics.',
    input_schema: {
      type: 'object' as const,
      properties: {
        abbreviatedName: { type: 'string' },
        amount: {
          type: 'number',
          description: 'Transaction amount in cents (helps infer merchant type)',
        },
      },
      required: ['abbreviatedName'],
    },
  },
  {
    name: 'lookup_abn',
    description:
      'Look up a business on the Australian Business Register to check ABN and GST registration.',
    input_schema: {
      type: 'object' as const,
      properties: {
        businessName: { type: 'string', description: 'Business name to search for' },
      },
      required: ['businessName'],
    },
  },
  {
    name: 'infer_category',
    description: 'Infer the transaction category based on merchant name, industry, and amount.',
    input_schema: {
      type: 'object' as const,
      properties: {
        merchantName: { type: 'string' },
        industry: { type: 'string' },
        amount: { type: 'number' },
        description: { type: 'string' },
      },
      required: ['merchantName'],
    },
  },
  {
    name: 'store_merchant_mapping',
    description: 'Store a new merchant mapping in Cognee for future reference.',
    input_schema: {
      type: 'object' as const,
      properties: {
        abbreviatedName: { type: 'string' },
        canonicalName: { type: 'string' },
        abn: { type: 'string' },
        gstRegistered: { type: 'boolean' },
        industry: { type: 'string' },
        defaultCategory: { type: 'string' },
      },
      required: ['abbreviatedName', 'canonicalName', 'gstRegistered', 'defaultCategory'],
    },
  },
  {
    name: 'batch_resolve',
    description: 'Batch resolve multiple merchants at once using pattern matching.',
    input_schema: {
      type: 'object' as const,
      properties: {
        merchants: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              description: { type: 'string' },
              amount: { type: 'number' },
            },
          },
        },
      },
      required: ['merchants'],
    },
  },
];
