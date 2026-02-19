import { useState, useEffect } from 'react';
import { forecastApi } from '../../../api';
import { ForecastChart } from './ForecastChart';
import { AccuracyPanel } from './AccuracyPanel';
import { ScenarioComparer } from './ScenarioComparer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  TrendingUp,
  BarChart3,
  GitCompareArrows,
  Play,
  Archive,
  Loader2,
  Calendar,
  RefreshCw,
} from 'lucide-react';

interface Forecast {
  id: string;
  userId: string;
  accountId?: string;
  forecastType: string;
  status: string;
  financialYear: string;
  granularity: string;
  createdAt: string;
  periods?: ForecastPeriod[];
}

interface ForecastPeriod {
  period: string;
  predictedInflow: number;
  predictedOutflow: number;
  predictedNet: number;
  confidenceUpper: number;
  confidenceLower: number;
  actualInflow?: number | null;
  actualOutflow?: number | null;
  actualNet?: number | null;
}

const FORECAST_TYPES = [
  { value: 'linear', label: 'Linear' },
  { value: 'seasonal', label: 'Seasonal' },
  { value: 'ml_weighted', label: 'ML Weighted' },
] as const;

const GRANULARITIES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
] as const;

function getFYOptions(): string[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  // Australian FY: Jul-Jun
  const currentFY = month >= 6 ? year : year - 1;
  return Array.from({ length: 4 }, (_, i) => `${currentFY - 1 + i}-${currentFY + i}`);
}

