/**
 * Dashboard & Chart Management Service
 * CRUD operations for custom dashboard layouts and saved chart configurations.
 * Wave 22: Data Visualization & Custom Dashboards
 */

import { db, dashboardLayouts, savedCharts } from '../../schema.js';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import type { UpdateDashboardInput, SaveChartInput, UpdateChartInput } from './types.js';

export class DashboardService {
  // --------------------------------------------------------------------------
  // Dashboard CRUD
  // --------------------------------------------------------------------------

  async getDashboards(userId: string) {
    return db
      .select()
      .from(dashboardLayouts)
      .where(eq(dashboardLayouts.userId, userId))
      .orderBy(dashboardLayouts.sortOrder)
      .all();
  }

  async getDashboard(dashboardId: string) {
    return db.select().from(dashboardLayouts).where(eq(dashboardLayouts.id, dashboardId)).get();
  }

  async createDashboard(
    userId: string,
    name: string,
    description?: string,
    layoutJson?: Record<string, unknown>,
    widgets?: Record<string, unknown>[],
  ) {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    const newDashboard = {
      id,
      userId,
      name,
      description: description ?? null,
      layoutJson: layoutJson ? JSON.stringify(layoutJson) : '{}',
      widgets: widgets ? JSON.stringify(widgets) : '[]',
      isDefault: false,
      isShared: false,
      thumbnailUrl: null,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(dashboardLayouts).values(newDashboard);
    return newDashboard;
  }

  async updateDashboard(dashboardId: string, updates: UpdateDashboardInput) {
    const setValues: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (updates.name !== undefined) setValues.name = updates.name;
    if (updates.description !== undefined) setValues.description = updates.description;
    if (updates.layoutJson !== undefined) setValues.layoutJson = JSON.stringify(updates.layoutJson);
    if (updates.widgets !== undefined) setValues.widgets = JSON.stringify(updates.widgets);
    if (updates.isDefault !== undefined) setValues.isDefault = updates.isDefault;
    if (updates.sortOrder !== undefined) setValues.sortOrder = updates.sortOrder;

    await db.update(dashboardLayouts).set(setValues).where(eq(dashboardLayouts.id, dashboardId));

    return this.getDashboard(dashboardId);
  }

  async deleteDashboard(dashboardId: string) {
    await db.delete(dashboardLayouts).where(eq(dashboardLayouts.id, dashboardId));
  }

  async setDefaultDashboard(userId: string, dashboardId: string) {
    // Clear all defaults for this user
    await db
      .update(dashboardLayouts)
      .set({ isDefault: false, updatedAt: new Date().toISOString() })
      .where(eq(dashboardLayouts.userId, userId));

    // Set the specified dashboard as default
    await db
      .update(dashboardLayouts)
      .set({ isDefault: true, updatedAt: new Date().toISOString() })
      .where(eq(dashboardLayouts.id, dashboardId));

    return this.getDashboard(dashboardId);
  }

  // --------------------------------------------------------------------------
  // Chart CRUD
  // --------------------------------------------------------------------------

  async getCharts(userId: string, dashboardId?: string) {
    if (dashboardId) {
      return db
        .select()
        .from(savedCharts)
        .where(and(eq(savedCharts.userId, userId), eq(savedCharts.dashboardId, dashboardId)))
        .orderBy(savedCharts.sortOrder)
        .all();
    }

    return db
      .select()
      .from(savedCharts)
      .where(eq(savedCharts.userId, userId))
      .orderBy(savedCharts.sortOrder)
      .all();
  }

  async getChart(chartId: string) {
    return db.select().from(savedCharts).where(eq(savedCharts.id, chartId)).get();
  }

  async saveChart(userId: string, config: SaveChartInput) {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    const newChart = {
      id,
      userId,
      dashboardId: config.dashboardId ?? null,
      chartType: config.chartType,
      title: config.title,
      description: config.description ?? null,
      dataSource: config.dataSource,
      configJson: config.configJson ? JSON.stringify(config.configJson) : '{}',
      filtersJson: config.filtersJson ? JSON.stringify(config.filtersJson) : '{}',
      refreshIntervalSeconds: 0,
      pinned: false,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(savedCharts).values(newChart);
    return newChart;
  }

  async updateChart(chartId: string, updates: UpdateChartInput) {
    const setValues: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (updates.title !== undefined) setValues.title = updates.title;
    if (updates.configJson !== undefined) setValues.configJson = JSON.stringify(updates.configJson);
    if (updates.filtersJson !== undefined)
      setValues.filtersJson = JSON.stringify(updates.filtersJson);
    if (updates.pinned !== undefined) setValues.pinned = updates.pinned;
    if (updates.sortOrder !== undefined) setValues.sortOrder = updates.sortOrder;
    if (updates.description !== undefined) setValues.description = updates.description;
    if (updates.dashboardId !== undefined) setValues.dashboardId = updates.dashboardId;

    await db.update(savedCharts).set(setValues).where(eq(savedCharts.id, chartId));

    return this.getChart(chartId);
  }

  async deleteChart(chartId: string) {
    await db.delete(savedCharts).where(eq(savedCharts.id, chartId));
  }
}

export const dashboardService = new DashboardService();
