/**
 * SBR (Standard Business Reporting) Types & Interfaces
 *
 * All types used across the SBR export modules.
 */

/**
 * Business profile required for SBR submission
 */
export interface BusinessProfile {
  abn: string; // 11-digit ABN
  businessName: string;
  tradingName?: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  postalAddress: {
    line1: string;
    line2?: string;
    suburb: string;
    state: string; // NSW, VIC, QLD, SA, WA, TAS, NT, ACT
    postcode: string;
  };
  gstRegistered: boolean;
  gstBranch?: number; // For multi-branch GST registrations
  accountingBasis: 'accrual' | 'cash';
  annualReportingOption?: boolean; // GST annual reporting option
}

/**
 * BAS data structure for SBR export
 */
export interface BASData {
  financialYear: string; // e.g., '2024-25'
  quarter: number; // 1, 2, 3, or 4
  periodStart: string; // YYYY-MM-DD
  periodEnd: string; // YYYY-MM-DD
  lodgementDate?: string; // YYYY-MM-DD (defaults to today)

  // GST Section - G Labels (amounts in cents)
  gstLabels: {
    G1: number; // Total sales (including any GST)
    G2: number; // Export sales
    G3: number; // Other GST-free sales
    G4?: number; // Input taxed sales (optional)
    G5?: number; // Total GST-free and input taxed sales (calculated: G2 + G3 + G4)
    G6?: number; // Total sales subject to GST (calculated: G1 - G5)
    G7?: number; // Adjustments (optional)
    G8?: number; // Total sales subject to GST after adjustments (calculated: G6 + G7)
    G9?: number; // GST on sales (calculated: G8 / 11)
    G10: number; // Capital purchases
    G11: number; // Non-capital purchases
    G12?: number; // G10 + G11 (calculated)
    G13?: number; // Purchases for making input taxed sales
    G14?: number; // Purchases without GST in price
    G15?: number; // Estimated purchases for private use
    G16?: number; // Total purchases (calculated: G12 - G13 - G14 - G15)
    G17?: number; // Adjustments (optional)
    G18?: number; // Total purchases subject to GST (calculated: G16 + G17)
    G19?: number; // GST on purchases (calculated: G18 / 11)
    G20?: number; // GST payable (calculated: G9 - G19) - Can be negative for refund
  };

  // GST Summary Labels (amounts in cents)
  gstSummary: {
    '1A': number; // GST on sales
    '1B': number; // GST on purchases
    '1C'?: number; // Wine equalisation tax payable
    '1D'?: number; // Wine equalisation tax refundable
    '1E'?: number; // Luxury car tax payable
    '1F'?: number; // Luxury car tax refundable
    '1G'?: number; // GST amounts you owe ATO from WET/LCT
  };

  // PAYG Withholding - W Labels (amounts in cents)
  paygWithholding: {
    W1: number; // Total salary, wages, and other payments
    W2: number; // Amounts withheld from payments at W1
    W3?: number; // Other amounts withheld (excludes W2)
    W4?: number; // Total amounts withheld (calculated: W2 + W3)
    W5?: number; // Amounts withheld where no ABN quoted
  };

  // PAYG Instalment - 5 Labels (amounts in cents)
  paygInstalment: {
    '5A'?: number; // PAYG instalment income
    '5B'?: number; // New varied instalment amount (optional)
    T1?: number; // Instalment income
    T2?: number; // Varied commissioner's instalment rate
    T3?: number; // New varied instalment amount
    T4?: number; // Estimated tax for year
    T7?: number; // Reason code for variation
    T8?: number; // Varied PAYG instalment amount
    T9?: number; // Credit from PAYG instalment variation
  };

  // Fuel Tax Credits - 7 Labels (amounts in cents)
  fuelTaxCredits?: {
    '7A'?: number; // Fuel tax credits for eligible fuel use
    '7B'?: number; // Fuel tax credits for heavy vehicles
    '7C': number; // Fuel tax credits - business use
    '7D': number; // Fuel tax credits - other activities
  };

  // Deferred GST - Label 7 (amounts in cents)
  deferredGst?: {
    '7': number; // Deferred GST on imports
  };

  // FBT Instalment (amounts in cents)
  fbtInstalment?: {
    F1?: number; // ATO-notified FBT instalment
    F2?: number; // Varied FBT instalment amount
    F3?: number; // FBT tax for year
    F4?: number; // Reason code for FBT variation
  };
}

/**
 * Validation error structure
 */
export interface ValidationError {
  code: string;
  label: string;
  message: string;
  severity: 'error' | 'warning';
  expectedValue?: number;
  actualValue?: number;
}

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

/**
 * SBR Export result
 */
export interface SBRExportResult {
  id: string;
  format: 'xml' | 'csv' | 'pdf';
  filePath: string;
  fileName: string;
  fileSize: number;
  validation: ValidationResult;
  createdAt: string;
  expiresAt: string;
}

/**
 * Export history entry
 */
export interface ExportHistoryEntry {
  id: string;
  userId: string;
  financialYear: string;
  quarter: number;
  format: string;
  status: string;
  filePath?: string;
  createdAt: string;
  expiresAt?: string;
}

// ATO State codes
export const VALID_STATES = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];

// SBR XML Namespaces
export const SBR_NAMESPACES = {
  sbr: 'http://sbr.gov.au/ato/activity.statement.2023',
  xsi: 'http://www.w3.org/2001/XMLSchema-instance',
  common: 'http://sbr.gov.au/comn/sbr.02.00.data',
  party: 'http://sbr.gov.au/rprt/party.details.01.00.data',
};
