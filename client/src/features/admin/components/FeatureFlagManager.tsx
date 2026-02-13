import { useState, useEffect } from 'react';
import { fetchFeatureFlags, updateFeatureFlag, createFeatureFlag } from '../../../api';
import { Flag, Plus, X, Save, ToggleLeft, ToggleRight } from 'lucide-react';

interface FeatureFlag {
  name: string;
  enabled: boolean;
  description?: string;
  category?: string;
  rolloutPercentage?: number;
  createdAt?: string;
  updatedAt?: string;
}

export function FeatureFlagManager() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'general',
    rolloutPercentage: 100,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadFlags();
  }, []);

  const loadFlags = async () => {
    setLoading(true);
    try {
      const res = await fetchFeatureFlags();
      setFlags(Array.isArray(res) ? res : res?.flags || []);
    } catch {
      /* */
    }
    setLoading(false);
  };

  const toggleFlag = async (flag: FeatureFlag) => {
    try {
      await updateFeatureFlag(flag.name, { enabled: !flag.enabled });
      setFlags((prev) =>
        prev.map((f) => (f.name === flag.name ? { ...f, enabled: !f.enabled } : f)),
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Toggle failed');
    }
  };

  const updateRollout = async (flag: FeatureFlag, pct: number) => {
    try {
      await updateFeatureFlag(flag.name, { rolloutPercentage: pct });
      setFlags((prev) =>
        prev.map((f) => (f.name === flag.name ? { ...f, rolloutPercentage: pct } : f)),
      );
    } catch {
      /* */
    }
  };

  const handleCreate = async () => {
    if (!formData.name) return;
    setSaving(true);
    try {
      await createFeatureFlag({
        name: formData.name,
        description: formData.description,
        category: formData.category,
        rolloutPercentage: formData.rolloutPercentage,
        enabled: false,
      });
      setShowForm(false);
      setFormData({ name: '', description: '', category: 'general', rolloutPercentage: 100 });
      setMessage('Flag created');
      setTimeout(() => setMessage(''), 3000);
      loadFlags();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Create failed');
    }
    setSaving(false);
  };

  // Group by category
  const grouped = flags.reduce<Record<string, FeatureFlag[]>>((acc, f) => {
    const cat = f.category || 'general';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(f);
    return acc;
  }, {});

  const categoryColors: Record<string, string> = {
    general: 'text-zinc-400',
    ai: 'text-violet-400',
    ui: 'text-blue-400',
    system: 'text-emerald-400',
    experimental: 'text-red-400',
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-white">Feature Flags</h2>
        <div className="animate-pulse h-64 rounded-2xl bg-[#16213e]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Feature Flags</h2>
          <p className="text-sm text-zinc-500">Manage feature toggles and rollout percentages</p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-[#FFCC00] text-[#1a1a2e] font-bold rounded-lg text-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> New Flag
        </button>
      </div>

      {message && (
        <div
          className={`px-4 py-2 rounded-lg text-sm ${message.includes('failed') ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}
        >
          {message}
        </div>
      )}

      {/* Grouped Flags */}
      {Object.entries(grouped).map(([category, categoryFlags]) => (
        <div key={category} className="space-y-3">
          <h3
            className={`text-xs font-bold uppercase tracking-widest ${categoryColors[category] || 'text-zinc-400'}`}
          >
            {category}
          </h3>
          <div className="space-y-2">
            {categoryFlags.map((flag) => (
              <div
                key={flag.name}
                className="rounded-2xl bg-[#16213e] shadow-[6px_6px_12px_#0a0a1a,-6px_-6px_12px_#222244] p-5"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => toggleFlag(flag)}>
                      {flag.enabled ? (
                        <ToggleRight className="w-7 h-7 text-emerald-400" />
                      ) : (
                        <ToggleLeft className="w-7 h-7 text-zinc-500" />
                      )}
                    </button>
                    <div>
                      <p className="text-sm font-bold text-white">{flag.name}</p>
                      {flag.description && (
                        <p className="text-xs text-zinc-500">{flag.description}</p>
                      )}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${flag.enabled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-500/10 text-zinc-500'}`}
                  >
                    {flag.enabled ? 'ON' : 'OFF'}
                  </span>
                </div>
                {flag.enabled && (
                  <div className="mt-3 pl-10">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-zinc-500 w-12">Rollout</span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={flag.rolloutPercentage ?? 100}
                        onChange={(e) => updateRollout(flag, parseInt(e.target.value))}
                        className="flex-1 accent-[#FFCC00]"
                      />
                      <span className="text-xs text-[#FFCC00] font-bold w-10 text-right">
                        {flag.rolloutPercentage ?? 100}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {flags.length === 0 && (
        <div className="rounded-2xl bg-[#16213e] p-12 text-center">
          <Flag className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <p className="text-zinc-500">No feature flags configured</p>
        </div>
      )}

      {/* Create Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowForm(false)}
          />
          <div className="relative w-full max-w-md rounded-2xl bg-[#16213e] shadow-[6px_6px_12px_#0a0a1a,-6px_-6px_12px_#222244] p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">Create Feature Flag</h3>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Flag Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="feature_new_dashboard"
                  className="w-full px-3 py-2 bg-[#1a1a2e] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFCC00]/50"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-[#1a1a2e] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFCC00]/50"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 bg-[#1a1a2e] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFCC00]/50"
                >
                  <option value="general">General</option>
                  <option value="ai">AI</option>
                  <option value="ui">UI</option>
                  <option value="system">System</option>
                  <option value="experimental">Experimental</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  Rollout: {formData.rolloutPercentage}%
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={formData.rolloutPercentage}
                  onChange={(e) =>
                    setFormData({ ...formData, rolloutPercentage: parseInt(e.target.value) })
                  }
                  className="w-full accent-[#FFCC00]"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 py-2 rounded-lg border border-white/10 text-zinc-400 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={saving}
                className="flex-1 py-2 rounded-lg bg-[#FFCC00] text-[#1a1a2e] font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" /> {saving ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
