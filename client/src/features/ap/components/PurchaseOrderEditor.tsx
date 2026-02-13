import { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Send,
  Package,
  Search,
} from 'lucide-react';
import { apApi } from '../../../api';
import type { Supplier } from '../../../api';

interface POLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

interface PurchaseOrderEditorProps {
  poId?: string;
  onSave: () => void;
  onCancel: () => void;
}

let lineCounter = 0;
function nextLineId() {
  return `line-${++lineCounter}-${Date.now()}`;
}

export function PurchaseOrderEditor({ poId, onSave, onCancel }: PurchaseOrderEditorProps) {
  const [loading, setLoading] = useState(!!poId);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [poNumber, setPONumber] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<POLineItem[]>([
    { id: nextLineId(), description: '', quantity: 1, unitPrice: 0, amount: 0 },
  ]);
  const [status, setStatus] = useState<string>('draft');
  const [error, setError] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (poId) {
      loadPO();
    }
  }, [poId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (supplierSearch.length >= 2) {
        loadSuppliers(supplierSearch);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [supplierSearch]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowSupplierDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadPO = async () => {
    try {
      const po = await apApi.fetchPurchaseOrder(poId!);
      setPONumber(po.poNumber);
      setSupplierId(po.supplierId);
      setSupplierSearch(po.supplierName ?? '');
      setExpectedDate(po.expectedDate ?? '');
      setNotes(po.notes ?? '');
      setStatus(po.status);
      if (po.lineItems?.length) {
        setLineItems(
          po.lineItems.map((li: any) => ({
            id: li.id ?? nextLineId(),
            description: li.description,
            quantity: li.quantity,
            unitPrice: li.unitPrice,
            amount: li.quantity * li.unitPrice,
          }))
        );
      }
    } catch (e) {
      console.error('Failed to load PO', e);
      setError('Failed to load purchase order');
    } finally {
      setLoading(false);
    }
  };

  const loadSuppliers = async (search: string) => {
    try {
      const result = await apApi.fetchSuppliers({ search, limit: 10, isActive: true });
      setSuppliers(result.suppliers);
      setShowSupplierDropdown(true);
    } catch {
      // ignore
    }
  };

  const selectSupplier = (s: Supplier) => {
    setSupplierId(s.id);
    setSupplierSearch(s.businessName);
    setShowSupplierDropdown(false);
  };

  const updateLine = (id: string, field: keyof POLineItem, value: string | number) => {
    setLineItems((prev) =>
      prev.map((li) => {
        if (li.id !== id) return li;
        const updated = { ...li, [field]: value };
        updated.amount = updated.quantity * updated.unitPrice;
        return updated;
      })
    );
  };

  const addLine = () => {
    setLineItems((prev) => [
      ...prev,
      { id: nextLineId(), description: '', quantity: 1, unitPrice: 0, amount: 0 },
    ]);
  };

  const removeLine = (id: string) => {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((li) => li.id !== id));
  };

  const subtotal = lineItems.reduce((sum, li) => sum + li.amount, 0);
  const gst = Math.round(subtotal * 0.1 * 100) / 100;
  const total = subtotal + gst;
  const isEditable = !poId || status === 'draft';

  const handleSave = async (sendAfter = false) => {
    if (!supplierId) {
      setError('Please select a supplier');
      return;
    }
    if (lineItems.every((li) => !li.description.trim())) {
      setError('Add at least one line item');
      return;
    }

    setError('');
    sendAfter ? setSending(true) : setSaving(true);

    try {
      const payload = {
        supplierId,
        expectedDate: expectedDate || undefined,
        notes: notes || undefined,
        lineItems: lineItems
          .filter((li) => li.description.trim())
          .map((li) => ({
            description: li.description,
            quantity: li.quantity,
            unitPrice: li.unitPrice,
          })),
      };

      if (poId) {
        await apApi.updatePurchaseOrder(poId, payload);
        if (sendAfter) await apApi.sendPurchaseOrder(poId);
      } else {
        const result = await apApi.createPurchaseOrder(payload);
        if (sendAfter) await apApi.sendPurchaseOrder(result.id);
      }
      onSave();
    } catch (e: any) {
      setError(e.message ?? 'Failed to save purchase order');
    } finally {
      setSaving(false);
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="neu-raised rounded-2xl p-8 animate-pulse">
        <div className="h-6 w-48 bg-white/5 rounded mb-6" />
        <div className="space-y-4">
          <div className="h-10 w-full bg-white/5 rounded" />
          <div className="h-10 w-full bg-white/5 rounded" />
          <div className="h-40 w-full bg-white/5 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onCancel}
          className="p-2 rounded-xl bg-white/5 text-zinc-400 hover:text-white transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-white">
            {poId ? `Edit PO ${poNumber}` : 'New Purchase Order'}
          </h2>
          {poNumber && (
            <p className="text-xs text-zinc-500 mt-0.5 font-mono">{poNumber}</p>
          )}
        </div>
        {!isEditable && (
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-400/10 text-blue-400">
            {status}
          </span>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Form */}
      <div className="neu-raised rounded-2xl p-6 space-y-5">
        {/* Supplier + Expected Date Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative" ref={dropdownRef}>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Supplier *
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input
                type="text"
                value={supplierSearch}
                onChange={(e) => {
                  setSupplierSearch(e.target.value);
                  setSupplierId('');
                }}
                disabled={!isEditable}
                placeholder="Search supplier..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#FFCC00]/30 focus:ring-1 focus:ring-[#FFCC00]/20 transition-all disabled:opacity-50"
              />
            </div>
            {showSupplierDropdown && suppliers.length > 0 && (
              <div className="absolute z-20 mt-1 w-full rounded-xl bg-zinc-800 border border-white/10 shadow-xl max-h-48 overflow-y-auto">
                {suppliers.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => selectSupplier(s)}
                    className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-white/5 transition-colors first:rounded-t-xl last:rounded-b-xl"
                  >
                    <span className="font-medium">{s.businessName}</span>
                    {s.abn && (
                      <span className="text-zinc-500 ml-2 text-xs">ABN: {s.abn}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Expected Delivery Date
            </label>
            <input
              type="date"
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
              disabled={!isEditable}
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-[#FFCC00]/30 focus:ring-1 focus:ring-[#FFCC00]/20 transition-all disabled:opacity-50"
            />
          </div>
        </div>

        {/* Line Items */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Line Items
            </label>
            {isEditable && (
              <button
                onClick={addLine}
                className="flex items-center gap-1 text-xs text-[#FFCC00] hover:text-[#FFCC00]/80 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Row
              </button>
            )}
          </div>

          <div className="rounded-xl border border-white/5 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-400 w-[45%]">
                    Description
                  </th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-zinc-400 w-[15%]">
                    Qty
                  </th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-zinc-400 w-[18%]">
                    Unit Price
                  </th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-zinc-400 w-[17%]">
                    Amount
                  </th>
                  <th className="w-[5%]" />
                </tr>
              </thead>
              <tbody>
                {lineItems.map((li) => (
                  <tr key={li.id} className="border-b border-white/5">
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        value={li.description}
                        onChange={(e) => updateLine(li.id, 'description', e.target.value)}
                        disabled={!isEditable}
                        placeholder="Item description"
                        className="w-full px-2 py-1.5 rounded-lg bg-transparent border border-transparent text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#FFCC00]/20 transition-all disabled:opacity-50"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={li.quantity}
                        onChange={(e) => updateLine(li.id, 'quantity', Number(e.target.value))}
                        disabled={!isEditable}
                        className="w-full px-2 py-1.5 rounded-lg bg-transparent border border-transparent text-sm text-white text-right focus:outline-none focus:border-[#FFCC00]/20 transition-all disabled:opacity-50"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={li.unitPrice}
                        onChange={(e) => updateLine(li.id, 'unitPrice', Number(e.target.value))}
                        disabled={!isEditable}
                        className="w-full px-2 py-1.5 rounded-lg bg-transparent border border-transparent text-sm text-white text-right focus:outline-none focus:border-[#FFCC00]/20 transition-all disabled:opacity-50"
                      />
                    </td>
                    <td className="px-3 py-1.5 text-right text-sm font-medium text-zinc-300">
                      {formatCurrency(li.amount)}
                    </td>
                    <td className="px-1 py-1.5">
                      {isEditable && lineItems.length > 1 && (
                        <button
                          onClick={() => removeLine(li.id)}
                          className="p-1 rounded-lg text-zinc-600 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Subtotal</span>
              <span className="text-white font-medium">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">GST (10%)</span>
              <span className="text-white font-medium">{formatCurrency(gst)}</span>
            </div>
            <div className="flex justify-between text-sm border-t border-white/10 pt-2">
              <span className="text-zinc-300 font-semibold">Total</span>
              <span className="text-[#FFCC00] font-bold text-lg">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={!isEditable}
            rows={3}
            placeholder="Internal notes..."
            className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#FFCC00]/30 focus:ring-1 focus:ring-[#FFCC00]/20 transition-all resize-none disabled:opacity-50"
          />
        </div>
      </div>

      {/* Actions */}
      {isEditable && (
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl bg-white/5 text-zinc-400 text-sm font-medium hover:text-white transition-all"
          >
            Cancel
          </button>
          <button
            onClick={() => handleSave(false)}
            disabled={saving || sending}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 text-white text-sm font-medium hover:bg-white/15 transition-all disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Draft'}
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={saving || sending}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FFCC00] text-black text-sm font-semibold hover:bg-[#FFCC00]/90 transition-all shadow-[0_0_20px_rgba(255,204,0,0.2)] disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {sending ? 'Sending...' : 'Send to Supplier'}
          </button>
        </div>
      )}
    </div>
  );
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value);
}
