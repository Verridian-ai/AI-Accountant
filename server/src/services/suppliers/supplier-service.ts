/**
 * Supplier Management Service — queries + delegation to supplier-mutations.ts.
 */

import { db } from '../../schema.js';
import { eq, and, desc, asc, like, sql, or } from 'drizzle-orm';
import { logger } from '../../utils/logger.js';
import type {
  Supplier,
  CreateSupplierInput,
  UpdateSupplierInput,
  SupplierDetail,
  ListOptions,
} from './types.js';
import { decrypt, maskAccountNumber } from './encryption.js';
import {
  createSupplierRecord,
  updateSupplierRecord,
  archiveSupplierRecord,
} from './supplier-mutations.js';

// ---------------------------------------------------------------------------
// Lazy table references
// ---------------------------------------------------------------------------

let _suppliers: any;
let _bills: any;
let _billPayments: any;
let _tablesLoaded = false;

async function ensureTables() {
  if (_tablesLoaded) return;
  try {
    const schema = await import('../../schema.js');
    _suppliers = (schema as any).suppliers;
    _bills = (schema as any).bills;
    _billPayments = (schema as any).billPayments;
    _tablesLoaded = true;
  } catch {
    _tablesLoaded = false;
  }
}

// ---------------------------------------------------------------------------
// SupplierService
// ---------------------------------------------------------------------------

export class SupplierService {
  // --- List Suppliers (paginated, masked bank details) ---

  async listSuppliers(
    userId: string,
    options: ListOptions = {},
  ): Promise<{ data: Supplier[]; total: number }> {
    await ensureTables();
    if (!_suppliers) return { data: [], total: 0 };

    const page = options.page ?? 1;
    const limit = options.limit ?? 50;
    const offset = (page - 1) * limit;

    const conditions: any[] = [eq(_suppliers.userId, userId)];

    if (options.isActive !== undefined) {
      conditions.push(eq(_suppliers.isActive, options.isActive));
    }

    if (options.search) {
      const pattern = `%${options.search}%`;
      conditions.push(
        or(
          like(_suppliers.businessName, pattern),
          like(_suppliers.contactName, pattern),
          like(_suppliers.abn, pattern),
        ),
      );
    }

    const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(_suppliers)
      .where(whereClause)
      .get();
    const total = Number(countResult?.count ?? 0);

    let orderByClause: any;
    const sortOrder = options.sortOrder ?? 'asc';
    const sortFn = sortOrder === 'desc' ? desc : asc;

    switch (options.sortBy) {
      case 'createdAt':
        orderByClause = sortFn(_suppliers.createdAt);
        break;
      case 'businessName':
      default:
        orderByClause = sortFn(_suppliers.businessName);
        break;
    }

    const rows = await db
      .select()
      .from(_suppliers)
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset)
      .all();

    const data = rows.map((row: any) => this.rowToSupplier(row, true));

