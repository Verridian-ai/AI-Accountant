import { useState, useEffect } from 'react';
import { TrendingDown, TrendingUp, BarChart3, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchMarketPrices } from '@/api';

interface MarketData {
  lowestVariable: number | null;
  lowestFixed2yr: number | null;
  averageVariable: number | null;
  productCount: number;
  rateDistribution: { bucket: string; count: number }[];
  providerComparison: { provider: string; avgRate: number; productCount: number }[];
}

const MARKET_CATEGORIES = ['HOME_LOAN', 'PERSONAL_LOAN', 'SAVINGS', 'TERM_DEPOSIT'];

export function RateTracker() {
  const [data, setData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('HOME_LOAN');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const result = await fetchMarketPrices(category);
        setData(result);
      } catch (e) {
        console.error('Failed to load market rates', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [category]);

  const formatRate = (rate: number | null) =>
    rate != null ? `${(rate * 100).toFixed(2)}%` : 'N/A';

  const summaryCards = [
    {
      label: 'Lowest Variable',
      value: formatRate(data?.lowestVariable ?? null),
      icon: TrendingDown,
      color: 'text-emerald-400',
    },
    {
      label: 'Lowest 2yr Fixed',
      value: formatRate(data?.lowestFixed2yr ?? null),
      icon: TrendingDown,
      color: 'text-cyan-400',
    },
    {
      label: 'Average Variable',
      value: formatRate(data?.averageVariable ?? null),
      icon: TrendingUp,
      color: 'text-amber-400',
    },
    {
      label: 'Products Tracked',
      value: String(data?.productCount ?? 0),
      icon: Hash,
      color: 'text-cba-gold',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Category Selector */}
      <div className="flex flex-wrap gap-2">
        {MARKET_CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-bold transition-all',
              category === c
                ? 'bg-cba-gold text-base shadow-[0_0_15px_rgba(255,204,0,0.2)]'
                : 'neu-raised-sm text-secondary hover:text-primary',
            )}
          >
            {c.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className={cn('neu-raised rounded-2xl p-5', loading && 'animate-pulse')}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="neu-inset p-1.5 rounded-lg">
                <card.icon className={cn('h-4 w-4', card.color)} />
              </div>
              <span className="text-xs text-muted font-semibold uppercase tracking-wider">
                {card.label}
              </span>
            </div>
            <p className={cn('text-2xl font-black', card.color)}>{loading ? '...' : card.value}</p>
          </div>
        ))}
      </div>

      {/* Rate Distribution */}
      <div className="neu-raised rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-primary flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-cba-gold" />
          Rate Distribution
        </h3>
        {loading ? (
          <div className="h-48 animate-pulse bg-zinc-700/20 rounded-xl" />
        ) : (
          <div className="flex items-end gap-1 h-48">
            {(data?.rateDistribution ?? []).map((bucket, i) => {
              const maxCount = Math.max(...(data?.rateDistribution ?? []).map((b) => b.count), 1);
              const height = (bucket.count / maxCount) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-muted">{bucket.count}</span>
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-[#FFCC00]/60 to-[#FFCC00] transition-all duration-300"
                    style={{ height: `${height}%`, minHeight: bucket.count > 0 ? '4px' : '0px' }}
                  />
                  <span className="text-[10px] text-zinc-600 truncate w-full text-center">
                    {bucket.bucket}
                  </span>
                </div>
              );
            })}
            {(!data?.rateDistribution || data.rateDistribution.length === 0) && (
              <div className="flex-1 text-center text-zinc-600 text-sm py-16">
                No distribution data
              </div>
            )}
          </div>
        )}
      </div>

      {/* Provider Comparison */}
      <div className="neu-raised rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-primary">Provider Comparison</h3>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-8 bg-zinc-700/20 rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {(data?.providerComparison ?? []).slice(0, 15).map((prov, i) => {
              const maxRate = Math.max(
                ...(data?.providerComparison ?? []).map((p) => p.avgRate),
                0.001,
              );
              const width = (prov.avgRate / maxRate) * 100;
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-secondary w-32 truncate shrink-0">
                    {prov.provider}
                  </span>
                  <div className="flex-1 h-6 bg-[#1a1d23] rounded-lg overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#FFCC00]/40 to-[#FFCC00] rounded-lg flex items-center justify-end pr-2 transition-all duration-300"
                      style={{ width: `${width}%` }}
                    >
                      <span className="text-[10px] font-bold text-base">
                        {(prov.avgRate * 100).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] text-zinc-600 w-16 text-right shrink-0">
                    {prov.productCount} products
                  </span>
                </div>
              );
            })}
            {(!data?.providerComparison || data.providerComparison.length === 0) && (
              <p className="text-sm text-zinc-600 text-center py-4">No provider data available</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
