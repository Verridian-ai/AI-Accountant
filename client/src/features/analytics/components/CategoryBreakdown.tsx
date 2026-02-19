import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Loader2, PieChart } from 'lucide-react';
import { getCategoryColor } from '@/utils/categoryColors';
import { analyticsApi } from '@/api';
import type { CategoryBreakdownItem } from '../types';

const PERIODS = ['1m', '3m', '6m', '12m'] as const;

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

// Color mapping from Tailwind class to hex
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
  if (category === 'Other') return '#71717a';
  const catColor = getCategoryColor(category);
  if (!catColor) return '#FFCC00';
  const dotClass = catColor.dot.replace('bg-', '');
  return COLOR_HEX[dotClass] || '#FFCC00';
}

function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angle: number,
): { x: number; y: number } {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

export function CategoryBreakdown() {
  const [items, setItems] = useState<CategoryBreakdownItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<string>('3m');
  const [mode, setMode] = useState<'expenses' | 'income'>('expenses');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [period, mode]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await analyticsApi.fetchCategoryBreakdown(`${period}_${mode}`);
      setItems(data);
    } catch (err) {
      console.error('Failed to fetch category breakdown:', err);
    } finally {
      setLoading(false);
    }
  };

  const segments = useMemo(() => {
    if (items.length === 0) return [];
    const sorted = [...items].sort((a, b) => b.total - a.total);
    let top = sorted.slice(0, 5);
    const rest = sorted.slice(5);

    const displayItems: CategoryBreakdownItem[] = [...top];
    if (rest.length > 0) {
      displayItems.push({
        category: 'Other',
        total: rest.reduce((s, r) => s + r.total, 0),
        percentage: rest.reduce((s, r) => s + r.percentage, 0),
        color: '#71717a',
        transactionCount: rest.reduce((s, r) => s + r.transactionCount, 0),
      });
    }

    let currentAngle = 0;
    return displayItems.map((item) => {
      const angle = Math.max((item.percentage / 100) * 360, 1);
      const segment = {
        ...item,
        startAngle: currentAngle,
        endAngle: currentAngle + angle,
        hexColor: getHexColor(item.category),
      };
      currentAngle += angle;
      return segment;
    });
  }, [items]);

  const total = items.reduce((s, i) => s + i.total, 0);
  const CX = 100,
    CY = 100,
    R = 80,
    INNER_R = 50;

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
          <PieChart className="w-4 h-4 text-cba-gold" />
          <span className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">
            Category Breakdown
          </span>
        </div>
        <div className="flex gap-2">
          <div className="flex gap-1 neu-inset rounded-xl p-1">
            <button
              type="button"
              onClick={() => setMode('expenses')}
              className={cn(
                'px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all',
                mode === 'expenses'
                  ? 'bg-cba-gold text-base'
                  : 'text-muted hover:text-primary',
              )}
            >
              Expenses
            </button>
            <button
              type="button"
              onClick={() => setMode('income')}
              className={cn(
                'px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all',
                mode === 'income'
                  ? 'bg-cba-gold text-base'
                  : 'text-muted hover:text-primary',
              )}
            >
              Income
            </button>
          </div>
          <div className="flex gap-1 neu-inset rounded-xl p-1">
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={cn(
                  'px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all',
                  period === p
                    ? 'bg-cba-gold text-base'
                    : 'text-muted hover:text-primary',
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="neu-raised rounded-2xl border border-border/50 p-6">
        <div className="flex flex-col md:flex-row items-center gap-8">
          {/* Donut Chart */}
          <div className="relative shrink-0">
            <svg width="200" height="200" viewBox="0 0 200 200">
              {segments.map((seg, i) => {
                if (seg.percentage < 0.5) return null;
                const isSelected = selectedCategory === seg.category;
                return (
                  <path
                    key={i}
                    d={describeArc(CX, CY, isSelected ? R + 4 : R, seg.startAngle, seg.endAngle)}
                    fill="none"
                    stroke={seg.hexColor}
                    strokeWidth={isSelected ? INNER_R - 4 : INNER_R - 10}
                    strokeLinecap="butt"
                    className="cursor-pointer transition-all duration-200 hover:opacity-80"
                    onClick={() =>
                      setSelectedCategory(selectedCategory === seg.category ? null : seg.category)
                    }
                    opacity={selectedCategory && !isSelected ? 0.3 : 1}
                  />
                );
              })}
              {/* Center text */}
              <text
                x={CX}
                y={CY - 6}
                textAnchor="middle"
                fill="#f5f5f7"
                className="text-lg font-black"
              >
                {formatCurrency(total)}
              </text>
              <text
                x={CX}
                y={CY + 12}
                textAnchor="middle"
                fill="#71717a"
                className="text-[9px] font-bold uppercase"
              >
                Total
              </text>
            </svg>
          </div>

          {/* Legend */}
          <div className="flex-1 w-full space-y-2">
            {segments.map((seg, i) => (
              <button
                key={i}
                type="button"
                onClick={() =>
                  setSelectedCategory(selectedCategory === seg.category ? null : seg.category)
                }
                className={cn(
                  'w-full flex items-center gap-3 p-2.5 rounded-xl transition-all text-left',
                  selectedCategory === seg.category
                    ? 'neu-inset border border-border'
                    : 'hover:bg-overlay',
                )}
              >
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: seg.hexColor }}
                />
                <span className="text-xs font-bold text-primary flex-1 truncate">
                  {seg.category}
                </span>
                <span className="text-xs font-black text-secondary tabular-nums">
                  {formatCurrency(seg.total)}
                </span>
                <span className="text-[9px] font-bold text-zinc-600 w-10 text-right tabular-nums">
                  {seg.percentage.toFixed(1)}%
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
