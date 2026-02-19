import { AlertTriangle, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ErrorRecovery } from './ErrorRecovery';
import type { Statement } from '@/api';

interface ErrorDisplayProps {
  statement: Statement;
  isExpanded: boolean;
  isRetrying: boolean;
  onToggleExpand: () => void;
  onRetry: (e: React.MouseEvent) => void;
  onManualFix?: (e: React.MouseEvent) => void;
  onContactSupport?: (e: React.MouseEvent) => void;
}

export function ErrorDisplay({
  statement,
  isExpanded,
  isRetrying,
  onRetry,
  onManualFix,
  onContactSupport,
}: ErrorDisplayProps) {
  // Handlers for wrapping the generic actions to stop propagation if needed,
  // although ErrorRecovery buttons are usually direct actions.
  const handleRetry = () => onRetry({ stopPropagation: () => {} } as React.MouseEvent);

  return (
    <div
      className={cn(
        'mt-5 space-y-4 overflow-hidden transition-all duration-500',
        isExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0',
      )}
    >
      <div className="p-5 rounded-2xl neu-inset border border-red-500/10 space-y-4 bg-red-500/2">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="p-2 neu-raised-sm rounded-lg text-red-400 shrink-0">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="space-y-1.5 flex-1">
            <p className="text-[10px] font-black text-red-400 uppercase tracking-[0.2em] text-left">
              {statement.errorType?.replace(/_/g, ' ') || 'PARSING ERROR'}
            </p>
            <p className="text-xs text-secondary leading-relaxed text-left font-bold italic">
              "{statement.errorMessage}"
            </p>
            {statement.errorDetails && (
              <div className="mt-2 p-3 rounded-lg bg-overlay border border-border/50 font-mono text-[10px] text-muted break-all">
                {statement.errorDetails}
              </div>
            )}
          </div>
        </div>

        {/* Recovery Actions */}
        <div className="pt-4 border-t border-border/50 text-left">
          <ErrorRecovery
            errorType={statement.errorType}
            onRetry={handleRetry}
            onManualFix={
              onManualFix
                ? () => onManualFix({ stopPropagation: () => {} } as React.MouseEvent)
                : undefined
            }
            onContactSupport={
              onContactSupport
                ? () => onContactSupport({ stopPropagation: () => {} } as React.MouseEvent)
                : undefined
            }
            isRetrying={isRetrying}
          />
        </div>
      </div>

      <div className="flex items-center justify-between px-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation(); /* Logic for archive access if needed */
          }}
          className="text-[9px] font-black text-cba-gold hover:brightness-125 flex items-center gap-2 uppercase tracking-[0.2em] btn-press"
        >
          Access Raw Logs <ChevronRight className="h-3 w-3" />
        </button>
        <span className="text-[8px] text-zinc-700 font-mono font-black tracking-widest bg-white/2 px-2 py-0.5 rounded border border-border/50">
          NODE_ID: {statement.id.slice(0, 8).toUpperCase()}
        </span>
      </div>
    </div>
  );
}
