/**
 * Supplier Management Service
 *
 * Provides CRUD operations for supplier lifecycle management, including:
 * - AES-256-GCM encryption for bank account numbers
 * - ABN validation (mod-89 mandatory, ABR lookup best-effort)
 * - Paginated listing with masked bank details
 * - Supplier search for autocomplete
 * - Bank detail decryption for internal payment processing
 *
 * Pattern: Singleton service class with lazy table loading (same as inventory.ts).
 * Uses wrapPgDb() proxy — all DB queries go through the untyped `db` object.
 */

import { db } from '../schema.js';
import type * as SchemaTypes from '../schema.js';
import { eq, and, desc, asc, like, sql, or, type SQL } from 'drizzle-orm';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import crypto from 'crypto';
import { validateABN, normalizeABN } from '../utils/abn.js';
import { ABNLookupService } from './enrichment/abn-lookup.js';
import { logger } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// Encryption config — AES-256-GCM (authenticated encryption)
// ---------------------------------------------------------------------------

const BANK_ENCRYPTION_KEY = process.env.BANK_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY;
if (!BANK_ENCRYPTION_KEY && process.env.NODE_ENV === 'production') {
  throw new Error('BANK_ENCRYPTION_KEY must be set in production');
}
const ENCRYPTION_KEY_STR = BANK_ENCRYPTION_KEY || 'default-32-char-encryption-key!!'; // 32 bytes
const IV_LENGTH = 12; // GCM standard 12-byte IV

function encrypt(text: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY_STR), iv);
  let encrypted = cipher.update(text, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Format: iv:authTag:encrypted (all hex)
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text: string): string {
  const parts = text.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted format');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encryptedText = Buffer.from(parts[2], 'hex');
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY_STR), iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString('utf8');
}

