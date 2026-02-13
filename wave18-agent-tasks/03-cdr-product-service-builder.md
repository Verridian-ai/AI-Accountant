# Agent 3: CDR Product Service Builder

## Role
Build the product search, comparison, and savings calculation service that queries crawled CDR data to help users find the best banking products and calculate potential savings.

## Priority: WAVE 18 (After Agent 1)

## Wait Condition
Check for `.agent-done-W18-01` marker file before starting.

## Files to CREATE

### 1. `server/src/services/cdr-products.ts`
**Purpose**: Query, compare, and analyze CDR product data
**Pattern**: Service class similar to `server/src/services/ledger.ts`

- [ ] Create `CdrProductService` class:

- [ ] `async searchProducts(filters: ProductSearchFilters): Promise<ProductSearchResult>`
  ```typescript
  interface ProductSearchFilters {
    productCategory?: string;         // RESIDENTIAL_MORTGAGES, TRANS_AND_SAVINGS_ACCOUNTS, TERM_DEPOSITS, CREDIT_CARDS, PERSONAL_LOANS, BUSINESS_LOANS
    dataHolderIds?: string[];         // filter by specific banks
    rateType?: string;                // FIXED, VARIABLE, INTRODUCTORY
    maxRate?: number;                 // maximum interest rate (for lending)
    minRate?: number;                 // minimum interest rate (for deposits)
    features?: string[];              // OFFSET_ACCOUNT, REDRAW, EXTRA_REPAYMENTS, FREE_TXNS
    loanPurpose?: string;             // OWNER_OCCUPIED, INVESTMENT
    repaymentType?: string;           // PRINCIPAL_AND_INTEREST, INTEREST_ONLY
    searchText?: string;              // full-text search on name/description
    sortBy?: 'rate' | 'comparison_rate' | 'name' | 'data_holder';
    sortOrder?: 'asc' | 'desc';
    limit?: number;                   // default 20
    offset?: number;                  // default 0
  }

  interface ProductSearchResult {
    products: EnrichedProduct[];
    total: number;
    filters: ProductSearchFilters;
    rateRange: { min: number; max: number };
  }

  interface EnrichedProduct {
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
  ```
  - Join `cdr_products` with `cdr_data_holders`, aggregate best rate from `cdr_lending_rates` or `cdr_deposit_rates`
  - Apply all filters as WHERE clauses
  - Return paginated results with rate range metadata

- [ ] `async compareProducts(productIds: string[]): Promise<ProductComparison>`
  ```typescript
  interface ProductComparison {
    products: DetailedProduct[];
    comparisonMatrix: ComparisonMatrix;
    recommendation: string;
  }

  interface DetailedProduct {
    id: string;
    dataHolderName: string;
    name: string;
    productCategory: string;
    lendingRates: CdrLendingRate[];
    depositRates: CdrDepositRate[];
    fees: CdrFee[];
    features: CdrFeature[];
    eligibility: CdrEligibility[];
    totalAnnualFees: number;
    bestLendingRate: number | null;
    bestDepositRate: number | null;
    comparisonRate: number | null;
  }

  interface ComparisonMatrix {
    categories: string[];
    rows: Array<{
      category: string;
      values: Record<string, string | number | boolean>;
    }>;
  }
  ```
  - Fetch full product details for up to 5 products
  - Build comparison matrix with categories: Rates, Fees, Features, Eligibility
  - Calculate total annual fees per product
  - Generate plain-text recommendation based on lowest effective cost

- [ ] `async getBestRates(category: string, rateType: 'lending' | 'deposit', limit?: number): Promise<BestRateResult[]>`
  ```typescript
  interface BestRateResult {
    productId: string;
    productName: string;
    dataHolderName: string;
    dataHolderLogo: string;
    rate: number;
    comparisonRate: number | null;
    rateType: string;
    loanPurpose: string | null;
    repaymentType: string | null;
    conditions: string | null;
  }
  ```
  - Query lowest lending rates or highest deposit rates
  - Group by rate type (FIXED, VARIABLE)
  - Default limit: 10

- [ ] `async calculateSavings(params: SavingsCalculation): Promise<SavingsResult>`
  ```typescript
  interface SavingsCalculation {
    currentRate: number;
    currentBalance: number;
    currentMonthlyRepayment?: number;
    remainingTermMonths?: number;
    productCategory: string;
    loanPurpose?: string;
    topN?: number;                    // compare against top N products (default 5)
  }

  interface SavingsResult {
    currentCost: {
      totalInterest: number;
      totalRepayments: number;
      monthlyRepayment: number;
    };
    alternatives: Array<{
      productId: string;
      productName: string;
      dataHolderName: string;
      rate: number;
      comparisonRate: number | null;
      monthlySaving: number;
      totalSaving: number;
      totalInterest: number;
      breakEvenMonths: number | null;
    }>;
    bestSaving: {
      annual: number;
      lifetime: number;
      productName: string;
    };
  }
  ```
  - Find top N products with lower rates than current
  - Calculate amortization for current vs each alternative
  - Include break-even analysis accounting for switching costs
  - Sort alternatives by total lifetime saving

- [ ] `async getProductCategories(): Promise<CategorySummary[]>`
  - Return distinct product categories with counts and rate ranges

- [ ] `async getDataHolderSummary(): Promise<DataHolderSummary[]>`
  - Return list of data holders with product counts, last crawl time, average rates

## Files to MODIFY

None.

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `searchProducts({ productCategory: 'RESIDENTIAL_MORTGAGES' })` returns filtered results
- [ ] `compareProducts([id1, id2])` returns comparison matrix with all rate/fee/feature rows
- [ ] `getBestRates('RESIDENTIAL_MORTGAGES', 'lending')` returns sorted rates
- [ ] `calculateSavings()` correctly calculates amortization and savings figures
- [ ] Create marker file: `.agent-done-W18-03`

## Dependencies
- **Requires**: Agent 1 (`.agent-done-W18-01`) for CDR schema/tables
- **Reuses**: Drizzle ORM query patterns, amortization math from `server/src/services/loan-calculator.ts`
