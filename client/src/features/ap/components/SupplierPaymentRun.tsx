import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Banknote,
  CheckSquare,
  Square,
  Play,
  CheckCircle2,
  Loader2,
  DollarSign,
} from 'lucide-react';
import { apApi } from '../../../api';
import type { Bill } from '../../../api';

type PaymentRunStatus = 'selecting' | 'draft' | 'processing' | 'completed';

const LOADING_SKELETON_ROWS = [0, 1, 2, 3, 4] as const;

interface PaymentRunDetail {
  id: string;
  paymentDate: string;
  status: string;
  bankReference?: string;
  totalAmount: number;
  billCount: number;
  bills: Bill[];
}

interface SupplierPaymentRunProps {
  onBack: () => void;
  onComplete: () => void;
}

export function SupplierPaymentRun({ onBack, onComplete }: SupplierPaymentRunProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [bills, setBills] = useState<Bill[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [bankReference, setBankReference] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [runStatus, setRunStatus] = useState<PaymentRunStatus>('selecting');
  const [paymentRun, setPaymentRun] = useState<PaymentRunDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadApprovedBills();
  }, []);

  const loadApprovedBills = async () => {
    setLoading(true);
    try {
      const result = await apApi.fetchBills({ status: 'approved', limit: 200 });
      // Only show bills with amount > 0
      setBills(result.bills.filter((b) => b.total > 0));
    } catch (e) {
      console.error('Failed to fetch approved bills', e);
    } finally {
      setLoading(false);
    }
  };

  const filteredBills = supplierFilter
    ? bills.filter((b) =>
        (b.supplierName ?? '').toLowerCase().includes(supplierFilter.toLowerCase()),
      )
    : bills;

  // Sort by due date soonest first
  const sortedBills = [...filteredBills].sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
  );

  const toggleBill = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(sortedBills.map((b) => b.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const selectedBills = sortedBills.filter((b) => selectedIds.has(b.id));
  const selectedTotal = selectedBills.reduce((sum, b) => sum + b.total, 0);

  const handleCreatePaymentRun = async () => {
    if (selectedIds.size === 0) {
      setError('Select at least one bill');
      return;
    }
    setError('');
    setSaving(true);

    try {
      const result = await apApi.createPaymentRun({
        paymentDate,
        bankReference: bankReference || undefined,
        billIds: Array.from(selectedIds),
      });
      setPaymentRun({
        id: result.id,
        paymentDate,
        status: 'draft',
        bankReference: bankReference || undefined,
        totalAmount: selectedTotal,
        billCount: selectedIds.size,
        bills: selectedBills,
      });
      setRunStatus('draft');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create payment run');
    } finally {
      setSaving(false);
    }
  };

  const handleProcessPayment = async () => {
    if (!paymentRun) return;
    setProcessing(true);
    setRunStatus('processing');

    try {
      await apApi.processPaymentRun(paymentRun.id);
      setRunStatus('completed');
      setPaymentRun((prev) => (prev ? { ...prev, status: 'completed' } : prev));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to process payment');
      setRunStatus('draft');
    } finally {
      setProcessing(false);
    }
  };

  const isOverdue = (date: string) => {
    return new Date(date) < new Date(new Date().toISOString().split('T')[0]);
  };

  if (loading) {
    return (
      <div className="neu-raised rounded-2xl p-8 animate-pulse">
        <div className="h-6 w-48 bg-overlay rounded mb-6" />
        <div className="space-y-3">
          {LOADING_SKELETON_ROWS.map((i) => (
            <div key={i} className="h-12 w-full bg-overlay rounded" />
          ))}
        </div>
      </div>
    );
  }

  // Completed view
  if (runStatus === 'completed') {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="neu-raised rounded-2xl p-8 text-center">
          <CheckCircle2 className="h-16 w-16 text-emerald-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-primary mb-2">Payment Run Complete</h2>
          <p className="text-secondary text-sm mb-1">
            {paymentRun?.billCount} bills paid totalling{' '}
            <span className="text-cba-gold font-semibold">
              {formatCurrency(paymentRun?.totalAmount ?? 0)}
            </span>
          </p>
          {paymentRun?.bankReference && (
            <p className="text-muted text-xs">Bank Reference: {paymentRun.bankReference}</p>
          )}
          <button
            onClick={onComplete}
            className="mt-6 px-6 py-2.5 rounded-xl bg-cba-gold text-black text-sm font-semibold hover:bg-cba-gold/90 transition-all shadow-[0_0_20px_rgba(255,204,0,0.2)]"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  // Draft view — confirm and process
  if (runStatus === 'draft' && paymentRun) {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              setRunStatus('selecting');
              setPaymentRun(null);
            }}
            className="p-2 rounded-xl bg-overlay text-secondary hover:text-primary transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-primary">Payment Run</h2>
            <p className="text-xs text-muted mt-0.5">Review and process</p>
          </div>
          <span className="ml-auto px-3 py-1 rounded-full text-xs font-medium bg-amber-400/10 text-amber-400">
            Draft
          </span>
        </div>

        {/* Run Summary */}
        <div className="neu-raised rounded-2xl p-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted text-xs">Payment Date</span>
              <p className="text-primary font-medium">
                {new Date(paymentRun.paymentDate).toLocaleDateString('en-AU')}
              </p>
            </div>
            <div>
              <span className="text-muted text-xs">Bills</span>
              <p className="text-primary font-medium">{paymentRun.billCount}</p>
            </div>
            <div>
              <span className="text-muted text-xs">Total Amount</span>
              <p className="text-cba-gold font-bold">{formatCurrency(paymentRun.totalAmount)}</p>
            </div>
            <div>
              <span className="text-muted text-xs">Bank Reference</span>
              <p className="text-primary">{paymentRun.bankReference ?? '—'}</p>
            </div>
          </div>
        </div>

        {/* Bills in run */}
        <div className="neu-raised rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-secondary">Bill #</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-secondary hidden md:table-cell">
                  Supplier
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-secondary hidden md:table-cell">
                  Due Date
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-secondary">Amount</th>
              </tr>
            </thead>
            <tbody>
              {paymentRun.bills.map((b) => (
                <tr key={b.id} className="border-b border-border/50">
                  <td className="px-4 py-3 text-sm font-mono text-primary">{b.billNumber}</td>
                  <td className="px-4 py-3 text-sm text-primary hidden md:table-cell">
                    {b.supplierName ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-secondary hidden md:table-cell">
                    {new Date(b.dueDate).toLocaleDateString('en-AU')}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-primary">
                    {formatCurrency(b.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={() => {
              setRunStatus('selecting');
              setPaymentRun(null);
            }}
            className="px-4 py-2.5 rounded-xl bg-overlay text-secondary text-sm font-medium hover:text-primary transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleProcessPayment}
            disabled={processing}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cba-gold text-black text-sm font-semibold hover:bg-cba-gold/90 transition-all shadow-[0_0_20px_rgba(255,204,0,0.2)] disabled:opacity-50"
          >
            {processing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Process Payment
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // Selection view
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 rounded-xl bg-overlay text-secondary hover:text-primary transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-primary">New Payment Run</h2>
          <p className="text-xs text-muted mt-0.5">Select approved bills to pay</p>
        </div>
      </div>

      {/* Controls */}
      <div className="neu-raised rounded-2xl p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="spr-payment-date"
              className="block text-xs font-medium text-secondary mb-1.5"
            >
              Payment Date
            </label>
            <input
              id="spr-payment-date"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-overlay border border-border text-sm text-primary focus:outline-none focus:border-cba-gold/30 focus:ring-1 focus:ring-[#FFCC00]/20 transition-all"
            />
          </div>
          <div>
            <label
              htmlFor="spr-supplier-filter"
              className="block text-xs font-medium text-secondary mb-1.5"
            >
              Supplier Filter
            </label>
            <input
              id="spr-supplier-filter"
              type="text"
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              placeholder="All suppliers"
              className="w-full px-4 py-2.5 rounded-xl bg-overlay border border-border text-sm text-primary placeholder-zinc-500 focus:outline-none focus:border-cba-gold/30 focus:ring-1 focus:ring-[#FFCC00]/20 transition-all"
            />
          </div>
          <div>
            <label
              htmlFor="spr-bank-reference"
              className="block text-xs font-medium text-secondary mb-1.5"
            >
              Bank Reference
            </label>
            <input
              id="spr-bank-reference"
              type="text"
              value={bankReference}
              onChange={(e) => setBankReference(e.target.value)}
              placeholder="Optional reference"
              className="w-full px-4 py-2.5 rounded-xl bg-overlay border border-border text-sm text-primary placeholder-zinc-500 focus:outline-none focus:border-cba-gold/30 focus:ring-1 focus:ring-[#FFCC00]/20 transition-all"
            />
          </div>
        </div>

        {/* Bulk actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={selectAll}
            className="text-xs text-cba-gold hover:text-cba-gold/80 transition-colors"
          >
            Select All ({sortedBills.length})
          </button>
          <span className="text-zinc-600">|</span>
          <button
            onClick={deselectAll}
            className="text-xs text-secondary hover:text-primary transition-colors"
          >
            Deselect All
          </button>
        </div>
      </div>

      {/* Bills Table */}
      <div className="neu-raised rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/50">
              <th className="w-10 px-3 py-3" />
              <th className="text-left px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                Bill #
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wider hidden md:table-cell">
                Supplier
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                Due Date
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedBills.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center">
                  <Banknote className="h-10 w-10 text-zinc-600 mx-auto mb-2" />
                  <p className="text-secondary text-sm">No approved bills available</p>
                </td>
              </tr>
            ) : (
              sortedBills.map((b) => {
                const selected = selectedIds.has(b.id);
                const overdue = isOverdue(b.dueDate);
                return (
                  <tr
                    key={b.id}
                    onClick={() => toggleBill(b.id)}
                    className={`border-b border-border/50 cursor-pointer transition-colors ${
                      selected ? 'bg-cba-gold/[0.03]' : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    <td className="px-3 py-3 text-center">
                      {selected ? (
                        <CheckSquare className="h-4 w-4 text-cba-gold inline" />
                      ) : (
                        <Square className="h-4 w-4 text-zinc-600 inline" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-primary">{b.billNumber}</td>
                    <td className="px-4 py-3 text-sm text-primary hidden md:table-cell">
                      {b.supplierName ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={overdue ? 'text-red-400' : 'text-secondary'}>
                        {new Date(b.dueDate).toLocaleDateString('en-AU')}
                      </span>
                      {overdue && <span className="ml-1.5 text-xs text-red-400/80">Overdue</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-primary">
                      {formatCurrency(b.total)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Selection Summary + Create */}
      <div className="neu-raised rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-cba-gold" />
              <div>
                <p className="text-xs text-muted">Selected</p>
                <p className="text-sm font-semibold text-primary">{selectedIds.size} bills</p>
              </div>
            </div>
            <div className="h-8 w-px bg-overlay-hover" />
            <div>
              <p className="text-xs text-muted">Total Amount</p>
              <p className="text-lg font-bold text-cba-gold">{formatCurrency(selectedTotal)}</p>
            </div>
          </div>

          {error && <span className="text-red-400 text-xs mr-4">{error}</span>}

          <button
            onClick={handleCreatePaymentRun}
            disabled={saving || selectedIds.size === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cba-gold text-black text-sm font-semibold hover:bg-cba-gold/90 transition-all shadow-[0_0_20px_rgba(255,204,0,0.2)] disabled:opacity-50"
          >
            <Banknote className="h-4 w-4" />
            {saving ? 'Creating...' : 'Create Payment Run'}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);
}
