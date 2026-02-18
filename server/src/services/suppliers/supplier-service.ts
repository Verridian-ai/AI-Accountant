/**
 * Supplier Management Service — queries + delegation to supplier-mutations.ts.
 */

import { db } from '../../schema.js';
import type { DrizzleTable } from '../../db/queries/types.js';
import { eq, and, desc, asc, like, sql, or } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
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
// Lazy table references (irreducible — dynamic Drizzle table refs)
// ---------------------------------------------------------------------------

let _suppliers: DrizzleTable | undefined;
let _bills: DrizzleTable | undefined;
let _billPayments: DrizzleTable | undefined;
let _tablesLoaded = false;

async function ensureTables() {
  if (_tablesLoaded) return;
  try {
    const schema: Record<string, unknown> = await import('../../schema.js');
    _suppliers = schema.suppliers as DrizzleTable;
    _bills = schema.bills as DrizzleTable;
    _billPayments = schema.billPayments as DrizzleTable;
    _tablesLoaded = true;
  } catch {
    _tablesLoaded = false;
  }
}

// ---------------------------------------------------------------------------
// SupplierService
// ---------------------------------------------------------------------------

interface BillRow {
  id: string;
  billNumber: string | null;
  totalAmount: number | string | null;
  total_amount?: number | string | null;
  status: string;
  dueDate: string | null;
  due_date?: string | null;
}

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

    const conditions: SQL[] = [eq(_suppliers.userId, userId)];

    if (options.isActive !== undefined) {
      conditions.push(eq(_suppliers.isActive, options.isActive));
    }

    if (options.search) {
      const pattern = `%${options.search}%`;
      const searchCondition = or(
        like(_suppliers.businessName, pattern),
        like(_suppliers.contactName, pattern),
        like(_suppliers.abn, pattern),
      );
      if (searchCondition) conditions.push(searchCondition);
    }

    const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(_suppliers)
      .where(whereClause)
      .get();
    const total = Number(countResult?.count ?? 0);

    const sortOrder = options.sortOrder ?? 'asc';
    const sortFn = sortOrder === 'desc' ? desc : asc;

    const orderByClause =
      options.sortBy === 'createdAt'
        ? sortFn(_suppliers.createdAt)
        : sortFn(_suppliers.businessName);

    const rows = await db
      .select()
      .from(_suppliers)
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset)
      .all();

    const data = rows.map((row: Record<string, unknown>) => this.rowToSupplier(row, true));

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
      const billRows = await db
        .select()
        .from(_bills)
        .where(eq(_bills.supplierId, supplierId))
        .orderBy(desc(_bills.createdAt))
        .limit(10)
        .all();

      recentBills = billRows.map((b: BillRow) => ({
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

    return rows.map((row: Record<string, unknown>) => this.rowToSupplier(row, true));
  }

  // --- Get Supplier Bank Details (internal use -- decrypted) ---

  async getSupplierBankDetails(
    supplierId: string,
  ): Promise<{ bsb: string; accountNumber: string; accountName: string } | null> {
    await ensureTables();
    if (!_suppliers) return null;

    const row = await db.select().from(_suppliers).where(eq(_suppliers.id, supplierId)).get();
    if (!row) return null;

    const rowData = row as Record<string, unknown>;
    const rawAccountNumber = (rowData.bankAccountNumber ?? rowData.bank_account_number) as
      | string
      | null;
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
      bsb: ((rowData.bankBsb ?? rowData.bank_bsb) as string) ?? '',
      accountNumber,
      accountName: ((rowData.bankAccountName ?? rowData.bank_account_name) as string) ?? '',
    };
  }

  // --- Row Mapper ---

  rowToSupplier(row: Record<string, unknown>, maskBank: boolean): Supplier {
    const rawAccountNumber = (row.bankAccountNumber ?? row.bank_account_number ?? null) as
      | string
      | null;

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
      id: row.id as string,
      userId: (row.userId ?? row.user_id) as string,
      businessName: ((row.businessName ?? row.business_name) as string) ?? '',
      contactName: ((row.contactName ?? row.contact_name) as string | null) ?? null,
      email: (row.email as string | null) ?? null,
      phone: (row.phone as string | null) ?? null,
      address: (row.address as string | null) ?? null,
      abn: (row.abn as string | null) ?? null,
      paymentTermsDays: Number(row.paymentTermsDays ?? row.payment_terms_days ?? 30),
      bankBsb: ((row.bankBsb ?? row.bank_bsb) as string | null) ?? null,
      bankAccountNumber: displayAccountNumber,
      bankAccountName: ((row.bankAccountName ?? row.bank_account_name) as string | null) ?? null,
      notes: (row.notes as string | null) ?? null,
      isActive: (row.isActive ?? row.is_active ?? true) as boolean,
      createdAt: ((row.createdAt ?? row.created_at) as string) ?? '',
    };
  }
}
