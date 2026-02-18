/**
 * Pay Structure Types
 * Interfaces for Australian payroll pay categories and structures.
 */

export type PayCategoryType =
  | 'ordinary'
  | 'overtime'
  | 'allowance'
  | 'deduction'
  | 'super'
  | 'leave';
export type PayRateType = 'hourly' | 'annual' | 'fixed';

export interface CreatePayCategoryInput {
  userId: string;
  name: string;
  type: PayCategoryType;
  rateType: PayRateType;
  defaultRate?: number; // cents
  multiplier?: number;
  isTaxable?: boolean;
  isSuperBearing?: boolean;
}

export interface UpdatePayCategoryInput {
  name?: string;
  type?: string;
  rateType?: string;
  defaultRate?: number;
  multiplier?: number;
  isTaxable?: boolean;
  isSuperBearing?: boolean;
  isActive?: boolean;
}

export interface ListPayCategoriesOptions {
  page?: number;
  limit?: number;
  type?: string;
  activeOnly?: boolean;
}

export interface SetPayStructureInput {
  employeeId: string;
  payCategoryId: string;
  rate: number; // cents
  hoursPerWeek?: number;
  annualSalary?: number; // cents
  effectiveDate: string;
}

export interface GrossPayResult {
  grossPay: number; // cents
  breakdown: Array<{ category: string; amount: number }>;
}
