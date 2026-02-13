# Agent 9: UI Loans Upgrader

## Role
Update the existing loan UI components in client/src/features/loans/ to use live CDR data, replacing hardcoded rate assumptions with real market rates and adding refinancing and borrowing capacity features.

## Priority: WAVE 18 (After Agent 8)

## Wait Condition
Check for `.agent-done-W18-08` marker file before starting.

## Files to MODIFY

### 1. `client/src/features/loans/components/LoanDashboard.tsx` (or main loan component)
**Current state**: Basic loan calculator with hardcoded rates
**Goal**: Wire to CDR market rates and add new capabilities

- [ ] Add "Market Rates" banner at top of loan dashboard:
  - Show current lowest variable rate, lowest 2yr fixed, RBA cash rate
  - Source attribution: "Rates from CDR Open Banking API"
  - Last updated timestamp
  - Fetch from `GET /api/cdr/rates/market?category=RESIDENTIAL_MORTGAGES`

- [ ] Replace hardcoded rate inputs with CDR-populated defaults:
  - Pre-fill interest rate field with current market average
  - Show "Market Range: X% - Y%" hint below rate input
  - Add "Use best available rate" quick-fill button

- [ ] Add tabbed sub-sections:
  - **Calculator** (existing, enhanced with CDR rates)
  - **Refinance** (new)
  - **Borrowing Capacity** (new)
  - **Rate Scenarios** (new)

### 2. Create `client/src/features/loans/components/RefinanceAnalysis.tsx`
**Purpose**: Interactive refinancing cost-benefit analysis

- [ ] Input form with neumorphic inset styling:
  - Current lender name (text input)
  - Current interest rate (number input with % suffix)
  - Current loan balance (currency input)
  - Remaining term (years + months dropdowns)
  - Current monthly repayment (currency input)
  - Loan purpose toggle: Owner Occupied | Investment
  - Repayment type: P&I | Interest Only
  - Current features checkboxes: Offset | Redraw | Extra Repayments
  - Switching costs section (collapsible, pre-filled defaults):
    - Discharge fee: $350
    - Application fee: $0
    - Valuation fee: $300
    - Legal fee: $200
    - Break cost: $0 (with note: "Applies to fixed rate loans")

- [ ] Results section:
  - Summary card: "You could save up to $X/year by switching"
  - Alternatives table:
    - Columns: Lender, Product, Rate, Comparison Rate, Monthly Payment, Monthly Saving, Annual Saving, Lifetime Saving, Break-Even, Features Match
    - Sort by: Lifetime Saving (default), Monthly Saving, Rate
    - Green highlight for best option
    - Feature match indicator (checkmark if new product has all current features)
  - Recommendation badge:
    - Green "Switch" if savings > $50/month and break-even < 12 months
    - Yellow "Negotiate" if savings $20-50/month
    - Grey "Stay" if savings < $20/month
  - Detailed breakdown (expandable per alternative):
    - Current vs new amortization comparison
    - Cumulative interest saved chart (line chart, current vs new over remaining term)
    - Net benefit timeline showing when switching costs are recouped

- [ ] API: `POST /api/cdr/loans/refinance`

### 3. Create `client/src/features/loans/components/BorrowingCapacity.tsx`
**Purpose**: Estimate maximum borrowing amount using CDR market rates

- [ ] Input form:
  - Gross annual income (currency)
  - Other income (currency, optional)
  - Existing debts (dynamic list: type dropdown, balance, monthly repayment)
  - Monthly living expenses (currency, with "Use HEM benchmark" button)
  - Number of dependents (0-6)
  - Loan purpose: Owner Occupied | Investment
  - Preferred loan term: 25 | 30 years

- [ ] Results panel:
  - Maximum borrowing amount (large gold text)
  - Serviceability rate used (CDR best + 3% APRA buffer)
  - Monthly repayment at maximum
  - Net monthly surplus
  - DTI ratio with traffic light indicator (green <6, yellow 6-8, red >8)
  - LTI ratio
  - Assumptions list
  - APRA disclaimer: "Serviceability assessed at {rate}% (current rate + 3% buffer per APRA guidelines)"

- [ ] Sensitivity analysis:
  - Slider: "What if rates increase by X%?" (0-3% in 0.25% steps)
  - Show how max borrowing changes with rate increases
  - Bar chart: borrowing capacity at different rate levels

- [ ] API: `POST /api/cdr/loans/borrowing-capacity`

### 4. Create `client/src/features/loans/components/RateScenarios.tsx`
**Purpose**: Model different rate scenarios against CDR market data

- [ ] Input:
  - Loan amount
  - Loan term
  - Current rate (pre-filled from CDR market average)

- [ ] Auto-generated scenarios:
  - CDR Best Rate
  - CDR Average Rate
  - Current rate + 1%
  - Current rate + 2%
  - Current rate + 3% (stress test)

- [ ] Custom scenario builder: add/remove scenarios with label + rate

- [ ] Results table:
  - Columns: Scenario, Rate, Monthly Repayment, Total Interest, Total Repayments, Difference from Current
  - Color code: green (saves money), red (costs more)

- [ ] Chart: grouped bar chart showing monthly repayment per scenario

- [ ] API: `POST /api/cdr/loans/rate-scenarios`

### 5. `client/src/features/loans/index.ts` (barrel export)
- [ ] Add exports for new components: `RefinanceAnalysis`, `BorrowingCapacity`, `RateScenarios`

## Verification
- [ ] `cd client && npx tsc --noEmit` passes clean
- [ ] Loan dashboard shows CDR market rates banner with live data
- [ ] Rate input pre-fills with CDR market average
- [ ] Refinance analysis returns alternatives with savings calculations
- [ ] Borrowing capacity uses APRA 3% buffer correctly
- [ ] Rate scenarios auto-generate 5 scenarios from CDR data
- [ ] All new components match neumorphic dark theme with gold accents
- [ ] Existing loan calculator functionality preserved (no regressions)
- [ ] Create marker file: `.agent-done-W18-09`

## Dependencies
- **Requires**: Agent 8 (`.agent-done-W18-08`) for API client functions in api.ts
- **Reuses**: Existing loan feature structure, Tailwind neumorphic classes, api.ts CDR functions
