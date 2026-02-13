import { useState } from 'react';
import { Check, X, AlertTriangle, Clock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConfirmationCardProps {
  mutationId: string;
  agentType: string;
  description: string;
  targetTable: string;
  beforeState?: Record<string, unknown>;
  afterState: Record<string, unknown>;
  confidence?: number;
  status?: 'pending' | 'expired';
  onConfirm: (mutationId: string) => void;
  onReject: (mutationId: string, reason?: string) => void;
}

/**
 * Before/after diff preview for agent-proposed mutations with Approve/Reject buttons.
 * Shows a two-column comparison of changed fields with confidence indicator.
 */
export function ConfirmationCard({
  mutationId,
  agentType,
  description,
  targetTable,
  beforeState,
  afterState,
  confidence,
  status,
  onConfirm,
  onReject,
}: ConfirmationCardProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showRejectReason, setShowRejectReason] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const isExpired = status === 'expired';

  const handleConfirm = () => {
    setIsProcessing(true);
    onConfirm(mutationId);
  };

  const handleReject = () => {
    if (!showRejectReason) {
      setShowRejectReason(true);
      return;
    }
    setIsProcessing(true);
    onReject(mutationId, rejectReason || undefined);
  };

  // Compute changed fields by comparing before and after state
  const changedFields = Object.keys(afterState).filter((key) => {
    if (!beforeState) return true;
    return JSON.stringify(beforeState[key]) !== JSON.stringify(afterState[key]);
  });

  const allFields = beforeState
    ? [...new Set([...Object.keys(beforeState), ...Object.keys(afterState)])]
    : Object.keys(afterState);

  // Confidence bar color
  const confidencePct = confidence != null ? Math.round(confidence * 100) : null;
  const confidenceColor =
    confidence != null
      ? confidence >= 0.8
        ? 'bg-emerald-500'
        : confidence >= 0.6
          ? 'bg-yellow-500'
          : 'bg-red-500'
      : '';

  return (
    <div
      className={cn(
        'neu-raised rounded-2xl p-4 border space-y-3',
        isExpired ? 'border-zinc-700 opacity-60' : 'border-[#FFCC00]/20',
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle className="h-3 w-3 text-[#FFCC00] shrink-0" />
            <span className="text-[8px] font-black uppercase tracking-widest text-[#FFCC00]/70">
              {agentType.replace(/_/g, ' ')}
            </span>
          </div>
          <p className="text-xs font-bold text-zinc-200 leading-snug">{description}</p>
          <span className="text-[7px] font-bold text-zinc-600 uppercase tracking-wider">
            {targetTable}
          </span>
        </div>
        {isExpired && (
          <div className="flex items-center gap-1 neu-inset px-2 py-1 rounded-lg shrink-0">
            <Clock className="h-2.5 w-2.5 text-zinc-500" />
            <span className="text-[7px] font-black text-zinc-500 uppercase">Expired</span>
          </div>
        )}
      </div>

      {/* Confidence bar */}
      {confidencePct != null && (
        <div className="flex items-center gap-2">
          <span className="text-[7px] font-bold text-zinc-500 uppercase w-14 shrink-0">
            Confidence
          </span>
          <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', confidenceColor)}
              style={{ width: `${confidencePct}%` }}
            />
          </div>
          <span className="text-[8px] font-black text-zinc-400 w-8 text-right">
            {confidencePct}%
          </span>
        </div>
      )}

      {/* Before / After diff */}
      <div className="grid grid-cols-2 gap-2 text-[9px]">
        {beforeState && (
          <div className="text-[7px] font-black text-zinc-500 uppercase tracking-wider pb-0.5 border-b border-zinc-800">
            Before
          </div>
        )}
        <div
          className={cn(
            'text-[7px] font-black text-zinc-500 uppercase tracking-wider pb-0.5 border-b border-zinc-800',
            !beforeState && 'col-span-2',
          )}
        >
          {beforeState ? 'After' : 'Proposed Changes'}
        </div>

        {allFields.map((key) => {
          const isChanged = changedFields.includes(key);
          const beforeVal = beforeState?.[key];
          const afterVal = afterState[key];

          return beforeState ? (
            <div key={key} className="contents">
              <div className={cn('px-1.5 py-0.5 rounded', isChanged ? 'bg-red-500/10' : '')}>
                <span className="text-zinc-500 font-bold">{key}: </span>
                <span
                  className={cn('font-medium', isChanged ? 'text-red-400/80' : 'text-zinc-400')}
                >
                  {formatValue(beforeVal)}
                </span>
              </div>
              <div className={cn('px-1.5 py-0.5 rounded', isChanged ? 'bg-emerald-500/10' : '')}>
                <span className="text-zinc-500 font-bold">{key}: </span>
                <span
                  className={cn('font-medium', isChanged ? 'text-emerald-400' : 'text-zinc-400')}
                >
                  {formatValue(afterVal)}
                </span>
              </div>
            </div>
          ) : (
            <div key={key} className="col-span-2 px-1.5 py-0.5 rounded bg-emerald-500/10">
              <span className="text-zinc-500 font-bold">{key}: </span>
              <span className="text-emerald-400 font-medium">{formatValue(afterVal)}</span>
            </div>
          );
        })}
      </div>

      {/* Reject reason input */}
      {showRejectReason && !isExpired && (
        <input
          className="w-full neu-inset rounded-lg px-3 py-2 text-[10px] text-zinc-300 placeholder-zinc-700 font-bold bg-transparent outline-none focus-gold"
          placeholder="Reason for rejection (optional)..."
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleReject();
          }}
        />
      )}

      {/* Action buttons */}
      {!isExpired && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isProcessing}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all btn-press cba-gold-gradient text-[#0a0a0f] disabled:opacity-30 shadow-lg"
          >
            {isProcessing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Check className="h-3 w-3" />
            )}
            Approve
          </button>
          <button
            type="button"
            onClick={handleReject}
            disabled={isProcessing}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all btn-press neu-raised text-red-400 hover:text-red-300 border border-red-500/20 disabled:opacity-30"
          >
            {isProcessing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <X className="h-3 w-3" />
            )}
            Reject
          </button>
        </div>
      )}
    </div>
  );
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}
