import { useState, useEffect, useCallback } from 'react';
import { BarChart3 } from 'lucide-react';
import { forecastsApi } from '../../../api';

interface ScenarioComparisonProps {
  scenarioIds: string[];
}

interface ComparisonData {
  scenarios: Array<{
    id: string;
    name: string;
    scenarioType: string;
  }>;
  periods: Array<{
    period: string;
    values: Record<string, number>;
  }>;
  totals: Record<string, number>;
}

const typeColors: Record<string, { bar: string; text: string }> = {
  optimistic: { bar: 'bg-emerald-500', text: 'text-emerald-400' },
  realistic: { bar: 'bg-blue-500', text: 'text-blue-400' },
  pessimistic: { bar: 'bg-red-500', text: 'text-red-400' },
  custom: { bar: 'bg-purple-500', text: 'text-purple-400' },
};

export function ScenarioComparison({ scenarioIds }: ScenarioComparisonProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ComparisonData | null>(null);

  const scenarioKey = scenarioIds.join(',');

  const loadComparison = useCallback(async () => {
    setLoading(true);
    try {
      const result = await forecastsApi.compareScenarios(scenarioIds);
      setData(result);
    } catch (e) {
      console.error('Failed to compare scenarios', e);
    } finally {
      setLoading(false);
    }
    // scenarioKey is a stable string derived from scenarioIds
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioKey]);

  useEffect(() => {
    loadComparison();
  }, [loadComparison]);

  const fmt = (cents: number) =>
    '$' + (cents / 100).toLocaleString('en-AU', { minimumFractionDigits: 2 });

  if (loading) {
    return (
      <div className="neu-raised rounded-2xl p-8 animate-pulse">
        <div className="h-6 bg-zinc-800 rounded w-1/3 mb-4" />
        <div className="h-4 bg-zinc-800 rounded w-2/3 mb-8" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 bg-zinc-800 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || !data.scenarios?.length) {
    return (
      <div className="neu-inset rounded-2xl p-8 text-center text-muted">
        <BarChart3 className="w-10 h-10 mx-auto mb-3 text-zinc-600" />
        <p>No comparison data available.</p>
      </div>
    );
  }

  // Find max value across all periods for bar chart scaling
  const allValues = (data.periods ?? []).flatMap((p) =>
    Object.values(p.values).map((v) => Math.abs(v)),
  );
  const maxValue = Math.max(...allValues, 1);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-gradient-gold">Scenario Comparison</h3>
        <p className="text-sm text-muted">
          Comparing {data.scenarios.length} scenarios side-by-side
        </p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {data.scenarios.map((s) => {
          const colors = typeColors[s.scenarioType] ?? typeColors.custom;
          return (
            <div key={s.id} className="flex items-center gap-2 neu-inset px-3 py-1.5 rounded-xl">
              <div className={`w-3 h-3 rounded-sm ${colors.bar}`} />
              <span className={`text-xs font-bold ${colors.text}`}>{s.name}</span>
              <span className="text-[10px] text-zinc-600 uppercase">{s.scenarioType}</span>
            </div>
          );
        })}
      </div>

      {/* Comparison Table */}
      <div className="neu-raised rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left px-4 py-3 text-muted font-bold uppercase text-xs tracking-wider">
                  Period
                </th>
                {data.scenarios.map((s) => {
                  const colors = typeColors[s.scenarioType] ?? typeColors.custom;
                  return (
                    <th
                      key={s.id}
                      className={`text-right px-4 py-3 font-bold uppercase text-xs tracking-wider ${colors.text}`}
                    >
                      {s.name}
                    </th>
                  );
                })}
                <th className="text-right px-4 py-3 text-cba-gold font-bold uppercase text-xs tracking-wider">
                  Spread
                </th>
              </tr>
            </thead>
            <tbody>
              {(data.periods ?? []).map((p, i) => {
                const vals = data.scenarios.map((s) => p.values[s.id] ?? 0);
                const spread = Math.max(...vals) - Math.min(...vals);

                return (
                  <tr key={i} className="border-b border-border/50 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-primary font-medium">{p.period}</td>
                    {data.scenarios.map((s) => (
                      <td key={s.id} className="px-4 py-3 text-right font-mono text-primary">
                        {fmt(p.values[s.id] ?? 0)}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right font-mono text-cba-gold">{fmt(spread)}</td>
                  </tr>
                );
              })}
            </tbody>
            {/* Summary row */}
            <tfoot>
              <tr className="border-t border-cba-gold/20 bg-cba-gold/5">
                <td className="px-4 py-3 text-primary font-bold">Total</td>
                {data.scenarios.map((s) => (
                  <td key={s.id} className="px-4 py-3 text-right font-mono font-bold text-primary">
                    {fmt(data.totals?.[s.id] ?? 0)}
                  </td>
                ))}
                <td className="px-4 py-3 text-right font-mono font-bold text-cba-gold">
                  {fmt(
                    Math.max(...data.scenarios.map((s) => data.totals?.[s.id] ?? 0)) -
                      Math.min(...data.scenarios.map((s) => data.totals?.[s.id] ?? 0)),
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* CSS Bar Chart */}
      <div className="neu-raised rounded-2xl p-5">
        <h4 className="text-sm font-bold text-primary mb-4">Visual Comparison</h4>
        <div className="space-y-4">
          {(data.periods ?? []).map((p, i) => (
            <div key={i}>
              <p className="text-xs text-muted mb-1.5">{p.period}</p>
              <div className="flex gap-1 h-6">
                {data.scenarios.map((s) => {
                  const value = Math.abs(p.values[s.id] ?? 0);
                  const width = (value / maxValue) * 100;
                  const colors = typeColors[s.scenarioType] ?? typeColors.custom;
                  return (
                    <div
                      key={s.id}
                      className={`${colors.bar} rounded-sm transition-all relative group`}
                      style={{ width: `${width}%`, minWidth: value > 0 ? '4px' : '0' }}
                      title={`${s.name}: ${fmt(p.values[s.id] ?? 0)}`}
                    >
                      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-primary/80 opacity-0 group-hover:opacity-100 truncate px-1">
                        {fmt(p.values[s.id] ?? 0)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
