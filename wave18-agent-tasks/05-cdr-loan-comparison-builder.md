# Agent 5: CDR Loan Comparison Builder

## Role
Upgrade the existing loan calculator service to use real CDR rates instead of hardcoded values, and add CDR-powered refinancing analysis, borrowing capacity estimation, and rate scenario modeling.

## Priority: WAVE 18 (After Agents 1, 2, 3)

## Wait Condition
Check for `.agent-done-W18-01`, `.agent-done-W18-02`, `.agent-done-W18-03` marker files before starting.

## Files to MODIFY

### 1. `server/src/services/loan-calculator.ts`
**Current state**: Hardcoded rate assumptions, basic amortization math
**Goal**: Wire to CDR real rates while preserving existing API contract

- [ ] Add imports:
  ```typescript
  import { CdrProductService } from './cdr-products.js';
  ```

- [ ] Add CDR product service as optional dependency (graceful fallback to hardcoded rates if CDR data unavailable):
  ```typescript
  private cdrProductService: CdrProductService | null;

  constructor(cdrProductService?: CdrProductService) {
    this.cdrProductService = cdrProductService ?? null;
  }
  ```

- [ ] Add method `async getMarketRates(category: string, purpose?: string): Promise<MarketRates>`:
  ```typescript
  interface MarketRates {
    lowestVariable: number;
    lowestFixed1yr: number;
    lowestFixed2yr: number;
    lowestFixed3yr: number;
    lowestFixed5yr: number;
    averageVariable: number;
    medianVariable: number;
    rbaRate: number | null;
    source: 'cdr' | 'hardcoded';
    asOfDate: string;
    sampleSize: number;
  }
  ```
  - Query `cdr_lending_rates` grouped by `lending_rate_type`
  - Calculate min, avg, median for each rate type
  - Fallback to hardcoded defaults if CDR data is empty or service unavailable

- [ ] Add method `async refinanceAnalysis(params: RefinanceParams): Promise<RefinanceResult>`:
  ```typescript
  interface RefinanceParams {
    currentLender: string;
    currentRate: number;
    currentBalance: number;
    remainingTermMonths: number;
    currentMonthlyRepayment: number;
    currentFeatures: string[];          // e.g. ['OFFSET_ACCOUNT', 'REDRAW']
    loanPurpose: 'OWNER_OCCUPIED' | 'INVESTMENT';
    repaymentType: 'PRINCIPAL_AND_INTEREST' | 'INTEREST_ONLY';
    switchingCosts?: {
      dischargeFee: number;             // default 350
      applicationFee: number;           // default 0 (many waive)
      valuationFee: number;             // default 300
      legalFee: number;                 // default 200
      breakCost: number;                // default 0 (variable only)
    };
  }

  interface RefinanceResult {
    currentLoan: {
      monthlyRepayment: number;
      totalRemaining: number;
      totalInterestRemaining: number;
    };
    switchingCosts: number;
    alternatives: Array<{
      productId: string;
      productName: string;
      lender: string;
      rate: number;
      comparisonRate: number | null;
      newMonthlyRepayment: number;
      monthlySaving: number;
      annualSaving: number;
      lifetimeSaving: number;
      breakEvenMonths: number;
      hasOffset: boolean;
      hasRedraw: boolean;
      matchesFeatures: boolean;
      cashbackOffer: string | null;
    }>;
    summary: {
      bestSavingProduct: string;
      maxAnnualSaving: number;
      maxLifetimeSaving: number;
      fastestBreakEven: number;
      recommendedAction: 'switch' | 'stay' | 'negotiate';
      reasoning: string;
    };
  }
  ```
  - Search CDR for products matching loan purpose and repayment type
  - Filter to only products with lower rates
  - Calculate amortization for each alternative over remaining term
  - Include switching costs in break-even calculation
  - Recommend 'stay' if break-even > 24 months or saving < $50/month

- [ ] Add method `async borrowingCapacity(params: BorrowingParams): Promise<BorrowingResult>`:
  ```typescript
  interface BorrowingParams {
    grossAnnualIncome: number;
    otherIncome: number;
    existingDebts: Array<{ type: string; balance: number; monthlyRepayment: number }>;
    livingExpenses: number;             // monthly
    dependents: number;
    loanPurpose: 'OWNER_OCCUPIED' | 'INVESTMENT';
    interestRate?: number;              // use CDR market rate if not provided
    loanTermYears?: number;             // default 30
  }

  interface BorrowingResult {
    maxBorrowingAmount: number;
    serviceabilityRate: number;         // rate used (CDR best + 3% buffer per APRA)
    monthlyRepaymentAtMax: number;
    netSurplus: number;
    dti: number;                        // debt-to-income ratio
    lti: number;                        // loan-to-income ratio
    assumptions: string[];
    disclaimer: string;
  }
  ```
  - Use CDR best variable rate + 3% serviceability buffer (APRA requirement)
  - HEM benchmark for living expenses if not provided
  - Apply 80% LVR assumption
  - Include disclaimer about estimates vs actual approval

- [ ] Add method `async rateScenario(params: ScenarioParams): Promise<ScenarioResult>`:
  ```typescript
  interface ScenarioParams {
    loanAmount: number;
    termYears: number;
    scenarios: Array<{
      label: string;
      rate: number;
    }>;
    // Auto-scenarios if none provided:
    // current CDR best, CDR average, +1%, +2%, +3% from current RBA
  }
  ```
  - Calculate monthly repayment and total interest for each scenario
  - Include CDR market context (where user's rate sits vs market)

- [ ] Update all existing methods to use `getMarketRates()` instead of hardcoded values where applicable

## Files to CREATE

None -- all modifications to existing file.

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `getMarketRates('RESIDENTIAL_MORTGAGES')` returns real CDR rates when data available
- [ ] `getMarketRates()` falls back to hardcoded rates when CDR data unavailable
- [ ] `refinanceAnalysis()` returns alternatives sorted by lifetime saving
- [ ] `borrowingCapacity()` uses CDR best rate + 3% APRA buffer
- [ ] Break-even calculation correctly accounts for switching costs
- [ ] All existing loan calculator tests still pass (backward compatible)
- [ ] Create marker file: `.agent-done-W18-05`

## Dependencies
- **Requires**: Agent 1 (`.agent-done-W18-01`), Agent 2 (`.agent-done-W18-02`), Agent 3 (`.agent-done-W18-03`)
- **Modifies**: `server/src/services/loan-calculator.ts` only -- no other agent modifies this file
