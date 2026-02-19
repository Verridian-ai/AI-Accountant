import { useState, useEffect, useCallback } from 'react';
import { API_URL } from '@/api/client';
import type { Transaction } from '@/api';
import { CurrencyDisplay } from '@/components/common/CurrencyDisplay';

interface AdminTransactionsResponse {
  transactions: (Transaction & { tenantId?: string })[];
  total: number;
}

export function AdminTransactionsView() {
  const [transactions, setTransactions] = useState<(Transaction & { tenantId?: string })[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const LIMIT = 100;

  const fetchPage = useCallback(async (pageOffset: number, append: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const adminToken = localStorage.getItem('admin_token');
      const res = await fetch(`${API_URL}/admin/transactions?limit=${LIMIT}&offset=${pageOffset}`, {
        headers: adminToken ? { Authorization: `Bearer ${adminToken}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const data: AdminTransactionsResponse = await res.json();
      setTransactions((prev) =>
        append ? [...prev, ...(data.transactions ?? [])] : (data.transactions ?? []),
      );
      setTotal(data.total ?? 0);
      setOffset(pageOffset + (data.transactions?.length ?? 0));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPage(0, false);
  }, [fetchPage]);

  const handleLoadMore = () => {
    fetchPage(offset, true);
  };

  if (loading && transactions.length === 0) {
    return (
      <div className="space-y-3 animate-pulse p-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-10 bg-white/5 rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <span className="text-red-400 font-bold">Error loading transactions</span>
        <span className="text-zinc-500 text-sm">{error}</span>
        <button
          onClick={() => fetchPage(0, false)}
          className="px-4 py-2 text-xs font-black uppercase tracking-widest text-[#FFCC00] neu-raised-sm rounded-xl border border-[#FFCC00]/10 hover:border-[#FFCC00]/30 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <span className="text-zinc-500 font-bold">No transactions found</span>
        <span className="text-zinc-600 text-sm">The admin endpoint returned an empty dataset.</span>
      </div>
    );
  }

  const hasMore = transactions.length < total;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-base font-black text-white tracking-tight">All Transactions</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Showing {transactions.length} of {total} across all tenants
          </p>
        </div>
        <button
          onClick={() => fetchPage(0, false)}
          className="px-3 py-1.5 text-xs font-black uppercase tracking-widest text-zinc-400 hover:text-white border border-white/10 hover:border-white/20 rounded-lg transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-white/5">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 bg-black/30">
              <th className="px-4 py-3 text-left text-xs font-black text-zinc-600 uppercase tracking-widest">
                Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-black text-zinc-600 uppercase tracking-widest">
                Description
              </th>
              <th className="px-4 py-3 text-right text-xs font-black text-zinc-600 uppercase tracking-widest">
                Amount
              </th>
              <th className="px-4 py-3 text-left text-xs font-black text-zinc-600 uppercase tracking-widest">
                Category
              </th>
              <th className="px-4 py-3 text-left text-xs font-black text-zinc-600 uppercase tracking-widest">
                Account
              </th>
              <th className="px-4 py-3 text-left text-xs font-black text-zinc-600 uppercase tracking-widest">
                Tenant
              </th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr
                key={tx.id}
                className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
              >
                <td className="px-4 py-2.5 text-zinc-400 font-mono text-xs whitespace-nowrap">
                  {tx.date}
                </td>
                <td className="px-4 py-2.5 text-zinc-200 max-w-[260px] truncate">
                  {tx.description}
                </td>
                <td
                  className={`px-4 py-2.5 text-right font-bold font-mono text-xs whitespace-nowrap ${
                    tx.amount >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  <CurrencyDisplay amount={tx.amount} />
                </td>
                <td className="px-4 py-2.5 text-zinc-400 text-xs">
                  {tx.category ?? <span className="text-zinc-600">—</span>}
                </td>
                <td className="px-4 py-2.5 text-zinc-500 text-xs font-mono truncate max-w-[120px]">
                  {tx.accountId ?? <span className="text-zinc-700">—</span>}
                </td>
                <td className="px-4 py-2.5 text-zinc-600 text-xs font-mono">
                  {tx.tenantId ?? <span className="text-zinc-700">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Load More */}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <button
            onClick={handleLoadMore}
            disabled={loading}
            className="px-6 py-2.5 text-xs font-black uppercase tracking-widest text-[#FFCC00] neu-raised-sm rounded-xl border border-[#FFCC00]/10 hover:border-[#FFCC00]/30 transition-colors disabled:opacity-50"
          >
            {loading ? 'Loading…' : `Load More (${total - transactions.length} remaining)`}
          </button>
        </div>
      )}
    </div>
  );
}
