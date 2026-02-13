import { X, Tag, Trash2 } from 'lucide-react';
import { CategorySelect } from './CategorySelect';
import { useState } from 'react';
import { api } from '@/api';
import { cn } from '@/lib/utils';

interface BulkActionBarProps {
  selectedCount: number;
  selectedIds: Set<string>;
  onClearSelection: () => void;
  onDataChange?: () => void;
}

export function BulkActionBar({
  selectedCount,
  selectedIds,
  onClearSelection,
  onDataChange,
}: BulkActionBarProps) {
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  if (selectedCount === 0) return null;

  const handleBatchCategory = async (category: string) => {
    setIsProcessing(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) => api.updateTransaction(id, { category })),
      );
      onClearSelection();
      onDataChange?.();
    } catch (err) {
      console.error('Batch category update failed:', err);
    } finally {
      setIsProcessing(false);
      setShowCategoryPicker(false);
    }
  };

  const handleBatchGST = async (gstApplicable: boolean) => {
    setIsProcessing(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) => api.updateTransaction(id, { gstApplicable })),
      );
      onClearSelection();
      onDataChange?.();
    } catch (err) {
      console.error('Batch GST update failed:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBatchDelete = async () => {
    if (!confirm(`Delete ${selectedCount} transactions?`)) return;
    setIsProcessing(true);
    try {
      await Promise.all(Array.from(selectedIds).map((id) => api.deleteTransaction(id)));
      onClearSelection();
      onDataChange?.();
    } catch (err) {
      console.error('Batch delete failed:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="sticky top-0 z-40 p-4 neu-raised rounded-2xl border border-[#FFCC00]/20 flex flex-wrap items-center gap-4 animate-in slide-in-from-top-2 duration-300">
      <div className="flex items-center gap-2">
        <span className="text-sm font-black text-[#FFCC00]">{selectedCount}</span>
        <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">selected</span>
      </div>

      <div className="w-px h-6 bg-white/10" />

      <div className="flex items-center gap-2 flex-wrap">
        {/* Set Category */}
        <div className="relative">
          <button
            onClick={() => setShowCategoryPicker(!showCategoryPicker)}
            disabled={isProcessing}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-black uppercase tracking-widest neu-raised-sm rounded-xl text-zinc-400 hover:text-[#FFCC00] border border-white/5 transition-colors disabled:opacity-50"
          >
            <Tag className="h-3.5 w-3.5" /> Set Category
          </button>
          {showCategoryPicker && (
            <div className="absolute top-full mt-1 left-0 w-64 z-50">
              <CategorySelect
                value=""
                onChange={(cat) => handleBatchCategory(cat)}
                size="sm"
                aria-label="Batch set category"
              />
            </div>
          )}
        </div>

        {/* Set GST */}
        <button
          onClick={() => handleBatchGST(true)}
          disabled={isProcessing}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-black uppercase tracking-widest neu-raised-sm rounded-xl text-zinc-400 hover:text-emerald-400 border border-white/5 transition-colors disabled:opacity-50"
        >
          GST On
        </button>
        <button
          onClick={() => handleBatchGST(false)}
          disabled={isProcessing}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-black uppercase tracking-widest neu-raised-sm rounded-xl text-zinc-400 hover:text-zinc-300 border border-white/5 transition-colors disabled:opacity-50"
        >
          GST Off
        </button>

        {/* Delete */}
        <button
          onClick={handleBatchDelete}
          disabled={isProcessing}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-black uppercase tracking-widest neu-raised-sm rounded-xl text-zinc-400 hover:text-red-400 border border-white/5 transition-colors disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </button>
      </div>

      <div className="ml-auto">
        <button
          onClick={onClearSelection}
          className={cn(
            'p-2 text-zinc-500 hover:text-zinc-300 rounded-xl transition-colors',
            isProcessing && 'opacity-50 pointer-events-none',
          )}
          aria-label="Clear selection"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
