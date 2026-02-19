import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '../../../../lib/utils';
import { Sparkline } from '@/components/charts';
import { formatCurrency } from '../../../../utils/formatters';

interface KPICardProps {
  label: string;
  value: number;
  previousValue?: number;
  format?: 'currency' | 'number' | 'percent';
}

export function KPICard({ label, value, previousValue, format = 'currency' }: KPICardProps) {
  const formatValue = (v: number) => {
    switch (format) {
      case 'currency':
        return formatCurrency(v);
      case 'percent':
        return `${v.toFixed(1)}%`;
      default:
        return v.toLocaleString('en-AU');
    }
  };

  const change =
    previousValue != null ? ((value - previousValue) / Math.abs(previousValue || 1)) * 100 : null;
  const trend = change != null ? (change > 0 ? 'up' : change < 0 ? 'down' : 'flat') : null;

  const sparkData = [38, 42, 39, 44, 47, 45, 50, 48, 52, 55];

  return (
    <div className="flex flex-col items-center justify-center h-full py-4 gap-2">
      <span className="text-xs font-bold text-muted uppercase tracking-wider">{label}</span>
      <span className="text-2xl font-bold text-zinc-100">{formatValue(value)}</span>
      {change != null && (
        <div
          className={cn(
            'flex items-center gap-1 text-xs font-bold',
            trend === 'up' && 'text-emerald-400',
            trend === 'down' && 'text-red-400',
            trend === 'flat' && 'text-secondary',
          )}
        >
          {trend === 'up' && <TrendingUp className="w-3 h-3" />}
          {trend === 'down' && <TrendingDown className="w-3 h-3" />}
          {trend === 'flat' && <Minus className="w-3 h-3" />}
          {change > 0 ? '+' : ''}
          {change.toFixed(1)}%
        </div>
      )}
      <Sparkline
        data={sparkData}
        width={120}
        height={24}
        trend={trend === 'up' ? 'up' : trend === 'down' ? 'down' : 'flat'}
        showArea
      />
    </div>
  );
}
