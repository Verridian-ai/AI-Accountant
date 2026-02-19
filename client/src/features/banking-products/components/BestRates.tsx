import { useState, useEffect } from 'react';
import { Trophy, Bell, ArrowDown, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchBestRates, createCdrAlert } from '@/api';

interface RateEntry {
  id: string;
  productId: string;
  name: string;
  dataHolderBrand: string;
  baseRate: number | null;
  comparisonRate: number | null;
  rateType: string;
  category: string;
}

const CATEGORIES = ['HOME_LOAN', 'PERSONAL_LOAN', 'SAVINGS', 'TERM_DEPOSIT'];
const MEDAL_COLORS = ['text-cba-gold', 'text-primary', 'text-amber-600'];
const MEDAL_BG = ['bg-cba-gold/10', 'bg-zinc-300/10', 'bg-amber-600/10'];

export function BestRates() {
  const [category, setCategory] = useState('HOME_LOAN');
  const [lending, setLending] = useState<RateEntry[]>([]);
  const [deposit, setDeposit] = useState<RateEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [alertingId, setAlertingId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [lendRes, depRes] = await Promise.all([
          fetchBestRates(category, 'lending'),
          fetchBestRates(category, 'deposit'),
        ]);
        setLending(lendRes.products ?? lendRes ?? []);
        setDeposit(depRes.products ?? depRes ?? []);
      } catch (e) {
        console.error('Failed to load best rates', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [category]);

  const handleSetAlert = async (product: RateEntry) => {
    setAlertingId(product.id);
    try {
      await createCdrAlert({
        type: 'rate_change',
        productId: product.productId,
        category: product.category,
        thresholdRate: product.baseRate,
      });
    } catch (e) {
      console.error('Failed to create alert', e);
    } finally {
      setAlertingId(null);
    }
  };

  const formatRate = (rate: number | null) =>
    rate != null ? `${(rate * 100).toFixed(2)}%` : 'N/A';

  const renderLeaderboard = (title: string, items: RateEntry[], isLending: boolean) => (
    <div className="neu-raised rounded-2xl p-5 space-y-3">
      <h3 className="text-sm font-bold text-primary flex items-center gap-2">
        {isLending ? (
          <ArrowDown className="h-4 w-4 text-emerald-400" />
        ) : (
          <ArrowUp className="h-4 w-4 text-cyan-400" />
        )}
        {title}
      </h3>
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-zinc-700/20 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-zinc-600 text-center py-8">No products in this category</p>
      ) : (
        <div className="space-y-2">
          {items.slice(0, 10).map((item, idx) => (
            <div
              key={item.id}
              className={cn(
                'flex items-center gap-3 p-3 rounded-xl transition-colors',
                idx < 3 ? MEDAL_BG[idx] : 'hover:bg-overlay',
              )}
            >
              <div
                className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm',
                  idx < 3 ? cn(MEDAL_COLORS[idx], 'neu-inset') : 'text-zinc-600',
                )}
              >
                {idx < 3 ? <Trophy className="h-4 w-4" /> : idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-zinc-100 truncate">{item.name}</p>
                <p className="text-xs text-muted truncate">{item.dataHolderBrand}</p>
              </div>
              <div className="text-right shrink-0">
                <p
                  className={cn(
                    'text-lg font-black',
                    idx < 3 ? MEDAL_COLORS[idx] : 'text-primary',
                  )}
                >
                  {formatRate(item.baseRate)}
                </p>
                {item.comparisonRate != null && (
                  <p className="text-[10px] text-muted">
                    {formatRate(item.comparisonRate)} comp
                  </p>
                )}
              </div>
              <button
                onClick={() => handleSetAlert(item)}
                disabled={alertingId === item.id}
                className="shrink-0 p-2 rounded-lg text-muted hover:text-cba-gold transition-colors disabled:opacity-50"
                title="Set rate alert"
              >
                <Bell className={cn('h-4 w-4', alertingId === item.id && 'animate-pulse')} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Category Selector */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
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

      {/* Two-Column Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderLeaderboard('Best Lending Rates', lending, true)}
        {renderLeaderboard('Best Deposit Rates', deposit, false)}
      </div>
    </div>
  );
}
