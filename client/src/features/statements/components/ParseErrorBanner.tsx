import { AlertCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ParseErrorBannerProps {
    failedCount: number;
    totalCount: number;
    onClear: () => void;
    className?: string;
}

export function ParseErrorBanner({ failedCount, totalCount, onClear, className }: ParseErrorBannerProps) {
    if (failedCount === 0) return null;

    return (
        <div className={cn(
            "mb-6 p-4 rounded-2xl neu-inset bg-red-500/5 border border-red-500/10 flex items-start gap-4 animate-in fade-in slide-in-from-top-2",
            className
        )} role="alert">
            <div className="p-2 neu-raised-sm rounded-lg text-red-400 shrink-0">
                <AlertCircle className="h-5 w-5" />
            </div>

            <div className="flex-1 min-w-0 pt-1">
                <h4 className="text-xs font-black text-red-400 uppercase tracking-[0.2em] mb-1">
                    Processing Incomplete
                </h4>
                <p className="text-[11px] text-zinc-400 font-medium">
                    {failedCount} of {totalCount} statements failed to parse correctly. Check the list below for specific error details and recovery options.
                </p>
            </div>

            <button
                onClick={onClear}
                className="p-2 text-zinc-500 hover:text-zinc-300 transition-colors"
                aria-label="Dismiss alert"
            >
                <X className="h-4 w-4" />
            </button>
        </div>
    );
}
