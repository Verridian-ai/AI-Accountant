import { useState, useEffect, useCallback } from 'react';
import { Plus, Star, Pencil, Trash2, LayoutGrid, Clock, X, Loader2 } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { BASE_URL, getAuthHeaders } from '../../../api';
import { CustomDashboard } from './CustomDashboard';
import type { DashboardLayout } from '../hooks/useDashboard';

const API_URL = `${BASE_URL}/api`;

export function DashboardGrid() {
  const [dashboards, setDashboards] = useState<DashboardLayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeDashboardId, setActiveDashboardId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchDashboards = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/dashboards?userId=default`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch dashboards');
      const data = await res.json();
      setDashboards(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboards');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboards();
  }, [fetchDashboards]);

  const handleCreate = async () => {
    if (!createName.trim()) return;
    try {
      setCreating(true);
      const res = await fetch(`${API_URL}/dashboards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          name: createName.trim(),
          description: createDescription.trim() || undefined,
          layout: { columns: 12, widgets: [] },
        }),
      });
      if (!res.ok) throw new Error('Failed to create dashboard');
      setShowCreateDialog(false);
      setCreateName('');
      setCreateDescription('');
      await fetchDashboards();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create dashboard');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/dashboards/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to delete dashboard');
      setDashboards((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete dashboard');
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      const target = dashboards.find((d) => d.id === id);
      if (!target) return;
      const res = await fetch(`${API_URL}/dashboards/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          name: target.name,
          description: target.description,
          isDefault: true,
          layout: target.layout,
        }),
      });
      if (!res.ok) throw new Error('Failed to set default');
      await fetchDashboards();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set default dashboard');
    }
  };

  // When a dashboard is selected, show it
  if (activeDashboardId) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setActiveDashboardId(null)}
          className="flex items-center gap-2 text-sm text-secondary hover:text-cba-gold transition-colors"
        >
          <LayoutGrid className="w-4 h-4" />
          <span>Back to Dashboards</span>
        </button>
        <CustomDashboard dashboardId={activeDashboardId} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gradient-gold">Custom Dashboards</h2>
          <p className="text-sm text-muted mt-1">
            Build and manage your personalised data views
          </p>
        </div>
        <button
          onClick={() => setShowCreateDialog(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-cba-gold text-base rounded-xl font-bold text-sm hover:bg-cba-gold-light transition-colors btn-press"
        >
          <Plus className="w-4 h-4" />
          New Dashboard
        </button>
      </div>

      {/* Error display */}
      {error && (
        <div className="neu-raised p-4 rounded-xl border border-red-500/30 text-red-400 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-300 hover:text-red-100">
            Dismiss
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-cba-gold animate-spin" />
        </div>
      )}

      {/* Dashboard Grid */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {dashboards.map((dash) => (
            <div
              key={dash.id}
              className="neu-raised rounded-2xl p-5 border border-border/50 hover:border-cba-gold/20 transition-all duration-300 group flex flex-col h-full"
            >
              <button
                type="button"
                onClick={() => setActiveDashboardId(dash.id)}
                className="w-full text-left focus:outline-none flex-1"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <LayoutGrid className="w-5 h-5 text-cba-gold" />
                    <h3 className="font-bold text-zinc-100 text-lg">{dash.name}</h3>
                  </div>
                  {dash.isDefault && (
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-cba-gold/10 rounded-full border border-cba-gold/30">
                      <Star className="w-3 h-3 text-cba-gold fill-[#FFCC00]" />
                      <span className="text-[10px] font-bold text-cba-gold uppercase">Default</span>
                    </div>
                  )}
                </div>

                {dash.description && (
                  <p className="text-sm text-secondary mb-3 line-clamp-2">{dash.description}</p>
                )}

                <div className="flex items-center justify-between text-xs text-muted">
                  <span className="flex items-center gap-1">
                    <LayoutGrid className="w-3 h-3" />
                    {dash.layout?.widgets?.length ?? 0} widgets
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(dash.updatedAt).toLocaleDateString('en-AU')}
                  </span>
                </div>
              </button>

              {/* Action buttons (stop propagation to prevent opening) */}
              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border/50 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveDashboardId(dash.id);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-primary hover:text-cba-gold neu-raised-sm rounded-lg transition-colors"
                >
                  <Pencil className="w-3 h-3" />
                  Edit
                </button>
                {!dash.isDefault && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSetDefault(dash.id);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-primary hover:text-cba-gold neu-raised-sm rounded-lg transition-colors"
                  >
                    <Star className="w-3 h-3" />
                    Set Default
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(dash.id);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-400 hover:text-red-300 neu-raised-sm rounded-lg transition-colors ml-auto"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete
                </button>
              </div>
            </div>
          ))}

          {/* Create New Card */}
          <button
            onClick={() => setShowCreateDialog(true)}
            className="neu-inset rounded-2xl p-5 border-2 border-dashed border-zinc-700 hover:border-cba-gold/40 transition-all duration-300 flex flex-col items-center justify-center min-h-[200px] group"
          >
            <div className="neu-raised p-4 rounded-2xl mb-3 group-hover:shadow-[0_0_20px_rgba(255,204,0,0.15)] transition-shadow">
              <Plus className="w-8 h-8 text-muted group-hover:text-cba-gold transition-colors" />
            </div>
            <span className="text-sm font-bold text-muted group-hover:text-primary transition-colors">
              Create New Dashboard
            </span>
          </button>
        </div>
      )}

      {/* Create Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            role="presentation"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowCreateDialog(false)}
            onKeyDown={() => { }}
          />
          <div className="relative neu-raised rounded-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-cba-gold/20">
              <h3 className="text-lg font-bold text-gradient-gold">Create Dashboard</h3>
              <button
                onClick={() => setShowCreateDialog(false)}
                aria-label="Close dialog"
                className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-overlay-hover transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label htmlFor="dashbo-f1" className="block text-xs font-bold text-secondary uppercase tracking-wider mb-1.5">
                  Name
                </label>
                <input id="dashbo-f1"
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="My Dashboard"
                  className="w-full px-3 py-2.5 rounded-xl neu-inset bg-transparent text-zinc-100 text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/50"
                />
              </div>
              <div>
                <label htmlFor="dashbo-f2" className="block text-xs font-bold text-secondary uppercase tracking-wider mb-1.5">
                  Description
                </label>
                <textarea id="dashbo-f2"
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  placeholder="Optional description..."
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl neu-inset bg-transparent text-zinc-100 text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/50 resize-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-5 border-t border-border/50">
              <button
                onClick={() => setShowCreateDialog(false)}
                className="px-4 py-2 text-sm font-bold text-secondary hover:text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!createName.trim() || creating}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors btn-press',
                  createName.trim()
                    ? 'bg-cba-gold text-base hover:bg-cba-gold-light'
                    : 'bg-zinc-700 text-muted cursor-not-allowed',
                )}
              >
                {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
