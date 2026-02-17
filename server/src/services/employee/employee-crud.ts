/**
 * Employee CRUD Operations
 * Create, read, update, terminate employees.
 * Sensitive fields (TFN) are AES-256-GCM encrypted at rest.
 */

import { db, employees } from '../../schema.js';
import { eq, and, desc, sql } from 'drizzle-orm';
import { encryptField, decryptField, maskTFN } from '../encryption.js';

/**
 * Mask sensitive fields for API responses.
 * Decrypts TFN then masks it -- the decrypted value is never returned.
 */
export function maskSensitiveFields(employee: any): any {
  return {
    ...employee,
    taxFileNumber: employee.taxFileNumber ? maskTFN(decryptField(employee.taxFileNumber)) : null,
  };
}

/**
 * Create a new employee.
 * Encrypts TFN before storage -- plaintext never touches the DB.
 */
export async function createEmployee(data: {
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

  return getEmployee(id);
}

/**
 * Get employee by ID.
 * Returns with TFN masked (***-***-**X) -- never plaintext.
 */
export async function getEmployee(id: string): Promise<any | null> {
  const rows = await db.select().from(employees).where(eq(employees.id, id)).limit(1);
  if (rows.length === 0) return null;
  return maskSensitiveFields(rows[0]);
}

/**
 * List employees for a user.
 * Supports pagination (offset-based), status filter, and name search.
 */
export async function listEmployees(
  userId: string,
  options?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  },
): Promise<{ data: any[]; total: number }> {
  const page = options?.page ?? 1;
  const limit = options?.limit ?? 50;
  const offset = (page - 1) * limit;

  const conditions: any[] = [eq(employees.userId, userId)];
  if (options?.status) {
    conditions.push(eq(employees.status, options.status));
  }
  if (options?.search) {
    conditions.push(
      sql`(${employees.firstName} LIKE ${'%' + options.search + '%'} OR ${employees.lastName} LIKE ${'%' + options.search + '%'})`,
    );
  }

  const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

  const countResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(employees)
    .where(whereClause);
  const total = Number(countResult[0]?.count ?? 0);

  const rows = await db
    .select()
    .from(employees)
    .where(whereClause)
    .orderBy(desc(employees.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    data: rows.map((r: any) => maskSensitiveFields(r)),
    total,
  };
}

/**
 * Update an employee record.
 * Re-encrypts TFN if a new value is provided.
 */
export async function updateEmployee(
  id: string,
  data: Partial<{
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
  }>,
): Promise<any | null> {
  const updateData: any = { ...data, updatedAt: new Date().toISOString() };

  if (data.taxFileNumber) {
    updateData.taxFileNumber = encryptField(data.taxFileNumber);
  }

  await db.update(employees).set(updateData).where(eq(employees.id, id));
  return getEmployee(id);
}

/**
 * Soft-delete: set status to 'terminated' and record end date.
 * Does NOT delete the record -- payroll history must be preserved.
 */
export async function terminateEmployee(id: string, endDate?: string): Promise<any | null> {
  await db
    .update(employees)
    .set({
      status: 'terminated',
      endDate: endDate ?? new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString(),
    })
    .where(eq(employees.id, id));
  return getEmployee(id);
}

/**
 * Get employee with DECRYPTED TFN.
 * Internal use only -- for ATO reporting, STP submissions. NEVER expose via API.
 */
export async function getEmployeeInternal(id: string): Promise<any | null> {
  const rows = await db.select().from(employees).where(eq(employees.id, id)).limit(1);
  if (rows.length === 0) return null;
  const emp = rows[0];
  return {
    ...emp,
    taxFileNumber: emp.taxFileNumber ? decryptField(emp.taxFileNumber) : null,
  };
}
