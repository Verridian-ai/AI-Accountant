import { useState, useEffect } from 'react';
import { Loader2, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { reportsApi } from '@/api';
import type { CashFlowReport } from '@/api';

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);

interface Props {
  periodStart: string;
  periodEnd: string;
}

interface FlowItem {
  category: string;
  amount: number;
}

function FlowSection({ title, items, total }: { title: string; items: FlowItem[]; total: number }) {
  const inflows = items.filter((i) => i.amount > 0);
  const outflows = items.filter((i) => i.amount < 0);

  return (
    <div className="neu-raised rounded-2xl p-5">
      <h3 className="text-sm font-bold uppercase tracking-wider text-cba-gold mb-4">{title}</h3>

      {inflows.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-muted font-medium uppercase tracking-wide mb-2 flex items-center gap-1">
            <ArrowUpRight className="h-3 w-3 text-emerald-400" /> Inflows
          </p>
          {inflows.map((item) => (
            <div
              key={item.category}
              className="flex justify-between py-1.5 border-b border-border/50"
            >
              <span className="text-sm text-primary">{item.category}</span>
              <span className="text-sm font-mono text-emerald-400">
                +{formatCurrency(item.amount)}
              </span>
            </div>
          ))}
        </div>
      )}

      {outflows.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-muted font-medium uppercase tracking-wide mb-2 flex items-center gap-1">
            <ArrowDownRight className="h-3 w-3 text-red-400" /> Outflows
          </p>
          {outflows.map((item) => (
            <div
              key={item.category}
              className="flex justify-between py-1.5 border-b border-border/50"
            >
              <span className="text-sm text-primary">{item.category}</span>
              <span className="text-sm font-mono text-red-400">{formatCurrency(item.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {items.length === 0 && (
        <p className="text-xs text-zinc-600 italic">No cash flows in this period</p>
      )}

      <div className="border-t border-cba-gold/20 mt-2 pt-3 flex justify-between">
        <span className="font-bold text-zinc-100">Net {title}</span>
        <span className={`font-bold font-mono ${total >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {formatCurrency(total)}
        </span>
      </div>
    </div>
  );
}

export function CashFlow({ periodStart, periodEnd }: Props) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<CashFlowReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!periodStart || !periodEnd) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    reportsApi
      .fetchCashFlow(periodStart, periodEnd)
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Unknown error'))
      .finally(() => setLoading(false));
  }, [periodStart, periodEnd]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-cba-gold" />
        <span className="ml-3 text-secondary">Generating cash flow statement...</span>
      </div>
    );
  }

  if (error) {
    return <div className="neu-inset rounded-2xl p-6 text-center text-red-400">{error}</div>;
  }

  if (!data) {
    return (
      <div className="neu-inset rounded-2xl p-6 text-center text-muted">
        Select a date range to generate the Cash Flow statement.
      </div>
    );
  }

  // Waterfall segments for visual
  const segments = [
    { label: 'Opening', value: data.openingBalance, color: 'bg-zinc-600' },
    {
      label: 'Operating',
      value: data.operating.total,
      color: data.operating.total >= 0 ? 'bg-emerald-500' : 'bg-red-500',
    },
    {
      label: 'Investing',
      value: data.investing.total,
      color: data.investing.total >= 0 ? 'bg-emerald-500' : 'bg-red-500',
    },
    {
      label: 'Financing',
      value: data.financing.total,
      color: data.financing.total >= 0 ? 'bg-emerald-500' : 'bg-red-500',
    },
    { label: 'Closing', value: data.closingBalance, color: 'bg-cba-gold' },
  ];
  const maxVal = Math.max(...segments.map((s) => Math.abs(s.value)), 1);

  return (
    <div className="space-y-6">
      {/* Waterfall Chart */}
      <div className="neu-raised rounded-2xl p-5">
        <h3 className="text-sm font-bold uppercase tracking-wider text-secondary mb-4">
          Cash Flow Waterfall
        </h3>
        <div className="flex items-end gap-3 h-32">
          {segments.map((seg) => {
            const height = Math.max((Math.abs(seg.value) / maxVal) * 100, 8);
            return (
              <div key={seg.label} className="flex-1 flex flex-col items-center gap-1">
                <span
                  className={`text-xs font-mono ${seg.value >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
                >
                  {formatCurrency(seg.value)}
                </span>
                <div
                  className={`w-full rounded-t-lg ${seg.color} transition-all duration-500`}
                  style={{ height: `${height}%`, opacity: 0.8 }}
                />
                <span className="text-[10px] text-muted font-medium">{seg.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Three Flow Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <FlowSection
          title="Operating"
          items={data.operating.items ?? []}
          total={data.operating.total}
        />
        <FlowSection
          title="Investing"
          items={data.investing.items ?? []}
          total={data.investing.total}
        />
        <FlowSection
          title="Financing"
          items={data.financing.items ?? []}
          total={data.financing.total}
        />
      </div>

      {/* Summary */}
      <div className="neu-raised rounded-2xl p-5">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-muted uppercase tracking-wide mb-1">Opening Balance</p>
            <p className="text-lg font-bold font-mono text-primary">
              {formatCurrency(data.openingBalance)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted uppercase tracking-wide mb-1">Net Cash Change</p>
            <p
              className={`text-lg font-bold font-mono ${data.netCashChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
            >
              {data.netCashChange >= 0 ? '+' : ''}
              {formatCurrency(data.netCashChange)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted uppercase tracking-wide mb-1">Closing Balance</p>
            <p className="text-lg font-bold font-mono text-cba-gold">
              {formatCurrency(data.closingBalance)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
