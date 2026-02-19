import { useState, useEffect } from 'react';
import { TrendingUp, Plus, Play, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { forecastsApi } from '../../../api';
import type { ForecastScenario, ForecastPeriod } from '../../../api';

interface ForecastScenariosProps {
  onCompare: (ids: string[]) => void;
}

const typeColors: Record<string, string> = {
  optimistic: 'text-emerald-400 bg-emerald-500/20',
  realistic: 'text-blue-400 bg-blue-500/20',
  pessimistic: 'text-red-400 bg-red-500/20',
  custom: 'text-purple-400 bg-purple-500/20',
};

export function ForecastScenarios({ onCompare }: ForecastScenariosProps) {
  const [scenarios, setScenarios] = useState<ForecastScenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [periods, setPeriods] = useState<Record<string, ForecastPeriod[]>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState<string | null>(null);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [scenarioType, setScenarioType] = useState<
    'optimistic' | 'realistic' | 'pessimistic' | 'custom'
  >('realistic');
  const [basePeriodStart, setBasePeriodStart] = useState('');
  const [basePeriodEnd, setBasePeriodEnd] = useState('');
  const [forecastMonths, setForecastMonths] = useState(12);
  const [growthRate, setGrowthRate] = useState('');
  const [seasonalWeight, setSeasonalWeight] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadScenarios();
  }, []);

  const loadScenarios = async () => {
    setLoading(true);
    try {
      const data = await forecastsApi.listScenarios();
      setScenarios(Array.isArray(data) ? data : (data.scenarios ?? []));
    } catch (e) {
      console.error('Failed to load scenarios', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!name) return;
    setCreating(true);
    try {
      const assumptions: Record<string, unknown> = {};
      if (growthRate) assumptions.growthRate = parseFloat(growthRate);
      if (seasonalWeight) assumptions.seasonalWeight = parseFloat(seasonalWeight);

      await forecastsApi.createScenario({
        userId: 'default',
        name,
        scenarioType,
        basePeriodStart,
        basePeriodEnd,
        forecastMonths,
        assumptions,
      });
      setName('');
      setScenarioType('realistic');
      setBasePeriodStart('');
      setBasePeriodEnd('');
      setForecastMonths(12);
      setGrowthRate('');
      setSeasonalWeight('');
      setShowCreate(false);
      loadScenarios();
    } catch (e) {
      console.error('Failed to create scenario', e);
    } finally {
      setCreating(false);
    }
  };

  const handleGenerate = async (id: string) => {
    setGenerating(id);
    try {
      await forecastsApi.generateForecast(id);
      loadScenarios();
    } catch (e) {
      console.error('Failed to generate forecast', e);
    } finally {
      setGenerating(null);
    }
  };

  const handleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!periods[id]) {
      try {
        const data = await forecastsApi.getScenario(id);
        setPeriods((prev) => ({ ...prev, [id]: data.periods ?? [] }));
      } catch (e) {
        console.error('Failed to load periods', e);
      }
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 4) next.add(id);
      return next;
    });
  };

  const fmt = (cents: number) =>
    '$' + (cents / 100).toLocaleString('en-AU', { minimumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      {/* Header + Compare */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-bold text-primary">Forecast Scenarios</h3>
          <p className="text-sm text-muted">Create and compare financial forecasts</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size >= 2 && (
            <button
              onClick={() => onCompare(Array.from(selectedIds))}
              className="px-4 py-2 rounded-xl text-sm font-bold bg-cba-gold text-base hover:bg-cba-gold/90 transition-colors"
            >
              Compare ({selectedIds.size})
            </button>
          )}
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="neu-raised-sm px-4 py-2 rounded-xl text-sm font-bold text-cba-gold hover:bg-cba-gold/10 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Scenario
          </button>
        </div>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="neu-raised rounded-2xl p-5 space-y-4 border border-cba-gold/10">
          <h4 className="text-sm font-bold text-primary">New Forecast Scenario</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-muted mb-1">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Q1 2026 Forecast"
                className="w-full neu-inset rounded-xl px-3 py-2 text-sm bg-transparent text-primary focus:ring-1 focus:ring-[#FFCC00]/50 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Scenario Type</label>
              <select
                value={scenarioType}
                onChange={(e) => setScenarioType(e.target.value as 'optimistic' | 'realistic' | 'pessimistic' | 'custom')}
                className="w-full neu-inset rounded-xl px-3 py-2 text-sm bg-transparent text-primary focus:ring-1 focus:ring-[#FFCC00]/50 outline-none"
              >
                <option value="optimistic">Optimistic</option>
                <option value="realistic">Realistic</option>
                <option value="pessimistic">Pessimistic</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Forecast Months</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={60}
                  value={forecastMonths}
                  onChange={(e) => setForecastMonths(parseInt(e.target.value))}
                  className="flex-1 accent-[#FFCC00]"
                />
                <span className="text-sm text-cba-gold font-mono w-8">{forecastMonths}</span>
              </div>
            </div>
            <div>
              <label htmlFor="forecast-base-start" className="block text-xs text-muted mb-1">Base Period Start</label>
              <input
                id="forecast-base-start"
                type="date"
                value={basePeriodStart}
                onChange={(e) => setBasePeriodStart(e.target.value)}
                className="w-full neu-inset rounded-xl px-3 py-2 text-sm bg-transparent text-primary focus:ring-1 focus:ring-[#FFCC00]/50 outline-none"
              />
            </div>
            <div>
              <label htmlFor="forecast-base-end" className="block text-xs text-muted mb-1">Base Period End</label>
              <input
                id="forecast-base-end"
                type="date"
                value={basePeriodEnd}
                onChange={(e) => setBasePeriodEnd(e.target.value)}
                className="w-full neu-inset rounded-xl px-3 py-2 text-sm bg-transparent text-primary focus:ring-1 focus:ring-[#FFCC00]/50 outline-none"
              />
            </div>
          </div>

          {scenarioType === 'custom' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/50">
              <div>
                <label htmlFor="forecast-growth-rate" className="block text-xs text-muted mb-1">Growth Rate (%)</label>
                <input
                  id="forecast-growth-rate"
                  type="number"
                  step="0.1"
                  value={growthRate}
                  onChange={(e) => setGrowthRate(e.target.value)}
                  placeholder="e.g. 5.0"
                  className="w-full neu-inset rounded-xl px-3 py-2 text-sm bg-transparent text-primary focus:ring-1 focus:ring-[#FFCC00]/50 outline-none"
                />
              </div>
              <div>
                <label htmlFor="forecast-seasonal-weight" className="block text-xs text-muted mb-1">Seasonal Weight</label>
                <input
                  id="forecast-seasonal-weight"
                  type="number"
                  step="0.1"
                  value={seasonalWeight}
                  onChange={(e) => setSeasonalWeight(e.target.value)}
                  placeholder="e.g. 1.0"
                  className="w-full neu-inset rounded-xl px-3 py-2 text-sm bg-transparent text-primary focus:ring-1 focus:ring-[#FFCC00]/50 outline-none"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 rounded-xl text-sm text-secondary hover:text-primary transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!name || creating}
              className="px-4 py-2 rounded-xl text-sm font-bold bg-cba-gold text-base hover:bg-cba-gold/90 transition-colors disabled:opacity-40"
            >
              {creating ? 'Creating...' : 'Create Scenario'}
            </button>
          </div>
        </div>
      )}

      {/* Scenario Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="neu-raised rounded-2xl p-5 animate-pulse">
              <div className="h-5 bg-zinc-800 rounded w-1/2 mb-3" />
              <div className="h-4 bg-zinc-800 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : scenarios.length === 0 ? (
        <div className="neu-inset rounded-2xl p-8 text-center text-muted">
          <TrendingUp className="w-10 h-10 mx-auto mb-3 text-zinc-600" />
          <p>No forecast scenarios yet.</p>
          <p className="text-xs mt-1">Click "New Scenario" to create one.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {scenarios.map((s) => (
            <div key={s.id} className="neu-raised rounded-2xl overflow-hidden">
              <div className="p-4 flex items-center gap-3">
                {/* Checkbox */}
                <button
                  onClick={() => toggleSelect(s.id)}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    selectedIds.has(s.id)
                      ? 'border-cba-gold bg-cba-gold/20'
                      : 'border-zinc-600 hover:border-zinc-400'
                  }`}
                >
                  {selectedIds.has(s.id) && <Check className="w-3 h-3 text-cba-gold" />}
                </button>

                <button type="button" className="flex-1 min-w-0 text-left" onClick={() => handleExpand(s.id)}>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-bold text-primary truncate">{s.name}</h4>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${typeColors[s.scenarioType] ?? typeColors.custom}`}
                    >
                      {s.scenarioType}
                    </span>
                  </div>
                  <p className="text-xs text-muted">
                    {s.forecastMonths} months &middot; {s.basePeriodStart} to {s.basePeriodEnd}
                  </p>
                </button>

                <button
                  onClick={() => handleGenerate(s.id)}
                  disabled={generating === s.id}
                  className="neu-raised-sm px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-400 hover:bg-emerald-500/10 transition-colors flex items-center gap-1.5 disabled:opacity-40"
                >
                  <Play className="w-3 h-3" />
                  {generating === s.id ? 'Generating...' : 'Generate'}
                </button>

                <button
                  onClick={() => handleExpand(s.id)}
                  className="text-muted hover:text-primary p-1"
                >
                  {expandedId === s.id ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
              </div>

              {/* Expanded Periods */}
              {expandedId === s.id && (
                <div className="border-t border-border/50 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left px-4 py-2 text-muted font-bold uppercase tracking-wider">
                          Period
                        </th>
                        <th className="text-left px-4 py-2 text-muted font-bold uppercase tracking-wider">
                          Category
                        </th>
                        <th className="text-right px-4 py-2 text-muted font-bold uppercase tracking-wider">
                          Amount
                        </th>
                        <th className="text-right px-4 py-2 text-muted font-bold uppercase tracking-wider">
                          Confidence Range
                        </th>
                        <th className="text-left px-4 py-2 text-muted font-bold uppercase tracking-wider">
                          Method
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(periods[s.id] ?? []).map((p, i) => (
                        <tr key={i} className="border-b border-border/50 hover:bg-white/[0.02]">
                          <td className="px-4 py-2 text-primary">{p.period}</td>
                          <td className="px-4 py-2 text-secondary">{p.category}</td>
                          <td className="px-4 py-2 text-right text-cba-gold font-mono">
                            {fmt(p.forecastAmount)}
                          </td>
                          <td className="px-4 py-2 text-right text-muted font-mono">
                            {fmt(p.confidenceLower)} – {fmt(p.confidenceUpper)}
                          </td>
                          <td className="px-4 py-2 text-muted">{p.method}</td>
                        </tr>
                      ))}
                      {(periods[s.id] ?? []).length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-zinc-600">
                            No forecast periods yet. Click "Generate" to create them.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
