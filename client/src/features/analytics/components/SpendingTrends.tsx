import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Loader2, TrendingUp, TrendingDown, Minus, LineChart } from 'lucide-react';
import { getCategoryColor } from '@/utils/categoryColors';
import { analyticsApi } from '@/api';
import type { SpendingTrend } from '../types';

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

const COLOR_HEX: Record<string, string> = {
  'red-500': '#ef4444',
  'rose-500': '#f43f5e',
  'pink-500': '#ec4899',
  'fuchsia-500': '#d946ef',
  'purple-500': '#a855f7',
  'violet-500': '#8b5cf6',
  'indigo-500': '#6366f1',
  'blue-500': '#3b82f6',
  'sky-500': '#0ea5e9',
  'cyan-500': '#06b6d4',
  'teal-500': '#14b8a6',
  'emerald-500': '#10b981',
  'green-500': '#22c55e',
  'lime-500': '#84cc16',
  'yellow-500': '#eab308',
  'amber-500': '#f59e0b',
  'orange-500': '#f97316',
  'slate-500': '#64748b',
  'zinc-500': '#71717a',
  'stone-500': '#78716c',
};

function getHexColor(category: string): string {
  const catColor = getCategoryColor(category);
  if (!catColor) return '#FFCC00';
  const dotClass = catColor.dot.replace('bg-', '');
  return COLOR_HEX[dotClass] || '#FFCC00';
}

