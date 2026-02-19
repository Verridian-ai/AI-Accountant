import { History, FileText, ChevronRight, Calculator } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { BASQuarter } from '@/types/tax';
import type { QuarterOption } from '../hooks/useBASDashboard.js';

interface HistoryTabProps {
  history: BASQuarter[];
  availableQuarters: QuarterOption[];
  setSelectedQuarter: (q: string) => void;
  setActiveTab: (tab: 'calculate' | 'breakdown' | 'history') => void;
  onCalculate: () => void;
}

export function HistoryTab({
  history,
  availableQuarters,
  setSelectedQuarter,
  setActiveTab,
  onCalculate,
}: HistoryTabProps) {
  // Build a lookup of saved quarters by value string (e.g. "2024-Q1")
  const savedByKey = new Map<string, BASQuarter>();
  for (const item of history) {
    savedByKey.set(`${item.year}-Q${item.quarter}`, item);
  }

  const hasQuarters = availableQuarters.length > 0 || history.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <History className="w-4 h-4 text-[#FFCC00]" />
        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">
          BAS History
        </span>
      </div>

      {!hasQuarters ? (
        <div className="neu-raised rounded-2xl border border-white/5 p-12 text-center">
          <FileText className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
          <p className="text-sm text-zinc-500">
            No BAS history found. Calculate your first BAS to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {availableQuarters.map((opt) => {
            const saved = savedByKey.get(opt.value);
            return (
              <div
                key={opt.value}
                className="neu-raised rounded-2xl border border-white/5 p-4 flex items-center justify-between group hover:border-[#FFCC00]/10 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl neu-inset flex items-center justify-center">
                    <span className="text-[11px] font-black text-[#FFCC00]">
                      {opt.label.split(' ')[0]}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-zinc-200">{opt.label}</p>
                    <p className="text-[10px] text-zinc-600">{opt.sublabel}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {saved ? (
                    <>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[9px] font-black uppercase tracking-wider border',
                          saved.status === 'lodged'
                            ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5'
                            : saved.status === 'draft'
                              ? 'border-[#FFCC00]/30 text-[#FFCC00] bg-[#FFCC00]/5'
                              : 'border-white/10 text-zinc-500',
                        )}
                      >
                        {saved.status}
                      </Badge>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedQuarter(opt.value);
                          setActiveTab('calculate');
                          onCalculate();
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-lg text-[10px] font-bold text-zinc-500 hover:text-[#FFCC00] transition-all"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        View
                        <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    </>
                  ) : (
                    <>
                      <Badge
                        variant="outline"
                        className="text-[9px] font-black uppercase tracking-wider border border-white/10 text-zinc-600"
                      >
                        Not saved
                      </Badge>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedQuarter(opt.value);
                          setActiveTab('calculate');
                          onCalculate();
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-lg text-[10px] font-bold text-zinc-500 hover:text-[#FFCC00] transition-all"
                      >
                        <Calculator className="w-3.5 h-3.5" />
                        Calculate
                        <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
