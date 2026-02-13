import { useEffect, useRef, useCallback } from 'react';
import type { Transaction, SplitEntry } from '../types/ledger';
import { CategorySelect } from './CategorySelect';
import { cn } from '@/lib/utils';
import { Scissors, X, Plus, Trash2 } from 'lucide-react';

interface SplitTransactionModalProps {
  transaction: Transaction;
  splits: SplitEntry[];
  onSplitsChange: (splits: SplitEntry[]) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving?: boolean;
}

export function SplitTransactionModal({
  transaction,
  splits,
  onSplitsChange,
  onSave,
  onCancel,
  isSaving = false,
}: SplitTransactionModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const firstFocusableRef = useRef<HTMLButtonElement>(null);
  const lastFocusableRef = useRef<HTMLButtonElement>(null);

  const totalSplit = splits.reduce((sum, s) => sum + s.amount, 0);
  const remaining = transaction.amount - totalSplit;
  const isBalanced = remaining === 0;

  // Focus trap and escape handler
  useEffect(() => {
    previousActiveElement.current = document.activeElement as HTMLElement;

    // Focus the first focusable element when modal opens
    const timer = setTimeout(() => {
      firstFocusableRef.current?.focus();
    }, 0);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
        return;
      }

      // Focus trap logic
      if (e.key === 'Tab') {
        const focusableElements = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );

        if (!focusableElements || focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (!firstElement || !lastElement) return;

        if (e.shiftKey) {
          // Shift + Tab: if on first element, go to last
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab: if on last element, go to first
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', handleKeyDown);
      previousActiveElement.current?.focus();
    };
  }, [onCancel]);

  const updateSplit = useCallback(
    (index: number, updates: Partial<SplitEntry>) => {
      const newSplits = [...splits];
      const existingSplit = newSplits[index];
      if (existingSplit) {
        newSplits[index] = { ...existingSplit, ...updates };
        onSplitsChange(newSplits);
      }
    },
    [splits, onSplitsChange],
  );

  const addSplit = useCallback(() => {
    onSplitsChange([
      ...splits,
      {
        category: 'Uncategorized',
        amount: 0,
        description: transaction.description,
        gst: transaction.gstApplicable,
      },
    ]);
  }, [splits, onSplitsChange, transaction.description, transaction.gstApplicable]);

  const removeSplit = useCallback(
    (index: number) => {
      if (splits.length > 2) {
        onSplitsChange(splits.filter((_, i) => i !== index));
      }
    },
    [splits, onSplitsChange],
  );

  const formatCurrency = (amountInCents: number) => {
    return (amountInCents / 100).toFixed(2);
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-xl z-50 flex items-center justify-center p-4 animate-in fade-in duration-300"
      onClick={(e) => {
        // Close on backdrop click
        if (e.target === e.currentTarget) {
          onCancel();
        }
      }}
    >
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-[160px]" />
      </div>

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="split-modal-title"
        aria-describedby="split-modal-description"
        className="neu-raised rounded-[2.5rem] w-full max-w-2xl overflow-hidden relative border border-white/5 shadow-2xl"
      >
        {/* Header */}
        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/1">
          <div className="flex items-center gap-4">
            <div className="p-3 neu-inset rounded-2xl text-purple-400">
              <Scissors className="h-6 w-6" />
            </div>
            <div>
              <h3
                id="split-modal-title"
                className="text-2xl font-black text-gradient-gold tracking-tight uppercase"
              >
                Split Transaction
              </h3>
              <p
                id="split-modal-description"
                className="text-xs text-zinc-500 font-bold uppercase tracking-widest mt-1"
              >
                Splitting: {transaction.description}
              </p>
            </div>
          </div>
          <button
            ref={firstFocusableRef}
            onClick={onCancel}
            className="neu-raised-sm p-3 rounded-2xl text-zinc-500 hover:text-red-400 btn-press"
            aria-label="Close modal"
            title="Close modal"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Body with split entries */}
        <div className="p-8 space-y-6 max-h-[55vh] overflow-y-auto scrollbar-thin">
          {splits.map((split, idx) => (
            <div
              key={idx}
              className="neu-raised-sm p-6 rounded-3xl space-y-5 relative group border border-white/5 hover:border-purple-500/20 transition-all"
            >
              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 neu-inset rounded-full flex items-center justify-center text-xs font-black text-[#FFCC00]">
                    {idx + 1}
                  </span>
                  <span className="text-xs font-black uppercase text-zinc-500 tracking-[0.2em]">
                    Split Part
                  </span>
                </div>
                {splits.length > 2 && (
                  <button
                    onClick={() => removeSplit(idx)}
                    className="text-red-400/50 hover:text-red-400 p-2 hover:bg-red-500/10 rounded-xl transition-all btn-press"
                    aria-label={`Remove split part ${idx + 1}`}
                    title="Remove split"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Category Select */}
                <div className="space-y-2">
                  <label
                    htmlFor={`split-category-${idx}`}
                    className="text-xs font-black uppercase text-zinc-600 tracking-widest ml-1"
                  >
                    Category
                  </label>
                  <CategorySelect
                    value={split.category}
                    onChange={(value) => updateSplit(idx, { category: value })}
                    aria-label={`Category for split part ${idx + 1}`}
                    size="lg"
                    className="rounded-2xl"
                  />
                </div>

                {/* Amount + GST row */}
                <div className="flex gap-4">
                  <div className="flex-1 space-y-2">
                    <label
                      htmlFor={`split-amount-${idx}`}
                      className="text-xs font-black uppercase text-zinc-600 tracking-widest ml-1"
                    >
                      Amount ($)
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 font-black text-xs">
                        $
                      </span>
                      <input
                        id={`split-amount-${idx}`}
                        type="number"
                        step="0.01"
                        min="0"
                        aria-label={`Amount for split part ${idx + 1}`}
                        value={split.amount / 100}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value) || 0;
                          updateSplit(idx, { amount: Math.round(value * 100) });
                        }}
                        className="w-full pl-8 pr-4 py-4 text-sm neu-inset rounded-2xl text-[#FFCC00] font-bold focus-gold outline-none"
                      />
                    </div>
                  </div>
                  <div className="w-20 space-y-2">
                    <label className="text-xs font-black uppercase text-zinc-600 tracking-widest ml-1">
                      GST
                    </label>
                    <button
                      type="button"
                      onClick={() => updateSplit(idx, { gst: !split.gst })}
                      className={cn(
                        'w-full py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border',
                        split.gst
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'neu-inset text-zinc-600 border-zinc-800/50',
                      )}
                      aria-label={`GST for split part ${idx + 1}: ${split.gst ? 'included' : 'excluded'}`}
                    >
                      {split.gst ? 'GST' : 'N/A'}
                    </button>
                  </div>
                </div>

                {/* Description Input */}
                <div className="md:col-span-2 space-y-2">
                  <label
                    htmlFor={`split-description-${idx}`}
                    className="text-xs font-black uppercase text-zinc-600 tracking-widest ml-1"
                  >
                    Description
                  </label>
                  <input
                    id={`split-description-${idx}`}
                    type="text"
                    aria-label={`Description for split part ${idx + 1}`}
                    value={split.description}
                    onChange={(e) => updateSplit(idx, { description: e.target.value })}
                    className="w-full p-4 text-sm neu-inset rounded-2xl text-[#FFCC00] font-bold focus-gold outline-none"
                    placeholder="Enter description..."
                  />
                </div>
              </div>
            </div>
          ))}

          {/* Add Split Button */}
          <button
            onClick={addSplit}
            className="w-full py-6 border-2 border-dashed border-zinc-800 rounded-4xl text-zinc-600 hover:text-[#FFCC00] hover:border-[#FFCC00]/30 hover:bg-[#FFCC00]/5 transition-all flex items-center justify-center gap-3 font-black uppercase tracking-[0.2em] text-xs"
            aria-label="Add another split part"
          >
            <Plus className="h-5 w-5" /> Add Split
          </button>
        </div>

        {/* Footer with totals and actions */}
        <div className="p-8 border-t border-white/5 bg-white/1 flex flex-col sm:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <span className="text-xs font-black text-zinc-600 uppercase tracking-widest">
                Original Amount
              </span>
              <span className="text-sm font-bold text-zinc-400">
                ${formatCurrency(transaction.amount)}
              </span>
            </div>
            <div className="w-px h-8 bg-white/5" />
            <div className="flex flex-col">
              <span className="text-xs font-black text-zinc-600 uppercase tracking-widest">
                Remaining
              </span>
              <span
                className={cn(
                  'text-sm font-black tracking-tight',
                  isBalanced ? 'text-emerald-400' : 'text-red-400',
                )}
                aria-live="polite"
              >
                ${formatCurrency(remaining)}
              </span>
            </div>
            {isBalanced && (
              <div className="text-emerald-400 text-xs font-bold uppercase tracking-widest">
                Balanced
              </div>
            )}
          </div>

          <div className="flex gap-4 w-full sm:w-auto">
            <button
              onClick={onCancel}
              disabled={isSaving}
              className="flex-1 sm:flex-none px-8 py-4 rounded-2xl text-zinc-500 font-bold text-xs uppercase tracking-widest neu-raised-sm btn-press disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              ref={lastFocusableRef}
              onClick={onSave}
              disabled={!isBalanced || isSaving}
              className="flex-1 sm:flex-none px-10 py-4 rounded-2xl cba-gold-gradient text-[#0a0a0f] font-black text-xs uppercase tracking-[0.2em] cba-gold-glow btn-press disabled:opacity-30 disabled:grayscale"
              aria-describedby={!isBalanced ? 'split-error-message' : undefined}
            >
              {isSaving ? 'Saving...' : 'Confirm Split'}
            </button>
          </div>
        </div>

        {/* Screen reader only error message */}
        {!isBalanced && (
          <span id="split-error-message" className="sr-only">
            Split amounts must equal the original transaction amount of $
            {formatCurrency(transaction.amount)}. Current remaining: ${formatCurrency(remaining)}
          </span>
        )}
      </div>
    </div>
  );
}
