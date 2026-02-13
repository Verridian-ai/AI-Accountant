# Wave 22 — Advanced Visualizations & Chart Library — Orchestration Prompt

You are the **Team Lead** for Wave 22: Advanced Visualizations & Chart Library. You coordinate 10 specialized agents to integrate a proper charting library and build interactive financial dashboards, replacing the hand-built CSS charts with D3/Recharts-powered visualizations.

## Architecture References
- **Master plan**: `docs/wave0-master-plan.md`
- **Frontend research**: `wave0-research/R07-frontend-architecture.md`
- **Existing charts**: Hand-built CSS-only bar/pie charts in analytics

## Current State (After Wave 21)
- No charting library installed (identified as HIGH gap in R07)
- Hand-built CSS charts in AnalyticsDashboard.tsx, BASComparison.tsx
- ~20 feature folders with data-heavy components needing charts
- Streaming agent responses available
- 23 migrations (0009–0033) applied

## Dependencies
- **Requires**: Wave 13 (financial reports data), Wave 15 (forecast data)
- **Estimated Complexity**: MEDIUM

## Chart Library Decision
Based on R07 research, **Recharts** (React-native wrapper around D3) is recommended:
- React-native components (no ref manipulation)
- Responsive by default
- Lightweight (40KB gzip)
- Good TypeScript support
- Declarative API fits React patterns

### Alternative for 3D/complex: D3.js directly (already available via three.js in Wave 20)

### Dependencies to Install
```json
{
  "recharts": "^2.12.0",
  "@types/recharts": "^2.0.0"
}
```

## Database Schema Changes

### New Tables (2 tables)
| Table | Columns |
|-------|---------|
| `dashboard_layouts` | id, userId, dashboardName, layout (JSON: widget positions/sizes), isDefault, createdAt, updatedAt |
| `saved_charts` | id, userId, chartType, title, config (JSON: data source, filters, colors), isPinned, createdAt |

**Migration**: `docker/migrations/0034_advanced_visualizations.sql`

## API Endpoints (8 endpoints)
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/dashboards | List user dashboards |
| POST | /api/dashboards | Create dashboard layout |
| GET | /api/dashboards/:id | Get dashboard with widget configs |
| PATCH | /api/dashboards/:id | Update dashboard layout |
| GET | /api/charts/saved | List saved charts |
| POST | /api/charts/saved | Save chart configuration |
| DELETE | /api/charts/saved/:id | Delete saved chart |
| GET | /api/charts/data/:source | Get chart data by source |

## UI Components

### `client/src/components/charts/` — Shared chart component library
- BarChart.tsx — Configurable bar chart (vertical/horizontal/stacked/grouped)
- LineChart.tsx — Line/area chart with trend lines
- PieChart.tsx — Pie/donut chart with labels
- ScatterPlot.tsx — Scatter plot for correlations
- Sparkline.tsx — Inline miniature trend line
- ComposedChart.tsx — Mixed bar + line chart
- TreeMap.tsx — Hierarchical treemap for category breakdowns
- Sankey.tsx — Flow diagram for money flows
- ChartContainer.tsx — Responsive wrapper with loading/error states
- ChartColorPalette.ts — Gold-themed color palette matching neumorphic design

### Updates to Existing Components (replace CSS charts)
- AnalyticsDashboard.tsx — Replace CSS bars with Recharts BarChart + LineChart
- BASComparison.tsx — Replace comparison bars with grouped BarChart
- BASDashboard.tsx — Add trend LineChart
- GSTPage.tsx — Add PieChart for GST category breakdown
- TaxDashboard.tsx — Add stacked BarChart for tax components
- BudgetVsActual.tsx (Wave 13) — Add composed chart overlay
- ForecastDashboard.tsx (Wave 15) — Add area chart with confidence bands
- MarketDashboard.tsx (Wave 19) — Add price LineChart with volume bars
- InventoryValuation.tsx (Wave 11) — Add treemap for stock value

### `client/src/features/dashboards/` — New feature folder
- CustomDashboard.tsx — Drag-and-drop dashboard builder
- WidgetPicker.tsx — Add widget to dashboard
- WidgetConfigPanel.tsx — Configure widget data source and appearance
- DashboardGrid.tsx — Responsive grid layout (react-grid-layout)

**Navigation**: Add `dashboards` to TabId type

## New Claude Agents (0)
No new agents — this wave is purely frontend visualization.

## Cognee Integration
- No new datasets — charts visualize existing data
- Chart data sources map to existing API endpoints

