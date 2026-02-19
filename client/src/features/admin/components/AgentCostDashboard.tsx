import { useState, useEffect } from 'react';
import { fetchAgentCosts } from '../../../api';
import { DollarSign, TrendingUp, Calendar } from 'lucide-react';

interface CostEntry {
  period: string;
  agentType: string;
  model: string;
  totalCostCents: number;
  totalTokens: number;
  executionCount: number;
}

interface CostData {
  totalCostCents: number;
  byAgent: Array<{ agentType: string; costCents: number; pct: number }>;
  byModel: Array<{ model: string; costCents: number; pct: number }>;
  dailyTrend: Array<{ date: string; costCents: number }>;
  topExecutions: CostEntry[];
}

export function AgentCostDashboard() {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [data, setData] = useState<CostData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadCosts = async () => {
    setLoading(true);
    try {
      const res = await fetchAgentCosts(period);
      setData(res);
    } catch {
      /* */
    }
    setLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCosts();
  }, [period]);

  const maxAgentCost = data?.byAgent?.reduce((max, a) => Math.max(max, a.costCents), 0) || 1;
  const maxDailyCost = data?.dailyTrend?.reduce((max, d) => Math.max(max, d.costCents), 0) || 1;

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-primary">Cost Analysis</h2>
        <div className="animate-pulse h-64 rounded-2xl bg-[#16213e]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-primary">Cost Analysis</h2>
          <p className="text-sm text-muted">AI agent token usage and cost tracking</p>
        </div>
        <div className="flex items-center gap-1 rounded-xl bg-[#1a1a2e] p-1">
          {(['daily', 'weekly', 'monthly'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                period === p ? 'bg-cba-gold text-[#1a1a2e]' : 'text-secondary hover:text-primary'
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Total Cost Card */}
      <div className="rounded-2xl bg-[#16213e] shadow-[6px_6px_12px_#0a0a1a,-6px_-6px_12px_#222244] p-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-cba-gold/10">
            <DollarSign className="w-6 h-6 text-cba-gold" />
          </div>
          <div>
            <p className="text-xs text-muted uppercase tracking-wider">Total Cost ({period})</p>
            <p className="text-4xl font-bold text-cba-gold">
              ${((data?.totalCostCents ?? 0) / 100).toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cost by Agent */}
        <div className="rounded-2xl bg-[#16213e] shadow-[6px_6px_12px_#0a0a1a,-6px_-6px_12px_#222244] p-6">
          <h3 className="text-lg font-bold text-primary mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-cba-gold" /> Cost by Agent
          </h3>
          <div className="space-y-3">
            {(data?.byAgent || []).map((a) => (
              <div key={a.agentType}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-primary">{a.agentType.replace(/_/g, ' ')}</span>
                  <span className="text-cba-gold font-bold">
                    ${(a.costCents / 100).toFixed(2)} ({a.pct.toFixed(1)}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[#1a1a2e] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#FFCC00] to-[#FFD633]"
                    style={{ width: `${(a.costCents / maxAgentCost) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {(!data?.byAgent || data.byAgent.length === 0) && (
              <p className="text-sm text-muted">No cost data available</p>
            )}
          </div>
        </div>

        {/* Cost by Model */}
        <div className="rounded-2xl bg-[#16213e] shadow-[6px_6px_12px_#0a0a1a,-6px_-6px_12px_#222244] p-6">
          <h3 className="text-lg font-bold text-primary mb-4">Cost by Model</h3>
          <div className="space-y-3">
            {(data?.byModel || []).map((m) => (
              <div
                key={m.model}
                className="flex items-center justify-between py-3 border-b border-border/50 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium text-primary">{m.model}</p>
                  <p className="text-[10px] text-muted">{m.pct.toFixed(1)}% of total</p>
                </div>
                <p className="text-lg font-bold text-cba-gold">
                  ${(m.costCents / 100).toFixed(2)}
                </p>
              </div>
            ))}
            {(!data?.byModel || data.byModel.length === 0) && (
              <p className="text-sm text-muted">No model data available</p>
            )}
          </div>
        </div>
      </div>

      {/* Daily Trend */}
      <div className="rounded-2xl bg-[#16213e] shadow-[6px_6px_12px_#0a0a1a,-6px_-6px_12px_#222244] p-6">
        <h3 className="text-lg font-bold text-primary mb-4 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-cba-gold" /> Daily Trend
        </h3>
        <div className="flex items-end gap-1 h-40">
          {(data?.dailyTrend || []).map((d, i) => (
            <div
              key={d.date ?? `sk-${i}`}
              className="flex-1 flex flex-col items-center gap-1 group relative"
            >
              <div
                className="w-full rounded-t bg-gradient-to-t from-[#FFCC00]/60 to-[#FFCC00] hover:from-[#FFCC00] transition-all"
                style={{ height: `${Math.max((d.costCents / maxDailyCost) * 100, 2)}%` }}
              />
              <span className="text-[8px] text-zinc-600 truncate max-w-full">
                {d.date?.slice(5)}
              </span>
              <div className="absolute bottom-full mb-2 hidden group-hover:block bg-[#0a0a1a] text-xs text-primary px-2 py-1 rounded z-10 whitespace-nowrap">
                ${(d.costCents / 100).toFixed(2)}
              </div>
            </div>
          ))}
          {(!data?.dailyTrend || data.dailyTrend.length === 0) && (
            <p className="text-sm text-muted m-auto">No trend data</p>
          )}
        </div>
      </div>

      {/* Top Expensive Executions */}
      {data?.topExecutions && data.topExecutions.length > 0 && (
        <div className="rounded-2xl bg-[#16213e] shadow-[6px_6px_12px_#0a0a1a,-6px_-6px_12px_#222244] p-6">
          <h3 className="text-lg font-bold text-primary mb-4">Top Expensive Executions</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted text-xs uppercase tracking-wider border-b border-border/50">
                  <th className="pb-3 pr-4">Agent</th>
                  <th className="pb-3 pr-4">Model</th>
                  <th className="pb-3 pr-4">Tokens</th>
                  <th className="pb-3 pr-4">Cost</th>
                  <th className="pb-3">Period</th>
                </tr>
              </thead>
              <tbody>
                {data.topExecutions.map((ex, i) => (
                  <tr
                    key={`${ex.agentType ?? ''}${ex.period ?? ''}${i}`}
                    className="border-b border-border/50"
                  >
                    <td className="py-3 pr-4 text-primary">{ex.agentType?.replace(/_/g, ' ')}</td>
                    <td className="py-3 pr-4 text-secondary text-xs">{ex.model}</td>
                    <td className="py-3 pr-4 text-secondary">{ex.totalTokens?.toLocaleString()}</td>
                    <td className="py-3 pr-4 text-cba-gold font-bold">
                      ${(ex.totalCostCents / 100).toFixed(3)}
                    </td>
                    <td className="py-3 text-muted text-xs">{ex.period}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
