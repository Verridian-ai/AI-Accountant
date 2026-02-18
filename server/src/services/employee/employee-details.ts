/**
 * Employee Details — Bank, Super Fund, Tax Declaration Operations
 * Sensitive fields (BSB, account numbers) are AES-256-GCM encrypted at rest.
 */

import {
  db,
  employeeBankDetails,
  employeeSuperFunds,
  employeeTaxDeclarations,
} from '../../schema.js';
import { eq, desc } from 'drizzle-orm';
import { encryptField, decryptField, maskAccountNumber, maskBSB } from '../encryption.js';

// ============================
// BANK DETAILS
// ============================

/**
 * Add bank details for an employee.
 * REVISION (D02): Encrypts BOTH BSB and account number at rest.
 */
export async function addBankDetails(
  employeeId: string,
  data: {
    bsb: string;
    accountNumber: string;
    accountName: string;
    splitPercentage?: number;
    isPrimary?: boolean;
  },
): Promise<any> {
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
  return getBankDetails(employeeId);
}

/**
 * Get bank details for an employee (masked for API responses).
 * REVISION (D02): BSB is also masked (decrypt -> mask).
 */
export async function getBankDetails(employeeId: string): Promise<any[]> {
  const rows = await db
    .select()
    .from(employeeBankDetails)
    .where(eq(employeeBankDetails.employeeId, employeeId));
  return (rows as Record<string, unknown>[]).map((r: Record<string, unknown>) => ({
    ...r,
    bsb: maskBSB(decryptField(r.bsb as string)),
    accountNumber: maskAccountNumber(decryptField(r.accountNumber as string)),
  }));
}

/**
 * Get bank details with DECRYPTED values.
 * Internal use only -- for pay run processing. NEVER expose via API.
 */
export async function getBankDetailsInternal(employeeId: string): Promise<any[]> {
  const rows = await db
    .select()
    .from(employeeBankDetails)
    .where(eq(employeeBankDetails.employeeId, employeeId));
  return (rows as Record<string, unknown>[]).map((r: Record<string, unknown>) => ({
    ...r,
    bsb: decryptField(r.bsb as string),
    accountNumber: decryptField(r.accountNumber as string),
  }));
}

// ============================
// SUPER FUNDS
// ============================

/**
 * Add super fund for an employee.
 * Defaults contribution rate to 11.5% (FY2025-26 Superannuation Guarantee).
 */
export async function addSuperFund(
  employeeId: string,
  data: {
    fundName: string;
    fundABN?: string;
    usi?: string;
    memberNumber?: string;
    contributionRate?: number;
  },
): Promise<any> {
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
  return getSuperFund(employeeId);
}

/**
 * Get all super funds for an employee.
 */
export async function getSuperFund(employeeId: string): Promise<any[]> {
  return db.select().from(employeeSuperFunds).where(eq(employeeSuperFunds.employeeId, employeeId));
}

// ============================
// TAX DECLARATIONS
// ============================

/**
 * Submit a tax declaration for an employee (ATO TFN Declaration fields).
 * Multiple declarations are allowed -- the most recent by effectiveDate is current.
 */
export async function submitTaxDeclaration(
  employeeId: string,
  data: {
    taxFreeThreshold?: boolean;
    helpDebt?: boolean;
    sfssDebt?: boolean;
    claimDependents?: number;
    taxOffsetEstimated?: number;
    effectiveDate: string;
  },
): Promise<any> {
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
  return getTaxDeclaration(employeeId);
}

/**
 * Get the most recent tax declaration for an employee.
 * Ordered by effectiveDate DESC -- returns the current active declaration.
 */
export async function getTaxDeclaration(employeeId: string): Promise<any | null> {
  const rows = await db
    .select()
    .from(employeeTaxDeclarations)
    .where(eq(employeeTaxDeclarations.employeeId, employeeId))
    .orderBy(desc(employeeTaxDeclarations.effectiveDate))
    .limit(1);
  return rows[0] ?? null;
}
