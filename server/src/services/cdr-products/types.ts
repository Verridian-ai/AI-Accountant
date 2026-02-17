/**
 * CDR Product Service — Type Definitions
 */

export interface ProductSearchFilters {
  productCategory?: string;
  dataHolderIds?: string[];
  rateType?: string;
  maxRate?: number;
  minRate?: number;
  features?: string[];
  loanPurpose?: string;
  repaymentType?: string;
  searchText?: string;
  sortBy?: 'rate' | 'comparison_rate' | 'name' | 'data_holder';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface EnrichedProduct {
  id: string;
  dataHolderName: string;
  dataHolderLogo: string;
  name: string;
  description: string;
  productCategory: string;
  bestRate: number | null;
  comparisonRate: number | null;
  rateType: string | null;
  featureCount: number;
  feeCount: number;
  features: string[];
  applicationUri: string | null;
}

export interface ProductSearchResult {
  products: EnrichedProduct[];
  total: number;
  filters: ProductSearchFilters;
  rateRange: { min: number; max: number };
}

export interface ComparisonCategory {
  name: string;
  items: Array<{
    label: string;
    values: Record<string, string | number | boolean | null>;
  }>;
}

export interface ProductComparison {
  products: EnrichedProduct[];
  categories: ComparisonCategory[];
  annualFees: Record<string, number>;
  recommendation: string;
}

export interface BestRateResult {
  productId: string;
  productName: string;
  dataHolderName: string;
  dataHolderLogo: string;
  rate: number;
  comparisonRate: number | null;
  rateType: string;
  productCategory: string;
}

export interface SavingsCalculation {
  currentRate: number; // decimal (e.g. 0.065)
  currentBalance: number; // cents
  remainingTermMonths: number;
  switchingCosts?: number; // cents (default 0)
  topN?: number; // how many alternatives to return (default 5)
  productCategory?: string; // filter (default RESIDENTIAL_MORTGAGES)
}

export interface SavingsAlternative {
  productId: string;
  productName: string;
  dataHolderName: string;
  newRate: number;
  newMonthlyPayment: number; // cents
  currentMonthlyPayment: number; // cents
  monthlySaving: number; // cents
  totalLifetimeSaving: number; // cents (net of switching costs)
  breakEvenMonths: number; // months until switching costs are recouped
}

export interface SavingsResult {
  currentRate: number;
  currentMonthlyPayment: number; // cents
  currentTotalCost: number; // cents
  alternatives: SavingsAlternative[];
  bestSaving: SavingsAlternative | null;
}

export interface CategorySummary {
  category: string;
  productCount: number;
  avgLendingRate: number | null;
  avgDepositRate: number | null;
  minRate: number | null;
  maxRate: number | null;
}

export interface DataHolderSummary {
  id: string;
  brandName: string;
  logoUri: string | null;
  productCount: number;
  lastCrawledAt: string | null;
  avgLendingRate: number | null;
  avgDepositRate: number | null;
  status: string;
}
