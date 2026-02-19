import type { MouseEvent } from 'react';
import type { Statement } from '@/api';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  HelpCircle,
  Clock,
  Activity,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getStatusIcon, getActionableSuggestion } from '../helpers.js';

interface StatementCardProps {
  stmt: Statement;
  expandedErrorId: string | null;
  onToggleError: (id: string | null) => void;
  retryingIds: Set<string>;
  onRetry: (id: string, e: MouseEvent<HTMLButtonElement>) => void;
}

export function StatementCard({
  stmt,
  expandedErrorId,
  onToggleError,
  retryingIds,
  onRetry,
}: StatementCardProps) {
  return (
    <div
      onClick={() =>
        stmt.parsingStatus === 'FAILED' &&
        onToggleError(expandedErrorId === stmt.id ? null : stmt.id)
      }
      className={cn(
        'group p-5 transition-all neu-raised-sm rounded-3xl border border-border/50 hover:neu-float hover:border-border',
        stmt.parsingStatus === 'FAILED'
          ? 'border-l-red-500/50 cursor-pointer'
          : 'hover:border-cba-gold/20',
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <div className="mt-1 w-10 h-10 neu-inset rounded-2xl flex items-center justify-center shrink-0">
            {getStatusIcon(stmt.parsingStatus)}
          </div>
          <div className="min-w-0 text-left">
            <p className="font-black text-[13px] text-zinc-100 truncate pr-2 group-hover:text-cba-gold transition-colors tracking-tight">
              {stmt.filename}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-2.5">
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-overlay border border-border/50">
                <Clock className="w-2.5 h-2.5 text-zinc-600" />
                <span className="text-[8px] font-black text-muted uppercase tracking-widest">
                  {new Date(stmt.uploadDate).toLocaleDateString()}
                </span>
              </div>
              {stmt.aiModelUsed && (
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-cba-gold/5 text-cba-gold rounded-lg border border-cba-gold/20 uppercase font-black tracking-widest shadow-[0_0_15px_rgba(255,204,0,0.05)]">
                  <Activity className="w-2.5 h-2.5" />
                  <span className="text-[8px]">{stmt.aiModelUsed.split('/').pop()}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="flex items-center gap-2">
            {stmt.parsingStatus === 'FAILED' && (
              <button
                type="button"
                onClick={(e) => onRetry(stmt.id, e)}
                disabled={retryingIds.has(stmt.id)}
                className="h-10 w-10 flex items-center justify-center text-red-400 neu-raised-sm hover:glow-danger rounded-xl btn-press border border-red-500/20"
                title="Retry processing"
              >
                <RefreshCw className={cn('h-4 w-4', retryingIds.has(stmt.id) && 'animate-spin')} />
              </button>
            )}
            {stmt.parsingStatus === 'COMPLETED' && (
              <div className="h-8 w-8 flex items-center justify-center rounded-xl neu-inset border border-border/50 shadow-inner">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error Details Section */}
      {stmt.parsingStatus === 'FAILED' && (
        <div
          className={cn(
            'mt-5 space-y-4 overflow-hidden transition-all duration-500',
            expandedErrorId === stmt.id ? 'max-h-[400px] opacity-100' : 'max-h-0 opacity-0',
          )}
        >
          <div className="p-5 rounded-2xl neu-inset border border-red-500/10 space-y-4 bg-red-500/[0.02]">
            <div className="flex items-start gap-4">
              <div className="p-2 neu-raised-sm rounded-lg text-red-400 shrink-0">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div className="space-y-1.5 flex-1">
                <p className="text-[10px] font-black text-red-400 uppercase tracking-[0.2em] text-left">
                  {stmt.errorType?.replace(/_/g, ' ') || 'PARSING ERROR'}
                </p>
                <p className="text-xs text-secondary leading-relaxed text-left font-bold italic">
                  "{stmt.errorMessage}"
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-border/50 text-left">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 neu-raised-sm rounded-xl flex items-center justify-center shrink-0 text-blue-400">
                  <HelpCircle className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-muted uppercase tracking-[0.2em]">
                    Remediation Protocol
                  </p>
                  <p className="text-[11px] text-primary italic font-bold leading-snug">
                    {getActionableSuggestion(stmt.errorType)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between px-2">
            <button
              type="button"
              className="text-[9px] font-black text-cba-gold hover:brightness-125 flex items-center gap-2 uppercase tracking-[0.2em] btn-press"
            >
              Access Archives <ChevronRight className="h-3 w-3" />
            </button>
            <span className="text-[8px] text-zinc-700 font-mono font-black tracking-widest bg-white/[0.02] px-2 py-0.5 rounded border border-border/50">
              NODE_ID: {stmt.id.slice(0, 8).toUpperCase()}
            </span>
          </div>
        </div>
      )}

      {stmt.parsingStatus === 'FAILED' && expandedErrorId !== stmt.id && (
        <div className="mt-4 flex items-center gap-2 text-[9px] font-black text-red-400 uppercase tracking-[0.2em] animate-pulse">
          <AlertCircle className="h-3.5 w-3.5" /> Diagnostic required: Click to expand
        </div>
      )}
    </div>
  );
}
