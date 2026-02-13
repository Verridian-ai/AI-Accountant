# Agent W17-08: UI Intelligence Builder

## Role
Build 7 React components for the cross-module intelligence feature in `client/src/features/intelligence/`.

## Priority: WAVE 17 (After W17-07 completes API routes)

## Wait Condition
Check for `.agent-done-W17-07` marker file before starting.

## Context
- UI library: shadcn/ui at `client/src/components/ui/`
- Icons: lucide-react (Brain, Lightbulb, Clock, Link, Bell, GitBranch, Activity, Search, Filter, ChevronRight, Zap, TrendingUp, AlertCircle, Calendar)
- Design: Gold (#FFCC00) accent, neumorphic dark theme (`neu-raised`, `neu-inset` classes)
- Chart library: recharts (already installed)
- Existing pattern: `client/src/features/analytics/components/AnalyticsDashboard.tsx`

## Files to CREATE

### 1. `client/src/features/intelligence/components/IntelligenceDashboard.tsx`
**Purpose**: Main intelligence hub with tabbed navigation

- [ ] Tabbed layout: "Insights" | "Timeline" | "Temporal Queries" | "Module Map" | "Subscriptions"
- [ ] Top banner: Insight summary -- new insights count (badge), critical alerts, active subscriptions
- [ ] Quick action buttons: "Scan for Insights", "New Temporal Query", "Subscribe"
- [ ] Date range picker for filtering all views
- [ ] Render sub-components in each tab

### 2. `client/src/features/intelligence/components/InsightFeed.tsx`
**Purpose**: Scrollable feed of cross-module intelligence insights

- [ ] Insight cards in feed layout (newest first):
  - Severity indicator: left border + icon (Lightbulb=info, Zap=suggestion, AlertCircle=warning, Brain=critical)
  - Title, description (expandable for long text)
  - Source modules as colored badges (each module has distinct color)
  - Confidence bar (0-100% with color gradient)
  - Time range display
  - Recommended action section (if present)
  - Status badge: new (gold pulse), viewed (gray), acted_on (green), dismissed (strikethrough)
  - Action buttons: Mark Viewed, Act On (opens action dialog), Dismiss
- [ ] Filters sidebar:
  - Insight type dropdown multi-select
  - Severity checkboxes
  - Status checkboxes
  - Module filter checkboxes
  - Confidence range slider
  - Date range picker
- [ ] Stats bar: total insights, by severity breakdown, new vs resolved
- [ ] Infinite scroll or pagination (load 20 at a time)
- [ ] Props: `{ userId: string; dateRange?: { start: string; end: string } }`

### 3. `client/src/features/intelligence/components/IntelligenceTimeline.tsx`
**Purpose**: Chronological timeline visualization of cross-module events

- [ ] Vertical timeline layout:
  - Date headers as timeline markers
  - Event cards on alternating left/right sides
  - Each card: module icon + color, event title, description, time, amount (if applicable)
  - Color-coded by module (transactions=green, forecasting=blue, compliance=red, tax=orange, etc.)
  - Severity indicators (warning triangle for warnings, red circle for critical)
- [ ] Time controls:
  - Date range picker
  - Granularity toggle: Day | Week | Month
  - Module filter checkboxes (show/hide module events)
  - "Jump to date" search
- [ ] Connected events: visual lines connecting related events across modules
- [ ] Click event to expand: shows full detail, related insights, linked entities
- [ ] Summary panel at top: event count by module, notable patterns
- [ ] Props: `{ userId: string }`

### 4. `client/src/features/intelligence/components/TemporalQueryBuilder.tsx`
**Purpose**: Visual builder for temporal queries

- [ ] Query builder form:
  - Query type selector: "Point in Time" | "Time Range" | "Trend Over Time" | "Comparison" | "Evolution"
  - Target entity dropdown: transactions, forecasts, compliance, anomalies, tax, bas
  - Time inputs:
    - Point in Time: single date picker
    - Time Range: start + end date pickers
    - Trend: start + end + granularity dropdown
    - Comparison: two date ranges side by side
    - Evolution: start date + interval count + granularity
  - Parameters section: dynamic fields based on target entity (amount range, category, merchant, etc.)
  - "Execute Query" button
  - "Save Query" button with name + description inputs
- [ ] Results panel:
  - Query results displayed as table or chart (auto-select based on query type)
  - Trend queries: line chart with time axis
  - Comparison queries: side-by-side bar chart
  - Point in time: data cards grid
  - Cache indicator: "From cache" badge with TTL countdown
  - "Refresh" button to bypass cache
- [ ] Saved queries list (collapsible sidebar):
  - Name, type, last executed, execution count
  - Click to load and re-execute
  - Delete button
- [ ] Props: `{ userId: string }`

### 5. `client/src/features/intelligence/components/ModuleConnectionMap.tsx`
**Purpose**: Interactive visualization of module connections and data flows

- [ ] Module map visualization (network diagram):
  - Each module as a labeled node (icon + name) arranged in a circle or force layout
  - Connections as arrows between modules with thickness based on strength
  - Arrow color by connection type: data_flow=blue, trigger=orange, dependency=red, correlation=purple, enrichment=green
  - Connection labels on hover
  - Activity animation: recent activity shown as flowing dots along connections
- [ ] Module detail panel (click module):
  - Module name, description
  - Incoming connections list
  - Outgoing connections list
  - Activity stats: total flows, last activity
  - Related insights count
- [ ] Connection detail panel (click connection):
  - Source -> Target with type badge
  - Strength bar
  - Description
  - Activity count
  - Bidirectional indicator
- [ ] Legend: connection type colors and module icons
- [ ] Can use SVG or Canvas for rendering (simpler than three.js -- 2D is sufficient)
- [ ] Props: `{ connections?: ModuleConnection[] }`

### 6. `client/src/features/intelligence/components/SubscriptionManager.tsx`
**Purpose**: CRUD interface for intelligence subscriptions

- [ ] Active subscriptions list:
  - Each subscription card: name, type badge, channel icon (bell=in_app, mail=email, radio=sse, globe=webhook)
  - Filter criteria summary (insight types, modules, severity threshold)
  - Trigger stats: total triggers, last triggered date
  - Active toggle switch
  - Edit/Delete buttons
  - "Test" button to send test notification
- [ ] "Create Subscription" button opens modal form:
  - Name input
  - Type selector: insight_type | module | entity | threshold | schedule
  - Filter criteria builder:
    - Insight types multi-select
    - Modules multi-select
    - Severity minimum dropdown
    - Confidence minimum slider
  - Notification channel selector: In-App | Email | SSE | Webhook
  - Channel config (conditional):
    - Email: address input
    - Webhook: URL input + test button
    - SSE: channel name input
  - Cooldown minutes input (default 60)
- [ ] Notification history section:
  - Recent notifications table: date, subscription name, insight title, channel, status
  - Sortable by date
- [ ] Subscription stats: active count, total triggers this period, channel distribution pie chart
- [ ] Props: `{ userId: string }`

### 7. `client/src/features/intelligence/components/CorrelationExplorer.tsx`
**Purpose**: Explore statistical correlations between modules

- [ ] Module pair selector: two dropdowns (Module A and Module B)
- [ ] "Find Correlations" button
- [ ] Results display:
  - Correlation cards with:
    - Metric A name <-> Metric B name
    - Correlation coefficient display (-1 to +1) with color (red for negative, green for positive)
    - Scatter plot visualization (Module A metric on X, Module B on Y)
    - Sample size and significance indicator
    - Human-readable interpretation text
  - Sort by: strength, significance, module
- [ ] Correlation matrix heatmap (when exploring all module pairs):
  - Modules on both axes
  - Cell color intensity = correlation strength
  - Click cell to see detailed correlation
- [ ] Props: `{ userId: string }`

## Files to MODIFY

### 8. `client/src/api.ts`
- [ ] Add `intelligenceApi` object:
  ```typescript
  export const intelligenceApi = {
    // Temporal
    executeQuery: (data: TemporalQueryRequest) => post('/api/intelligence/temporal/query', data),
    saveQuery: (data: SaveQueryRequest) => post('/api/intelligence/temporal/save', data),
    listSavedQueries: (userId: string, filters?: QueryFilters) => get(`/api/intelligence/temporal/saved/${userId}`, filters),
    getTimeline: (userId: string, params: TimelineParams) => get(`/api/intelligence/temporal/timeline/${userId}`, params),
    // Insights
    scanInsights: (data: InsightScanRequest) => post('/api/intelligence/insights/scan', data),
    listInsights: (userId: string, filters?: InsightFilters) => get(`/api/intelligence/insights/${userId}`, filters),
    getInsight: (insightId: string) => get(`/api/intelligence/insights/detail/${insightId}`),
    updateInsightStatus: (insightId: string, status: string) => patch(`/api/intelligence/insights/${insightId}/status`, { status }),
    // Connections
    getConnections: (filters?: ConnectionFilters) => get('/api/intelligence/connections', filters),
    findCorrelations: (data: CorrelationRequest) => post('/api/intelligence/correlations', data),
    // Subscriptions
    subscribe: (data: SubscriptionRequest) => post('/api/intelligence/subscriptions', data),
    listSubscriptions: (userId: string, filters?: SubscriptionFilters) => get(`/api/intelligence/subscriptions/${userId}`, filters),
    deleteSubscription: (subscriptionId: string) => del(`/api/intelligence/subscriptions/${subscriptionId}`),
    // Cache
    cacheHealth: () => get('/api/intelligence/cache/health'),
  };
  ```
- [ ] Add TypeScript interfaces for all request/response types

### 9. `client/src/App.tsx`
- [ ] Add "Intelligence" navigation tab and route to IntelligenceDashboard
- [ ] Import IntelligenceDashboard from `./features/intelligence/components/IntelligenceDashboard`

## Component Pattern (follow AnalyticsDashboard.tsx):
```tsx
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { intelligenceApi } from '@/api';

export function IntelligenceDashboard() {
    const [insights, setInsights] = useState<CrossModuleInsight[]>([]);
    const [loading, setLoading] = useState(false);
    // ... fetch on mount, render tabs
}
```

## Verification
- [ ] `cd client && npx tsc --noEmit` passes clean
- [ ] All 7 components render without errors
- [ ] IntelligenceDashboard loads with all 5 tabs
- [ ] InsightFeed displays insights in severity order with correct icons
- [ ] IntelligenceTimeline shows chronological events with module colors
- [ ] TemporalQueryBuilder form submits and displays results
- [ ] ModuleConnectionMap renders network diagram with connections
- [ ] SubscriptionManager lists subscriptions with channel icons
- [ ] CorrelationExplorer shows correlation coefficient with scatter plots
- [ ] Navigation to /intelligence works from main nav
- [ ] Create marker file: `.agent-done-W17-08`

## Dependencies
- **Requires**: W17-07 (`.agent-done-W17-07`) -- API routes must exist
- **IMPORTANT**: Only W17-08 modifies client/src/App.tsx and client/src/api.ts in Wave 17
