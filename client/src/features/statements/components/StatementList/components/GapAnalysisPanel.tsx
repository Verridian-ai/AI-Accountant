import type { StatementGapAnalysis } from '@/api';
import {
  AlertTriangle,
  Calendar,
  Layers,
  DollarSign,
  TrendingDown,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface GapAnalysisPanelProps {
  gapAnalysis: StatementGapAnalysis;
  showGapDetails: boolean;
  onToggle: () => void;
}

export function GapAnalysisPanel({ gapAnalysis, showGapDetails, onToggle }: GapAnalysisPanelProps) {
  return (
    <div className="border-b border-border/50 p-4 bg-amber-500/5">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between group"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-left">
            <span className="text-[10px] font-black text-amber-400 uppercase tracking-[0.15em]">
              Statement Coverage Issues Detected
            </span>
            <div className="flex items-center gap-3 mt-1">
              {gapAnalysis.coverage.totalGaps > 0 && (
                <span className="text-[9px] font-bold text-muted">
                  <Calendar className="h-3 w-3 inline mr-1" />
                  {gapAnalysis.coverage.totalGaps} gap
                  {gapAnalysis.coverage.totalGaps !== 1 ? 's' : ''}
                </span>
              )}
              {gapAnalysis.coverage.totalOverlaps > 0 && (
                <span className="text-[9px] font-bold text-muted">
                  <Layers className="h-3 w-3 inline mr-1" />
                  {gapAnalysis.coverage.totalOverlaps} overlap
                  {gapAnalysis.coverage.totalOverlaps !== 1 ? 's' : ''}
                </span>
              )}
              {gapAnalysis.coverage.totalBalanceMismatches > 0 && (
                <span className="text-[9px] font-bold text-muted">
                  <DollarSign className="h-3 w-3 inline mr-1" />
                  {gapAnalysis.coverage.totalBalanceMismatches} balance mismatch
                  {gapAnalysis.coverage.totalBalanceMismatches !== 1 ? 'es' : ''}
                </span>
              )}
            </div>
          </div>
        </div>
        <ChevronRight
          className={cn(
            'h-4 w-4 text-zinc-600 transition-transform',
            showGapDetails && 'rotate-90',
          )}
        />
      </button>

      {showGapDetails && (
        <div className="mt-4 space-y-3 max-h-[200px] overflow-y-auto scrollbar-thin">
          {gapAnalysis.gaps.map((gap, i) => (
            <div
              key={`gap-${i}`}
              className="p-3 rounded-xl neu-inset bg-amber-500/5 border border-amber-500/10"
            >
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider">
                  Missing Period: {gap.gapDays} day{gap.gapDays !== 1 ? 's' : ''}
                </span>
              </div>
              <p className="text-[9px] text-muted font-bold">
                {gap.gapStart} → {gap.gapEnd}
              </p>
              <p className="text-[8px] text-zinc-600 mt-1">
                Between "{gap.beforeStatement}" and "{gap.afterStatement}"
              </p>
            </div>
          ))}

          {gapAnalysis.overlaps.map((overlap, i) => (
            <div
              key={`overlap-${i}`}
              className="p-3 rounded-xl neu-inset bg-blue-500/5 border border-blue-500/10"
            >
              <div className="flex items-center gap-2 mb-1">
                <Layers className="h-3.5 w-3.5 text-blue-500" />
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-wider">
                  Overlapping: {overlap.overlapDays} day{overlap.overlapDays !== 1 ? 's' : ''}
                </span>
              </div>
              <p className="text-[9px] text-muted font-bold">
                {overlap.overlapStart} → {overlap.overlapEnd}
              </p>
              <p className="text-[8px] text-zinc-600 mt-1">
                "{overlap.statement1}" overlaps with "{overlap.statement2}"
              </p>
            </div>
          ))}

          {gapAnalysis.balanceMismatches.map((mismatch, i) => (
            <div
              key={`mismatch-${i}`}
              className="p-3 rounded-xl neu-inset bg-red-500/5 border border-red-500/10"
            >
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                <span className="text-[10px] font-black text-red-400 uppercase tracking-wider">
                  Balance Mismatch: ${Math.abs(mismatch.difference / 100).toFixed(2)}
                </span>
              </div>
              <p className="text-[9px] text-muted font-bold">
                Expected: ${(mismatch.expectedBalance / 100).toFixed(2)} → Actual: $
                {(mismatch.actualBalance / 100).toFixed(2)}
              </p>
              <p className="text-[8px] text-zinc-600 mt-1">
                Between "{mismatch.statement1}" and "{mismatch.statement2}"
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
