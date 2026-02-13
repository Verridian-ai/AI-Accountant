-- Wave 22: Advanced Visualizations & Custom Dashboards
-- Migration 0034: dashboard_layouts + saved_charts tables

-- dashboard_layouts: User-created dashboard configurations
CREATE TABLE IF NOT EXISTS dashboard_layouts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT NOT NULL DEFAULT 'default',
    name TEXT NOT NULL,
    description TEXT,
    layout_json JSONB NOT NULL DEFAULT '{}',
    widgets JSONB NOT NULL DEFAULT '[]',
    is_default BOOLEAN NOT NULL DEFAULT false,
    is_shared BOOLEAN NOT NULL DEFAULT false,
    thumbnail_url TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- saved_charts: Individual chart configurations reusable across dashboards
CREATE TABLE IF NOT EXISTS saved_charts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT NOT NULL DEFAULT 'default',
    dashboard_id TEXT REFERENCES dashboard_layouts(id) ON DELETE SET NULL,
    chart_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    data_source TEXT NOT NULL,
    config_json JSONB NOT NULL DEFAULT '{}',
    filters_json JSONB DEFAULT '{}',
    refresh_interval_seconds INTEGER DEFAULT 0,
    pinned BOOLEAN NOT NULL DEFAULT false,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dashboard_layouts_user ON dashboard_layouts(user_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_layouts_default ON dashboard_layouts(user_id, is_default);
CREATE INDEX IF NOT EXISTS idx_saved_charts_user ON saved_charts(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_charts_dashboard ON saved_charts(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_saved_charts_type ON saved_charts(chart_type);
