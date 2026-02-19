import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/format';
import { Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { gstApi } from '@/api';
import type { InputTaxCredit } from '@/features/gst/types';

interface InputTaxCreditsProps {
  period?: string;
  businessOnly?: boolean;
}

export function InputTaxCredits({
  period = 'current',
  businessOnly: _businessOnly,
}: InputTaxCreditsProps) {
  const [credits, setCredits] = useState<InputTaxCredit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCredits();
  }, [period]);

  const loadCredits = async () => {
    setLoading(true);
    try {
      const data = await gstApi.fetchInputTaxCredits(period);
      setCredits(data.sort((a, b) => b.gstCredits - a.gstCredits));
    } catch (err) {
      console.error('Failed to load input tax credits:', err);
    } finally {
      setLoading(false);
    }
  };

  const totalClaimable = credits.reduce((sum, c) => sum + c.gstCredits, 0);
  const missingInvoices = credits.filter((c) => !c.hasInvoice && c.gstCredits > 8250); // >$82.50 threshold in cents

  if (loading) {
    return (
      <Card className="neu-raised rounded-xl">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-cba-gold" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Input Tax Credits</h3>
          <p className="text-sm text-muted">
            Total Claimable:{' '}
            <span className="text-emerald-400 font-medium">{formatCurrency(totalClaimable)}</span>
          </p>
        </div>
        {missingInvoices.length > 0 && (
          <Badge variant="warning">
            {missingInvoices.length} missing invoice{missingInvoices.length !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {missingInvoices.length > 0 && (
        <Card className="rounded-xl border-amber-500/20 bg-amber-500/5">
          <CardContent className="p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-400">
              GST credits over $82.50 without a valid tax invoice may be disallowed. Ensure you have
              invoices for all claimable credits.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Credits Table */}
      <Card className="neu-raised rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Credit Breakdown by Category</CardTitle>
          <CardDescription>Claimable GST credits with invoice status</CardDescription>
        </CardHeader>
        <CardContent>
          {credits.length === 0 ? (
            <p className="text-muted text-center py-8">No input tax credits for this period</p>
          ) : (
            <div className="space-y-1">
              {/* Header */}
              <div className="grid grid-cols-4 gap-4 text-xs text-muted pb-2 border-b border-border/50">
                <span>Category</span>
                <span className="text-right">GST Credits</span>
                <span className="text-center">Invoice</span>
                <span className="text-right">Transactions</span>
              </div>
              {/* Rows */}
              {credits.map((credit, idx) => {
                const needsInvoice = !credit.hasInvoice && credit.gstCredits > 8250;
                return (
                  <div
                    key={idx}
                    className="grid grid-cols-4 gap-4 py-2 text-sm items-center border-b border-white/[0.02] last:border-0"
                  >
                    <span className="truncate font-medium">{credit.category}</span>
                    <span className="text-right text-emerald-400 font-medium">
                      {formatCurrency(credit.gstCredits)}
                    </span>
                    <span className="flex justify-center">
                      {credit.hasInvoice ? (
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                      ) : needsInvoice ? (
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                      ) : (
                        <span className="text-xs text-zinc-600">N/A</span>
                      )}
                    </span>
                    <span className="text-right text-secondary">{credit.transactionCount}</span>
                  </div>
                );
              })}
              {/* Total */}
              <div className="grid grid-cols-4 gap-4 pt-3 border-t border-border text-sm font-semibold">
                <span>Total</span>
                <span className="text-right text-cba-gold">{formatCurrency(totalClaimable)}</span>
                <span />
                <span className="text-right text-secondary">
                  {credits.reduce((sum, c) => sum + c.transactionCount, 0)}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
