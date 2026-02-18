export type RateType = 'hourly' | 'annual' | 'fixed';
export type CategoryType = 'ordinary' | 'overtime' | 'allowance' | 'deduction' | 'super' | 'leave';

export interface PayCategory {
  id: string;
  name: string;
  type: CategoryType;
  rateType: RateType;
  defaultRateCents: number | null;
  multiplier: number | null;
  isTaxable: boolean;
  isSuperBearing: boolean;
  isActive: boolean;
}

export interface PayStructureItem {
  id?: string;
  payCategoryId: string;
  categoryName?: string;
  categoryType?: CategoryType;
  rateType: RateType;
  rateCents: number;
  hoursPerWeek: number | null;
  annualSalaryCents: number | null;
  multiplier: number;
  effectiveDate: string;
  isActive: boolean;
}

export interface EmployeeSummary {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  employment_type: string;
  position?: string;
}

export interface PayStructureEditorProps {
  employeeId: string;
  onBack?: () => void;
}

export interface PaySummary {
  weekly: number;
  fortnightly: number;
  monthly: number;
  annual: number;
  superAnnual: number;
  superMonthly: number;
}
