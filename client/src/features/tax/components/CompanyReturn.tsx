import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Building, Landmark, AlertTriangle } from 'lucide-react';
import { taxApi } from '@/api';
import type { TaxReturnResult } from '@/api';
import { TaxReturnSummaryCard } from './TaxReturnSummaryCard';

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);

const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

export function CompanyReturn({ year }: { year: string }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<TaxReturnResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    taxApi
      .fetchCompanyReturn(year)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [year]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[#FFCC00]" />
        <span className="ml-2 text-zinc-400">Calculating company return...</span>
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <TaxReturnSummaryCard
          title="Revenue"
          value={formatCurrency(data.grossIncomeCents)}
          icon={Building}
          variant="positive"
        />
        <TaxReturnSummaryCard
          title="Expenses"
          value={`-${formatCurrency(data.totalDeductionsCents)}`}
        />
        <TaxReturnSummaryCard
          title="Taxable Income"
          value={formatCurrency(data.taxableIncomeCents)}
          icon={Landmark}
        />
        <TaxReturnSummaryCard
          title="Company Tax (25%)"
          value={formatCurrency(data.netTaxPayableCents)}
          subtitle={`Effective: ${formatPercent(data.effectiveRate)}`}
          variant="negative"
        />
      </div>

      {/* Revenue & Expense Breakdown */}
      <Card className="neu-raised border-white/5">
        <CardHeader>
          <CardTitle className="text-gradient-gold">Company P&L</CardTitle>
          <CardDescription>Company Tax Return — FY {year} (Base Rate Entity 25%)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(data.breakdown).map(([key, value]) => (
              <div
                key={key}
                className="flex justify-between items-center py-2 border-b border-white/5 last:border-0"
              >
                <span className="text-zinc-400 capitalize">{key.replace(/_/g, ' ')}</span>
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

      {/* Franking Credits Info */}
      <Card className="neu-raised border-white/5">
        <CardHeader>
          <CardTitle>Franking Credits</CardTitle>
          <CardDescription>
            Tax paid generates franking credits for shareholder dividends
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-zinc-400">Tax Paid</span>
              <span className="font-medium">{formatCurrency(data.netTaxPayableCents)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Franking Credits Generated</span>
              <span className="font-medium text-emerald-400">
                {formatCurrency(data.netTaxPayableCents)}
              </span>
            </div>
            <p className="text-xs text-zinc-500 pt-2">
              Franking credits can be distributed to shareholders with dividends, reducing their
              personal tax liability.
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
                <li key={i} className="flex items-start gap-2 text-sm text-zinc-400">
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
