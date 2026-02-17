/**
 * Invoicing Service — Query Operations
 * Get, list, overdue check, and summary for invoices.
 */

import { db } from '../../schema.js';
import { invoices, invoiceLines, customers } from '../../schema.js';
import { eq, and, sql, desc, gte, lte, type SQL } from 'drizzle-orm';
import type {
  Invoice,
  Customer,
  InvoiceWithLines,
  InvoiceWithCustomer,
  InvoiceSummary,
} from './types.js';
import { today, nowISO } from './helpers.js';

// --------------------------------------------------------------------------
// Get Invoice (with lines + customer)
// --------------------------------------------------------------------------

export async function getInvoice(
  userId: string,
  invoiceId: string,
): Promise<InvoiceWithLines | null> {
  const invoice = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.userId, userId)))
    .get();

  if (!invoice) return null;

  const lines = await db
    .select()
    .from(invoiceLines)
    .where(eq(invoiceLines.invoiceId, invoiceId))
    .all();

  let customer: Customer | undefined = undefined;
  if (invoice.customerId) {
    customer = await db.select().from(customers).where(eq(customers.id, invoice.customerId)).get();
  }

  return { invoice, lines, customer };
}

// --------------------------------------------------------------------------
// List Invoices (paginated + filtered)
// --------------------------------------------------------------------------

export async function listInvoices(
  userId: string,
  options: {
    offset?: number;
    limit?: number;
    status?: string;
    customerId?: string;
    dateFrom?: string;
    dateTo?: string;
  } = {},
): Promise<{ data: InvoiceWithCustomer[]; total: number }> {
  const offset = options.offset ?? 0;
  const limit = Math.min(options.limit ?? 50, 100);

  const conditions: SQL[] = [eq(invoices.userId, userId)];
  if (options.status) {
    conditions.push(eq(invoices.status, options.status));
  }
  if (options.customerId) {
    conditions.push(eq(invoices.customerId, options.customerId));
  }
  if (options.dateFrom) {
    conditions.push(gte(invoices.issueDate, options.dateFrom));
  }
  if (options.dateTo) {
    conditions.push(lte(invoices.issueDate, options.dateTo));
  }

  const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(invoices)
    .where(whereClause)
    .get();
  const total: number = countResult?.count ?? 0;

  const rows = await db
    .select({
      invoice: invoices,
      customerName: customers.businessName,
    })
    .from(invoices)
    .leftJoin(customers, eq(invoices.customerId, customers.id))
    .where(whereClause)
    .orderBy(desc(invoices.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  const data: InvoiceWithCustomer[] = (rows ?? []).map(
    (r: { invoice: Invoice | null; customerName: string | null }) => ({
      invoice: r.invoice ?? r,
      customerName: r.customerName ?? 'Unknown',
    }),
  );

  return { data, total };
}

// --------------------------------------------------------------------------
// Check Overdue Invoices
// --------------------------------------------------------------------------

export async function checkOverdueInvoices(
  userId: string,
): Promise<{ id: string; invoiceNumber: string; amountDue: number; daysOverdue: number }[]> {
  const todayStr = today();

  const overdueInvoices = await db
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.userId, userId),
        eq(invoices.status, 'sent'),
        lte(invoices.dueDate, todayStr),
      ),
    )
    .all();

  if (!overdueInvoices || overdueInvoices.length === 0) {
    return [];
  }

  const now = nowISO();
  for (const inv of overdueInvoices) {
    await db
      .update(invoices)
      .set({ status: 'overdue', updatedAt: now })
      .where(eq(invoices.id, inv.id))
      .run();
  }

  return overdueInvoices.map((inv: (typeof overdueInvoices)[number]) => ({
    ...inv,
    status: 'overdue',
    updatedAt: now,
  }));
}

// --------------------------------------------------------------------------
// Invoice Summary
// --------------------------------------------------------------------------

export async function getInvoiceSummary(userId: string): Promise<InvoiceSummary> {
  const allInvoices = await db.select().from(invoices).where(eq(invoices.userId, userId)).all();

  const list = allInvoices ?? [];

  const counts = {
    draft: 0,
    sent: 0,
    paid: 0,
    overdue: 0,
    void: 0,
  };

  let totalOutstandingCents = 0;
  let totalOverdueCents = 0;
  let revenueThisMonthCents = 0;

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  for (const inv of list) {
    const status = inv.status as keyof typeof counts;
    if (status in counts) {
      counts[status]++;
    }

    if (inv.status === 'sent' || inv.status === 'overdue') {
      totalOutstandingCents += inv.amountDue ?? 0;
    }

    if (inv.status === 'overdue') {
      totalOverdueCents += inv.amountDue ?? 0;
    }

    if (inv.status === 'paid' && inv.updatedAt >= monthStart) {
      revenueThisMonthCents += inv.totalAmount ?? 0;
    }
  }

  return {
    totalOutstandingCents,
    totalOverdueCents,
    revenueThisMonthCents,
    counts,
  };
}
