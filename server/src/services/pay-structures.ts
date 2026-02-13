/**
 * Pay Structure Service
 * Manages pay categories and employee pay structures for Australian payroll.
 * All monetary values stored in CENTS (integer).
 */

import { db, payCategories, payStructures } from '../schema.js';
import { eq, and, desc, sql } from 'drizzle-orm';
import crypto from 'crypto';

export class PayStructureService {

  // ============================
  // PAY CATEGORIES
  // ============================

  /**
   * Create a pay category
   */
  async createPayCategory(data: {
    userId: string;
    name: string;
    type: 'ordinary' | 'overtime' | 'allowance' | 'deduction' | 'super' | 'leave';
    rateType: 'hourly' | 'annual' | 'fixed';
    defaultRate?: number; // cents
    multiplier?: number;
    isTaxable?: boolean;
    isSuperBearing?: boolean;
  }): Promise<any> {
    const id = crypto.randomUUID();
    await db.insert(payCategories).values({
      id,
      userId: data.userId,
      name: data.name,
      type: data.type,
      rateType: data.rateType,
      defaultRate: data.defaultRate ?? 0,
      multiplier: data.multiplier ?? 1.0,
      isTaxable: data.isTaxable ?? true,
      isSuperBearing: data.isSuperBearing ?? true,
      isActive: true,
      createdAt: new Date().toISOString(),
    });
    return this.getPayCategory(id);
  }

  /**
   * Get a pay category by ID
   */
  async getPayCategory(id: string): Promise<any | null> {
    const rows = await db.select().from(payCategories).where(eq(payCategories.id, id)).limit(1);
    return rows[0] ?? null;
  }

  /**
   * List pay categories for a user
   */
  async listPayCategories(userId: string, options?: {
    page?: number;
    limit?: number;
    type?: string;
    activeOnly?: boolean;
  }): Promise<{ data: any[]; total: number }> {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 50;
    const offset = (page - 1) * limit;

    const conditions = [eq(payCategories.userId, userId)];
    if (options?.activeOnly !== false) {
      conditions.push(eq(payCategories.isActive, true));
    }

    const countResult = await db.select({ count: sql<number>`COUNT(*)` })
      .from(payCategories)
      .where(and(...conditions));
    const total = Number(countResult[0]?.count ?? 0);

    const rows = await db.select().from(payCategories)
      .where(and(...conditions))
      .orderBy(payCategories.type, payCategories.name)
      .limit(limit)
      .offset(offset);

    return { data: rows, total };
  }

  /**
   * Update a pay category
   */
  async updatePayCategory(id: string, data: Partial<{
    name: string;
    type: string;
    rateType: string;
    defaultRate: number;
    multiplier: number;
    isTaxable: boolean;
    isSuperBearing: boolean;
    isActive: boolean;
  }>): Promise<any | null> {
    await db.update(payCategories).set(data).where(eq(payCategories.id, id));
    return this.getPayCategory(id);
  }

  /**
   * Seed default Australian pay categories for a new user.
   * Creates 12 standard categories covering ordinary time, overtime,
   * allowances, deductions, super, and leave — aligned with STP reporting.
   */
  async seedDefaultCategories(userId: string): Promise<void> {
    const defaults = [
      { name: 'Base Hourly', type: 'ordinary', rateType: 'hourly', multiplier: 1.0 },
      { name: 'Base Salary', type: 'ordinary', rateType: 'annual', multiplier: 1.0 },
      { name: 'Overtime 1.5x', type: 'overtime', rateType: 'hourly', multiplier: 1.5 },
      { name: 'Overtime 2.0x', type: 'overtime', rateType: 'hourly', multiplier: 2.0 },
      { name: 'Meal Allowance', type: 'allowance', rateType: 'fixed', isSuperBearing: false },
      { name: 'Travel Allowance', type: 'allowance', rateType: 'fixed', isSuperBearing: false },
      { name: 'Union Fees', type: 'deduction', rateType: 'fixed', isTaxable: false, isSuperBearing: false },
      { name: 'Super Guarantee', type: 'super', rateType: 'fixed', isTaxable: false },
      { name: 'Salary Sacrifice Super', type: 'super', rateType: 'fixed', isTaxable: false },
      { name: 'Annual Leave', type: 'leave', rateType: 'hourly', multiplier: 1.0 },
      { name: 'Personal/Carer Leave', type: 'leave', rateType: 'hourly', multiplier: 1.0 },
      { name: 'Long Service Leave', type: 'leave', rateType: 'hourly', multiplier: 1.0 },
    ];

    for (const cat of defaults) {
      await this.createPayCategory({
        userId,
        name: cat.name,
        type: cat.type as any,
        rateType: cat.rateType as any,
        multiplier: cat.multiplier,
        isTaxable: cat.isTaxable,
        isSuperBearing: cat.isSuperBearing,
      });
    }
  }

