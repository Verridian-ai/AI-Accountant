/**
 * Invoice Agent
 *
 * Handles customer and invoice operations via natural language:
 * creating invoices, tracking payments, generating PDFs, and
 * searching invoice/customer history through Cognee.
 */

import Anthropic from '@anthropic-ai/sdk';
import { ClaudeAgent } from '../base-agent.js';
import { cogneeTools } from '../cognee-tools.js';
import { invoicingService } from '../../invoicing.js';
import { CustomerService } from '../../customers.js';
import type { InvoiceAgentInput, InvoiceAgentOutput } from '../types.js';

const customerService = new CustomerService();

export class InvoiceAgent extends ClaudeAgent<InvoiceAgentInput, InvoiceAgentOutput> {
  protected systemPrompt = `You are an Australian invoicing assistant for GoldLedger. You help users:
- Create and manage customer records
- Generate professional tax invoices with correct GST calculations
- Track payments and outstanding balances
- Generate PDF invoices
- Search invoice history and customer information

Key rules:
- All amounts are in AUD (Australian Dollars)
- GST rate is 10% by default for GST-registered businesses
- Invoice numbers follow the INV-XXXXXX format
- Payment terms default to 30 days unless specified
- Always confirm amounts and details before creating invoices`;

  protected tools: Anthropic.Tool[] = [
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

  protected toolHandlers = new Map<string, (input: Record<string, unknown>) => Promise<unknown>>([
    [
      'create_invoice',
      async (input) => {
        const customerId = input.customerId as string;
        const lineItems = input.lineItems as Array<{
          description: string;
          quantity: number;
          unitPriceCents: number;
          gstRate?: number;
        }>;
        const notes = input.notes as string | undefined;
        const dueDate = input.dueDate as string | undefined;

        // Extract userId from the agent context (set during invoke)
        const userId = (this as any)._currentInput?.userId ?? 'system';

        try {
          const result = await invoicingService.createInvoice(userId, {
            customerId,
            lineItems: lineItems.map((li) => ({
              description: li.description,
              quantity: li.quantity,
              unitPriceCents: li.unitPriceCents,
              gstRate: li.gstRate ?? 0.1,
            })),
            notes,
            dueDate,
          });

          const inv = result.invoice;
          return {
            success: true,
            invoice: {
              id: inv.id,
              invoiceNumber: inv.invoiceNumber,
              customerId: inv.customerId,
              subtotalCents: inv.subtotal,
              gstCents: inv.gstTotal,
              totalCents: inv.total,
              status: inv.status,
              issueDate: inv.issueDate,
              dueDate: inv.dueDate,
            },
          };
        } catch (err) {
          return { success: false, error: err instanceof Error ? err.message : String(err) };
        }
      },
    ],
    [
      'update_invoice_status',
      async (input) => {
        const invoiceId = input.invoiceId as string;
        const action = input.action as 'send' | 'void';
        const userId = (this as any)._currentInput?.userId ?? 'system';

        try {
          if (action === 'send') {
            const result = await invoicingService.sendInvoice(userId, invoiceId);
            return { success: true, status: 'sent', invoice: result };
          } else {
            const result = await invoicingService.voidInvoice(userId, invoiceId);
            return { success: true, status: 'void', invoice: result };
          }
        } catch (err) {
          return { success: false, error: err instanceof Error ? err.message : String(err) };
        }
      },
    ],
    [
      'generate_pdf',
      async (input) => {
        const invoiceId = input.invoiceId as string;
        const userId = (this as any)._currentInput?.userId ?? 'system';

        try {
          // Fetch invoice data for PDF generation
          const invoice = await invoicingService.getInvoice(userId, invoiceId);
          if (!invoice) {
            return { success: false, error: 'Invoice not found' };
          }
          // PDF generation is handled by the PDF builder service (Agent 4)
          // Return the invoice data so the caller can generate the PDF
          return {
            success: true,
            invoiceId,
            pdfPath: `/api/invoices/${invoiceId}/pdf`,
            message: `PDF available at /api/invoices/${invoiceId}/pdf`,
          };
        } catch (err) {
          return { success: false, error: err instanceof Error ? err.message : String(err) };
        }
      },
    ],
    [
      'list_customer_invoices',
      async (input) => {
        const customerId = input.customerId as string;
        const status = input.status as string | undefined;
        const userId = (this as any)._currentInput?.userId ?? 'system';

        try {
          const result = await invoicingService.listInvoices(userId, {
            customerId,
            status,
          });
          return {
            success: true,
            invoices: result.data,
            total: result.total,
          };
        } catch (err) {
          return { success: false, error: err instanceof Error ? err.message : String(err) };
        }
      },
    ],
    [
      'track_payment',
      async (input) => {
        const invoiceId = input.invoiceId as string;
        const amountCents = input.amountCents as number;
        const paymentDate = input.paymentDate as string;
        const paymentMethod = input.paymentMethod as string;
        const reference = input.reference as string | undefined;
        const userId = (this as any)._currentInput?.userId ?? 'system';

        try {
          const result = await invoicingService.recordPayment(userId, invoiceId, {
            amountCents,
            paymentDate,
            paymentMethod,
            reference,
          });
          return { success: true, payment: result };
        } catch (err) {
          return { success: false, error: err instanceof Error ? err.message : String(err) };
        }
      },
    ],
    [
      'search_customers',
      async (input) => {
        const query = input.query as string;
        const userId = (this as any)._currentInput?.userId ?? 'system';

        try {
          const results = await customerService.searchCustomers(userId, query);
          return {
            success: true,
            customers: results.map((c: any) => ({
              id: c.id,
              businessName: c.businessName,
              contactName: c.contactName,
              email: c.email,
              abn: c.abn,
            })),
          };
        } catch (err) {
          return { success: false, error: err instanceof Error ? err.message : String(err) };
        }
      },
    ],
    [
      'search_cognee_invoices',
      async (input) => {
        const query = input.query as string;
        try {
          const results = await cogneeTools.search(query, 'invoice_patterns', 'CHUNKS');
          return { found: results.length > 0, results };
        } catch {
          return { found: false, results: [], error: 'Cognee search unavailable' };
        }
      },
    ],
  ]);

  /** Stash the current input so tool handlers can read userId */
  private _currentInput?: InvoiceAgentInput;

  async invoke(input: InvoiceAgentInput): Promise<InvoiceAgentOutput & { usage: any }> {
    this._currentInput = input;
    try {
      return await super.invoke(input);
    } finally {
      this._currentInput = undefined;
    }
  }

  constructor() {
    super('invoice_agent');
  }
}
