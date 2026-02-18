/**
 * Dashboard & Chart Service Types
 */

export interface CreateDashboardInput {
  name: string;
  description?: string;
  layoutJson?: Record<string, unknown>;
  widgets?: Record<string, unknown>[];
}

export interface UpdateDashboardInput {
  name?: string;
  description?: string;
  layoutJson?: Record<string, unknown>;
  widgets?: Record<string, unknown>[];
  isDefault?: boolean;
  sortOrder?: number;
}

export interface SaveChartInput {
  chartType: string;
  title: string;
  dataSource: string;
  configJson?: Record<string, unknown>;
  filtersJson?: Record<string, unknown>;
  dashboardId?: string;
  description?: string;
}

export interface UpdateChartInput {
  title?: string;
  configJson?: Record<string, unknown>;
  filtersJson?: Record<string, unknown>;
  pinned?: boolean;
  sortOrder?: number;
  description?: string;
  dashboardId?: string;
}
