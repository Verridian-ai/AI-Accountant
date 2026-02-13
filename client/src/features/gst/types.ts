export type GSTCategory =
  | 'taxable_10'
  | 'gst_free'
  | 'input_taxed'
  | 'export'
  | 'capital'
  | 'private'
  | 'no_abn';

export interface GSTClassification {
  transactionId: number;
  gstCategory: GSTCategory;
  gstAmount: number; // cents
  confidence: number; // 0-1
  isOverride: boolean;
  overrideReason?: string;
}

export interface GSTReviewItem {
  id: number;
  date: string;
  description: string;
  amount: number;
  suggestedCategory: GSTCategory;
  suggestedGstAmount: number;
  confidence: number;
  currentCategory: string;
}

export interface GSTSummaryData {
  gstCollected: number; // 1A
  gstCredits: number; // 1B
  netGST: number;
  breakdown: {
    taxable: { sales: number; purchases: number };
    gstFree: { sales: number; purchases: number };
    inputTaxed: number;
    capital: number;
    private: number;
  };
  transactionsClassified: number;
  transactionsNeedReview: number;
  previousPeriodNetGST?: number;
}

export interface BASCalculationEnhanced {
  quarter: { year: number; quarter: 1 | 2 | 3 | 4 };
  method: 'simpler' | 'full';
  labels: {
    G1: number;
    G2?: number;
    G3?: number;
    G4?: number;
    G5?: number;
    G6?: number;
    G7?: number;
    G8?: number;
    G9?: number;
    G10?: number;
    G11?: number;
    G12?: number;
    '1A': number;
    '1B': number;
    W1?: number;
    W2?: number;
    '5A'?: number;
    '7C'?: number;
    '7D'?: number;
  };
  netGST: number;
  totalPayable: number;
  status: 'draft' | 'review' | 'ready' | 'lodged' | 'amended';
  dueDate: string;
  warnings: string[];
  transactionCounts?: Record<string, number>;
}

export interface InputTaxCredit {
  category: string;
  gstCredits: number;
  hasInvoice: boolean;
  transactionCount: number;
}

export interface BASComparisonData {
  periodA: { quarter: string; labels: Record<string, number> };
  periodB: { quarter: string; labels: Record<string, number> };
}
