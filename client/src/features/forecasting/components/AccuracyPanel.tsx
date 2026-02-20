import { useState, useEffect, useCallback } from 'react';
import { forecastApi } from '../../../api';
import { RefreshCw, TrendingUp, Target, AlertTriangle, Compass } from 'lucide-react';

interface AccuracyMetrics {
  mae: number;
  rmse: number;
  mape: number;
  directionAccuracy: number;
}

interface AccuracyPanelProps {
  forecastId: string;
}

function ratingColor(metric: string, value: number): string {
  if (metric === 'directionAccuracy') {
    if (value >= 80) return 'text-emerald-400';
    if (value >= 60) return 'text-yellow-400';
    return 'text-red-400';
  }
  if (metric === 'mape') {
    if (value <= 10) return 'text-emerald-400';
    if (value <= 25) return 'text-yellow-400';
    return 'text-red-400';
  }
  // MAE / RMSE — lower is better, thresholds are domain-specific
  return 'text-zinc-100';
}

function ratingBg(metric: string, value: number): string {
  if (metric === 'directionAccuracy') {
    if (value >= 80) return 'border-emerald-500/20';
    if (value >= 60) return 'border-yellow-500/20';
    return 'border-red-500/20';
  }
  if (metric === 'mape') {
    if (value <= 10) return 'border-emerald-500/20';
    if (value <= 25) return 'border-yellow-500/20';
    return 'border-red-500/20';
  }
  return 'border-border';
}

const formatDollar = (cents: number) =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(cents / 100);

export function AccuracyPanel({ forecastId }: AccuracyPanelProps) {
  const [metrics, setMetrics] = useState<AccuracyMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAccuracy = useCallback(async () => {
    if (!forecastId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await forecastApi.calculateAccuracy(forecastId);
      setMetrics(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to calculate accuracy');
    } finally {
      setLoading(false);
    }
  }, [forecastId]);

  useEffect(() => {
    loadAccuracy();
  }, [loadAccuracy]);

  const updateActuals = async () => {
    setLoading(true);
    try {
      await forecastApi.updateActuals(forecastId);
      await loadAccuracy();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update actuals');
    } finally {
      setLoading(false);
    }
  };

  if (!forecastId) {
    return (
      <div className="neu-inset rounded-2xl p-8 text-center text-muted">
        Select a forecast to view accuracy metrics
      </div>
    );
  }

  if (error) {
    return (
      <div className="neu-inset rounded-2xl p-8 text-center">
        <AlertTriangle className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
        <p className="text-secondary text-sm">{error}</p>
        <button onClick={loadAccuracy} className="mt-3 text-xs text-cba-gold hover:underline">
          Retry
        </button>
      </div>
    );
  }

  const cards = metrics
    ? [
        {
          label: 'MAE',
          value: formatDollar(metrics.mae),
          raw: metrics.mae,
          metric: 'mae',
          icon: Target,
          desc: 'Mean Absolute Error',
        },
        {
          label: 'RMSE',
          value: formatDollar(metrics.rmse),
          raw: metrics.rmse,
          metric: 'rmse',
          icon: TrendingUp,
          desc: 'Root Mean Square Error',
        },
        {
          label: 'MAPE',
          value: `${metrics.mape.toFixed(1)}%`,
          raw: metrics.mape,
          metric: 'mape',
          icon: AlertTriangle,
          desc: 'Mean Abs % Error',
        },
        {
          label: 'Direction',
          value: `${metrics.directionAccuracy.toFixed(1)}%`,
          raw: metrics.directionAccuracy,
          metric: 'directionAccuracy',
          icon: Compass,
          desc: 'Direction Accuracy',
        },
      ]
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-zinc-100">Forecast Accuracy</h3>
        <button
          onClick={updateActuals}
          disabled={loading}
          className="neu-raised-sm px-3 py-1.5 rounded-xl text-xs font-bold text-cba-gold hover:bg-overlay transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Update Actuals
        </button>
      </div>

      {loading && !metrics ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="neu-raised rounded-2xl p-5 animate-pulse">
              <div className="h-4 w-16 bg-overlay-hover rounded mb-3" />
              <div className="h-8 w-24 bg-overlay-hover rounded mb-2" />
              <div className="h-3 w-20 bg-overlay rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className={`neu-raised rounded-2xl p-5 border ${ratingBg(card.metric, card.raw)} transition-colors`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="neu-inset p-1.5 rounded-lg">
                    <Icon className={`w-4 h-4 ${ratingColor(card.metric, card.raw)}`} />
                  </div>
                  <span className="text-xs font-bold text-secondary uppercase tracking-wider">
                    {card.label}
                  </span>
                </div>
                <p className={`text-2xl font-bold ${ratingColor(card.metric, card.raw)}`}>
                  {card.value}
                </p>
                <p className="text-[11px] text-muted mt-1">{card.desc}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
