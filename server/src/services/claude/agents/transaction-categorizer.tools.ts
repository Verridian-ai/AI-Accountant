/**
 * TransactionCategorizer Agent — Tool Definitions & Constants
 *
 * Anthropic tool schemas for merchant memory lookup, similar transaction search,
 * category taxonomy retrieval, and batch categorization. Also exports the
 * category taxonomy constant array.
 */

import type Anthropic from '@anthropic-ai/sdk';

// Category taxonomy — kept in sync with client/src/features/transactions/constants/categories.ts
export const CATEGORY_TAXONOMY = [
  'Salary & Wages',
  'Business Income',
  'Investment Income',
  'Government Benefits',
  'Rental Income',
  'Other Income',
  'Groceries',
  'Dining & Takeaway',
  'Transport',
  'Fuel',
  'Utilities',
  'Rent',
  'Mortgage',
  'Insurance',
  'Medical & Health',
  'Education',
  'Entertainment',
  'Clothing & Personal',
  'Home & Garden',
  'Subscriptions',
  'Phone & Internet',
  'Professional Fees',
  'Office Supplies',
  'Travel',
  'Charity & Donations',
  'Childcare',
  'Pet Care',
  'Bank Fees',
  'Interest Charged',
  'Interest Earned',
  'Tax',
  'Superannuation',
  'Transfer',
  'Cash Withdrawal',
  'Refund',
  'Uncategorized',
];

export const transactionCategorizerTools: Anthropic.Tool[] = [
  {
    name: 'lookup_merchant_memory',
    description: 'Check if a merchant was previously categorized in merchant memory.',
    input_schema: {
      type: 'object' as const,
      properties: {
        description: {
          type: 'string',
          description: 'Transaction description to look up',
        },
      },
      required: ['description'],
    },
  },
  {
    name: 'search_similar_transactions',
    description: 'Find similar past transactions via Cognee knowledge graph.',
    input_schema: {
      type: 'object' as const,
      properties: {
        description: {
          type: 'string',
          description: 'Transaction description to search',
        },
        amount: {
          type: 'number',
          description: 'Transaction amount in cents',
        },
      },
      required: ['description'],
    },
  },
  {
    name: 'get_category_taxonomy',
    description: 'Get the full list of valid categories.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'batch_categorize',
    description: 'Process up to 20 transactions at once using rules and patterns.',
    input_schema: {
      type: 'object' as const,
      properties: {
        transactions: {
          type: 'array',
          description: 'Transactions to categorize',
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
      required: ['transactions'],
    },
  },
];
