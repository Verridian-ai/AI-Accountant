import { useState, useEffect } from 'react';
import { inventoryApi } from '@/api';
import { DollarSign, Loader2, PieChart } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ValuationData {
  totalValueCents: number;
  totalItems: number;
  asOfDate: string;
  categories: Array<{
    category: string;
    itemCount: number;
    totalValueCents: number;
    percentOfTotal: number;
  }>;
}

const formatAUD = (cents: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);

export function ValuationReport() {
  const [data, setData] = useState<ValuationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [asOfDate, setAsOfDate] = useState('');

  const loadValuation = async () => {
    setLoading(true);
    try {
      const result = await inventoryApi.getValuation(asOfDate || undefined);
      setData(result);
    } catch (err) {
      console.error('Failed to load valuation:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadValuation();
  }, [asOfDate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-cba-gold" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="neu-raised rounded-2xl p-12 text-center">
        <PieChart className="w-12 h-12 mx-auto text-zinc-600 mb-3" />
        <p className="text-muted">No valuation data available</p>
      </div>
    );
  }

  const barColors = [
    'bg-cba-gold',
    'bg-emerald-500',
    'bg-blue-500',
    'bg-purple-500',
    'bg-orange-500',
    'bg-cyan-500',
    'bg-rose-500',
    'bg-amber-500',
  ];

  return (
    <div className="space-y-6">
      {/* Date Selector */}
      <div className="flex items-center gap-3">
        <label htmlFor="valuat-f1" className="text-sm text-muted">As of date:</label>
        <input id="valuat-f1"
          type="date"
          value={asOfDate}
          onChange={(e) => setAsOfDate(e.target.value)}
          className="px-4 py-2 rounded-xl neu-inset bg-transparent text-primary text-sm"
        />
        {asOfDate && (
          <button
            onClick={() => setAsOfDate('')}
            className="text-xs text-muted hover:text-primary"
          >
            Clear
          </button>
        )}
      </div>

      {/* Total Value Banner */}
      <div className="neu-raised rounded-2xl p-6 border border-cba-gold/10">
        <div className="flex items-center gap-4">
          <div className="neu-inset p-3 rounded-xl">
            <DollarSign className="w-8 h-8 text-cba-gold" />
          </div>
          <div>
            <p className="text-xs text-muted uppercase font-semibold tracking-wider">
              Total Inventory Value
            </p>
            <p className="text-3xl font-bold text-gradient-gold">
              {formatAUD(data.totalValueCents)}
            </p>
            <p className="text-xs text-muted mt-1">
              {data.totalItems} items •{' '}
              {data.asOfDate
                ? `As of ${new Date(data.asOfDate).toLocaleDateString('en-AU')}`
                : 'Current'}
            </p>
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      {data.categories && data.categories.length > 0 && (
        <div className="neu-raised rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border/50">
            <h3 className="text-sm font-bold text-primary">Category Breakdown</h3>
          </div>

          {/* Horizontal Bar Chart */}
          <div className="px-5 py-4 space-y-3">
            {data.categories.map((cat, i) => (
              <div key={cat.category} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-primary font-medium">{cat.category}</span>
                  <span className="text-muted">{cat.percentOfTotal.toFixed(1)}%</span>
                </div>
                <div className="w-full h-3 rounded-full bg-zinc-800">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      barColors[i % barColors.length],
                    )}
                    style={{ width: `${cat.percentOfTotal}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Category Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-t border-b border-border/50">
                  <th className="text-left px-5 py-3 text-xs font-bold text-muted uppercase">
                    Category
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-bold text-muted uppercase">
                    Items
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-bold text-muted uppercase">
                    Total Value
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-bold text-muted uppercase">
                    % of Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.categories.map((cat) => (
                  <tr key={cat.category} className="border-b border-border/50">
                    <td className="px-5 py-3 text-zinc-100 font-medium">{cat.category}</td>
                    <td className="px-5 py-3 text-right text-secondary">{cat.itemCount}</td>
                    <td className="px-5 py-3 text-right text-primary font-medium">
                      {formatAUD(cat.totalValueCents)}
                    </td>
                    <td className="px-5 py-3 text-right text-secondary">
                      {cat.percentOfTotal.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Export */}
      <div className="flex justify-end">
        <button
          className="px-4 py-2 rounded-xl neu-raised text-secondary text-sm hover:text-primary"
          title="Export available in Professional plan"
          disabled
        >
          Export CSV
        </button>
      </div>
    </div>
  );
}
