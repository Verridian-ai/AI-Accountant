import { useState, useEffect } from 'react';
import { ArrowLeft, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { compareCdrProducts } from '@/api';

interface ComparisonProduct {
  id: string;
  name: string;
  dataHolderBrand: string;
  category: string;
  baseRate: number | null;
  comparisonRate: number | null;
  fees: { name: string; amount: number; frequency: string }[];
  features: string[];
  eligibility: string[];
  rateType: string;
  loanPurpose: string | null;
}

interface ProductComparisonProps {
  productIds: string[];
  onBack: () => void;
}

export function ProductComparison({ productIds, onBack }: ProductComparisonProps) {
  const [products, setProducts] = useState<ComparisonProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const result = await compareCdrProducts(productIds);
        setProducts(result.products ?? result ?? []);
      } catch (e) {
        setError('Failed to load comparison data');
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [productIds]);

  const formatRate = (rate: number | null) =>
    rate != null ? `${(rate * 100).toFixed(2)}%` : 'N/A';

  const bestRate = (rates: (number | null)[], lower: boolean) => {
    const valid = rates.filter((r): r is number => r != null);
    if (valid.length === 0) return null;
    return lower ? Math.min(...valid) : Math.max(...valid);
  };

  const baseRates = products.map((p) => p.baseRate);
  const compRates = products.map((p) => p.comparisonRate);
  // For loans lower is better; for deposits higher is better
  const isLending = products.some(
    (p) => p.category?.includes('LOAN') || p.category?.includes('CREDIT'),
  );
  const bestBase = bestRate(baseRates, isLending);
  const bestComp = bestRate(compRates, isLending);

  if (loading) {
    return (
      <div className="space-y-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-secondary hover:text-cba-gold"
        >
          <ArrowLeft className="h-4 w-4" /> Back to products
        </button>
        <div className="neu-raised rounded-2xl p-8 text-center animate-pulse">
          <div className="h-6 w-48 bg-zinc-700/40 rounded mx-auto mb-4" />
          <div className="h-4 w-32 bg-zinc-700/40 rounded mx-auto" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-secondary hover:text-cba-gold"
        >
          <ArrowLeft className="h-4 w-4" /> Back to products
        </button>
        <div className="neu-raised rounded-2xl p-8 text-center text-red-400">{error}</div>
      </div>
    );
  }

  const sections: {
    title: string;
    rows: { label: string; values: (string | React.ReactNode)[] }[];
  }[] = [
    {
      title: 'Rates',
      rows: [
        {
          label: 'Base Rate',
          values: products.map((p) => (
            <span
              key={p.id}
              className={cn('font-bold', p.baseRate === bestBase && 'text-cba-gold')}
            >
              {formatRate(p.baseRate)}
              {p.baseRate === bestBase && <Trophy className="inline h-3 w-3 ml-1" />}
            </span>
          )),
        },
        {
          label: 'Comparison Rate',
          values: products.map((p) => (
            <span
              key={p.id}
              className={cn('font-medium', p.comparisonRate === bestComp && 'text-cba-gold')}
            >
              {formatRate(p.comparisonRate)}
              {p.comparisonRate === bestComp && <Trophy className="inline h-3 w-3 ml-1" />}
            </span>
          )),
        },
        {
          label: 'Rate Type',
          values: products.map((p) => p.rateType || 'N/A'),
        },
      ],
    },
    {
      title: 'Fees',
      rows: products[0]?.fees?.length
        ? products[0].fees.map((_, fi) => ({
            label: products.find((p) => p.fees?.[fi])?.fees[fi]?.name || `Fee ${fi + 1}`,
            values: products.map((p) => {
              const fee = p.fees?.[fi];
              if (!fee) return 'N/A';
              const amounts = products
                .map((pp) => pp.fees?.[fi]?.amount)
                .filter((a): a is number => a != null);
              const lowest = Math.min(...amounts);
              return (
                <span
                  key={p.id}
                  className={cn(fee.amount === lowest && 'text-cba-gold font-bold')}
                >
                  ${fee.amount.toFixed(2)}/{fee.frequency}
                  {fee.amount === lowest && <Trophy className="inline h-3 w-3 ml-1" />}
                </span>
              );
            }),
          }))
        : [{ label: 'No fee data', values: products.map(() => '-') }],
    },
    {
      title: 'Features',
      rows: (() => {
        const allFeatures = [...new Set(products.flatMap((p) => p.features || []))];
        return allFeatures.map((f) => ({
          label: f,
          values: products.map((p) =>
            p.features?.includes(f) ? (
              <span key={p.id} className="text-emerald-400 font-bold">
                Yes
              </span>
            ) : (
              <span key={p.id} className="text-zinc-600">
                No
              </span>
            ),
          ),
        }));
      })(),
    },
    {
      title: 'Eligibility',
      rows: (() => {
        const allEligibility = [...new Set(products.flatMap((p) => p.eligibility || []))];
        if (allEligibility.length === 0)
          return [{ label: 'No eligibility data', values: products.map(() => '-') }];
        return allEligibility.map((e) => ({
          label: e,
          values: products.map((p) =>
            p.eligibility?.includes(e) ? (
              <span key={p.id} className="text-emerald-400">
                Required
              </span>
            ) : (
              <span key={p.id} className="text-zinc-600">
                -
              </span>
            ),
          ),
        }));
      })(),
    },
  ];

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-secondary hover:text-cba-gold transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to products
      </button>

      <div className="neu-raised rounded-2xl overflow-hidden">
        {/* Header Row */}
        <div
          className="grid border-b border-border/50"
          style={{ gridTemplateColumns: `200px repeat(${products.length}, 1fr)` }}
        >
          <div className="p-4 bg-[#1a1d23]" />
          {products.map((p) => (
            <div key={p.id} className="p-4 text-center border-l border-border/50">
              <p className="text-xs text-muted">{p.dataHolderBrand}</p>
              <p className="text-sm font-bold text-zinc-100 mt-1">{p.name}</p>
            </div>
          ))}
        </div>

        {/* Sections */}
        {sections.map((section) => (
          <div key={section.title}>
            <div className="px-4 py-2 bg-[#1a1d23]/60 border-b border-border/50">
              <h4 className="text-xs font-bold text-cba-gold uppercase tracking-wider">
                {section.title}
              </h4>
            </div>
            {section.rows.map((row, ri) => (
              <div
                key={ri}
                className="grid border-b border-border/50 last:border-b-0"
                style={{ gridTemplateColumns: `200px repeat(${products.length}, 1fr)` }}
              >
                <div className="p-3 text-xs text-secondary font-medium bg-[#1a1d23]/30">
                  {row.label}
                </div>
                {row.values.map((val, vi) => (
                  <div
                    key={vi}
                    className="p-3 text-sm text-primary text-center border-l border-border/50"
                  >
                    {val}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
