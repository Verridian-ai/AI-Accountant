/**
 * Supplier Management — Mutation Operations (Create, Update, Archive)
 *
 * Extracted from SupplierService to keep file sizes under 300 lines.
 * Includes ABN/BSB validation helpers.
 */

import { db } from '../../schema.js';
import type { DrizzleTable } from '../../db/queries/types.js';
import { eq, and, sql, or } from 'drizzle-orm';
import crypto from 'crypto';
import { validateABN, normalizeABN } from '../../utils/abn.js';
import { ABNLookupService } from '../enrichment/abn-lookup.js';
import { logger } from '../../utils/logger.js';
import type { Supplier, CreateSupplierInput, UpdateSupplierInput } from './types.js';

// ---------------------------------------------------------------------------
// Lazy table references (shared with supplier-service.ts)
// Note: These are intentionally untyped — they hold Drizzle table objects
// whose column accessors require dynamic property access.
// ---------------------------------------------------------------------------

let _suppliers: DrizzleTable | undefined;
let _bills: DrizzleTable | undefined;
let _tablesLoaded = false;

async function ensureTables() {
  if (_tablesLoaded) return;
  try {
    const schema: Record<string, unknown> = await import('../../schema.js');
    _suppliers = schema.suppliers as DrizzleTable;
    _bills = schema.bills as DrizzleTable;
    _tablesLoaded = true;
  } catch {
    _tablesLoaded = false;
  }
}

// ---------------------------------------------------------------------------
// ABN Validation
// ---------------------------------------------------------------------------

const abnService = new ABNLookupService();

export async function validateAndLookupABN(
  abn: string,
): Promise<{ valid: boolean; error?: string; businessName?: string }> {
  const formatResult = validateABN(abn);
  if (!formatResult.isValid) {
    return { valid: false, error: formatResult.error };
  }

  let businessName: string | undefined;
  try {
    if (abnService.available) {
      const abnResult = await abnService.searchByABN(abn);
      if (abnResult) {
        businessName = abnResult.businessName;

        if (abnResult.abnStatus === 'Cancelled') {
          logger.warn(`[Suppliers] ABN ${abn} status is Cancelled (ABR lookup)`);
        }
      }
    }
  } catch (err) {
    logger.warn(
      { err },
      `[Suppliers] ABR lookup failed for ABN ${abn} — proceeding without verification`,
    );
  }

  return { valid: true, businessName };
}

// ---------------------------------------------------------------------------
// BSB Validation
// ---------------------------------------------------------------------------

export function validateBSB(bsb: string): void {
  const clean = bsb.replace(/\s+/g, '');
  if (!/^\d{3}-\d{3}$/.test(clean) && !/^\d{6}$/.test(clean)) {
    throw new Error('BSB must be in format 000-000 or 6 digits');
  }
}

// ---------------------------------------------------------------------------
// Create Supplier
// ---------------------------------------------------------------------------

interface SupplierRecord {
  id: string;
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  abn: string | null;
  paymentTerms: string | null;
  isActive: boolean;
  createdAt: string;
  tenantId: string | null;
}

export async function createSupplierRecord(
  userId: string,
  data: CreateSupplierInput,
  rowToSupplier: (row: Record<string, unknown>) => Supplier,
): Promise<Supplier> {
  await ensureTables();

  if (data.abn) {
    const validation = await validateAndLookupABN(data.abn);
    if (!validation.valid) {
      throw new Error(`Invalid ABN: ${validation.error}`);
    }
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const record: SupplierRecord = {
    id,
    userId,
    name: data.businessName ?? data.name ?? '',
    email: data.email ?? null,
    phone: data.phone ?? null,
    address: data.address ?? null,
    abn: data.abn ? (normalizeABN(data.abn) ?? data.abn) : null,
    paymentTerms: data.paymentTerms ?? null,
    isActive: true,
    createdAt: now,
    tenantId: null,
  };

  if (_suppliers) {
    await db.insert(_suppliers).values(record).run();
  }

  return rowToSupplier(record as unknown as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// Update Supplier
// ---------------------------------------------------------------------------

export async function updateSupplierRecord(
  supplierId: string,
  data: UpdateSupplierInput,
  rowToSupplier: (row: Record<string, unknown>) => Supplier,
): Promise<Supplier> {
  await ensureTables();
  if (!_suppliers) throw new Error('Suppliers table not available');

  const existing = await db.select().from(_suppliers).where(eq(_suppliers.id, supplierId)).get();

  if (!existing) {
    throw new Error(`Supplier ${supplierId} not found`);
  }

  if (data.abn !== undefined && data.abn !== null) {
    const validation = await validateAndLookupABN(data.abn);
    if (!validation.valid) {
      throw new Error(`Invalid ABN: ${validation.error}`);
    }
  }

  const updates: Record<string, unknown> = {};

  if (data.name !== undefined) updates.name = data.name;
  if (data.email !== undefined) updates.email = data.email;
  if (data.phone !== undefined) updates.phone = data.phone;
  if (data.address !== undefined) updates.address = data.address;
  if (data.abn !== undefined) updates.abn = data.abn ? (normalizeABN(data.abn) ?? data.abn) : null;
  if (data.paymentTerms !== undefined) updates.paymentTerms = data.paymentTerms;

  if (Object.keys(updates).length > 0) {
    await db.update(_suppliers).set(updates).where(eq(_suppliers.id, supplierId)).run();
  }

  const updated = await db.select().from(_suppliers).where(eq(_suppliers.id, supplierId)).get();

  return rowToSupplier(updated);
}

// ---------------------------------------------------------------------------
// Archive Supplier (soft delete)
// ---------------------------------------------------------------------------

export async function archiveSupplierRecord(
  supplierId: string,
): Promise<{ archived: boolean; warning?: string }> {
  await ensureTables();
  if (!_suppliers) throw new Error('Suppliers table not available');

  const existing = await db.select().from(_suppliers).where(eq(_suppliers.id, supplierId)).get();

  if (!existing) {
    throw new Error(`Supplier ${supplierId} not found`);
  }

  let warning: string | undefined;

  if (_bills) {
    const outstandingResult = await db
      .select({ count: sql<number>`count(*)` })
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

    const outstandingCount = Number(outstandingResult?.count ?? 0);
    if (outstandingCount > 0) {
      warning = `Supplier has ${outstandingCount} outstanding bill(s). Archiving will not affect existing bills.`;
      logger.warn(
        `[Suppliers] Archiving supplier ${supplierId} with ${outstandingCount} outstanding bills`,
      );
    }
  }

  await db.update(_suppliers).set({ isActive: false }).where(eq(_suppliers.id, supplierId)).run();

  return { archived: true, warning };
}
