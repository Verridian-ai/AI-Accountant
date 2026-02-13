import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/format';
import { Loader2, TrendingUp, TrendingDown, Download, FileText, ArrowRight } from 'lucide-react';
import { gstApi } from '@/api';
import type { GSTSummaryData } from '@/features/gst/types';

interface GSTSummaryProps {
  period?: string;
  businessOnly?: boolean;
}

export function GSTSummary({ period = 'current', businessOnly: _businessOnly }: GSTSummaryProps) {
  const [data, setData] = useState<GSTSummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSummary();
  }, [period]);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const result = await gstApi.fetchSummary(period);
      setData(result);
    } catch (err) {
      console.error('Failed to load GST summary:', err);
    } finally {
      setLoading(false);
    }
  };

  const getChangePercent = (current: number, previous?: number): number | null => {
    if (previous === undefined || previous === 0) return null;
    return ((current - previous) / Math.abs(previous)) * 100;
  };

  if (loading) {
    return (
      <Card className="neu-raised rounded-xl">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-[#FFCC00]" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const netChange = getChangePercent(data.netGST, data.previousPeriodNetGST);

  return (
    <div className="space-y-4">
      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* GST Collected (1A) */}
        <Card className="neu-inset rounded-xl">
          <CardContent className="p-4">
            <p className="text-xs text-zinc-500 mb-1">GST Collected (1A)</p>
            <p className="text-2xl font-bold text-emerald-400">
              {formatCurrency(data.gstCollected)}
            </p>
          </CardContent>
        </Card>

        {/* GST Credits (1B) */}
        <Card className="neu-inset rounded-xl">
          <CardContent className="p-4">
            <p className="text-xs text-zinc-500 mb-1">GST Credits (1B)</p>
            <p className="text-2xl font-bold text-blue-400">{formatCurrency(data.gstCredits)}</p>
          </CardContent>
        </Card>

        {/* Net GST Position */}
        <Card className="neu-inset rounded-xl border-[#FFCC00]/20">
          <CardContent className="p-4">
            <p className="text-xs text-zinc-500 mb-1">Net GST Position</p>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold text-[#FFCC00]">{formatCurrency(data.netGST)}</p>
              {netChange !== null && (
                <span
                  className={`flex items-center text-xs ${netChange > 0 ? 'text-red-400' : 'text-emerald-400'}`}
                >
                  {netChange > 0 ? (
                    <TrendingUp className="w-3 h-3 mr-0.5" />
                  ) : (
                    <TrendingDown className="w-3 h-3 mr-0.5" />
                  )}
                  {Math.abs(netChange).toFixed(1)}%
                </span>
              )}
            </div>
            <p className="text-[10px] text-zinc-600 mt-1">
              {data.netGST > 0 ? 'Amount payable to ATO' : 'Refund from ATO'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown */}
      <Card className="neu-raised rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">GST Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-zinc-400">Taxable Sales</span>
              <span className="font-medium">{formatCurrency(data.breakdown.taxable.sales)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-400">Taxable Purchases</span>
              <span className="font-medium">
                {formatCurrency(data.breakdown.taxable.purchases)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-400">GST-Free Sales</span>
              <span className="font-medium">{formatCurrency(data.breakdown.gstFree.sales)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-400">GST-Free Purchases</span>
              <span className="font-medium">
                {formatCurrency(data.breakdown.gstFree.purchases)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-400">Input Taxed</span>
              <span className="font-medium">{formatCurrency(data.breakdown.inputTaxed)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-400">Capital Acquisitions</span>
              <span className="font-medium">{formatCurrency(data.breakdown.capital)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-400">Private/Non-Deductible</span>
              <span className="font-medium">{formatCurrency(data.breakdown.private)}</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-zinc-500">
            <span>
              {data.transactionsClassified} classified | {data.transactionsNeedReview} need review
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm">
          <ArrowRight className="w-4 h-4 mr-1" />
          View Details
        </Button>
        <Button variant="outline" size="sm">
          <Download className="w-4 h-4 mr-1" />
          Export CSV
        </Button>
        <Button size="sm">
          <FileText className="w-4 h-4 mr-1" />
          Generate BAS Draft
        </Button>
      </div>
    </div>
  );
}
