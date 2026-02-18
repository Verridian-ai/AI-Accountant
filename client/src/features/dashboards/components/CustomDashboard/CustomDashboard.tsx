import React, { useState, useCallback, useEffect } from 'react';
import { Pencil, Save, Plus, X, Settings2, Loader2 } from 'lucide-react';
import { cn } from '../../../../lib/utils';
import { useDashboard } from '../../hooks/useDashboard';
import type { WidgetConfig } from '../../hooks/useDashboard';
import { WidgetPicker } from '../WidgetPicker';
import { WidgetConfigPanel } from '../WidgetConfigPanel';
import { BASE_URL, getAuthHeaders } from '../../../../api';
import { renderWidget } from './widgetRenderer';
import type { CustomDashboardProps } from './types';

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
      const maxRow = widgets.reduce(
        (max, w) => Math.max(max, w.position.row + w.position.height),
        0,
      );
      const positioned = {
        ...widget,
        position: { ...widget.position, row: maxRow, col: 0 },
      };
      addWidget(positioned);
    },
    [widgets, addWidget],
  );

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
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(12, 1fr)' }}>
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
              <div className="p-3">{renderWidget(widget, widgetData)}</div>
            </div>
          ))}
        </div>
      )}

      <WidgetPicker
        open={showPicker}
        onClose={() => setShowPicker(false)}
        onSelect={handleAddWidget}
      />
      <WidgetConfigPanel
        widget={configWidget}
        open={configWidget !== null}
        onClose={() => setConfigWidget(null)}
        onSave={(widgetId, updates) => updateWidgetConfig(widgetId, updates)}
      />
    </div>
  );
}
