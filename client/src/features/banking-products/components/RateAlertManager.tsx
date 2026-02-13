import { useState, useEffect } from 'react';
import { Bell, BellOff, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchCdrAlerts, createCdrAlert, deleteCdrAlert } from '@/api';

interface CdrAlert {
  id: string;
  type: string;
  category: string;
  thresholdRate: number | null;
  productId: string | null;
  productName: string | null;
  isActive: boolean;
  createdAt: string;
  lastTriggered: string | null;
}

const ALERT_TYPES = ['rate_change', 'rate_below', 'rate_above', 'new_product'];
const CATEGORIES = ['HOME_LOAN', 'PERSONAL_LOAN', 'SAVINGS', 'TERM_DEPOSIT', 'CREDIT_CARD'];

export function RateAlertManager() {
  const [alerts, setAlerts] = useState<CdrAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Form state
  const [alertType, setAlertType] = useState('rate_below');
  const [alertCategory, setAlertCategory] = useState('HOME_LOAN');
  const [thresholdRate, setThresholdRate] = useState(5.0);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const result = await fetchCdrAlerts();
      setAlerts(result.alerts ?? result ?? []);
    } catch (e) {
      console.error('Failed to load alerts', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    setCreating(true);
    try {
      await createCdrAlert({
        type: alertType,
        category: alertCategory,
        thresholdRate: thresholdRate / 100,
      });
      setShowForm(false);
      load();
    } catch (e) {
      console.error('Failed to create alert', e);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await deleteCdrAlert(id);
      setAlerts(prev => prev.filter(a => a.id !== id));
    } catch (e) {
      console.error('Failed to delete alert', e);
    } finally {
      setDeleting(null);
    }
  };

  const formatRate = (rate: number | null) =>
    rate != null ? `${(rate * 100).toFixed(2)}%` : 'N/A';

  const typeLabel = (type: string) => {
    switch (type) {
      case 'rate_change': return 'Rate Change';
      case 'rate_below': return 'Rate Below';
      case 'rate_above': return 'Rate Above';
      case 'new_product': return 'New Product';
      default: return type;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-zinc-500">
            {alerts.filter(a => a.isActive).length} active alert{alerts.filter(a => a.isActive).length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all",
            showForm
              ? "neu-raised-sm text-zinc-400"
              : "bg-[#FFCC00] text-[#0a0a0f] hover:bg-[#FFD633]"
          )}
        >
          <Plus className="h-4 w-4" />
          {showForm ? 'Cancel' : 'New Alert'}
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="neu-raised rounded-2xl p-5 space-y-4 border border-[#FFCC00]/20">
          <h3 className="text-sm font-bold text-zinc-300">Create Rate Alert</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-zinc-500 font-semibold block mb-1">Alert Type</label>
              <select
                value={alertType}
                onChange={(e) => setAlertType(e.target.value)}
                className="w-full neu-inset rounded-lg px-3 py-2 text-sm text-zinc-100 bg-transparent focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
              >
                {ALERT_TYPES.map(t => (
                  <option key={t} value={t} className="bg-[#23272f]">{typeLabel(t)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-500 font-semibold block mb-1">Category</label>
              <select
                value={alertCategory}
                onChange={(e) => setAlertCategory(e.target.value)}
                className="w-full neu-inset rounded-lg px-3 py-2 text-sm text-zinc-100 bg-transparent focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
              >
                {CATEGORIES.map(c => (
                  <option key={c} value={c} className="bg-[#23272f]">{c.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-500 font-semibold block mb-1">Threshold Rate (%)</label>
              <input
                type="number"
                step="0.01"
                value={thresholdRate}
                onChange={(e) => setThresholdRate(Number(e.target.value))}
                className="w-full neu-inset rounded-lg px-3 py-2 text-sm text-zinc-100 bg-transparent focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
              />
            </div>
          </div>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="px-4 py-2 rounded-xl bg-[#FFCC00] text-[#0a0a0f] text-sm font-bold hover:bg-[#FFD633] transition-colors disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create Alert'}
          </button>
        </div>
      )}

      {/* Alert List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="neu-raised rounded-2xl p-5 animate-pulse h-20" />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <div className="neu-raised rounded-2xl p-12 text-center">
          <BellOff className="h-8 w-8 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-500">No alerts configured</p>
          <p className="text-xs text-zinc-600 mt-1">Create an alert to be notified of rate changes</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map(alert => (
            <div
              key={alert.id}
              className={cn(
                "neu-raised rounded-2xl p-4 flex items-center gap-4 transition-opacity",
                !alert.isActive && "opacity-50"
              )}
            >
              <div className={cn(
                "neu-inset p-2 rounded-xl",
                alert.isActive ? "text-[#FFCC00]" : "text-zinc-600"
              )}>
                <Bell className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-zinc-100">{typeLabel(alert.type)}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full neu-inset text-zinc-400 font-semibold">
                    {alert.category.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                  {alert.thresholdRate != null && (
                    <span>Threshold: {formatRate(alert.thresholdRate)}</span>
                  )}
                  {alert.productName && <span>Product: {alert.productName}</span>}
                  <span>Created: {new Date(alert.createdAt).toLocaleDateString('en-AU')}</span>
                  {alert.lastTriggered && (
                    <span className="text-amber-400">
                      <AlertTriangle className="inline h-3 w-3 mr-1" />
                      Triggered: {new Date(alert.lastTriggered).toLocaleDateString('en-AU')}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleDelete(alert.id)}
                disabled={deleting === alert.id}
                className="shrink-0 p-2 rounded-lg text-zinc-500 hover:text-red-400 transition-colors disabled:opacity-50"
              >
                <Trash2 className={cn("h-4 w-4", deleting === alert.id && "animate-pulse")} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
