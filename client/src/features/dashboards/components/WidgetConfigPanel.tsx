import React, { useState, useEffect } from 'react';
import { X, Save, RotateCcw } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { WidgetConfig } from '../hooks/useDashboard';

interface WidgetConfigPanelProps {
  widget: WidgetConfig | null;
  open: boolean;
  onClose: () => void;
  onSave: (widgetId: string, updates: Partial<WidgetConfig>) => void;
}

export function WidgetConfigPanel({ widget, open, onClose, onSave }: WidgetConfigPanelProps) {
  const [title, setTitle] = useState('');
  const [dataSourceUrl, setDataSourceUrl] = useState('');
  const [refreshInterval, setRefreshInterval] = useState(0);
  const [chartConfig, setChartConfig] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (widget) {
      setTitle(widget.title);
      setDataSourceUrl(widget.dataSourceUrl ?? '');
      setRefreshInterval(widget.refreshInterval ?? 0);
      setChartConfig(widget.config ?? {});
    }
  }, [widget]);

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
      setTitle(widget.title);
      setDataSourceUrl(widget.dataSourceUrl ?? '');
      setRefreshInterval(widget.refreshInterval ?? 0);
      setChartConfig(widget.config ?? {});
    }
  };

  const updateConfig = (key: string, value: unknown) => {
    setChartConfig(prev => ({ ...prev, [key]: value }));
  };

  const renderChartSpecificFields = () => {
    switch (widget.chartType) {
      case 'bar':
        return (
          <>
            <FieldGroup label="Data Keys (comma-separated)">
              <input
                type="text"
                value={Array.isArray(chartConfig.dataKeys) ? (chartConfig.dataKeys as string[]).join(', ') : ''}
                onChange={(e) => updateConfig('dataKeys', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
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
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(chartConfig.stacked)}
                  onChange={(e) => updateConfig('stacked', e.target.checked)}
                  className="rounded border-zinc-600 bg-zinc-800 text-[#FFCC00] focus:ring-[#FFCC00]/30"
                />
                <span className="text-sm text-zinc-300">Enable stacking</span>
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
                onChange={(e) => updateConfig('dataKeys', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
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
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(chartConfig.showArea)}
                  onChange={(e) => updateConfig('showArea', e.target.checked)}
                  className="rounded border-zinc-600 bg-zinc-800 text-[#FFCC00] focus:ring-[#FFCC00]/30"
                />
                <span className="text-sm text-zinc-300">Fill area under line</span>
              </label>
            </FieldGroup>
            <FieldGroup label="Curved">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={chartConfig.curved !== false}
                  onChange={(e) => updateConfig('curved', e.target.checked)}
                  className="rounded border-zinc-600 bg-zinc-800 text-[#FFCC00] focus:ring-[#FFCC00]/30"
                />
                <span className="text-sm text-zinc-300">Smooth curves</span>
              </label>
            </FieldGroup>
          </>
        );
      case 'pie':
      case 'donut':
        return (
          <>
            <FieldGroup label="Show Labels">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={chartConfig.showLabels !== false}
                  onChange={(e) => updateConfig('showLabels', e.target.checked)}
                  className="rounded border-zinc-600 bg-zinc-800 text-[#FFCC00] focus:ring-[#FFCC00]/30"
                />
                <span className="text-sm text-zinc-300">Show labels</span>
              </label>
            </FieldGroup>
            <FieldGroup label="Show Legend">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={chartConfig.showLegend !== false}
                  onChange={(e) => updateConfig('showLegend', e.target.checked)}
                  className="rounded border-zinc-600 bg-zinc-800 text-[#FFCC00] focus:ring-[#FFCC00]/30"
                />
                <span className="text-sm text-zinc-300">Show legend</span>
              </label>
            </FieldGroup>
            {widget.chartType === 'donut' && (
              <FieldGroup label="Inner Radius">
                <input
                  type="number"
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
          <p className="text-xs text-zinc-500 italic">
            No additional configuration for this chart type.
          </p>
        );
    }
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />

      {/* Slide-in Panel */}
      <div className="fixed top-0 right-0 bottom-0 w-full max-w-sm z-50 neu-raised border-l border-[#FFCC00]/10 flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#FFCC00]/20 shrink-0">
          <h3 className="text-lg font-bold text-gradient-gold">Widget Settings</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
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
              onChange={(e) => setTitle(e.target.value)}
              className="config-input"
              placeholder="Widget title"
            />
          </FieldGroup>

          <FieldGroup label="Data Source URL">
            <input
              type="text"
              value={dataSourceUrl}
              onChange={(e) => setDataSourceUrl(e.target.value)}
              className="config-input"
              placeholder="/api/transactions?limit=100"
            />
          </FieldGroup>

          <FieldGroup label="Refresh Interval (seconds)">
            <input
              type="number"
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="config-input"
              min={0}
              step={10}
              placeholder="0 = manual only"
            />
          </FieldGroup>

          {/* Divider */}
          <div className="border-t border-white/5 pt-4">
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">
              Chart Settings ({widget.chartType})
            </h4>
            {renderChartSpecificFields()}
          </div>

          {/* Widget size */}
          <div className="border-t border-white/5 pt-4">
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">
              Size (grid units)
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <FieldGroup label="Width">
                <input
                  type="number"
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
        <div className="flex items-center justify-between p-5 border-t border-white/5 shrink-0">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-bold text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-[#FFCC00] text-[#0a0a0f] hover:bg-[#FFE066] transition-colors btn-press"
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
      <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}
