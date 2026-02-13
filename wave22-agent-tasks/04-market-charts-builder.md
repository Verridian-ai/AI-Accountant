# Agent 4: Market Charts Builder

## Role
Add Recharts visualizations to MarketDashboard.tsx and InventoryValuation.tsx for economic indicators and business asset tracking.

## Priority: WAVE 22 (After Agent 1)

## Wait Condition
Check for `.agent-done-W22-01` marker file before starting.

## Files to CREATE

### 1. `client/src/features/analytics/components/MarketDashboard.tsx`
**Purpose**: Economic indicators and market data dashboard
**Pattern**: Follow neumorphic dark theme with gold accents

- [ ] KPI tile row with `<Sparkline>` for each indicator:
  - RBA Cash Rate (current + 12-month sparkline)
  - CPI (current + 12-month sparkline)
  - AUD/USD (current + 30-day sparkline)
  - Unemployment Rate (current + 12-month sparkline)
- [ ] `<LineChart>` for RBA Cash Rate history:
  - 5-year view with monthly data points
  - Reference line at current rate (gold dashed)
  - Area fill below rate line
  - Annotate significant changes (rate hikes/cuts) with custom dots
- [ ] `<ComposedChart>` for CPI vs Cash Rate:
  - Line: CPI trend
  - Line: Cash rate trend
  - Dual y-axis (CPI % left, Cash Rate % right)
  - Highlight divergence periods
- [ ] `<BarChart>` for sector performance:
  - Horizontal bars: ASX sector returns (YTD)
  - Color: green for positive, red for negative
  - Gold highlight for user's business sector
- [ ] Data source: `GET /api/economic/rates`, `GET /api/economic/cpi`, `GET /api/economic/indicators`

### 2. `client/src/features/analytics/components/InventoryValuation.tsx`
**Purpose**: Business asset and inventory tracking with visual breakdown
**Pattern**: Follow neumorphic dark theme

- [ ] `<PieChart>` for asset allocation:
  - Segments: equipment, vehicles, property, inventory, intangibles
  - Donut style with total value in center
  - Click to drill into category details
- [ ] `<BarChart>` for depreciation schedule:
  - Grouped bars: original cost vs current book value per asset
  - Stacked: accumulated depreciation shown
  - Gold bar for current year depreciation expense
- [ ] `<LineChart>` for asset value over time:
  - Each major asset as separate line
  - Show depreciation curves (declining balance, straight line)
  - Project future values with dashed lines
- [ ] `<TreeMap>` for inventory breakdown:
  - Category hierarchy: type > subcategory > item
  - Cell size by value, color by days-since-last-counted
  - Green = recently counted, red = overdue for count
- [ ] Summary row: Total Assets, Total Depreciation, Net Book Value, Depreciation Expense YTD

## Files to MODIFY

### 3. `client/src/App.tsx`
- [ ] Add imports for `MarketDashboard` and `InventoryValuation`
- [ ] Wire into navigation (after analytics section)

### 4. `client/src/api.ts`
- [ ] Add API functions (if not already present):
  - `fetchEconomicRates()`
  - `fetchCPIData()`
  - `fetchEconomicIndicators()`
  - `fetchAssetValuation(userId)`
  - `fetchDepreciationSchedule(userId, year)`

## Verification
- [ ] `cd client && npx tsc --noEmit` passes clean
- [ ] MarketDashboard renders all 4 chart sections with data from API
- [ ] InventoryValuation renders all 4 chart sections
- [ ] Sparklines in KPI tiles animate on data load
- [ ] Dual-axis charts have clearly labeled axes
- [ ] All charts responsive at 375px, 768px, 1024px
- [ ] Create marker file: `.agent-done-W22-04`

## Dependencies
- **Requires**: Agent 1 (`.agent-done-W22-01`) for chart components
- **Reuses**: Existing economic data endpoints from Wave 1, api.ts patterns
