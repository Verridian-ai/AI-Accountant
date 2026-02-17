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
  description: string;
  amountCents: number;
  method?: string;
  linkedTransactionId?: string;
  createdAt: string;
}

export interface CGTAsset {
  id: string;
  userId: string;
  assetName: string;
  assetType: string;
  acquisitionDate: string;
  acquisitionCostCents: number;
  incidentalCostsCents: number;
  improvementsCents: number;
  quantity: number;
  unitCostCents?: number;
  isDisposed: boolean;
  createdAt: string;
}

export interface CGTEvent {
  id: string;
  userId: string;
  assetId: string;
  disposalDate: string;
  disposalProceedsCents: number;
  disposalCostsCents: number;
  quantityDisposed: number;
  costBaseCents: number;
  capitalGainGrossCents: number;
  discountEligible: boolean;
  discountAmountCents: number;
  capitalGainNetCents: number;
  capitalLossCents: number;
  taxYear: string;
  createdAt: string;
}

export interface DepreciableAsset {
  id: string;
  userId: string;
  assetName: string;
  assetType: string;
  purchaseDate: string;
  purchaseCostCents: number;
  effectiveLifeYears: number;
  depreciationMethod: string;
  businessUsePercent: number;
  openingValueCents: number;
  currentValueCents: number;
  isActive: boolean;
  createdAt: string;
}

export interface TaxSummary {
  id: string;
  userId: string;
  taxYear: string;
  grossIncomeCents: number;
  totalDeductionsCents: number;
  taxableIncomeCents: number;
  netCapitalGainCents: number;
  carriedForwardLossesCents: number;
  taxPayableCents: number;
  taxWithheldCents: number;
  taxRefundCents: number;
  medicareLevy: number;
  medicareSurcharge: number;
  isFinalized: boolean;
}

export interface TaxCalculationResult {
  gross_income: number;
  taxable_income: number;
  income_tax: number;
  medicare_levy: number;
  medicare_surcharge: number;
  lito: number;
  total_tax: number;
  effective_rate: number;
  marginal_rate: number;
  brackets_breakdown: Array<{
    bracket: string;
    income_in_bracket: number;
    tax_for_bracket: number;
  }>;
}