function maskAccountNumber(accountNumber: string): string {
  if (!accountNumber) return '';
  return '****' + accountNumber.slice(-4);
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface Supplier {
  id: string;
  userId: string;
  businessName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  abn: string | null;
  paymentTermsDays: number;
  bankBsb: string | null;
  bankAccountNumber: string | null; // masked in listings, encrypted in DB
  bankAccountName: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface CreateSupplierInput {
  businessName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  abn?: string;
  paymentTermsDays?: number;
  bankBsb?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  notes?: string;
}

export interface UpdateSupplierInput {
  businessName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  abn?: string;
  paymentTermsDays?: number;
  bankBsb?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  notes?: string;
}

export interface SupplierDetail extends Supplier {
  recentBills: Array<{
    id: string;
    billNumber: string;
    totalAmountCents: number;
    status: string;
    dueDate: string;
  }>;
  totalOutstandingCents: number;
  averageDaysToPayment: number;
  totalSpendCents: number;
}

export interface ListOptions {
  page?: number;
  limit?: number;
  isActive?: boolean;
  search?: string;
  sortBy?: 'businessName' | 'createdAt' | 'totalSpend';
  sortOrder?: 'asc' | 'desc';
}

// ---------------------------------------------------------------------------
// Lazy table references (Agent 1 may not have added these yet)
// ---------------------------------------------------------------------------

let _suppliers: typeof SchemaTypes.suppliers | undefined;
let _bills: typeof SchemaTypes.bills | undefined;
let _billPayments: typeof SchemaTypes.billPayments | undefined;
let _tablesLoaded = false;

async function ensureTables() {
  if (_tablesLoaded) return;
  try {
    const schema = await import('../schema.js');
    _suppliers = schema.suppliers;
    _bills = schema.bills;
    _billPayments = schema.billPayments;
    _tablesLoaded = true;
  } catch {
    _tablesLoaded = false;
  }
}

// ---------------------------------------------------------------------------
// SupplierService
// ---------------------------------------------------------------------------

export class SupplierService {
  private abnService: ABNLookupService;

  constructor() {
    this.abnService = new ABNLookupService();
  }

  // =========================================================================
  // LIST SUPPLIERS (paginated, masked bank details)
  // =========================================================================

  async listSuppliers(
    userId: string,
    options: ListOptions = {},
  ): Promise<{ data: Supplier[]; total: number }> {
    await ensureTables();
    if (!_suppliers) return { data: [], total: 0 };

    const page = options.page ?? 1;
    const limit = options.limit ?? 50;
    const offset = (page - 1) * limit;

    // Build conditions
    const conditions: (SQL | undefined)[] = [eq(_suppliers.userId, userId)];

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

    // Count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(_suppliers)
      .where(whereClause)
      .get();
    const total = Number(countResult?.count ?? 0);

    // Sort
    let orderByClause: SQL;
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

    // Query
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

  // =========================================================================
  // GET SUPPLIER (with bill detail)
  // =========================================================================

  async getSupplier(supplierId: string): Promise<SupplierDetail | null> {
    await ensureTables();
    if (!_suppliers) return null;

    const row = await db.select().from(_suppliers).where(eq(_suppliers.id, supplierId)).get();

    if (!row) return null;

    const supplier = this.rowToSupplier(row, true);

    // Fetch recent bills (if bills table exists)
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

      recentBills = bills.map((b: Record<string, unknown>) => ({
        id: b.id as string,
        billNumber: (b.billNumber ?? '') as string,
        totalAmountCents: Number(b.totalAmount ?? b.total_amount ?? 0),
        status: (b.status ?? 'draft') as string,
        dueDate: (b.dueDate ?? b.due_date ?? '') as string,
      }));

      // Total outstanding (unpaid bills)
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

      // Total spend (all bills)
      const spendResult = await db
        .select({ total: sql<number>`COALESCE(SUM(total_amount), 0)` })
        .from(_bills)
        .where(eq(_bills.supplierId, supplierId))
        .get();
      totalSpendCents = Number(spendResult?.total ?? 0);

      // Average days to payment (from paid bills)
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

  // =========================================================================
  // CREATE SUPPLIER
  // =========================================================================

  async createSupplier(userId: string, data: CreateSupplierInput): Promise<Supplier> {
    await ensureTables();

    // ABN validation (mandatory mod-89, best-effort ABR lookup)
    if (data.abn) {
      const abnResult = this.validateAndLookupABN(data.abn);
      const validation = await abnResult;

      if (!validation.valid) {
        throw new Error(`Invalid ABN: ${validation.error}`);
      }

      // Auto-populate businessName from ABR if not provided by user
      if (validation.businessName && !data.businessName) {
        data.businessName = validation.businessName;
      }
    }

    // BSB format validation
    if (data.bankBsb) {
      this.validateBSB(data.bankBsb);
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    // Encrypt bank account number before storage
    const encryptedAccountNumber = data.bankAccountNumber ? encrypt(data.bankAccountNumber) : null;

    const record: Record<string, unknown> = {
      id,
      userId,
      businessName: data.businessName,
      contactName: data.contactName ?? null,
      email: data.email ?? null,
      phone: data.phone ?? null,
      address: data.address ?? null,
      abn: data.abn ? (normalizeABN(data.abn) ?? data.abn) : null,
      paymentTermsDays: data.paymentTermsDays ?? 30,
      bankBsb: data.bankBsb ?? null,
      bankAccountNumber: encryptedAccountNumber,
      bankAccountName: data.bankAccountName ?? null,
      notes: data.notes ?? null,
      isActive: true,
      createdAt: now,
    };

    if (_suppliers) {
      await db.insert(_suppliers).values(record).run();
    }

    // Return with masked bank details
    return this.rowToSupplier(record, true);
  }

  // =========================================================================
  // UPDATE SUPPLIER
  // =========================================================================

  async updateSupplier(supplierId: string, data: UpdateSupplierInput): Promise<Supplier> {
    await ensureTables();
    if (!_suppliers) throw new Error('Suppliers table not available');

    const existing = await db.select().from(_suppliers).where(eq(_suppliers.id, supplierId)).get();

    if (!existing) {
      throw new Error(`Supplier ${supplierId} not found`);
    }

    // ABN validation if changed
    if (data.abn !== undefined && data.abn !== null) {
      const validation = await this.validateAndLookupABN(data.abn);
      if (!validation.valid) {
        throw new Error(`Invalid ABN: ${validation.error}`);
      }
    }

    // BSB format validation if changed
    if (data.bankBsb !== undefined && data.bankBsb !== null) {
      this.validateBSB(data.bankBsb);
    }

    // Build update set
    const updates: Record<string, unknown> = {};

    if (data.businessName !== undefined) updates.businessName = data.businessName;
    if (data.contactName !== undefined) updates.contactName = data.contactName;
    if (data.email !== undefined) updates.email = data.email;
    if (data.phone !== undefined) updates.phone = data.phone;
    if (data.address !== undefined) updates.address = data.address;
    if (data.abn !== undefined)
      updates.abn = data.abn ? (normalizeABN(data.abn) ?? data.abn) : null;
    if (data.paymentTermsDays !== undefined) updates.paymentTermsDays = data.paymentTermsDays;
    if (data.bankBsb !== undefined) updates.bankBsb = data.bankBsb;
    if (data.bankAccountName !== undefined) updates.bankAccountName = data.bankAccountName;
    if (data.notes !== undefined) updates.notes = data.notes;

    // Re-encrypt bank account number if changed
    if (data.bankAccountNumber !== undefined) {
      updates.bankAccountNumber = data.bankAccountNumber ? encrypt(data.bankAccountNumber) : null;
    }

    if (Object.keys(updates).length > 0) {
      await db.update(_suppliers).set(updates).where(eq(_suppliers.id, supplierId)).run();
    }

    // Re-fetch and return
    const updated = await db.select().from(_suppliers).where(eq(_suppliers.id, supplierId)).get();

    return this.rowToSupplier(updated, true);
  }

  // =========================================================================
  // ARCHIVE SUPPLIER (soft delete)
  // =========================================================================

  async archiveSupplier(supplierId: string): Promise<{ archived: boolean; warning?: string }> {
    await ensureTables();
    if (!_suppliers) throw new Error('Suppliers table not available');

    const existing = await db.select().from(_suppliers).where(eq(_suppliers.id, supplierId)).get();

    if (!existing) {
      throw new Error(`Supplier ${supplierId} not found`);
    }

    let warning: string | undefined;

    // Check for outstanding bills before archiving
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

    // Soft delete — set isActive = false
    await db.update(_suppliers).set({ isActive: false }).where(eq(_suppliers.id, supplierId)).run();

    return { archived: true, warning };
  }

  // =========================================================================
  // SEARCH SUPPLIERS (autocomplete — max 10 results)
  // =========================================================================

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

  // =========================================================================
  // GET SUPPLIER BANK DETAILS (internal use — decrypted)
  // =========================================================================

  async getSupplierBankDetails(
    supplierId: string,
  ): Promise<{ bsb: string; accountNumber: string; accountName: string } | null> {
    await ensureTables();
    if (!_suppliers) return null;

    const row = await db.select().from(_suppliers).where(eq(_suppliers.id, supplierId)).get();

    if (!row) return null;

    const r = row as Record<string, unknown>;
    const rawAccountNumber = (r.bankAccountNumber ?? r.bank_account_number) as string | null;
    if (!rawAccountNumber) return null;

    let accountNumber: string;
    try {
      accountNumber = decrypt(rawAccountNumber);
    } catch (err) {
      logger.error(`[Suppliers] Failed to decrypt bank details for supplier ${supplierId}`, err);
      return null;
    }

    return {
      bsb: ((r.bankBsb ?? r.bank_bsb ?? '') as string),
      accountNumber,
      accountName: ((r.bankAccountName ?? r.bank_account_name ?? '') as string),
    };
  }

  // =========================================================================
  // PRIVATE HELPERS
  // =========================================================================

  /**
   * Validate ABN format (mod-89) and optionally look up against ABR.
   * Format check is mandatory; ABR lookup is best-effort.
   */
  private async validateAndLookupABN(
    abn: string,
  ): Promise<{ valid: boolean; error?: string; businessName?: string }> {
    // Step 1: Mandatory mod-89 format validation
    const formatResult = validateABN(abn);
    if (!formatResult.isValid) {
      return { valid: false, error: formatResult.error };
    }

    // Step 2: Best-effort ABR lookup
    let businessName: string | undefined;
    try {
      if (this.abnService.available) {
        const abnResult = await this.abnService.searchByABN(abn);
        if (abnResult) {
          businessName = abnResult.businessName;

          if (abnResult.abnStatus === 'Cancelled') {
            logger.warn(`[Suppliers] ABN ${abn} status is Cancelled (ABR lookup)`);
            // Warn but don't block — business may have recently cancelled
          }
        }
      }
    } catch (err) {
      // ABR may be temporarily unavailable — warn but allow creation
      logger.warn(
        `[Suppliers] ABR lookup failed for ABN ${abn} — proceeding without verification`,
        err,
      );
    }

    return { valid: true, businessName };
  }

  /**
   * Validate BSB format: 3 digits, dash, 3 digits (e.g. 062-000).
   * Also accepts 6 digits without dash for convenience.
   */
  private validateBSB(bsb: string): void {
    const clean = bsb.replace(/\s+/g, '');
    if (!/^\d{3}-\d{3}$/.test(clean) && !/^\d{6}$/.test(clean)) {
      throw new Error('BSB must be in format 000-000 or 6 digits');
    }
  }

  /**
   * Convert a DB row to a Supplier object.
   * Handles both camelCase and snake_case column names (wrapPgDb proxy).
   * When maskBank is true, shows only last 4 digits of account number.
   */
  private rowToSupplier(row: Record<string, unknown>, maskBank: boolean): Supplier {
    const rawAccountNumber = (row.bankAccountNumber ?? row.bank_account_number ?? null) as string | null;

    let displayAccountNumber: string | null = null;
    if (rawAccountNumber && maskBank) {
      // If stored encrypted, decrypt first then mask
      try {
        const decrypted = decrypt(rawAccountNumber);
        displayAccountNumber = maskAccountNumber(decrypted);
      } catch {
        // If not encrypted (e.g. already plain from createSupplier return),
        // or the value was already masked
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
      businessName: (row.businessName ?? row.business_name ?? '') as string,
      contactName: (row.contactName ?? row.contact_name ?? null) as string | null,
      email: (row.email ?? null) as string | null,
      phone: (row.phone ?? null) as string | null,
      address: (row.address ?? null) as string | null,
      abn: (row.abn ?? null) as string | null,
      paymentTermsDays: Number(row.paymentTermsDays ?? row.payment_terms_days ?? 30),
      bankBsb: (row.bankBsb ?? row.bank_bsb ?? null) as string | null,
      bankAccountNumber: displayAccountNumber,
      bankAccountName: (row.bankAccountName ?? row.bank_account_name ?? null) as string | null,
      notes: (row.notes ?? null) as string | null,
      isActive: (row.isActive ?? row.is_active ?? true) as boolean,
      createdAt: (row.createdAt ?? row.created_at ?? '') as string,
    };
  }
}
