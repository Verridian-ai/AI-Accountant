import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  FileText,
  AlertTriangle,
  Check,
  Minus,
} from 'lucide-react';
import { apApi } from '../../../api';
import type { Bill } from '../../../api';

interface BillApprovalProps {
  billId: string;
  onBack: () => void;
  onAction: () => void;
}

// Mock three-way match data (real data would come from PO + receiving endpoints)
interface ThreeWayMatch {
  poAmount: number;
  receiptAmount: number;
  billAmount: number;
  status: 'matched' | 'discrepancy' | 'partial';
  discrepancies: string[];
}

export function BillApproval({ billId, onBack, onAction }: BillApprovalProps) {
  const [bill, setBill] = useState<Bill | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showConfirmApprove, setShowConfirmApprove] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const b = await apApi.fetchBill(billId);
        setBill(b);
      } catch (e) {
        console.error('Failed to load bill', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [billId]);

  const handleApprove = async () => {
    setApproving(true);
    try {
      await apApi.approveBill(billId);
      onAction();
    } catch (e) {
      console.error('Failed to approve bill', e);
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    setRejecting(true);
    try {
      await apApi.rejectBill(billId, rejectReason.trim());
      onAction();
    } catch (e) {
      console.error('Failed to reject bill', e);
    } finally {
      setRejecting(false);
    }
  };

  // Simulate three-way match if PO linked
  const threeWayMatch: ThreeWayMatch | null = bill?.purchaseOrderId
    ? {
        poAmount: bill.total,
        receiptAmount: bill.total,
        billAmount: bill.total,
        status: 'matched',
        discrepancies: [],
      }
    : null;

  if (loading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <button onClick={onBack} className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to bills
        </button>
        <div className="neu-raised rounded-2xl p-6 animate-pulse">
          <div className="h-6 w-48 bg-white/5 rounded mb-4" />
          <div className="h-4 w-32 bg-white/5 rounded" />
        </div>
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="space-y-6">
        <button onClick={onBack} className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to bills
        </button>
        <div className="neu-raised rounded-2xl p-8 text-center">
          <p className="text-zinc-400">Bill not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to bills
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Bill Approval</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Review and approve bill <span className="text-white font-mono">{bill.billNumber}</span>
          </p>
        </div>
        <StatusBadge status={bill.status} />
      </div>

      {/* Bill Details (read-only) */}
      <div className="neu-raised rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-zinc-300 mb-4 flex items-center gap-2">
          <FileText className="h-4 w-4 text-[#FFCC00]" />
          Bill Details
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <DetailField label="Bill Number" value={bill.billNumber} />
          <DetailField label="Supplier" value={bill.supplierName ?? '—'} />
          <DetailField label="Issue Date" value={bill.issueDate} />
          <DetailField label="Due Date" value={bill.dueDate} />
        </div>
        {bill.purchaseOrderId && (
          <div className="mt-3 px-3 py-2 rounded-lg bg-blue-400/5 border border-blue-400/10">
            <p className="text-xs text-blue-400">
              Linked to PO: <span className="font-mono">{bill.purchaseOrderId}</span>
            </p>
          </div>
        )}
      </div>

      {/* Line Items */}
      <div className="neu-raised rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-zinc-300 mb-4">Line Items</h3>
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-400">Description</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-zinc-400">Qty</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-zinc-400">Unit Price</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-zinc-400">GST</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-zinc-400">Amount</th>
            </tr>
          </thead>
          <tbody>
            {bill.lineItems?.map((item, i) => (
              <tr key={i} className="border-b border-white/5">
                <td className="px-3 py-2 text-sm text-white">{item.description}</td>
                <td className="px-3 py-2 text-right text-sm text-zinc-400">{item.quantity}</td>
                <td className="px-3 py-2 text-right text-sm text-zinc-400">
                  {formatCurrency(item.unitPrice)}
                </td>
                <td className="px-3 py-2 text-right text-sm text-zinc-400">
                  {formatCurrency(item.gstAmount)}
                </td>
                <td className="px-3 py-2 text-right text-sm text-white font-medium">
                  {formatCurrency(item.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mt-4 border-t border-white/5 pt-4">
          <div className="w-64 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Subtotal</span>
              <span className="text-white font-mono">{formatCurrency(bill.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">GST</span>
              <span className="text-white font-mono">{formatCurrency(bill.gstTotal)}</span>
            </div>
            <div className="border-t border-white/10 pt-2 flex justify-between text-sm font-semibold">
              <span className="text-[#FFCC00]">Total</span>
              <span className="text-[#FFCC00] font-mono">{formatCurrency(bill.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Three-Way Match Panel */}
      {threeWayMatch && (
        <div className="neu-raised rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-zinc-300 mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-[#FFCC00]" />
            Three-Way Match
          </h3>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <MatchColumn
              label="Purchase Order"
              amount={threeWayMatch.poAmount}
              matched={threeWayMatch.poAmount === threeWayMatch.billAmount}
            />
            <MatchColumn
              label="Receipt / GRN"
              amount={threeWayMatch.receiptAmount}
              matched={threeWayMatch.receiptAmount === threeWayMatch.billAmount}
            />
            <MatchColumn
              label="Bill"
              amount={threeWayMatch.billAmount}
              matched={true}
            />
          </div>

          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-400/5 border border-emerald-400/10">
            {threeWayMatch.status === 'matched' ? (
              <>
                <Check className="h-4 w-4 text-emerald-400" />
                <span className="text-sm text-emerald-400 font-medium">All amounts matched</span>
              </>
            ) : threeWayMatch.status === 'discrepancy' ? (
              <>
                <AlertTriangle className="h-4 w-4 text-red-400" />
                <span className="text-sm text-red-400 font-medium">Discrepancy detected</span>
              </>
            ) : (
              <>
                <Minus className="h-4 w-4 text-amber-400" />
                <span className="text-sm text-amber-400 font-medium">Partial match</span>
              </>
            )}
          </div>

          {threeWayMatch.discrepancies.length > 0 && (
            <ul className="mt-3 space-y-1">
              {threeWayMatch.discrepancies.map((d, i) => (
                <li key={i} className="text-xs text-red-400 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> {d}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Notes */}
      {bill.notes && (
        <div className="neu-raised rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-zinc-300 mb-2">Notes</h3>
          <p className="text-sm text-zinc-400">{bill.notes}</p>
        </div>
      )}

      {/* Approve / Reject Buttons */}
      {bill.status === 'awaiting_approval' && (
        <div className="flex items-center justify-end gap-3">
          {showRejectForm ? (
            <div className="flex-1 space-y-3">
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Reason for rejection..."
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-red-500/30 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 transition-all resize-none"
                rows={2}
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => { setShowRejectForm(false); setRejectReason(''); }}
                  className="px-4 py-2 rounded-xl bg-white/5 text-zinc-300 text-sm font-medium hover:bg-white/10 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={rejecting || !rejectReason.trim()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-all disabled:opacity-50"
                >
                  <XCircle className="h-4 w-4" />
                  {rejecting ? 'Rejecting...' : 'Confirm Reject'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                onClick={() => setShowRejectForm(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 text-sm font-medium hover:bg-red-500/20 transition-all"
              >
                <XCircle className="h-4 w-4" />
                Reject
              </button>
              <button
                onClick={() => setShowConfirmApprove(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FFCC00] text-black font-semibold text-sm hover:bg-[#FFCC00]/90 transition-all shadow-[0_0_20px_rgba(255,204,0,0.2)]"
              >
                <CheckCircle className="h-4 w-4" />
                Approve
              </button>
            </>
          )}
        </div>
      )}

      {/* Approval Confirmation Dialog */}
      {showConfirmApprove && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="neu-raised rounded-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-white mb-2">Approve Bill?</h3>
            <p className="text-sm text-zinc-400 mb-4">
              This will approve bill <strong className="text-white font-mono">{bill.billNumber}</strong> for{' '}
              <strong className="text-[#FFCC00]">{formatCurrency(bill.total)}</strong>.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirmApprove(false)}
                className="px-4 py-2 rounded-xl bg-white/5 text-zinc-300 text-sm font-medium hover:bg-white/10 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={approving}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FFCC00] text-black text-sm font-semibold hover:bg-[#FFCC00]/90 transition-all disabled:opacity-50"
              >
                <CheckCircle className="h-4 w-4" />
                {approving ? 'Approving...' : 'Confirm Approval'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-zinc-500 mb-0.5">{label}</p>
      <p className="text-sm text-white">{value}</p>
    </div>
  );
}

function MatchColumn({ label, amount, matched }: { label: string; amount: number; matched: boolean }) {
  return (
    <div className="text-center p-3 rounded-xl bg-white/[0.02] border border-white/5">
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className="text-lg font-bold text-white">{formatCurrency(amount)}</p>
      <div className="mt-1">
        {matched ? (
          <span className="text-xs text-emerald-400 font-medium">Matched</span>
        ) : (
          <span className="text-xs text-red-400 font-medium">Discrepancy</span>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: 'bg-zinc-400/10 text-zinc-400',
    awaiting_approval: 'bg-amber-400/10 text-amber-400',
    approved: 'bg-emerald-400/10 text-emerald-400',
    overdue: 'bg-red-400/10 text-red-400',
    paid: 'bg-blue-400/10 text-blue-400',
    void: 'bg-zinc-500/10 text-zinc-500',
  };
  const labels: Record<string, string> = {
    draft: 'Draft',
    awaiting_approval: 'Awaiting Approval',
    approved: 'Approved',
    overdue: 'Overdue',
    paid: 'Paid',
    void: 'Void',
  };
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${styles[status] ?? styles.draft}`}>
      {labels[status] ?? status}
    </span>
  );
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);
}
