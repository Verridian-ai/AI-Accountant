import { RefreshCw, Wrench, LifeBuoy, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface ErrorRecoveryProps {
  errorType:
    | 'PDF_READ_ERROR'
    | 'AI_PARSE_ERROR'
    | 'EMPTY_STATEMENT'
    | 'CRITICAL_ERROR'
    | null
    | undefined;
  onRetry?: () => void;
  onManualFix?: () => void;
  onContactSupport?: () => void;
  isRetrying?: boolean;
}

export function ErrorRecovery({
  errorType,
  onRetry,
  onManualFix,
  onContactSupport,
  isRetrying,
}: ErrorRecoveryProps) {
  const getRecoveryOptions = () => {
    switch (errorType) {
      case 'PDF_READ_ERROR':
        return {
          title: 'File Integrity Issue',
          description:
            'The PDF could not be read clearly. It might be password protected, corrupted, or an image scan.',
          tips: [
            'Ensure the PDF is not password protected',
            "Try 'Print to PDF' to flatten the file",
            "If it's a scan, ensure high resolution (300dpi+)",
          ],
        };
      case 'AI_PARSE_ERROR':
        return {
          title: 'Structure Recognition Failed',
          description: "The AI couldn't map this statement to the CBA Standard Format.",
          tips: [
            "Ensure this is a 'Smart Access' or 'Transaction' statement",
            'Check if the layout has drastically changed',
            "Try uploading the 'CSV' export instead if available",
          ],
        };
      case 'EMPTY_STATEMENT':
        return {
          title: 'No Data Extraction',
          description: 'We parsed the file but found no transaction rows.',
          tips: [
            'This might be a summary page only',
            'Check if the transactions are on a separate page',
            "Ensure the file isn't blank",
          ],
        };
      default:
        return {
          title: 'System Processing Error',
          description: 'An unexpected error occurred during the parsing pipeline.',
          tips: [
            'Check your internet connection',
            'The server might be experiencing high load',
            'Try again in a few minutes',
          ],
        };
    }
  };

  const options = getRecoveryOptions();

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl bg-zinc-950/50 border border-white/5 space-y-3">
        <div className="flex items-center gap-2 text-zinc-300">
          <Wrench className="h-4 w-4 text-[#FFCC00]" />
          <span className="text-xs font-black uppercase tracking-wider">Recovery Protocol</span>
        </div>

        <div className="grid gap-2">
          {options.tips.map((tip, idx) => (
            <div key={idx} className="flex items-start gap-2 text-[11px] text-zinc-400">
              <span className="mt-1 w-1 h-1 rounded-full bg-zinc-600 shrink-0" />
              <span>{tip}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {onRetry && (
          <Button
            onClick={onRetry}
            disabled={isRetrying}
            className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20"
          >
            <RefreshCw className={cn('mr-2 h-4 w-4', isRetrying && 'animate-spin')} />
            {isRetrying ? 'Retrying...' : 'Retry Processing'}
          </Button>
        )}

        {(errorType === 'AI_PARSE_ERROR' || errorType === 'EMPTY_STATEMENT') && onManualFix && (
          <Button
            variant="ghost"
            onClick={onManualFix}
            className="hover:bg-amber-500/10 hover:text-amber-400 border border-transparent hover:border-amber-500/20"
          >
            <FileText className="mr-2 h-4 w-4" />
            Manual Entry
          </Button>
        )}

        {onContactSupport && (
          <Button
            variant="ghost"
            onClick={onContactSupport}
            className="ml-auto text-zinc-500 hover:text-zinc-300"
          >
            <LifeBuoy className="mr-2 h-4 w-4" />
            Support
          </Button>
        )}
      </div>
    </div>
  );
}