    return { data, total };
  }

  // --- Get Supplier (with bill detail) ---

  async getSupplier(supplierId: string): Promise<SupplierDetail | null> {
    await ensureTables();
    if (!_suppliers) return null;

    const row = await db.select().from(_suppliers).where(eq(_suppliers.id, supplierId)).get();
    if (!row) return null;

    const supplier = this.rowToSupplier(row, true);

    let recentBills: SupplierDetail['recentBills'] = [];
    let totalOutstandingCents = 0;
    let totalSpendCents = 0;
    let averageDaysToPayment = 0;

    if (_bills) {
      const bills = await db
        .select()
        .from(_bills)
        .where(eq(_bills.supplierId, supplierId))
        .orderBy(desc(_bills.createdAt))
        .limit(10)
        .all();

      recentBills = bills.map((b: any) => ({
        id: b.id,
        billNumber: b.billNumber ?? '',
        totalAmountCents: Number(b.totalAmount ?? b.total_amount ?? 0),
        status: b.status ?? 'draft',
        dueDate: b.dueDate ?? b.due_date ?? '',
      }));

      const outstandingResult = await db
        .select({ total: sql<number>`COALESCE(SUM(amount_due), 0)` })
        .from(_bills)
        .where(
          and(
            eq(_bills.supplierId, supplierId),
            or(
              eq(_bills.status, 'approved'),
              eq(_bills.status, 'awaiting_approval'),
              eq(_bills.status, 'overdue'),
            ),
          ),
        )
        .get();
      totalOutstandingCents = Number(outstandingResult?.total ?? 0);

      const spendResult = await db
        .select({ total: sql<number>`COALESCE(SUM(total_amount), 0)` })
        .from(_bills)
        .where(eq(_bills.supplierId, supplierId))
        .get();
      totalSpendCents = Number(spendResult?.total ?? 0);

      if (_billPayments) {
        const avgResult = await db
          .select({
            avg: sql<number>`COALESCE(AVG(
              EXTRACT(EPOCH FROM (bp.payment_date::timestamp - b.issue_date::timestamp)) / 86400
            ), 0)`,
          })
          .from(_billPayments)
          .leftJoin(_bills, eq(_billPayments.billId, _bills.id))
          .where(eq(_bills.supplierId, supplierId))
          .get();
        averageDaysToPayment = Math.round(Number(avgResult?.avg ?? 0));
      }
    }

    return {
      ...supplier,
      recentBills,
      totalOutstandingCents,
      averageDaysToPayment,
      totalSpendCents,
    };
  }

  // --- Delegated Mutations ---

  async createSupplier(userId: string, data: CreateSupplierInput): Promise<Supplier> {
    return createSupplierRecord(userId, data, (row, mask) => this.rowToSupplier(row, mask));
  }

  async updateSupplier(supplierId: string, data: UpdateSupplierInput): Promise<Supplier> {
    return updateSupplierRecord(supplierId, data, (row, mask) => this.rowToSupplier(row, mask));
  }

  async archiveSupplier(supplierId: string): Promise<{ archived: boolean; warning?: string }> {
    return archiveSupplierRecord(supplierId);
  }

  // --- Search Suppliers (autocomplete -- max 10 results) ---

  async searchSuppliers(userId: string, query: string): Promise<Supplier[]> {
    await ensureTables();
    if (!_suppliers || !query.trim()) return [];

    const pattern = `%${query.trim()}%`;

    const rows = await db
      .select()
      .from(_suppliers)
      .where(
        and(
          eq(_suppliers.userId, userId),
          eq(_suppliers.isActive, true),
          or(
            like(_suppliers.businessName, pattern),
            like(_suppliers.contactName, pattern),
            like(_suppliers.abn, pattern),
          ),
        ),
      )
      .orderBy(asc(_suppliers.businessName))
      .limit(10)
      .all();

    return rows.map((row: any) => this.rowToSupplier(row, true));
  }

  // --- Get Supplier Bank Details (internal use -- decrypted) ---

  async getSupplierBankDetails(
    supplierId: string,
  ): Promise<{ bsb: string; accountNumber: string; accountName: string } | null> {
    await ensureTables();
    if (!_suppliers) return null;

    const row = await db.select().from(_suppliers).where(eq(_suppliers.id, supplierId)).get();
    if (!row) return null;

    const rawAccountNumber = (row as any).bankAccountNumber ?? (row as any).bank_account_number;
    if (!rawAccountNumber) return null;

    let accountNumber: string;
    try {
      accountNumber = decrypt(rawAccountNumber);
    } catch (err) {
      logger.error(
        { err },
        `[Suppliers] Failed to decrypt bank details for supplier ${supplierId}`,
      );
      return null;
    }

    return {
      bsb: (row as any).bankBsb ?? (row as any).bank_bsb ?? '',
      accountNumber,
      accountName: (row as any).bankAccountName ?? (row as any).bank_account_name ?? '',
    };
  }

  // --- Row Mapper ---

  rowToSupplier(row: any, maskBank: boolean): Supplier {
    const rawAccountNumber = row.bankAccountNumber ?? row.bank_account_number ?? null;

    let displayAccountNumber: string | null = null;
    if (rawAccountNumber && maskBank) {
      try {
        const decrypted = decrypt(rawAccountNumber);
        displayAccountNumber = maskAccountNumber(decrypted);
      } catch {
        displayAccountNumber = maskAccountNumber(rawAccountNumber);
      }
    } else if (rawAccountNumber && !maskBank) {
      try {
        displayAccountNumber = decrypt(rawAccountNumber);
      } catch {
        displayAccountNumber = rawAccountNumber;
      }
    }

    return {
      id: row.id,
      userId: row.userId ?? row.user_id,
      businessName: row.businessName ?? row.business_name ?? '',
      contactName: row.contactName ?? row.contact_name ?? null,
      email: row.email ?? null,
      phone: row.phone ?? null,
      address: row.address ?? null,
      abn: row.abn ?? null,
      paymentTermsDays: Number(row.paymentTermsDays ?? row.payment_terms_days ?? 30),
      bankBsb: row.bankBsb ?? row.bank_bsb ?? null,
      bankAccountNumber: displayAccountNumber,
      bankAccountName: row.bankAccountName ?? row.bank_account_name ?? null,
      notes: row.notes ?? null,
      isActive: row.isActive ?? row.is_active ?? true,
      createdAt: row.createdAt ?? row.created_at ?? '',
    };
  }
}