export function SpendingTrends() {
  const [trends, setTrends] = useState<SpendingTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState(6);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);

  useEffect(() => {
    loadTrends();
  }, [months]);

  const loadTrends = async () => {
    setLoading(true);
    try {
      const data = await analyticsApi.fetchSpendingTrends(months);
      setTrends(data);
      // Auto-select top 5 categories
      const totals = new Map<string, number>();
      data.forEach((t) => {
        Object.entries(t.categories).forEach(([cat, amt]) => {
          totals.set(cat, (totals.get(cat) || 0) + amt);
        });
      });
      const top5 = [...totals.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([c]) => c);
      setSelectedCategories(new Set(top5));
    } catch (err) {
      console.error('Failed to fetch spending trends:', err);
    } finally {
      setLoading(false);
    }
  };

  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    trends.forEach((t) => Object.keys(t.categories).forEach((c) => cats.add(c)));
    return Array.from(cats).sort();
  }, [trends]);

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) => {
      const n = new Set(prev);
      if (n.has(cat)) n.delete(cat);
      else n.add(cat);
      return n;
    });
  };

  // Chart dimensions
  const CHART_W = 600,
    CHART_H = 300;
  const PAD_L = 60,
    PAD_R = 20,
    PAD_T = 20,
    PAD_B = 40;
  const PLOT_W = CHART_W - PAD_L - PAD_R;
  const PLOT_H = CHART_H - PAD_T - PAD_B;

  const { maxValue, yTicks, lines } = useMemo(() => {
    if (trends.length === 0) return { maxValue: 0, yTicks: [], lines: [] };

    let max = 0;
    trends.forEach((t) => {
      selectedCategories.forEach((cat) => {
        const v = t.categories[cat] || 0;
        if (v > max) max = v;
      });
    });
    max = max * 1.1 || 1;

    const ticks = Array.from({ length: 5 }, (_, i) => (max / 4) * i);

    const lineData = Array.from(selectedCategories).map((cat) => {
      const color = getHexColor(cat);
      const points = trends.map((t, i) => {
        const x = PAD_L + (i / Math.max(trends.length - 1, 1)) * PLOT_W;
        const y = PAD_T + PLOT_H - ((t.categories[cat] || 0) / max) * PLOT_H;
        return { x, y, value: t.categories[cat] || 0, month: t.month };
      });
      return { category: cat, color, points };
    });

    return { maxValue: max, yTicks: ticks, lines: lineData };
  }, [trends, selectedCategories]);

  // Month-over-month change for selected categories
  const momChanges = useMemo(() => {
    if (trends.length < 2) return [];
    const last = trends[trends.length - 1];
    const prev = trends[trends.length - 2];
    if (!last || !prev) return [];

    return Array.from(selectedCategories).map((cat) => {
      const current = last.categories[cat] || 0;
      const previous = prev.categories[cat] || 0;
      const change = previous > 0 ? ((current - previous) / previous) * 100 : 0;
      return { category: cat, current, previous, change, color: getHexColor(cat) };
    });
  }, [trends, selectedCategories]);

  if (loading) {
    return (
      <div className="neu-raised rounded-3xl p-8 border border-border/50 flex items-center justify-center min-h-[300px]">
        <Loader2 className="w-6 h-6 text-cba-gold animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <LineChart className="w-4 h-4 text-cba-gold" />
          <span className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">
            Spending Trends
          </span>
        </div>
        <div className="flex gap-1 neu-inset rounded-xl p-1">
          {[6, 12].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMonths(m)}
              className={cn(
                'px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all',
                months === m ? 'bg-cba-gold text-base' : 'text-muted hover:text-primary',
              )}
            >
              {m}m
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="neu-raised rounded-2xl border border-border/50 p-4">
        <svg
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          className="w-full h-auto"
          style={{ maxHeight: 400 }}
        >
          {/* Y-axis grid lines + labels */}
          {yTicks.map((tick, i) => {
            const y = PAD_T + PLOT_H - (tick / maxValue) * PLOT_H;
            return (
              <g key={i}>
                <line
                  x1={PAD_L}
                  y1={y}
                  x2={CHART_W - PAD_R}
                  y2={y}
                  stroke="rgba(255,255,255,0.05)"
                />
                <text
                  x={PAD_L - 8}
                  y={y + 3}
                  textAnchor="end"
                  fill="#71717a"
                  className="text-[8px]"
                >
                  {formatCurrency(tick)}
                </text>
              </g>
            );
          })}

          {/* X-axis labels */}
          {trends.map((t, i) => {
            const x = PAD_L + (i / Math.max(trends.length - 1, 1)) * PLOT_W;
            return (
              <text
                key={i}
                x={x}
                y={CHART_H - 8}
                textAnchor="middle"
                fill="#71717a"
                className="text-[8px]"
              >
                {t.month}
              </text>
            );
          })}

          {/* Lines */}
          {lines.map((line) => (
            <g key={line.category}>
              <polyline
                points={line.points.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke={line.color}
                strokeWidth={2}
                strokeLinejoin="round"
                className="transition-opacity duration-200"
              />
              {/* Data points */}
              {line.points.map((p, i) => (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={hoveredMonth === i ? 5 : 3}
                  fill={line.color}
                  stroke="#0a0a0f"
                  strokeWidth={2}
                  className="cursor-pointer transition-all"
                  onMouseEnter={() => setHoveredMonth(i)}
                  onMouseLeave={() => setHoveredMonth(null)}
                />
              ))}
            </g>
          ))}

          {/* Hover tooltip */}
          {hoveredMonth !== null && trends[hoveredMonth] && (
            <g>
              <line
                x1={PAD_L + (hoveredMonth / Math.max(trends.length - 1, 1)) * PLOT_W}
                y1={PAD_T}
                x2={PAD_L + (hoveredMonth / Math.max(trends.length - 1, 1)) * PLOT_W}
                y2={PAD_T + PLOT_H}
                stroke="rgba(255,204,0,0.2)"
                strokeDasharray="4,4"
              />
            </g>
          )}
        </svg>

        {/* Hover detail */}
        {hoveredMonth !== null && trends[hoveredMonth] && (
          <div className="mt-3 p-3 neu-inset rounded-xl border border-border/50">
            <p className="text-[9px] font-black text-secondary uppercase tracking-widest mb-2">
              {trends[hoveredMonth]?.month}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Array.from(selectedCategories).map((cat) => (
                <div key={cat} className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: getHexColor(cat) }}
                  />
                  <span className="text-[9px] text-secondary truncate">{cat}</span>
                  <span className="text-[9px] font-bold text-primary ml-auto tabular-nums">
                    {formatCurrency(trends[hoveredMonth]?.categories[cat] || 0)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Category checkboxes */}
      <div className="flex flex-wrap gap-2">
        {allCategories.map((cat) => {
          const active = selectedCategories.has(cat);
          return (
            <button
              key={cat}
              type="button"
              onClick={() => toggleCategory(cat)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-bold transition-all border',
                active
                  ? 'border-border bg-overlay text-primary'
                  : 'border-transparent text-zinc-600 hover:text-secondary',
              )}
            >
              <div
                className={cn(
                  'w-2.5 h-2.5 rounded-full transition-opacity',
                  active ? 'opacity-100' : 'opacity-30',
                )}
                style={{ backgroundColor: getHexColor(cat) }}
              />
              {cat}
            </button>
          );
        })}
      </div>

      {/* MoM Changes */}
      {momChanges.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {momChanges.map((mc) => (
            <div key={mc.category} className="neu-inset rounded-xl p-3 border border-border/50">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: mc.color }} />
                <span className="text-[8px] font-bold text-muted uppercase tracking-tight truncate">
                  {mc.category}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {mc.change > 5 ? (
                  <TrendingUp className="w-3 h-3 text-red-400" />
                ) : mc.change < -5 ? (
                  <TrendingDown className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Minus className="w-3 h-3 text-muted" />
                )}
                <span
                  className={cn(
                    'text-xs font-black tabular-nums',
                    mc.change > 5
                      ? 'text-red-400'
                      : mc.change < -5
                        ? 'text-emerald-400'
                        : 'text-muted',
                  )}
                >
                  {mc.change > 0 ? '+' : ''}
                  {mc.change.toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
