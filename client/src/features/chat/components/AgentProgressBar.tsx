import { Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AgentProgressBarProps {
  step: number;
  total: number;
  description: string;
  agentType?: string;
  isComplete: boolean;
}

/**
 * Real-time agent execution progress bar.
 * Shows step/total with gold fill, description text, and a spinner or checkmark.
 */
export function AgentProgressBar({ step, total, description, agentType, isComplete }: AgentProgressBarProps) {
  const pct = total > 0 ? Math.round((step / total) * 100) : 0;

  return (
    <div className="neu-raised rounded-xl px-3 py-2.5 border border-white/5 space-y-1.5">
      {/* Agent badge + step counter */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {isComplete ? (
            <Check className="h-3 w-3 text-emerald-400" />
          ) : (
            <Loader2 className="h-3 w-3 text-[#FFCC00] animate-spin" />
          )}
          {agentType && (
            <span className="text-[7px] font-black uppercase tracking-widest text-[#FFCC00]/70">
              {agentType.replace(/_/g, ' ')}
            </span>
          )}
        </div>
        <span className="text-[8px] font-black text-zinc-500">
          {step}/{total}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300 ease-out',
            isComplete ? 'bg-emerald-500' : 'bg-[#FFCC00]'
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Description */}
      <p className="text-[8px] font-bold text-zinc-500 leading-snug truncate">{description}</p>
    </div>
  );
}
