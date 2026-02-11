import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Loader2, TrendingUp, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { analyticsApi } from '@/api';
import type { CashFlowForecast as CashFlowData } from '../types';

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(cents / 100);
}

export function CashFlowForecast() {
  const [forecast, setForecast] = useState<CashFlowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState(3);

  useEffect(() => {
    loadForecast();
  }, [months]);

  const loadForecast = async () => {
    setLoading(true);
    try {
      const data = await analyticsApi.fetchCashFlowForecast(months);
      setForecast(data);
    } catch (err) {
      console.error('Failed to fetch cash flow forecast:', err);
    } finally {
      setLoading(false);
    }
  };

  const hasNegative = forecast.some(f => f.lowerBound < 0 || f.projectedBalance < 0);

  // Chart dimensions
  const CHART_W = 600, CHART_H = 300;
  const PAD_L = 70, PAD_R = 20, PAD_T = 20, PAD_B = 40;
  const PLOT_W = CHART_W - PAD_L - PAD_R;
  const PLOT_H = CHART_H - PAD_T - PAD_B;

  const { minVal, maxVal, yTicks } = useMemo(() => {
    if (forecast.length === 0) return { minVal: 0, maxVal: 0, yTicks: [] };
    let min = Infinity, max = -Infinity;
    forecast.forEach(f => {
      if (f.lowerBound < min) min = f.lowerBound;
      if (f.upperBound > max) max = f.upperBound;
      if (f.projectedBalance < min) min = f.projectedBalance;
      if (f.projectedBalance > max) max = f.projectedBalance;
    });
    const padding = (max - min) * 0.1 || 1000;
    min -= padding;
    max += padding;

    const range = max - min;
    const ticks = Array.from({ length: 5 }, (_, i) => min + (range / 4) * i);
    return { minVal: min, maxVal: max, yTicks: ticks };
  }, [forecast]);

  const getX = (i: number) => PAD_L + (i / Math.max(forecast.length - 1, 1)) * PLOT_W;
  const getY = (val: number) => PAD_T + PLOT_H - ((val - minVal) / (maxVal - minVal || 1)) * PLOT_H;

  // Build paths
  const mainLine = forecast.map((f, i) => `${getX(i)},${getY(f.projectedBalance)}`).join(' ');
  const upperLine = forecast.map((f, i) => `${getX(i)},${getY(f.upperBound)}`);
  const lowerLine = forecast.map((f, i) => `${getX(i)},${getY(f.lowerBound)}`);
  const bandPath = upperLine.length > 0
    ? `M ${upperLine.join(' L ')} L ${lowerLine.reverse().join(' L ')} Z`
    : '';

  // Find the split point between historical (confidence=1) and projected
  const splitIndex = forecast.findIndex(f => f.confidence < 1);
  const historicalLine = splitIndex > 0
    ? forecast.slice(0, splitIndex + 1).map((f, i) => `${getX(i)},${getY(f.projectedBalance)}`).join(' ')
    : mainLine;
  const projectedLine = splitIndex > 0
    ? forecast.slice(splitIndex).map((f, i) => `${getX(splitIndex + i)},${getY(f.projectedBalance)}`).join(' ')
    : '';

  // Zero line y-coordinate
  const zeroY = getY(0);

  if (loading) {
    return (
      <div className="neu-raised rounded-3xl p-8 border border-white/5 flex items-center justify-center min-h-[300px]">
        <Loader2 className="w-6 h-6 text-[#FFCC00] animate-spin" />
      </div>
    );
  }

  if (forecast.length === 0) {
    return (
      <div className="neu-raised rounded-3xl p-10 text-center border border-white/5">
        <div className="neu-inset w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center">
          <TrendingUp className="w-10 h-10 text-zinc-800" />
        </div>
        <h3 className="font-black text-zinc-200 uppercase tracking-widest text-sm">No Forecast Data</h3>
        <p className="text-xs text-zinc-600 mt-2 font-bold uppercase tracking-tight">
          Need more historical data to generate forecasts.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#FFCC00]" />
          <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Cash Flow Forecast</span>
        </div>
        <div className="flex items-center gap-3">
          {hasNegative && (
            <Badge variant="destructive" className="text-[9px]">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Negative balance projected
            </Badge>
          )}
          <div className="flex gap-1 neu-inset rounded-xl p-1">
            {[3, 6].map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setMonths(m)}
                className={cn(
                  "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                  months === m ? "bg-[#FFCC00] text-[#0a0a0f]" : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                {m}m
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="neu-raised rounded-2xl border border-white/5 p-4">
        <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full h-auto" style={{ maxHeight: 400 }}>
          {/* Y-axis grid */}
          {yTicks.map((tick, i) => {
            const y = getY(tick);
            return (
              <g key={i}>
                <line x1={PAD_L} y1={y} x2={CHART_W - PAD_R} y2={y} stroke="rgba(255,255,255,0.05)" />
                <text x={PAD_L - 8} y={y + 3} textAnchor="end" fill="#71717a" className="text-[8px]">
                  {formatCurrency(tick)}
                </text>
              </g>
            );
          })}

          {/* Zero line */}
          {minVal < 0 && maxVal > 0 && (
            <line x1={PAD_L} y1={zeroY} x2={CHART_W - PAD_R} y2={zeroY} stroke="rgba(239,68,68,0.3)" strokeDasharray="4,4" />
          )}

          {/* Negative zone highlight */}
          {minVal < 0 && (
            <rect
              x={PAD_L}
              y={Math.min(zeroY, PAD_T + PLOT_H)}
              width={PLOT_W}
              height={Math.max(PAD_T + PLOT_H - zeroY, 0)}
              fill="rgba(239,68,68,0.03)"
            />
          )}

          {/* Confidence band */}
          {bandPath && (
            <path d={bandPath} fill="rgba(255,204,0,0.08)" stroke="none" />
          )}

          {/* Historical line (solid) */}
          {historicalLine && (
            <polyline
              points={historicalLine}
              fill="none"
              stroke="#FFCC00"
              strokeWidth={2.5}
              strokeLinejoin="round"
            />
          )}

          {/* Projected line (dashed) */}
          {projectedLine && (
            <polyline
              points={projectedLine}
              fill="none"
              stroke="#FFCC00"
              strokeWidth={2}
              strokeDasharray="8,4"
              strokeLinejoin="round"
              opacity={0.7}
            />
          )}

          {/* Data points */}
          {forecast.map((f, i) => (
            <circle
              key={i}
              cx={getX(i)}
              cy={getY(f.projectedBalance)}
              r={3}
              fill={f.projectedBalance < 0 ? '#ef4444' : '#FFCC00'}
              stroke="#0a0a0f"
              strokeWidth={2}
            />
          ))}

          {/* X-axis labels */}
          {forecast.map((f, i) => (
            <text key={i} x={getX(i)} y={CHART_H - 8} textAnchor="middle" fill="#71717a" className="text-[8px]">
              {f.month}
            </text>
          ))}
        </svg>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 bg-[#FFCC00]" />
            <span className="text-[9px] text-zinc-500">Historical</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 bg-[#FFCC00] opacity-70" style={{ borderTop: '2px dashed #FFCC00', height: 0 }} />
            <span className="text-[9px] text-zinc-500">Projected</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-3 bg-[#FFCC00]/10 rounded" />
            <span className="text-[9px] text-zinc-500">Confidence Band</span>
          </div>
        </div>
      </div>

      {/* Data table */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {forecast.slice(-6).map((f, i) => (
          <div key={i} className={cn(
            "neu-inset rounded-xl p-3 border text-center",
            f.projectedBalance < 0 ? "border-red-500/20" : "border-white/5"
          )}>
            <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">{f.month}</p>
            <p className={cn(
              "text-xs font-black mt-1 tabular-nums",
              f.projectedBalance < 0 ? "text-red-400" : "text-emerald-400"
            )}>
              {formatCurrency(f.projectedBalance)}
            </p>
            <p className="text-[7px] text-zinc-700 mt-0.5">{Math.round(f.confidence * 100)}% conf</p>
          </div>
        ))}
      </div>
    </div>
  );
}
