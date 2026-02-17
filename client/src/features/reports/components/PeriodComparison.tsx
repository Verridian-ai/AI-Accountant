import { useState } from 'react';
import { Loader2, BarChart3 } from 'lucide-react';
import { reportsApi } from '@/api';
import type { PeriodComparisonReport, PeriodComparisonRow } from '@/api';

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);

function getVarianceColor(percent: number): string {
  const abs = Math.abs(percent);
  if (abs > 25) return 'text-red-400';
  if (abs > 10) return 'text-amber-400';
  return 'text-zinc-300';
}

function getVarianceBg(percent: number): string {
  const abs = Math.abs(percent);
  if (abs > 25) return 'bg-red-500/10';
  if (abs > 10) return 'bg-amber-500/10';
  return '';
}

export function PeriodComparison() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PeriodComparisonReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [currentStart, setCurrentStart] = useState('');
  const [currentEnd, setCurrentEnd] = useState('');
  const [priorStart, setPriorStart] = useState('');
  const [priorEnd, setPriorEnd] = useState('');
  const [reportType, setReportType] = useState('pnl');

  const handleCompare = () => {
    if (!currentStart || !currentEnd || !priorStart || !priorEnd) return;
    setLoading(true);
    setError(null);
    reportsApi
      .comparePeriods(currentStart, currentEnd, priorStart, priorEnd, reportType)
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Unknown error'))
      .finally(() => setLoading(false));
  };

  // Calculate significant changes from data
  const significantChanges = (data?.rows ?? [])
    .filter((r: PeriodComparisonRow) => Math.abs(r.variancePercent) > 10)
    .sort(
      (a: PeriodComparisonRow, b: PeriodComparisonRow) =>
        Math.abs(b.variancePercent) - Math.abs(a.variancePercent),
    )
    .slice(0, 4);

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="neu-raised rounded-2xl p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Current Period */}
          <div>
            <label className="block text-xs text-zinc-500 font-medium uppercase tracking-wide mb-2">
              Current Period
            </label>
            <div className="flex gap-2">
              <input
                type="date"
                value={currentStart}
                onChange={(e) => setCurrentStart(e.target.value)}
                className="flex-1 neu-inset rounded-xl px-3 py-2 text-sm text-zinc-200 bg-transparent outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
              />
              <input
                type="date"
                value={currentEnd}
                onChange={(e) => setCurrentEnd(e.target.value)}
                className="flex-1 neu-inset rounded-xl px-3 py-2 text-sm text-zinc-200 bg-transparent outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
              />
            </div>
          </div>

          {/* Prior Period */}
          <div>
            <label className="block text-xs text-zinc-500 font-medium uppercase tracking-wide mb-2">
              Prior Period
            </label>
            <div className="flex gap-2">
              <input
                type="date"
                value={priorStart}
                onChange={(e) => setPriorStart(e.target.value)}
                className="flex-1 neu-inset rounded-xl px-3 py-2 text-sm text-zinc-200 bg-transparent outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
              />
              <input
                type="date"
                value={priorEnd}
                onChange={(e) => setPriorEnd(e.target.value)}
                className="flex-1 neu-inset rounded-xl px-3 py-2 text-sm text-zinc-200 bg-transparent outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
              />
            </div>
          </div>

          {/* Report Type & Action */}
          <div>
            <label className="block text-xs text-zinc-500 font-medium uppercase tracking-wide mb-2">
              Report Type
            </label>
            <div className="flex gap-2">
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="flex-1 neu-inset rounded-xl px-3 py-2 text-sm text-zinc-200 bg-transparent outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
              >
                <option value="pnl">Profit & Loss</option>
                <option value="balance-sheet">Balance Sheet</option>
                <option value="cash-flow">Cash Flow</option>
              </select>
              <button
                type="button"
                onClick={handleCompare}
                disabled={loading || !currentStart || !currentEnd || !priorStart || !priorEnd}
                className="neu-raised px-4 py-2 rounded-xl text-sm font-bold text-[#FFCC00] hover:bg-[#FFCC00]/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors btn-press"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <BarChart3 className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && <div className="neu-inset rounded-2xl p-6 text-center text-red-400">{error}</div>}

      {data && (
        <>
          {/* Significant Changes Cards */}
          {significantChanges.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {significantChanges.map((row: PeriodComparisonRow) => (
                <div
                  key={row.category}
                  className={`neu-raised rounded-2xl p-4 border ${Math.abs(row.variancePercent) > 25 ? 'border-red-500/20' : 'border-amber-500/20'}`}
                >
                  <p className="text-xs text-zinc-500 truncate mb-1">{row.category}</p>
                  <p
                    className={`text-lg font-bold font-mono ${getVarianceColor(row.variancePercent)}`}
                  >
                    {row.variancePercent > 0 ? '+' : ''}
                    {row.variancePercent.toFixed(1)}%
                  </p>
                  <p className="text-xs text-zinc-500 font-mono">
                    {formatCurrency(row.varianceDollars)}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Comparison Table */}
          <div className="neu-raised rounded-2xl p-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-zinc-500 border-b border-white/5">
                  <th className="text-left pb-2 font-medium">Category</th>
                  <th className="text-right pb-2 font-medium">Current</th>
                  <th className="text-right pb-2 font-medium">Prior</th>
                  <th className="text-right pb-2 font-medium">Variance $</th>
                  <th className="text-right pb-2 font-medium">Variance %</th>
                </tr>
              </thead>
              <tbody>
                {(data.rows ?? []).map((row: PeriodComparisonRow) => (
                  <tr
                    key={row.category}
                    className={`border-b border-white/5 hover:bg-white/5 transition-colors ${getVarianceBg(row.variancePercent)}`}
                  >
                    <td className="py-2 text-zinc-200">{row.category}</td>
                    <td className="py-2 text-right font-mono text-zinc-200">
                      {formatCurrency(row.current)}
                    </td>
                    <td className="py-2 text-right font-mono text-zinc-400">
                      {formatCurrency(row.prior)}
                    </td>
                    <td
                      className={`py-2 text-right font-mono ${row.varianceDollars >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
                    >
                      {row.varianceDollars >= 0 ? '+' : ''}
                      {formatCurrency(row.varianceDollars)}
                    </td>
                    <td
                      className={`py-2 text-right font-mono font-bold ${getVarianceColor(row.variancePercent)}`}
                    >
                      {row.variancePercent >= 0 ? '+' : ''}
                      {row.variancePercent.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
              {data.summary && (
                <tfoot>
                  <tr className="border-t-2 border-[#FFCC00]/30">
                    <td className="pt-3 font-bold text-zinc-100">Totals</td>
                    <td className="pt-3 text-right font-bold font-mono text-zinc-200">
                      {formatCurrency(data.summary.currentTotal)}
                    </td>
                    <td className="pt-3 text-right font-bold font-mono text-zinc-400">
                      {formatCurrency(data.summary.priorTotal)}
                    </td>
                    <td
                      className={`pt-3 text-right font-bold font-mono ${data.summary.netVariance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
                    >
                      {data.summary.netVariance >= 0 ? '+' : ''}
                      {formatCurrency(data.summary.netVariance)}
                    </td>
                    <td className="pt-3 text-right font-bold font-mono text-zinc-400">
                      {data.summary.priorTotal !== 0
                        ? `${((data.summary.netVariance / Math.abs(data.summary.priorTotal)) * 100).toFixed(1)}%`
                        : '—'}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}

      {!data && !loading && !error && (
        <div className="neu-inset rounded-2xl p-6 text-center text-zinc-500">
          Configure the date ranges above and click compare to generate a period comparison.
        </div>
      )}
    </div>
  );
}
