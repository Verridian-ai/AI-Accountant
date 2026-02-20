import { useState, useEffect } from 'react';
import {
  FileText,
  ChevronLeft,
  ChevronRight,
  Plus,
  Eye,
  CheckCircle,
  Ban,
  DollarSign,
} from 'lucide-react';
import { apApi } from '../../../api';
import type { Bill } from '../../../api';

type StatusFilter = 'all' | 'draft' | 'awaiting_approval' | 'approved' | 'overdue' | 'paid';

interface BillListProps {
  onNewBill: () => void;
  onEditBill: (id: string) => void;
  onApproveBill: (id: string) => void;
}

export function BillList({ onNewBill, onEditBill, onApproveBill }: BillListProps) {
  const [bills, setBills] = useState<Bill[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const limit = 20;

  const loadBills = async () => {
    setLoading(true);
    try {
      const result = await apApi.fetchBills({
        page,
        limit,
        status: statusFilter === 'all' ? undefined : statusFilter,
      });
      setBills(result.bills);
      setTotal(result.total);
    } catch (e) {
      console.error('Failed to fetch bills', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBills();
  }, [page, statusFilter]);

  const totalPages = Math.ceil(total / limit);

  const statusTabs: { id: StatusFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'draft', label: 'Draft' },
    { id: 'awaiting_approval', label: 'Awaiting' },
    { id: 'approved', label: 'Approved' },
    { id: 'overdue', label: 'Overdue' },
    { id: 'paid', label: 'Paid' },
  ];

  const handleQuickAction = async (action: string, bill: Bill) => {
    switch (action) {
      case 'view':
        onEditBill(bill.id);
        break;
      case 'approve':
        onApproveBill(bill.id);
        break;
      case 'pay':
        try {
          await apApi.payBill(bill.id, { paymentDate: new Date().toISOString().split('T')[0] });
          loadBills();
        } catch (e) {
          console.error('Failed to pay bill', e);
        }
        break;
      case 'void':
        try {
          await apApi.voidBill(bill.id);
          loadBills();
        } catch (e) {
          console.error('Failed to void bill', e);
        }
        break;
    }
  };

  return (
    <div className="space-y-4">
      {/* Status Filter + New */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 p-1 neu-inset rounded-xl">
          {statusTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setStatusFilter(tab.id);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                statusFilter === tab.id
                  ? 'bg-cba-gold/10 text-cba-gold'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          onClick={onNewBill}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cba-gold text-black font-semibold text-sm hover:bg-cba-gold/90 transition-all shadow-[0_0_20px_rgba(255,204,0,0.2)]"
        >
          <Plus className="h-4 w-4" />
          New Bill
        </button>
      </div>

      {/* Table */}
      <div className="neu-raised rounded-2xl overflow-hidden">
        <table className="w-full" aria-label="Bills">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                Bill #
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                Supplier
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wider hidden md:table-cell">
                Issue Date
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wider hidden md:table-cell">
                Due Date
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                Total
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                Status
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
                  <td colSpan={7} className="px-4 py-4">
                    <div className="h-4 w-full bg-overlay rounded animate-pulse" />
                  </td>
                </tr>
              ))
            ) : bills.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center">
                  <FileText className="h-10 w-10 text-zinc-600 mx-auto mb-2" />
                  <p className="text-secondary text-sm">No bills found</p>
                </td>
              </tr>
            ) : (
              bills.map((bill) => (
                <tr
                  key={bill.id}
                  className="border-b border-border/50 hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-4 py-3 text-sm text-primary font-mono">{bill.billNumber}</td>
                  <td className="px-4 py-3 text-sm text-primary">{bill.supplierName ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-secondary hidden md:table-cell">
                    {bill.issueDate}
                  </td>
                  <td className="px-4 py-3 text-sm text-secondary hidden md:table-cell">
                    {bill.dueDate}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-primary">
                    {formatCurrency(bill.total)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={bill.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <ActionButton
                        icon={Eye}
                        tooltip="View"
                        onClick={() => handleQuickAction('view', bill)}
                      />
                      {bill.status === 'awaiting_approval' && (
                        <ActionButton
                          icon={CheckCircle}
                          tooltip="Approve"
                          onClick={() => handleQuickAction('approve', bill)}
                          accent
                        />
                      )}
                      {bill.status === 'approved' && (
                        <ActionButton
                          icon={DollarSign}
                          tooltip="Pay"
                          onClick={() => handleQuickAction('pay', bill)}
                          accent
                        />
                      )}
                      {(bill.status === 'draft' || bill.status === 'awaiting_approval') && (
                        <ActionButton
                          icon={Ban}
                          tooltip="Void"
                          onClick={() => handleQuickAction('void', bill)}
                          danger
                        />
                      )}
                    </div>
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
          <p className="text-xs text-muted">
            Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg bg-overlay text-secondary hover:text-primary disabled:opacity-30 transition-all"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-lg bg-overlay text-secondary hover:text-primary disabled:opacity-30 transition-all"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: 'bg-zinc-400/10 text-secondary',
    awaiting_approval: 'bg-amber-400/10 text-amber-400',
    approved: 'bg-emerald-400/10 text-emerald-400',
    overdue: 'bg-red-400/10 text-red-400',
    paid: 'bg-blue-400/10 text-blue-400',
    void: 'bg-zinc-500/10 text-muted',
  };
  const labels: Record<string, string> = {
    draft: 'Draft',
    awaiting_approval: 'Awaiting',
    approved: 'Approved',
    overdue: 'Overdue',
    paid: 'Paid',
    void: 'Void',
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] ?? styles.draft}`}
    >
      {labels[status] ?? status}
    </span>
  );
}

function ActionButton({
  icon: Icon,
  tooltip,
  onClick,
  accent,
  danger,
}: {
  icon: typeof Eye;
  tooltip: string;
  onClick: () => void;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={tooltip}
      className={`p-1.5 rounded-lg transition-all ${
        danger
          ? 'text-muted hover:text-red-400 hover:bg-red-400/10'
          : accent
            ? 'text-cba-gold/60 hover:text-cba-gold hover:bg-cba-gold/10'
            : 'text-muted hover:text-primary hover:bg-overlay'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);
}
