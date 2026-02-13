# Agent 3: Financial Charts Builder

## Role
Add Recharts visualizations to TaxDashboard.tsx and create new BudgetVsActual.tsx and ForecastDashboard.tsx components with rich chart displays.

## Priority: WAVE 22 (After Agent 1)

## Wait Condition
Check for `.agent-done-W22-01` marker file before starting.

## Files to MODIFY

### 1. `client/src/features/tax/components/TaxDashboard.tsx`
**Current state**: Text-based tax summary with tabbed entity views

- [ ] Add `<BarChart>` for tax bracket visualization:
  - Horizontal bars showing income distribution across ATO tax brackets
  - Color gradient: green (0%) to gold (32.5%) to red (45%)
  - Highlight current bracket with gold border
- [ ] Add `<PieChart>` for deduction breakdown:
  - Segments: WFH, motor vehicle, tools, uniforms, self-education, other
  - Donut style with total deductions in center
- [ ] Add `<ComposedChart>` for year-over-year tax comparison:
  - Bars: taxable income per financial year
  - Line: effective tax rate overlay
  - Secondary y-axis for percentage
- [ ] Add `<LineChart>` for tax liability projection:
  - Current FY trajectory based on YTD income
  - Projected vs actual comparison
  - Confidence band (area fill) for projection uncertainty
- [ ] Wrap each chart section in `<ChartContainer>` with descriptive titles

## Files to CREATE

### 2. `client/src/features/analytics/components/BudgetVsActual.tsx`
**Purpose**: Budget vs actual spending comparison dashboard
**Pattern**: Follow existing neumorphic component patterns

- [ ] `<ComposedChart>` as the main visualization:
  - Grouped bars: Budget (gold outline) vs Actual (solid fill)
  - Red fill for over-budget categories, green for under-budget
  - Line: cumulative variance
- [ ] `<BarChart>` for category-level variance:
  - Horizontal bars showing $ variance per category
  - Positive (green) = under budget, Negative (red) = over budget
  - Sorted by absolute variance descending
- [ ] Summary KPI row at top with `<Sparkline>` for each:
  - Total Budget, Total Actual, Total Variance, Budget Adherence %
- [ ] Period selector: monthly, quarterly, annual
- [ ] Data source: `GET /api/analytics/budget/generate` endpoint

### 3. `client/src/features/analytics/components/ForecastDashboard.tsx`
**Purpose**: Financial forecasting dashboard with AI-powered projections
**Pattern**: Follow existing neumorphic component patterns

- [ ] `<LineChart>` for revenue forecast:
  - Historical data (solid gold line)
  - Projected data (dashed gold line)
  - Confidence bands at 80% and 95% (gold area fill with decreasing opacity)
- [ ] `<LineChart>` for expense forecast:
  - Same pattern as revenue but with red/orange palette
  - Separate lines for recurring vs variable expenses
- [ ] `<ComposedChart>` for cash flow projection:
  - Area: projected cash balance over time
  - Reference lines: minimum cash threshold, target balance
  - Alert markers for projected cash shortfalls
- [ ] `<ScatterPlot>` for anomaly detection:
  - Plot transactions by amount vs expected
  - Outliers highlighted with red markers
  - Tooltip showing transaction details
- [ ] Data source: `POST /api/analytics/projections/revenue`, `POST /api/analytics/projections/expenses`

## Files to MODIFY

### 4. `client/src/App.tsx`
- [ ] Add imports for `BudgetVsActual` and `ForecastDashboard`
- [ ] Wire into navigation (tab or route as appropriate)

## Verification
- [ ] `cd client && npx tsc --noEmit` passes clean
- [ ] TaxDashboard renders 4 new chart sections with sample/real data
- [ ] BudgetVsActual renders budget comparison with variance highlighting
- [ ] ForecastDashboard renders projections with confidence bands
- [ ] All charts responsive at 375px, 768px, 1024px
- [ ] No raw numeric tables where charts should be -- data is visualized
- [ ] Create marker file: `.agent-done-W22-03`

## Dependencies
- **Requires**: Agent 1 (`.agent-done-W22-01`) for chart components
- **Reuses**: Existing tax data from TaxDashboard, API endpoints from Wave 1
