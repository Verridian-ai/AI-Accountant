import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Building2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
} from 'lucide-react';
import { taxApi } from '@/api';
import type { TaxReturnResult } from '@/api';
import { TaxReturnSummaryCard } from './TaxReturnSummaryCard';

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);

const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

export function SoleTraderReturn({ year }: { year: string }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TaxReturnResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prevYear, setPrevYear] = useState(year);

  if (prevYear !== year) {
    setPrevYear(year);
    setLoading(true);
    setError(null);
    setData(null);
  }

  useEffect(() => {
    let cancelled = false;
    taxApi
      .fetchSoleTraderReturn(year)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [year]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-cba-gold" />
        <span className="ml-2 text-secondary">Calculating sole trader return...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-500/20">
        <CardContent className="pt-6">
          <p className="text-red-400">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <TaxReturnSummaryCard
          title="Gross Income"
          value={formatCurrency(data.grossIncomeCents)}
          icon={TrendingUp}
          variant="positive"
        />
        <TaxReturnSummaryCard
          title="Deductions"
          value={`-${formatCurrency(data.totalDeductionsCents)}`}
          icon={TrendingDown}
          variant="default"
        />
        <TaxReturnSummaryCard
          title="Taxable Income"
          value={formatCurrency(data.taxableIncomeCents)}
          icon={DollarSign}
        />
        <TaxReturnSummaryCard
          title="Net Tax Payable"
          value={formatCurrency(data.netTaxPayableCents)}
          subtitle={`Effective rate: ${formatPercent(data.effectiveRate)}`}
          icon={Building2}
          variant={data.netTaxPayableCents > 0 ? 'negative' : 'positive'}
        />
      </div>

      {/* P&L Breakdown */}
      <Card className="neu-raised border-border/50">
        <CardHeader>
          <CardTitle className="text-gradient-gold">Profit & Loss</CardTitle>
          <CardDescription>Sole Trader — FY {year}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(data.breakdown).map(([key, value]) => (
              <div
                key={key}
                className="flex justify-between items-center py-2 border-b border-border/50 last:border-0"
              >
                <span className="text-secondary capitalize">{key.replace(/_/g, ' ')}</span>
                <span
                  className={`font-medium ${(value as number) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
                >
                  {formatCurrency(Math.abs(value as number))}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tax Calculation */}
      <Card className="neu-raised border-border/50">
        <CardHeader>
          <CardTitle>Tax Calculation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-secondary">Income Tax</span>
              <span className="font-medium">{formatCurrency(data.incomeTaxCents)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary">Medicare Levy</span>
              <span className="font-medium">{formatCurrency(data.medicareLevyCents)}</span>
            </div>
            {data.taxOffsetsCents > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span>Tax Offsets (SBITO + LITO)</span>
                <span className="font-medium">-{formatCurrency(data.taxOffsetsCents)}</span>
              </div>
            )}
            <div className="border-t border-border pt-3 flex justify-between font-bold text-lg">
              <span>Net Tax Payable</span>
              <span className={data.netTaxPayableCents > 0 ? 'text-red-400' : 'text-emerald-400'}>
                {formatCurrency(data.netTaxPayableCents)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Warnings */}
      {data.warnings.length > 0 && (
        <Card className="border-amber-500/20 neu-raised">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-400">
              <AlertTriangle className="w-5 h-5" />
              Warnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.warnings.map((w: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm text-secondary">
                  <Badge
                    variant="outline"
                    className="shrink-0 mt-0.5 border-amber-500/30 text-amber-400"
                  >
                    !
                  </Badge>
                  {w}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
