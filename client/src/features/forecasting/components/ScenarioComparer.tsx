import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { forecastApi } from '../../../api';
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
  periods?: Array<{
    period: string;
    projectedInflow: number;
    projectedOutflow: number;
    netFlow: number;
  }>;
}

interface ScenarioConfig {
  id: string;
  name: string;
  inflowAdjustment: number;
  outflowAdjustment: number;
  forecastId: string | null;
}

const TEMPLATES: ScenarioConfig[] = [
  { id: 'tpl-sq', name: 'Status Quo', inflowAdjustment: 0, outflowAdjustment: 0, forecastId: null },
  {
    id: 'tpl-opt',
    name: 'Optimistic +15%',
    inflowAdjustment: 15,
    outflowAdjustment: -5,
    forecastId: null,
  },
  {
    id: 'tpl-pess',
    name: 'Pessimistic -20%',
    inflowAdjustment: -20,
    outflowAdjustment: 10,
    forecastId: null,
  },
];

const SCENARIO_COLORS = ['#FFCC00', '#22c55e', '#ef4444', '#8b5cf6', '#06b6d4'];

const formatDollar = (value: number) =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(value / 100);

interface ScenarioComparerProps {
  userId: string;
}

const ScenarioComparerChart = React.lazy(() => import('./ScenarioComparerChart'));

export function ScenarioComparer({ userId }: ScenarioComparerProps) {
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioConfig[]>([TEMPLATES[0]]);
  const [comparisonData, setComparisonData] = useState<Record<string, number>[] | null>(null);
  const [loading, setLoading] = useState(false);

  const loadForecasts = useCallback(async () => {
    try {
      const result = await forecastApi.list(userId);
      const items = Array.isArray(result) ? result : result.forecasts || [];
      setForecasts(items.filter((f: Forecast) => f.status === 'completed'));
    } catch {
      // Silently handle — list may be empty
    }
  }, [userId]);

  useEffect(() => {
    loadForecasts();
  }, [loadForecasts]);

  const addScenario = (template?: ScenarioConfig) => {
    if (scenarios.length >= 5) return;
    setScenarios((prev) => [
      ...prev,
      template
        ? { ...template, id: `sc-${Date.now()}` }
        : { ...TEMPLATES[0], id: `sc-${Date.now()}`, name: `Scenario ${prev.length + 1}` },
    ]);
  };

  const updateScenario = (id: string, update: Partial<ScenarioConfig>) => {
    setScenarios((prev) => prev.map((s) => (s.id === id ? { ...s, ...update } : s)));
  };

  const removeScenario = (id: string) => {
    if (scenarios.length <= 1) return;
    setScenarios((prev) => prev.filter((s) => s.id !== id));
  };

  const runComparison = async () => {
    const forecastIds = scenarios.map((s) => s.forecastId).filter(Boolean) as string[];
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
            disabled={loading || !scenarios.some((s) => s.forecastId)}
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
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
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
            key={scenario.id}
            className="neu-raised rounded-2xl p-4 border-l-2"
            style={{ borderLeftColor: SCENARIO_COLORS[idx % SCENARIO_COLORS.length] }}
          >
            <div className="flex items-center justify-between mb-3">
              <input
                value={scenario.name}
                onChange={(e) => updateScenario(scenario.id, { name: e.target.value })}
                className="bg-transparent text-sm font-bold text-zinc-100 border-none outline-none w-full"
              />
              {scenarios.length > 1 && (
                <button
                  onClick={() => removeScenario(scenario.id)}
                  className="text-zinc-500 hover:text-red-400 text-xs ml-2 shrink-0"
                >
                  Remove
                </button>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label
                  htmlFor={`sc-forecast-${scenario.id}`}
                  className="text-[11px] text-zinc-500 block mb-1"
                >
                  Forecast
                </label>
                <select
                  id={`sc-forecast-${scenario.id}`}
                  value={scenario.forecastId ?? ''}
                  onChange={(e) =>
                    updateScenario(scenario.id, { forecastId: e.target.value || null })
                  }
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-zinc-300 outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
                >
                  <option value="">Select forecast...</option>
                  {forecasts.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.forecastType} — {f.financialYear} ({f.granularity})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor={`sc-inflow-${scenario.id}`}
                  className="text-[11px] text-zinc-500 flex justify-between mb-1"
                >
                  <span>Inflow Adj.</span>
                  <span
                    className={
                      scenario.inflowAdjustment >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }
                  >
                    {scenario.inflowAdjustment > 0 ? '+' : ''}
                    {scenario.inflowAdjustment}%
                  </span>
                </label>
                <input
                  id={`sc-inflow-${scenario.id}`}
                  type="range"
                  min={-50}
                  max={50}
                  value={scenario.inflowAdjustment}
                  onChange={(e) =>
                    updateScenario(scenario.id, { inflowAdjustment: Number(e.target.value) })
                  }
                  className="w-full accent-[#FFCC00]"
                />
              </div>

              <div>
                <label
                  htmlFor={`sc-outflow-${scenario.id}`}
                  className="text-[11px] text-zinc-500 flex justify-between mb-1"
                >
                  <span>Outflow Adj.</span>
                  <span
                    className={
                      scenario.outflowAdjustment <= 0 ? 'text-emerald-400' : 'text-red-400'
                    }
                  >
                    {scenario.outflowAdjustment > 0 ? '+' : ''}
                    {scenario.outflowAdjustment}%
                  </span>
                </label>
                <input
                  id={`sc-outflow-${scenario.id}`}
                  type="range"
                  min={-50}
                  max={50}
                  value={scenario.outflowAdjustment}
                  onChange={(e) =>
                    updateScenario(scenario.id, { outflowAdjustment: Number(e.target.value) })
                  }
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
          <Suspense fallback={<div className="h-[320px] animate-pulse bg-white/5 rounded-xl" />}>
            <ScenarioComparerChart
              data={comparisonData}
              scenarios={scenarios.map((s) => ({ id: s.id, name: s.name }))}
            />
          </Suspense>
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
            const values = comparisonData.map((d) => d[`scenario_${idx}`] ?? 0);
            const total = values.reduce((sum: number, v: number) => sum + v, 0);
            const avg = values.length ? total / values.length : 0;
            return (
              <div
                key={s.id}
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
