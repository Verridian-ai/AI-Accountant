import { useState, useEffect } from 'react';
import { Loader2, TrendingUp, TrendingDown, ArrowUpDown } from 'lucide-react';
import { reportsApi } from '@/api';
import type { KPIMetric } from '@/api';

const formatValue = (value: number) => {
  if (Math.abs(value) >= 100) {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(
      value / 100,
    );
  }
  return value.toFixed(2);
};

interface Props {
  period: string;
}

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'stable' }) {
  switch (trend) {
    case 'up':
      return <TrendingUp className="h-5 w-5 text-emerald-400" />;
    case 'down':
      return <TrendingDown className="h-5 w-5 text-red-400" />;
    default:
      return <ArrowUpDown className="h-5 w-5 text-zinc-400" />;
  }
}

function trendColor(trend: 'up' | 'down' | 'stable'): string {
  switch (trend) {
    case 'up':
      return 'text-emerald-400';
    case 'down':
      return 'text-red-400';
    default:
      return 'text-zinc-400';
  }
}

function trendBorder(trend: 'up' | 'down' | 'stable'): string {
  switch (trend) {
    case 'up':
      return 'border-emerald-500/20';
    case 'down':
      return 'border-red-500/20';
    default:
      return 'border-white/5';
  }
}

export function KPIDashboard({ period }: Props) {
  const [loading, setLoading] = useState(false);
  const [kpis, setKpis] = useState<KPIMetric[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!period) return;
    setLoading(true);
    setError(null);
    reportsApi
      .fetchKPIs(period)
      .then((data: unknown) => setKpis(Array.isArray(data) ? data : []))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Unknown error'))
      .finally(() => setLoading(false));
  }, [period]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[#FFCC00]" />
        <span className="ml-3 text-zinc-400">Loading KPIs...</span>
      </div>
    );
  }

  if (error) {
    return <div className="neu-inset rounded-2xl p-6 text-center text-red-400">{error}</div>;
  }

  if (kpis.length === 0) {
    return (
      <div className="neu-inset rounded-2xl p-6 text-center text-zinc-500">
        No KPI data available for this period. Process more transactions to generate metrics.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {kpis.map((kpi) => (
        <div
          key={kpi.metricName}
          className={`neu-raised rounded-2xl p-5 border ${trendBorder(kpi.trend)} transition-colors hover:bg-white/[0.02]`}
        >
          <div className="flex items-start justify-between mb-3">
            <span className="text-xs text-zinc-500 font-medium uppercase tracking-wide">
              {kpi.metricName}
            </span>
            <div className="neu-inset p-1.5 rounded-lg">
              <TrendIcon trend={kpi.trend} />
            </div>
          </div>

          <p className={`text-2xl font-bold font-mono ${trendColor(kpi.trend)} mb-2`}>
            {formatValue(kpi.value)}
          </p>

          <div className="flex items-center justify-between text-xs">
            {kpi.previousValue !== null && (
              <span className="text-zinc-500">
                Prev: <span className="font-mono">{formatValue(kpi.previousValue)}</span>
              </span>
            )}
            {kpi.target !== null && (
              <span className="text-zinc-500">
                Target: <span className="font-mono text-[#FFCC00]">{formatValue(kpi.target)}</span>
              </span>
            )}
          </div>

          {/* Progress bar toward target */}
          {kpi.target !== null && kpi.target > 0 && (
            <div className="mt-3 h-1.5 neu-inset rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${kpi.value >= kpi.target ? 'bg-emerald-500' : 'bg-[#FFCC00]'}`}
                style={{ width: `${Math.min((kpi.value / kpi.target) * 100, 100)}%` }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
