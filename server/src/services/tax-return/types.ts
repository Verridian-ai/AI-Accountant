/**
 * Tax Return Service — Type Definitions & Constants
 */

/** Deduction rates re-exported for agent consumption */
export const DEDUCTION_RATES = {
  wfhHourlyRate: 67, // 67 cents per hour
  motorVehicleCentsPerKm: 85,
  motorVehicleMaxKm: 5000,
  instantWriteOffThreshold: 2_000_000, // $20,000 in cents
  superContributionCapCents: 2_750_000, // $27,500 in cents
};

/** SBITO: 16% of net small business income, capped at $1,000 */
export function calculateSBITO(netSmallBusinessIncomeCents: number): number {
  if (netSmallBusinessIncomeCents <= 0) return 0;
  const offset = Math.round(netSmallBusinessIncomeCents * 0.16);
  return Math.min(offset, 100_000); // $1,000 = 100,000 cents
}

export interface TaxReturnResult {
  entityType: string;
  financialYear: string;
  grossIncomeCents: number;
  totalDeductionsCents: number;
  taxableIncomeCents: number;
  incomeTaxCents: number;
  medicareLevyCents: number;
  taxOffsetsCents: number;
  netTaxPayableCents: number;
  effectiveRate: number;
  breakdown: Record<string, number>;
  warnings: string[];
}
