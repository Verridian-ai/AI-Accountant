/**
 * Pay Structure Service
 * Manages pay categories and employee pay structures for Australian payroll.
 * All monetary values stored in CENTS (integer).
 */

import { db, payCategories, payStructures } from '../../schema.js';
import { eq, and, desc, sql } from 'drizzle-orm';
import crypto from 'crypto';
import type {
  CreatePayCategoryInput,
  UpdatePayCategoryInput,
  ListPayCategoriesOptions,
  SetPayStructureInput,
  GrossPayResult,
} from './types.js';

export class PayStructureService {
  // ============================
  // PAY CATEGORIES
  // ============================

  /**
   * Create a pay category
   */
  async createPayCategory(data: CreatePayCategoryInput): Promise<Record<string, unknown>> {
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
    return this.getPayCategory(id) as Promise<Record<string, unknown>>;
  }

  /**
   * Get a pay category by ID
   */
  async getPayCategory(id: string): Promise<Record<string, unknown> | null> {
    const rows = await db.select().from(payCategories).where(eq(payCategories.id, id)).limit(1);
    return (rows[0] as Record<string, unknown>) ?? null;
  }

  /**
   * List pay categories for a user
   */
  async listPayCategories(
    userId: string,
    options?: ListPayCategoriesOptions,
  ): Promise<{ data: Record<string, unknown>[]; total: number }> {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 50;
    const offset = (page - 1) * limit;

    const conditions = [eq(payCategories.userId, userId)];
    if (options?.activeOnly !== false) {
      conditions.push(eq(payCategories.isActive, true));
    }

    const countResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(payCategories)
      .where(and(...conditions));
    const total = Number(countResult[0]?.count ?? 0);

    const rows = await db
      .select()
      .from(payCategories)
      .where(and(...conditions))
      .orderBy(payCategories.type, payCategories.name)
      .limit(limit)
      .offset(offset);

    return { data: rows as Record<string, unknown>[], total };
  }

  /**
   * Update a pay category
   */
  async updatePayCategory(
    id: string,
    data: UpdatePayCategoryInput,
  ): Promise<Record<string, unknown> | null> {
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
      {
        name: 'Union Fees',
        type: 'deduction',
        rateType: 'fixed',
        isTaxable: false,
        isSuperBearing: false,
      },
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
        type: cat.type as CreatePayCategoryInput['type'],
        rateType: cat.rateType as CreatePayCategoryInput['rateType'],
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
  async setPayStructure(data: SetPayStructureInput): Promise<Record<string, unknown>[]> {
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
  async getPayStructure(employeeId: string): Promise<Record<string, unknown>[]> {
    const rows = await db
      .select()
      .from(payStructures)
      .where(eq(payStructures.employeeId, employeeId))
      .orderBy(desc(payStructures.effectiveDate));

    // Deduplicate by payCategoryId — keep most recent
    const seen = new Set<string>();
    const current: Record<string, unknown>[] = [];
    for (const row of rows as Record<string, unknown>[]) {
      const categoryId = String(row.payCategoryId ?? '');
      if (!seen.has(categoryId)) {
        seen.add(categoryId);
        current.push(row);
      }
    }
    return current;
  }

  /**
   * Get pay structure history for an employee (all records)
   */
  async getPayStructureHistory(employeeId: string): Promise<Record<string, unknown>[]> {
    return db
      .select()
      .from(payStructures)
      .where(eq(payStructures.employeeId, employeeId))
      .orderBy(desc(payStructures.effectiveDate)) as Promise<Record<string, unknown>[]>;
  }

  /**
   * Calculate gross pay for a period.
   */
  async calculateGrossPay(employeeId: string, hoursWorked: number): Promise<GrossPayResult> {
    const structures = await this.getPayStructure(employeeId);
    let grossPay = 0;
    const breakdown: Array<{ category: string; amount: number }> = [];

    for (const struct of structures) {
      const category = await this.getPayCategory(String(struct.payCategoryId ?? ''));
      if (!category) continue;

      let amount = 0;
      if (category.rateType === 'hourly') {
        amount = Math.round(
          Number(struct.rate) * (Number(category.multiplier) || 1.0) * hoursWorked,
        );
      } else if (category.rateType === 'annual') {
        // Annual salary / 52 weeks = weekly pay
        const weeklyPay = Math.round((Number(struct.annualSalary) || 0) / 52);
        amount = weeklyPay;
      } else if (category.rateType === 'fixed') {
        amount = Number(struct.rate);
      }

      if (category.type !== 'deduction') {
        grossPay += amount;
      } else {
        grossPay -= amount;
      }

      breakdown.push({ category: String(category.name), amount });
    }

    return { grossPay, breakdown };
  }
}

export const payStructureService = new PayStructureService();
