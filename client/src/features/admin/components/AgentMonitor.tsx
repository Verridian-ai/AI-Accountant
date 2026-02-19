import { useState, useEffect } from 'react';
import { fetchAgentStats, fetchAgentExecutions } from '../../../api';
import { Bot, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react';

interface AgentStat {
  agentType: string;
  totalExecutions: number;
  successCount: number;
  failureCount: number;
  avgDurationMs: number;
  totalTokens: number;
  totalCostCents: number;
}

interface Execution {
  id: string;
  agentType: string;
  status: string;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  createdAt: string;
  error?: string;
}

type AgentMonitorStats = {
  totalExecutions: number;
  successRate: number;
  avgDuration: number;
  agentBreakdown: AgentStat[];
};

export function AgentMonitor() {
  const [fetchState, setFetchState] = useState<{
    stats: AgentMonitorStats | null;
    executions: Execution[];
    loading: boolean;
  }>({ stats: null, executions: [], loading: true });
  const { stats, executions, loading } = fetchState;
  const [page, setPage] = useState(0);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [s, e] = await Promise.all([
        fetchAgentStats(),
        fetchAgentExecutions({ limit: '20', offset: '0' }),
      ]);
      setFetchState({
        stats: s as AgentMonitorStats,
        executions: Array.isArray(e) ? e : (e as { executions: Execution[] }).executions ?? [],
        loading: false,
      });
    } catch {
      setFetchState((s) => ({ ...s, loading: false }));
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadMore = async () => {
    const nextPage = page + 1;
    try {
      const params: Record<string, string> = { limit: '20', offset: String(nextPage * 20) };
      if (selectedAgent) params.agentType = selectedAgent;
      const e = await fetchAgentExecutions(params);
      const list = Array.isArray(e) ? e : (e as { executions: Execution[] }).executions ?? [];
      setFetchState((prev) => ({ ...prev, executions: [...prev.executions, ...list] }));
      setPage(nextPage);
    } catch {
      /* */
    }
  };

  const filterByAgent = async (agent: string | null) => {
    setSelectedAgent(agent);
    setPage(0);
    try {
      const params: Record<string, string> = { limit: '20', offset: '0' };
      if (agent) params.agentType = agent;
      const e = await fetchAgentExecutions(params);
      setFetchState((prev) => ({
        ...prev,
        executions: Array.isArray(e) ? e : (e as { executions: Execution[] }).executions ?? [],
      }));
    } catch {
      /* */
    }
  };

  const successRate = (s: AgentStat) =>
    s.totalExecutions > 0 ? ((s.successCount / s.totalExecutions) * 100).toFixed(1) : '0.0';
  const rateColor = (rate: number) =>
    rate >= 90 ? 'text-emerald-400' : rate >= 70 ? 'text-yellow-400' : 'text-red-400';

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-white">Agent Monitor</h2>
        <div className="animate-pulse h-64 rounded-2xl bg-[#16213e]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Agent Monitor</h2>
          <p className="text-sm text-zinc-500">AI agent execution tracking and performance</p>
        </div>
        <button
          type="button"
          onClick={() => { setFetchState((s) => ({ ...s, loading: true })); void loadData(); }}
          className="p-2 rounded-xl bg-[#16213e] text-zinc-400 hover:text-[#FFCC00] transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-[#16213e] shadow-[6px_6px_12px_#0a0a1a,-6px_-6px_12px_#222244] p-5">
          <p className="text-xs text-zinc-500 uppercase tracking-wider">Total Executions</p>
          <p className="text-3xl font-bold text-white mt-1">{stats?.totalExecutions ?? 0}</p>
        </div>
        <div className="rounded-2xl bg-[#16213e] shadow-[6px_6px_12px_#0a0a1a,-6px_-6px_12px_#222244] p-5">
          <p className="text-xs text-zinc-500 uppercase tracking-wider">Success Rate</p>
          <p className={`text-3xl font-bold mt-1 ${rateColor(stats?.successRate ?? 0)}`}>
            {(stats?.successRate ?? 0).toFixed(1)}%
          </p>
        </div>
        <div className="rounded-2xl bg-[#16213e] shadow-[6px_6px_12px_#0a0a1a,-6px_-6px_12px_#222244] p-5">
          <p className="text-xs text-zinc-500 uppercase tracking-wider">Avg Duration</p>
          <p className="text-3xl font-bold text-white mt-1">
            {((stats?.avgDuration ?? 0) / 1000).toFixed(1)}s
          </p>
        </div>
      </div>

      {/* Agent Breakdown Table */}
      {stats?.agentBreakdown && stats.agentBreakdown.length > 0 && (
        <div className="rounded-2xl bg-[#16213e] shadow-[6px_6px_12px_#0a0a1a,-6px_-6px_12px_#222244] p-6">
          <h3 className="text-lg font-bold text-white mb-4">Agent Breakdown</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-500 text-xs uppercase tracking-wider border-b border-white/5">
                  <th className="pb-3 pr-4">Agent</th>
                  <th className="pb-3 pr-4">Runs</th>
                  <th className="pb-3 pr-4">Success</th>
                  <th className="pb-3 pr-4">Rate</th>
                  <th className="pb-3 pr-4">Avg Time</th>
                  <th className="pb-3">Cost</th>
                </tr>
              </thead>
              <tbody>
                {stats.agentBreakdown.map((a) => {
                  const rate = parseFloat(successRate(a));
                  return (
                    <tr
                      key={a.agentType}
                      className="border-b border-white/5 hover:bg-[#1a1a2e]/50 cursor-pointer"
                      onClick={() =>
                        filterByAgent(selectedAgent === a.agentType ? null : a.agentType)
                      }
                    >
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <Bot className="w-4 h-4 text-[#FFCC00]" />
                          <span
                            className={`font-medium ${selectedAgent === a.agentType ? 'text-[#FFCC00]' : 'text-zinc-300'}`}
                          >
                            {a.agentType.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-zinc-400">{a.totalExecutions}</td>
                      <td className="py-3 pr-4 text-emerald-400">{a.successCount}</td>
                      <td className={`py-3 pr-4 font-bold ${rateColor(rate)}`}>{rate}%</td>
                      <td className="py-3 pr-4 text-zinc-400">
                        {(a.avgDurationMs / 1000).toFixed(1)}s
                      </td>
                      <td className="py-3 text-[#FFCC00]">
                        ${(a.totalCostCents / 100).toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Execution History */}
      <div className="rounded-2xl bg-[#16213e] shadow-[6px_6px_12px_#0a0a1a,-6px_-6px_12px_#222244] p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">
            Execution History
            {selectedAgent && (
              <span className="text-sm font-normal text-[#FFCC00] ml-2">({selectedAgent})</span>
            )}
          </h3>
          {selectedAgent && (
            <button
              type="button"
              onClick={() => filterByAgent(null)}
              className="text-xs text-zinc-400 hover:text-white"
            >
              Clear filter
            </button>
          )}
        </div>
        <div className="space-y-2">
          {executions.length === 0 ? (
            <p className="text-sm text-zinc-500">No executions found</p>
          ) : (
            executions.map((ex) => (
              <div
                key={ex.id}
                className="flex items-center justify-between py-3 px-4 rounded-xl bg-[#1a1a2e]/50 hover:bg-[#1a1a2e] transition-colors"
              >
                <div className="flex items-center gap-3">
                  {ex.status === 'completed' ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  ) : ex.status === 'failed' ? (
                    <XCircle className="w-4 h-4 text-red-400" />
                  ) : (
                    <Clock className="w-4 h-4 text-yellow-400" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-zinc-300">
                      {ex.agentType?.replace(/_/g, ' ')}
                    </p>
                    {ex.error && (
                      <p className="text-xs text-red-400 mt-0.5 truncate max-w-xs">{ex.error}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-6 text-xs text-zinc-500">
                  <span>{(ex.durationMs / 1000).toFixed(1)}s</span>
                  <span>{(ex.inputTokens || 0) + (ex.outputTokens || 0)} tokens</span>
                  <span className="text-[#FFCC00]">${((ex.costCents || 0) / 100).toFixed(3)}</span>
                  <span>{new Date(ex.createdAt).toLocaleString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
        {executions.length >= 20 && (
          <button
            type="button"
            onClick={loadMore}
            className="mt-4 w-full py-2 text-sm text-[#FFCC00] hover:bg-[#FFCC00]/5 rounded-lg transition-colors"
          >
            Load More
          </button>
        )}
      </div>
    </div>
  );
}
