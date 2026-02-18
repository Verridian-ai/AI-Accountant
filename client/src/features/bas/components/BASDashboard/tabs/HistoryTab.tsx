import { History, FileText, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { BASQuarter } from '@/types/tax';

interface HistoryTabProps {
  history: BASQuarter[];
  setSelectedQuarter: (q: string) => void;
  setActiveTab: (tab: 'calculate' | 'breakdown' | 'history') => void;
  onCalculate: () => void;
}

export function HistoryTab({
  history,
  setSelectedQuarter,
  setActiveTab,
  onCalculate,
}: HistoryTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <History className="w-4 h-4 text-[#FFCC00]" />
        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">
          BAS History
        </span>
      </div>

      {history.length === 0 ? (
        <div className="neu-raised rounded-2xl border border-white/5 p-12 text-center">
          <FileText className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
          <p className="text-sm text-zinc-500">
            No BAS history found. Calculate your first BAS to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((item) => (
            <div
              key={item.id}
              className="neu-raised rounded-2xl border border-white/5 p-4 flex items-center justify-between group hover:border-[#FFCC00]/10 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl neu-inset flex items-center justify-center">
                  <span className="text-[11px] font-black text-[#FFCC00]">Q{item.quarter}</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-zinc-200">
                    Q{item.quarter} {item.year}-{(item.year + 1).toString().slice(2)}
                  </p>
                  <p className="text-[10px] text-zinc-600">
                    {item.startDate} - {item.endDate}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[9px] font-black uppercase tracking-wider border',
                    item.status === 'lodged'
                      ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5'
                      : item.status === 'draft'
                        ? 'border-[#FFCC00]/30 text-[#FFCC00] bg-[#FFCC00]/5'
                        : 'border-white/10 text-zinc-500',
                  )}
                >
                  {item.status}
                </Badge>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedQuarter(`${item.year}-Q${item.quarter}`);
                    setActiveTab('calculate');
                    onCalculate();
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-lg text-[10px] font-bold text-zinc-500 hover:text-[#FFCC00] transition-all"
                >
                  <FileText className="w-3.5 h-3.5" />
                  View
                  <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
