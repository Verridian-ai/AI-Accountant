/**
 * Employee Management Service (Wave 4)
 *
 * Complete CRUD for employees, bank details, super funds, and tax declarations.
 * All sensitive fields (TFN, BSB, account numbers) are AES-256-GCM encrypted at rest
 * and masked before returning via public API methods.
 *
 * Security invariants:
 * - NEVER store plaintext TFN — always encryptField() before insert
 * - NEVER return plaintext TFN via public methods — always maskTFN()
 * - BSB encrypted at rest (REVISION D02) — maskBSB() for display
 * - Account numbers encrypted at rest — maskAccountNumber() for display
 * - Internal methods (*Internal) decrypt for pay-run/ATO use only
 */

import { db, employees, employeeBankDetails, employeeSuperFunds, employeeTaxDeclarations, employeeDocuments } from '../schema.js';
import { eq, and, desc, like, sql } from 'drizzle-orm';
import { encryptField, decryptField, maskTFN, maskAccountNumber, maskBSB } from './encryption.js';

export class EmployeeService {

  // ============================
  // EMPLOYEE CRUD
  // ============================

  /**
   * Create a new employee.
   * Encrypts TFN before storage — plaintext never touches the DB.
   */
  async createEmployee(data: {
    userId: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    dateOfBirth?: string;
    address?: string;
    taxFileNumber?: string;
    startDate: string;
    employmentType: 'full_time' | 'part_time' | 'casual' | 'contractor';
  }): Promise<any> {
    const id = crypto.randomUUID();
    const encryptedTFN = data.taxFileNumber ? encryptField(data.taxFileNumber) : null;

    await db.insert(employees).values({
      id,
      userId: data.userId,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email ?? null,
      phone: data.phone ?? null,
      dateOfBirth: data.dateOfBirth ?? null,
      address: data.address ?? null,
      taxFileNumber: encryptedTFN,
      startDate: data.startDate,
      status: 'active',
      employmentType: data.employmentType,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return this.getEmployee(id);
  }

  /**
   * Get employee by ID.
   * Returns with TFN masked (***-***-**X) — never plaintext.
   */
  async getEmployee(id: string): Promise<any | null> {
    const rows = await db.select().from(employees).where(eq(employees.id, id)).limit(1);
    if (rows.length === 0) return null;
    return this.maskSensitiveFields(rows[0]);
  }

  /**
   * List employees for a user.
   * Supports pagination (offset-based), status filter, and name search.
   */
  async listEmployees(userId: string, options?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }): Promise<{ data: any[]; total: number }> {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 50;
    const offset = (page - 1) * limit;

    // Build conditions
    const conditions: any[] = [eq(employees.userId, userId)];
    if (options?.status) {
      conditions.push(eq(employees.status, options.status));
    }
    if (options?.search) {
      // Search by first or last name
      conditions.push(
        sql`(${employees.firstName} LIKE ${'%' + options.search + '%'} OR ${employees.lastName} LIKE ${'%' + options.search + '%'})`
      );
    }

    const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

    // Count total matching records
    const countResult = await db.select({ count: sql<number>`COUNT(*)` })
      .from(employees)
      .where(whereClause);
    const total = Number(countResult[0]?.count ?? 0);

    // Fetch paginated results
    const rows = await db.select().from(employees)
      .where(whereClause)
      .orderBy(desc(employees.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      data: rows.map((r: any) => this.maskSensitiveFields(r)),
      total,
    };
  }

  /**
   * Update an employee record.
   * Re-encrypts TFN if a new value is provided.
   */
  async updateEmployee(id: string, data: Partial<{
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    dateOfBirth: string;
    address: string;
    taxFileNumber: string;
    startDate: string;
    endDate: string;
    status: string;
    employmentType: string;
  }>): Promise<any | null> {
    const updateData: any = { ...data, updatedAt: new Date().toISOString() };

    // Encrypt TFN if provided — plaintext must never reach the DB
    if (data.taxFileNumber) {
      updateData.taxFileNumber = encryptField(data.taxFileNumber);
    }

    await db.update(employees).set(updateData).where(eq(employees.id, id));
    return this.getEmployee(id);
  }

  /**
   * Soft-delete: set status to 'terminated' and record end date.
   * Does NOT delete the record — payroll history must be preserved.
   */
  async terminateEmployee(id: string, endDate?: string): Promise<any | null> {
    await db.update(employees).set({
      status: 'terminated',
      endDate: endDate ?? new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString(),
    }).where(eq(employees.id, id));
    return this.getEmployee(id);
  }

  // ============================
  // BANK DETAILS
  // ============================

  /**
   * Add bank details for an employee.
   * REVISION (D02): Encrypts BOTH BSB and account number at rest.
   */
  async addBankDetails(employeeId: string, data: {
    bsb: string;
    accountNumber: string;
    accountName: string;
    splitPercentage?: number;
    isPrimary?: boolean;
  }): Promise<any> {
    const id = crypto.randomUUID();
    await db.insert(employeeBankDetails).values({
      id,
      employeeId,
      bsb: encryptField(data.bsb),
      accountNumber: encryptField(data.accountNumber),
      accountName: data.accountName,
      splitPercentage: data.splitPercentage ?? 100.0,
      isPrimary: data.isPrimary ?? true,
      createdAt: new Date().toISOString(),
    });
    return this.getBankDetails(employeeId);
  }

  /**
   * Get bank details for an employee (masked for API responses).
   * REVISION (D02): BSB is also masked (decrypt → mask).
   */
  async getBankDetails(employeeId: string): Promise<any[]> {
    const rows = await db.select().from(employeeBankDetails)
      .where(eq(employeeBankDetails.employeeId, employeeId));
    return rows.map((r: any) => ({
      ...r,
      bsb: maskBSB(decryptField(r.bsb)),
      accountNumber: maskAccountNumber(decryptField(r.accountNumber)),
    }));
  }

  /**
   * Get bank details with DECRYPTED values.
   * Internal use only — for pay run processing. NEVER expose via API.
   */
  async getBankDetailsInternal(employeeId: string): Promise<any[]> {
    const rows = await db.select().from(employeeBankDetails)
      .where(eq(employeeBankDetails.employeeId, employeeId));
    return rows.map((r: any) => ({
      ...r,
      bsb: decryptField(r.bsb),
      accountNumber: decryptField(r.accountNumber),
    }));
  }

  // ============================
  // SUPER FUNDS
  // ============================

  /**
   * Add super fund for an employee.
   * Defaults contribution rate to 11.5% (FY2025-26 Superannuation Guarantee).
   */
  async addSuperFund(employeeId: string, data: {
    fundName: string;
    fundABN?: string;
    usi?: string;
    memberNumber?: string;
    contributionRate?: number;
  }): Promise<any> {
    const id = crypto.randomUUID();
    await db.insert(employeeSuperFunds).values({
      id,
      employeeId,
      fundName: data.fundName,
      fundABN: data.fundABN ?? null,
      usi: data.usi ?? null,
      memberNumber: data.memberNumber ?? null,
      contributionRate: data.contributionRate ?? 11.5,
      createdAt: new Date().toISOString(),
    });
    return this.getSuperFund(employeeId);
  }

  /**
   * Get all super funds for an employee.
   */
  async getSuperFund(employeeId: string): Promise<any[]> {
    return db.select().from(employeeSuperFunds)
      .where(eq(employeeSuperFunds.employeeId, employeeId));
  }

  // ============================
  // TAX DECLARATIONS
  // ============================

  /**
   * Submit a tax declaration for an employee (ATO TFN Declaration fields).
   * Multiple declarations are allowed — the most recent by effectiveDate is current.
   */
  async submitTaxDeclaration(employeeId: string, data: {
    taxFreeThreshold?: boolean;
    helpDebt?: boolean;
    sfssDebt?: boolean;
    claimDependents?: number;
    taxOffsetEstimated?: number;
    effectiveDate: string;
  }): Promise<any> {
    const id = crypto.randomUUID();
    await db.insert(employeeTaxDeclarations).values({
      id,
      employeeId,
      taxFreeThreshold: data.taxFreeThreshold ?? true,
      helpDebt: data.helpDebt ?? false,
      sfssDebt: data.sfssDebt ?? false,
      claimDependents: data.claimDependents ?? 0,
      taxOffsetEstimated: data.taxOffsetEstimated ?? 0,
      effectiveDate: data.effectiveDate,
      createdAt: new Date().toISOString(),
    });
    return this.getTaxDeclaration(employeeId);
  }

  /**
   * Get the most recent tax declaration for an employee.
   * Ordered by effectiveDate DESC — returns the current active declaration.
   */
  async getTaxDeclaration(employeeId: string): Promise<any | null> {
    const rows = await db.select().from(employeeTaxDeclarations)
      .where(eq(employeeTaxDeclarations.employeeId, employeeId))
      .orderBy(desc(employeeTaxDeclarations.effectiveDate))
      .limit(1);
    return rows[0] ?? null;
  }

  // ============================
  // HELPERS (INTERNAL)
  // ============================

  /**
   * Mask sensitive fields for API responses.
   * Decrypts TFN then masks it — the decrypted value is never returned.
   */
  private maskSensitiveFields(employee: any): any {
    return {
      ...employee,
      taxFileNumber: employee.taxFileNumber ? maskTFN(decryptField(employee.taxFileNumber)) : null,
    };
  }

  /**
   * Get employee with DECRYPTED TFN.
   * Internal use only — for ATO reporting, STP submissions. NEVER expose via API.
   */
  async getEmployeeInternal(id: string): Promise<any | null> {
    const rows = await db.select().from(employees).where(eq(employees.id, id)).limit(1);
    if (rows.length === 0) return null;
    const emp = rows[0];
    return {
      ...emp,
      taxFileNumber: emp.taxFileNumber ? decryptField(emp.taxFileNumber) : null,
    };
  }
}

export const employeeService = new EmployeeService();
