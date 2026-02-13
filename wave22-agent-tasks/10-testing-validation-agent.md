# Agent 10: Testing & Validation Agent

## Role
Run the full verification plan for Wave 22 (Advanced Visualizations). Validate that all CSS charts are replaced, Recharts render correctly, dashboards work, and everything is responsive.

## Priority: WAVE 22 FINAL (After ALL Wave 22 agents complete)

## Wait Condition
Check for ALL marker files: `.agent-done-W22-01` through `.agent-done-W22-09` before starting.

## Verification Tasks

### 1. Compilation
- [ ] Run `cd server && npx tsc --noEmit` (zero errors)
- [ ] Run `cd client && npx tsc --noEmit` (zero errors)
- [ ] Run `docker compose config` (validates)

### 2. Schema & Migration
- [ ] Run migration 0034 against PostgreSQL:
  ```bash
  docker compose exec postgres psql -U app_user -d ai_accountant -f /docker-entrypoint-initdb.d/0034_custom_dashboards.sql
  ```
- [ ] Verify 2 new tables exist: `\dt dashboard_layouts`, `\dt saved_charts`
- [ ] Verify FK from `saved_charts.dashboard_id` to `dashboard_layouts.id`

### 3. Chart Components (10 components)
- [ ] Verify all 9 chart components + ChartContainer render without errors:
  - BarChart with sample data
  - LineChart with sample data
  - PieChart with sample data
  - ScatterPlot with sample data
  - Sparkline with sample data
  - ComposedChart with sample data
  - TreeMap with sample data
  - Sankey with sample data
  - ChartContainer with loading/error states
- [ ] Verify ChartColorPalette exports are consistent with gold theme

### 4. CSS Chart Removal Audit
- [ ] Search all modified files for remaining CSS chart patterns:
  ```bash
  grep -rn "width:.*%.*height:" client/src/features/analytics/
  grep -rn "style={{.*width:.*percentage" client/src/features/
  ```
- [ ] Confirm ZERO CSS-based chart bars remain in: AnalyticsDashboard, BASComparison, BASDashboard, GSTPage
- [ ] All data visualization now uses Recharts components

### 5. Dashboard Pages
- [ ] AnalyticsDashboard: BarChart, LineChart, PieChart render with data
- [ ] BASComparison: ComposedChart with period comparison
- [ ] BASDashboard: BarChart for GST, ComposedChart for summary
- [ ] GSTPage: PieChart for categories, LineChart for trends, TreeMap for hierarchy
- [ ] TaxDashboard: BarChart for brackets, PieChart for deductions, ComposedChart for comparison
- [ ] BudgetVsActual: ComposedChart for budget/actual, BarChart for variance
- [ ] ForecastDashboard: LineChart with confidence bands, ScatterPlot for anomalies
- [ ] MarketDashboard: LineChart for rates, ComposedChart for CPI vs rate
- [ ] MoneyFlowSankey: Sankey diagram with interactive highlighting

### 6. Custom Dashboards
- [ ] Create a dashboard via `POST /api/dashboards`
- [ ] Add 3 widgets via WidgetPicker
- [ ] Drag and resize widgets in edit mode
- [ ] Save layout and verify persistence on reload
- [ ] Delete a widget, verify removal

### 7. Sparkline Integration
- [ ] Verify sparklines appear on: AnalyticsDashboard, BASDashboard, GSTPage, TaxDashboard, AccountManager
- [ ] Sparklines show correct trend direction
- [ ] No layout overflow from sparkline insertion

### 8. Responsiveness
- [ ] Test all chart pages at 375px (iPhone SE):
  - Charts scale down, no horizontal overflow
  - Touch targets >= 44px
  - Tooltips don't clip off screen
- [ ] Test at 768px (iPad):
  - Charts use medium breakpoint layout
  - Dashboard grid reconfigures to fewer columns
- [ ] Test at 1024px (desktop):
  - Full layout with all features visible
  - Side panels and detail views render

### 9. Performance
- [ ] Charts render within 500ms for datasets < 1000 points
- [ ] No jank during dashboard drag-and-drop operations
- [ ] Sparklines render within 100ms

### 10. Generate Verification Report
```
GOLDLEDGER WAVE 22 VERIFICATION REPORT
=======================================
Date: [timestamp]
Schema:          [PASS/FAIL] - 2 tables, indexes, FK references
Chart Library:   [PASS/FAIL] - 9 components + container + palette
CSS Removal:     [PASS/FAIL] - Zero CSS chart patterns remaining
Analytics:       [PASS/FAIL] - 4 pages converted to Recharts
Financial:       [PASS/FAIL] - Tax, Budget, Forecast charts
Market:          [PASS/FAIL] - Economic + Inventory charts
Sankey:          [PASS/FAIL] - Money flow diagram interactive
Dashboards:      [PASS/FAIL] - CRUD, drag-drop, widget config
Sparklines:      [PASS/FAIL] - Integrated across 5+ dashboards
API Endpoints:   [PASS/FAIL] - 8 routes accessible
Responsive:      [PASS/FAIL] - 375px, 768px, 1024px verified
Performance:     [PASS/FAIL] - Render times within budget
Build:           [PASS/FAIL] - Server + Client clean
```

- [ ] Create marker file: `.agent-done-W22-10`

## Dependencies
- **Requires**: ALL Wave 22 agents (`.agent-done-W22-01` through `.agent-done-W22-09`)
- **Docker must be running**: `docker compose up -d`
