import { useState, useEffect } from 'react';
import { Search, Plus, Building2, ChevronLeft, ChevronRight } from 'lucide-react';
import { apApi } from '../../../api';
import type { Supplier } from '../../../api';

interface SupplierListProps {
  onSelect: (id: string) => void;
  onNew: () => void;
}

export function SupplierList({ onSelect, onNew }: SupplierListProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 20;

  const loadSuppliers = async () => {
    setLoading(true);
    try {
      const result = await apApi.fetchSuppliers({
        page,
        limit,
        search: search || undefined,
        isActive: showArchived ? undefined : true,
      });
      setSuppliers(result.suppliers);
      setTotal(result.total);
    } catch (e) {
      console.error('Failed to fetch suppliers', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, [page, search, showArchived]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search name, contact, or ABN..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#FFCC00]/30 focus:ring-1 focus:ring-[#FFCC00]/20 transition-all"
          />
        </div>

        <button
          onClick={() => {
            setShowArchived(!showArchived);
            setPage(1);
          }}
          className={`px-3 py-2.5 rounded-xl text-xs font-medium border transition-all ${
            showArchived
              ? 'bg-[#FFCC00]/10 text-[#FFCC00] border-[#FFCC00]/30'
              : 'bg-white/5 text-zinc-400 border-white/10 hover:text-zinc-200'
          }`}
        >
          {showArchived ? 'Show All' : 'Active Only'}
        </button>

        <button
          onClick={onNew}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FFCC00] text-black font-semibold text-sm hover:bg-[#FFCC00]/90 transition-all shadow-[0_0_20px_rgba(255,204,0,0.2)]"
        >
          <Plus className="h-4 w-4" />
          New Supplier
        </button>
      </div>

      {/* Table */}
      <div className="neu-raised rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Business Name
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider hidden md:table-cell">
                Contact
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider hidden lg:table-cell">
                ABN
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider hidden md:table-cell">
                Terms
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Status
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Outstanding
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-white/5">
                  <td colSpan={6} className="px-4 py-4">
                    <div className="h-4 w-48 bg-white/5 rounded animate-pulse" />
                  </td>
                </tr>
              ))
            ) : suppliers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <Building2 className="h-10 w-10 text-zinc-600 mx-auto mb-2" />
                  <p className="text-zinc-400 text-sm">No suppliers found</p>
                </td>
              </tr>
            ) : (
              suppliers.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => onSelect(s.id)}
                  className="border-b border-white/5 hover:bg-white/[0.02] cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-[#FFCC00]/10 flex items-center justify-center">
                        <Building2 className="h-4 w-4 text-[#FFCC00]" />
                      </div>
                      <span className="text-sm font-medium text-white">{s.businessName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-400 hidden md:table-cell">
                    {s.contactName ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-400 font-mono hidden lg:table-cell">
                    {s.abn ? formatABN(s.abn) : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-400 hidden md:table-cell">
                    {s.paymentTermsDays} days
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        s.isActive
                          ? 'bg-emerald-400/10 text-emerald-400'
                          : 'bg-zinc-400/10 text-zinc-400'
                      }`}
                    >
                      {s.isActive ? 'Active' : 'Archived'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-white">
                    {formatCurrency(s.outstandingAmount)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-zinc-500">
            Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg bg-white/5 text-zinc-400 hover:text-white disabled:opacity-30 transition-all"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-lg bg-white/5 text-zinc-400 hover:text-white disabled:opacity-30 transition-all"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);
}

function formatABN(abn: string): string {
  const digits = abn.replace(/\D/g, '');
  if (digits.length === 11) {
    return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  return abn;
}
