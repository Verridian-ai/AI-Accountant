# Agent W15-08: UI Forecasting Builder

## Role
Build 4 React components for the cash flow forecasting feature in `client/src/features/forecasting/`.

## Priority: WAVE 15 (After W15-07 completes API routes)

## Wait Condition
Check for `.agent-done-W15-07` marker file before starting.

## Context
- UI library: shadcn/ui at `client/src/components/ui/` (Card, Tabs, Button, Input, Select, Badge, Progress)
- Icons: lucide-react (TrendingUp, TrendingDown, BarChart3, Calendar, Target, AlertTriangle, ArrowUpRight, ArrowDownRight)
- Existing pattern: `client/src/features/analytics/components/AnalyticsDashboard.tsx` for chart + card layout
- API layer: `client/src/api.ts` -- will add forecastApi object
- Chart library: recharts (already installed -- used in AnalyticsDashboard)
- Design: Gold (#FFCC00) accent, neumorphic dark theme (`neu-raised`, `neu-inset` classes)

## Files to CREATE

### 1. `client/src/features/forecasting/components/ForecastDashboard.tsx`
**Purpose**: Main forecasting page with tabbed navigation

- [ ] Tabbed layout: "Cash Flow Forecast" | "Accuracy" | "Scenarios"
- [ ] Financial year selector (dropdown: 2023-24, 2024-25, 2025-26)
- [ ] Account filter (optional -- all accounts or specific)
- [ ] Forecast type selector: Linear | Seasonal | ML Weighted
- [ ] "Generate Forecast" button that calls `forecastApi.generate()`
- [ ] List existing forecasts as cards with status badges (draft/active/expired/archived)
- [ ] Render `ForecastChart` for selected forecast
- [ ] Render `AccuracyPanel` in Accuracy tab
- [ ] Render `ScenarioComparer` in Scenarios tab

### 2. `client/src/features/forecasting/components/ForecastChart.tsx`
**Purpose**: Interactive cash flow forecast visualization

- [ ] Recharts `AreaChart` with:
  - Predicted inflow line (green)
  - Predicted outflow line (red)
  - Predicted net line (gold #FFCC00)
  - Confidence band shaded area (gold with 20% opacity)
  - Actual data overlay points where available (solid dots)
- [ ] X-axis: period labels (monthly: "Jan 25", quarterly: "Q1 2025")
- [ ] Y-axis: dollar amounts with `$` prefix and comma formatting
- [ ] Tooltip showing: period, predicted inflow/outflow/net, actual (if available), variance
- [ ] Legend with toggle for each line
- [ ] Responsive container (fills parent width)
- [ ] Props: `{ periods: ForecastPeriod[]; granularity: string }`

### 3. `client/src/features/forecasting/components/AccuracyPanel.tsx`
**Purpose**: Forecast accuracy metrics and comparison

- [ ] 4 metric cards in grid: MAE, RMSE, MAPE, Direction Accuracy
  - Each card: neumorphic `neu-raised` style, large number, label, trend indicator
  - Color coding: green if good (MAPE <10%, direction >80%), yellow if fair, red if poor
- [ ] Historical accuracy chart: line chart showing MAPE over time per forecast type
- [ ] "Update Actuals" button that triggers backfill of real data
- [ ] Comparison table when multiple forecasts selected:
  - Columns: Forecast Name, Type, MAPE, RMSE, Direction %, Recommendation
  - Highlight best performer in gold
- [ ] Props: `{ forecastId: string }` -- fetches accuracy data on mount

### 4. `client/src/features/forecasting/components/ScenarioComparer.tsx`
**Purpose**: Side-by-side scenario comparison tool

- [ ] Left panel: scenario builder
  - Name input field
  - Adjustment sliders: Revenue (+/- 50%), Expenses (+/- 50%), specific category overrides
  - "Add Scenario" button (max 4 scenarios)
  - Predefined templates: "Optimistic (+15%)", "Pessimistic (-20%)", "Status Quo"
- [ ] Right panel: comparison visualization
  - Overlaid line chart (one line per scenario, different colors)
  - Summary cards per scenario: total inflow, total outflow, net position
  - Delta table: period-by-period differences between scenarios
- [ ] "Save as Forecast" button to persist selected scenario
- [ ] Props: `{ userId: string; baseForecasts?: string[] }`

## Files to MODIFY

### 5. `client/src/api.ts`
- [ ] Add `forecastApi` object with methods:
  ```typescript
  export const forecastApi = {
    generate: (data: ForecastGenerateRequest) => post('/api/forecasts/generate', data),
    list: (userId: string, status?: string) => get(`/api/forecasts/${userId}`, { status }),
    getById: (forecastId: string) => get(`/api/forecasts/detail/${forecastId}`),
    calculateAccuracy: (forecastId: string) => post(`/api/forecasts/${forecastId}/accuracy`),
    compare: (forecastIds: string[]) => post('/api/forecasts/compare', { forecastIds }),
    updateActuals: (forecastId: string) => post(`/api/forecasts/${forecastId}/update-actuals`),
    archive: (forecastId: string) => patch(`/api/forecasts/${forecastId}/archive`),
  };
  ```
- [ ] Add TypeScript interfaces for request/response types

### 6. `client/src/App.tsx`
- [ ] Add "Forecasting" navigation tab and route to ForecastDashboard
- [ ] Import ForecastDashboard from `./features/forecasting/components/ForecastDashboard`

## Component Pattern (follow AnalyticsDashboard.tsx):
```tsx
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { forecastApi } from '@/api';
import { ForecastChart } from './ForecastChart';

export function ForecastDashboard() {
    const [forecasts, setForecasts] = useState<Forecast[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedForecast, setSelectedForecast] = useState<string | null>(null);
    // ... fetch on mount, render tabs with components
}
```

## Verification
- [ ] `cd client && npx tsc --noEmit` passes clean
- [ ] All 4 components render without errors
- [ ] ForecastDashboard loads and displays forecast list
- [ ] ForecastChart renders area chart with confidence bands
- [ ] AccuracyPanel displays 4 metric cards with correct color coding
- [ ] ScenarioComparer allows adding up to 4 scenarios with sliders
- [ ] Navigation to /forecasting works from main nav
- [ ] Create marker file: `.agent-done-W15-08`

## Dependencies
- **Requires**: W15-07 (`.agent-done-W15-07`) -- API routes must exist for type-safe client
- **IMPORTANT**: Only W15-08 and W15-09 modify client/src/App.tsx in Wave 15 (coordinate)
