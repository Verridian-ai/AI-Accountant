import React, { useState, useCallback, useEffect } from 'react';
import {
  Pencil,
  Save,
  Plus,
  X,
  Settings2,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import {
  BarChart,
  LineChart,
  PieChart,
  ComposedChart,
  ScatterPlot,
  Sparkline,
  TreeMap,
  Sankey,
  CHART_COLORS,
} from '../../../components/charts';
import { useDashboard } from '../hooks/useDashboard';
import type { WidgetConfig } from '../hooks/useDashboard';
import { WidgetPicker } from './WidgetPicker';
import { WidgetConfigPanel } from './WidgetConfigPanel';
import { BASE_URL, getAuthHeaders } from '../../../api';

interface CustomDashboardProps {
  dashboardId: string;
}

const DEMO_BAR_DATA = [
  { name: 'Jan', value: 4200 },
  { name: 'Feb', value: 3800 },
  { name: 'Mar', value: 5100 },
  { name: 'Apr', value: 4600 },
  { name: 'May', value: 5800 },
  { name: 'Jun', value: 4900 },
];

const DEMO_LINE_DATA = [
  { date: 'Jan', value: 1200 },
  { date: 'Feb', value: 1900 },
  { date: 'Mar', value: 1600 },
  { date: 'Apr', value: 2200 },
  { date: 'May', value: 2800 },
  { date: 'Jun', value: 2400 },
];

const DEMO_PIE_DATA = [
  { name: 'Revenue', value: 42000 },
  { name: 'Expenses', value: 28000 },
  { name: 'Savings', value: 14000 },
];

const DEMO_SCATTER_DATA = [
  { x: 10, y: 20 },
  { x: 20, y: 35 },
  { x: 30, y: 45 },
  { x: 40, y: 30 },
  { x: 50, y: 55 },
  { x: 60, y: 48 },
];

const DEMO_TREEMAP_DATA = [
  { name: 'Housing', value: 1800 },
  { name: 'Food', value: 600 },
  { name: 'Transport', value: 400 },
  { name: 'Utilities', value: 300 },
  { name: 'Entertainment', value: 200 },
];

const DEMO_SANKEY = {
  nodes: [
    { name: 'Income' },
    { name: 'Expenses' },
    { name: 'Savings' },
    { name: 'Housing' },
    { name: 'Food' },
  ],
  links: [
    { source: 0, target: 1, value: 3000 },
    { source: 0, target: 2, value: 2000 },
    { source: 1, target: 3, value: 1800 },
    { source: 1, target: 4, value: 600 },
  ],
};

function formatAUD(cents: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(cents / 100);
}

export function CustomDashboard({ dashboardId }: CustomDashboardProps) {
  const {
    dashboard,
    widgets,
    loading,
    error,
    addWidget,
    removeWidget,
    updateWidgetConfig,
    saveDashboard,
  } = useDashboard(dashboardId);

  const [editMode, setEditMode] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [configWidget, setConfigWidget] = useState<WidgetConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [widgetData, setWidgetData] = useState<Record<string, unknown[]>>({});

  // Fetch data for widgets with data source URLs
  useEffect(() => {
    widgets.forEach((w) => {
      if (w.dataSourceUrl && !widgetData[w.id]) {
        const url = w.dataSourceUrl.startsWith('http')
          ? w.dataSourceUrl
          : `${BASE_URL}${w.dataSourceUrl}`;
        fetch(url, { headers: getAuthHeaders() })
          .then((res) => res.json())
          .then((data) => {
            const items = Array.isArray(data) ? data : (data.transactions ?? data.data ?? []);
            setWidgetData((prev) => ({ ...prev, [w.id]: items }));
          })
          .catch(() => {
            // Silently fail - widget will show demo data
          });
      }
    });
  }, [widgets, widgetData]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await saveDashboard();
      setEditMode(false);
    } catch {
      // Error is handled by the hook
    } finally {
      setSaving(false);
    }
  };

  const handleAddWidget = useCallback(
    (widget: WidgetConfig) => {
      // Auto-position: find the next available row
      const maxRow = widgets.reduce(
        (max, w) => Math.max(max, w.position.row + w.position.height),
        0,
      );
      const positioned = {
        ...widget,
        position: {
          ...widget.position,
          row: maxRow,
          col: 0,
        },
      };
      addWidget(positioned);
    },
    [widgets, addWidget],
  );

  const renderWidget = (widget: WidgetConfig) => {
    const data = widgetData[widget.id];
    const config = widget.config ?? {};

    switch (widget.chartType) {
      case 'bar':
        return (
          <BarChart
            data={(data as Record<string, unknown>[]) ?? DEMO_BAR_DATA}
            dataKeys={(config.dataKeys as string[]) ?? ['value']}
            xAxisKey={(config.xAxisKey as string) ?? 'name'}
            stacked={Boolean(config.stacked)}
            title={widget.title}
            height={200}
          />
        );
      case 'line':
        return (
          <LineChart
            data={(data as Record<string, unknown>[]) ?? DEMO_LINE_DATA}
            dataKeys={(config.dataKeys as string[]) ?? ['value']}
            xAxisKey={(config.xAxisKey as string) ?? 'date'}
            curved={config.curved !== false}
            showArea={Boolean(config.showArea)}
            title={widget.title}
            height={200}
          />
        );
      case 'pie':
        return (
          <PieChart
            data={(data as Array<{ name: string; value: number }>) ?? DEMO_PIE_DATA}
            showLabels={config.showLabels !== false}
            showLegend={config.showLegend !== false}
            title={widget.title}
            height={200}
          />
        );
      case 'donut':
        return (
          <PieChart
            data={(data as Array<{ name: string; value: number }>) ?? DEMO_PIE_DATA}
            innerRadius={(config.innerRadius as number) ?? 60}
            showLabels={config.showLabels !== false}
            showLegend={config.showLegend !== false}
            title={widget.title}
            height={200}
          />
        );
      case 'scatter':
        return (
          <ScatterPlot
            data={(data as Record<string, unknown>[]) ?? DEMO_SCATTER_DATA}
            xKey={(config.xKey as string) ?? 'x'}
            yKey={(config.yKey as string) ?? 'y'}
            title={widget.title}
            height={200}
          />
        );
      case 'composed':
        return (
          <ComposedChart
            data={(data as Record<string, unknown>[]) ?? DEMO_BAR_DATA}
            bars={
              (config.bars as Array<{ dataKey: string; color: string }>) ?? [
                { dataKey: 'value', color: CHART_COLORS.primary },
              ]
            }
            lines={(config.lines as Array<{ dataKey: string; color: string }>) ?? []}
            areas={(config.areas as Array<{ dataKey: string; color: string }>) ?? []}
            xAxisKey={(config.xAxisKey as string) ?? 'name'}
            title={widget.title}
            height={200}
          />
        );
      case 'treemap':
        return (
          <TreeMap
            data={
              (data as Array<{
                name: string;
                value?: number;
                children?: Array<{ name: string; value?: number }>;
              }>) ?? DEMO_TREEMAP_DATA
            }
            title={widget.title}
            height={200}
          />
        );
      case 'sankey': {
        const sankeyData = data
          ? {
              nodes:
                (
                  data as unknown as {
                    nodes: Array<{ name: string }>;
                    links: Array<{ source: number; target: number; value: number }>;
                  }
                ).nodes ?? DEMO_SANKEY.nodes,
              links:
                (
                  data as unknown as {
                    nodes: Array<{ name: string }>;
                    links: Array<{ source: number; target: number; value: number }>;
                  }
                ).links ?? DEMO_SANKEY.links,
            }
          : DEMO_SANKEY;
        return (
          <Sankey
            nodes={sankeyData.nodes}
            links={sankeyData.links}
            title={widget.title}
            height={200}
          />
        );
      }
      case 'kpi':
        return (
          <KPICard
            label={(config.metricLabel as string) ?? 'Metric'}
            value={42850}
            previousValue={38200}
            format={(config.format as 'currency' | 'number' | 'percent') ?? 'currency'}
          />
        );
      default:
        return (
          <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
            Unknown widget type: {widget.chartType}
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-[#FFCC00] animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="neu-raised p-6 rounded-xl border border-red-500/30 text-red-400 text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-zinc-100">{dashboard?.name ?? 'Dashboard'}</h2>
          {dashboard?.description && (
            <p className="text-sm text-zinc-500 mt-0.5">{dashboard.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {editMode && (
            <button
              onClick={() => setShowPicker(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-[#FFCC00] border border-[#FFCC00]/30 rounded-xl hover:bg-[#FFCC00]/10 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Widget
            </button>
          )}
          {editMode ? (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-[#FFCC00] text-[#0a0a0f] rounded-xl font-bold text-sm hover:bg-[#FFE066] transition-colors btn-press"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </button>
          ) : (
            <button
              onClick={() => setEditMode(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-[#FFCC00] neu-raised-sm rounded-xl hover:bg-[#FFCC00]/10 transition-colors"
            >
              <Pencil className="w-4 h-4" />
              Edit
            </button>
          )}
        </div>
      </div>

      {/* Widget Grid */}
      {widgets.length === 0 ? (
        <div className="neu-inset rounded-2xl p-12 flex flex-col items-center justify-center text-center">
          <div className="neu-raised p-4 rounded-2xl mb-4">
            <Plus className="w-8 h-8 text-zinc-500" />
          </div>
          <h3 className="text-lg font-bold text-zinc-300 mb-1">No widgets yet</h3>
          <p className="text-sm text-zinc-500 mb-4">
            Click Edit and then Add Widget to start building your dashboard
          </p>
          <button
            onClick={() => {
              setEditMode(true);
              setShowPicker(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#FFCC00] text-[#0a0a0f] rounded-xl font-bold text-sm hover:bg-[#FFE066] transition-colors btn-press"
          >
            <Plus className="w-4 h-4" />
            Add Your First Widget
          </button>
        </div>
      ) : (
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: 'repeat(12, 1fr)',
          }}
        >
          {widgets.map((widget) => (
            <div
              key={widget.id}
              className={cn(
                'neu-raised rounded-2xl overflow-hidden border border-white/5 transition-all duration-200',
                editMode && 'hover:border-[#FFCC00]/30',
              )}
              style={{
                gridColumn: `span ${Math.min(widget.position.width, 12)}`,
                minHeight: `${widget.position.height * 60}px`,
              }}
            >
              {/* Widget Header (edit mode) */}
              {editMode && (
                <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 bg-white/[0.02]">
                  <span className="text-xs font-bold text-zinc-400 truncate">{widget.title}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setConfigWidget(widget)}
                      className="p-1 rounded text-zinc-500 hover:text-[#FFCC00] transition-colors"
                      title="Configure"
                    >
                      <Settings2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => removeWidget(widget.id)}
                      className="p-1 rounded text-zinc-500 hover:text-red-400 transition-colors"
                      title="Remove"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Widget Content */}
              <div className="p-3">{renderWidget(widget)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Widget Picker Modal */}
      <WidgetPicker
        open={showPicker}
        onClose={() => setShowPicker(false)}
        onSelect={handleAddWidget}
      />

      {/* Widget Config Panel */}
      <WidgetConfigPanel
        widget={configWidget}
        open={configWidget !== null}
        onClose={() => setConfigWidget(null)}
        onSave={(widgetId, updates) => updateWidgetConfig(widgetId, updates)}
      />
    </div>
  );
}

/**
 * Simple KPI card widget for displaying a single metric with trend.
 */
function KPICard({
  label,
  value,
  previousValue,
  format = 'currency',
}: {
  label: string;
  value: number;
  previousValue?: number;
  format?: 'currency' | 'number' | 'percent';
}) {
  const formatValue = (v: number) => {
    switch (format) {
      case 'currency':
        return formatAUD(v);
      case 'percent':
        return `${v.toFixed(1)}%`;
      default:
        return v.toLocaleString('en-AU');
    }
  };

  const change =
    previousValue != null ? ((value - previousValue) / Math.abs(previousValue || 1)) * 100 : null;
  const trend = change != null ? (change > 0 ? 'up' : change < 0 ? 'down' : 'flat') : null;

  const sparkData = [38, 42, 39, 44, 47, 45, 50, 48, 52, 55];

  return (
    <div className="flex flex-col items-center justify-center h-full py-4 gap-2">
      <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{label}</span>
      <span className="text-2xl font-bold text-zinc-100">{formatValue(value)}</span>
      {change != null && (
        <div
          className={cn(
            'flex items-center gap-1 text-xs font-bold',
            trend === 'up' && 'text-emerald-400',
            trend === 'down' && 'text-red-400',
            trend === 'flat' && 'text-zinc-400',
          )}
        >
          {trend === 'up' && <TrendingUp className="w-3 h-3" />}
          {trend === 'down' && <TrendingDown className="w-3 h-3" />}
          {trend === 'flat' && <Minus className="w-3 h-3" />}
          {change > 0 ? '+' : ''}
          {change.toFixed(1)}%
        </div>
      )}
      <Sparkline
        data={sparkData}
        width={120}
        height={24}
        trend={trend === 'up' ? 'up' : trend === 'down' ? 'down' : 'flat'}
        showArea
      />
    </div>
  );
}
