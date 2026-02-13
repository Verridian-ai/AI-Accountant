# Agent 7: API Endpoints Builder

## Role
Wire 8 new API routes in `server/src/index.ts` for dashboard CRUD operations and chart data endpoints.

## Priority: WAVE 22 (After Agent 6)

## Wait Condition
Check for `.agent-done-W22-06` marker file before starting.

## Files to CREATE

### 1. `server/src/services/dashboard.ts`
**Purpose**: Dashboard and chart management service

- [ ] Create `DashboardService` class with methods:
  - `createDashboard(userId, name, description, layout): Promise<Dashboard>` -- inserts into `dashboard_layouts`
  - `updateDashboard(dashboardId, updates): Promise<Dashboard>` -- partial update of name, description, layout_json, widgets
  - `deleteDashboard(dashboardId): Promise<void>` -- deletes dashboard (saved_charts get dashboard_id set to null)
  - `getDashboards(userId): Promise<Dashboard[]>` -- list all dashboards for user, sorted by sort_order
  - `getDashboard(dashboardId): Promise<Dashboard | null>` -- single dashboard with its widgets
  - `setDefaultDashboard(userId, dashboardId): Promise<void>` -- unsets previous default, sets new one
  - `saveChart(userId, chartConfig): Promise<SavedChart>` -- inserts into `saved_charts`
  - `updateChart(chartId, updates): Promise<SavedChart>` -- partial update of chart config
  - `deleteChart(chartId): Promise<void>` -- removes saved chart
  - `getCharts(userId, dashboardId?): Promise<SavedChart[]>` -- list charts, optionally filtered by dashboard
  - `getChartData(chartId): Promise<any>` -- resolves data_source, applies filters, returns chart data

## Files to MODIFY

### 2. `server/src/index.ts`
**Current state**: ~4,707 lines
**Insert location**: After existing route blocks, before server listen

- [ ] Add imports:
  ```typescript
  import { DashboardService } from './services/dashboard.js';
  ```

- [ ] Instantiate: `const dashboardService = new DashboardService();`

### Dashboard Routes (4 endpoints):

- [ ] `GET /api/dashboards` -- List user's dashboards
  ```typescript
  app.get('/api/dashboards', async (c) => {
      const userId = c.req.query('userId') || 'default';
      const dashboards = await dashboardService.getDashboards(userId);
      return c.json(dashboards);
  });
  ```

- [ ] `POST /api/dashboards` -- Create new dashboard (body: `{name, description, layout}`)

- [ ] `PUT /api/dashboards/:id` -- Update dashboard (body: partial update)

- [ ] `DELETE /api/dashboards/:id` -- Delete dashboard

### Chart Routes (4 endpoints):

- [ ] `GET /api/charts` -- List user's saved charts (query: `?dashboardId=xxx` optional filter)

- [ ] `POST /api/charts` -- Save new chart configuration (body: `{chartType, title, dataSource, config, filters}`)

- [ ] `PUT /api/charts/:id` -- Update chart configuration

- [ ] `DELETE /api/charts/:id` -- Delete saved chart

### Route Pattern (follow existing Hono pattern):
```typescript
app.post('/api/dashboards', async (c) => {
    try {
        const userId = c.req.query('userId') || 'default';
        const body = await c.req.json();
        const dashboard = await dashboardService.createDashboard(userId, body.name, body.description, body.layout);
        return c.json(dashboard, 201);
    } catch (err) {
        console.error('Create dashboard failed:', err);
        return c.json({ error: 'Failed to create dashboard' }, 500);
    }
});
```

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] All 8 routes are accessible (test with curl after Docker rebuild)
- [ ] CRUD operations: create, read, update, delete work for both dashboards and charts
- [ ] Deleting a dashboard sets `dashboard_id = null` on associated charts (not cascade delete)
- [ ] No route path conflicts with existing routes
- [ ] Create marker file: `.agent-done-W22-07`

## Dependencies
- **Requires**: Agent 6 (`.agent-done-W22-06`) for schema tables
- **IMPORTANT**: Only this agent modifies `server/src/index.ts` in Wave 22
