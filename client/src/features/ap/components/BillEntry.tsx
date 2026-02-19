import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Plus, Trash2, Save, Send, Search } from 'lucide-react';
import { apApi } from '../../../api';
import type { Supplier, BillLineItem } from '../../../api';

interface BillEntryProps {
  billId?: string;
  onSave: () => void;
  onCancel: () => void;
}

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  gstRate: number;
}

const DEFAULT_GST_RATE = 10;

export function BillEntry({ billId, onSave, onCancel }: BillEntryProps) {
  const isEdit = !!billId;
  const [supplierId, setSupplierId] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  const [billNumber, setBillNumber] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [purchaseOrderId, setPurchaseOrderId] = useState('');

  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: '', quantity: 1, unitPrice: 0, gstRate: DEFAULT_GST_RATE },
  ]);

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  // Load existing bill for editing
  useEffect(() => {
    if (isEdit && billId) {
      apApi
        .fetchBill(billId)
        .then((bill) => {
          setSupplierId(bill.supplierId);
          setBillNumber(bill.billNumber);
          setIssueDate(bill.issueDate);
          setDueDate(bill.dueDate);
          setNotes(bill.notes ?? '');
          setPurchaseOrderId(bill.purchaseOrderId ?? '');
          if (bill.lineItems?.length) {
            setLineItems(
              bill.lineItems.map((li) => ({
                description: li.description,
                quantity: li.quantity,
                unitPrice: li.unitPrice,
                gstRate: li.gstRate,
              })),
            );
          }
          // Load selected supplier
          apApi
            .fetchSupplier(bill.supplierId)
            .then((s) => {
              setSelectedSupplier(s);
              setSupplierSearch(s.businessName);
            })
            .catch(() => {});
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [isEdit, billId]);

  // Supplier autocomplete search
  const searchSuppliers = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuppliers([]);
      return;
    }
    try {
      const result = await apApi.fetchSuppliers({ search: query, limit: 8, isActive: true });
      setSuppliers(result.suppliers);
    } catch {
      setSuppliers([]);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => searchSuppliers(supplierSearch), 300);
    return () => clearTimeout(timer);
  }, [supplierSearch, searchSuppliers]);

  // Auto-calculate due date from supplier payment terms
  const selectSupplier = (s: Supplier) => {
    setSupplierId(s.id);
    setSelectedSupplier(s);
    setSupplierSearch(s.businessName);
    setShowSupplierDropdown(false);
    // Auto-calculate due date
    if (issueDate) {
      const due = new Date(issueDate);
      due.setDate(due.getDate() + s.paymentTermsDays);
      setDueDate(due.toISOString().split('T')[0]);
    }
  };

  // Line item calculations
  const calcLineAmount = (item: LineItem) => item.quantity * item.unitPrice;
  const calcLineGST = (item: LineItem) => (calcLineAmount(item) * item.gstRate) / 100;

  const subtotal = lineItems.reduce((sum, item) => sum + calcLineAmount(item), 0);
  const gstTotal = lineItems.reduce((sum, item) => sum + calcLineGST(item), 0);
  const total = subtotal + gstTotal;

  const updateLineItem = (index: number, field: keyof LineItem, value: string | number) => {
    setLineItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  };

  const addLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      { description: '', quantity: 1, unitPrice: 0, gstRate: DEFAULT_GST_RATE },
    ]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async (asDraft: boolean) => {
    if (!supplierId || !billNumber.trim()) return;

    setSaving(true);
    try {
      const items: BillLineItem[] = lineItems
        .filter((li) => li.description.trim())
        .map((li) => ({
          description: li.description,
          quantity: li.quantity,
          unitPrice: Math.round(li.unitPrice * 100),
          gstRate: li.gstRate,
          amount: Math.round(calcLineAmount(li) * 100),
          gstAmount: Math.round(calcLineGST(li) * 100),
        }));

      const data = {
        supplierId,
        billNumber: billNumber.trim(),
        issueDate,
        dueDate,
        status: asDraft ? ('draft' as const) : ('awaiting_approval' as const),
        subtotal: Math.round(subtotal * 100),
        gstTotal: Math.round(gstTotal * 100),
        total: Math.round(total * 100),
        purchaseOrderId: purchaseOrderId || undefined,
        notes: notes.trim() || undefined,
        lineItems: items,
      };

      if (isEdit && billId) {
        await apApi.updateBill(billId, data);
      } else {
        await apApi.createBill(data);
      }
      onSave();
    } catch (e) {
      console.error('Failed to save bill', e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <button
          onClick={onCancel}
          className="flex items-center gap-2 text-secondary hover:text-primary text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="neu-raised rounded-2xl p-6 animate-pulse">
          <div className="h-6 w-48 bg-overlay rounded mb-4" />
          <div className="h-4 w-32 bg-overlay rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <button
        onClick={onCancel}
        className="flex items-center gap-2 text-secondary hover:text-primary text-sm transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div>
        <h1 className="text-2xl font-bold text-primary">{isEdit ? 'Edit Bill' : 'New Bill'}</h1>
        <p className="text-sm text-secondary mt-1">Enter bill details and line items</p>
      </div>

      {/* Bill Header */}
      <div className="neu-raised rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-primary">Bill Details</h3>

        {/* Supplier Autocomplete */}
        <div className="relative">
          <label htmlFor="ap-f1" className="block text-xs font-medium text-secondary mb-1.5">Supplier *</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <input id="ap-f1"
              type="text"
              value={supplierSearch}
              onChange={(e) => {
                setSupplierSearch(e.target.value);
                setShowSupplierDropdown(true);
                if (!e.target.value) {
                  setSupplierId('');
                  setSelectedSupplier(null);
                }
              }}
              onFocus={() => setShowSupplierDropdown(true)}
              placeholder="Search supplier..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-overlay border border-border text-sm text-primary placeholder-zinc-500 focus:outline-none focus:border-cba-gold/30 focus:ring-1 focus:ring-[#FFCC00]/20 transition-all"
            />
          </div>
          {showSupplierDropdown && suppliers.length > 0 && (
            <div className="absolute z-20 w-full mt-1 rounded-xl bg-[#1a1a2e] border border-border shadow-xl max-h-48 overflow-y-auto">
              {suppliers.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => selectSupplier(s)}
                  className="w-full px-4 py-2.5 text-left text-sm text-primary hover:bg-overlay hover:text-primary transition-colors"
                >
                  <span className="font-medium">{s.businessName}</span>
                  {s.abn && (
                    <span className="ml-2 text-xs text-muted font-mono">ABN: {s.abn}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="ap-f2" className="block text-xs font-medium text-secondary mb-1.5">Bill Number *</label>
            <input id="ap-f2"
              type="text"
              value={billNumber}
              onChange={(e) => setBillNumber(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-overlay border border-border text-sm text-primary placeholder-zinc-500 focus:outline-none focus:border-cba-gold/30 focus:ring-1 focus:ring-[#FFCC00]/20 transition-all"
              placeholder="INV-001"
            />
          </div>
          <div>
            <label htmlFor="ap-f3" className="block text-xs font-medium text-secondary mb-1.5">Issue Date</label>
            <input id="ap-f3"
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-overlay border border-border text-sm text-primary focus:outline-none focus:border-cba-gold/30 focus:ring-1 focus:ring-[#FFCC00]/20 transition-all"
            />
          </div>
          <div>
            <label htmlFor="ap-f4" className="block text-xs font-medium text-secondary mb-1.5">Due Date</label>
            <input id="ap-f4"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-overlay border border-border text-sm text-primary focus:outline-none focus:border-cba-gold/30 focus:ring-1 focus:ring-[#FFCC00]/20 transition-all"
            />
          </div>
        </div>

        <div>
          <label htmlFor="ap-f5" className="block text-xs font-medium text-secondary mb-1.5">
            Link to Purchase Order (optional)
          </label>
          <input id="ap-f5"
            type="text"
            value={purchaseOrderId}
            onChange={(e) => setPurchaseOrderId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-overlay border border-border text-sm text-primary placeholder-zinc-500 focus:outline-none focus:border-cba-gold/30 focus:ring-1 focus:ring-[#FFCC00]/20 transition-all"
            placeholder="PO number or leave blank"
          />
        </div>
      </div>

      {/* Line Items */}
      <div className="neu-raised rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-primary">Line Items</h3>
          <button
            type="button"
            onClick={addLineItem}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-overlay text-primary hover:bg-cba-gold/10 hover:text-cba-gold transition-all"
          >
            <Plus className="h-3 w-3" />
            Add Row
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left px-2 py-2 text-xs font-semibold text-secondary w-[35%]">
                  Description
                </th>
                <th className="text-right px-2 py-2 text-xs font-semibold text-secondary w-[10%]">
                  Qty
                </th>
                <th className="text-right px-2 py-2 text-xs font-semibold text-secondary w-[15%]">
                  Unit Price
                </th>
                <th className="text-right px-2 py-2 text-xs font-semibold text-secondary w-[10%]">
                  GST %
                </th>
                <th className="text-right px-2 py-2 text-xs font-semibold text-secondary w-[12%]">
                  Amount
                </th>
                <th className="text-right px-2 py-2 text-xs font-semibold text-secondary w-[12%]">
                  GST
                </th>
                <th className="w-[6%]"></th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, index) => (
                <tr key={`item-${index}`} className="border-b border-border/50">
                  <td className="px-1 py-2">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg bg-overlay border border-border text-sm text-primary placeholder-zinc-500 focus:outline-none focus:border-cba-gold/30 transition-all"
                      placeholder="Item description"
                    />
                  </td>
                  <td className="px-1 py-2">
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateLineItem(index, 'quantity', Number(e.target.value))}
                      className="w-full px-2 py-1.5 rounded-lg bg-overlay border border-border text-sm text-primary text-right focus:outline-none focus:border-cba-gold/30 transition-all"
                      min="1"
                      step="1"
                    />
                  </td>
                  <td className="px-1 py-2">
                    <input
                      type="number"
                      value={item.unitPrice}
                      onChange={(e) => updateLineItem(index, 'unitPrice', Number(e.target.value))}
                      className="w-full px-2 py-1.5 rounded-lg bg-overlay border border-border text-sm text-primary text-right focus:outline-none focus:border-cba-gold/30 transition-all"
                      min="0"
                      step="0.01"
                    />
                  </td>
                  <td className="px-1 py-2">
                    <input
                      type="number"
                      value={item.gstRate}
                      onChange={(e) => updateLineItem(index, 'gstRate', Number(e.target.value))}
                      className="w-full px-2 py-1.5 rounded-lg bg-overlay border border-border text-sm text-primary text-right focus:outline-none focus:border-cba-gold/30 transition-all"
                      min="0"
                      max="100"
                      step="1"
                    />
                  </td>
                  <td className="px-2 py-2 text-right text-sm text-primary font-mono">
                    ${calcLineAmount(item).toFixed(2)}
                  </td>
                  <td className="px-2 py-2 text-right text-sm text-secondary font-mono">
                    ${calcLineGST(item).toFixed(2)}
                  </td>
                  <td className="px-1 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => removeLineItem(index)}
                      disabled={lineItems.length <= 1}
                      className="p-1 rounded-lg text-muted hover:text-red-400 hover:bg-red-400/10 transition-all disabled:opacity-20"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end mt-4">
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-secondary">Subtotal</span>
              <span className="text-primary font-mono">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-secondary">GST</span>
              <span className="text-primary font-mono">${gstTotal.toFixed(2)}</span>
            </div>
            <div className="border-t border-border pt-2 flex justify-between text-sm font-semibold">
              <span className="text-cba-gold">Total</span>
              <span className="text-cba-gold font-mono">${total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="neu-raised rounded-2xl p-6">
        <label htmlFor="ap-f6" className="block text-xs font-medium text-secondary mb-1.5">Notes</label>
        <textarea id="ap-f6"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl bg-overlay border border-border text-sm text-primary placeholder-zinc-500 focus:outline-none focus:border-cba-gold/30 focus:ring-1 focus:ring-[#FFCC00]/20 transition-all resize-none"
          rows={3}
          placeholder="Additional notes..."
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 rounded-xl bg-overlay text-primary text-sm font-medium hover:bg-overlay-hover transition-all"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => handleSave(true)}
          disabled={saving || !supplierId || !billNumber.trim()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-overlay-hover text-primary font-medium text-sm hover:bg-white/15 transition-all disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          Save Draft
        </button>
        <button
          type="button"
          onClick={() => handleSave(false)}
          disabled={saving || !supplierId || !billNumber.trim()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cba-gold text-black font-semibold text-sm hover:bg-cba-gold/90 transition-all shadow-[0_0_20px_rgba(255,204,0,0.2)] disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          {saving ? 'Saving...' : 'Submit for Approval'}
        </button>
      </div>
    </div>
  );
}
