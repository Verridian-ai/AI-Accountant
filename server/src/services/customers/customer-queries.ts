/**
 * Customer Queries — Balance & Search Operations
 * Extracted from CustomerService to keep files under 300 lines.
 */

import { eq, and, or, like, sql } from 'drizzle-orm';
import { customers, invoices } from '../../schema.js';
import type { Customer } from '../../schema.js';
import type { CustomerWithBalance } from './types.js';

/**
 * Get customer with outstanding balance calculation.
 */
export async function getCustomerWithBalance(
  database: any,
  userId: string,
  customerId: string,
  getCustomer: (userId: string, customerId: string) => Promise<Customer | null>,
): Promise<CustomerWithBalance> {
  const customer = await getCustomer(userId, customerId);
  if (!customer) {
    throw new Error('Customer not found or access denied.');
  }

  // Outstanding = SUM(amount_due) WHERE status IN ('sent','viewed','overdue')
  const outstandingResult = await database
    .select({
      total: sql<number>`COALESCE(SUM(${invoices.amountDue}), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.customerId, customerId),
        eq(invoices.userId, userId),
        sql`${invoices.status} IN ('sent', 'viewed', 'overdue')`,
      ),
    )
    .get();

  // Overdue only
  const overdueResult = await database
    .select({
      total: sql<number>`COALESCE(SUM(${invoices.amountDue}), 0)`,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.customerId, customerId),
        eq(invoices.userId, userId),
        eq(invoices.status, 'overdue'),
      ),
    )
    .get();

  return {
    customer,
    outstandingBalanceCents: Number(outstandingResult?.total ?? 0),
    overdueBalanceCents: Number(overdueResult?.total ?? 0),
    invoiceCount: Number(outstandingResult?.count ?? 0),
  };
}

/**
 * Search customers (typeahead for invoice editor).
 */
export async function searchCustomers(
  database: any,
  userId: string,
  query: string,
): Promise<Customer[]> {
  if (!query || query.trim().length === 0) return [];

  const pattern = `%${query.trim()}%`;

  return database
    .select()
    .from(customers)
    .where(
      and(
        eq(customers.userId, userId),
        eq(customers.isActive, true),
        or(
          like(customers.businessName, pattern),
          like(customers.contactName, pattern),
          like(customers.email, pattern),
          like(customers.abn, pattern),
        ),
      ),
    )
    .limit(20)
    .orderBy(customers.businessName)
    .all();
}
