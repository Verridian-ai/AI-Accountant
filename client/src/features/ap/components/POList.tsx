import { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eye,
  Send,
  PackageCheck,
  XCircle,
} from 'lucide-react';
import { apApi } from '../../../api';
import type { PurchaseOrder } from '../../../api';

const STATUS_FILTERS = [
  'all',
  'draft',
  'sent',
  'partially_received',
  'received',
  'cancelled',
] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: 'bg-zinc-400/10', text: 'text-zinc-400', label: 'Draft' },
  sent: { bg: 'bg-blue-400/10', text: 'text-blue-400', label: 'Sent' },
  partially_received: { bg: 'bg-amber-400/10', text: 'text-amber-400', label: 'Partial' },
  received: { bg: 'bg-emerald-400/10', text: 'text-emerald-400', label: 'Received' },
  cancelled: { bg: 'bg-red-400/10', text: 'text-red-400', label: 'Cancelled' },
};

interface POListProps {
  onNewPO: () => void;
  onEditPO: (id: string) => void;
  onReceive: (id: string) => void;
}

export function POList({ onNewPO, onEditPO, onReceive }: POListProps) {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const limit = 20;

  const loadOrders = async () => {
    setLoading(true);
    try {
      const result = await apApi.fetchPurchaseOrders({
        page,
        limit,
        status: statusFilter === 'all' ? undefined : statusFilter,
      });
      setOrders(result.orders);
      setTotal(result.total);
    } catch (e) {
      console.error('Failed to fetch purchase orders', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [page, statusFilter]);

  const handleSendPO = async (id: string) => {
    try {
      await apApi.sendPurchaseOrder(id);
      loadOrders();
    } catch (e) {
      console.error('Failed to send PO', e);
    }
  };

  const handleCancelPO = async (id: string) => {
    try {
      await apApi.cancelPurchaseOrder(id);
      loadOrders();
    } catch (e) {
      console.error('Failed to cancel PO', e);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Status Filter Tabs */}
        <div className="flex gap-1 p-1 neu-inset rounded-xl overflow-x-auto">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => {
                setStatusFilter(s);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                statusFilter === s
                  ? 'bg-[#FFCC00]/10 text-[#FFCC00] shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {s === 'all'
                ? 'All'
                : s === 'partially_received'
                  ? 'Partial Recv'
                  : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <button
          onClick={onNewPO}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FFCC00] text-black font-semibold text-sm hover:bg-[#FFCC00]/90 transition-all shadow-[0_0_20px_rgba(255,204,0,0.2)]"
        >
          <Plus className="h-4 w-4" />
          New PO
        </button>
      </div>

      {/* Table */}
      <div className="neu-raised rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                PO #
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider hidden md:table-cell">
                Supplier
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider hidden lg:table-cell">
                Issue Date
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider hidden lg:table-cell">
                Expected
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Total
              </th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Status
              </th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider hidden md:table-cell">
                Received
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-white/5">
                  <td colSpan={8} className="px-4 py-4">
                    <div className="h-4 w-full bg-white/5 rounded animate-pulse" />
                  </td>
                </tr>
              ))
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center">
                  <ClipboardList className="h-10 w-10 text-zinc-600 mx-auto mb-2" />
                  <p className="text-zinc-400 text-sm">No purchase orders found</p>
                </td>
              </tr>
            ) : (
              orders.map((po) => {
                const badge = STATUS_BADGE[po.status] ?? STATUS_BADGE.draft;
                const receivedPct = po.receivedPercentage ?? 0;

                return (
                  <tr
                    key={po.id}
                    className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="text-sm font-mono font-medium text-white">
                        {po.poNumber}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-300 hidden md:table-cell">
                      {po.supplierName ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-400 hidden lg:table-cell">
                      {po.issueDate ? new Date(po.issueDate).toLocaleDateString('en-AU') : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-400 hidden lg:table-cell">
                      {po.expectedDate
                        ? new Date(po.expectedDate).toLocaleDateString('en-AU')
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-white">
                      {formatCurrency(po.total)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#FFCC00] transition-all"
                            style={{ width: `${receivedPct}%` }}
                          />
                        </div>
                        <span className="text-xs text-zinc-500 w-9 text-right">{receivedPct}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onEditPO(po.id)}
                          title="View / Edit"
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-[#FFCC00] transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        {po.status === 'draft' && (
                          <button
                            onClick={() => handleSendPO(po.id)}
                            title="Send to Supplier"
                            className="p-1.5 rounded-lg text-zinc-500 hover:text-blue-400 transition-colors"
                          >
                            <Send className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {(po.status === 'sent' || po.status === 'partially_received') && (
                          <button
                            onClick={() => onReceive(po.id)}
                            title="Receive Goods"
                            className="p-1.5 rounded-lg text-zinc-500 hover:text-emerald-400 transition-colors"
                          >
                            <PackageCheck className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {(po.status === 'draft' || po.status === 'sent') && (
                          <button
                            onClick={() => handleCancelPO(po.id)}
                            title="Cancel"
                            className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 transition-colors"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
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
