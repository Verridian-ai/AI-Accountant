/**
 * SBR Export Types & Interfaces
 */

export interface BusinessProfile {
  abn: string;
  businessName: string;
  tradingName?: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  postalAddress: {
    line1: string;
    line2?: string;
    suburb: string;
    state: string;
    postcode: string;
  };
  gstRegistered: boolean;
  gstBranch?: number;
  accountingBasis: 'accrual' | 'cash';
  annualReportingOption?: boolean;
}

export interface BASData {
  financialYear: string;
  quarter: number;
  periodStart: string;
  periodEnd: string;
  lodgementDate?: string;

  gstLabels: {
    G1: number;
    G2: number;
    G3: number;
    G4?: number;
    G5?: number;
    G6?: number;
    G7?: number;
    G8?: number;
    G9?: number;
    G10: number;
    G11: number;
    G12?: number;
    G13?: number;
    G14?: number;
    G15?: number;
    G16?: number;
    G17?: number;
    G18?: number;
    G19?: number;
    G20?: number;
  };

  gstSummary: {
    '1A': number;
    '1B': number;
    '1C'?: number;
    '1D'?: number;
    '1E'?: number;
    '1F'?: number;
    '1G'?: number;
  };

  paygWithholding: {
    W1: number;
    W2: number;
    W3?: number;
    W4?: number;
    W5?: number;
  };

  paygInstalment: {
    '5A'?: number;
    '5B'?: number;
    T1?: number;
    T2?: number;
    T3?: number;
    T4?: number;
    T7?: number;
    T8?: number;
    T9?: number;
  };

  fuelTaxCredits?: {
    '7A'?: number;
    '7B'?: number;
    '7C': number;
    '7D': number;
  };

  deferredGst?: {
    '7': number;
  };

  fbtInstalment?: {
    F1?: number;
    F2?: number;
    F3?: number;
    F4?: number;
  };
}

export interface ValidationError {
  code: string;
  label: string;
  message: string;
  severity: 'error' | 'warning';
  expectedValue?: number;
  actualValue?: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

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
