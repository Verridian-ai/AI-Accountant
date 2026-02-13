# Agent 9: Sparkline Integration

## Role
Add inline Sparkline charts to KPI tiles and summary cards across all existing dashboards. Sparklines provide at-a-glance trend indicators without taking up significant space.

## Priority: WAVE 22 (After Agents 1, 2, 3, 4)

## Wait Condition
Check for `.agent-done-W22-01`, `.agent-done-W22-02`, `.agent-done-W22-03`, `.agent-done-W22-04` marker files before starting.

## Files to MODIFY

### 1. `client/src/features/analytics/components/AnalyticsDashboard.tsx`
- [ ] Add `<Sparkline>` to each KPI summary card:
  - Total Income card: 6-month income trend (green)
  - Total Expenses card: 6-month expense trend (red)
  - Net Position card: 6-month net trend (gold)
  - Transaction Count card: 6-month count trend (gray)
- [ ] Sparkline positioned: right side of card, vertically centered
- [ ] Data: aggregate monthly values from transaction data already available in component

### 2. `client/src/features/bas/components/BASDashboard.tsx`
- [ ] Add `<Sparkline>` to BAS summary tiles:
  - GST Collected: 4-quarter trend
  - GST Paid: 4-quarter trend
  - Net GST: 4-quarter trend
  - BAS Refund/Liability: 4-quarter trend
- [ ] Color: gold for collected, gray for paid, green/red for net based on direction

### 3. `client/src/features/gst/components/GSTPage.tsx`
- [ ] Add `<Sparkline>` to GST category summary cards:
  - Each GST category (GST-Free, GST, Input-Taxed, BAS-Excluded) gets a sparkline showing monthly trend
- [ ] Sparkline shows 12-month trend of transaction count or total amount

### 4. `client/src/features/tax/components/TaxDashboard.tsx`
- [ ] Add `<Sparkline>` to tax summary cards:
  - Taxable Income: quarterly trend over 2-3 financial years
  - Tax Liability: quarterly trend
  - Effective Tax Rate: quarterly trend
  - Deductions Total: quarterly trend
- [ ] Use trend prop: `up` (green if income/deductions), `down` (red if increasing liability)

### 5. `client/src/features/accounts/components/AccountManager.tsx`
- [ ] Add `<Sparkline>` to each account card:
  - Balance trend: 30-day daily balance sparkline
  - Color: gold for positive trend, red for declining balance
- [ ] Position: below account name, above balance amount

### 6. `client/src/features/transactions/constants/categories.ts`
**No changes** -- reference only for category names when building sparkline data

### 7. `client/src/features/analytics/components/BudgetVsActual.tsx` (if created by Agent 3)
- [ ] Add `<Sparkline>` to budget summary KPIs:
  - Budget Adherence: 6-month trend
  - Total Variance: 6-month trend
  - Over-budget Categories Count: 6-month trend

### 8. Create shared helper: `client/src/features/analytics/hooks/useSparklineData.ts`
**Purpose**: Hook to compute sparkline data from transactions

- [ ] `useSparklineData(transactions, groupBy: 'month' | 'quarter' | 'week', valueField: 'amount' | 'count', periods?: number)` returns `number[]`
- [ ] Groups transactions by period, aggregates values
- [ ] Returns array of numbers suitable for Sparkline component
- [ ] Handles missing periods (fills with 0)

## Verification
- [ ] `cd client && npx tsc --noEmit` passes clean
- [ ] Sparklines appear in all 5 dashboard pages (Analytics, BAS, GST, Tax, Accounts)
- [ ] Sparklines show correct directional trend (up/down/flat)
- [ ] Sparklines render at correct compact size (100x30 default)
- [ ] No sparkline causes layout shift or overflow in parent card
- [ ] Performance: sparklines render within 100ms even with large datasets
- [ ] Create marker file: `.agent-done-W22-09`

## Dependencies
- **Requires**: Agent 1 (`.agent-done-W22-01`) for Sparkline component, Agents 2-4 for modified dashboard pages
- **Reuses**: Existing data already fetched by each dashboard (no new API calls)
