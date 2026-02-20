import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, AlertTriangle, ShieldAlert } from 'lucide-react';
import { taxApi } from '@/api';
import type { TaxReturnResult } from '@/api';
import { TaxReturnSummaryCard } from './TaxReturnSummaryCard';

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);

const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

export function TrustReturn({ year }: { year: string }) {
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
      .fetchTrustReturn(year)
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
        <span className="ml-2 text-secondary">Calculating trust return...</span>
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

  const hasSection100AWarning = data.warnings.some((w: string) =>
    w.toLowerCase().includes('section 100a'),
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <TaxReturnSummaryCard
          title="Trust Income"
          value={formatCurrency(data.grossIncomeCents)}
          icon={Users}
          variant="positive"
        />
        <TaxReturnSummaryCard
          title="Trust Expenses"
          value={`-${formatCurrency(data.totalDeductionsCents)}`}
        />
        <TaxReturnSummaryCard
          title="Net Income"
          value={formatCurrency(data.taxableIncomeCents)}
          subtitle="For distribution"
        />
        <TaxReturnSummaryCard
          title="Tax on Undistributed"
          value={formatCurrency(data.netTaxPayableCents)}
          subtitle={`Rate: ${formatPercent(data.effectiveRate)}`}
          variant={data.netTaxPayableCents > 0 ? 'negative' : 'positive'}
        />
      </div>

      {/* Section 100A Warning Banner */}
      {hasSection100AWarning && (
        <Card className="border-red-500/30 bg-red-500/5 neu-raised">
          <CardContent className="pt-6 flex items-start gap-3">
            <ShieldAlert className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-red-400">Section 100A Risk</h4>
              <p className="text-sm text-secondary mt-1">
                Trust distributions that involve reimbursement agreements may be assessed at the top
                marginal rate under Section 100A ITAA 1936. Review distribution arrangements with
                your tax adviser.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trust P&L */}
      <Card className="neu-raised border-border/50">
        <CardHeader>
          <CardTitle className="text-gradient-gold">Trust Income & Expenses</CardTitle>
          <CardDescription>Trust Tax Return — FY {year}</CardDescription>
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

      {/* Distribution Info */}
      <Card className="neu-raised border-border/50">
        <CardHeader>
          <CardTitle>Distribution Summary</CardTitle>
          <CardDescription>
            Net trust income must be distributed to beneficiaries by June 30
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-secondary">Distributable Amount</span>
              <span className="font-medium">{formatCurrency(data.taxableIncomeCents)}</span>
            </div>
            <p className="text-xs text-muted pt-2">
              Undistributed income is taxed at the top marginal rate (45% + 2% Medicare). Ensure a
              valid resolution is made before year-end.
            </p>
          </div>
        </CardContent>
      </Card>

      {data.warnings.length > 0 && (
        <Card className="border-amber-500/20 neu-raised">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-400">
              <AlertTriangle className="w-5 h-5" /> Warnings
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
