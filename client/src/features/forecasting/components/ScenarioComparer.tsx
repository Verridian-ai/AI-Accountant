import { useState, useEffect } from 'react';
import { forecastApi } from '../../../api';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Plus, GitCompareArrows, TrendingUp } from 'lucide-react';

interface Forecast {
  id: string;
  userId: string;
  accountId?: string;
  forecastType: string;
  status: string;
  financialYear: string;
  granularity: string;
  createdAt: string;
  periods?: any[];
}

interface ScenarioConfig {
  name: string;
  inflowAdjustment: number;
  outflowAdjustment: number;
  forecastId: string | null;
}

const TEMPLATES: ScenarioConfig[] = [
  { name: 'Status Quo', inflowAdjustment: 0, outflowAdjustment: 0, forecastId: null },
  { name: 'Optimistic +15%', inflowAdjustment: 15, outflowAdjustment: -5, forecastId: null },
  { name: 'Pessimistic -20%', inflowAdjustment: -20, outflowAdjustment: 10, forecastId: null },
];

const SCENARIO_COLORS = ['#FFCC00', '#22c55e', '#ef4444', '#8b5cf6', '#06b6d4'];

const formatDollar = (value: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(value / 100);

interface ScenarioComparerProps {
  userId: string;
}

export function ScenarioComparer({ userId }: ScenarioComparerProps) {
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioConfig[]>([TEMPLATES[0]]);
  const [comparisonData, setComparisonData] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadForecasts();
  }, [userId]);

  const loadForecasts = async () => {
    try {
      const result = await forecastApi.list(userId);
      const items = Array.isArray(result) ? result : result.forecasts || [];
      setForecasts(items.filter((f: Forecast) => f.status === 'completed'));
    } catch {
      // Silently handle — list may be empty
    }
  };

  const addScenario = (template?: ScenarioConfig) => {
    if (scenarios.length >= 5) return;
    setScenarios(prev => [...prev, template ?? { ...TEMPLATES[0], name: `Scenario ${prev.length + 1}` }]);
  };

  const updateScenario = (index: number, update: Partial<ScenarioConfig>) => {
    setScenarios(prev => prev.map((s, i) => (i === index ? { ...s, ...update } : s)));
  };

  const removeScenario = (index: number) => {
    if (scenarios.length <= 1) return;
    setScenarios(prev => prev.filter((_, i) => i !== index));
  };

  const runComparison = async () => {
    const forecastIds = scenarios.map(s => s.forecastId).filter(Boolean) as string[];
    if (!forecastIds.length) return;

    setLoading(true);
    try {
      const result = await forecastApi.compare(forecastIds);
      setComparisonData(result?.periods ?? result ?? []);
    } catch {
      setComparisonData([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-zinc-100">Scenario Comparison</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => addScenario()}
            disabled={scenarios.length >= 5}
            className="neu-raised-sm px-3 py-1.5 rounded-xl text-xs font-bold text-zinc-400 hover:text-[#FFCC00] transition-colors disabled:opacity-30 flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
          <button
            onClick={runComparison}
            disabled={loading || !scenarios.some(s => s.forecastId)}
            className="neu-raised-sm px-4 py-1.5 rounded-xl text-xs font-bold bg-[#FFCC00]/10 text-[#FFCC00] hover:bg-[#FFCC00]/20 transition-colors disabled:opacity-30 flex items-center gap-1.5"
          >
            <GitCompareArrows className="w-3.5 h-3.5" />
            Compare
          </button>
        </div>
      </div>

      {/* Scenario Builder */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Templates */}
        <div className="neu-inset rounded-2xl p-4">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">Templates</p>
          <div className="space-y-2">
            {TEMPLATES.map(t => (
              <button
                key={t.name}
                onClick={() => addScenario({ ...t })}
                disabled={scenarios.length >= 5}
                className="w-full text-left neu-raised-sm px-3 py-2 rounded-xl text-sm text-zinc-300 hover:text-[#FFCC00] hover:border-[#FFCC00]/20 border border-transparent transition-colors disabled:opacity-30"
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>

        {/* Active Scenarios */}
        {scenarios.map((scenario, idx) => (
          <div
            key={idx}
            className="neu-raised rounded-2xl p-4 border-l-2"
            style={{ borderLeftColor: SCENARIO_COLORS[idx % SCENARIO_COLORS.length] }}
          >
            <div className="flex items-center justify-between mb-3">
              <input
                value={scenario.name}
                onChange={e => updateScenario(idx, { name: e.target.value })}
                className="bg-transparent text-sm font-bold text-zinc-100 border-none outline-none w-full"
              />
              {scenarios.length > 1 && (
                <button
                  onClick={() => removeScenario(idx)}
                  className="text-zinc-500 hover:text-red-400 text-xs ml-2 shrink-0"
                >
                  Remove
                </button>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-zinc-500 block mb-1">Forecast</label>
                <select
                  value={scenario.forecastId ?? ''}
                  onChange={e => updateScenario(idx, { forecastId: e.target.value || null })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-zinc-300 outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
                >
                  <option value="">Select forecast...</option>
                  {forecasts.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.forecastType} — {f.financialYear} ({f.granularity})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] text-zinc-500 flex justify-between mb-1">
                  <span>Inflow Adj.</span>
                  <span className={scenario.inflowAdjustment >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                    {scenario.inflowAdjustment > 0 ? '+' : ''}{scenario.inflowAdjustment}%
                  </span>
                </label>
                <input
                  type="range"
                  min={-50}
                  max={50}
                  value={scenario.inflowAdjustment}
                  onChange={e => updateScenario(idx, { inflowAdjustment: Number(e.target.value) })}
                  className="w-full accent-[#FFCC00]"
                />
              </div>

              <div>
                <label className="text-[11px] text-zinc-500 flex justify-between mb-1">
                  <span>Outflow Adj.</span>
                  <span className={scenario.outflowAdjustment <= 0 ? 'text-emerald-400' : 'text-red-400'}>
                    {scenario.outflowAdjustment > 0 ? '+' : ''}{scenario.outflowAdjustment}%
                  </span>
                </label>
                <input
                  type="range"
                  min={-50}
                  max={50}
                  value={scenario.outflowAdjustment}
                  onChange={e => updateScenario(idx, { outflowAdjustment: Number(e.target.value) })}
                  className="w-full accent-[#FFCC00]"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Comparison Chart */}
      {comparisonData && comparisonData.length > 0 && (
        <div className="neu-raised rounded-2xl p-4 sm:p-6">
          <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4">
            Net Cash Flow Comparison
          </h4>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={comparisonData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="period"
                tick={{ fill: '#71717a', fontSize: 11 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              />
              <YAxis
                tickFormatter={(v: number) => formatDollar(v)}
                tick={{ fill: '#71717a', fontSize: 11 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                width={80}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }}
                labelStyle={{ color: '#a1a1aa' }}
                formatter={(value: number) => formatDollar(value)}
              />
              <Legend formatter={(value: string) => <span className="text-xs text-zinc-400">{value}</span>} />
              {scenarios.map((s, idx) => (
                <Line
                  key={idx}
                  type="monotone"
                  dataKey={`scenario_${idx}`}
                  stroke={SCENARIO_COLORS[idx % SCENARIO_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  name={s.name}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {comparisonData && comparisonData.length === 0 && (
        <div className="neu-inset rounded-2xl p-8 text-center text-zinc-500">
          <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No comparison data available</p>
        </div>
      )}

      {/* Summary Cards */}
      {comparisonData && comparisonData.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {scenarios.map((s, idx) => {
            const values = comparisonData.map(d => d[`scenario_${idx}`] ?? 0);
            const total = values.reduce((sum: number, v: number) => sum + v, 0);
            const avg = values.length ? total / values.length : 0;
            return (
              <div
                key={idx}
                className="neu-raised rounded-2xl p-4 border-l-2"
                style={{ borderLeftColor: SCENARIO_COLORS[idx % SCENARIO_COLORS.length] }}
              >
                <p className="text-sm font-bold text-zinc-100 mb-2">{s.name}</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-zinc-500">Total Net</span>
                    <p className="font-bold text-zinc-100">{formatDollar(total)}</p>
                  </div>
                  <div>
                    <span className="text-zinc-500">Avg/Period</span>
                    <p className="font-bold text-zinc-100">{formatDollar(avg)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
