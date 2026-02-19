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
        <History className="w-4 h-4 text-cba-gold" />
        <span className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">
          BAS History
        </span>
      </div>

      {!hasQuarters ? (
        <div className="neu-raised rounded-2xl border border-border/50 p-12 text-center">
          <FileText className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
          <p className="text-sm text-muted">
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
                className="neu-raised rounded-2xl border border-border/50 p-4 flex items-center justify-between group hover:border-cba-gold/10 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl neu-inset flex items-center justify-center">
                    <span className="text-[11px] font-black text-cba-gold">
                      {opt.label.split(' ')[0]}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-primary">{opt.label}</p>
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
                              ? 'border-cba-gold/30 text-cba-gold bg-cba-gold/5'
                              : 'border-border text-muted',
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
                        className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-lg text-[10px] font-bold text-muted hover:text-cba-gold transition-all"
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
                        className="text-[9px] font-black uppercase tracking-wider border border-border text-zinc-600"
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
                        className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-lg text-[10px] font-bold text-muted hover:text-cba-gold transition-all"
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
