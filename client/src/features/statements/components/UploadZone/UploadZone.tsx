import { Upload, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ACCEPTED_EXTENSIONS } from './helpers.js';
import { useUploadZone } from './hooks/useUploadZone.js';
import { FileProgressCard } from './components/FileProgressCard.js';
import { BatchSummaryBar } from './components/BatchSummaryBar.js';
import type { UploadZoneProps } from './types.js';

export function UploadZone({
  onFilesSelected,
  onCancelFile,
  onRetryFile,
  uploadProgress,
  className,
  children,
  accept = ACCEPTED_EXTENSIONS,
  disabled = false,
}: UploadZoneProps) {
  const {
    isDragging,
    files,
    fileInputRef,
    hasFiles,
    showBatchSummary,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileInputChange,
    handleCancel,
    handleRetry,
    clearCompleted,
  } = useUploadZone({ onFilesSelected, onCancelFile, onRetryFile, uploadProgress, disabled });

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn('relative transition-all duration-300', className)}
    >
      {/* Hidden file input for browse button */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={accept}
        multiple
        onChange={handleFileInputChange}
        disabled={disabled}
        aria-label="Browse files to upload"
      />

      {/* ─── Drag Overlay ─────────────────────────────────────────── */}
      {isDragging && (
        <div className="absolute inset-0 z-50 m-2 rounded-[2rem] border-2 border-dashed border-[#FFCC00]/40 bg-black/60 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
          <div className="flex flex-col items-center gap-4 p-8 pointer-events-none">
            <div className="w-24 h-24 bg-[#FFCC00] rounded-3xl flex items-center justify-center shadow-[0_0_30px_rgba(255,204,0,0.3)] animate-bounce">
              <Upload className="h-12 w-12 text-[#0a0a0f]" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-lg font-black uppercase tracking-[0.2em] text-[#FFCC00]">
                Release to Upload
              </p>
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                PDF, CSV, OFX or QIF Statements
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─── Children (existing content) ─────────────────────────── */}
      {children}

      {/* ─── Browse Files Button (shown when no children or alongside) */}
      {!children && !hasFiles && (
        <div className="flex flex-col items-center justify-center py-12 px-6">
          <div className="relative mb-6">
            <div className="w-20 h-20 neu-inset rounded-[1.5rem] flex items-center justify-center border border-white/5">
              <Upload className="h-8 w-8 text-zinc-600" />
            </div>
          </div>
          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-4">
            Drop files here or browse
          </p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className={cn(
              'flex items-center gap-2 px-5 py-2.5 rounded-xl',
              'text-[10px] font-black uppercase tracking-[0.2em]',
              'bg-[#FFCC00]/10 text-[#FFCC00] border border-[#FFCC00]/20',
              'hover:bg-[#FFCC00]/20 hover:border-[#FFCC00]/40',
              'btn-press transition-all',
              disabled && 'opacity-50 cursor-not-allowed',
            )}
          >
            <FolderOpen className="h-3.5 w-3.5" />
            Browse Files
          </button>
          <div className="flex items-center gap-2 mt-4 opacity-50">
            {['PDF', 'CSV', 'OFX', 'QIF'].map((ext) => (
              <span
                key={ext}
                className="px-2 py-0.5 rounded bg-white/5 border border-white/5 text-[8px] font-bold text-zinc-500 uppercase tracking-wider"
              >
                {ext}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ─── Browse button when children are present but no files uploading */}
      {children && !hasFiles && (
        <div className="flex justify-center py-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl',
              'text-[9px] font-black uppercase tracking-[0.2em]',
              'bg-white/[0.02] text-zinc-500 border border-white/5',
              'hover:bg-[#FFCC00]/10 hover:text-[#FFCC00] hover:border-[#FFCC00]/20',
              'btn-press transition-all',
              disabled && 'opacity-50 cursor-not-allowed',
            )}
          >
            <FolderOpen className="h-3 w-3" />
            Browse Files
          </button>
        </div>
      )}

      {/* ─── Batch Progress Section ──────────────────────────────── */}
      {hasFiles && (
        <div className="mt-4 space-y-3">
          {/* Batch summary (only for multiple files) */}
          {showBatchSummary && (
            <div className="p-3 rounded-xl neu-raised-sm border border-white/5">
              <BatchSummaryBar files={files} onClearCompleted={clearCompleted} />
            </div>
          )}

          {/* Per-file cards */}
          <div className="space-y-2 max-h-[280px] overflow-y-auto scrollbar-thin pr-1">
            {files.map((fileState) => (
              <FileProgressCard
                key={fileState.id}
                fileState={fileState}
                onCancel={handleCancel}
                onRetry={onRetryFile ? handleRetry : undefined}
              />
            ))}
          </div>

          {/* Single file: inline clear button */}
          {!showBatchSummary &&
            files.length === 1 &&
            (files[0]?.status === 'completed' || files[0]?.status === 'error') && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={clearCompleted}
                  className="text-[9px] font-black uppercase text-zinc-600 hover:text-red-400 transition-colors tracking-widest"
                >
                  Clear
                </button>
              </div>
            )}

          {/* Add more files button when batch is in progress */}
          <div className="flex justify-center pt-1">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                'text-[8px] font-black uppercase tracking-[0.2em]',
                'text-zinc-600 bg-white/[0.02] border border-white/5',
                'hover:text-[#FFCC00] hover:bg-[#FFCC00]/5 hover:border-[#FFCC00]/20',
                'transition-all',
                disabled && 'opacity-50 cursor-not-allowed',
              )}
            >
              <Upload className="h-2.5 w-2.5" />
              Add More Files
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
