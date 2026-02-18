import { X, RotateCcw, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getFileIcon, formatFileSize } from '../helpers.js';
import { StatusBadge } from './StatusBadge.js';
import { BankBadge } from './BankBadge.js';
import type { FileUploadState } from '../types.js';

interface FileProgressCardProps {
  fileState: FileUploadState;
  onCancel?: (id: string) => void;
  onRetry?: (id: string, file: File) => void;
}

export function FileProgressCard({ fileState, onCancel, onRetry }: FileProgressCardProps) {
  const isActive = fileState.status === 'uploading' || fileState.status === 'parsing';
  const isDone = fileState.status === 'completed';
  const isError = fileState.status === 'error';

  return (
    <div
      className={cn(
        'p-3 rounded-xl neu-inset border transition-all duration-300',
        isDone && 'border-emerald-500/10 bg-emerald-500/[0.02]',
        isError && 'border-red-500/10 bg-red-500/[0.02]',
        isActive && 'border-[#FFCC00]/10 bg-[#FFCC00]/[0.01]',
        !isDone && !isError && !isActive && 'border-white/5 bg-white/[0.01]',
      )}
    >
      {/* Row 1: File info + actions */}
      <div className="flex items-center gap-3">
        <div className="shrink-0 w-8 h-8 neu-raised-sm rounded-lg flex items-center justify-center">
          {getFileIcon(fileState.file.name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold text-zinc-300 truncate">{fileState.file.name}</p>
          <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest mt-0.5">
            {formatFileSize(fileState.file.size)}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isError && onRetry && (
            <button
              type="button"
              onClick={() => onRetry(fileState.id, fileState.file)}
              className="w-6 h-6 flex items-center justify-center rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
              title="Retry upload"
              aria-label={`Retry ${fileState.file.name}`}
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          )}
          {!isDone && onCancel && (
            <button
              type="button"
              onClick={() => onCancel(fileState.id)}
              className="w-6 h-6 flex items-center justify-center rounded-lg bg-white/5 hover:bg-red-500/20 text-zinc-600 hover:text-red-400 transition-colors"
              title="Cancel upload"
              aria-label={`Cancel ${fileState.file.name}`}
            >
              <X className="h-3 w-3" />
            </button>
          )}
          {isDone && (
            <div className="w-6 h-6 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Badges */}
      <div className="flex items-center gap-2 mt-2 ml-11">
        {fileState.bankDetected && <BankBadge bank={fileState.bankDetected} />}
        <StatusBadge status={fileState.status} />
      </div>

      {/* Row 3: Progress bar */}
      {(isActive || fileState.status === 'pending') && (
        <div className="mt-2.5 ml-11">
          <div className="w-full h-1.5 rounded-full bg-black/40 overflow-hidden border border-white/5">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500 ease-out',
                fileState.status === 'pending'
                  ? 'bg-zinc-700'
                  : 'bg-gradient-to-r from-[#E6B800] via-[#FFCC00] to-[#FFE066] shadow-[0_0_8px_rgba(255,204,0,0.3)]',
              )}
              style={{ width: `${fileState.progress}%` }}
            />
          </div>
          {isActive && (
            <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest mt-1 text-right">
              {fileState.progress}%
            </p>
          )}
        </div>
      )}

      {/* Error message */}
      {isError && fileState.error && (
        <div className="mt-2 ml-11 p-2 rounded-lg bg-red-500/5 border border-red-500/10">
          <p className="text-[9px] font-bold text-red-400/80 italic leading-snug">
            {fileState.error}
          </p>
        </div>
      )}
    </div>
  );
}
