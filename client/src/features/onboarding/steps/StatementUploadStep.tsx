import { useState, useRef, useCallback } from 'react';
import {
    Upload,
    FileText,
    FileSpreadsheet,
    CheckCircle2,
    AlertCircle,
    Loader2,
    X,
    ArrowUpRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/api';
import type { OnboardingStepProps } from '../types';

interface UploadedFile {
    id?: string;
    file: File;
    status: 'pending' | 'uploading' | 'success' | 'error';
    message?: string;
    statementId?: string;
}

export function StatementUploadStep({ data, updateData, onSkip }: OnboardingStepProps) {
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFiles = useCallback(async (files: FileList | File[]) => {
        const fileArray = Array.from(files);
        const validFiles = fileArray.filter(f =>
            f.type === 'application/pdf' ||
            f.type === 'text/csv' ||
            f.name.endsWith('.pdf') ||
            f.name.endsWith('.csv')
        );

        if (validFiles.length === 0) return;

        // Generate unique IDs for each file to track them properly
        const fileIds = validFiles.map(() => crypto.randomUUID());

        // Add files to state with unique IDs
        const newUploads: (UploadedFile & { id: string })[] = validFiles.map((file, i) => ({
            id: fileIds[i],
            file,
            status: 'pending' as const,
        }));

        setUploadedFiles(prev => [...prev, ...newUploads]);

        // Upload each file - use file ID instead of index to avoid stale closure issues
        for (let i = 0; i < validFiles.length; i++) {
            const file = validFiles[i];
            const fileId = fileIds[i];

            setUploadedFiles(prev =>
                prev.map((u) =>
                    (u as UploadedFile & { id?: string }).id === fileId
                        ? { ...u, status: 'uploading' as const }
                        : u
                )
            );

            try {
                const result = await api.uploadStatement(file);
                setUploadedFiles(prev =>
                    prev.map((u) =>
                        (u as UploadedFile & { id?: string }).id === fileId
                            ? {
                                ...u,
                                status: 'success' as const,
                                statementId: result.id,
                                message: result.isDuplicate
                                    ? 'Duplicate file (already uploaded)'
                                    : 'Uploaded successfully',
                            }
                            : u
                    )
                );
                updateData({ hasUploadedStatement: true });
            } catch (error) {
                setUploadedFiles(prev =>
                    prev.map((u) =>
                        (u as UploadedFile & { id?: string }).id === fileId
                            ? {
                                ...u,
                                status: 'error' as const,
                                message: error instanceof Error ? error.message : 'Upload failed',
                            }
                            : u
                    )
                );
            }
        }
    }, [updateData]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        handleFiles(e.dataTransfer.files);
    }, [handleFiles]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleClick = () => {
        inputRef.current?.click();
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFiles(e.target.files);
            e.target.value = '';
        }
    };

    const removeFile = (fileId: string | undefined, fileName: string) => {
        setUploadedFiles(prev => prev.filter((f) =>
            fileId ? f.id !== fileId : f.file.name !== fileName
        ));
    };

    const successCount = uploadedFiles.filter(f => f.status === 'success').length;
    const hasUploads = uploadedFiles.length > 0;

    return (
        <div className="p-6 sm:p-10 space-y-8">
            {/* Header */}
            <div className="text-center sm:text-left">
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight mb-2">
                    <span className="text-gradient-gold">Upload your first statement</span>
                </h2>
                <p className="text-sm text-zinc-500">
                    Drop your bank statement here and watch the AI categorize your transactions.
                </p>
            </div>

            {/* Upload Zone */}
            <div
                onClick={handleClick}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={cn(
                    "group relative min-h-[250px] w-full flex flex-col items-center justify-center cursor-pointer",
                    "rounded-[2rem] border-2 border-dashed transition-all duration-300",
                    isDragging
                        ? "border-[#FFCC00]/50 bg-[#FFCC00]/[0.05] scale-[1.02]"
                        : "border-white/10 bg-white/[0.01] hover:border-[#FFCC00]/30 hover:bg-[#FFCC00]/[0.02]"
                )}
            >
                <input
                    ref={inputRef}
                    type="file"
                    className="hidden"
                    aria-label="Upload bank statements"
                    accept=".pdf,.csv"
                    multiple
                    onChange={handleInputChange}
                />

                {/* Main Icon */}
                <div className="relative mb-6">
                    <div className={cn(
                        "absolute inset-0 bg-[#FFCC00] blur-2xl transition-opacity duration-500 rounded-full",
                        isDragging ? "opacity-30" : "opacity-0 group-hover:opacity-20"
                    )} />
                    <div className={cn(
                        "w-20 h-20 neu-inset rounded-[1.5rem] flex items-center justify-center transition-all duration-300 relative z-10 border border-white/5",
                        isDragging && "scale-110 neu-raised"
                    )}>
                        <Upload className={cn(
                            "h-9 w-9 transition-colors duration-300",
                            isDragging ? "text-[#FFCC00]" : "text-zinc-600 group-hover:text-[#FFCC00]"
                        )} />
                    </div>

                    {/* Floating Indicators */}
                    <div className={cn(
                        "absolute -right-3 -top-3 bg-[#12121a] border border-white/10 p-2 rounded-xl shadow-xl transition-all duration-500",
                        isDragging ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100"
                    )} style={{ transitionDelay: '75ms' }}>
                        <FileText className="h-4 w-4 text-red-400" />
                    </div>
                    <div className={cn(
                        "absolute -left-3 -bottom-3 bg-[#12121a] border border-white/10 p-2 rounded-xl shadow-xl transition-all duration-500",
                        isDragging ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100"
                    )} style={{ transitionDelay: '100ms' }}>
                        <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
                    </div>
                </div>

                {/* Text */}
                <div className="text-center relative z-10 max-w-xs mx-auto px-4">
                    <h3 className={cn(
                        "text-sm font-black uppercase tracking-[0.2em] transition-colors duration-300",
                        isDragging ? "text-[#FFCC00]" : "text-zinc-400 group-hover:text-[#FFCC00]"
                    )}>
                        {isDragging ? 'Drop to Upload' : 'Upload Statements'}
                    </h3>
                    <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
                        Drop your PDF or CSV bank statements here, or click to browse files.
                    </p>
                </div>

                {/* Supported Formats */}
                <div className="mt-6 flex items-center gap-3 opacity-60 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 text-[9px] font-bold text-zinc-400 uppercase tracking-wider">
                        <FileText className="h-3 w-3" /> PDF
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 text-[9px] font-bold text-zinc-400 uppercase tracking-wider">
                        <FileSpreadsheet className="h-3 w-3" /> CSV
                    </div>
                </div>

                {/* Hover Indicator */}
                <div className={cn(
                    "absolute top-4 right-4 transition-all duration-300",
                    isDragging ? "opacity-100 translate-x-0" : "opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0"
                )}>
                    <div className="p-2 rounded-full bg-[#FFCC00]/10 text-[#FFCC00]">
                        <ArrowUpRight className="h-4 w-4" />
                    </div>
                </div>
            </div>

            {/* Uploaded Files List */}
            {hasUploads && (
                <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="flex items-center justify-between">
                        <h3 className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">
                            Uploaded Files
                        </h3>
                        {successCount > 0 && (
                            <span className="text-xs font-bold text-emerald-400">
                                {successCount} file{successCount !== 1 ? 's' : ''} ready
                            </span>
                        )}
                    </div>
                    <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                        {uploadedFiles.map((upload) => (
                            <div
                                key={upload.id || upload.file.name}
                                className={cn(
                                    "flex items-center justify-between gap-3 p-3 rounded-xl border transition-all",
                                    upload.status === 'success' && "neu-raised-sm border-emerald-500/20 bg-emerald-500/5",
                                    upload.status === 'error' && "neu-raised-sm border-red-500/20 bg-red-500/5",
                                    upload.status === 'uploading' && "neu-inset border-[#FFCC00]/20",
                                    upload.status === 'pending' && "neu-inset border-white/5"
                                )}
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    {upload.status === 'uploading' && (
                                        <Loader2 className="w-4 h-4 text-[#FFCC00] animate-spin shrink-0" />
                                    )}
                                    {upload.status === 'success' && (
                                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                    )}
                                    {upload.status === 'error' && (
                                        <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                                    )}
                                    {upload.status === 'pending' && (
                                        <FileText className="w-4 h-4 text-zinc-500 shrink-0" />
                                    )}
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-zinc-300 truncate">
                                            {upload.file.name}
                                        </p>
                                        {upload.message && (
                                            <p className={cn(
                                                "text-xs truncate",
                                                upload.status === 'error' ? "text-red-400" : "text-zinc-500"
                                            )}>
                                                {upload.message}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                {upload.status !== 'uploading' && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            removeFile(upload.id, upload.file.name);
                                        }}
                                        className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                                        aria-label={`Remove ${upload.file.name}`}
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Skip hint */}
            {!hasUploads && onSkip && (
                <div className="text-center">
                    <p className="text-xs text-zinc-600">
                        Don't have a statement handy? You can{' '}
                        <button
                            onClick={onSkip}
                            className="text-[#FFCC00] hover:underline font-medium"
                        >
                            skip this step
                        </button>
                        {' '}and upload later.
                    </p>
                </div>
            )}
        </div>
    );
}

export default StatementUploadStep;
