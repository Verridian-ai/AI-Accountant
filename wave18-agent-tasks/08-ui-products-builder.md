# Agent 8: UI Products Builder

## Role
Build 8 React components for the Banking Products feature, providing a full CDR Open Banking product exploration, comparison, and rate tracking interface.

## Priority: WAVE 18 (After Agent 7)

## Wait Condition
Check for `.agent-done-W18-07` marker file before starting.

## Files to CREATE

### 1. `client/src/features/banking-products/index.ts`
**Purpose**: Feature barrel export
```typescript
export { ProductExplorer } from './components/ProductExplorer';
export { ProductComparison } from './components/ProductComparison';
export { LoanComparison } from './components/LoanComparison';
export { RateTracker } from './components/RateTracker';
export { BestRates } from './components/BestRates';
export { DataHolderDirectory } from './components/DataHolderDirectory';
export { RateAlertManager } from './components/RateAlertManager';
export { SavingsCalculator } from './components/SavingsCalculator';
```

### 2. `client/src/features/banking-products/components/ProductExplorer.tsx`
**Purpose**: Main product search and filter UI
**Pattern**: Follow `client/src/features/analytics/components/AnalyticsDashboard.tsx` layout style

- [ ] Full-width neumorphic container with gold (#FFCC00) accent
- [ ] Filter bar at top:
  - Product category dropdown: Home Loans, Savings, Term Deposits, Credit Cards, Personal Loans, Business Loans
  - Rate type toggle: Variable | Fixed | All
  - Feature checkboxes: Offset, Redraw, Extra Repayments, Free Transactions
  - Loan purpose toggle: Owner Occupied | Investment (only for home loans)
  - Text search input
  - Sort dropdown: Rate (low-high), Comparison Rate, Provider Name
- [ ] Product grid below filters:
  - Each product card (`neu-raised` class): provider logo, product name, best rate (large gold text), comparison rate, feature badges, "Compare" checkbox, "Details" button
  - Pagination controls (20 per page)
- [ ] Sticky comparison bar at bottom when 2+ products selected:
  - Shows selected product names, "Compare X Products" button
  - Max 5 products
- [ ] API calls: `GET /api/cdr/products?category=...&rateType=...` via `api.ts`
- [ ] Empty state: "No CDR data yet. Run a crawl to populate products." with crawl trigger button

### 3. `client/src/features/banking-products/components/ProductComparison.tsx`
**Purpose**: Side-by-side product comparison table
**Pattern**: Full-width comparison matrix

- [ ] Accept `productIds: string[]` prop (2-5 products)
- [ ] Fetch comparison via `POST /api/cdr/products/compare`
- [ ] Display comparison matrix:
  - Header row: product name + provider logo for each
  - **Rates section**: Variable rate, Fixed rates (1yr, 2yr, 3yr, 5yr), Comparison rate -- highlight lowest in gold
  - **Fees section**: Annual fee, Application fee, Monthly fee, Discharge fee -- highlight lowest in green
  - **Features section**: Offset (check/cross), Redraw, Extra repayments, Package discount
  - **Eligibility section**: Min income, Employment type, Residency
- [ ] Highlight winner per row with gold background
- [ ] "Calculate with my numbers" button that opens LoanComparison with selected products
- [ ] Print/export comparison as PDF button

### 4. `client/src/features/banking-products/components/LoanComparison.tsx`
**Purpose**: Loan scenario calculator using real CDR rates
**Pattern**: Interactive calculator with real-time updates

- [ ] Input form (neumorphic inset fields):
  - Loan amount (slider + input, $100k-$2M)
  - Loan term (slider, 5-30 years)
  - Interest rate (auto-populated from CDR or manual)
  - Repayment type toggle: P&I | Interest Only
  - Interest-only period (if IO selected, 1-5 years)
  - Extra monthly repayment (optional)
  - Offset account balance (optional)
- [ ] Results panel:
  - Monthly repayment (large gold text)
  - Total interest over life
  - Total repayments
  - Loan payoff date
  - Interest saved from extra repayments
  - Interest saved from offset
- [ ] Amortization chart (line chart): principal vs interest over time
- [ ] Comparison table if multiple products selected: show side-by-side for same loan params
- [ ] API: `POST /api/cdr/loans/rate-scenarios`

### 5. `client/src/features/banking-products/components/RateTracker.tsx`
**Purpose**: Visual rate trend and market overview dashboard
**Pattern**: Charts + summary cards

- [ ] Market summary cards at top (4 cards, `neu-raised`):
  - Lowest Variable Rate (category-specific)
  - Lowest 2yr Fixed Rate
  - Average Variable Rate
  - Number of products tracked
- [ ] Rate distribution histogram: X-axis = rate %, Y-axis = number of products
- [ ] Provider comparison bar chart: top 10 providers by lowest rate
- [ ] Rate tier breakdown: show how rates vary by LVR tier (60%, 70%, 80%, 90%)
- [ ] Auto-refresh: poll `/api/cdr/rates/market` every 5 minutes
- [ ] Category tabs: Home Loans | Savings | Term Deposits

### 6. `client/src/features/banking-products/components/BestRates.tsx`
**Purpose**: Leaderboard of best rates by category
**Pattern**: Ranked table with provider branding

- [ ] Category selector at top
- [ ] Two columns: Best Lending Rates | Best Deposit Rates
- [ ] Each entry: rank badge, provider logo, product name, rate (large), comparison rate, key features as small badges
- [ ] Top 3 highlighted with gold/silver/bronze styling
- [ ] Click row to expand with full product details
- [ ] "Set Alert" button per product to create rate alert
- [ ] API: `GET /api/cdr/rates/best?category=...&type=lending`

### 7. `client/src/features/banking-products/components/DataHolderDirectory.tsx`
**Purpose**: Browse CDR data holders (banks) and their crawl status

- [ ] Grid of data holder cards:
  - Logo, brand name, ABN
  - Product count badge
  - Last crawled timestamp
  - Status indicator (green=active, grey=inactive)
  - "Crawl Now" button per data holder
- [ ] Summary stats at top: total data holders, total products, last full crawl time
- [ ] "Full Crawl" button (triggers POST /api/cdr/crawl/full) with progress indicator
- [ ] Crawl log table: recent crawl history from `/api/cdr/crawl/logs`
- [ ] API: `GET /api/cdr/data-holders`

### 8. `client/src/features/banking-products/components/RateAlertManager.tsx`
**Purpose**: Manage rate change alerts

- [ ] Create alert form:
  - Alert type: "Rate drops below" | "Rate changes" | "Better rate found"
  - Product category selector
  - Rate threshold input
  - Optional: compare against specific product
- [ ] Active alerts list with toggle on/off and delete
- [ ] Alert history: when each alert was last triggered
- [ ] API: `GET /api/cdr/alerts`, `POST /api/cdr/alerts`, `DELETE /api/cdr/alerts/:id`

### 9. `client/src/features/banking-products/components/SavingsCalculator.tsx`
**Purpose**: Calculate how much user could save by switching products

- [ ] Input: current rate, balance, monthly repayment, remaining term, product category
- [ ] Results: table of alternatives with monthly saving, annual saving, lifetime saving, break-even months
- [ ] Visual: bar chart of lifetime savings per alternative
- [ ] Highlight best option with gold border
- [ ] API: `POST /api/cdr/savings/calculate`

## Files to MODIFY

### 10. `client/src/App.tsx`
- [ ] Import `banking-products` feature components
- [ ] Add "Products" tab/route to main navigation
- [ ] Render `ProductExplorer` as main view with sub-navigation for Comparison, Rates, Alerts

### 11. `client/src/components/layout/BottomNavigation.tsx`
- [ ] Add "Products" navigation item with bank icon between existing nav items

### 12. `client/src/api.ts`
- [ ] Add CDR API functions:
  ```typescript
  export const fetchCdrProducts = (filters: any) => fetchJson(`/api/cdr/products?${new URLSearchParams(filters)}`);
  export const compareCdrProducts = (productIds: string[]) => fetchJson('/api/cdr/products/compare', { method: 'POST', body: JSON.stringify({ productIds }) });
  export const fetchBestRates = (category: string, type: string) => fetchJson(`/api/cdr/rates/best?category=${category}&type=${type}`);
  export const calculateSavings = (params: any) => fetchJson('/api/cdr/savings/calculate', { method: 'POST', body: JSON.stringify(params) });
  export const fetchMarketRates = (category: string) => fetchJson(`/api/cdr/rates/market?category=${category}`);
  export const triggerCdrCrawl = () => fetchJson('/api/cdr/crawl/full', { method: 'POST' });
  export const fetchDataHolders = () => fetchJson('/api/cdr/data-holders');
  export const fetchCdrAlerts = () => fetchJson('/api/cdr/alerts');
  export const createCdrAlert = (alert: any) => fetchJson('/api/cdr/alerts', { method: 'POST', body: JSON.stringify(alert) });
  export const deleteCdrAlert = (id: string) => fetchJson(`/api/cdr/alerts/${id}`, { method: 'DELETE' });
  ```

## Verification
- [ ] `cd client && npx tsc --noEmit` passes clean
- [ ] ProductExplorer renders with filter bar and product grid
- [ ] ProductComparison shows side-by-side matrix for 2-5 products
- [ ] LoanComparison calculates repayments with real-time slider updates
- [ ] RateTracker displays market summary cards and charts
- [ ] BestRates shows ranked leaderboard with gold/silver/bronze
- [ ] DataHolderDirectory lists banks with crawl status
- [ ] RateAlertManager creates and displays alerts
- [ ] SavingsCalculator shows savings table and chart
- [ ] All components use neumorphic dark theme with gold accents
- [ ] Create marker file: `.agent-done-W18-08`

## Dependencies
- **Requires**: Agent 7 (`.agent-done-W18-07`) for API endpoints
- **Reuses**: Tailwind neumorphic classes, api.ts fetch patterns, App.tsx routing pattern
