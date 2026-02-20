import { useState, useEffect, useCallback } from 'react';
import {
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
  draft: { bg: 'bg-zinc-400/10', text: 'text-secondary', label: 'Draft' },
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

  const loadOrders = useCallback(async () => {
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
  }, [page, statusFilter]);

  useEffect(() => {
    loadOrders();
  }, [page, limit, statusFilter, loadOrders]);

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
                  ? 'bg-cba-gold/10 text-cba-gold shadow-sm'
                  : 'text-secondary hover:text-primary'
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
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cba-gold text-black font-semibold text-sm hover:bg-cba-gold/90 transition-all shadow-[0_0_20px_rgba(255,204,0,0.2)]"
        >
          <Plus className="h-4 w-4" />
          New PO
        </button>
      </div>

      {/* Table */}
      <div className="neu-raised rounded-2xl overflow-hidden">
        <table className="w-full" aria-label="Purchase orders">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                PO #
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wider hidden md:table-cell">
                Supplier
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wider hidden lg:table-cell">
                Issue Date
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wider hidden lg:table-cell">
                Expected
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                Total
              </th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                Status
              </th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wider hidden md:table-cell">
                Received
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td colSpan={8} className="px-4 py-4">
                    <div className="h-4 w-full bg-overlay rounded animate-pulse" />
                  </td>
                </tr>
              ))
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center">
                  <ClipboardList className="h-10 w-10 text-zinc-600 mx-auto mb-2" />
                  <p className="text-secondary text-sm">No purchase orders found</p>
                </td>
              </tr>
            ) : (
              orders.map((po) => {
                const badge = STATUS_BADGE[po.status] || {
                  bg: 'bg-zinc-500/10',
                  text: 'text-zinc-400',
                  label: po.status,
                };
                const receivedPct = po.receivedPercentage ?? 0;

                return (
                  <tr
                    key={po.id}
                    className="border-b border-border/50 hover:bg-white/2 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="text-sm font-mono font-medium text-primary">
                        {po.poNumber}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-primary hidden md:table-cell">
                      {po.supplierName ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-secondary hidden lg:table-cell">
                      {po.issueDate ? new Date(po.issueDate).toLocaleDateString('en-AU') : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-secondary hidden lg:table-cell">
                      {po.expectedDate
                        ? new Date(po.expectedDate).toLocaleDateString('en-AU')
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-primary">
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
                        <div className="flex-1 h-1.5 rounded-full bg-overlay overflow-hidden">
                          <style>{`.progress-${po.id} { width: ${receivedPct}%; }`}</style>
                          <div
                            className={`h-full rounded-full bg-cba-gold transition-all progress-${po.id}`}
                          />
                        </div>
                        <span className="text-xs text-muted w-9 text-right">{receivedPct}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onEditPO(po.id)}
                          title="View / Edit"
                          className="p-1.5 rounded-lg text-muted hover:text-cba-gold transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        {po.status === 'draft' && (
                          <button
                            onClick={() => handleSendPO(po.id)}
                            title="Send to Supplier"
                            className="p-1.5 rounded-lg text-muted hover:text-blue-400 transition-colors"
                          >
                            <Send className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {(po.status === 'sent' || po.status === 'partially_received') && (
                          <button
                            onClick={() => onReceive(po.id)}
                            title="Receive Goods"
                            className="p-1.5 rounded-lg text-muted hover:text-emerald-400 transition-colors"
                          >
                            <PackageCheck className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {(po.status === 'draft' || po.status === 'sent') && (
                          <button
                            onClick={() => handleCancelPO(po.id)}
                            title="Cancel"
                            className="p-1.5 rounded-lg text-muted hover:text-red-400 transition-colors"
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
          <p className="text-xs text-muted">
            Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg bg-overlay text-secondary hover:text-primary disabled:opacity-30 transition-all"
              title="Previous Page"
              aria-label="Previous Page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-lg bg-overlay text-secondary hover:text-primary disabled:opacity-30 transition-all"
              title="Next Page"
              aria-label="Next Page"
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
