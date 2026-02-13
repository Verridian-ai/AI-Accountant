import { useState, useEffect, useCallback } from 'react';
import { Bell, Plus, Trash2, ToggleLeft, ToggleRight, Loader2, AlertCircle } from 'lucide-react';
import { fetchMarketAlerts, createMarketAlert } from '../../../api';

interface MarketAlert {
  id: string;
  userId: string;
  type: 'indicator' | 'price' | 'sentiment';
  target: string;
  condition: 'above' | 'below' | 'equals' | 'changes';
  threshold?: number;
  isActive: boolean;
  lastTriggered?: string;
  createdAt: string;
  description?: string;
}

type AlertType = 'indicator' | 'price' | 'sentiment';
type AlertCondition = 'above' | 'below' | 'equals' | 'changes';

const ALERT_TYPES: { id: AlertType; label: string }[] = [
  { id: 'indicator', label: 'Economic Indicator' },
  { id: 'price', label: 'Price Level' },
  { id: 'sentiment', label: 'Sentiment Change' },
];

const CONDITIONS: { id: AlertCondition; label: string }[] = [
  { id: 'above', label: 'Goes Above' },
  { id: 'below', label: 'Falls Below' },
  { id: 'equals', label: 'Equals' },
  { id: 'changes', label: 'Changes' },
];

