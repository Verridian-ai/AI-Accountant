/**
 * BAS types — defined locally (no circular dependency on parent monolith).
 */

// GST Categories
export enum GSTCategory {
  TAXABLE_10 = 'taxable_10',
  GST_FREE = 'gst_free',
  INPUT_TAXED = 'input_taxed',
  EXPORT = 'export',
  CAPITAL = 'capital',
  PRIVATE = 'private',
}

// BAS Quarter dates
export interface QuarterDates {
  startDate: string;
  endDate: string;
  lodgementDue: string;
}

// BAS Labels interface
export interface BASLabels {
  G1: number; // Total sales
  G2: number; // Export sales
  G3: number; // Other GST-free sales
  G10: number; // Capital purchases
  G11: number; // Non-capital purchases
  '1A': number; // GST on sales
  '1B': number; // GST on purchases
  W1: number; // Total wages
  W2: number; // Amounts withheld
  '5A': number; // PAYG instalment
  '7C': number; // Fuel tax credits - business
  '7D': number; // Fuel tax credits - other
}

// BAS Calculation Result
export interface BASResult {
  period: {
    financialYear: string;
    quarter: number;
    startDate: string;
    endDate: string;
    lodgementDue: string;
  };
  labels: BASLabels;
  netGst: number;
  fuelTaxCredits: number;
  totalPayable: number;
  isRefund: boolean;
  transactionCount: number;
  /** Fields that are estimated (not derived from actual payroll/records) */
  estimated?: Record<string, boolean>;
  /** Human-readable warnings about estimated or approximated values */
  warnings?: string[];
}
