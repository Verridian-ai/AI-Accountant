import { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { reportsApi } from '@/api';
import type { BalanceSheetReport } from '@/api';

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);

interface Props {
  asAtDate: string;
}

interface SectionItem {
  name?: string;
  category?: string;
  amount: number;
}

function SectionColumn({
  title,
  items,
  total,
  colorClass,
}: {
  title: string;
  items: SectionItem[];
  total: number;
  colorClass: string;
}) {
  return (
    <div className="neu-raised rounded-2xl p-5 flex flex-col">
      <h3 className={`text-sm font-bold uppercase tracking-wider mb-4 ${colorClass}`}>{title}</h3>
      <div className="flex-1 space-y-1">
        {items.length === 0 ? (
          <p className="text-xs text-zinc-600 italic">No items</p>
        ) : (
          items.map((item) => (
            <div
              key={item.name ?? item.category ?? 'unknown'}
              className="flex justify-between py-1.5 border-b border-border/50"
            >
              <span className="text-sm text-primary">{item.name ?? item.category}</span>
              <span className="text-sm font-mono text-primary">{formatCurrency(item.amount)}</span>
            </div>
          ))
        )}
      </div>
      <div className="border-t border-cba-gold/20 mt-4 pt-3 flex justify-between">
        <span className="font-bold text-zinc-100">Total {title}</span>
        <span className={`font-bold font-mono ${colorClass}`}>{formatCurrency(total)}</span>
      </div>
    </div>
  );
}

export function BalanceSheet({ asAtDate }: Props) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<BalanceSheetReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!asAtDate) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    reportsApi
      .fetchBalanceSheet(asAtDate)
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Unknown error'))
      .finally(() => setLoading(false));
  }, [asAtDate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-cba-gold" />
        <span className="ml-3 text-secondary">Loading balance sheet...</span>
      </div>
    );
  }

  if (error) {
    return <div className="neu-inset rounded-2xl p-6 text-center text-red-400">{error}</div>;
  }

  if (!data) {
    return (
      <div className="neu-inset rounded-2xl p-6 text-center text-muted">
        Select a date to generate the Balance Sheet.
      </div>
    );
  }

  // Server returns { items: [{name, amount}], total } for each section
  const assetItems = Array.isArray(data.assets?.items) ? data.assets.items : [];
  const liabilityItems = Array.isArray(data.liabilities?.items) ? data.liabilities.items : [];
  const equityItems = Array.isArray(data.equity?.items) ? data.equity.items : [];

  return (
    <div className="space-y-6">
      {/* Balance Check Indicator */}
      <div
        className={`neu-raised rounded-2xl p-4 flex items-center gap-3 border ${data.isBalanced ? 'border-emerald-500/20' : 'border-red-500/20'}`}
      >
        {data.isBalanced ? (
          <CheckCircle2 className="h-6 w-6 text-emerald-400" />
        ) : (
          <AlertTriangle className="h-6 w-6 text-red-400" />
        )}
        <span className={`font-bold ${data.isBalanced ? 'text-emerald-400' : 'text-red-400'}`}>
          {data.isBalanced
            ? 'Balance Sheet is balanced — Assets = Liabilities + Equity'
            : `Balance Sheet is out of balance (difference: ${formatCurrency(data.totalAssets - data.totalLiabilities - data.totalEquity)})`}
        </span>
        <span className="ml-auto text-xs text-muted">
          As at {new Date(asAtDate).toLocaleDateString('en-AU')}
        </span>
      </div>

      {/* Three-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SectionColumn
          title="Assets"
          items={assetItems}
          total={data.totalAssets}
          colorClass="text-emerald-400"
        />
        <SectionColumn
          title="Liabilities"
          items={liabilityItems}
          total={data.totalLiabilities}
          colorClass="text-red-400"
        />
        <SectionColumn
          title="Equity"
          items={equityItems}
          total={data.totalEquity}
          colorClass="text-cba-gold"
        />
      </div>

      {/* Summary Footer */}
      <div className="neu-raised rounded-2xl p-5">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-muted uppercase tracking-wide mb-1">Total Assets</p>
            <p className="text-lg font-bold font-mono text-emerald-400">
              {formatCurrency(data.totalAssets)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted uppercase tracking-wide mb-1">Total Liabilities</p>
            <p className="text-lg font-bold font-mono text-red-400">
              {formatCurrency(data.totalLiabilities)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted uppercase tracking-wide mb-1">Net Equity</p>
            <p className="text-lg font-bold font-mono text-cba-gold">
              {formatCurrency(data.totalEquity)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