export function MarketAlerts() {
  const [alerts, setAlerts] = useState<MarketAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form state
  const [formType, setFormType] = useState<AlertType>('indicator');
  const [formTarget, setFormTarget] = useState('');
  const [formCondition, setFormCondition] = useState<AlertCondition>('above');
  const [formThreshold, setFormThreshold] = useState('');

  const loadAlerts = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const data = await fetchMarketAlerts();
      const items = Array.isArray(data) ? data : (data as { alerts: MarketAlert[] }).alerts || [];
      setAlerts(items);
    } catch {
      // Fallback
      setAlerts([
        {
          id: '1',
          userId: 'default',
          type: 'indicator',
          target: 'RBA Cash Rate',
          condition: 'changes',
          isActive: true,
          createdAt: new Date().toISOString(),
          description: 'Alert when RBA cash rate changes',
        },
        {
          id: '2',
          userId: 'default',
          type: 'price',
          target: 'ASX:CBA',
          condition: 'above',
          threshold: 140,
          isActive: true,
          createdAt: new Date().toISOString(),
          description: 'CBA share price above $140',
        },
        {
          id: '3',
          userId: 'default',
          type: 'sentiment',
          target: 'Property Market',
          condition: 'changes',
          isActive: false,
          lastTriggered: new Date(Date.now() - 86400000 * 3).toISOString(),
          createdAt: new Date(Date.now() - 86400000 * 14).toISOString(),
          description: 'Property market sentiment shift detected',
        },
      ]);
      setError('Using sample alerts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const handleCreate = useCallback(async () => {
    if (!formTarget.trim()) return;
    setCreating(true);
    try {
      const newAlert = {
        type: formType,
        target: formTarget,
        condition: formCondition,
        threshold: formThreshold ? Number(formThreshold) : undefined,
        isActive: true,
      };
      const result = await createMarketAlert(newAlert);
      const created: MarketAlert = (result as MarketAlert).id
        ? (result as MarketAlert)
        : {
            id: Date.now().toString(),
            userId: 'default',
            ...newAlert,
            createdAt: new Date().toISOString(),
            description: `${formTarget} ${formCondition}${formThreshold ? ` ${formThreshold}` : ''}`,
          };
      setAlerts(prev => [created, ...prev]);
      setFormTarget('');
      setFormThreshold('');
      setShowForm(false);
    } catch {
      // Add locally anyway
      setAlerts(prev => [{
        id: Date.now().toString(),
        userId: 'default',
        type: formType,
        target: formTarget,
        condition: formCondition,
        threshold: formThreshold ? Number(formThreshold) : undefined,
        isActive: true,
        createdAt: new Date().toISOString(),
        description: `${formTarget} ${formCondition}${formThreshold ? ` ${formThreshold}` : ''}`,
      }, ...prev]);
      setFormTarget('');
      setFormThreshold('');
      setShowForm(false);
    } finally {
      setCreating(false);
    }
  }, [formType, formTarget, formCondition, formThreshold]);

  const toggleAlert = useCallback((id: string) => {
    setAlerts(prev =>
      prev.map(a => a.id === id ? { ...a, isActive: !a.isActive } : a)
    );
  }, []);

  const deleteAlert = useCallback((id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  }, []);

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'indicator': return 'bg-blue-500/10 text-blue-400';
      case 'price': return 'bg-emerald-500/10 text-emerald-400';
      case 'sentiment': return 'bg-purple-500/10 text-purple-400';
      default: return 'bg-zinc-500/10 text-zinc-400';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-[#FFCC00]" />
          <span className="text-sm font-bold text-white">
            {alerts.filter(a => a.isActive).length} Active Alerts
          </span>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="neu-raised-sm px-3 py-1.5 rounded-lg text-xs font-bold text-[#FFCC00] hover:bg-[#FFCC00]/10 transition-all flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          New Alert
        </button>
      </div>

      {error && (
        <div className="text-xs text-amber-400 neu-inset px-3 py-2 rounded-lg">{error}</div>
      )}

      {/* Create Form */}
      {showForm && (
        <div className="neu-raised rounded-2xl p-4 space-y-4 border border-[#FFCC00]/10">
          <h3 className="text-sm font-bold text-white">Create Alert</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-500 font-medium block mb-1">Alert Type</label>
              <div className="flex gap-1">
                {ALERT_TYPES.map((at) => (
                  <button
                    key={at.id}
                    onClick={() => setFormType(at.id)}
                    className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      formType === at.id
                        ? 'bg-[#FFCC00]/20 text-[#FFCC00] ring-1 ring-[#FFCC00]/30'
                        : 'text-zinc-500 hover:text-zinc-300 neu-raised-sm'
                    }`}
                  >
                    {at.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-zinc-500 font-medium block mb-1">Target</label>
              <input
                type="text"
                placeholder={formType === 'indicator' ? 'e.g., Cash Rate, CPI' : formType === 'price' ? 'e.g., ASX:CBA, BTC-AUD' : 'e.g., Property Market'}
                value={formTarget}
                onChange={(e) => setFormTarget(e.target.value)}
                className="w-full neu-inset px-3 py-1.5 rounded-lg text-xs text-white bg-transparent focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
              />
            </div>

            <div>
              <label className="text-xs text-zinc-500 font-medium block mb-1">Condition</label>
              <div className="flex gap-1">
                {CONDITIONS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setFormCondition(c.id)}
                    className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                      formCondition === c.id
                        ? 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30'
                        : 'text-zinc-500 hover:text-zinc-300 neu-raised-sm'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {formCondition !== 'changes' && (
              <div>
                <label className="text-xs text-zinc-500 font-medium block mb-1">Threshold</label>
                <input
                  type="number"
                  step="any"
                  placeholder="Value"
                  value={formThreshold}
                  onChange={(e) => setFormThreshold(e.target.value)}
                  className="w-full neu-inset px-3 py-1.5 rounded-lg text-xs text-white bg-transparent focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
                />
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-1.5 rounded-lg text-xs font-bold text-zinc-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || !formTarget.trim()}
              className="neu-raised-sm px-4 py-1.5 rounded-lg text-xs font-bold text-[#FFCC00] hover:bg-[#FFCC00]/10 disabled:opacity-50 transition-all flex items-center gap-1.5"
            >
              {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              Create
            </button>
          </div>
        </div>
      )}

      {/* Alerts List */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="neu-raised rounded-xl p-4 animate-pulse">
              <div className="flex gap-3">
                <div className="h-8 w-8 bg-zinc-700 rounded-lg" />
                <div className="flex-1">
                  <div className="h-4 w-32 bg-zinc-700 rounded mb-2" />
                  <div className="h-3 w-48 bg-zinc-700 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <div className="neu-raised rounded-2xl p-8 text-center">
          <Bell className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
          <p className="text-sm text-zinc-500">No alerts configured</p>
          <p className="text-xs text-zinc-600 mt-1">Create alerts to track market conditions</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`neu-raised rounded-xl p-4 flex items-center gap-4 transition-all border border-transparent ${
                alert.isActive ? 'hover:border-[#FFCC00]/10' : 'opacity-60'
              }`}
            >
              <div className={`p-2 rounded-lg ${getTypeColor(alert.type)}`}>
                {alert.type === 'indicator' ? <AlertCircle className="w-4 h-4" /> :
                 alert.type === 'price' ? <Bell className="w-4 h-4" /> :
                 <AlertCircle className="w-4 h-4" />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-white truncate">{alert.target}</h4>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${getTypeColor(alert.type)}`}>
                    {alert.type}
                  </span>
                </div>
                <p className="text-xs text-zinc-500">
                  {alert.condition === 'changes' ? 'Notify on any change' :
                   `${alert.condition} ${alert.threshold ?? ''}`}
                  {alert.description ? ` - ${alert.description}` : ''}
                </p>
                {alert.lastTriggered && (
                  <p className="text-[10px] text-zinc-600 mt-0.5">
                    Last triggered: {new Date(alert.lastTriggered).toLocaleDateString('en-AU')}
                  </p>
                )}
              </div>

              <button
                onClick={() => toggleAlert(alert.id)}
                className="text-zinc-400 hover:text-[#FFCC00] transition-colors shrink-0"
                title={alert.isActive ? 'Disable alert' : 'Enable alert'}
              >
                {alert.isActive ? (
                  <ToggleRight className="w-6 h-6 text-[#FFCC00]" />
                ) : (
                  <ToggleLeft className="w-6 h-6" />
                )}
              </button>

              <button
                onClick={() => deleteAlert(alert.id)}
                className="text-zinc-500 hover:text-red-400 transition-colors shrink-0"
                title="Delete alert"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
