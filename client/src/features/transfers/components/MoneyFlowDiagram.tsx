import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Loader2, GitBranch } from 'lucide-react';
import { analyticsApi } from '@/api';
import type { MoneyFlow } from '../types';

const PERIODS = ['1m', '3m', '6m', '12m'] as const;

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

interface AccountNode {
  id: number;
  name: string;
  totalIn: number;
  totalOut: number;
}

export function MoneyFlowDiagram() {
  const [flows, setFlows] = useState<MoneyFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<string>('3m');
  const [hoveredFlow, setHoveredFlow] = useState<number | null>(null);

  useEffect(() => {
    loadFlows();
  }, [period]);

  const loadFlows = async () => {
    setLoading(true);
    try {
      const data = await analyticsApi.fetchMoneyFlow(period);
      setFlows(data);
    } catch (err) {
      console.error('Failed to fetch money flow:', err);
    } finally {
      setLoading(false);
    }
  };

  const { accounts, maxAmount } = useMemo(() => {
    const accountMap = new Map<number, AccountNode>();
    let max = 0;

    flows.forEach((f) => {
      if (!accountMap.has(f.fromAccountId)) {
        accountMap.set(f.fromAccountId, {
          id: f.fromAccountId,
          name: f.fromAccountName,
          totalIn: 0,
          totalOut: 0,
        });
      }
      if (!accountMap.has(f.toAccountId)) {
        accountMap.set(f.toAccountId, {
          id: f.toAccountId,
          name: f.toAccountName,
          totalIn: 0,
          totalOut: 0,
        });
      }
      accountMap.get(f.fromAccountId)!.totalOut += f.totalAmount;
      accountMap.get(f.toAccountId)!.totalIn += f.totalAmount;
      if (f.totalAmount > max) max = f.totalAmount;
    });

    return { accounts: Array.from(accountMap.values()), maxAmount: max };
  }, [flows]);

  const SVG_WIDTH = 600;
  const SVG_HEIGHT = Math.max(300, accounts.length * 80 + 60);
  const NODE_R = 24;
  const LEFT_X = 80;
  const RIGHT_X = SVG_WIDTH - 80;

  // Build unique left/right account lists
  const leftAccounts = accounts.filter((a) => a.totalOut > 0);
  const rightAccounts = accounts.filter((a) => a.totalIn > 0);

  const getY = (index: number, total: number): number => {
    const spacing = (SVG_HEIGHT - 60) / Math.max(total, 1);
    return 30 + spacing * index + spacing / 2;
  };

  if (loading) {
    return (
      <div className="neu-raised rounded-3xl p-8 border border-white/5 flex items-center justify-center min-h-[300px]">
        <Loader2 className="w-6 h-6 text-[#FFCC00] animate-spin" />
      </div>
    );
  }

  if (flows.length === 0) {
    return (
      <div className="neu-raised rounded-3xl p-10 text-center border border-white/5">
        <div className="neu-inset w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center">
          <GitBranch className="w-10 h-10 text-zinc-800" />
        </div>
        <h3 className="font-black text-zinc-200 uppercase tracking-widest text-sm">No Flow Data</h3>
        <p className="text-xs text-zinc-600 mt-2 font-bold uppercase tracking-tight">
          Transfer data needed to visualize money flow.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-[#FFCC00]" />
          <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">
            Money Flow
          </span>
        </div>
        <div className="flex gap-1 neu-inset rounded-xl p-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={cn(
                'px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all',
                period === p ? 'bg-[#FFCC00] text-[#0a0a0f]' : 'text-zinc-500 hover:text-zinc-300',
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* SVG Diagram */}
      <div className="neu-raised rounded-2xl border border-white/5 overflow-hidden p-4">
        <svg
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          className="w-full h-auto"
          style={{ maxHeight: 500 }}
        >
          {/* Flow arrows */}
          {flows.map((flow, i) => {
            const leftIdx = leftAccounts.findIndex((a) => a.id === flow.fromAccountId);
            const rightIdx = rightAccounts.findIndex((a) => a.id === flow.toAccountId);
            if (leftIdx === -1 || rightIdx === -1) return null;

            const y1 = getY(leftIdx, leftAccounts.length);
            const y2 = getY(rightIdx, rightAccounts.length);
            const thickness = Math.max(2, (flow.totalAmount / maxAmount) * 16);
            const isHovered = hoveredFlow === i;

            return (
              <g
                key={i}
                onMouseEnter={() => setHoveredFlow(i)}
                onMouseLeave={() => setHoveredFlow(null)}
                className="cursor-pointer"
              >
                <path
                  d={`M ${LEFT_X + NODE_R + 4} ${y1} C ${SVG_WIDTH / 2} ${y1}, ${SVG_WIDTH / 2} ${y2}, ${RIGHT_X - NODE_R - 4} ${y2}`}
                  fill="none"
                  stroke={isHovered ? '#FFCC00' : 'rgba(255,204,0,0.2)'}
                  strokeWidth={thickness}
                  strokeLinecap="round"
                  className="transition-all duration-300"
                  opacity={isHovered ? 1 : 0.6}
                />
                {/* Amount label at midpoint */}
                <text
                  x={SVG_WIDTH / 2}
                  y={(y1 + y2) / 2 - thickness / 2 - 4}
                  textAnchor="middle"
                  className={cn(
                    'text-[10px] font-bold transition-opacity duration-200',
                    isHovered ? 'opacity-100' : 'opacity-0',
                  )}
                  fill="#FFCC00"
                >
                  {formatCurrency(flow.totalAmount)} ({flow.transactionCount}x)
                </text>
              </g>
            );
          })}

          {/* Left nodes (senders) */}
          {leftAccounts.map((account, i) => {
            const y = getY(i, leftAccounts.length);
            return (
              <g key={`left-${account.id}`}>
                <circle
                  cx={LEFT_X}
                  cy={y}
                  r={NODE_R}
                  fill="#1a1a24"
                  stroke="rgba(255,204,0,0.3)"
                  strokeWidth={2}
                />
                <text
                  x={LEFT_X}
                  y={y + 1}
                  textAnchor="middle"
                  fill="#f5f5f7"
                  className="text-[9px] font-bold"
                >
                  {account.name.slice(0, 4)}
                </text>
                <text
                  x={LEFT_X - NODE_R - 6}
                  y={y + 1}
                  textAnchor="end"
                  fill="#a1a1aa"
                  className="text-[8px] font-bold"
                >
                  {account.name}
                </text>
              </g>
            );
          })}

          {/* Right nodes (receivers) */}
          {rightAccounts.map((account, i) => {
            const y = getY(i, rightAccounts.length);
            return (
              <g key={`right-${account.id}`}>
                <circle
                  cx={RIGHT_X}
                  cy={y}
                  r={NODE_R}
                  fill="#1a1a24"
                  stroke="rgba(16,185,129,0.3)"
                  strokeWidth={2}
                />
                <text
                  x={RIGHT_X}
                  y={y + 1}
                  textAnchor="middle"
                  fill="#f5f5f7"
                  className="text-[9px] font-bold"
                >
                  {account.name.slice(0, 4)}
                </text>
                <text
                  x={RIGHT_X + NODE_R + 6}
                  y={y + 1}
                  textAnchor="start"
                  fill="#a1a1aa"
                  className="text-[8px] font-bold"
                >
                  {account.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Flow Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {flows.slice(0, 6).map((flow, i) => (
          <div key={i} className="neu-inset rounded-xl p-3 border border-white/5">
            <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest truncate">
              {flow.fromAccountName} → {flow.toAccountName}
            </p>
            <p className="text-sm font-black text-[#FFCC00] mt-1">
              {formatCurrency(flow.totalAmount)}
            </p>
            <p className="text-[8px] text-zinc-600 mt-0.5">{flow.transactionCount} transfers</p>
          </div>
        ))}
      </div>
    </div>
  );
}
