import { cn } from '@/lib/utils';

interface IntentDebugPanelProps {
  intentClassification?: {
    intent: string;
    confidence: number;
  };
  agentType?: string;
  visible: boolean;
}

export function IntentDebugPanel({
  intentClassification,
  agentType,
  visible,
}: IntentDebugPanelProps) {
  if (!visible || !intentClassification) return null;

  const confidence = intentClassification.confidence;
  const pct = Math.round(confidence * 100);
  const barColor =
    confidence >= 0.8 ? 'bg-emerald-500' : confidence >= 0.6 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="neu-inset rounded-lg px-3 py-2 mt-2 space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[8px] font-black text-muted uppercase tracking-widest">
          Intent Debug
        </span>
        <span className="text-[8px] font-bold text-zinc-600 uppercase">
          {intentClassification.intent}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[8px] font-bold text-muted w-16 shrink-0">Confidence</span>
        <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', barColor)}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[8px] font-black text-secondary w-8 text-right">{pct}%</span>
      </div>
      {agentType && (
        <div className="flex items-center justify-between">
          <span className="text-[8px] font-bold text-muted">Agent</span>
          <span className="text-[8px] font-bold text-cba-gold/70">{agentType}</span>
        </div>
      )}
    </div>
  );
}
