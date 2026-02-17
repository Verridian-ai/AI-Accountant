/**
 * Customer Management Service
 *
 * Full CRUD operations, contact management, search, and balance calculation
 * for the customer/invoicing module.
 *
 * All monetary values are stored in cents (INTEGER).
 * ABN validation uses the mod-89 checksum + optional ABR lookup.
 */

import { eq, and, or, like, sql , type SQL } from 'drizzle-orm';
import { validateABN, normalizeABN } from '../utils/abn.js';
import { ABNLookupService } from './enrichment/abn-lookup.js';
import { logger } from '../utils/logger.js';

// Schema tables — Agent 1 adds these to schema.ts in parallel.
// Import from schema; if not yet available at compile time, the build
// will succeed once Agent 1's commit lands.
import { db, customers, customerContacts, invoices } from '../schema.js';

// Re-export the Drizzle-inferred types for external consumers
import type { Customer, CustomerContact } from '../schema.js';
export type { Customer, CustomerContact };

// ---------------------------------------------------------------------------
// Input / Output interfaces
// ---------------------------------------------------------------------------

export interface CreateCustomerInput {
  businessName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  abn?: string;
  paymentTermsDays?: number;
  notes?: string;
}

export interface CreateContactInput {
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  isPrimary?: boolean;
}

