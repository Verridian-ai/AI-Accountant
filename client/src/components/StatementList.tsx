import { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '../api';
import type { Statement } from '../api';
import { FileText, CheckCircle2, Clock, AlertCircle, Loader2, RefreshCw, Upload, X, Files } from 'lucide-react';
import { cn } from '../lib/utils';

// Upload queue item status
type UploadStatus = 'queued' | 'uploading' | 'complete' | 'failed' | 'duplicate';

interface UploadQueueItem {
    id: string;
    file: File;
    status: UploadStatus;
    error?: string;
    statementId?: string;
}

export function StatementList() {
    const [statements, setStatements] = useState<Statement[]>([]);
    const [loading, setLoading] = useState(true);
    const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());
    const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const isProcessingRef = useRef(false);

    const refreshStatements = async () => {
        try {
            const data = await api.fetchStatements();
            setStatements(data);
        } catch (e) {
            console.error('Failed to fetch statements', e);
        } finally {
            setLoading(false);
        }
    };

    const handleRetry = async (id: string) => {
        try {
            setRetryingIds(prev => new Set(prev).add(id));
            await api.reprocessStatement(id);
            await refreshStatements();
        } catch (e) {
            console.error('Retry failed', e);
        } finally {
            setRetryingIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }
    };

    // Add files to upload queue
    const addFilesToQueue = useCallback((files: FileList | File[]) => {
        const newItems: UploadQueueItem[] = Array.from(files).map(file => ({
            id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            file,
            status: 'queued' as UploadStatus
        }));
        setUploadQueue(prev => [...prev, ...newItems]);
    }, []);

    // Process upload queue
    const processQueue = useCallback(async () => {
        if (isProcessingRef.current) return;
        isProcessingRef.current = true;

        const processNext = async () => {
            const nextItem = uploadQueue.find(item => item.status === 'queued');
            if (!nextItem) {
                isProcessingRef.current = false;
                return;
            }

            // Update status to uploading
            setUploadQueue(prev => prev.map(item =>
                item.id === nextItem.id ? { ...item, status: 'uploading' as UploadStatus } : item
            ));

            try {
                const result = await api.uploadStatement(nextItem.file);
                setUploadQueue(prev => prev.map(item =>
                    item.id === nextItem.id
                        ? {
                            ...item,
                            status: result.isDuplicate ? 'duplicate' as UploadStatus : 'complete' as UploadStatus,
                            statementId: result.id
                        }
                        : item
                ));
                await refreshStatements();
            } catch (e) {
                setUploadQueue(prev => prev.map(item =>
                    item.id === nextItem.id
                        ? { ...item, status: 'failed' as UploadStatus, error: e instanceof Error ? e.message : 'Upload failed' }
                        : item
                ));
            }

            // Process next item
            await processNext();
        };

        await processNext();
    }, [uploadQueue]);

    // Start processing when queue changes
    useEffect(() => {
        if (uploadQueue.some(item => item.status === 'queued') && !isProcessingRef.current) {
            processQueue();
        }
    }, [uploadQueue, processQueue]);

    // Handle file input change (multiple files)
    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        addFilesToQueue(files);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Drag and drop handlers
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            addFilesToQueue(files);
        }
    };

    // Clear completed/failed items from queue
    const clearCompletedFromQueue = () => {
        setUploadQueue(prev => prev.filter(item => item.status === 'queued' || item.status === 'uploading'));
    };

    // Get queue stats
    const queueStats = {
        total: uploadQueue.length,
        queued: uploadQueue.filter(i => i.status === 'queued').length,
        uploading: uploadQueue.filter(i => i.status === 'uploading').length,
        complete: uploadQueue.filter(i => i.status === 'complete').length,
        failed: uploadQueue.filter(i => i.status === 'failed').length,
        duplicate: uploadQueue.filter(i => i.status === 'duplicate').length,
    };

    const isUploading = queueStats.uploading > 0 || queueStats.queued > 0;

    useEffect(() => {
        refreshStatements();
        const interval = setInterval(refreshStatements, 5000);
        return () => clearInterval(interval);
    }, []);

    const getStatusIcon = (status: Statement['parsingStatus']) => {
        switch (status) {
            case 'COMPLETED':
                return <CheckCircle2 className="h-4 w-4 text-green-500" />;
            case 'PROCESSING':
                return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
            case 'FAILED':
                return <AlertCircle className="h-4 w-4 text-red-500" />;
            default:
                return <Clock className="h-4 w-4 text-gray-400" />;
        }
    };

    const getStatusColor = (status: Statement['parsingStatus']) => {
        switch (status) {
            case 'COMPLETED': return 'bg-green-100 text-green-700';
            case 'PROCESSING': return 'bg-blue-100 text-blue-700';
            case 'FAILED': return 'bg-red-100 text-red-700';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    if (loading) {
        return (
            <div className="bg-white rounded-xl border p-6 shadow-sm">
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-gray-600" />
                    <h3 className="font-semibold text-gray-800">Statements</h3>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleUpload}
                        className="hidden"
                        accept=".pdf,.csv,.png"
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
                    >
                        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                        Upload
                    </button>
                    <span className="text-xs text-gray-500 ml-2">{statements.length} files</span>
                </div>
            </div>

            {statements.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No statements uploaded yet</p>
                    <p className="text-xs mt-1">Upload PDF, CSV or PNG statements</p>
                </div>
            ) : (
                <div className="divide-y divide-gray-100 max-h-[300px] overflow-y-auto">
                    {statements.map((stmt) => (
                        <div key={stmt.id} className="p-4 hover:bg-gray-50 transition-colors">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3 min-w-0">
                                    {getStatusIcon(stmt.parsingStatus)}
                                    <div className="min-w-0">
                                        <p className="font-medium text-sm text-gray-900 truncate">
                                            {stmt.filename}
                                        </p>
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            {new Date(stmt.uploadDate).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={cn(
                                        "px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap",
                                        getStatusColor(stmt.parsingStatus)
                                    )}>
                                        {stmt.parsingStatus}
                                    </span>
                                    {stmt.parsingStatus === 'FAILED' && (
                                        <button
                                            onClick={() => handleRetry(stmt.id)}
                                            disabled={retryingIds.has(stmt.id)}
                                            className="p-1 text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-50"
                                            title="Retry processing"
                                        >
                                            <RefreshCw className={cn("h-3.5 w-3.5", retryingIds.has(stmt.id) && "animate-spin")} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
