/**
 * Accounts Payable Agent — Tool Definitions
 *
 * Anthropic tool schemas for bill entry, PO creation, three-way matching,
 * payment scheduling, aging reports, batch processing, and vendor search.
 */

import type Anthropic from '@anthropic-ai/sdk';

export const accountsPayableTools: Anthropic.Tool[] = [
  {
    name: 'enter_bill',
    description: 'Enter a new supplier bill with line items and GST calculation.',
    input_schema: {
      type: 'object' as const,
      properties: {
        supplierId: { type: 'string', description: 'Supplier UUID' },
        billNumber: {
          type: 'string',
          description: 'Optional bill/invoice number from the supplier',
        },
        issueDate: { type: 'string', description: 'Bill issue date (ISO format YYYY-MM-DD)' },
        dueDate: { type: 'string', description: 'Payment due date (ISO format YYYY-MM-DD)' },
        lineItems: {
          type: 'array',
          description: 'Line items on the bill',
          items: {
            type: 'object',
            properties: {
              description: { type: 'string' },
              quantity: { type: 'number' },
              unitPriceCents: { type: 'number', description: 'Unit price in cents' },
              gstRate: { type: 'number', description: 'GST rate (default 0.1 = 10%)' },
            },
            required: ['description', 'quantity', 'unitPriceCents'],
          },
        },
      },
      required: ['supplierId', 'issueDate', 'dueDate', 'lineItems'],
    },
  },
  {
    name: 'create_purchase_order',
    description: 'Create a new purchase order for a supplier with line items.',
    input_schema: {
      type: 'object' as const,
      properties: {
        supplierId: { type: 'string', description: 'Supplier UUID' },
        expectedDate: { type: 'string', description: 'Expected delivery date (YYYY-MM-DD)' },
        lineItems: {
          type: 'array',
          description: 'Items to order',
          items: {
            type: 'object',
            properties: {
              description: { type: 'string' },
              quantity: { type: 'number' },
              unitPriceCents: { type: 'number', description: 'Unit price in cents' },
            },
            required: ['description', 'quantity', 'unitPriceCents'],
          },
        },
      },
      required: ['supplierId', 'lineItems'],
    },
  },
  {
    name: 'match_po_to_bill',
    description:
      'Perform three-way matching between a purchase order, its receipts, and a supplier bill. Reports quantity, price, and total discrepancies.',
    input_schema: {
      type: 'object' as const,
      properties: {
        poId: { type: 'string', description: 'Purchase Order UUID' },
        billId: { type: 'string', description: 'Bill UUID' },
      },
      required: ['poId', 'billId'],
    },
  },
  {
    name: 'schedule_payment',
    description:
      'Create a payment run for a batch of approved bills. Groups multiple bills into a single bank transfer batch.',
    input_schema: {
      type: 'object' as const,
      properties: {
        billIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of bill UUIDs to include in the payment run',
        },
        paymentDate: { type: 'string', description: 'Scheduled payment date (YYYY-MM-DD)' },
      },
      required: ['billIds', 'paymentDate'],
    },
  },
  {
    name: 'generate_aging_report',
    description:
      'Generate an AP aging report showing outstanding bills grouped by days past due (current, 1-30, 31-60, 61-90, 90+ days).',
    input_schema: {
      type: 'object' as const,
      properties: {
        asOfDate: { type: 'string', description: 'Report date (YYYY-MM-DD). Defaults to today.' },
      },
      required: [],
    },
  },
  {
    name: 'approve_payment_batch',
    description:
      'Process an existing payment run, recording payments against each bill in the batch.',
    input_schema: {
      type: 'object' as const,
      properties: {
        paymentRunId: { type: 'string', description: 'Payment run UUID to process' },
      },
      required: ['paymentRunId'],
    },
  },
  {
    name: 'search_vendor_bills',
    description:
      'Search historical vendor bills and spending patterns using Cognee knowledge graph. Good for questions like "What do we usually spend with supplier X?" or "Show recurring bill patterns".',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Natural language search query' },
        supplierId: { type: 'string', description: 'Optional supplier UUID to narrow search' },
      },
      required: ['query'],
    },
  },
];
