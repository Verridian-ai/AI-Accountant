import { useState, useEffect } from 'react';
import { fetchAgentConfigs, updateAgentConfig } from '../../../api';
import { Settings, Save, X, Bot, ToggleLeft, ToggleRight } from 'lucide-react';

interface AgentConfig {
  agentType: string;
  model: string;
  maxTokens: number;
  temperature: number;
  rateLimitPerMinute: number;
  enabled: boolean;
  description?: string;
}

export function AgentConfigManager() {
  const [configs, setConfigs] = useState<AgentConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingAgent, setEditingAgent] = useState<AgentConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    setLoading(true);
    try {
      const res = await fetchAgentConfigs();
      setConfigs(Array.isArray(res) ? res : res.configurations || []);
    } catch {
      /* */
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!editingAgent) return;
    setSaving(true);
    setMessage('');
    try {
      await updateAgentConfig(editingAgent.agentType, {
        model: editingAgent.model,
        maxTokens: editingAgent.maxTokens,
        temperature: editingAgent.temperature,
        rateLimitPerMinute: editingAgent.rateLimitPerMinute,
        enabled: editingAgent.enabled,
      });
      setConfigs((prev) =>
        prev.map((c) => (c.agentType === editingAgent.agentType ? editingAgent : c)),
      );
      setEditingAgent(null);
      setMessage('Configuration saved');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Save failed');
    }
    setSaving(false);
  };

  const toggleEnabled = async (agent: AgentConfig) => {
    try {
      await updateAgentConfig(agent.agentType, { enabled: !agent.enabled });
      setConfigs((prev) =>
        prev.map((c) => (c.agentType === agent.agentType ? { ...c, enabled: !c.enabled } : c)),
      );
    } catch {
      /* */
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-white">Agent Configuration</h2>
        <div className="animate-pulse h-64 rounded-2xl bg-[#16213e]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Agent Configuration</h2>
        <p className="text-sm text-zinc-500">Configure AI agent models, tokens, and rate limits</p>
      </div>

      {message && (
        <div
          className={`px-4 py-2 rounded-lg text-sm ${message.includes('saved') ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}
        >
          {message}
        </div>
      )}

      {/* Config Table */}
      <div className="rounded-2xl bg-[#16213e] shadow-[6px_6px_12px_#0a0a1a,-6px_-6px_12px_#222244] p-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-500 text-xs uppercase tracking-wider border-b border-white/5">
              <th className="pb-3 pr-4">Agent</th>
              <th className="pb-3 pr-4">Model</th>
              <th className="pb-3 pr-4">Max Tokens</th>
              <th className="pb-3 pr-4">Temperature</th>
              <th className="pb-3 pr-4">Rate Limit</th>
              <th className="pb-3 pr-4">Enabled</th>
              <th className="pb-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {configs.map((c) => (
              <tr key={c.agentType} className="border-b border-white/5 hover:bg-[#1a1a2e]/50">
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-[#FFCC00]" />
                    <span className="text-zinc-300 font-medium">
                      {c.agentType.replace(/_/g, ' ')}
                    </span>
                  </div>
                </td>
                <td className="py-3 pr-4 text-zinc-400 text-xs font-mono">{c.model}</td>
                <td className="py-3 pr-4 text-zinc-400">{c.maxTokens?.toLocaleString()}</td>
                <td className="py-3 pr-4 text-zinc-400">{c.temperature}</td>
                <td className="py-3 pr-4 text-zinc-400">{c.rateLimitPerMinute}/min</td>
                <td className="py-3 pr-4">
                  <button
                    type="button"
                    onClick={() => toggleEnabled(c)}
                    className="focus:outline-none"
                  >
                    {c.enabled ? (
                      <ToggleRight className="w-6 h-6 text-emerald-400" />
                    ) : (
                      <ToggleLeft className="w-6 h-6 text-zinc-500" />
                    )}
                  </button>
                </td>
                <td className="py-3">
                  <button
                    type="button"
                    onClick={() => setEditingAgent({ ...c })}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-[#FFCC00] hover:bg-[#FFCC00]/5 transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {configs.length === 0 && (
          <p className="text-sm text-zinc-500 mt-4">No agent configurations found</p>
        )}
      </div>

      {/* Edit Modal */}
      {editingAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setEditingAgent(null)}
          />
          <div className="relative w-full max-w-md rounded-2xl bg-[#16213e] shadow-[6px_6px_12px_#0a0a1a,-6px_-6px_12px_#222244] p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">
                Edit {editingAgent.agentType.replace(/_/g, ' ')}
              </h3>
              <button
                type="button"
                onClick={() => setEditingAgent(null)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Model</label>
                <input
                  type="text"
                  value={editingAgent.model}
                  onChange={(e) => setEditingAgent({ ...editingAgent, model: e.target.value })}
                  className="w-full px-3 py-2 bg-[#1a1a2e] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFCC00]/50"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  Max Tokens: {editingAgent.maxTokens}
                </label>
                <input
                  type="range"
                  min={256}
                  max={16384}
                  step={256}
                  value={editingAgent.maxTokens}
                  onChange={(e) =>
                    setEditingAgent({ ...editingAgent, maxTokens: parseInt(e.target.value) })
                  }
                  className="w-full accent-[#FFCC00]"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  Temperature: {editingAgent.temperature}
                </label>
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.1}
                  value={editingAgent.temperature}
                  onChange={(e) =>
                    setEditingAgent({ ...editingAgent, temperature: parseFloat(e.target.value) })
                  }
                  className="w-full accent-[#FFCC00]"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Rate Limit (per minute)</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={editingAgent.rateLimitPerMinute}
                  onChange={(e) =>
                    setEditingAgent({
                      ...editingAgent,
                      rateLimitPerMinute: parseInt(e.target.value) || 10,
                    })
                  }
                  className="w-full px-3 py-2 bg-[#1a1a2e] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFCC00]/50"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-xs text-zinc-400">Enabled</label>
                <button
                  type="button"
                  onClick={() =>
                    setEditingAgent({ ...editingAgent, enabled: !editingAgent.enabled })
                  }
                >
                  {editingAgent.enabled ? (
                    <ToggleRight className="w-6 h-6 text-emerald-400" />
                  ) : (
                    <ToggleLeft className="w-6 h-6 text-zinc-500" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                type="button"
                onClick={() => setEditingAgent(null)}
                className="flex-1 py-2 rounded-lg border border-white/10 text-zinc-400 hover:text-white text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2 rounded-lg bg-[#FFCC00] text-[#1a1a2e] font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