  // ============================
  // PAY STRUCTURES
  // ============================

  /**
   * Set pay structure for an employee.
   * Creates a new record (keeps history via effective dates).
   */
  async setPayStructure(data: {
    employeeId: string;
    payCategoryId: string;
    rate: number; // cents
    hoursPerWeek?: number;
    annualSalary?: number; // cents
    effectiveDate: string;
  }): Promise<any> {
    const id = crypto.randomUUID();
    await db.insert(payStructures).values({
      id,
      employeeId: data.employeeId,
      payCategoryId: data.payCategoryId,
      rate: data.rate,
      hoursPerWeek: data.hoursPerWeek ?? null,
      annualSalary: data.annualSalary ?? null,
      effectiveDate: data.effectiveDate,
      createdAt: new Date().toISOString(),
    });
    return this.getPayStructure(data.employeeId);
  }

  /**
   * Get current pay structure for an employee.
   * Returns all active pay category assignments (most recent effective date per category).
   */
  async getPayStructure(employeeId: string): Promise<any[]> {
    const rows = await db.select().from(payStructures)
      .where(eq(payStructures.employeeId, employeeId))
      .orderBy(desc(payStructures.effectiveDate));

    // Deduplicate by payCategoryId — keep most recent
    const seen = new Set<string>();
    const current: any[] = [];
    for (const row of rows) {
      if (!seen.has(row.payCategoryId)) {
        seen.add(row.payCategoryId);
        current.push(row);
      }
    }
    return current;
  }

  /**
   * Get pay structure history for an employee (all records)
   */
  async getPayStructureHistory(employeeId: string): Promise<any[]> {
    return db.select().from(payStructures)
      .where(eq(payStructures.employeeId, employeeId))
      .orderBy(desc(payStructures.effectiveDate));
  }

  /**
   * Calculate gross pay for a period.
   * Simple calculation — Wave 5 will add PAYG, super, leave.
   */
  async calculateGrossPay(employeeId: string, hoursWorked: number): Promise<{
    grossPay: number; // cents
    breakdown: Array<{ category: string; amount: number }>;
  }> {
    const structures = await this.getPayStructure(employeeId);
    let grossPay = 0;
    const breakdown: Array<{ category: string; amount: number }> = [];

    for (const struct of structures) {
      // Get the pay category details
      const category = await this.getPayCategory(struct.payCategoryId);
      if (!category) continue;

      let amount = 0;
      if (category.rateType === 'hourly') {
        amount = Math.round(struct.rate * (category.multiplier ?? 1.0) * hoursWorked);
      } else if (category.rateType === 'annual') {
        // Annual salary / 52 weeks = weekly pay
        const weeklyPay = Math.round((struct.annualSalary ?? 0) / 52);
        amount = weeklyPay;
      } else if (category.rateType === 'fixed') {
        amount = struct.rate;
      }

      if (category.type !== 'deduction') {
        grossPay += amount;
      } else {
        grossPay -= amount;
      }

      breakdown.push({ category: category.name, amount });
    }

    return { grossPay, breakdown };
  }
}

export const payStructureService = new PayStructureService();
