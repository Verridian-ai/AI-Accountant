export type CategoryType = 'ordinary' | 'overtime' | 'allowance' | 'deduction' | 'super' | 'leave';
export type RateType = 'hourly' | 'annual' | 'fixed';

export interface PayCategory {
  id: string;
  userId: string;
  name: string;
  type: CategoryType;
  rateType: RateType;
  defaultRateCents: number | null;
  multiplier: number | null;
  isTaxable: boolean;
  isSuperBearing: boolean;
  isActive: boolean;
  createdAt: string;
}
