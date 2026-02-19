import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { FileUploadState } from '../types.js';

interface BatchSummaryBarProps {
  files: FileUploadState[];
  onClearCompleted?: () => void;
}

export function BatchSummaryBar({ files, onClearCompleted }: BatchSummaryBarProps) {
  const stats = useMemo(() => {
    const pending = files.filter((f) => f.status === 'pending').length;
    const uploading = files.filter((f) => f.status === 'uploading').length;
    const parsing = files.filter((f) => f.status === 'parsing').length;
    const completed = files.filter((f) => f.status === 'completed').length;
    const errored = files.filter((f) => f.status === 'error').length;
    const active = uploading + parsing;
    const done = completed + errored;
    const total = files.length;
    const overallProgress =
      total > 0 ? Math.round(files.reduce((sum, f) => sum + f.progress, 0) / total) : 0;
    return {
      pending,
      uploading,
      parsing,
      completed,
      errored,
      active,
      done,
      total,
      overallProgress,
    };
  }, [files]);

  const isProcessing = stats.active > 0 || stats.pending > 0;
  const allDone = stats.done === stats.total && stats.total > 0;

  return (
    <div className="space-y-3">
      {/* Header line */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">
          {isProcessing ? (
            <>
              Processing <span className="text-cba-gold">{stats.completed + 1}</span> of{' '}
              <span className="text-primary">{stats.total}</span> files
            </>
          ) : allDone ? (
            <>
              <span className="text-emerald-400">{stats.completed}</span> file
              {stats.completed !== 1 ? 's' : ''} processed
              {stats.errored > 0 && (
                <>
                  , <span className="text-red-400">{stats.errored}</span> error
                  {stats.errored !== 1 ? 's' : ''}
                </>
              )}
            </>
          ) : (
            <>
              <span className="text-primary">{stats.total}</span> file
              {stats.total !== 1 ? 's' : ''} queued
            </>
          )}
        </span>
        {allDone && onClearCompleted && (
          <button
            type="button"
            onClick={onClearCompleted}
            className="text-[9px] font-black uppercase text-zinc-600 hover:text-red-400 transition-colors tracking-widest"
          >
            Clear
          </button>
        )}
      </div>

      {/* Overall progress bar */}
      <div className="w-full h-2 rounded-full bg-overlay-hover overflow-hidden border border-border/50">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-700 ease-out',
            allDone && stats.errored === 0
              ? 'bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-[0_0_10px_rgba(34,197,94,0.3)]'
              : allDone && stats.errored > 0
                ? 'bg-gradient-to-r from-amber-600 to-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                : 'bg-gradient-to-r from-[#E6B800] via-[#FFCC00] to-[#FFE066] shadow-[0_0_10px_rgba(255,204,0,0.3)]',
          )}
          style={{ width: `${stats.overallProgress}%` }}
        />
      </div>
    </div>
  );
}
