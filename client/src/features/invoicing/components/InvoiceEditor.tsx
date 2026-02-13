import { useState, useEffect, useCallback } from 'react';
import { invoicingApi } from '@/api';
import { Plus, X, Loader2, Save, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number; // cents
  gstRate: number; // 0.10 for 10%
}

interface InvoiceEditorProps {
  invoiceId?: string;
  onSave: () => void;
  onCancel: () => void;
}

const formatAUD = (cents: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);

let lineIdCounter = 0;
const nextLineId = () => `line-${++lineIdCounter}-${Date.now()}`;

const DEFAULT_TERMS = `Payment is due within the specified terms. Late payments may incur interest at 2% per month on the outstanding balance.`;

export function InvoiceEditor({ invoiceId, onSave, onCancel }: InvoiceEditorProps) {
  const [loading, setLoading] = useState(!!invoiceId);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState(DEFAULT_TERMS);
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: nextLineId(), description: '', quantity: 1, unitPrice: 0, gstRate: 0.1 },
  ]);

  // Load next invoice number
  useEffect(() => {
    if (!invoiceId) {
      invoicingApi
        .getNextInvoiceNumber()
        .then((num) => setInvoiceNumber(num))
        .catch(() => setInvoiceNumber('INV-000001'));
    }
  }, [invoiceId]);

  // Load existing invoice for editing
  useEffect(() => {
    if (!invoiceId) return;
    const load = async () => {
      setLoading(true);
      try {
        const inv = await invoicingApi.getInvoice(invoiceId);
        setInvoiceNumber(inv.invoiceNumber ?? '');
        setIssueDate(inv.issueDate?.split('T')[0] ?? '');
        setDueDate(inv.dueDate?.split('T')[0] ?? '');
        setNotes(inv.notes ?? '');
        setTerms(inv.terms ?? DEFAULT_TERMS);
        if (inv.customerId) {
          try {
            const cust = await invoicingApi.listCustomers({ search: inv.customerName, limit: 1 });
            if (cust?.customers?.[0]) setSelectedCustomer(cust.customers[0]);
          } catch {
            /* ignore */
          }
        }
        if (inv.lineItems?.length) {
          setLineItems(
            inv.lineItems.map((li: any) => ({
              id: nextLineId(),
              description: li.description ?? '',
              quantity: li.quantity ?? 1,
              unitPrice: li.unitPrice ?? 0,
              gstRate: li.gstRate ?? 0.1,
            })),
          );
        }
      } catch (err) {
        console.error('Failed to load invoice:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [invoiceId]);

  // Auto-calc due date from customer payment terms
  useEffect(() => {
    if (selectedCustomer && issueDate) {
      const days = selectedCustomer.paymentTermsDays ?? 30;
      const d = new Date(issueDate);
      d.setDate(d.getDate() + days);
      setDueDate(d.toISOString().split('T')[0]);
    }
  }, [selectedCustomer, issueDate]);

  // Customer search
  const searchCustomers = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setCustomers([]);
      return;
    }
    try {
      const res = await invoicingApi.listCustomers({ search: query, limit: 10 });
      setCustomers(res?.customers ?? []);
    } catch {
      setCustomers([]);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => searchCustomers(customerSearch), 300);
    return () => clearTimeout(timer);
  }, [customerSearch, searchCustomers]);

  // Line item helpers
  const addLine = () => {
    setLineItems((prev) => [
      ...prev,
      { id: nextLineId(), description: '', quantity: 1, unitPrice: 0, gstRate: 0.1 },
    ]);
  };

  const removeLine = (id: string) => {
    setLineItems((prev) => (prev.length > 1 ? prev.filter((li) => li.id !== id) : prev));
  };

  const updateLine = (id: string, field: keyof LineItem, value: string | number) => {
    setLineItems((prev) => prev.map((li) => (li.id === id ? { ...li, [field]: value } : li)));
  };

  // Totals
  const subtotal = lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0);
  const gstTotal = lineItems.reduce(
    (sum, li) => sum + Math.round(li.quantity * li.unitPrice * li.gstRate),
    0,
  );
  const grandTotal = subtotal + gstTotal;

  const buildPayload = () => ({
    customerId: selectedCustomer?.id,
    invoiceNumber,
    issueDate,
    dueDate,
    notes,
    terms,
    lineItems: lineItems.map((li) => ({
      description: li.description,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      gstRate: li.gstRate,
      amount: li.quantity * li.unitPrice,
      gstAmount: Math.round(li.quantity * li.unitPrice * li.gstRate),
    })),
    subtotal,
    gstTotal,
    total: grandTotal,
  });

  const handleSave = async (sendAfter = false) => {
    if (!selectedCustomer) return;
    setSaving(true);
    try {
      const payload = buildPayload();
      if (invoiceId) {
        await invoicingApi.updateInvoice(invoiceId, payload);
        if (sendAfter) await invoicingApi.sendInvoice(invoiceId);
      } else {
        const result = await invoicingApi.createInvoice({ ...payload, status: 'draft' });
        if (sendAfter && result?.id) await invoicingApi.sendInvoice(result.id);
      }
      onSave();
    } catch (err) {
      console.error('Failed to save invoice:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-[#FFCC00]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-zinc-100">
          {invoiceId ? 'Edit Invoice' : 'New Invoice'}
        </h3>
        <span className="text-sm font-mono text-[#FFCC00]">{invoiceNumber}</span>
      </div>

      {/* Customer Selector */}
      <div className="neu-raised rounded-2xl p-5 space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Customer</h4>

        {selectedCustomer ? (
          <div className="flex items-center justify-between neu-inset rounded-xl p-3">
            <div>
              <p className="font-semibold text-zinc-100">{selectedCustomer.businessName}</p>
              <p className="text-xs text-zinc-500">
                {selectedCustomer.contactName ?? ''}{' '}
                {selectedCustomer.abn ? `| ABN: ${selectedCustomer.abn}` : ''}
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedCustomer(null);
                setCustomerSearch('');
              }}
              className="p-1.5 rounded-lg hover:bg-zinc-700/50 text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <input
              type="text"
              value={customerSearch}
              onChange={(e) => {
                setCustomerSearch(e.target.value);
                setShowCustomerDropdown(true);
              }}
              onFocus={() => setShowCustomerDropdown(true)}
              placeholder="Search customers by name, ABN, or email..."
              className="w-full px-4 py-2.5 rounded-xl neu-inset bg-transparent text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
            />
            {showCustomerDropdown && customers.length > 0 && (
              <div className="absolute z-20 top-full mt-1 w-full max-h-48 overflow-y-auto rounded-xl bg-[#15161f] border border-zinc-700 shadow-xl">
                {customers.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedCustomer(c);
                      setCustomerSearch('');
                      setShowCustomerDropdown(false);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-zinc-800/50 transition-colors border-b border-zinc-800/50 last:border-0"
                  >
                    <p className="text-sm font-semibold text-zinc-200">{c.businessName}</p>
                    <p className="text-xs text-zinc-500">
                      {c.contactName ?? ''} {c.email ? `| ${c.email}` : ''}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Invoice Details */}
      <div className="neu-raised rounded-2xl p-5 space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
          Invoice Details
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Issue Date</label>
            <input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl neu-inset bg-transparent text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl neu-inset bg-transparent text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 rounded-xl neu-inset bg-transparent text-sm text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
            placeholder="Additional notes for this invoice..."
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Terms & Conditions</label>
          <textarea
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 rounded-xl neu-inset bg-transparent text-sm text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
          />
        </div>
      </div>

      {/* Line Items */}
      <div className="neu-raised rounded-2xl p-5 space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Line Items</h4>

        {/* Header */}
        <div className="hidden sm:grid grid-cols-12 gap-2 text-[10px] uppercase tracking-wider text-zinc-500 font-semibold px-1">
          <div className="col-span-4">Description</div>
          <div className="col-span-2 text-right">Qty</div>
          <div className="col-span-2 text-right">Unit Price</div>
          <div className="col-span-2 text-right">GST Rate</div>
          <div className="col-span-1 text-right">Amount</div>
          <div className="col-span-1" />
        </div>

        {lineItems.map((li) => {
          const lineAmount = li.quantity * li.unitPrice;
          const lineGst = Math.round(lineAmount * li.gstRate);
          return (
            <div key={li.id} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-12 sm:col-span-4">
                <input
                  type="text"
                  value={li.description}
                  onChange={(e) => updateLine(li.id, 'description', e.target.value)}
                  placeholder="Item description"
                  className="w-full px-3 py-2 rounded-lg neu-inset bg-transparent text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
                />
              </div>
              <div className="col-span-4 sm:col-span-2">
                <input
                  type="number"
                  value={li.quantity}
                  onChange={(e) =>
                    updateLine(li.id, 'quantity', Math.max(0, parseFloat(e.target.value) || 0))
                  }
                  min="0"
                  step="1"
                  className="w-full px-3 py-2 rounded-lg neu-inset bg-transparent text-sm text-zinc-200 text-right focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
                />
              </div>
              <div className="col-span-4 sm:col-span-2">
                <input
                  type="number"
                  value={li.unitPrice ? (li.unitPrice / 100).toFixed(2) : ''}
                  onChange={(e) =>
                    updateLine(
                      li.id,
                      'unitPrice',
                      Math.round((parseFloat(e.target.value) || 0) * 100),
                    )
                  }
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full px-3 py-2 rounded-lg neu-inset bg-transparent text-sm text-zinc-200 text-right focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
                />
              </div>
              <div className="col-span-3 sm:col-span-2">
                <select
                  value={li.gstRate}
                  onChange={(e) => updateLine(li.id, 'gstRate', parseFloat(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg neu-inset bg-transparent text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
                >
                  <option value={0.1}>10% GST</option>
                  <option value={0}>GST Free</option>
                </select>
              </div>
              <div className="col-span-4 sm:col-span-1 text-right">
                <span className="text-sm font-semibold text-zinc-200">
                  {formatAUD(lineAmount + lineGst)}
                </span>
              </div>
              <div className="col-span-1 text-right">
                <button
                  onClick={() => removeLine(li.id)}
                  disabled={lineItems.length === 1}
                  className="p-1.5 rounded-lg hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}

        <button
          onClick={addLine}
          className="flex items-center gap-2 text-sm text-[#FFCC00] hover:text-[#FFD633] font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Line Item
        </button>
      </div>

      {/* Totals */}
      <div className="neu-raised rounded-2xl p-5">
        <div className="flex flex-col items-end gap-2">
          <div className="flex justify-between w-full sm:w-64">
            <span className="text-sm text-zinc-400">Subtotal</span>
            <span className="text-sm font-semibold text-zinc-200">{formatAUD(subtotal)}</span>
          </div>
          <div className="flex justify-between w-full sm:w-64">
            <span className="text-sm text-zinc-400">GST (10%)</span>
            <span className="text-sm font-semibold text-zinc-200">{formatAUD(gstTotal)}</span>
          </div>
          <div className="flex justify-between w-full sm:w-64 pt-2 border-t border-zinc-700">
            <span className="text-base font-bold text-zinc-100">Total</span>
            <span className="text-base font-bold text-gradient-gold">{formatAUD(grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 justify-end">
        <button
          onClick={onCancel}
          className="px-5 py-2.5 rounded-xl neu-raised text-sm font-semibold text-zinc-400 hover:text-zinc-100 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => handleSave(false)}
          disabled={saving || !selectedCustomer}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl neu-raised text-sm font-bold text-zinc-100 hover:bg-zinc-700/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save as Draft
        </button>
        <button
          onClick={() => handleSave(true)}
          disabled={saving || !selectedCustomer}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FFCC00] text-[#0a0a0f] text-sm font-bold hover:bg-[#FFD633] transition-colors shadow-[0_0_15px_rgba(255,204,0,0.15)] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Save & Send
        </button>
      </div>
    </div>
  );
}
