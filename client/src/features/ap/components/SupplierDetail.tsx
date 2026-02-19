import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Building2,
  Pencil,
  Archive,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  FileText,
  Calendar,
} from 'lucide-react';
import { apApi } from '../../../api';
import type { Supplier, Bill } from '../../../api';

interface SupplierDetailProps {
  supplierId: string;
  onBack: () => void;
  onEdit: (id: string) => void;
}

export function SupplierDetail({ supplierId, onBack, onEdit }: SupplierDetailProps) {
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [archiving, setArchiving] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [s, b] = await Promise.all([
          apApi.fetchSupplier(supplierId),
          apApi.fetchSupplierBills(supplierId, 10),
        ]);
        setSupplier(s);
        setBills(b.bills);
      } catch (e) {
        console.error('Failed to load supplier', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [supplierId]);

  const handleArchive = async () => {
    setArchiving(true);
    try {
      await apApi.archiveSupplier(supplierId);
      onBack();
    } catch (e) {
      console.error('Failed to archive supplier', e);
    } finally {
      setArchiving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-secondary hover:text-primary text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to suppliers
        </button>
        <div className="neu-raised rounded-2xl p-6 animate-pulse">
          <div className="h-6 w-48 bg-overlay rounded mb-4" />
          <div className="h-4 w-32 bg-overlay rounded" />
        </div>
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="space-y-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-secondary hover:text-primary text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to suppliers
        </button>
        <div className="neu-raised rounded-2xl p-8 text-center">
          <p className="text-secondary">Supplier not found</p>
        </div>
      </div>
    );
  }

  const maskAccount = (num?: string) => {
    if (!num || num.length < 4) return '****';
    return `****${num.slice(-4)}`;
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Back + Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-secondary hover:text-primary text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to suppliers
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => onEdit(supplierId)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cba-gold text-black font-semibold text-sm hover:bg-cba-gold/90 transition-all"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
          <button
            onClick={() => setShowArchiveConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 text-sm font-medium hover:bg-red-500/20 transition-all"
          >
            <Archive className="h-3.5 w-3.5" />
            Archive
          </button>
        </div>
      </div>

      {/* Supplier Info Card */}
      <div className="neu-raised rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-cba-gold/10 flex items-center justify-center shrink-0">
            <Building2 className="h-6 w-6 text-cba-gold" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-primary">{supplier.businessName}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  supplier.isActive
                    ? 'bg-emerald-400/10 text-emerald-400'
                    : 'bg-zinc-400/10 text-secondary'
                }`}
              >
                {supplier.isActive ? 'Active' : 'Archived'}
              </span>
              {supplier.abn && (
                <span className="text-xs text-muted font-mono">
                  ABN: {formatABN(supplier.abn)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          {supplier.contactName && (
            <InfoRow icon={Building2} label="Contact" value={supplier.contactName} />
          )}
          {supplier.email && <InfoRow icon={Mail} label="Email" value={supplier.email} />}
          {supplier.phone && <InfoRow icon={Phone} label="Phone" value={supplier.phone} />}
          {supplier.address && <InfoRow icon={MapPin} label="Address" value={supplier.address} />}
          <InfoRow
            icon={Calendar}
            label="Payment Terms"
            value={`${supplier.paymentTermsDays} days`}
          />
        </div>
      </div>

      {/* Bank Details */}
      <div className="neu-raised rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-primary mb-4 flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-cba-gold" />
          Bank Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-muted mb-1">BSB</p>
            <p className="text-sm text-primary font-mono">
              {supplier.bankBsb ? `${supplier.bankBsb} ✓` : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted mb-1">Account Number</p>
            <p className="text-sm text-primary font-mono">
              {supplier.bankAccountNumber ? maskAccount(supplier.bankAccountNumber) : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted mb-1">Account Name</p>
            <p className="text-sm text-primary">{supplier.bankAccountName ?? '—'}</p>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="neu-raised rounded-2xl p-5 text-center">
          <p className="text-xs text-secondary uppercase tracking-wider mb-1">Total Spent</p>
          <p className="text-xl font-bold text-primary">{formatCurrency(supplier.totalSpent)}</p>
        </div>
        <div className="neu-raised rounded-2xl p-5 text-center">
          <p className="text-xs text-secondary uppercase tracking-wider mb-1">Outstanding</p>
          <p className="text-xl font-bold text-primary">
            {formatCurrency(supplier.outstandingAmount)}
          </p>
        </div>
        <div className="neu-raised rounded-2xl p-5 text-center">
          <p className="text-xs text-secondary uppercase tracking-wider mb-1">Total Bills</p>
          <p className="text-xl font-bold text-primary">{bills.length}</p>
        </div>
      </div>

      {/* Recent Bills */}
      <div className="neu-raised rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-primary mb-4 flex items-center gap-2">
          <FileText className="h-4 w-4 text-cba-gold" />
          Recent Bills
        </h3>
        {bills.length === 0 ? (
          <p className="text-sm text-muted text-center py-4">No bills found</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left px-3 py-2 text-xs font-semibold text-secondary">Bill #</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-secondary">Date</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-secondary">Status</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-secondary">Total</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((bill) => (
                <tr key={bill.id} className="border-b border-border/50">
                  <td className="px-3 py-2 text-sm text-primary font-mono">{bill.billNumber}</td>
                  <td className="px-3 py-2 text-sm text-secondary">{bill.issueDate}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={bill.status} />
                  </td>
                  <td className="px-3 py-2 text-right text-sm font-medium text-primary">
                    {formatCurrency(bill.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Archive Confirmation */}
      {showArchiveConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="neu-raised rounded-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-primary mb-2">Archive Supplier?</h3>
            <p className="text-sm text-secondary mb-6">
              This will mark <strong className="text-primary">{supplier.businessName}</strong> as
              archived. Existing bills will not be affected.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowArchiveConfirm(false)}
                className="px-4 py-2 rounded-xl bg-overlay text-primary text-sm font-medium hover:bg-overlay-hover transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleArchive}
                disabled={archiving}
                className="px-4 py-2 rounded-xl bg-red-500 text-primary text-sm font-semibold hover:bg-red-600 transition-all disabled:opacity-50"
              >
                {archiving ? 'Archiving...' : 'Archive'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-4 w-4 text-muted mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-muted">{label}</p>
        <p className="text-sm text-primary">{value}</p>
      </div>
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
