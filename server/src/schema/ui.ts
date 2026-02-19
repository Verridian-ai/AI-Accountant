import { pgTable, text, integer, boolean } from 'drizzle-orm/pg-core';

// NOTE: .references() to users (core.ts) omitted until core.ts migrates to pgTable (TASK-045).
// DB-level FK constraints are defined in SQL migration files and remain intact.

// ============================================================================
// DASHBOARDS & CHARTS (Wave 22)
// ============================================================================

export const dashboardLayouts = pgTable('dashboard_layouts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(), // FK → users(id) CASCADE
  name: text('name').notNull(),
  description: text('description'),
  layoutJson: text('layout_json').notNull().default('{}'),
  widgets: text('widgets').notNull().default('[]'),
  isDefault: boolean('is_default').notNull().default(false),
  isShared: boolean('is_shared').notNull().default(false),
  thumbnailUrl: text('thumbnail_url'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const savedCharts = pgTable('saved_charts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(), // FK → users(id) CASCADE
  dashboardId: text('dashboard_id'), // FK → dashboard_layouts(id)
  chartType: text('chart_type').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  dataSource: text('data_source').notNull(),
  configJson: text('config_json').notNull().default('{}'),
  filtersJson: text('filters_json').default('{}'),
  refreshIntervalSeconds: integer('refresh_interval_seconds').default(0),
  pinned: boolean('pinned').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// Type exports
export type DashboardLayout = typeof dashboardLayouts.$inferSelect;
export type NewDashboardLayout = typeof dashboardLayouts.$inferInsert;
export type SavedChart = typeof savedCharts.$inferSelect;
export type NewSavedChart = typeof savedCharts.$inferInsert;
