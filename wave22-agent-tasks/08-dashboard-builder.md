# Agent 8: Dashboard Builder

## Role
Build 4 React components for the custom dashboard system with drag-and-drop layout, widget picker, and configuration panel. Uses react-grid-layout for responsive grid management.

## Priority: WAVE 22 (After Agents 1, 7)

## Wait Condition
Check for `.agent-done-W22-01` and `.agent-done-W22-07` marker files before starting.

## Files to CREATE

### 1. `client/src/features/dashboards/components/CustomDashboard.tsx`
**Purpose**: Main dashboard view with drag-and-drop widget arrangement
**Pattern**: Neumorphic dark theme, gold accents

- [ ] Props: `dashboardId: string`, `editable?: boolean`
- [ ] Fetch dashboard layout from `GET /api/dashboards/:id`
- [ ] Render widgets using `react-grid-layout` `ResponsiveGridLayout`:
  - Breakpoints: lg (1200), md (996), sm (768), xs (480)
  - Columns: lg=12, md=10, sm=6, xs=4
  - Row height: 80px
  - Draggable and resizable when `editable=true`
- [ ] Each widget rendered based on `widget.chartType`:
  - Map to corresponding chart component (BarChart, LineChart, PieChart, etc.)
  - Pass `widget.config` as chart props
  - Fetch data from `widget.dataSource` API endpoint
- [ ] Edit mode toggle (gold pencil icon):
  - Shows drag handles on each widget
  - Shows resize handles
  - Shows delete button (X) on hover
  - Shows "Add Widget" button
- [ ] Save layout: `PUT /api/dashboards/:id` with updated `layout_json` on drag/resize stop
- [ ] Toolbar: dashboard name (editable), save button, export button, share toggle

### 2. `client/src/features/dashboards/components/WidgetPicker.tsx`
**Purpose**: Modal for selecting and configuring new widgets to add to dashboard

- [ ] Trigger: "Add Widget" button in edit mode
- [ ] Grid of available widget types with preview thumbnails:
  - Bar Chart, Line Chart, Pie Chart, Donut Chart, Scatter Plot
  - Composed Chart, TreeMap, Sankey, Sparkline Grid
  - KPI Card, Transaction List, Summary Table
- [ ] Each type shows: icon, name, description, preview image
- [ ] Click to select type, then proceed to configuration (WidgetConfigPanel)
- [ ] Search/filter widget types
- [ ] Neu-raised modal with gold-bordered header

### 3. `client/src/features/dashboards/components/WidgetConfigPanel.tsx`
**Purpose**: Configuration panel for widget settings after type selection

- [ ] Props: `widgetType: string`, `existingConfig?: WidgetConfig`, `onSave: (config) => void`, `onCancel: () => void`
- [ ] Dynamic form based on widget type:
  - **Common fields**: Title, data source (dropdown of available APIs), refresh interval
  - **Bar Chart**: Data keys, x-axis key, stacked toggle, horizontal toggle, colors
  - **Line Chart**: Data keys, curved toggle, show dots, show area, colors
  - **Pie Chart**: Inner radius (pie vs donut), show labels, show legend
  - **Scatter Plot**: X key, Y key, size key, color key
  - **Sankey**: Source/target field mapping, color scheme
- [ ] Data source dropdown populates from available API endpoints:
  - `/api/transactions/summary`, `/api/analytics/budget`, `/api/tax/return/*`, `/api/economic/*`, `/api/bas/*`
- [ ] Preview panel: live preview of chart with current configuration
- [ ] Filter builder: period, categories, accounts, minimum amount
- [ ] Save creates `POST /api/charts` and adds widget to dashboard layout

### 4. `client/src/features/dashboards/components/DashboardGrid.tsx`
**Purpose**: Dashboard list and management view

- [ ] Fetch all dashboards from `GET /api/dashboards`
- [ ] Grid of dashboard cards (3 per row on desktop, 1 on mobile):
  - Dashboard name, description, widget count, last updated
  - Thumbnail preview (if available)
  - Default badge (gold star) for default dashboard
  - Actions: Edit, Duplicate, Set as Default, Delete
- [ ] "Create New Dashboard" card with plus icon
- [ ] Create dialog: name, description, template selection (blank, financial overview, tax summary, BAS tracker)
- [ ] Templates pre-populate with relevant widgets and layout

### 5. `client/src/features/dashboards/index.ts`
**Purpose**: Barrel export

- [ ] Export all 4 components

### 6. `client/src/features/dashboards/hooks/useDashboard.ts`
**Purpose**: React hook for dashboard state management

- [ ] `useDashboard(dashboardId?: string)` returns:
  - `dashboard: Dashboard | null`
  - `widgets: Widget[]`
  - `loading: boolean`
  - `addWidget(config: WidgetConfig): void`
  - `removeWidget(widgetId: string): void`
  - `updateLayout(layout: Layout): void`
  - `saveDashboard(): Promise<void>`

## Files to MODIFY

### 7. `client/package.json`
- [ ] Add dependencies: `react-grid-layout@^1.4`, `@types/react-grid-layout`

### 8. `client/src/App.tsx`
- [ ] Add imports for `DashboardGrid`, `CustomDashboard`
- [ ] Wire into navigation as "Dashboards" section

### 9. `client/src/api.ts`
- [ ] Add API functions:
  - `fetchDashboards()`
  - `fetchDashboard(id)`
  - `createDashboard(data)`
  - `updateDashboard(id, data)`
  - `deleteDashboard(id)`
  - `fetchSavedCharts(dashboardId?)`
  - `saveChart(data)`
  - `updateChart(id, data)`
  - `deleteChart(id)`

## Verification
- [ ] `cd client && npx tsc --noEmit` passes clean
- [ ] DashboardGrid lists dashboards and creates new ones
- [ ] CustomDashboard renders widgets in drag-and-drop grid
- [ ] Widgets can be dragged, resized, and removed in edit mode
- [ ] WidgetPicker shows all available widget types
- [ ] WidgetConfigPanel produces valid chart configuration
- [ ] Layout persists after save and page reload
- [ ] Responsive: grid reconfigures at each breakpoint
- [ ] Create marker file: `.agent-done-W22-08`

## Dependencies
- **Requires**: Agent 1 (`.agent-done-W22-01`) for chart components, Agent 7 (`.agent-done-W22-07`) for API endpoints
- **Reuses**: All chart components from `components/charts/`, api.ts patterns
