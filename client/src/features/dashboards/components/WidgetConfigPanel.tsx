import { useReducer } from 'react';
import { X, Save, RotateCcw } from 'lucide-react';

import type { WidgetConfig } from '../hooks/useDashboard';

interface WidgetConfigPanelProps {
  widget: WidgetConfig | null;
  open: boolean;
  onClose: () => void;
  onSave: (widgetId: string, updates: Partial<WidgetConfig>) => void;
}

interface WidgetPanelState {
  title: string;
  dataSourceUrl: string;
  refreshInterval: number;
  chartConfig: Record<string, unknown>;
  prevWidgetId: string | null;
}

const initialState: WidgetPanelState = {
  title: '',
  dataSourceUrl: '',
  refreshInterval: 0,
  chartConfig: {},
  prevWidgetId: null,
};

export function WidgetConfigPanel({ widget, open, onClose, onSave }: WidgetConfigPanelProps) {
  const [state, setState] = useReducer(
    (prev: WidgetPanelState, next: Partial<WidgetPanelState>) => ({ ...prev, ...next }),
    initialState
  );

  const { title, dataSourceUrl, refreshInterval, chartConfig, prevWidgetId } = state;

  if (widget && widget.id !== prevWidgetId) {
    setState({
      prevWidgetId: widget.id,
      title: widget.title,
      dataSourceUrl: widget.dataSourceUrl ?? '',
      refreshInterval: widget.refreshInterval ?? 0,
      chartConfig: widget.config ?? {},
    });
  }

  if (!open || !widget) return null;

  const handleSave = () => {
    onSave(widget.id, {
      title,
      dataSourceUrl: dataSourceUrl || undefined,
      refreshInterval: refreshInterval || undefined,
      config: chartConfig,
    });
    onClose();
  };

  const handleReset = () => {
    if (widget) {
      setState({
        title: widget.title,
        dataSourceUrl: widget.dataSourceUrl ?? '',
        refreshInterval: widget.refreshInterval ?? 0,
        chartConfig: widget.config ?? {},
      });
    }
  };

  const updateConfig = (key: string, value: unknown) => {
    setState({ chartConfig: { ...chartConfig, [key]: value } });
  };

  return (
    <>
      {/* Overlay */}
      <div
        role="presentation"
        className="fixed inset-0 bg-overlay-hover z-40"
        onClick={onClose}
        onKeyDown={() => { }}
      />

      {/* Slide-in Panel */}
      <div className="fixed top-0 right-0 bottom-0 w-full max-w-sm z-50 neu-raised border-l border-cba-gold/10 flex flex-col animate-in slide-in-from-right duration-300" role="dialog" aria-labelledby="widget-settings-title" aria-modal="true">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-cba-gold/20 shrink-0">
          <h3 id="widget-settings-title" className="text-lg font-bold text-gradient-gold">Widget Settings</h3>
          <button
            onClick={onClose}
            aria-label="Close widget settings"
            className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-overlay-hover transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Common fields */}
          <FieldGroup label="Title">
            <input
              type="text"
              value={title}
              onChange={(e) => setState({ title: e.target.value })}
              className="config-input"
              placeholder="Widget title"
            />
          </FieldGroup>

          <FieldGroup label="Data Source URL">
            <input
              type="text"
              value={dataSourceUrl}
              onChange={(e) => setState({ dataSourceUrl: e.target.value })}
              className="config-input"
              placeholder="/api/transactions?limit=100"
            />
          </FieldGroup>

          <FieldGroup label="Refresh Interval (seconds)">
            <input
              type="number"
              value={refreshInterval}
              onChange={(e) => setState({ refreshInterval: Number(e.target.value) })}
              className="config-input"
              min={0}
              step={10}
              placeholder="0 = manual only"
            />
          </FieldGroup>

          {/* Divider */}
          <div className="border-t border-border/50 pt-4">
            <h4 className="text-xs font-bold text-secondary uppercase tracking-wider mb-3">
              Chart Settings ({widget.chartType})
            </h4>
            <ChartSpecificFields
              chartType={widget.chartType}
              chartConfig={chartConfig}
              updateConfig={updateConfig}
            />
          </div>

          {/* Widget size */}
          <div className="border-t border-border/50 pt-4">
            <h4 className="text-xs font-bold text-secondary uppercase tracking-wider mb-3">
              Size (grid units)
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <FieldGroup label="Width">
                <input
                  type="number"
                  aria-label="Width"
                  value={widget.position.width}
                  onChange={(e) => {
                    const newWidth = Math.max(3, Math.min(12, Number(e.target.value)));
                    onSave(widget.id, {
                      position: { ...widget.position, width: newWidth },
                    });
                  }}
                  className="config-input"
                  min={3}
                  max={12}
                />
              </FieldGroup>
              <FieldGroup label="Height">
                <input
                  type="number"
                  aria-label="Height"
                  value={widget.position.height}
                  onChange={(e) => {
                    const newHeight = Math.max(2, Math.min(8, Number(e.target.value)));
                    onSave(widget.id, {
                      position: { ...widget.position, height: newHeight },
                    });
                  }}
                  className="config-input"
                  min={2}
                  max={8}
                />
              </FieldGroup>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t border-border/50 shrink-0">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-secondary hover:text-primary transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-bold text-secondary hover:text-primary transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-cba-gold text-base hover:bg-cba-gold-light transition-colors btn-press"
            >
              <Save className="w-3.5 h-3.5" />
              Save
            </button>
          </div>
        </div>
      </div>

      {/* Shared input style injected via class */}
      <style>{`
        .config-input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border-radius: 0.75rem;
          background: transparent;
          color: #e4e4e7;
          font-size: 0.875rem;
          box-shadow: inset 2px 2px 4px rgba(0,0,0,0.4), inset -2px -2px 4px rgba(255,255,255,0.03);
          outline: none;
          transition: box-shadow 0.2s;
        }
        .config-input:focus {
          box-shadow: inset 2px 2px 4px rgba(0,0,0,0.4), inset -2px -2px 4px rgba(255,255,255,0.03), 0 0 0 1px rgba(255,204,0,0.4);
        }
        .config-input::placeholder {
          color: #52525b;
        }
      `}</style>
    </>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor="dashb-f6" className="block text-xs font-bold text-secondary uppercase tracking-wider mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

export function ChartSpecificFields({
  chartType,
  chartConfig,
  updateConfig,
}: {
  chartType: string;
  chartConfig: Record<string, unknown>;
  updateConfig: (key: string, value: unknown) => void;
}) {
  switch (chartType) {
    case 'bar':
      return (
        <>
          <FieldGroup label="Data Keys (comma-separated)">
            <input
              type="text"
              value={Array.isArray(chartConfig.dataKeys) ? (chartConfig.dataKeys as string[]).join(', ') : ''}
              onChange={(e) => updateConfig('dataKeys', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
              className="config-input"
              placeholder="value, count"
            />
          </FieldGroup>
          <FieldGroup label="X-Axis Key">
            <input
              type="text"
              value={(chartConfig.xAxisKey as string) ?? ''}
              onChange={(e) => updateConfig('xAxisKey', e.target.value)}
              className="config-input"
              placeholder="name"
            />
          </FieldGroup>
          <FieldGroup label="Stacked">
            <label htmlFor="dashb-f1" className="flex items-center gap-2 cursor-pointer">
              <input
                id="dashb-f1"
                type="checkbox"
                checked={Boolean(chartConfig.stacked)}
                onChange={(e) => updateConfig('stacked', e.target.checked)}
                className="rounded border-zinc-600 bg-zinc-800 text-cba-gold focus:ring-[#FFCC00]/30"
              />
              <span className="text-sm text-primary">Enable stacking</span>
            </label>
          </FieldGroup>
        </>
      );
    case 'line':
      return (
        <>
          <FieldGroup label="Data Keys (comma-separated)">
            <input
              type="text"
              value={Array.isArray(chartConfig.dataKeys) ? (chartConfig.dataKeys as string[]).join(', ') : ''}
              onChange={(e) => updateConfig('dataKeys', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
              className="config-input"
              placeholder="value"
            />
          </FieldGroup>
          <FieldGroup label="X-Axis Key">
            <input
              type="text"
              value={(chartConfig.xAxisKey as string) ?? ''}
              onChange={(e) => updateConfig('xAxisKey', e.target.value)}
              className="config-input"
              placeholder="date"
            />
          </FieldGroup>
          <FieldGroup label="Show Area">
            <label htmlFor="dashb-f2" className="flex items-center gap-2 cursor-pointer">
              <input
                id="dashb-f2"
                type="checkbox"
                checked={Boolean(chartConfig.showArea)}
                onChange={(e) => updateConfig('showArea', e.target.checked)}
                className="rounded border-zinc-600 bg-zinc-800 text-cba-gold focus:ring-[#FFCC00]/30"
              />
              <span className="text-sm text-primary">Fill area under line</span>
            </label>
          </FieldGroup>
          <FieldGroup label="Curved">
            <label htmlFor="dashb-f3" className="flex items-center gap-2 cursor-pointer">
              <input
                id="dashb-f3"
                type="checkbox"
                checked={chartConfig.curved !== false}
                onChange={(e) => updateConfig('curved', e.target.checked)}
                className="rounded border-zinc-600 bg-zinc-800 text-cba-gold focus:ring-[#FFCC00]/30"
              />
              <span className="text-sm text-primary">Smooth curves</span>
            </label>
          </FieldGroup>
        </>
      );
    case 'pie':
    case 'donut':
      return (
        <>
          <FieldGroup label="Show Labels">
            <label htmlFor="dashb-f4" className="flex items-center gap-2 cursor-pointer">
              <input
                id="dashb-f4"
                type="checkbox"
                checked={chartConfig.showLabels !== false}
                onChange={(e) => updateConfig('showLabels', e.target.checked)}
                className="rounded border-zinc-600 bg-zinc-800 text-cba-gold focus:ring-[#FFCC00]/30"
              />
              <span className="text-sm text-primary">Show labels</span>
            </label>
          </FieldGroup>
          <FieldGroup label="Show Legend">
            <label htmlFor="dashb-f5" className="flex items-center gap-2 cursor-pointer">
              <input
                id="dashb-f5"
                type="checkbox"
                checked={chartConfig.showLegend !== false}
                onChange={(e) => updateConfig('showLegend', e.target.checked)}
                className="rounded border-zinc-600 bg-zinc-800 text-cba-gold focus:ring-[#FFCC00]/30"
              />
              <span className="text-sm text-primary">Show legend</span>
            </label>
          </FieldGroup>
          {chartType === 'donut' && (
            <FieldGroup label="Inner Radius">
              <input
                type="number"
                aria-label="Inner Radius"
                value={(chartConfig.innerRadius as number) ?? 60}
                onChange={(e) => updateConfig('innerRadius', Number(e.target.value))}
                className="config-input"
                min={0}
                max={120}
              />
            </FieldGroup>
          )}
        </>
      );
    case 'scatter':
      return (
        <>
          <FieldGroup label="X-Axis Key">
            <input
              type="text"
              value={(chartConfig.xKey as string) ?? ''}
              onChange={(e) => updateConfig('xKey', e.target.value)}
              className="config-input"
              placeholder="x"
            />
          </FieldGroup>
          <FieldGroup label="Y-Axis Key">
            <input
              type="text"
              value={(chartConfig.yKey as string) ?? ''}
              onChange={(e) => updateConfig('yKey', e.target.value)}
              className="config-input"
              placeholder="y"
            />
          </FieldGroup>
        </>
      );
    case 'kpi':
      return (
        <>
          <FieldGroup label="Metric Label">
            <input
              type="text"
              value={(chartConfig.metricLabel as string) ?? ''}
              onChange={(e) => updateConfig('metricLabel', e.target.value)}
              className="config-input"
              placeholder="Total Revenue"
            />
          </FieldGroup>
          <FieldGroup label="Format">
            <select
              aria-label="Format"
              value={(chartConfig.format as string) ?? 'currency'}
              onChange={(e) => updateConfig('format', e.target.value)}
              className="config-input"
            >
              <option value="currency">Currency (AUD)</option>
              <option value="number">Number</option>
              <option value="percent">Percentage</option>
            </select>
          </FieldGroup>
        </>
      );
    default:
      return (
        <p className="text-xs text-muted italic">
          No additional configuration for this chart type.
        </p>
      );
  }
}
