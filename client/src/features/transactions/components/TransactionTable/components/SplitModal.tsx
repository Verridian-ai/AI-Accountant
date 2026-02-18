import { Scissors, X, Trash2, Plus, ChevronDown } from 'lucide-react';
import type { Transaction } from '@/api';
import type { SplitItem } from '../hooks/useTransactionSplit.js';

interface SplitModalProps {
  splittingTx: Transaction;
  splits: SplitItem[];
  setSplits: React.Dispatch<React.SetStateAction<SplitItem[]>>;
  setSplittingTx: (tx: Transaction | null) => void;
  categories: string[];
  onSave: () => Promise<void>;
}

export function SplitModal({
  splittingTx,
  splits,
  setSplits,
  setSplittingTx,
  categories,
  onSave,
}: SplitModalProps) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-100 flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-[160px]" />
      </div>

      <div className="neu-raised rounded-[2.5rem] w-full max-w-2xl overflow-hidden relative border border-white/5 shadow-2xl">
        {/* Header */}
        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/1">
          <div className="flex items-center gap-4">
            <div className="p-3 neu-inset rounded-2xl text-purple-400">
              <Scissors className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-gradient-gold tracking-tight uppercase">
                Node Fission
              </h3>
              <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mt-1">
                Splitting: {splittingTx.description}
              </p>
            </div>
          </div>
          <button
            onClick={() => setSplittingTx(null)}
            className="neu-raised-sm p-3 rounded-2xl text-zinc-500 hover:text-red-400 btn-press"
            aria-label="Close modal"
            title="Close modal"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-8 space-y-6 max-h-[55vh] overflow-y-auto scrollbar-thin">
          {splits.map((split, idx) => (
            <div
              key={idx}
              className="neu-raised-sm p-6 rounded-3xl space-y-5 relative group border border-white/5 hover:border-purple-500/20 transition-all"
            >
              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 neu-inset rounded-full flex items-center justify-center text-[10px] font-black text-[#FFCC00]">
                    {idx + 1}
                  </span>
                  <span className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em]">
                    Fragment Node
                  </span>
                </div>
                {splits.length > 2 && (
                  <button
                    onClick={() => setSplits(splits.filter((_, i) => i !== idx))}
                    className="text-red-400/50 hover:text-red-400 p-2 hover:bg-red-500/10 rounded-xl transition-all btn-press"
                    aria-label="Remove split"
                    title="Remove split"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase text-zinc-600 tracking-widest ml-1">
                    Classification
                  </label>
                  <div className="relative">
                    <select
                      aria-label="Split category"
                      value={split.category}
                      onChange={(e) => {
                        const newSplits = [...splits];
                        if (newSplits[idx]) {
                          newSplits[idx].category = e.target.value;
                          setSplits(newSplits);
                        }
                      }}
                      className="w-full p-4 text-sm neu-inset rounded-2xl text-[#FFCC00] font-bold bg-transparent border-none focus:ring-0 appearance-none"
                    >
                      {categories
                        .filter((c) => c !== 'All')
                        .map((c) => (
                          <option key={c} value={c} className="bg-[#12121a] text-zinc-300">
                            {c}
                          </option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#FFCC00]/50 pointer-events-none" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase text-zinc-600 tracking-widest ml-1">
                    Quantum Value ($)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 font-black text-xs">
                      $
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      aria-label="Split amount"
                      value={split.amount / 100}
                      onChange={(e) => {
                        const newSplits = [...splits];
                        if (newSplits[idx]) {
                          newSplits[idx].amount = Math.round(parseFloat(e.target.value) * 100);
                          setSplits(newSplits);
                        }
                      }}
                      className="w-full pl-8 pr-4 py-4 text-sm neu-inset rounded-2xl text-[#FFCC00] font-bold focus-gold outline-none"
                    />
                  </div>
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[9px] font-black uppercase text-zinc-600 tracking-widest ml-1">
                    Data Label
                  </label>
                  <input
                    type="text"
                    aria-label="Split description"
                    value={split.description}
                    onChange={(e) => {
                      const newSplits = [...splits];
                      if (newSplits[idx]) {
                        newSplits[idx].description = e.target.value;
                        setSplits(newSplits);
                      }
                    }}
                    className="w-full p-4 text-sm neu-inset rounded-2xl text-[#FFCC00] font-bold focus-gold outline-none"
                    placeholder="Enter new label..."
                  />
                </div>
              </div>
            </div>
          ))}

          <button
            onClick={() =>
              setSplits([
                ...splits,
                {
                  category: 'Uncategorized',
                  amount: 0,
                  description: splittingTx.description,
                  gst: splittingTx.gstApplicable,
                },
              ])
            }
            className="w-full py-6 border-2 border-dashed border-zinc-800 rounded-4xl text-zinc-600 hover:text-[#FFCC00] hover:border-[#FFCC00]/30 hover:bg-[#FFCC00]/5 transition-all flex items-center justify-center gap-3 font-black uppercase tracking-[0.2em] text-xs"
          >
            <Plus className="h-5 w-5" /> Expand Fission
          </button>
        </div>

        {/* Footer */}
        <div className="p-8 border-t border-white/5 bg-white/1 flex flex-col sm:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">
                Original Mass
              </span>
              <span className="text-sm font-bold text-zinc-400">${splittingTx.amount / 100}</span>
            </div>
            <div className="w-px h-8 bg-white/5" />
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">
                Residual
              </span>
              <span className="text-sm font-black tracking-tight text-red-400">
                ${(splittingTx.amount - splits.reduce((sum, s) => sum + s.amount, 0)) / 100}
              </span>
            </div>
          </div>
          <div className="flex gap-4 w-full sm:w-auto">
            <button
              onClick={() => setSplittingTx(null)}
              className="flex-1 sm:flex-none px-8 py-4 rounded-2xl text-zinc-500 font-bold text-xs uppercase tracking-widest neu-raised-sm btn-press"
            >
              Abort
            </button>
            <button
              onClick={onSave}
              disabled={splits.reduce((sum, s) => sum + s.amount, 0) !== splittingTx.amount}
              className="flex-1 sm:flex-none px-10 py-4 rounded-2xl cba-gold-gradient text-[#0a0a0f] font-black text-xs uppercase tracking-[0.2em] cba-gold-glow btn-press disabled:opacity-30 disabled:grayscale"
            >
              Execute Split
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
