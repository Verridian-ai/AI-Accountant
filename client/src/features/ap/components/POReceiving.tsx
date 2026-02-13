import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  PackageCheck,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Minus,
} from 'lucide-react';
import { apApi } from '../../../api';
import type { PurchaseOrder } from '../../../api';

interface ReceivingLine {
  lineId: string;
  description: string;
  orderedQty: number;
  previouslyReceived: number;
  receivingNow: number;
  unitPrice: number;
  maxReceivable: number;
}

interface ReceiptHistoryItem {
  id: string;
  receiptDate: string;
  receivedBy?: string;
  lines: Array<{ lineId: string; quantity: number }>;
}

interface ThreeWayMatch {
  poTotal: number;
  receiptTotal: number;
  billTotal: number;
  lines: Array<{
    description: string;
    poQty: number;
    receivedQty: number;
    billedQty: number;
    poAmount: number;
    receivedAmount: number;
    billedAmount: number;
    matched: boolean;
  }>;
  status: 'matched' | 'partial' | 'discrepancy';
}

interface POReceivingProps {
  poId: string;
  onBack: () => void;
  onReceived: () => void;
}

export function POReceiving({ poId, onBack, onReceived }: POReceivingProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [po, setPO] = useState<PurchaseOrder | null>(null);
  const [lines, setLines] = useState<ReceivingLine[]>([]);
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [receipts, setReceipts] = useState<ReceiptHistoryItem[]>([]);
  const [threeWay, setThreeWay] = useState<ThreeWayMatch | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadPO();
  }, [poId]);

  const loadPO = async () => {
    try {
      const poData = await apApi.fetchPurchaseOrder(poId);
      setPO(poData);

      // Build receiving lines from PO line items
      const receivingLines: ReceivingLine[] = (poData.lineItems ?? []).map((li: any) => {
        const prevReceived = li.receivedQuantity ?? 0;
        return {
          lineId: li.id ?? li.lineId ?? '',
          description: li.description,
          orderedQty: li.quantity,
          previouslyReceived: prevReceived,
          receivingNow: 0,
          unitPrice: li.unitPrice,
          maxReceivable: li.quantity - prevReceived,
        };
      });
      setLines(receivingLines);

      // Load receipt history if available
      if (poData.receipts) {
        setReceipts(poData.receipts);
      }

      // Load three-way match if bill linked
      if (poData.purchaseOrderId || poData.billId) {
        try {
          const matchData = await apApi.fetchThreeWayMatch(poId);
          setThreeWay(matchData);
        } catch {
          // No three-way match available
        }
      }
    } catch (e) {
      console.error('Failed to load PO for receiving', e);
      setError('Failed to load purchase order');
    } finally {
      setLoading(false);
    }
  };

  const updateReceivingQty = (lineId: string, qty: number) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.lineId !== lineId) return l;
        const clamped = Math.max(0, Math.min(qty, l.maxReceivable));
        return { ...l, receivingNow: clamped };
      })
    );
  };

  const totalReceivingNow = lines.reduce((sum, l) => sum + l.receivingNow, 0);
  const linesFullyReceived = lines.filter((l) => l.previouslyReceived + l.receivingNow >= l.orderedQty).length;
  const linesPartial = lines.filter((l) => {
    const total = l.previouslyReceived + l.receivingNow;
    return total > 0 && total < l.orderedQty;
  }).length;
  const linesOutstanding = lines.filter((l) => l.previouslyReceived + l.receivingNow === 0 && l.orderedQty > 0).length;

  const handleRecordReceipt = async () => {
    if (totalReceivingNow === 0) {
      setError('Enter quantities to receive');
      return;
    }
    setError('');
    setSaving(true);

    try {
      await apApi.receivePurchaseOrder(poId, {
        receiptDate,
        notes: notes || undefined,
        lines: lines
          .filter((l) => l.receivingNow > 0)
          .map((l) => ({
            lineId: l.lineId,
            quantity: l.receivingNow,
          })),
      });
      onReceived();
    } catch (e: any) {
      setError(e.message ?? 'Failed to record receipt');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="neu-raised rounded-2xl p-8 animate-pulse">
        <div className="h-6 w-48 bg-white/5 rounded mb-6" />
        <div className="space-y-4">
          <div className="h-10 w-full bg-white/5 rounded" />
          <div className="h-40 w-full bg-white/5 rounded" />
        </div>
      </div>
    );
  }

  if (!po) {
    return (
      <div className="neu-raised rounded-2xl p-8 text-center">
        <AlertTriangle className="h-10 w-10 text-red-400 mx-auto mb-3" />
        <p className="text-zinc-400">Purchase order not found</p>
      </div>
    );
  }

  const isReceivable = po.status === 'sent' || po.status === 'partially_received';

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 rounded-xl bg-white/5 text-zinc-400 hover:text-white transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-white">Goods Receiving</h2>
          <p className="text-xs text-zinc-500 mt-0.5 font-mono">{po.poNumber}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
          po.status === 'received' ? 'bg-emerald-400/10 text-emerald-400' :
          po.status === 'partially_received' ? 'bg-amber-400/10 text-amber-400' :
          'bg-blue-400/10 text-blue-400'
        }`}>
          {po.status.replace('_', ' ')}
        </span>
      </div>

      {/* PO Header Info */}
      <div className="neu-raised rounded-2xl p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-zinc-500 text-xs">Supplier</span>
            <p className="text-white font-medium">{po.supplierName ?? '—'}</p>
          </div>
          <div>
            <span className="text-zinc-500 text-xs">Issue Date</span>
            <p className="text-white">{po.issueDate ? new Date(po.issueDate).toLocaleDateString('en-AU') : '—'}</p>
          </div>
          <div>
            <span className="text-zinc-500 text-xs">Expected Delivery</span>
            <p className="text-white">{po.expectedDate ? new Date(po.expectedDate).toLocaleDateString('en-AU') : '—'}</p>
          </div>
          <div>
            <span className="text-zinc-500 text-xs">PO Total</span>
            <p className="text-[#FFCC00] font-semibold">{formatCurrency(po.total)}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Receiving Lines Table */}
      {isReceivable && (
        <div className="neu-raised rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-300">Receive Items</h3>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-zinc-500" />
              <input
                type="date"
                value={receiptDate}
                onChange={(e) => setReceiptDate(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-[#FFCC00]/30 transition-all"
              />
            </div>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="text-left px-4 py-2 text-xs font-semibold text-zinc-400">Description</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-zinc-400">Ordered</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-zinc-400">Prev Recv</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-zinc-400 w-28">Receiving Now</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-zinc-400">Unit Price</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-zinc-400">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const willComplete = line.previouslyReceived + line.receivingNow >= line.orderedQty;
                return (
                  <tr
                    key={line.lineId}
                    className={`border-b border-white/5 transition-colors ${
                      willComplete && line.receivingNow > 0 ? 'bg-emerald-400/[0.03]' : ''
                    }`}
                  >
                    <td className="px-4 py-3 text-sm text-white">{line.description}</td>
                    <td className="px-3 py-3 text-sm text-zinc-400 text-right">{line.orderedQty}</td>
                    <td className="px-3 py-3 text-sm text-zinc-400 text-right">{line.previouslyReceived}</td>
                    <td className="px-3 py-3">
                      <input
                        type="number"
                        min={0}
                        max={line.maxReceivable}
                        value={line.receivingNow}
                        onChange={(e) => updateReceivingQty(line.lineId, Number(e.target.value))}
                        className={`w-full px-2 py-1.5 rounded-lg text-sm text-right text-white bg-white/5 border focus:outline-none focus:ring-1 transition-all ${
                          line.receivingNow > 0
                            ? 'border-[#FFCC00]/30 focus:ring-[#FFCC00]/20'
                            : 'border-white/10 focus:ring-white/10'
                        }`}
                      />
                    </td>
                    <td className="px-3 py-3 text-sm text-zinc-400 text-right">
                      {formatCurrency(line.unitPrice)}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-right">
                      <span className={line.receivingNow > 0 ? 'text-[#FFCC00]' : 'text-zinc-500'}>
                        {formatCurrency(line.receivingNow * line.unitPrice)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Receiving Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="neu-raised rounded-2xl p-4 text-center">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 mx-auto mb-1" />
          <p className="text-lg font-bold text-white">{linesFullyReceived}</p>
          <p className="text-xs text-zinc-500">Fully Received</p>
        </div>
        <div className="neu-raised rounded-2xl p-4 text-center">
          <Minus className="h-5 w-5 text-amber-400 mx-auto mb-1" />
          <p className="text-lg font-bold text-white">{linesPartial}</p>
          <p className="text-xs text-zinc-500">Partial</p>
        </div>
        <div className="neu-raised rounded-2xl p-4 text-center">
          <AlertTriangle className="h-5 w-5 text-zinc-500 mx-auto mb-1" />
          <p className="text-lg font-bold text-white">{linesOutstanding}</p>
          <p className="text-xs text-zinc-500">Outstanding</p>
        </div>
      </div>

      {/* Notes + Record Button */}
      {isReceivable && (
        <div className="neu-raised rounded-2xl p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Receipt Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional notes for this receipt..."
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#FFCC00]/30 focus:ring-1 focus:ring-[#FFCC00]/20 transition-all resize-none"
            />
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleRecordReceipt}
              disabled={saving || totalReceivingNow === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FFCC00] text-black text-sm font-semibold hover:bg-[#FFCC00]/90 transition-all shadow-[0_0_20px_rgba(255,204,0,0.2)] disabled:opacity-50"
            >
              <PackageCheck className="h-4 w-4" />
              {saving ? 'Recording...' : `Record Receipt (${totalReceivingNow} items)`}
            </button>
          </div>
        </div>
      )}

      {/* Receipt History */}
      {receipts.length > 0 && (
        <div className="neu-raised rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-zinc-300 mb-3">Receipt History</h3>
          <div className="space-y-2">
            {receipts.map((r, idx) => (
              <div
                key={r.id ?? idx}
                className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.02] border border-white/5"
              >
                <div className="flex items-center gap-3">
                  <PackageCheck className="h-4 w-4 text-emerald-400" />
                  <div>
                    <p className="text-sm text-white font-medium">
                      {new Date(r.receiptDate).toLocaleDateString('en-AU')}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {r.lines.reduce((sum, l) => sum + l.quantity, 0)} items received
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Three-Way Match Panel */}
      {threeWay && (
        <div className="neu-raised rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-4 w-4 text-[#FFCC00]" />
            <h3 className="text-sm font-semibold text-zinc-300">Three-Way Match</h3>
            <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-medium ${
              threeWay.status === 'matched' ? 'bg-emerald-400/10 text-emerald-400' :
              threeWay.status === 'partial' ? 'bg-amber-400/10 text-amber-400' :
              'bg-red-400/10 text-red-400'
            }`}>
              {threeWay.status === 'matched' ? 'Matched' :
               threeWay.status === 'partial' ? 'Partial Match' : 'Discrepancy'}
            </span>
          </div>

          {/* Summary Comparison */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <p className="text-xs text-zinc-500 mb-1">PO Total</p>
              <p className="text-sm font-semibold text-white">{formatCurrency(threeWay.poTotal)}</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <p className="text-xs text-zinc-500 mb-1">Receipt Total</p>
              <p className="text-sm font-semibold text-white">{formatCurrency(threeWay.receiptTotal)}</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <p className="text-xs text-zinc-500 mb-1">Bill Total</p>
              <p className="text-sm font-semibold text-white">{formatCurrency(threeWay.billTotal)}</p>
            </div>
          </div>

          {/* Per-Line Comparison */}
          <div className="rounded-xl border border-white/5 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <th className="text-left px-3 py-2 text-zinc-400">Item</th>
                  <th className="text-right px-3 py-2 text-zinc-400">PO Qty</th>
                  <th className="text-right px-3 py-2 text-zinc-400">Recv Qty</th>
                  <th className="text-right px-3 py-2 text-zinc-400">Bill Qty</th>
                  <th className="text-center px-3 py-2 text-zinc-400">Match</th>
                </tr>
              </thead>
              <tbody>
                {threeWay.lines.map((l, idx) => (
                  <tr key={idx} className={`border-b border-white/5 ${!l.matched ? 'bg-red-500/[0.03]' : ''}`}>
                    <td className="px-3 py-2 text-zinc-300">{l.description}</td>
                    <td className="px-3 py-2 text-right text-zinc-400">{l.poQty}</td>
                    <td className="px-3 py-2 text-right text-zinc-400">{l.receivedQty}</td>
                    <td className="px-3 py-2 text-right text-zinc-400">{l.billedQty}</td>
                    <td className="px-3 py-2 text-center">
                      {l.matched ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 inline" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5 text-red-400 inline" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value / 100);
}
