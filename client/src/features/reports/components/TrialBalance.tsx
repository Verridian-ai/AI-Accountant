import { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, AlertTriangle, ArrowUpDown } from 'lucide-react';
import { reportsApi } from '@/api';
import type { TrialBalanceReport, TrialBalanceEntry } from '@/api';

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);

interface Props {
  asAtDate: string;
}

type SortKey = 'accountName' | 'debit' | 'credit' | 'netBalance';
type SortDir = 'asc' | 'desc';

function SortHeader({
  label,
  field,
  sortKey,
  onSort,
}: {
  label: string;
  field: SortKey;
  sortKey: SortKey;
  onSort: (f: SortKey) => void;
}) {
  return (
    <th
      className="pb-2 font-medium cursor-pointer hover:text-cba-gold transition-colors select-none"
      onClick={() => onSort(field)}
    >
      <span className="flex items-center gap-1 justify-end">
        {label}
        <ArrowUpDown
          className={`h-3 w-3 ${sortKey === field ? 'text-cba-gold' : 'text-zinc-600'}`}
        />
      </span>
    </th>
  );
}

export function TrialBalance({ asAtDate }: Props) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<TrialBalanceReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('accountName');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  useEffect(() => {
    if (!asAtDate) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    reportsApi
      .fetchTrialBalance(asAtDate)
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Unknown error'))
      .finally(() => setLoading(false));
  }, [asAtDate]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-cba-gold" />
        <span className="ml-3 text-secondary">Loading trial balance...</span>
      </div>
    );
  }

  if (error) {
    return <div className="neu-inset rounded-2xl p-6 text-center text-red-400">{error}</div>;
  }

  if (!data) {
    return (
      <div className="neu-inset rounded-2xl p-6 text-center text-muted">
        Select a date to generate the Trial Balance.
      </div>
    );
  }

  const entries = [...(data.entries ?? [])];
  entries.sort((a: TrialBalanceEntry, b: TrialBalanceEntry) => {
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return sortDir === 'asc'
      ? (aVal as number) - (bVal as number)
      : (bVal as number) - (aVal as number);
  });

  return (
    <div className="space-y-6">
      {/* Balance Check */}
      <div
        className={`neu-raised rounded-2xl p-4 flex items-center gap-3 border ${data.isBalanced ? 'border-emerald-500/20' : 'border-red-500/20'}`}
      >
        {data.isBalanced ? (
          <CheckCircle2 className="h-6 w-6 text-emerald-400" />
        ) : (
          <AlertTriangle className="h-6 w-6 text-red-400" />
        )}
        <span className={`font-bold ${data.isBalanced ? 'text-emerald-400' : 'text-red-400'}`}>
          {data.isBalanced
            ? 'Trial Balance is balanced — Debits = Credits'
            : `Trial Balance is out by ${formatCurrency(data.difference)}`}
        </span>
        <span className="ml-auto text-xs text-muted">
          As at {new Date(asAtDate).toLocaleDateString('en-AU')}
        </span>
      </div>

      {/* Trial Balance Table */}
      <div className="neu-raised rounded-2xl p-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted border-b border-border/50">
              <th
                className="text-left pb-2 font-medium cursor-pointer hover:text-cba-gold transition-colors"
                onClick={() => handleSort('accountName')}
              >
                <span className="flex items-center gap-1">
                  Account
                  <ArrowUpDown
                    className={`h-3 w-3 ${sortKey === 'accountName' ? 'text-cba-gold' : 'text-zinc-600'}`}
                  />
                </span>
              </th>
              <SortHeader label="Debit" field="debit" sortKey={sortKey} onSort={handleSort} />
              <SortHeader label="Credit" field="credit" sortKey={sortKey} onSort={handleSort} />
              <SortHeader label="Net" field="netBalance" sortKey={sortKey} onSort={handleSort} />
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, idx) => (
              <tr
                key={`${entry.accountName}-${idx}`}
                className="border-b border-border/50 hover:bg-overlay transition-colors"
              >
                <td className="py-2 text-primary">{entry.accountName}</td>
                <td className="py-2 text-right font-mono text-emerald-400">
                  {entry.debit > 0 ? formatCurrency(entry.debit) : '—'}
                </td>
                <td className="py-2 text-right font-mono text-red-400">
                  {entry.credit > 0 ? formatCurrency(entry.credit) : '—'}
                </td>
                <td
                  className={`py-2 text-right font-mono ${entry.netBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
                >
                  {formatCurrency(entry.netBalance)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-cba-gold/30">
              <td className="pt-3 font-bold text-zinc-100">Totals</td>
              <td className="pt-3 text-right font-bold font-mono text-emerald-400">
                {formatCurrency(data.totalDebits)}
              </td>
              <td className="pt-3 text-right font-bold font-mono text-red-400">
                {formatCurrency(data.totalCredits)}
              </td>
              <td
                className={`pt-3 text-right font-bold font-mono ${data.difference === 0 ? 'text-cba-gold' : 'text-red-400'}`}
              >
                {formatCurrency(data.difference)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
