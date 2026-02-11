import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
    Upload,
    FileText,
    FileSpreadsheet,
    FileCode,
    X,
    RotateCcw,
    CheckCircle2,
    Loader2,
    AlertCircle,
    Clock,
    FolderOpen,
    Landmark,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FileUploadState {
    file: File;
    id: string;
    status: 'pending' | 'uploading' | 'parsing' | 'completed' | 'error';
    progress: number;
    bankDetected?: string;
    error?: string;
    statementId?: string;
}

export interface FileUploadProgress {
    status: string;
    progress: number;
    bankDetected?: string;
    error?: string;
}

interface UploadZoneProps {
    onFilesSelected: (files: File[]) => void;
    onCancelFile?: (fileId: string) => void;
    onRetryFile?: (fileId: string, file: File) => void;
    uploadProgress?: Map<string, FileUploadProgress>;
    className?: string;
    children?: React.ReactNode;
    accept?: string;
    disabled?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ACCEPTED_EXTENSIONS = '.pdf,.csv,.ofx,.qif';

function generateFileId(): string {
    return `file-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getFileExtension(filename: string): string {
    return filename.split('.').pop()?.toLowerCase() || '';
}

function getFileIcon(filename: string) {
    const ext = getFileExtension(filename);
    switch (ext) {
        case 'pdf':
            return <FileText className="h-4 w-4 text-red-400" />;
        case 'csv':
            return <FileSpreadsheet className="h-4 w-4 text-emerald-400" />;
        case 'ofx':
        case 'qif':
            return <FileCode className="h-4 w-4 text-blue-400" />;
        default:
            return <FileText className="h-4 w-4 text-zinc-500" />;
    }
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Status Badge Component ─────────────────────────────────────────────────

function StatusBadge({ status }: { status: FileUploadState['status'] }) {
    const config = {
        pending: {
            label: 'Queued',
            classes: 'bg-zinc-800 text-zinc-500 border-zinc-700',
            icon: <Clock className="h-2.5 w-2.5" />,
        },
        uploading: {
            label: 'Uploading',
            classes: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
            icon: <Loader2 className="h-2.5 w-2.5 animate-spin" />,
        },
        parsing: {
            label: 'Parsing...',
            classes: 'bg-[#FFCC00]/10 text-[#FFCC00] border-[#FFCC00]/20',
            icon: <Loader2 className="h-2.5 w-2.5 animate-spin" />,
        },
        completed: {
            label: 'Complete',
            classes: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
            icon: <CheckCircle2 className="h-2.5 w-2.5" />,
        },
        error: {
            label: 'Error',
            classes: 'bg-red-500/10 text-red-400 border-red-500/20',
            icon: <AlertCircle className="h-2.5 w-2.5" />,
        },
    };

    const c = config[status];

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[8px] font-black uppercase tracking-widest',
                c.classes
            )}
        >
            {c.icon}
            {c.label}
        </span>
    );
}

// ─── Bank Badge Component ───────────────────────────────────────────────────

function BankBadge({ bank }: { bank: string }) {
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-[#FFCC00]/30 bg-[#FFCC00]/5 text-[8px] font-black uppercase tracking-widest text-[#FFCC00]">
            <Landmark className="h-2.5 w-2.5" />
            {bank}
        </span>
    );
}

// ─── Per-File Progress Card ─────────────────────────────────────────────────

function FileProgressCard({
    fileState,
    onCancel,
    onRetry,
}: {
    fileState: FileUploadState;
    onCancel?: (id: string) => void;
    onRetry?: (id: string, file: File) => void;
}) {
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
                !isDone && !isError && !isActive && 'border-white/5 bg-white/[0.01]'
            )}
        >
            {/* Row 1: File info + actions */}
            <div className="flex items-center gap-3">
                <div className="shrink-0 w-8 h-8 neu-raised-sm rounded-lg flex items-center justify-center">
                    {getFileIcon(fileState.file.name)}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-zinc-300 truncate">
                        {fileState.file.name}
                    </p>
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
                                    : 'bg-gradient-to-r from-[#E6B800] via-[#FFCC00] to-[#FFE066] shadow-[0_0_8px_rgba(255,204,0,0.3)]'
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

// ─── Batch Summary Bar ──────────────────────────────────────────────────────

function BatchSummaryBar({
    files,
    onClearCompleted,
}: {
    files: FileUploadState[];
    onClearCompleted?: () => void;
}) {
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
            total > 0
                ? Math.round(
                      files.reduce((sum, f) => sum + f.progress, 0) / total
                  )
                : 0;
        return { pending, uploading, parsing, completed, errored, active, done, total, overallProgress };
    }, [files]);

    const isProcessing = stats.active > 0 || stats.pending > 0;
    const allDone = stats.done === stats.total && stats.total > 0;

    return (
        <div className="space-y-3">
            {/* Header line */}
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">
                    {isProcessing ? (
                        <>
                            Processing{' '}
                            <span className="text-[#FFCC00]">
                                {stats.completed + 1}
                            </span>{' '}
                            of{' '}
                            <span className="text-zinc-300">{stats.total}</span>{' '}
                            files
                        </>
                    ) : allDone ? (
                        <>
                            <span className="text-emerald-400">{stats.completed}</span>{' '}
                            file{stats.completed !== 1 ? 's' : ''} processed
                            {stats.errored > 0 && (
                                <>
                                    ,{' '}
                                    <span className="text-red-400">{stats.errored}</span>{' '}
                                    error{stats.errored !== 1 ? 's' : ''}
                                </>
                            )}
                        </>
                    ) : (
                        <>
                            <span className="text-zinc-300">{stats.total}</span>{' '}
                            file{stats.total !== 1 ? 's' : ''} queued
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
            <div className="w-full h-2 rounded-full bg-black/40 overflow-hidden border border-white/5">
                <div
                    className={cn(
                        'h-full rounded-full transition-all duration-700 ease-out',
                        allDone && stats.errored === 0
                            ? 'bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-[0_0_10px_rgba(34,197,94,0.3)]'
                            : allDone && stats.errored > 0
                              ? 'bg-gradient-to-r from-amber-600 to-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                              : 'bg-gradient-to-r from-[#E6B800] via-[#FFCC00] to-[#FFE066] shadow-[0_0_10px_rgba(255,204,0,0.3)]'
                    )}
                    style={{ width: `${stats.overallProgress}%` }}
                />
            </div>
        </div>
    );
}

// ─── Main UploadZone Component ──────────────────────────────────────────────

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
    const [isDragging, setIsDragging] = useState(false);
    const [files, setFiles] = useState<FileUploadState[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ─── Sync external progress into internal file state ─────────────
    useEffect(() => {
        if (!uploadProgress || uploadProgress.size === 0) return;

        setFiles((prev) =>
            prev.map((f) => {
                const externalProgress = uploadProgress.get(f.id);
                if (!externalProgress) return f;

                const mappedStatus = (() => {
                    const s = externalProgress.status.toLowerCase();
                    if (s === 'completed' || s === 'complete' || s === 'done')
                        return 'completed' as const;
                    if (s === 'error' || s === 'failed')
                        return 'error' as const;
                    if (s === 'parsing') return 'parsing' as const;
                    if (s === 'uploading') return 'uploading' as const;
                    return f.status;
                })();

                return {
                    ...f,
                    status: mappedStatus,
                    progress: externalProgress.progress,
                    bankDetected: externalProgress.bankDetected ?? f.bankDetected,
                    error: externalProgress.error ?? f.error,
                };
            })
        );
    }, [uploadProgress]);

    // ─── Drag handlers ──────────────────────────────────────────────
    const handleDragOver = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (!disabled) setIsDragging(true);
        },
        [disabled]
    );

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setIsDragging(false);
    }, []);

    const addFiles = useCallback(
        (incoming: File[]) => {
            if (disabled || incoming.length === 0) return;

            const newFileStates: FileUploadState[] = incoming.map((file) => ({
                file,
                id: generateFileId(),
                status: 'pending' as const,
                progress: 0,
            }));

            setFiles((prev) => [...prev, ...newFileStates]);

            // Also call the original callback so the parent can handle uploads
            onFilesSelected(incoming);
        },
        [onFilesSelected, disabled]
    );

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);

            const dropped = Array.from(e.dataTransfer.files);
            addFiles(dropped);
        },
        [addFiles]
    );

    const handleFileInputChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            if (e.target.files && e.target.files.length > 0) {
                addFiles(Array.from(e.target.files));
                e.target.value = '';
            }
        },
        [addFiles]
    );

    // ─── Actions ────────────────────────────────────────────────────

    const handleCancel = useCallback(
        (fileId: string) => {
            setFiles((prev) => prev.filter((f) => f.id !== fileId));
            onCancelFile?.(fileId);
        },
        [onCancelFile]
    );

    const handleRetry = useCallback(
        (fileId: string, file: File) => {
            setFiles((prev) =>
                prev.map((f) =>
                    f.id === fileId
                        ? { ...f, status: 'pending' as const, progress: 0, error: undefined }
                        : f
                )
            );
            onRetryFile?.(fileId, file);
        },
        [onRetryFile]
    );

    const clearCompleted = useCallback(() => {
        setFiles((prev) =>
            prev.filter((f) => f.status !== 'completed' && f.status !== 'error')
        );
    }, []);

    // ─── Derived state ──────────────────────────────────────────────
    const hasFiles = files.length > 0;
    const showBatchSummary = files.length > 1;

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
                            disabled && 'opacity-50 cursor-not-allowed'
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
                            disabled && 'opacity-50 cursor-not-allowed'
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
                            <BatchSummaryBar
                                files={files}
                                onClearCompleted={clearCompleted}
                            />
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
                        (files[0]?.status === 'completed' ||
                            files[0]?.status === 'error') && (
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
                                disabled && 'opacity-50 cursor-not-allowed'
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
