// BAS Types
export interface BASQuarter {
  id: string;
  year: number;
  quarter: 1 | 2 | 3 | 4;
  startDate: string;
  endDate: string;
  lodgementDueDate: string;
  status: 'pending' | 'draft' | 'lodged';
}

export interface BASCalculation {
  periodId: string;
  // Sales
  g1_total_sales: number;
  g2_export_sales: number;
  g3_gst_free_sales: number;
  g4_input_taxed_sales: number;
  g5_g2_to_g4: number;
  g6_total_taxable_sales: number;
  g7_adjustments: number;
  g8_total_sales_subject_gst: number;
  g9_gst_on_sales: number;
  // Purchases
  g10_capital_purchases: number;
  g11_non_capital_purchases: number;
  g12_g10_plus_g11: number;
  g13_purchases_no_gst_credit: number;
  g14_estimated_purchases: number;
  g15_total_purchases: number;
  g16_g12_minus_g15: number;
  g17_adjustments: number;
  g18_total_purchases_credit: number;
  g19_gst_credits: number;
  g20_net_gst: number;
  // PAYG
  w1_gross_wages: number;
  w2_amounts_withheld: number;
  payg_instalment_5a: number;
  // Other
  fuel_tax_credits_7c: number;
  wine_equalisation_7d: number;
  net_amount_payable: number;
  net_refund: number;
}

// Tax Types
export interface TaxBracket {
  id: string;
  taxYear: string;
  entityType: string;
  minIncome: number;
  maxIncome: number | null;
  baseTax: number;
  marginalRate: number;
}

export interface Deduction {
  id: string;
  userId: string;
  taxYear: string;
  category: string;
  subcategory?: string;
  description: string;
  amount: number;
  calculationMethod?: string;
  calculationDetails?: string;
  supportingDocs?: string;
  isSubstantiated?: boolean;
  linkedTransactionIds?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CGTAsset {
  id: string;
  userId: string;
  assetName: string;
  assetType: string;
  acquisitionDate: string;
  acquisitionCost: number;
  acquisitionCostsIncidental?: number;
  improvementsCost?: number;
  quantity?: number;
  unitCost?: number;
  status: 'held' | 'disposed';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CGTEvent {
  id: string;
  assetId: string;
  userId: string;
  taxYear: string;
  disposalDate: string;
  disposalProceeds: number;
  disposalCosts?: number;
  quantityDisposed?: number;
  costBaseUsed: number;
  capitalGainGross?: number;
  discountApplied?: boolean;
  discountAmount?: number;
  capitalGainNet?: number;
  capitalLoss?: number;
  calculationDetails?: string;
  createdAt: string;
}

export interface DepreciableAsset {
  id: string;
  userId: string;
  assetName: string;
  assetCategory: string;
  purchaseDate: string;
  purchaseCost: number;
  effectiveLifeYears: number;
  depreciationMethod: 'diminishing' | 'prime_cost';
  businessUsePercentage?: number;
  openingWrittenDownValue?: number;
  currentWrittenDownValue?: number;
  isInstantWriteOff?: boolean;
  poolId?: string;
  status: 'active' | 'disposed' | 'written_off';
  linkedTransactionId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaxSummary {
  id: string;
  userId: string;
  taxYear: string;
  totalGrossIncome?: number;
  totalDeductions?: number;
  taxableIncome?: number;
  netCapitalGain?: number;
  totalCapitalGains?: number;
  capitalLossesOffset?: number;
  taxOnTaxableIncome?: number;
  medicareLevy?: number;
  medicareLevySurcharge?: number;
  taxOffsetsTotal?: number;
  totalTaxPayable?: number;
  effectiveTaxRate?: number;
  taxWithheld?: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaxCalculationResult {
  grossIncome: number;
  deductions: number;
  taxableIncome: number;
  incomeTax: number;
  medicareLevy: number;
  medicareSurcharge: number;
  taxOffsets: number;
  totalTax: number;
  effectiveTaxRate: number;
  takeHomeAnnual: number;
  takeHomeMonthly: number;
  taxYear?: string;
}

export interface ConsolidatedReport {
  period: {
    startDate: string;
    endDate: string;
  };
  accounts: Array<{
    accountId: string;
    accountName: string;
    bankName: string;
    openingBalance: number;
    closingBalance: number;
    totalIncome: number;
    totalExpenses: number;
    transactionCount: number;
  }>;
  totals: {
    totalIncome: number;
    totalExpenses: number;
    netWorth: number;
  };
  transfersExcluded: number;
}

export interface SupportedBank {
  bankId: string;
  bankName: string;
  displayName: string;
  dateFormats: string[];
  isSupported: boolean;
}
