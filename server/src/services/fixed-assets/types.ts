/**
 * Fixed Asset Types and Interfaces
 *
 * ATO-compliant type definitions for the fixed asset depreciation engine.
 * All monetary values are in cents (integer) to avoid floating-point precision issues.
 */

// ============================================================================
// TYPES
// ============================================================================

export type AssetCategory =
  | 'plant_and_equipment'
  | 'motor_vehicle'
  | 'office_equipment'
  | 'computer_equipment'
  | 'furniture_fittings'
  | 'building'
  | 'land'
  | 'leasehold_improvement'
  | 'intangible'
  | 'low_value_pool';

export type DepreciationMethod =
  | 'straight_line'
  | 'diminishing_value'
  | 'instant_write_off'
  | 'low_value_pool';

export type AssetStatus = 'active' | 'disposed' | 'fully_depreciated' | 'written_off';

export interface FixedAsset {
  id: string;
  userId: string;
  entityId: string | null;
  accountId: string | null;
  assetNumber: string;
  assetName: string;
  category: AssetCategory;
  purchaseDate: string;
  purchasePrice: number;
  residualValue: number;
  usefulLifeMonths: number;
  depreciationMethod: DepreciationMethod;
  effectiveLifeYears: number;
  openingWrittenDownValue: number;
  currentWrittenDownValue: number;
  status: AssetStatus;
  location: string | null;
  serialNumber: string | null;
  supplier: string | null;
  invoiceReference: string | null;
  gstClaimed: number;
  createdAt: string;
  updatedAt: string;
}

export interface AssetDisposal {
  id: string;
  assetId: string;
  disposalDate: string;
  disposalMethod: string;
  proceeds: number;
  gstOnProceeds: number;
  writtenDownValueAtDisposal: number;
  profitLoss: number;
  cgtApplicable: boolean;
  cgtDiscountEligible: boolean;
  buyerDetails: string | null;
  invoiceReference: string | null;
  notes: string | null;
  createdAt: string;
}

export interface DepreciationResult {
  openingValue: number;
  depreciationAmount: number;
  closingValue: number;
  rate: number;
  method: DepreciationMethod;
  daysHeld: number;
}

// ============================================================================
// ATO EFFECTIVE LIFE TABLE (years)
// Per ATO TR 2024/3 — Effective life of depreciating assets
// ============================================================================

export const ATO_EFFECTIVE_LIVES: Record<AssetCategory, number> = {
  plant_and_equipment: 10,
  motor_vehicle: 8,
  office_equipment: 10,
  computer_equipment: 4,
  furniture_fittings: 13.33,
  building: 40,
  land: 0, // land is not depreciated
  leasehold_improvement: 10,
  intangible: 5,
  low_value_pool: 0, // pool rate, not life-based
};

/** SBE instant write-off threshold in cents ($20,000) */
export const INSTANT_WRITE_OFF_THRESHOLD = 20_000_00;

/** Low value pool threshold in cents ($1,000) */
export const LOW_VALUE_POOL_THRESHOLD = 1_000_00;

/** LVP first year rate */
export const LVP_FIRST_YEAR_RATE = 0.375;

/** LVP subsequent year rate */
export const LVP_SUBSEQUENT_RATE = 0.3;

// ============================================================================
// FINANCIAL YEAR HELPERS
// ============================================================================

/** Parse a financial year string like "2024-25" into start/end dates */
export function parseFY(fy: string): { start: Date; end: Date } {
  const parts = fy.split('-');
  const startYear = parseInt(parts[0], 10);
  // FY 2024-25 runs from 1 July 2024 to 30 June 2025
  return {
    start: new Date(startYear, 6, 1), // July 1
    end: new Date(startYear + 1, 5, 30), // June 30
  };
}

/** Get the financial year string for a given date (e.g., 2025-01-15 -> "2024-25") */
export function getFYForDate(dateStr: string): string {
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const month = d.getMonth(); // 0-indexed
  if (month >= 6) {
    // July onwards = start of new FY
    return `${year}-${String(year + 1).slice(2)}`;
  }
  return `${year - 1}-${String(year).slice(2)}`;
}

/** Calculate days between two dates (inclusive of start, exclusive of end) */
export function daysBetween(from: Date, to: Date): number {
  const msPerDay = 86_400_000;
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / msPerDay));
}