## Testing Criteria
- [ ] Recharts renders without errors in all major browsers
- [ ] BarChart displays correct values from API data
- [ ] LineChart shows smooth trend lines with hover tooltips
- [ ] PieChart labels don't overlap for <8 segments
- [ ] Sparkline renders inline at 60fps
- [ ] CSS charts in analytics fully replaced (no hand-built bars remain)
- [ ] Dashboard drag-and-drop works for widget rearrangement
- [ ] Saved chart configurations persist across sessions
- [ ] Gold color palette matches neumorphic theme
- [ ] Charts are responsive at mobile/tablet/desktop breakpoints
- [ ] `cd client && npx tsc --noEmit` passes clean

## Debate Findings Applied (D01–D05)

| Finding | Source | Resolution |
|---------|--------|------------|
| Wave 22 has undeclared dependency on Wave 11 | D04 D02 | DECLARED: Wave 22 modifies `InventoryValuation.tsx` from Wave 11, `BudgetVsActual.tsx` from Wave 13, `ForecastDashboard.tsx` from Wave 15, `MarketDashboard.tsx` from Wave 19. Dependencies: Waves 11, 13, 15, 19 (in addition to declared 13+15). Create chart components defensively — check if target file exists, create standalone chart if not |
| Lazy load Recharts — don't include in main bundle | D03 §5.3 | MANDATORY: Use `React.lazy()` + `Suspense` for all chart-heavy pages. Main bundle must NOT include Recharts (~40KB gzip). Only load on first chart render |
| Server-side data aggregation for >1000 data points | D03 §5.4 | For time-series charts (market prices, forecasts), implement server-side bucketing (hourly/daily/weekly) based on time range. Client should never receive >1000 data points per chart |
| Dashboard widget cap | D03 §Wave22 | Limit to 12 widgets per custom dashboard to prevent render storm. Use `React.memo` on all chart components |
| Dashboard layout JSON must be validated (XSS) | D02 §Wave22 | Saved chart configs and dashboard layouts must be sanitized — no user-controlled HTML rendering via Recharts |

## Team Structure — 10 Agents

### Agent 1: chart-library-setup [PRIORITY: WAVE 1]
**Task file**: `wave22-agent-tasks/01-chart-library-setup.md`
**Role**: Install Recharts, create shared chart components + color palette

### Agent 2: analytics-charts-builder [DEPENDS ON: Agent 1]
**Task file**: `wave22-agent-tasks/02-analytics-charts-builder.md`
**Role**: Replace CSS charts in AnalyticsDashboard, BAS, GST pages

### Agent 3: financial-charts-builder [DEPENDS ON: Agent 1]
**Task file**: `wave22-agent-tasks/03-financial-charts-builder.md`
**Role**: Add charts to Tax, Budget, Forecast pages

### Agent 4: market-charts-builder [DEPENDS ON: Agent 1]
**Task file**: `wave22-agent-tasks/04-market-charts-builder.md`
**Role**: Add charts to Market, Inventory pages

### Agent 5: sankey-flow-builder [DEPENDS ON: Agent 1]
**Task file**: `wave22-agent-tasks/05-sankey-flow-builder.md`
**Role**: Build money flow Sankey diagram

### Agent 6: dashboard-schema-builder [PRIORITY: WAVE 1]
**Task file**: `wave22-agent-tasks/06-dashboard-schema-builder.md`
**Role**: Create dashboard layout tables + migration

### Agent 7: api-endpoints-builder [DEPENDS ON: Agent 6]
**Task file**: `wave22-agent-tasks/07-api-endpoints-builder.md`

### Agent 8: dashboard-builder [DEPENDS ON: Agents 1, 7]
**Task file**: `wave22-agent-tasks/08-dashboard-builder.md`
**Creates**: Custom dashboard with drag-and-drop widgets

### Agent 9: sparkline-integration [DEPENDS ON: Agent 1]
**Task file**: `wave22-agent-tasks/09-sparkline-integration.md`
**Role**: Add inline sparklines to KPI tiles across all dashboards

### Agent 10: testing-validation-agent [DEPENDS ON: All]
**Task file**: `wave22-agent-tasks/10-testing-validation-agent.md`

## Execution Priority Order

```
Sub-wave 1 (Parallel): Agent 1 + Agent 6
Sub-wave 2 (After 1):  Agent 2 + Agent 3 + Agent 4 + Agent 5 + Agent 9
Sub-wave 3 (After 1+6): Agent 7
Sub-wave 4 (After 2+7): Agent 8
Sub-wave 5 (After all): Agent 10
```

## START THE TEAM NOW

Spawn all 10 teammates. Read each agent's task file from `wave22-agent-tasks/`.
