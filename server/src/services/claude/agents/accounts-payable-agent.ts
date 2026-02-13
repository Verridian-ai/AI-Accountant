/**
 * Accounts Payable Agent
 *
 * Manages supplier bills, purchase orders, three-way matching,
 * payment scheduling, AP aging reports, and vendor bill search.
 * Integrates with BillService, PurchaseOrderService, and Cognee.
 */

import Anthropic from '@anthropic-ai/sdk';
import { ClaudeAgent } from '../base-agent.js';
import { cogneeTools } from '../cognee-tools.js';
import { billService } from '../../bills.js';
import { purchaseOrderService } from '../../purchase-orders.js';
import type { AccountsPayableInput, AccountsPayableOutput } from '../types.js';

export class AccountsPayableAgent extends ClaudeAgent<AccountsPayableInput, AccountsPayableOutput> {
  protected systemPrompt = `You are an Accounts Payable specialist for an Australian small business accounting platform.
You help manage supplier bills, purchase orders, and payment scheduling.

Key capabilities:
- Enter and manage supplier bills with line items and GST
- Create and track purchase orders through their lifecycle
- Perform three-way matching (PO → goods receipt → supplier bill)
- Generate AP aging reports
- Schedule and process batch supplier payments
- Search historical vendor bills and patterns

Australian business context:
- GST rate is 10% for standard supplies
- ABN (Australian Business Number) identifies suppliers
- BAS reporting requires accurate GST tracking on purchases
- Payment terms typically 7, 14, 30, or 60 days
- Bank transfers use BSB + account number format
- All monetary amounts are in CENTS (integer). $1,000.00 = 100000 cents.

Return a JSON object matching the AccountsPayableOutput schema.`;

  protected tools: Anthropic.Tool[] = [
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

  protected toolHandlers = new Map<string, (input: Record<string, unknown>) => Promise<unknown>>([
    [
      'enter_bill',
      async (input) => {
        const userId = (this as any)._currentUserId ?? 'system';
        const result = await billService.createBill(userId, {
          supplierId: input.supplierId as string,
          billNumber: input.billNumber as string | undefined,
          issueDate: input.issueDate as string,
          dueDate: input.dueDate as string,
          lineItems: input.lineItems as Array<{
            description: string;
            quantity: number;
            unitPriceCents: number;
            gstRate?: number;
          }>,
        });
        return {
          id: result.id,
          supplierId: result.supplierId,
          billNumber: result.billNumber,
          status: result.status,
          subtotal: result.subtotal,
          gstAmount: result.gstAmount,
          totalAmount: result.totalAmount,
          amountDue: result.amountDue,
          issueDate: result.issueDate,
          dueDate: result.dueDate,
          lineItemCount: result.lineItemCount,
        };
      },
    ],
    [
      'create_purchase_order',
      async (input) => {
        const userId = (this as any)._currentUserId ?? 'system';
        const result = await purchaseOrderService.createPurchaseOrder(userId, {
          supplierId: input.supplierId as string,
          expectedDate: input.expectedDate as string | undefined,
          lineItems: input.lineItems as Array<{
            description: string;
            quantity: number;
            unitPriceCents: number;
          }>,
        });
        return {
          id: result.id,
          poNumber: result.poNumber,
          supplierId: result.supplierId,
          status: result.status,
          subtotal: result.subtotal,
          gstAmount: result.gstAmount,
          totalAmount: result.totalAmount,
          expectedDate: result.expectedDate,
          lineItemCount: result.lineItemCount,
        };
      },
    ],
    [
      'match_po_to_bill',
      async (input) => {
        const result = await purchaseOrderService.threeWayMatch(
          input.poId as string,
          input.billId as string,
        );
        return {
          poNumber: result.poNumber,
          billNumber: result.billNumber,
          matchStatus: result.matchStatus,
          quantityMatch: result.quantityMatch,
          priceMatch: result.priceMatch,
          totalMatch: result.totalMatch,
          poTotalCents: result.poTotalCents,
          receiptTotalCents: result.receiptTotalCents,
          billTotalCents: result.billTotalCents,
          discrepancies: result.discrepancies,
          canAutoApprove: result.canAutoApprove,
        };
      },
    ],
    [
      'schedule_payment',
      async (input) => {
        const userId = (this as any)._currentUserId ?? 'system';
        const result = await purchaseOrderService.createPaymentRun(userId, {
          billIds: input.billIds as string[],
          paymentDate: input.paymentDate as string,
        });
        return {
          id: result.id,
          status: result.status,
          paymentDate: result.paymentDate,
          totalAmount: result.totalAmount,
          bankReference: result.bankReference,
          billCount: result.billCount,
        };
      },
    ],
    [
      'generate_aging_report',
      async (input) => {
        const userId = (this as any)._currentUserId ?? 'system';
        const asOfDate = input.asOfDate as string | undefined;
        const report = await billService.getAPAging(userId, asOfDate);
        return {
          asOfDate: report.asOfDate,
          current: {
            count: report.buckets.current.billCount,
            totalCents: report.buckets.current.totalCents,
          },
          days1to30: {
            count: report.buckets.days1to30.billCount,
            totalCents: report.buckets.days1to30.totalCents,
          },
          days31to60: {
            count: report.buckets.days31to60.billCount,
            totalCents: report.buckets.days31to60.totalCents,
          },
          days61to90: {
            count: report.buckets.days61to90.billCount,
            totalCents: report.buckets.days61to90.totalCents,
          },
          days90plus: {
            count: report.buckets.days90plus.billCount,
            totalCents: report.buckets.days90plus.totalCents,
          },
          totalOutstandingCents: report.totalOutstandingCents,
          totalOverdueCents: report.totalOverdueCents,
          supplierCount: report.supplierCount,
        };
      },
    ],
    [
      'approve_payment_batch',
      async (input) => {
        const result = await purchaseOrderService.processPaymentRun(input.paymentRunId as string);
        return {
          id: result.id,
          status: result.status,
          processedAt: result.processedAt,
          totalBills: result.totalBills,
          successCount: result.successCount,
          errorCount: result.errorCount,
          errors: result.errors,
        };
      },
    ],
    [
      'search_vendor_bills',
      async (input) => {
        const query = input.query as string;
        const supplierId = input.supplierId as string | undefined;

        try {
          const results = await cogneeTools.searchBillPatterns(query);
          return {
            query,
            supplierId: supplierId ?? null,
            found: results.length > 0,
            results,
          };
        } catch {
          return {
            query,
            supplierId: supplierId ?? null,
            found: false,
            results: [],
            error: 'Cognee search unavailable',
          };
        }
      },
    ],
  ]);

  /** Store the current user ID for tool handlers that need it. */
  private _currentUserId?: string;

  async invoke(input: AccountsPayableInput): Promise<AccountsPayableOutput & { usage: any }> {
    this._currentUserId = input.userId;
    return super.invoke(input);
  }

  constructor() {
    super('accounts_payable_agent');
  }
}
