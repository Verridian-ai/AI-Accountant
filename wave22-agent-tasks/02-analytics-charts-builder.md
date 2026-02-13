# Agent 2: Analytics Charts Builder

## Role
Replace all CSS-based charts in AnalyticsDashboard.tsx, BASComparison.tsx, BASDashboard.tsx, and GSTPage.tsx with proper Recharts visualizations using the shared chart components.

## Priority: WAVE 22 (After Agent 1)

## Wait Condition
Check for `.agent-done-W22-01` marker file before starting.

## Files to MODIFY

### 1. `client/src/features/analytics/components/AnalyticsDashboard.tsx`
**Current state**: Uses CSS `width: ${percentage}%` bars for category breakdowns and spending trends
**Target**: Replace with Recharts components

- [ ] Replace CSS percentage bars in spending breakdown with `<BarChart>` from `components/charts/BarChart`:
  - Data: category totals grouped by period
  - Stacked bars for income vs expense categories
  - Horizontal bars for category ranking
- [ ] Replace CSS trend indicators with `<LineChart>` from `components/charts/LineChart`:
  - Data: monthly totals over time
  - Show area fill for income (green) and expenses (red)
  - Gold trend line for net position
- [ ] Replace CSS pie/donut with `<PieChart>` from `components/charts/PieChart`:
  - Data: category breakdown as donut chart
  - Inner radius = 60 for donut style
  - Center label showing total
- [ ] Wrap all charts in `<ChartContainer>` with appropriate titles
- [ ] Remove all inline `style={{ width: ... }}` CSS chart code

### 2. `client/src/features/bas/components/BASComparison.tsx`
**Current state**: CSS-based comparison bars for BAS period comparisons

- [ ] Replace comparison bars with `<ComposedChart>`:
  - Grouped bars for each BAS line item (1A, 1B, G1-G20)
  - Each period as a separate bar color
  - Line overlay showing variance percentage
- [ ] Replace variance indicators with `<BarChart>` showing positive/negative delta
- [ ] Add `<ChartContainer>` wrapper with "BAS Period Comparison" title

### 3. `client/src/features/bas/components/BASDashboard.tsx`
**Current state**: CSS bars for BAS summary, GST collected vs paid

- [ ] Replace GST collected/paid bars with `<BarChart>`:
  - Grouped: GST Collected (gold), GST Paid (gray), Net GST (green/red)
  - Per BAS reporting period on x-axis
- [ ] Replace BAS summary with `<ComposedChart>`:
  - Bars for revenue and expenses
  - Line for net GST position
- [ ] Add period-over-period trend `<LineChart>` showing GST liability over time

### 4. `client/src/features/gst/components/GSTPage.tsx`
**Current state**: CSS-based GST category breakdown

- [ ] Replace GST category breakdown with `<PieChart>`:
  - Segments: GST-Free, GST, Input-Taxed, BAS-Excluded
  - Colors: green (GST-Free), gold (GST), orange (Input-Taxed), gray (BAS-Excluded)
- [ ] Replace GST trend with `<LineChart>`:
  - Monthly GST amounts over time
  - Separate lines for GST collected and GST credits
- [ ] Add `<TreeMap>` for GST by category hierarchy:
  - Top level: GST category (Free, Standard, Input-Taxed)
  - Drill down: Spending category within each GST category

## Verification
- [ ] `cd client && npx tsc --noEmit` passes clean
- [ ] No remaining CSS-based chart patterns in modified files (no `width: ${...}%` for chart bars)
- [ ] All 4 pages render charts correctly with real or sample data
- [ ] Charts are responsive at sm (375px), md (768px), lg (1024px) breakpoints
- [ ] Tooltips show formatted currency values with $ prefix and 2 decimal places
- [ ] Chart colors match gold-themed palette from ChartColorPalette.ts
- [ ] Create marker file: `.agent-done-W22-02`

## Dependencies
- **Requires**: Agent 1 (`.agent-done-W22-01`) for chart components
- **Reuses**: Existing data fetching logic in each page (do not modify API calls)
