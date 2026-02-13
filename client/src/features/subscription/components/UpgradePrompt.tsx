import { useState } from 'react';
import { AlertTriangle, ArrowRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UpgradePromptProps {
  metric: string;
  current: number;
  limit: number;
  currentPlan: string;
  onUpgrade?: () => void;
  onDismiss?: () => void;
}

const NEXT_PLAN: Record<string, { name: string; limit: string }> = {
  starter: { name: 'Professional', limit: 'higher limits' },
  professional: { name: 'Business', limit: '10x more capacity' },
  business: { name: 'Enterprise', limit: 'unlimited usage' },
};

export function UpgradePrompt({ metric, current, limit, currentPlan, onUpgrade, onDismiss }: UpgradePromptProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const percent = limit > 0 ? Math.round((current / limit) * 100) : 0;
  const isOver = percent >= 100;
  const next = NEXT_PLAN[currentPlan];

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div className={cn(
      'neu-raised rounded-2xl border p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300',
      isOver ? 'border-red-500/30' : 'border-[#FFCC00]/20'
    )}>
      <AlertTriangle className={cn('w-5 h-5 shrink-0 mt-0.5', isOver ? 'text-red-400' : 'text-[#FFCC00]')} />
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-bold', isOver ? 'text-red-400' : 'text-[#FFCC00]')}>
          {isOver
            ? `${metric} limit reached`
            : `Approaching ${metric.toLowerCase()} limit`}
        </p>
        <p className="text-xs text-zinc-400 mt-0.5">
          You've used {current.toLocaleString()} of {limit.toLocaleString()} {metric.toLowerCase()} on the {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)} plan.
          {next && ` Upgrade to ${next.name} for ${next.limit}.`}
        </p>
        {next && onUpgrade && (
          <button
            type="button"
            onClick={onUpgrade}
            className="flex items-center gap-1.5 mt-2 text-xs font-bold text-[#FFCC00] hover:text-[#FFD633] transition-colors"
          >
            Upgrade to {next.name} <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        className="p-1 rounded-lg text-zinc-500 hover:text-zinc-300 transition-colors shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
