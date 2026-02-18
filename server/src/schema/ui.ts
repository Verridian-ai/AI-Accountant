import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { users } from './core.js';

// IMPORTANT — CURRENT_TIMESTAMP in PostgreSQL:
// The wrapPgDb() proxy stores the literal string 'CURRENT_TIMESTAMP' in PostgreSQL
// instead of evaluating it. All inserts MUST set timestamp fields explicitly:
//   createdAt: new Date().toISOString()   (see repositories/*.ts)

// ============================================================================
// DASHBOARDS & CHARTS (Wave 22)
// ============================================================================

export const dashboardLayouts = sqliteTable('dashboard_layouts', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  layoutJson: text('layout_json').notNull().default('{}'),
  widgets: text('widgets').notNull().default('[]'),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  isShared: integer('is_shared', { mode: 'boolean' }).notNull().default(false),
  thumbnailUrl: text('thumbnail_url'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const savedCharts = sqliteTable('saved_charts', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  dashboardId: text('dashboard_id').references(() => dashboardLayouts.id),
  chartType: text('chart_type').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  dataSource: text('data_source').notNull(),
  configJson: text('config_json').notNull().default('{}'),
  filtersJson: text('filters_json').default('{}'),
  refreshIntervalSeconds: integer('refresh_interval_seconds').default(0),
  pinned: integer('pinned', { mode: 'boolean' }).notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// Type exports
export type DashboardLayout = typeof dashboardLayouts.$inferSelect;
export type NewDashboardLayout = typeof dashboardLayouts.$inferInsert;
export type SavedChart = typeof savedCharts.$inferSelect;
export type NewSavedChart = typeof savedCharts.$inferInsert;
