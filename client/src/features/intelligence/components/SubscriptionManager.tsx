import { useState, useEffect } from 'react';
import {
  Bell,
  Mail,
  Radio,
  Globe,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Edit3,
  X,
} from 'lucide-react';
import { intelligenceApi } from '../../../api';
import { cn } from '../../../lib/utils';

interface SubscriptionManagerProps {
  userId: string;
}

interface Subscription {
  id: string;
  userId: string;
  name: string;
  type: string;
  filterCriteria: Record<string, unknown>;
  channel: 'in_app' | 'email' | 'sse' | 'webhook';
  channelConfig: Record<string, unknown>;
  cooldownMinutes: number;
  isActive: boolean;
  createdAt: string;
}

const channelIcons: Record<string, typeof Bell> = {
  in_app: Bell,
  email: Mail,
  sse: Radio,
  webhook: Globe,
};

const channelLabels: Record<string, string> = {
  in_app: 'In-App',
  email: 'Email',
  sse: 'Real-Time SSE',
  webhook: 'Webhook',
};

export function SubscriptionManager({ userId }: SubscriptionManagerProps) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('insight');
  const [formChannel, setFormChannel] = useState<Subscription['channel']>('in_app');
  const [formCooldown, setFormCooldown] = useState(30);
  const [formSeverity, setFormSeverity] = useState('');
  const [formModule, setFormModule] = useState('');

  useEffect(() => {
    loadSubscriptions();
  }, [userId]);

  const loadSubscriptions = async () => {
    try {
      setLoading(true);
      const data = await intelligenceApi.listSubscriptions(userId);
      setSubscriptions(Array.isArray(data) ? data : (data.subscriptions ?? []));
      setError(null);
    } catch {
      setError('Failed to load subscriptions');
    } finally {
      setLoading(false);
    }
  };

  const createSubscription = async () => {
    if (!formName.trim()) return;
    try {
      const filterCriteria: Record<string, string> = {};
      if (formSeverity) filterCriteria.severity = formSeverity;
      if (formModule) filterCriteria.module = formModule;

      await intelligenceApi.subscribe({
        userId,
        name: formName,
        type: formType,
        filterCriteria,
        channel: formChannel,
        channelConfig: {},
        cooldownMinutes: formCooldown,
      });
      resetForm();
      loadSubscriptions();
    } catch {
      setError('Failed to create subscription');
    }
  };

  const deleteSubscription = async (id: string) => {
    try {
      await intelligenceApi.deleteSubscription(id);
      setSubscriptions((prev) => prev.filter((s) => s.id !== id));
    } catch {
      // ignore
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setFormName('');
    setFormType('insight');
    setFormChannel('in_app');
    setFormCooldown(30);
    setFormSeverity('');
    setFormModule('');
  };

  // Stats
  const activeSubs = subscriptions.filter((s) => s.isActive).length;
  const channelCounts = subscriptions.reduce<Record<string, number>>((acc, s) => {
    acc[s.channel] = (acc[s.channel] || 0) + 1;
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-[#FFCC00] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="neu-raised p-3 rounded-lg text-center">
          <p className="text-2xl font-bold text-[#FFCC00]">{subscriptions.length}</p>
          <p className="text-[10px] text-zinc-500 uppercase font-bold">Total</p>
        </div>
        <div className="neu-raised p-3 rounded-lg text-center">
          <p className="text-2xl font-bold text-emerald-400">{activeSubs}</p>
          <p className="text-[10px] text-zinc-500 uppercase font-bold">Active</p>
        </div>
        <div className="neu-raised p-3 rounded-lg text-center">
          <p className="text-2xl font-bold text-blue-400">{channelCounts['in_app'] ?? 0}</p>
          <p className="text-[10px] text-zinc-500 uppercase font-bold">In-App</p>
        </div>
        <div className="neu-raised p-3 rounded-lg text-center">
          <p className="text-2xl font-bold text-purple-400">{channelCounts['sse'] ?? 0}</p>
          <p className="text-[10px] text-zinc-500 uppercase font-bold">SSE</p>
        </div>
      </div>

      {/* Create Button */}
      <button
        onClick={() => setShowForm(!showForm)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#FFCC00] text-[#0a0a0f] font-bold text-sm hover:bg-[#FFCC00]/90 transition-colors"
      >
        <Plus className="w-4 h-4" />
        New Subscription
      </button>

      {/* Create Form */}
      {showForm && (
        <div className="neu-raised p-4 rounded-lg space-y-3 border border-[#FFCC00]/20">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-[#FFCC00]">Create Subscription</h4>
            <button onClick={resetForm} className="text-zinc-500 hover:text-zinc-300">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-500 font-medium block mb-1">Name</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Critical Alerts"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder:text-zinc-600"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 font-medium block mb-1">Type</label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300"
              >
                <option value="insight">Insight</option>
                <option value="anomaly">Anomaly</option>
                <option value="compliance">Compliance</option>
                <option value="forecast">Forecast</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-500 font-medium block mb-1">Channel</label>
              <select
                value={formChannel}
                onChange={(e) => setFormChannel(e.target.value as Subscription['channel'])}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300"
              >
                {Object.entries(channelLabels).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-500 font-medium block mb-1">Cooldown (min)</label>
              <input
                type="number"
                value={formCooldown}
                onChange={(e) => setFormCooldown(Number(e.target.value))}
                min={1}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 font-medium block mb-1">
                Severity Filter
              </label>
              <select
                value={formSeverity}
                onChange={(e) => setFormSeverity(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300"
              >
                <option value="">All</option>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-500 font-medium block mb-1">Module Filter</label>
              <select
                value={formModule}
                onChange={(e) => setFormModule(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300"
              >
                <option value="">All Modules</option>
                <option value="transactions">Transactions</option>
                <option value="tax">Tax</option>
                <option value="bas">BAS</option>
                <option value="knowledge">Knowledge</option>
                <option value="analytics">Analytics</option>
              </select>
            </div>
          </div>

          <button
            onClick={createSubscription}
            disabled={!formName.trim()}
            className="px-4 py-2 rounded-lg bg-[#FFCC00] text-[#0a0a0f] font-bold text-sm hover:bg-[#FFCC00]/90 transition-colors disabled:opacity-50"
          >
            Create
          </button>
        </div>
      )}

      {/* Subscription Cards */}
      {error && <div className="neu-raised p-4 rounded-lg text-red-400 text-center">{error}</div>}

      {subscriptions.length === 0 && !showForm ? (
        <div className="neu-raised p-8 rounded-lg text-center text-zinc-500">
          <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No subscriptions yet. Create one to get notified.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {subscriptions.map((sub) => {
            const ChannelIcon = channelIcons[sub.channel] || Bell;
            return (
              <div
                key={sub.id}
                className={cn(
                  'neu-raised p-4 rounded-lg border-l-4 transition-all',
                  sub.isActive ? 'border-[#FFCC00]' : 'border-zinc-700',
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'p-2 rounded-lg',
                        sub.isActive ? 'bg-[#FFCC00]/10' : 'bg-zinc-800',
                      )}
                    >
                      <ChannelIcon
                        className={cn('w-5 h-5', sub.isActive ? 'text-[#FFCC00]' : 'text-zinc-600')}
                      />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-zinc-200">{sub.name}</h4>
                      <p className="text-[10px] text-zinc-500 uppercase font-bold mt-0.5">
                        {sub.type} • {channelLabels[sub.channel]} • {sub.cooldownMinutes}m cooldown
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteSubscription(sub.id)}
                    className="text-zinc-600 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {sub.filterCriteria && Object.keys(sub.filterCriteria).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {Object.entries(sub.filterCriteria).map(([k, v]) => (
                      <span
                        key={k}
                        className="px-2 py-0.5 rounded-full text-[9px] bg-zinc-800 text-zinc-400 border border-zinc-700"
                      >
                        {k}: {String(v)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