export interface CustomerWithBalance {
  customer: Customer;
  outstandingBalanceCents: number;
  overdueBalanceCents: number;
  invoiceCount: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class CustomerService {
  private db: typeof db;

  constructor(database?: typeof db) {
    this.db = database ?? db;
  }

  // -------------------------------------------------------------------------
  // List (paginated + search)
  // -------------------------------------------------------------------------

  async listCustomers(
    userId: string,
    options: {
      offset?: number;
      limit?: number;
      search?: string;
      isActive?: boolean;
    } = {},
  ): Promise<{ data: Customer[]; total: number }> {
    const offset = Math.max(0, options.offset ?? 0);
    const limit = Math.min(Math.max(1, options.limit ?? 50), 100);
    const isActive = options.isActive ?? true;

    // Build conditions
    const conditions: (SQL | undefined)[] = [eq(customers.userId, userId)];

    if (isActive !== undefined) {
      conditions.push(eq(customers.isActive, isActive));
    }

    if (options.search) {
      const pattern = `%${options.search}%`;
      conditions.push(
        or(
          like(customers.businessName, pattern),
          like(customers.contactName, pattern),
          like(customers.email, pattern),
        ),
      );
    }

    const where = and(...conditions);

    // Total count
    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(customers)
      .where(where)
      .get();

    const total = Number(countResult?.count ?? 0);

    // Data page
    const data: Customer[] = await this.db
      .select()
      .from(customers)
      .where(where)
      .limit(limit)
      .offset(offset)
      .orderBy(customers.businessName)
      .all();

    return { data, total };
  }

  // -------------------------------------------------------------------------
  // Get single
  // -------------------------------------------------------------------------

  async getCustomer(userId: string, customerId: string): Promise<Customer | null> {
    const row = await this.db
      .select()
      .from(customers)
      .where(and(eq(customers.id, customerId), eq(customers.userId, userId)))
      .get();

    return row ?? null;
  }

  // -------------------------------------------------------------------------
  // Create
  // -------------------------------------------------------------------------

  async createCustomer(userId: string, data: CreateCustomerInput): Promise<Customer> {
    let abnVerified = false;

    // ABN validation (format + optional ABR lookup)
    if (data.abn) {
      const normalized = normalizeABN(data.abn);
      if (!normalized) {
        throw new Error('ABN must be exactly 11 digits.');
      }

      const check = validateABN(normalized);
      if (!check.isValid) {
        throw new Error(check.error ?? 'Invalid ABN checksum.');
      }

      // Replace with cleaned value
      data = { ...data, abn: normalized };

      // ABR real-time lookup — warn but do NOT block on failure
      try {
        const abnService = new ABNLookupService();
        const result = await abnService.searchByABN(normalized).catch(() => null);
        if (result) {
          abnVerified = result.abnStatus === 'Active';
          if (!abnVerified) {
            logger.warn(
              `[Customer] ABN ${normalized} found in ABR but status is ${result.abnStatus}`,
            );
          }
        } else {
          logger.warn(`[Customer] ABR lookup unavailable for ABN ${normalized} — saving anyway`);
        }
      } catch {
        logger.warn(`[Customer] ABR lookup failed for ABN ${data.abn} — saving anyway`);
      }
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const values = {
      id,
      userId,
      businessName: data.businessName,
      contactName: data.contactName ?? null,
      email: data.email ?? null,
      phone: data.phone ?? null,
      address: data.address ?? null,
      city: data.city ?? null,
      state: data.state ?? null,
      postcode: data.postcode ?? null,
      country: data.country ?? 'AU',
      abn: data.abn ?? null,
      paymentTermsDays: data.paymentTermsDays ?? 30,
      notes: data.notes ?? null,
      isActive: true,
      createdAt: now,
    };

    await this.db.insert(customers).values(values).run();

    // Return the freshly-created record
    const created = await this.db.select().from(customers).where(eq(customers.id, id)).get();

    return created!;
  }

  // -------------------------------------------------------------------------
  // Update (partial)
  // -------------------------------------------------------------------------

  async updateCustomer(
    userId: string,
    customerId: string,
    data: Partial<CreateCustomerInput>,
  ): Promise<Customer> {
    // Ownership check
    const existing = await this.getCustomer(userId, customerId);
    if (!existing) {
      throw new Error('Customer not found or access denied.');
    }

    // ABN re-validation if changed
    if (data.abn !== undefined && data.abn !== null) {
      const normalized = normalizeABN(data.abn);
      if (!normalized) {
        throw new Error('ABN must be exactly 11 digits.');
      }
      const check = validateABN(normalized);
      if (!check.isValid) {
        throw new Error(check.error ?? 'Invalid ABN checksum.');
      }
      data = { ...data, abn: normalized };
    }

    // Build SET clause from provided fields only
    const setFields: Record<string, any> = {};
    if (data.businessName !== undefined) setFields.businessName = data.businessName;
    if (data.contactName !== undefined) setFields.contactName = data.contactName;
    if (data.email !== undefined) setFields.email = data.email;
    if (data.phone !== undefined) setFields.phone = data.phone;
    if (data.address !== undefined) setFields.address = data.address;
    if (data.city !== undefined) setFields.city = data.city;
    if (data.state !== undefined) setFields.state = data.state;
    if (data.postcode !== undefined) setFields.postcode = data.postcode;
    if (data.country !== undefined) setFields.country = data.country;
    if (data.abn !== undefined) setFields.abn = data.abn;
    if (data.paymentTermsDays !== undefined) setFields.paymentTermsDays = data.paymentTermsDays;
    if (data.notes !== undefined) setFields.notes = data.notes;

    if (Object.keys(setFields).length > 0) {
      await this.db.update(customers).set(setFields).where(eq(customers.id, customerId)).run();
    }

    const updated = await this.getCustomer(userId, customerId);
    return updated!;
  }

  // -------------------------------------------------------------------------
  // Archive (soft delete)
  // -------------------------------------------------------------------------

  async archiveCustomer(userId: string, customerId: string): Promise<void> {
    const existing = await this.getCustomer(userId, customerId);
    if (!existing) {
      throw new Error('Customer not found or access denied.');
    }

    await this.db
      .update(customers)
      .set({ isActive: false })
      .where(eq(customers.id, customerId))
      .run();
  }

  // -------------------------------------------------------------------------
  // Contacts
  // -------------------------------------------------------------------------

  async listContacts(customerId: string): Promise<CustomerContact[]> {
    return this.db
      .select()
      .from(customerContacts)
      .where(eq(customerContacts.customerId, customerId))
      .orderBy(customerContacts.name)
      .all();
  }

  async addContact(customerId: string, data: CreateContactInput): Promise<CustomerContact> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    // If setting as primary, clear other primary contacts first
    if (data.isPrimary) {
      await this.db
        .update(customerContacts)
        .set({ isPrimary: false })
        .where(
          and(eq(customerContacts.customerId, customerId), eq(customerContacts.isPrimary, true)),
        )
        .run();
    }

    const values = {
      id,
      customerId,
      name: data.name,
      email: data.email ?? null,
      phone: data.phone ?? null,
      role: data.role ?? null,
      isPrimary: data.isPrimary ?? false,
      createdAt: now,
    };

    await this.db.insert(customerContacts).values(values).run();

    const created = await this.db
      .select()
      .from(customerContacts)
      .where(eq(customerContacts.id, id))
      .get();

    return created!;
  }

  // -------------------------------------------------------------------------
  // Customer with outstanding balance
  // -------------------------------------------------------------------------

  async getCustomerWithBalance(userId: string, customerId: string): Promise<CustomerWithBalance> {
    const customer = await this.getCustomer(userId, customerId);
    if (!customer) {
      throw new Error('Customer not found or access denied.');
    }

    // Outstanding = SUM(amount_due) WHERE status IN ('sent','viewed','overdue')
    const outstandingResult = await this.db
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
    const overdueResult = await this.db
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

  // -------------------------------------------------------------------------
  // Search (typeahead for invoice editor)
  // -------------------------------------------------------------------------

  async searchCustomers(userId: string, query: string): Promise<Customer[]> {
    if (!query || query.trim().length === 0) return [];

    const pattern = `%${query.trim()}%`;

    return this.db
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
}
