import { useState, useEffect, useCallback } from 'react';
import { BASE_URL, getAuthHeaders } from '../../../api';

const API_URL = `${BASE_URL}/api`;

export interface WidgetConfig {
  id: string;
  chartType:
    | 'bar'
    | 'line'
    | 'pie'
    | 'donut'
    | 'scatter'
    | 'composed'
    | 'treemap'
    | 'sankey'
    | 'kpi';
  title: string;
  dataSourceUrl?: string;
  refreshInterval?: number;
  position: { col: number; row: number; width: number; height: number };
  config: Record<string, unknown>;
}

export interface DashboardLayout {
  id: string;
  userId: string;
  name: string;
  description?: string;
  isDefault: boolean;
  layout: {
    columns: number;
    widgets: WidgetConfig[];
  };
  createdAt: string;
  updatedAt: string;
}

export function useDashboard(dashboardId?: string) {
  const [dashboard, setDashboard] = useState<DashboardLayout | null>(null);
  const [widgets, setWidgets] = useState<WidgetConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    if (!dashboardId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_URL}/dashboards/${dashboardId}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch dashboard');
      const data = await res.json();
      setDashboard(data);
      setWidgets(data.layout?.widgets ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [dashboardId]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const addWidget = useCallback((widget: WidgetConfig) => {
    setWidgets((prev) => [...prev, widget]);
  }, []);

  const removeWidget = useCallback((widgetId: string) => {
    setWidgets((prev) => prev.filter((w) => w.id !== widgetId));
  }, []);

  const updateWidgetConfig = useCallback((widgetId: string, updates: Partial<WidgetConfig>) => {
    setWidgets((prev) => prev.map((w) => (w.id === widgetId ? { ...w, ...updates } : w)));
  }, []);

  const updateLayout = useCallback((updatedWidgets: WidgetConfig[]) => {
    setWidgets(updatedWidgets);
  }, []);

  const saveDashboard = useCallback(async () => {
    if (!dashboard) return;

    try {
      const res = await fetch(`${API_URL}/dashboards/${dashboard.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          name: dashboard.name,
          description: dashboard.description,
          layout: {
            columns: dashboard.layout?.columns ?? 12,
            widgets,
          },
        }),
      });
      if (!res.ok) throw new Error('Failed to save dashboard');
      const updated = await res.json();
      setDashboard(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save dashboard');
      throw err;
    }
  }, [dashboard, widgets]);

  return {
    dashboard,
    widgets,
    loading,
    error,
    addWidget,
    removeWidget,
    updateWidgetConfig,
    updateLayout,
    saveDashboard,
    refresh: fetchDashboard,
  };
}
