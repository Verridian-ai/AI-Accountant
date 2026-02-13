import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { api, type Account } from '@/api';
import { analyticsApi } from '@/api';
import { ArrowRight, ArrowLeft, Equal, Calculator, Loader2 } from 'lucide-react';
import type { NetPosition } from '../types';

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(
    Math.abs(cents) / 100,
  );
}

export function NetPositionCalculator() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountAId, setAccountAId] = useState<string>('');
  const [accountBId, setAccountBId] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [result, setResult] = useState<NetPosition | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  useEffect(() => {
    api
      .fetchAccounts()
      .then(setAccounts)
      .catch(console.error)
      .finally(() => setLoadingAccounts(false));
  }, []);

  const calculate = async () => {
    if (!accountAId || !accountBId) return;
    setLoading(true);
    try {
      const dateRange = startDate && endDate ? { start: startDate, end: endDate } : undefined;
      const data = await analyticsApi.fetchNetPosition(
        parseInt(accountAId),
        parseInt(accountBId),
        dateRange,
      );
      setResult(data);
    } catch (err) {
      console.error('Failed to calculate net position:', err);
    } finally {
      setLoading(false);
    }
  };

  const accountAName = accounts.find((a) => a.id === accountAId)?.accountName || 'Account A';
  const accountBName = accounts.find((a) => a.id === accountBId)?.accountName || 'Account B';

  return (
    <div className="neu-raised rounded-3xl border border-white/5 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-white/5 bg-white/[0.01] flex items-center gap-3">
        <div className="neu-inset p-2.5 rounded-xl text-[#FFCC00]">
          <Calculator className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-[11px] font-black text-zinc-100 uppercase tracking-[0.2em]">
            Net Position
          </h3>
          <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-tight mt-0.5">
            Compare two accounts
          </p>
        </div>
      </div>

      {/* Selectors */}
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em] block mb-1.5">
              Account A
            </label>
            <select
              value={accountAId}
              onChange={(e) => setAccountAId(e.target.value)}
              disabled={loadingAccounts}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-zinc-200 outline-none focus:border-[#FFCC00]/30"
            >
              <option value="" className="bg-[#0a0a0f]">
                Select account
              </option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id} className="bg-[#0a0a0f]">
                  {a.accountName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em] block mb-1.5">
              Account B
            </label>
            <select
              value={accountBId}
              onChange={(e) => setAccountBId(e.target.value)}
              disabled={loadingAccounts}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-zinc-200 outline-none focus:border-[#FFCC00]/30"
            >
              <option value="" className="bg-[#0a0a0f]">
                Select account
              </option>
              {accounts
                .filter((a) => a.id !== accountAId)
                .map((a) => (
                  <option key={a.id} value={a.id} className="bg-[#0a0a0f]">
                    {a.accountName}
                  </option>
                ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em] block mb-1.5">
              From
            </label>
            <input
              type="month"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 outline-none focus:border-[#FFCC00]/30"
            />
          </div>
          <div>
            <label className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em] block mb-1.5">
              To
            </label>
            <input
              type="month"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 outline-none focus:border-[#FFCC00]/30"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={calculate}
          disabled={!accountAId || !accountBId || loading}
          className="w-full py-3 rounded-xl bg-[#FFCC00] text-[#0a0a0f] text-xs font-black uppercase tracking-widest hover:bg-[#FFE066] transition-colors disabled:opacity-50 disabled:cursor-not-allowed btn-press"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Calculate'}
        </button>

        {/* Results */}
        {result && (
          <div className="space-y-3 mt-2">
            <div className="neu-inset rounded-2xl p-4 border border-white/5">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">
                  {accountAName} → {accountBName}
                </span>
                <span className="text-sm font-black text-red-400">
                  {formatCurrency(result.totalAtoB)}
                </span>
              </div>
            </div>
            <div className="neu-inset rounded-2xl p-4 border border-white/5">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">
                  {accountBName} → {accountAName}
                </span>
                <span className="text-sm font-black text-emerald-400">
                  {formatCurrency(result.totalBtoA)}
                </span>
              </div>
            </div>
            <div className="neu-raised rounded-2xl p-4 border border-[#FFCC00]/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {result.direction === 'A_to_B' && <ArrowRight className="w-4 h-4 text-red-400" />}
                  {result.direction === 'B_to_A' && (
                    <ArrowLeft className="w-4 h-4 text-emerald-400" />
                  )}
                  {result.direction === 'balanced' && <Equal className="w-4 h-4 text-[#FFCC00]" />}
                  <span className="text-[10px] font-black text-zinc-300 uppercase tracking-wider">
                    Net Position
                  </span>
                </div>
                <span
                  className={cn(
                    'text-lg font-black tracking-tighter',
                    result.direction === 'A_to_B'
                      ? 'text-red-400'
                      : result.direction === 'B_to_A'
                        ? 'text-emerald-400'
                        : 'text-[#FFCC00]',
                  )}
                >
                  {formatCurrency(result.net)}
                </span>
              </div>
              <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-tight mt-1">
                {result.direction === 'balanced'
                  ? 'Balanced'
                  : result.direction === 'A_to_B'
                    ? `Net flow towards ${accountBName}`
                    : `Net flow towards ${accountAName}`}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
