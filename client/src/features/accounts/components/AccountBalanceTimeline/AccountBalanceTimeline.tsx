import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { api, type Account, type BalanceHistoryEntry } from '@/api';
import { cn } from '@/lib/utils';
import { TrendingUp, Loader2 } from 'lucide-react';
import type { MergedPoint } from './types';
import {
  LINE_COLORS,
  MAX_SELECTED,
  CHART_W,
  CHART_H,
  PAD_L,
  PAD_R,
  PAD_T,
  PLOT_W,
  PLOT_H,
} from './constants';
import { formatCurrency, formatDateLabel, formatDateFull } from './utils';

export function AccountBalanceTimeline() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [balanceData, setBalanceData] = useState<Map<string, BalanceHistoryEntry[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const accts = await api.fetchAccounts();
      setAccounts(accts);

      // Auto-select first accounts (up to MAX_SELECTED)
      const autoSelected = new Set(accts.slice(0, MAX_SELECTED).map((a: Account) => a.id));
      setSelectedAccounts(autoSelected);

      const balMap = new Map<string, BalanceHistoryEntry[]>();
      await Promise.all(
        accts.map(async (account: Account) => {
          try {
            const history = await api.fetchBalanceHistory(account.id);
            balMap.set(account.id, history);
          } catch {
            balMap.set(account.id, []);
          }
        }),
      );
      setBalanceData(balMap);
    } catch (err) {
      console.error('Failed to load balance timeline:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleAccount = useCallback((accountId: string) => {
    setSelectedAccounts((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) {
        next.delete(accountId);
      } else if (next.size < MAX_SELECTED) {
        next.add(accountId);
      }
      return next;
    });
  }, []);

  // Build a color map: selected account id -> color from LINE_COLORS
  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    let colorIdx = 0;
    for (const acct of accounts) {
      if (selectedAccounts.has(acct.id)) {
        map.set(String(acct.id), LINE_COLORS[colorIdx % LINE_COLORS.length] ?? '#FFCC00');
        colorIdx++;
      }
    }
    return map;
  }, [accounts, selectedAccounts]);

  // Merge all balance history entries into a unified timeline sorted by date
  const mergedData = useMemo((): MergedPoint[] => {
    const dateMap = new Map<string, MergedPoint>();

    for (const [accountId, entries] of balanceData) {
      if (!selectedAccounts.has(accountId)) continue;

      for (const entry of entries) {
        const dateKey = entry.balanceDate;
        if (!dateMap.has(dateKey)) {
          dateMap.set(dateKey, {
            date: dateKey,
            timestamp: new Date(dateKey).getTime(),
            balances: {},
            sources: {},
          });
        }
        const point = dateMap.get(dateKey)!;
        point.balances[accountId] = entry.balance;
        point.sources[accountId] = entry.source;
      }
    }

    return Array.from(dateMap.values()).sort((a, b) => a.timestamp - b.timestamp);
  }, [balanceData, selectedAccounts]);

  // Compute y-axis range and ticks
  const { yMin, yMax, yTicks } = useMemo(() => {
    if (mergedData.length === 0) return { yMin: 0, yMax: 100000, yTicks: [] };

    let min = Infinity;
    let max = -Infinity;

    for (const point of mergedData) {
      for (const val of Object.values(point.balances)) {
        if (val < min) min = val;
        if (val > max) max = val;
      }
    }

    if (min === Infinity) {
      min = 0;
      max = 100000;
    }

    // Add 10% padding
    const range = max - min || 1;
    min = min - range * 0.05;
    max = max + range * 0.05;

    const ticks = Array.from({ length: 5 }, (_, i) => min + ((range * 1.1) / 4) * i);

    return { yMin: min, yMax: max, yTicks: ticks };
  }, [mergedData]);

  // Scale functions
  const xScale = useCallback(
    (i: number) => {
      return PAD_L + (i / Math.max(mergedData.length - 1, 1)) * PLOT_W;
    },
    [mergedData.length],
  );

  const yScale = useCallback(
    (v: number) => {
      return PAD_T + PLOT_H - ((v - yMin) / Math.max(yMax - yMin, 1)) * PLOT_H;
    },
    [yMin, yMax],
  );

  // Build line data per selected account
  const lineData = useMemo(() => {
    const selectedIds = Array.from(selectedAccounts);
    return selectedIds.map((accountId) => {
      const color = colorMap.get(accountId) || '#FFCC00';
      const points: Array<{ x: number; y: number; value: number; idx: number; source: string }> =
        [];

      for (let i = 0; i < mergedData.length; i++) {
        const entry = mergedData[i];
        if (!entry) continue;
        const val = entry.balances[accountId];
        if (val === undefined) continue;
        points.push({
          x: xScale(i),
          y: yScale(val),
          value: val,
          idx: i,
          source: entry.sources[accountId] || 'calculated',
        });
      }

      return { accountId, color, points };
    });
  }, [mergedData, selectedAccounts, colorMap, xScale, yScale]);

  // X-axis labels: pick up to 7 evenly spaced
  const xLabels = useMemo(() => {
    if (mergedData.length === 0) return [];
    const count = Math.min(7, mergedData.length);
    return Array.from({ length: count }, (_, i) => {
      const idx = Math.round((i * (mergedData.length - 1)) / Math.max(count - 1, 1));
      const point = mergedData[idx];
      return { idx, label: formatDateLabel(point?.date ?? '') };
    });
  }, [mergedData]);

  // Handle mouse move over SVG for hover tracking
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (mergedData.length === 0 || !svgRef.current) return;

      const svgRect = svgRef.current.getBoundingClientRect();
      const mouseX = ((e.clientX - svgRect.left) / svgRect.width) * CHART_W;

      if (mouseX < PAD_L || mouseX > CHART_W - PAD_R) {
        setHoveredIndex(null);
        return;
      }

      // Find nearest data index
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < mergedData.length; i++) {
        const px = xScale(i);
        const dist = Math.abs(px - mouseX);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      }
      setHoveredIndex(bestIdx);
    },
    [mergedData, xScale],
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredIndex(null);
  }, []);

  // -- Render --

  if (loading) {
    return (
      <div className="neu-raised rounded-3xl p-8 border border-white/5 flex items-center justify-center min-h-[300px]">
        <Loader2 className="w-6 h-6 text-[#FFCC00] animate-spin" />
      </div>
    );
  }

  if (accounts.length === 0 || mergedData.length === 0) {
    return (
      <div className="neu-raised rounded-3xl p-10 text-center border border-white/5">
        <div className="neu-inset w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center">
          <TrendingUp className="w-10 h-10 text-zinc-800" />
        </div>
        <h3 className="font-black text-zinc-200 uppercase tracking-widest text-sm">
          No Balance Data
        </h3>
        <p className="text-xs text-zinc-600 mt-2 font-bold uppercase tracking-tight">
          Upload bank statements to see account balances over time.
        </p>
      </div>
    );
  }

  const hoveredPoint = hoveredIndex !== null ? mergedData[hoveredIndex] : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#FFCC00]" />
          <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">
            Balance Timeline
          </span>
        </div>
        <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider">
          {selectedAccounts.size}/{MAX_SELECTED} accounts
        </span>
      </div>

      {/* Chart */}
      <div className="neu-raised rounded-2xl border border-white/5 p-4">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          className="w-full h-auto"
          style={{ maxHeight: 420 }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* Y-axis grid lines and labels */}
          {yTicks.map((tick, i) => {
            const y = yScale(tick);
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

          {/* X-axis date labels */}
          {xLabels.map(({ idx, label }) => (
            <text
              key={idx}
              x={xScale(idx)}
              y={CHART_H - 8}
              textAnchor="middle"
              fill="#71717a"
              className="text-[8px]"
            >
              {label}
            </text>
          ))}

          {/* Lines per selected account */}
          {lineData.map((line) => (
            <g key={line.accountId}>
              {/* Polyline */}
              <polyline
                points={line.points.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke={line.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                className="transition-opacity duration-200"
                style={{
                  opacity: hoveredIndex !== null ? 0.6 : 1,
                }}
              />

              {/* Data point circles + diamond markers for statement source */}
              {line.points.map((p, pi) => {
                const isHovered = hoveredIndex === p.idx;
                const isStatement = p.source === 'statement';

                return (
                  <g key={pi}>
                    {/* Diamond marker for statement-source balance points */}
                    {isStatement && (
                      <polygon
                        points={`${p.x},${p.y - 6} ${p.x + 4},${p.y} ${p.x},${p.y + 6} ${p.x - 4},${p.y}`}
                        fill={line.color}
                        stroke="#0a0a0f"
                        strokeWidth={1.5}
                        opacity={isHovered ? 1 : 0.7}
                      />
                    )}

                    {/* Circle for hover state (all points) */}
                    {isHovered && (
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={5}
                        fill={line.color}
                        stroke="#0a0a0f"
                        strokeWidth={2}
                      />
                    )}
                  </g>
                );
              })}
            </g>
          ))}

          {/* Hover vertical guide line */}
          {hoveredIndex !== null && (
            <line
              x1={xScale(hoveredIndex)}
              y1={PAD_T}
              x2={xScale(hoveredIndex)}
              y2={PAD_T + PLOT_H}
              stroke="rgba(255,204,0,0.2)"
              strokeDasharray="4,4"
            />
          )}
        </svg>

        {/* Hover tooltip detail panel */}
        {hoveredPoint && (
          <div className="mt-3 p-3 neu-inset rounded-xl border border-white/5">
            <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-2">
              {formatDateFull(hoveredPoint.date)}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {Array.from(selectedAccounts).map((accountId) => {
                const balance = hoveredPoint.balances[accountId];
                if (balance === undefined) return null;
                const acct = accounts.find((a) => a.id === accountId);
                const color = colorMap.get(accountId) || '#FFCC00';
                const source = hoveredPoint.sources[accountId];

                return (
                  <div key={accountId} className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-[9px] text-zinc-400 truncate">
                      {acct?.accountName || 'Account'}
                    </span>
                    <div className="ml-auto flex items-center gap-1.5">
                      <span className="text-[9px] font-bold text-zinc-200 tabular-nums">
                        {formatCurrency(balance)}
                      </span>
                      {source === 'statement' && (
                        <svg width="8" height="8" viewBox="0 0 8 8" className="flex-shrink-0">
                          <polygon points="4,0 8,4 4,8 0,4" fill={color} />
                        </svg>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Account selection toggles */}
      <div className="flex flex-wrap gap-2">
        {accounts.map((account) => {
          const isSelected = selectedAccounts.has(account.id);
          const color = colorMap.get(account.id);
          const canSelect = isSelected || selectedAccounts.size < MAX_SELECTED;

          return (
            <button
              key={account.id}
              type="button"
              onClick={() => canSelect && toggleAccount(account.id)}
              disabled={!canSelect}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-bold transition-all border',
                isSelected
                  ? 'border-white/20 bg-white/5 text-zinc-200'
                  : canSelect
                    ? 'border-transparent text-zinc-600 hover:text-zinc-400'
                    : 'border-transparent text-zinc-700 opacity-40 cursor-not-allowed',
              )}
            >
              <div
                className={cn(
                  'w-2.5 h-2.5 rounded-full transition-opacity',
                  isSelected ? 'opacity-100' : 'opacity-30',
                )}
                style={{ backgroundColor: isSelected ? color : '#3f3f46' }}
              />
              {account.accountName}
              <span className="text-[8px] text-zinc-600 uppercase">{account.accountType}</span>
            </button>
          );
        })}
      </div>

      {/* Legend for diamond markers */}
      <div className="flex items-center gap-3 px-1">
        <div className="flex items-center gap-1.5">
          <svg width="10" height="10" viewBox="0 0 10 10">
            <polygon points="5,1 9,5 5,9 1,5" fill="#FFCC00" stroke="#0a0a0f" strokeWidth="1" />
          </svg>
          <span className="text-[8px] text-zinc-600 font-bold uppercase tracking-wider">
            Statement balance
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-zinc-500" />
          <span className="text-[8px] text-zinc-600 font-bold uppercase tracking-wider">
            Calculated / Manual
          </span>
        </div>
      </div>
    </div>
  );
}
