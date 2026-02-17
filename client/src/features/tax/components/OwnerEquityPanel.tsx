import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowUpRight, ArrowDownLeft, Scan, CheckCircle2, XCircle } from 'lucide-react';
import { taxApi } from '@/api';
import type { EquitySummary, DetectedEquityEvent } from '@/api';

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);

export function OwnerEquityPanel({ year }: { year: string }) {
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [summary, setSummary] = useState<EquitySummary | null>(null);
  const [detected, setDetected] = useState<{
    contributions: DetectedEquityEvent[];
    drawings: DetectedEquityEvent[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    taxApi
      .fetchEquitySummary(year)
      .then(setSummary)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [year]);

  const handleScan = async () => {
    setScanning(true);
    setError(null);
    try {
      const result = await taxApi.scanEquity(year);
      setDetected(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setScanning(false);
    }
  };

  const handleConfirm = async (id: string, confirmed: boolean) => {
    try {
      await taxApi.confirmEquityEvent(id, confirmed);
      // Remove from detected list
      if (detected) {
        setDetected({
          contributions: detected.contributions.filter((e) => e.transactionId !== id),
          drawings: detected.drawings.filter((e) => e.transactionId !== id),
        });
      }
      // Refresh summary
      const updated = await taxApi.fetchEquitySummary(year);
      setSummary(updated);
    } catch (err) {
      console.error('Failed to confirm event:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[#FFCC00]" />
        <span className="ml-2 text-zinc-400">Loading equity data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="neu-raised border-white/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4 text-emerald-400" />
              Contributions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-400">
              {summary ? formatCurrency(summary.totalContributions) : '$0.00'}
            </div>
            <p className="text-xs text-zinc-500">Personal → Business</p>
          </CardContent>
        </Card>

        <Card className="neu-raised border-white/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
              <ArrowDownLeft className="w-4 h-4 text-red-400" />
              Drawings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-400">
              {summary ? formatCurrency(summary.totalDrawings) : '$0.00'}
            </div>
            <p className="text-xs text-zinc-500">Business → Personal</p>
          </CardContent>
        </Card>

        <Card className="neu-raised border-white/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Net Equity Change</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${(summary?.netEquityChange ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
            >
              {summary ? formatCurrency(summary.netEquityChange) : '$0.00'}
            </div>
            <p className="text-xs text-zinc-500">{summary?.eventCount ?? 0} events</p>
          </CardContent>
        </Card>
      </div>

      {/* Scan Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleScan}
          disabled={scanning}
          className="bg-[#FFCC00] text-[#0a0a0f] hover:bg-[#e6b800]"
        >
          {scanning ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Scan className="w-4 h-4 mr-2" />
          )}
          {scanning ? 'Scanning...' : 'Scan Transactions'}
        </Button>
      </div>

      {error && (
        <Card className="border-red-500/20">
          <CardContent className="pt-6">
            <p className="text-red-400">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Detected Events */}
      {detected && (detected.contributions.length > 0 || detected.drawings.length > 0) && (
        <Card className="neu-raised border-[#FFCC00]/10">
          <CardHeader>
            <CardTitle className="text-gradient-gold">Detected Events</CardTitle>
            <CardDescription>
              Review and confirm detected contributions and drawings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {detected.contributions.map((e) => (
                <div
                  key={e.transactionId}
                  className="flex items-center justify-between p-3 rounded-lg border border-emerald-500/10 bg-emerald-500/5"
                >
                  <div className="flex items-center gap-3">
                    <ArrowUpRight className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div>
                      <p className="font-medium text-sm">{e.description}</p>
                      <p className="text-xs text-zinc-500">
                        {e.date} • {e.sourceAccount}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-emerald-400">{formatCurrency(e.amount)}</span>
                    <Badge variant="outline" className="text-xs">
                      {Math.round(e.confidence * 100)}%
                    </Badge>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleConfirm(e.transactionId, true)}
                        className="text-emerald-400 hover:text-emerald-300 p-1 h-auto"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleConfirm(e.transactionId, false)}
                        className="text-red-400 hover:text-red-300 p-1 h-auto"
                      >
                        <XCircle className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {detected.drawings.map((e) => (
                <div
                  key={e.transactionId}
                  className="flex items-center justify-between p-3 rounded-lg border border-red-500/10 bg-red-500/5"
                >
                  <div className="flex items-center gap-3">
                    <ArrowDownLeft className="w-5 h-5 text-red-400 shrink-0" />
                    <div>
                      <p className="font-medium text-sm">{e.description}</p>
                      <p className="text-xs text-zinc-500">
                        {e.date} • {e.sourceAccount}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-red-400">{formatCurrency(e.amount)}</span>
                    <Badge variant="outline" className="text-xs">
                      {Math.round(e.confidence * 100)}%
                    </Badge>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleConfirm(e.transactionId, true)}
                        className="text-emerald-400 hover:text-emerald-300 p-1 h-auto"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleConfirm(e.transactionId, false)}
                        className="text-red-400 hover:text-red-300 p-1 h-auto"
                      >
                        <XCircle className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Monthly Breakdown */}
      {summary && summary.monthlyBreakdown.length > 0 && (
        <Card className="neu-raised border-white/5">
          <CardHeader>
            <CardTitle>Monthly Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="grid grid-cols-4 text-xs font-bold text-zinc-500 uppercase pb-2 border-b border-white/5">
                <span>Month</span>
                <span className="text-right">Contributions</span>
                <span className="text-right">Drawings</span>
                <span className="text-right">Net</span>
              </div>
              {(summary.monthlyBreakdown as Array<Record<string, unknown>>).map((m) => (
                <div
                  key={m.month}
                  className="grid grid-cols-4 text-sm py-1.5 border-b border-white/5 last:border-0"
                >
                  <span className="text-zinc-400">{m.month}</span>
                  <span className="text-right text-emerald-400">
                    {formatCurrency(m.contributions)}
                  </span>
                  <span className="text-right text-red-400">{formatCurrency(m.drawings)}</span>
                  <span
                    className={`text-right font-medium ${m.net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
                  >
                    {formatCurrency(m.net)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
