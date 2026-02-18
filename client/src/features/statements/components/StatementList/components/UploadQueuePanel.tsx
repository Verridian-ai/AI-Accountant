import type { RefObject } from 'react';
import { Ban } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getUploadStatusIcon, getUploadStatusColor, getUploadStatusLabel } from '../helpers.js';
import type { UploadQueueItem } from '../types.js';

interface QueueStats {
  total: number;
  complete: number;
  duplicate: number;
  failed: number;
}

interface UploadQueuePanelProps {
  uploadQueue: UploadQueueItem[];
  queueStats: QueueStats;
  isUploading: boolean;
  batchJobId: string | null;
  progressBarRef: RefObject<HTMLDivElement>;
  onCancel: () => void;
  onClear: () => void;
}

export function UploadQueuePanel({
  uploadQueue,
  queueStats,
  isUploading,
  batchJobId,
  progressBarRef,
  onCancel,
  onClear,
}: UploadQueuePanelProps) {
  return (
    <div className="border-b border-white/5 p-6 bg-white/[0.01]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">
            Quantum Queue ({queueStats.complete + queueStats.duplicate}/{queueStats.total})
          </span>
          {queueStats.failed > 0 && (
            <span className="text-[9px] font-black text-red-400 uppercase tracking-widest">
              {queueStats.failed} failed
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isUploading && batchJobId && (
            <button
              type="button"
              onClick={onCancel}
              className="text-[9px] font-black uppercase text-zinc-600 hover:text-red-400 transition-colors tracking-widest flex items-center gap-1"
            >
              <Ban className="h-3 w-3" /> Cancel
            </button>
          )}
          {!isUploading && (
            <button
              type="button"
              onClick={onClear}
              className="text-[9px] font-black uppercase text-zinc-600 hover:text-red-400 transition-colors tracking-widest"
            >
              Purge
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-3 neu-inset rounded-full overflow-hidden mb-4 p-0.5 border border-white/5">
        <div
          ref={progressBarRef}
          className="progress-bar h-full cba-gold-gradient rounded-full transition-all duration-700 ease-out shadow-[0_0_15px_rgba(255,204,0,0.3)]"
        />
      </div>

      {/* Queue Items */}
      <div className="max-h-[200px] overflow-y-auto space-y-2 scrollbar-thin">
        {uploadQueue.map((item) => (
          <div
            key={item.id}
            className="flex flex-col gap-1.5 p-3 rounded-xl neu-inset bg-white/[0.01]"
          >
            <div className="flex items-center gap-3">
              <div className="shrink-0">{getUploadStatusIcon(item.status)}</div>
              <span className="flex-1 truncate text-[11px] font-bold text-zinc-300">
                {item.file.name}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={cn(
                    'px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest',
                    getUploadStatusColor(item.status),
                  )}
                >
                  {getUploadStatusLabel(item.status)}
                </span>
              </div>
            </div>
            {item.status === 'duplicate' && item.duplicateOf && (
              <div className="ml-7 text-[9px] font-bold text-amber-500/70 italic">
                Collision: Already indexed as "{item.duplicateOf.filename}"
              </div>
            )}
            {item.status === 'failed' && item.error && (
              <div className="ml-7 text-[9px] font-bold text-red-400/70 italic">{item.error}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