function statusBadge(status: string) {
  const map: Record<string, { bg: string; text: string }> = {
    completed: { bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
    running: { bg: 'bg-blue-500/10', text: 'text-blue-400' },
    pending: { bg: 'bg-yellow-500/10', text: 'text-yellow-400' },
    failed: { bg: 'bg-red-500/10', text: 'text-red-400' },
    archived: { bg: 'bg-zinc-500/10', text: 'text-secondary' },
  };
  const style = map[status] ?? map.pending;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${style.bg} ${style.text}`}
    >
      {status}
    </span>
  );
}

export function ForecastDashboard() {
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [selectedForecast, setSelectedForecast] = useState<Forecast | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Generation form
  const [forecastType, setForecastType] = useState<string>('seasonal');
  const [financialYear, setFinancialYear] = useState(getFYOptions()[1] || '');
  const [granularity, setGranularity] = useState<string>('monthly');

  const userId = 'default';

  const loadForecasts = async () => {
    setLoading(true);
    try {
      const result = await forecastApi.list(userId);
      const items = Array.isArray(result) ? result : result.forecasts || [];
      setForecasts(items);
    } catch {
      // empty
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadForecasts();
  }, []);

  const selectForecast = async (forecast: Forecast) => {
    if (forecast.periods) {
      setSelectedForecast(forecast);
      return;
    }
    try {
      const detail = await forecastApi.getById(forecast.id);
      setSelectedForecast(detail);
    } catch {
      setSelectedForecast(forecast);
    }
  };

  const generateForecast = async () => {
    setGenerating(true);
    try {
      const result = await forecastApi.generate({
        userId,
        forecastType,
        financialYear,
        granularity,
      });
      await loadForecasts();
      if (result?.id) {
        const detail = await forecastApi.getById(result.id);
        setSelectedForecast(detail);
      }
    } catch {
      // handled by UI feedback
    } finally {
      setGenerating(false);
    }
  };

  const archiveForecast = async (id: string) => {
    try {
      await forecastApi.archive(id);
      await loadForecasts();
      if (selectedForecast?.id === id) setSelectedForecast(null);
    } catch {
      // empty
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-gradient-gold">
          Cash Flow Forecasting
        </h2>
        <p className="text-sm text-muted">
          Predict future cash flows using historical transaction patterns
        </p>
      </div>

      {/* Generation Controls */}
      <div className="neu-raised rounded-2xl p-4 sm:p-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="text-[11px] text-muted font-bold uppercase tracking-wider block mb-1.5">
              Method
            </label>
            <select
              value={forecastType}
              onChange={(e) => setForecastType(e.target.value)}
              className="bg-overlay border border-border rounded-xl px-3 py-2 text-sm text-primary outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
            >
              {FORECAST_TYPES.map((ft) => (
                <option key={ft.value} value={ft.value}>
                  {ft.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] text-muted font-bold uppercase tracking-wider block mb-1.5">
              Financial Year
            </label>
            <select
              value={financialYear}
              onChange={(e) => setFinancialYear(e.target.value)}
              className="bg-overlay border border-border rounded-xl px-3 py-2 text-sm text-primary outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
            >
              {getFYOptions().map((fy) => (
                <option key={fy} value={fy}>
                  FY {fy}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] text-muted font-bold uppercase tracking-wider block mb-1.5">
              Granularity
            </label>
            <select
              value={granularity}
              onChange={(e) => setGranularity(e.target.value)}
              className="bg-overlay border border-border rounded-xl px-3 py-2 text-sm text-primary outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
            >
              {GRANULARITIES.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={generateForecast}
            disabled={generating}
            className="neu-raised-sm px-5 py-2 rounded-xl text-sm font-bold bg-cba-gold/10 text-cba-gold hover:bg-cba-gold/20 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {generating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Generate Forecast
          </button>

          <button
            onClick={loadForecasts}
            disabled={loading}
            className="neu-raised-sm p-2 rounded-xl text-secondary hover:text-cba-gold transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Forecast List */}
      {forecasts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {forecasts.map((f) => (
            <button
              key={f.id}
              onClick={() => selectForecast(f)}
              className={`neu-raised rounded-2xl p-4 text-left transition-all hover:border-cba-gold/30 border ${
                selectedForecast?.id === f.id
                  ? 'border-cba-gold/50 ring-1 ring-[#FFCC00]/20'
                  : 'border-transparent'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-zinc-100 capitalize">
                  {f.forecastType.replace('_', ' ')}
                </span>
                {statusBadge(f.status)}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  FY {f.financialYear}
                </span>
                <span>{f.granularity}</span>
              </div>
              <p className="text-[10px] text-zinc-600 mt-2">
                {new Date(f.createdAt).toLocaleDateString('en-AU')}
              </p>
              {f.status !== 'archived' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    archiveForecast(f.id);
                  }}
                  className="mt-2 text-[10px] text-muted hover:text-yellow-400 flex items-center gap-1"
                >
                  <Archive className="w-3 h-3" /> Archive
                </button>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Tabbed Detail View */}
      {selectedForecast && (
        <Tabs defaultValue="chart" className="space-y-4">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="chart">
              <TrendingUp className="w-4 h-4 mr-2" />
              Forecast Chart
            </TabsTrigger>
            <TabsTrigger value="accuracy">
              <BarChart3 className="w-4 h-4 mr-2" />
              Accuracy
            </TabsTrigger>
            <TabsTrigger value="scenarios">
              <GitCompareArrows className="w-4 h-4 mr-2" />
              Scenarios
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chart">
            <ForecastChart
              periods={selectedForecast.periods ?? []}
              granularity={selectedForecast.granularity}
            />
          </TabsContent>

          <TabsContent value="accuracy">
            <AccuracyPanel forecastId={selectedForecast.id} />
          </TabsContent>

          <TabsContent value="scenarios">
            <ScenarioComparer userId={userId} />
          </TabsContent>
        </Tabs>
      )}

      {!selectedForecast && forecasts.length > 0 && (
        <div className="neu-inset rounded-2xl p-8 text-center text-muted">
          <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Select a forecast above to view details</p>
        </div>
      )}

      {!loading && forecasts.length === 0 && (
        <div className="neu-inset rounded-2xl p-8 text-center text-muted">
          <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No forecasts yet. Generate your first forecast above.</p>
        </div>
      )}
    </div>
  );
}
