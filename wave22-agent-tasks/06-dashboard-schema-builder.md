# Agent 6: Dashboard Schema Builder

## Role
Create 2 database tables and migration 0034 to support custom dashboard layouts and saved chart configurations.

## Priority: WAVE 22 (Start Immediately)

## Files to CREATE

### 1. `docker/migrations/0034_custom_dashboards.sql`
**Purpose**: 2 new tables for user-customizable dashboards

```sql
-- dashboard_layouts: User-created dashboard configurations
CREATE TABLE IF NOT EXISTS dashboard_layouts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    description TEXT,
    layout_json JSONB NOT NULL, -- react-grid-layout configuration: {lg: [...], md: [...], sm: [...]}
    widgets JSONB NOT NULL DEFAULT '[]', -- Array of widget configs: [{id, type, chartType, dataSource, config}]
    is_default BOOLEAN NOT NULL DEFAULT false,
    is_shared BOOLEAN NOT NULL DEFAULT false,
    thumbnail_url TEXT, -- Optional screenshot for dashboard picker
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- saved_charts: Individual chart configurations that can be reused across dashboards
CREATE TABLE IF NOT EXISTS saved_charts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT NOT NULL REFERENCES users(id),
    dashboard_id TEXT REFERENCES dashboard_layouts(id) ON DELETE SET NULL,
    chart_type TEXT NOT NULL, -- 'bar', 'line', 'pie', 'scatter', 'composed', 'treemap', 'sankey', 'sparkline'
    title TEXT NOT NULL,
    description TEXT,
    data_source TEXT NOT NULL, -- API endpoint or query identifier
    config_json JSONB NOT NULL, -- Chart-specific config: {dataKeys, colors, stacked, xAxisKey, etc.}
    filters_json JSONB DEFAULT '{}', -- Applied filters: {period, categories, accounts, minAmount}
    refresh_interval_seconds INTEGER DEFAULT 0, -- 0 = no auto-refresh
    pinned BOOLEAN NOT NULL DEFAULT false,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_dashboard_layouts_user ON dashboard_layouts(user_id);
CREATE INDEX idx_dashboard_layouts_default ON dashboard_layouts(user_id, is_default);
CREATE INDEX idx_saved_charts_user ON saved_charts(user_id);
CREATE INDEX idx_saved_charts_dashboard ON saved_charts(dashboard_id);
CREATE INDEX idx_saved_charts_type ON saved_charts(chart_type);
```

- [ ] Write migration SQL with both tables, indexes, defaults, and FK constraints

### 2. `server/src/schema.ts` additions
- [ ] Add `dashboardLayouts` sqliteTable matching migration columns
- [ ] Add `savedCharts` sqliteTable matching migration columns
- [ ] Use `text()` for TEXT, `integer()` for INTEGER, `integer({mode:'boolean'})` for BOOLEAN

### 3. `server/src/db/postgres-schema.ts` additions
- [ ] Add `dashboardLayouts` pgTable with PostgreSQL types
- [ ] Add `savedCharts` pgTable with PostgreSQL types
- [ ] Add indexes in third argument

## Files to MODIFY

### 4. `server/src/schema.ts`
- [ ] Add exports for `dashboardLayouts` and `savedCharts` tables

### 5. `server/src/db/postgres-schema.ts`
- [ ] Add exports for `dashboardLayouts` and `savedCharts` tables

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] Migration SQL runs without errors against PostgreSQL
- [ ] Both tables accessible via Drizzle imports
- [ ] FK reference from `saved_charts.dashboard_id` to `dashboard_layouts.id` validates
- [ ] `ON DELETE SET NULL` works correctly when dashboard is deleted
- [ ] Create marker file: `.agent-done-W22-06`

## Dependencies
- **None** -- can start immediately
- **Schema lock**: Only this agent may modify schema.ts and postgres-schema.ts in Wave 22
