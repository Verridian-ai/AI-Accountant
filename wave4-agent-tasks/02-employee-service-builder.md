# Agent 2: Employee Service Builder

## Role
Build the core employee CRUD service with TFN/bank encryption, masking for API responses, and employee lifecycle management.

## Priority: SUB-WAVE 1 (Start Immediately)

## Files to CREATE

### 1. `server/src/services/employee.ts`
**Purpose**: Complete employee management service
**Pattern**: Follow existing service patterns (e.g. `services/accounts.ts`, `services/ledger.ts`)

```typescript
import { db, employees, employeeBankDetails, employeeSuperFunds, employeeTaxDeclarations, employeeDocuments } from '../schema.js';
import { eq, and, desc, like, sql } from 'drizzle-orm';
import { encryptField, decryptField, maskTFN, maskAccountNumber, maskBSB } from './encryption.js';

export class EmployeeService {

  // ============================
  // EMPLOYEE CRUD
  // ============================

  /**
   * Create a new employee
   * Encrypts TFN before storage
   */
  async createEmployee(data: {
    userId: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    dateOfBirth?: string;
    address?: string; // JSON string
    taxFileNumber?: string; // plaintext TFN — will be encrypted
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
   * Get employee by ID
   * Returns with TFN masked (***-***-**X)
   */
  async getEmployee(id: string): Promise<any | null> {
    const rows = await db.select().from(employees).where(eq(employees.id, id)).limit(1);
    if (rows.length === 0) return null;
    return this.maskSensitiveFields(rows[0]);
  }

  /**
   * List employees for a user
   * Supports pagination and status filter
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

    let query = db.select().from(employees).where(eq(employees.userId, userId));

    // Count total
    const countResult = await db.select({ count: sql<number>`COUNT(*)` })
      .from(employees)
      .where(eq(employees.userId, userId));
    const total = Number(countResult[0]?.count ?? 0);

    const rows = await db.select().from(employees)
      .where(eq(employees.userId, userId))
      .orderBy(desc(employees.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      data: rows.map(r => this.maskSensitiveFields(r)),
      total,
    };
  }

  /**
   * Update employee
   */
  async updateEmployee(id: string, data: Partial<{
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    dateOfBirth: string;
    address: string;
    taxFileNumber: string; // plaintext — will be encrypted
    startDate: string;
    endDate: string;
    status: string;
    employmentType: string;
  }>): Promise<any | null> {
    const updateData: any = { ...data, updatedAt: new Date().toISOString() };

    // Encrypt TFN if provided
    if (data.taxFileNumber) {
      updateData.taxFileNumber = encryptField(data.taxFileNumber);
    }

    await db.update(employees).set(updateData).where(eq(employees.id, id));
    return this.getEmployee(id);
  }

  /**
   * Soft-delete employee (set status to terminated)
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
   * Add bank details for an employee
   * REVISION (D02): Encrypts BOTH BSB and account number at rest
   */
  async addBankDetails(employeeId: string, data: {
    bsb: string;            // plaintext — will be encrypted
    accountNumber: string;   // plaintext — will be encrypted
    accountName: string;
    splitPercentage?: number;
    isPrimary?: boolean;
  }): Promise<any> {
    const id = crypto.randomUUID();
    await db.insert(employeeBankDetails).values({
      id,
      employeeId,
      bsb: encryptField(data.bsb),                   // REVISION (D02): BSB encrypted at rest
      accountNumber: encryptField(data.accountNumber), // Account number encrypted at rest
      accountName: data.accountName,
      splitPercentage: data.splitPercentage ?? 100.0,
      isPrimary: data.isPrimary ?? true,
      createdAt: new Date().toISOString(),
    });
    return this.getBankDetails(employeeId);
  }

  /**
   * Get bank details for an employee (masked)
   * REVISION (D02): BSB also masked in response (decrypt + mask)
   */
  async getBankDetails(employeeId: string): Promise<any[]> {
    const rows = await db.select().from(employeeBankDetails)
      .where(eq(employeeBankDetails.employeeId, employeeId));
    return rows.map(r => ({
      ...r,
      bsb: maskBSB(decryptField(r.bsb)),                        // REVISION (D02): BSB masked
      accountNumber: maskAccountNumber(decryptField(r.accountNumber)),
    }));
  }

  /**
   * Get bank details with DECRYPTED values (internal use only — for pay runs)
   * REVISION (D02): Added for pay processing, never expose via API
   */
  async getBankDetailsInternal(employeeId: string): Promise<any[]> {
    const rows = await db.select().from(employeeBankDetails)
      .where(eq(employeeBankDetails.employeeId, employeeId));
    return rows.map(r => ({
      ...r,
      bsb: decryptField(r.bsb),
      accountNumber: decryptField(r.accountNumber),
    }));
  }

  // ============================
  // SUPER FUNDS
  // ============================

  async addSuperFund(employeeId: string, data: {
    fundName: string;
    fundABN?: string;
    usi?: string;
    memberNumber?: string;
    contributionRate?: number; // defaults to 11.5%
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

  async getSuperFund(employeeId: string): Promise<any[]> {
    return db.select().from(employeeSuperFunds)
      .where(eq(employeeSuperFunds.employeeId, employeeId));
  }

  // ============================
  // TAX DECLARATIONS
  // ============================

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

  async getTaxDeclaration(employeeId: string): Promise<any | null> {
    const rows = await db.select().from(employeeTaxDeclarations)
      .where(eq(employeeTaxDeclarations.employeeId, employeeId))
      .orderBy(desc(employeeTaxDeclarations.effectiveDate))
      .limit(1);
    return rows[0] ?? null;
  }

  // ============================
  // HELPERS
  // ============================

  /**
   * Mask sensitive fields for API responses
   */
  private maskSensitiveFields(employee: any): any {
    return {
      ...employee,
      taxFileNumber: employee.taxFileNumber ? maskTFN(decryptField(employee.taxFileNumber)) : null,
    };
  }

  /**
   * Get employee with DECRYPTED TFN (internal use only — never expose via API)
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
```

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] All CRUD methods compile (createEmployee, getEmployee, listEmployees, updateEmployee, terminateEmployee)
- [ ] Bank details methods compile (addBankDetails, getBankDetails)
- [ ] Super fund methods compile (addSuperFund, getSuperFund)
- [ ] Tax declaration methods compile (submitTaxDeclaration, getTaxDeclaration)
- [ ] TFN is encrypted before storage
- [ ] TFN is masked in getEmployee response
- [ ] Bank account number is encrypted before storage
- [ ] Bank account number is masked in getBankDetails response
- [ ] Create marker file: `.agent-done-W04-02`

## Dependencies
- **None** — can start immediately
- **Note**: Depends on Agent 4's `encryption.ts` at runtime, but can compile with stub types
