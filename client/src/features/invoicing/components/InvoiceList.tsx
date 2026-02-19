import { useState, useEffect, useCallback } from 'react';
import { invoicingApi } from '@/api';
import {
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  Loader2,
  FileText,
  Send,
  Download,
  Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName?: string;
  issueDate: string;
  dueDate: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'void';
  subtotal: number;
  gstTotal: number;
  total: number;
}

interface InvoiceListProps {
  onSelectInvoice: (id: string) => void;
  onCreateInvoice: () => void;
}

const formatAUD = (cents: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);

const formatDate = (iso: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const statusConfig: Record<
  string,
  { bg: string; text: string; label: string; strikethrough?: boolean }
> = {
  draft: { bg: 'bg-zinc-600/20', text: 'text-secondary', label: 'Draft' },
  sent: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Sent' },
  paid: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Paid' },
  overdue: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Overdue' },
  void: { bg: 'bg-zinc-700/50', text: 'text-muted', label: 'Void', strikethrough: true },
};

const PAGE_SIZE = 20;

export function InvoiceList({ onSelectInvoice, onCreateInvoice }: InvoiceListProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilterState] = useState<string>('');
  const [customerFilter, setCustomerFilterState] = useState<string>('');
  const [dateFrom, setDateFromState] = useState('');
  const [dateTo, setDateToState] = useState('');
  const [page, setPage] = useState(0);

  // Reset page inline when filters change (avoids useEffect state reset anti-pattern)
  const setStatusFilter = (v: string) => { setStatusFilterState(v); setPage(0); };
  const setCustomerFilter = (v: string) => { setCustomerFilterState(v); setPage(0); };
  const setDateFrom = (v: string) => { setDateFromState(v); setPage(0); };
  const setDateTo = (v: string) => { setDateToState(v); setPage(0); };

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await invoicingApi.listInvoices({
        offset: page * PAGE_SIZE,
        limit: PAGE_SIZE,
        status: statusFilter || undefined,
        customerId: customerFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      setInvoices(res?.invoices ?? []);
      setTotal(res?.total ?? 0);
    } catch (err) {
      console.error('Failed to load invoices:', err);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, customerFilter, dateFrom, dateTo]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const handleSend = async (e: React.MouseEvent, invoiceId: string) => {
    e.stopPropagation();
    try {
      await invoicingApi.sendInvoice(invoiceId);
      loadInvoices();
    } catch (err) {
      console.error('Failed to send invoice:', err);
    }
  };

  const handleDownload = async (e: React.MouseEvent, invoiceId: string, invoiceNumber: string) => {
    e.stopPropagation();
    try {
      const blob = await invoicingApi.downloadInvoicePDF(invoiceId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download PDF:', err);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl neu-inset bg-transparent text-sm text-primary focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
          >
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
            <option value="void">Void</option>
          </select>

          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            placeholder="From"
            className="px-3 py-2 rounded-xl neu-inset bg-transparent text-sm text-primary focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            placeholder="To"
            className="px-3 py-2 rounded-xl neu-inset bg-transparent text-sm text-primary focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
          />
        </div>

        <button
          onClick={onCreateInvoice}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cba-gold text-base text-sm font-bold hover:bg-[#FFD633] transition-colors shadow-[0_0_15px_rgba(255,204,0,0.15)]"
        >
          <Plus className="w-4 h-4" />
          New Invoice
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-cba-gold" />
        </div>
      ) : invoices.length === 0 ? (
        <div className="neu-raised rounded-2xl p-8 text-center">
          <FileText className="w-12 h-12 mx-auto text-zinc-600 mb-3" />
          <p className="text-secondary text-sm">
            {statusFilter
              ? 'No invoices match your filter.'
              : 'No invoices yet. Create your first invoice.'}
          </p>
        </div>
      ) : (
        <div className="neu-raised rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-muted font-semibold">
                    Invoice #
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-muted font-semibold">
                    Customer
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-muted font-semibold hidden md:table-cell">
                    Issue Date
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-muted font-semibold hidden md:table-cell">
                    Due Date
                  </th>
                  <th className="text-right px-4 py-3 text-[10px] uppercase tracking-wider text-muted font-semibold">
                    Total
                  </th>
                  <th className="text-center px-4 py-3 text-[10px] uppercase tracking-wider text-muted font-semibold">
                    Status
                  </th>
                  <th className="text-right px-4 py-3 text-[10px] uppercase tracking-wider text-muted font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const sc = statusConfig[inv.status] ?? statusConfig.draft;
                  return (
                    <tr
                      key={inv.id}
                      onClick={() => onSelectInvoice(inv.id)}
                      className="border-b border-zinc-800/50 hover:bg-zinc-800/30 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'font-semibold text-cba-gold',
                            sc.strikethrough && 'line-through',
                          )}
                        >
                          {inv.invoiceNumber}
                        </span>
                      </td>
                      <td
                        className={cn(
                          'px-4 py-3 text-primary',
                          sc.strikethrough && 'line-through',
                        )}
                      >
                        {inv.customerName ?? '—'}
                      </td>
                      <td
                        className={cn(
                          'px-4 py-3 text-secondary hidden md:table-cell',
                          sc.strikethrough && 'line-through',
                        )}
                      >
                        {formatDate(inv.issueDate)}
                      </td>
                      <td
                        className={cn(
                          'px-4 py-3 text-secondary hidden md:table-cell',
                          sc.strikethrough && 'line-through',
                        )}
                      >
                        {formatDate(inv.dueDate)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={cn(
                            'font-semibold',
                            sc.strikethrough ? 'line-through text-muted' : 'text-zinc-100',
                          )}
                        >
                          {formatAUD(inv.total)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={cn(
                            'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider',
                            sc.bg,
                            sc.text,
                          )}
                        >
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectInvoice(inv.id);
                            }}
                            title="View"
                            className="p-1.5 rounded-lg hover:bg-zinc-700/50 text-secondary hover:text-zinc-100 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => handleDownload(e, inv.id, inv.invoiceNumber)}
                            title="Download PDF"
                            className="p-1.5 rounded-lg hover:bg-zinc-700/50 text-secondary hover:text-zinc-100 transition-colors"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          {inv.status === 'draft' && (
                            <button
                              onClick={(e) => handleSend(e, inv.id)}
                              title="Send Invoice"
                              className="p-1.5 rounded-lg hover:bg-blue-500/20 text-secondary hover:text-blue-400 transition-colors"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1.5 rounded-lg neu-raised text-secondary hover:text-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-secondary tabular-nums">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-1.5 rounded-lg neu-raised text-secondary hover:text-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
