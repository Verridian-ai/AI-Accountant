import { useState, useEffect, useMemo } from 'react';
import { Loader2, Check, Minus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { documentsApi } from '@/api';
import type { OCRLineItem } from '@/api';
import { CATEGORIES } from '@/features/transactions/constants/categories';

interface LineItemEditorProps {
  documentId: string;
  readOnly?: boolean;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount / 100);
}

function confidenceBadge(score: number) {
  if (score > 80) return <Badge variant="success">{score}%</Badge>;
  if (score > 50) return <Badge variant="warning">{score}%</Badge>;
  return <Badge variant="destructive">{score}%</Badge>;
}

export function LineItemEditor({ documentId, readOnly = false }: LineItemEditorProps) {
  const [items, setItems] = useState<OCRLineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);
  const [editValue, setEditValue] = useState('');

  const categoryNames = useMemo(() => CATEGORIES.map((c) => c.name), []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await documentsApi.getLineItems(documentId);
        setItems(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to load line items', err);
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [documentId]);

  const startEdit = (rowIndex: number, col: string, currentValue: string | number) => {
    if (readOnly) return;
    setEditingCell({ row: rowIndex, col });
    setEditValue(String(currentValue));
  };

  const commitEdit = () => {
    if (!editingCell) return;
    const { row, col } = editingCell;
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== row) return item;
        const updated = { ...item };
        switch (col) {
          case 'description':
            updated.description = editValue;
            break;
          case 'quantity':
            updated.quantity = parseFloat(editValue) || 0;
            if (updated.unitPrice != null) updated.amount = Math.round(updated.quantity * updated.unitPrice);
            break;
          case 'unitPrice':
            updated.unitPrice = parseFloat(editValue) || 0;
            updated.amount = Math.round(updated.quantity * (updated.unitPrice ?? 0));
            break;
          case 'amount':
            updated.amount = parseFloat(editValue) || 0;
            break;
          case 'category':
            updated.category = editValue;
            break;
        }
        return updated;
      })
    );
    setEditingCell(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitEdit();
    if (e.key === 'Escape') setEditingCell(null);
  };

  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
  const totalGst = items.reduce((sum, item) => sum + item.gstAmount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 text-[#FFCC00] animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="neu-inset rounded-lg p-6 text-center">
        <p className="text-zinc-500 text-sm">No line items extracted</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10">
            <th className="text-left py-2 px-2 text-xs font-bold text-zinc-500 uppercase tracking-wide w-10">#</th>
            <th className="text-left py-2 px-2 text-xs font-bold text-zinc-500 uppercase tracking-wide">Description</th>
            <th className="text-right py-2 px-2 text-xs font-bold text-zinc-500 uppercase tracking-wide w-16">Qty</th>
            <th className="text-right py-2 px-2 text-xs font-bold text-zinc-500 uppercase tracking-wide w-24">Unit Price</th>
            <th className="text-right py-2 px-2 text-xs font-bold text-zinc-500 uppercase tracking-wide w-24">Amount</th>
            <th className="text-right py-2 px-2 text-xs font-bold text-zinc-500 uppercase tracking-wide w-20">GST</th>
            <th className="text-center py-2 px-2 text-xs font-bold text-zinc-500 uppercase tracking-wide w-10">Inc</th>
            <th className="text-left py-2 px-2 text-xs font-bold text-zinc-500 uppercase tracking-wide w-36">Category</th>
            <th className="text-center py-2 px-2 text-xs font-bold text-zinc-500 uppercase tracking-wide w-16">Conf</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={item.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
              <td className="py-2 px-2 text-zinc-500">{item.lineNumber}</td>
              <td
                className={`py-2 px-2 text-zinc-200 ${!readOnly ? 'cursor-pointer hover:bg-white/5 rounded' : ''}`}
                onClick={() => startEdit(i, 'description', item.description)}
              >
                {editingCell?.row === i && editingCell.col === 'description' ? (
                  <input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={handleKeyDown}
                    className="w-full bg-white/5 border border-[#FFCC00]/30 rounded px-2 py-0.5 text-zinc-200 focus:outline-none"
                  />
                ) : (
                  item.description
                )}
              </td>
              <td
                className={`py-2 px-2 text-right text-zinc-300 ${!readOnly ? 'cursor-pointer hover:bg-white/5 rounded' : ''}`}
                onClick={() => startEdit(i, 'quantity', item.quantity)}
              >
                {editingCell?.row === i && editingCell.col === 'quantity' ? (
                  <input
                    autoFocus
                    type="number"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={handleKeyDown}
                    className="w-full bg-white/5 border border-[#FFCC00]/30 rounded px-2 py-0.5 text-right text-zinc-200 focus:outline-none"
                  />
                ) : (
                  item.quantity
                )}
              </td>
              <td
                className={`py-2 px-2 text-right text-zinc-300 ${!readOnly ? 'cursor-pointer hover:bg-white/5 rounded' : ''}`}
                onClick={() => startEdit(i, 'unitPrice', item.unitPrice ?? 0)}
              >
                {editingCell?.row === i && editingCell.col === 'unitPrice' ? (
                  <input
                    autoFocus
                    type="number"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={handleKeyDown}
                    className="w-full bg-white/5 border border-[#FFCC00]/30 rounded px-2 py-0.5 text-right text-zinc-200 focus:outline-none"
                  />
                ) : (
                  item.unitPrice != null ? formatCurrency(item.unitPrice) : '-'
                )}
              </td>
              <td
                className={`py-2 px-2 text-right text-zinc-200 font-medium ${!readOnly ? 'cursor-pointer hover:bg-white/5 rounded' : ''}`}
                onClick={() => startEdit(i, 'amount', item.amount)}
              >
                {editingCell?.row === i && editingCell.col === 'amount' ? (
                  <input
                    autoFocus
                    type="number"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={handleKeyDown}
                    className="w-full bg-white/5 border border-[#FFCC00]/30 rounded px-2 py-0.5 text-right text-zinc-200 focus:outline-none"
                  />
                ) : (
                  formatCurrency(item.amount)
                )}
              </td>
              <td className="py-2 px-2 text-right text-zinc-400">{formatCurrency(item.gstAmount)}</td>
              <td className="py-2 px-2 text-center">
                {item.gstInclusive
                  ? <Check className="h-4 w-4 text-green-400 mx-auto" />
                  : <Minus className="h-4 w-4 text-zinc-600 mx-auto" />
                }
              </td>
              <td className="py-2 px-2">
                {readOnly ? (
                  <span className="text-zinc-300 text-xs">{item.category || '-'}</span>
                ) : (
                  <select
                    value={item.category || ''}
                    onChange={(e) => {
                      setItems((prev) =>
                        prev.map((it, idx) => idx === i ? { ...it, category: e.target.value } : it)
                      );
                    }}
                    className="w-full bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-xs text-zinc-300 focus:ring-1 focus:ring-[#FFCC00]/20 focus:outline-none"
                  >
                    <option value="">Select...</option>
                    {categoryNames.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                )}
              </td>
              <td className="py-2 px-2 text-center">{confidenceBadge(item.confidenceScore)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-white/10 bg-white/[0.02]">
            <td colSpan={4} className="py-2 px-2 text-right text-xs font-bold text-zinc-400 uppercase">Total</td>
            <td className="py-2 px-2 text-right text-zinc-100 font-bold">{formatCurrency(totalAmount)}</td>
            <td className="py-2 px-2 text-right text-zinc-300">{formatCurrency(totalGst)}</td>
            <td colSpan={3} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
