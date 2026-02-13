# Agent 5: Loan Comparison Builder

## Role
Build loan calculator service and economic data feed service. Pure math + HTTP — no agent dependencies.

## Priority: WAVE 1 (Start Immediately)

## Files to CREATE

### 1. `server/src/services/loan-calculator.ts`
**Purpose**: 6 loan types + refinance savings + borrowing capacity
**Reference**: `docs/Curretn Claudecode plan.md` lines 386-448

Tasks:
- [ ] Create `LoanCalculatorService` class with methods:

**Home Loan Calculator**:
```typescript
calculateHomeLoan(params: {
  principal: number;      // cents
  annualRate: number;     // e.g. 0.0625 for 6.25%
  termMonths: number;     // e.g. 360 for 30 years
  frequency: 'weekly' | 'fortnightly' | 'monthly';
  offsetBalance?: number; // cents
  extraRepayment?: number; // cents per period
}): HomeLoanResult
```
- Regular payment = PMT formula: `P * r * (1+r)^n / ((1+r)^n - 1)`
- Offset impact: reduce principal by offset balance for interest calc each period
- Extra repayment: add to principal reduction each period
- Generate amortization schedule (month-by-month: payment, interest, principal, balance)
- Calculate total interest, time saved, interest saved vs base scenario

**Car Finance Calculator** (3-way comparison):
```typescript
calculateCarFinance(params: {
  vehiclePrice: number;   // cents
  deposit: number;        // cents
  termMonths: number;
  personalLoanRate: number;
  chattelMortgageRate: number;
  novatedLeaseRate: number;
  marginalTaxRate: number; // e.g. 0.325
  gstRegistered: boolean;
  annualSalary: number;   // cents (for novated lease calc)
}): CarFinanceComparison
```
- Personal loan: simple amortization, no tax benefit
- Chattel mortgage: GST claim on purchase if registered, interest deductible if business use
- Novated lease: pre-tax salary sacrifice, FBT calculation, residual value (ATO schedule)
- After-tax total cost comparison for all 3

**Personal Loan Calculator**:
- Simple amortization with comparison rate (include fees in effective rate)
- Early repayment scenario

**Business Loan Calculator**:
- Interest deductibility at marginal rate
- Equipment finance with depreciation benefit

**Refinance Savings Calculator**:
```typescript
calculateRefinanceSavings(params: {
  currentBalance: number;
  currentRate: number;
  currentRemainingMonths: number;
  newRate: number;
  newTermMonths: number;
  switchingCosts: number; // discharge fee, application fee, valuation
}): RefinanceResult
```
- Break-even period = switchingCosts / monthlySaving
- Total savings over remaining term

**Borrowing Capacity Calculator**:
```typescript
calculateBorrowingCapacity(params: {
  grossAnnualIncome: number;
  otherIncome: number;
  existingDebts: number;  // monthly repayments
  livingExpenses: number; // monthly
  dependants: number;
  interestRate: number;
  bufferRate?: number;    // APRA buffer, default 3%
}): BorrowingCapacityResult
```
- Apply APRA 3% serviceability buffer (rate + 0.03)
- HEM (Household Expenditure Measure) floor
- DSR (Debt Service Ratio) max 6x income

### 2. `server/src/services/economic-data.ts`
**Purpose**: RBA/ABS public data feeds with caching
**Reference**: `docs/Curretn Claudecode plan.md` lines 450-473

Tasks:
- [ ] Create `EconomicDataService` class
- [ ] Method `fetchRBACashRate()`: Scrape/fetch from RBA RSS/CSV (https://www.rba.gov.au/statistics/cash-rate/)
- [ ] Method `fetchLendingRates()`: Average home loan rates from RBA statistical tables
- [ ] Method `fetchCPI()`: ABS CPI data (https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation)
- [ ] Method `fetchUnemploymentRate()`: ABS labour force data
- [ ] Cache all results in `economic_data_cache` table (created by Agent 2)
- [ ] Cache TTL: RBA data = 24 hours, ABS data = 7 days
- [ ] Fallback: return cached data if fetch fails
- [ ] All fetches use `fetch()` with timeout and error handling

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] LoanCalculatorService.calculateHomeLoan() returns correct PMT for known inputs
  - Test: $500,000 at 6.25% for 30 years monthly = $3,078.59/month
- [ ] EconomicDataService compiles (actual data fetch tested by Agent 9)
- [ ] Create marker file: `.agent-done-05`

## Dependencies
- **None** — pure math + HTTP, can start immediately
- **Note**: Uses `economic_data_cache` table but doesn't need it to compile (just needs schema import)
