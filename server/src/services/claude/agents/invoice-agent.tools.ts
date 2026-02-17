/**
 * Invoice Agent — Tool Definitions
 *
 * Anthropic tool schemas for invoice creation, status updates,
 * PDF generation, customer invoice listing, payment tracking,
 * customer search, and Cognee invoice search.
 */

import type Anthropic from '@anthropic-ai/sdk';

export const invoiceAgentTools: Anthropic.Tool[] = [
  {
    name: 'create_invoice',
    description: 'Create a new tax invoice for a customer with line items',
    input_schema: {
      type: 'object' as const,
      properties: {
        customerId: { type: 'string', description: 'Customer ID' },
        lineItems: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              description: { type: 'string' },
              quantity: { type: 'number' },
              unitPriceCents: { type: 'integer' },
              gstRate: { type: 'number', description: 'GST rate, default 0.1 (10%)' },
            },
            required: ['description', 'quantity', 'unitPriceCents'],
          },
        },
        notes: { type: 'string', description: 'Notes to include on the invoice' },
        dueDate: { type: 'string', description: 'ISO date string for due date' },
      },
      required: ['customerId', 'lineItems'],
    },
  },
  {
    name: 'update_invoice_status',
    description: 'Change an invoice status — send it to the customer or void it',
    input_schema: {
      type: 'object' as const,
      properties: {
        invoiceId: { type: 'string', description: 'Invoice ID' },
        action: { type: 'string', enum: ['send', 'void'], description: 'Action to perform' },
      },
      required: ['invoiceId', 'action'],
    },
  },
  {
    name: 'generate_pdf',
    description: 'Generate a PDF file for an invoice',
    input_schema: {
      type: 'object' as const,
      properties: {
        invoiceId: { type: 'string', description: 'Invoice ID to generate PDF for' },
      },
      required: ['invoiceId'],
    },
  },
  {
    name: 'list_customer_invoices',
    description: 'List invoices for a specific customer with optional status filter',
    input_schema: {
      type: 'object' as const,
      properties: {
        customerId: { type: 'string', description: 'Customer ID' },
        status: {
          type: 'string',
          enum: ['draft', 'sent', 'paid', 'overdue', 'void'],
          description: 'Optional status filter',
        },
      },
      required: ['customerId'],
    },
  },
  {
    name: 'track_payment',
    description: 'Record a payment against an invoice',
    input_schema: {
      type: 'object' as const,
      properties: {
        invoiceId: { type: 'string', description: 'Invoice ID' },
        amountCents: { type: 'integer', description: 'Payment amount in cents' },
        paymentDate: { type: 'string', description: 'ISO date string' },
        paymentMethod: {
          type: 'string',
          enum: ['bank_transfer', 'credit_card', 'cash', 'cheque', 'other'],
          description: 'Payment method',
        },
        reference: { type: 'string', description: 'Payment reference number' },
      },
      required: ['invoiceId', 'amountCents', 'paymentDate', 'paymentMethod'],
    },
  },
  {
    name: 'search_customers',
    description: 'Search customers by name, ABN, or email',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search query' },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_cognee_invoices',
    description: 'Search Cognee knowledge graph for invoice patterns and history',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search query for invoice patterns' },
      },
      required: ['query'],
    },
  },
];
