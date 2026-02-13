import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Layers, Play, Lock, TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';
import { consolidationApi } from '@/api';
import type {
  EntityWithDetails,
  ConsolidationDetailResponse,
  ConsolidationSnapshotData,
} from '@/api';
import { toast } from 'sonner';

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);
}

const SNAPSHOT_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  reviewed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  finalized: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};

interface ConsolidationViewProps {
  entities: EntityWithDetails[];
  financialYear: string;
}

export function ConsolidationView({ entities, financialYear }: ConsolidationViewProps) {
  const [generating, setGenerating] = useState(false);
  const [detail, setDetail] = useState<ConsolidationDetailResponse | null>(null);
  const [snapshots, setSnapshots] = useState<ConsolidationSnapshotData[]>([]);
  const [snapshotsLoaded, setSnapshotsLoaded] = useState(false);
  const [selectedParentId, setSelectedParentId] = useState<string>('');
  const [finalizing, setFinalizing] = useState<string | null>(null);

  const consolidatedParents = entities.filter((e) => e.isConsolidatedParent);

  const handleGenerate = useCallback(async () => {
    if (!selectedParentId) {
      toast.error('Select a parent entity first');
      return;
    }
    setGenerating(true);
    try {
      const result = await consolidationApi.generate(selectedParentId, financialYear);
      setDetail(result);
      toast.success('Consolidation generated successfully');
      // Refresh snapshots
      const snaps = await consolidationApi.getSnapshots(selectedParentId, financialYear);
      setSnapshots(snaps);
      setSnapshotsLoaded(true);
    } catch (err) {
      console.error('Failed to generate consolidation:', err);
      toast.error('Failed to generate consolidation');
    } finally {
      setGenerating(false);
    }
  }, [selectedParentId, financialYear]);

  const loadSnapshots = useCallback(async () => {
    if (!selectedParentId) return;
    try {
      const snaps = await consolidationApi.getSnapshots(selectedParentId, financialYear);
      setSnapshots(snaps);
      setSnapshotsLoaded(true);
    } catch (err) {
      console.error('Failed to load snapshots:', err);
    }
  }, [selectedParentId, financialYear]);

  const handleParentChange = (id: string) => {
    setSelectedParentId(id);
    setDetail(null);
    setSnapshotsLoaded(false);
  };

  const handleViewSnapshot = async (id: string) => {
    try {
      const result = await consolidationApi.getSnapshotDetail(id);
      setDetail(result);
    } catch (err) {
      console.error('Failed to load snapshot detail:', err);
      toast.error('Failed to load snapshot');
    }
  };

  const handleFinalize = async (id: string) => {
    setFinalizing(id);
    try {
      await consolidationApi.finalizeSnapshot(id);
      toast.success('Snapshot finalized');
      loadSnapshots();
    } catch (err) {
      console.error('Failed to finalize snapshot:', err);
      toast.error('Failed to finalize snapshot');
    } finally {
      setFinalizing(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={selectedParentId} onValueChange={handleParentChange}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Select parent entity" />
          </SelectTrigger>
          <SelectContent>
            {consolidatedParents.length === 0 ? (
              <SelectItem value="__none" disabled>
                No consolidated parents
              </SelectItem>
            ) : (
              consolidatedParents.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        <Button
          onClick={handleGenerate}
          disabled={generating || !selectedParentId}
          className="bg-[#FFCC00] text-[#0a0a0f] hover:bg-[#FFCC00]/90 font-bold"
        >
          {generating ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Play className="w-4 h-4 mr-2" />
          )}
          {generating ? 'Generating...' : 'Generate Consolidation'}
        </Button>
        {selectedParentId && !snapshotsLoaded && (
          <Button variant="outline" onClick={loadSnapshots}>
            Load History
          </Button>
        )}
      </div>

      {consolidatedParents.length === 0 && (
        <Card className="neu-raised border-0">
          <CardContent className="p-8 text-center">
            <Layers className="w-12 h-12 mx-auto text-zinc-600 mb-3" />
            <h3 className="text-lg font-bold text-zinc-300 mb-1">No Consolidated Parents</h3>
            <p className="text-sm text-zinc-500">
              Mark an entity as "Consolidated Parent" to enable group consolidation
            </p>
          </CardContent>
        </Card>
      )}

      {/* Consolidation Detail */}
      {detail && (
        <div className="space-y-4">
          {/* Consolidated Totals */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="neu-raised border-0">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-zinc-500 text-sm mb-1">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  Total Revenue
                </div>
                <p className="text-xl font-bold text-emerald-400">
                  {formatMoney(detail.consolidatedTotals.revenue)}
                </p>
              </CardContent>
            </Card>
            <Card className="neu-raised border-0">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-zinc-500 text-sm mb-1">
                  <TrendingDown className="w-4 h-4 text-red-400" />
                  Total Expenses
                </div>
                <p className="text-xl font-bold text-red-400">
                  {formatMoney(detail.consolidatedTotals.expenses)}
                </p>
              </CardContent>
            </Card>
            <Card className="neu-raised border-0">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-zinc-500 text-sm mb-1">
                  <Minus className="w-4 h-4 text-[#FFCC00]" />
                  Net Profit
                </div>
                <p
                  className={`text-xl font-bold ${detail.consolidatedTotals.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
                >
                  {formatMoney(detail.consolidatedTotals.netProfit)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Balance Sheet Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="neu-raised border-0">
              <CardContent className="p-4">
                <p className="text-xs text-zinc-500 mb-1">Total Assets</p>
                <p className="text-lg font-bold text-zinc-100">
                  {formatMoney(detail.consolidatedTotals.assets)}
                </p>
              </CardContent>
            </Card>
            <Card className="neu-raised border-0">
              <CardContent className="p-4">
                <p className="text-xs text-zinc-500 mb-1">Total Liabilities</p>
                <p className="text-lg font-bold text-zinc-100">
                  {formatMoney(detail.consolidatedTotals.liabilities)}
                </p>
              </CardContent>
            </Card>
            <Card className="neu-raised border-0">
              <CardContent className="p-4">
                <p className="text-xs text-zinc-500 mb-1">Total Equity</p>
                <p className="text-lg font-bold text-zinc-100">
                  {formatMoney(detail.consolidatedTotals.equity)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Per-Entity Breakdown */}
          <Card className="neu-raised border-0">
            <CardHeader>
              <CardTitle className="text-sm font-bold text-zinc-300">
                Per-Entity P&L Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5 text-xs text-zinc-500 uppercase tracking-wide">
                      <th className="text-left py-2 pr-4">Entity</th>
                      <th className="text-right py-2 px-2">Revenue</th>
                      <th className="text-right py-2 px-2">Expenses</th>
                      <th className="text-right py-2 pl-2">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(detail.byEntity).map(([entityId, rawData]) => {
                      const data = rawData as any;
                      const net = data.revenue - data.expenses;
                      return (
                        <tr key={entityId} className="border-b border-white/5">
                          <td className="py-2 pr-4 font-medium text-zinc-200">{data.entityName}</td>
                          <td className="py-2 px-2 text-right text-emerald-400">
                            {formatMoney(data.revenue)}
                          </td>
                          <td className="py-2 px-2 text-right text-red-400">
                            {formatMoney(data.expenses)}
                          </td>
                          <td
                            className={`py-2 pl-2 text-right font-bold ${net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
                          >
                            {formatMoney(net)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Eliminations */}
          {detail.eliminations.length > 0 && (
            <Card className="neu-raised border-0">
              <CardHeader>
                <CardTitle className="text-sm font-bold text-zinc-300">
                  Elimination Entries
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {detail.eliminations.map((elim: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
                    >
                      <span className="text-sm text-zinc-400">{elim.description}</span>
                      <span className="text-sm font-bold text-blue-400">
                        {formatMoney(elim.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Snapshot History */}
      {snapshotsLoaded && snapshots.length > 0 && (
        <Card className="neu-raised border-0">
          <CardHeader>
            <CardTitle className="text-sm font-bold text-zinc-300">Snapshot History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {snapshots.map((snap) => (
                <div
                  key={snap.id}
                  className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-zinc-400">
                      {new Date(snap.snapshotDate).toLocaleDateString('en-AU')}
                    </span>
                    <Badge variant="outline" className={SNAPSHOT_STATUS_COLORS[snap.status] ?? ''}>
                      {snap.status}
                    </Badge>
                    <span className="text-xs text-zinc-500">FY {snap.financialYear}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleViewSnapshot(snap.id)}
                      className="h-7 text-xs"
                    >
                      View
                    </Button>
                    {snap.status === 'draft' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleFinalize(snap.id)}
                        disabled={finalizing === snap.id}
                        className="h-7 text-xs text-[#FFCC00] border-[#FFCC00]/30 hover:bg-[#FFCC00]/10"
                      >
                        {finalizing === snap.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Lock className="w-3 h-3 mr-1" />
                        )}
                        Finalize
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
