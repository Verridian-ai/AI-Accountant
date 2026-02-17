import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Play, CheckCircle, AlertTriangle } from 'lucide-react';
import { assetApi } from '@/api';
import type { DepreciationScheduleResponse, BatchDepreciationResult } from '@/api';

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);

interface DepreciationScheduleViewProps {
  schedule: DepreciationScheduleResponse | null;
  loading: boolean;
  financialYear: string;
  entityId?: string;
  onRefresh: () => void;
}

export function DepreciationScheduleView({
  schedule,
  loading,
  financialYear,
  entityId,
  onRefresh,
}: DepreciationScheduleViewProps) {
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchResult, setBatchResult] = useState<BatchDepreciationResult | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);

  const runBatchDepreciation = async () => {
    setBatchRunning(true);
    setBatchError(null);
    setBatchResult(null);
    try {
      const result = await assetApi.runBatchDepreciation(financialYear, entityId);
      setBatchResult(result);
      onRefresh();
    } catch (err) {
      setBatchError(err instanceof Error ? err.message : 'Batch depreciation failed');
    } finally {
      setBatchRunning(false);
    }
  };

  if (loading) {
    return (
      <Card className="neu-raised border-white/5">
        <CardContent className="py-12 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-[#FFCC00]" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="neu-raised border-white/5">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-bold text-zinc-100">
            Depreciation Schedule — FY {financialYear}
          </CardTitle>
          <Button
            onClick={runBatchDepreciation}
            disabled={batchRunning}
            className="bg-[#FFCC00] text-[#0a0a0f] hover:bg-[#FFCC00]/90 font-bold"
          >
            {batchRunning ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            Run Batch Depreciation
          </Button>
        </CardHeader>
        <CardContent>
          {!schedule || schedule.assets.length === 0 ? (
            <p className="text-zinc-500 text-center py-8">
              No depreciation schedule available for FY {financialYear}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-zinc-500 text-xs uppercase tracking-wider">
                    <th className="text-left py-3 px-2">Asset</th>
                    <th className="text-left py-3 px-2">Category</th>
                    <th className="text-left py-3 px-2">Method</th>
                    <th className="text-right py-3 px-2">Opening</th>
                    <th className="text-right py-3 px-2">Additions</th>
                    <th className="text-right py-3 px-2">Depreciation</th>
                    <th className="text-right py-3 px-2">Disposals</th>
                    <th className="text-right py-3 px-2">Closing</th>
                  </tr>
                </thead>
                <tbody>
                  {(schedule.assets as Array<Record<string, unknown>>).map((item) => (
                    <tr
                      key={item.assetId}
                      className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-3 px-2 font-medium text-zinc-100">{item.assetName}</td>
                      <td className="py-3 px-2 text-zinc-400">{item.category}</td>
                      <td className="py-3 px-2">
                        <Badge variant="outline" className="text-xs">
                          {item.method}
                        </Badge>
                      </td>
                      <td className="py-3 px-2 text-right font-mono text-zinc-300">
                        {formatCurrency(item.openingValue)}
                      </td>
                      <td className="py-3 px-2 text-right font-mono text-emerald-400">
                        {item.additions > 0 ? formatCurrency(item.additions) : '—'}
                      </td>
                      <td className="py-3 px-2 text-right font-mono text-red-400">
                        {formatCurrency(item.depreciation)}
                      </td>
                      <td className="py-3 px-2 text-right font-mono text-amber-400">
                        {item.disposals > 0 ? formatCurrency(item.disposals) : '—'}
                      </td>
                      <td className="py-3 px-2 text-right font-mono text-[#FFCC00] font-bold">
                        {formatCurrency(item.closingValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[#FFCC00]/30 font-bold">
                    <td colSpan={3} className="py-3 px-2 text-zinc-300">
                      Totals
                    </td>
                    <td className="py-3 px-2 text-right font-mono text-zinc-100">
                      {formatCurrency(schedule.totals.openingValue)}
                    </td>
                    <td className="py-3 px-2 text-right font-mono text-emerald-400">
                      {formatCurrency(schedule.totals.totalAdditions)}
                    </td>
                    <td className="py-3 px-2 text-right font-mono text-red-400">
                      {formatCurrency(schedule.totals.totalDepreciation)}
                    </td>
                    <td className="py-3 px-2 text-right font-mono text-amber-400">
                      {formatCurrency(schedule.totals.totalDisposals)}
                    </td>
                    <td className="py-3 px-2 text-right font-mono text-[#FFCC00]">
                      {formatCurrency(schedule.totals.closingValue)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {batchResult && (
        <Card className="neu-raised border-emerald-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <span className="font-bold text-emerald-400">Batch Depreciation Complete</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-zinc-500">Assets Processed</p>
                <p className="text-xl font-bold text-zinc-100">{batchResult.assetsProcessed}</p>
              </div>
              <div>
                <p className="text-zinc-500">Total Depreciation</p>
                <p className="text-xl font-bold text-[#FFCC00]">
                  {formatCurrency(batchResult.totalDepreciation)}
                </p>
              </div>
            </div>
            {batchResult.errors.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  {batchResult.errors.length} error(s)
                </p>
                {(batchResult.errors as Array<Record<string, unknown>>).map((e, i: number) => (
                  <p key={i} className="text-xs text-zinc-500">
                    Asset {e.assetId}: {e.error}
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {batchError && (
        <Card className="neu-raised border-red-500/20">
          <CardContent className="pt-6">
            <p className="text-red-400 text-sm">{batchError}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
