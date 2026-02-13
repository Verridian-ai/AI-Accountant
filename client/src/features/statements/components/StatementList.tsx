import { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '@/api';
import type { Statement, StatementGapAnalysis, BatchFileStatus } from '@/api';
import { Skeleton } from '@/components/ui/skeleton';
import './StatementList.css';
import { UploadZone } from './UploadZone';
import { FileUpload } from './FileUpload';
import {
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  RefreshCw,
  Upload,
  Files,
  HelpCircle,
  ChevronRight,
  AlertTriangle,
  Activity,
  Calendar,
  TrendingDown,
  Layers,
  DollarSign,
  Ban,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Upload queue item status
type UploadStatus =
  | 'queued'
  | 'uploading'
  | 'processing'
  | 'complete'
  | 'failed'
  | 'duplicate'
  | 'cancelled';

interface UploadQueueItem {
  id: string;
  file: File;
  status: UploadStatus;
  error?: string;
  statementId?: string;
  serverFileId?: string;
  duplicateOf?: {
    filename: string;
    uploadedOn: string;
  };
}

export function StatementList() {
  const [statements, setStatements] = useState<Statement[]>([]);
  const [loading, setLoading] = useState(true);
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());
  const [expandedErrorId, setExpandedErrorId] = useState<string | null>(null);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [batchJobId, setBatchJobId] = useState<string | null>(null);
  const [gapAnalysis, setGapAnalysis] = useState<StatementGapAnalysis | null>(null);
  const [showGapDetails, setShowGapDetails] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isProcessingRef = useRef(false);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const uploadQueueRef = useRef<UploadQueueItem[]>([]);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    uploadQueueRef.current = uploadQueue;
  }, [uploadQueue]);

  const refreshStatements = useCallback(async () => {
    try {
      const [statementsData, gapData] = await Promise.all([
        api.fetchStatements(),
        api.fetchStatementGapAnalysis().catch(() => null),
      ]);
      setStatements(statementsData);
      setGapAnalysis(gapData);
    } catch (e) {
      console.error('Failed to fetch statements', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRetry = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setRetryingIds((prev) => new Set(prev).add(id));
      await api.reprocessStatement(id);
      await refreshStatements();
    } catch (err) {
      console.error('Retry failed', err);
    } finally {
      setRetryingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  // Poll batch job status for real-time progress
  const startBatchPolling = useCallback(
    (jobId: string) => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

      const poll = async () => {
        try {
          const status = await api.getBatchStatus(jobId);
          // Update upload queue items from server status
          setUploadQueue((prev) =>
            prev.map((item) => {
              const serverFile = status.files.find(
                (f: BatchFileStatus) => f.filename === item.file.name && item.serverFileId === f.id,
              );
              if (!serverFile) return item;

              let newStatus: UploadStatus = item.status;
              if (serverFile.state === 'completed')
                newStatus = serverFile.error?.includes('Duplicate') ? 'duplicate' : 'complete';
              else if (serverFile.state === 'processing') newStatus = 'processing';
              else if (serverFile.state === 'failed') newStatus = 'failed';
              else if (serverFile.state === 'cancelled') newStatus = 'cancelled';
              else if (serverFile.state === 'pending') newStatus = 'uploading';

              return {
                ...item,
                status: newStatus,
                statementId: serverFile.statementId || item.statementId,
                error: serverFile.error || item.error,
              };
            }),
          );

          // Stop polling when job is done
          if (
            status.state === 'completed' ||
            status.state === 'failed' ||
            status.state === 'cancelled'
          ) {
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            isProcessingRef.current = false;
            await refreshStatements();
          }
        } catch (err) {
          console.error('Batch poll failed', err);
        }
      };

      // Poll immediately then every 2 seconds
      poll();
      pollIntervalRef.current = setInterval(poll, 2000);
    },
    [refreshStatements],
  );

  // Clean up poll on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  // Add files to upload queue and submit batch
  const addFilesToQueue = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files).filter(
        (f) => f.type === 'application/pdf' || f.name.endsWith('.pdf') || f.name.endsWith('.csv'),
      );
      if (fileArray.length === 0) return;

      // For single file, use existing sequential upload
      if (fileArray.length === 1) {
        const file = fileArray[0]!;
        const itemId = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const newItem: UploadQueueItem = { id: itemId, file, status: 'uploading' };
        setUploadQueue((prev) => [...prev, newItem]);

        try {
          const result = await api.uploadStatement(file);
          setUploadQueue((prev) =>
            prev.map((i) =>
              i.id === itemId
                ? {
                    ...i,
                    status: result.isDuplicate
                      ? ('duplicate' as UploadStatus)
                      : ('complete' as UploadStatus),
                    statementId: result.id,
                    duplicateOf:
                      result.isDuplicate && result.existingFilename
                        ? {
                            filename: result.existingFilename,
                            uploadedOn: result.uploadedOn || '',
                          }
                        : undefined,
                  }
                : i,
            ),
          );
          await refreshStatements();
        } catch (err) {
          setUploadQueue((prev) =>
            prev.map((i) =>
              i.id === itemId
                ? {
                    ...i,
                    status: 'failed' as UploadStatus,
                    error: err instanceof Error ? err.message : 'Upload failed',
                  }
                : i,
            ),
          );
        }
        return;
      }

      // For multiple files, use batch API
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;

      const newItems: UploadQueueItem[] = fileArray.map((file) => ({
        id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        status: 'queued' as UploadStatus,
      }));
      setUploadQueue((prev) => [...prev, ...newItems]);

      try {
        // Mark all as uploading
        setUploadQueue((prev) =>
          prev.map((i) =>
            newItems.find((n) => n.id === i.id) ? { ...i, status: 'uploading' as UploadStatus } : i,
          ),
        );

        const result = await api.uploadBatch(fileArray);
        setBatchJobId(result.jobId);

        // Map server file IDs to our queue items
        setUploadQueue((prev) =>
          prev.map((item) => {
            const serverFile = result.files.find(
              (f: BatchFileStatus) => f.filename === item.file.name,
            );
            if (serverFile && newItems.find((n) => n.id === item.id)) {
              return { ...item, serverFileId: serverFile.id, status: 'uploading' as UploadStatus };
            }
            return item;
          }),
        );

        // Start polling for progress
        startBatchPolling(result.jobId);
      } catch (err) {
        console.error('Batch upload failed', err);
        setUploadQueue((prev) =>
          prev.map((i) =>
            newItems.find((n) => n.id === i.id)
              ? {
                  ...i,
                  status: 'failed' as UploadStatus,
                  error: err instanceof Error ? err.message : 'Upload failed',
                }
              : i,
          ),
        );
        isProcessingRef.current = false;
      }
    },
    [refreshStatements, startBatchPolling],
  );

  // Cancel the current batch job
  const cancelBatch = useCallback(async () => {
    if (!batchJobId) return;
    try {
      await api.cancelBatch(batchJobId);
      setUploadQueue((prev) =>
        prev.map((i) =>
          i.status === 'queued' || i.status === 'uploading' || i.status === 'processing'
            ? { ...i, status: 'cancelled' as UploadStatus }
            : i,
        ),
      );
    } catch (err) {
      console.error('Cancel failed', err);
    }
  }, [batchJobId]);

  // Handle file input change (multiple files)
  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    addFilesToQueue(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Clear completed/failed items from queue
  const clearCompletedFromQueue = () => {
    setUploadQueue((prev) =>
      prev.filter(
        (item) =>
          item.status === 'queued' || item.status === 'uploading' || item.status === 'processing',
      ),
    );
    setBatchJobId(null);
  };

  // Get queue stats
  const queueStats = {
    total: uploadQueue.length,
    queued: uploadQueue.filter((i) => i.status === 'queued').length,
    uploading: uploadQueue.filter((i) => i.status === 'uploading').length,
    processing: uploadQueue.filter((i) => i.status === 'processing').length,
    complete: uploadQueue.filter((i) => i.status === 'complete').length,
    failed: uploadQueue.filter((i) => i.status === 'failed').length,
    duplicate: uploadQueue.filter((i) => i.status === 'duplicate').length,
    cancelled: uploadQueue.filter((i) => i.status === 'cancelled').length,
  };

  const isUploading =
    queueStats.uploading > 0 || queueStats.queued > 0 || queueStats.processing > 0;

  // Update progress bar CSS custom property
  useEffect(() => {
    if (progressBarRef.current) {
      const percentage =
        queueStats.total > 0
          ? ((queueStats.complete + queueStats.duplicate) / queueStats.total) * 100
          : 0;
      progressBarRef.current.style.setProperty('--progress-width', `${percentage}%`);
    }
  }, [queueStats.total, queueStats.complete, queueStats.duplicate]);

  // Pause polling while uploading to prevent flickering
  useEffect(() => {
    refreshStatements();
    if (isUploading) return;

    const interval = setInterval(refreshStatements, 5000);
    return () => clearInterval(interval);
  }, [refreshStatements, isUploading]);

  const getActionableSuggestion = (errorType?: string | null) => {
    switch (errorType) {
      case 'PDF_READ_ERROR':
        return "Try flattening the PDF or ensuring it's not password-protected. If it's a scanned image, try a higher resolution scan.";
      case 'AI_PARSE_ERROR':
        return "The AI couldn't find a standard CBA format. Ensure you're uploading a 'Smart Access' or 'Transaction' statement.";
      case 'EMPTY_STATEMENT':
        return 'No transactions found. This page might only contain summary info or be an bank info page.';
      case 'CRITICAL_ERROR':
        return 'A system error occurred. Please try again or contact support if the issue persists.';
      default:
        return 'Check the file format and try uploading again.';
    }
  };

  const getStatusIcon = (status: Statement['parsingStatus']) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case 'PROCESSING':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'FAILED':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-zinc-600" />;
    }
  };

  if (loading) {
    return (
      <div className="neu-raised rounded-[2.5rem] overflow-hidden flex flex-col h-full max-h-[550px] border border-white/5 shadow-2xl relative">
        {/* Header Skeleton */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between sticky top-0 z-10 bg-[#12121a]/80 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-2xl" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-11 w-32 rounded-2xl" />
          </div>
        </div>

        {/* List Skeleton */}
        <div className="p-6 space-y-4">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="neu-raised-sm rounded-3xl p-5 border border-white/5 flex items-start justify-between gap-4"
            >
              <div className="flex items-center gap-4 w-full">
                <Skeleton className="h-10 w-10 rounded-2xl shrink-0" />
                <div className="space-y-2 w-full">
                  <Skeleton className="h-4 w-3/4" />
                  <div className="flex gap-2">
                    <Skeleton className="h-4 w-24 rounded-lg" />
                    <Skeleton className="h-4 w-20 rounded-lg" />
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-8 w-8 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Get upload queue item status display
  const getUploadStatusIcon = (status: UploadStatus) => {
    switch (status) {
      case 'complete':
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case 'uploading':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 text-[#FFCC00] animate-spin" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'duplicate':
        return <Files className="h-4 w-4 text-amber-500" />;
      case 'cancelled':
        return <Ban className="h-4 w-4 text-zinc-500" />;
      default:
        return <Clock className="h-4 w-4 text-zinc-600" />;
    }
  };

  const getUploadStatusColor = (status: UploadStatus) => {
    switch (status) {
      case 'complete':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'uploading':
        return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
      case 'processing':
        return 'bg-[#FFCC00]/10 text-[#FFCC00] border border-[#FFCC00]/20';
      case 'failed':
        return 'bg-red-500/10 text-red-400 border border-red-500/20';
      case 'duplicate':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'cancelled':
        return 'bg-zinc-800 text-zinc-500 border border-zinc-700';
      default:
        return 'bg-zinc-900 text-zinc-500 border border-zinc-800';
    }
  };

  const getUploadStatusLabel = (status: UploadStatus) => {
    switch (status) {
      case 'processing':
        return 'Parsing';
      case 'duplicate':
        return 'Duplicate';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status;
    }
  };

  return (
    <div className="neu-raised rounded-[2.5rem] overflow-hidden flex flex-col h-full max-h-[550px] border border-white/5 shadow-2xl relative">
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />

      {/* Header */}
      <div className="p-6 border-b border-white/5 flex items-center justify-between sticky top-0 z-10 bg-[#12121a]/80 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="neu-inset p-3 rounded-2xl">
            <FileText className="h-6 w-6 text-[#FFCC00]" />
          </div>
          <div className="text-left">
            <h3 className="font-black text-zinc-100 text-sm uppercase tracking-widest">
              Statements
            </h3>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em]">
                {statements.length} Nodes Indexed
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleUpload}
            className="hidden"
            accept=".pdf,.csv"
            multiple
            aria-label="Upload bank statements"
          />
          <button
            type="button"
            title="Upload PDF statements"
            aria-label="Upload PDF statements"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-2 px-5 h-11 text-[10px] font-black uppercase tracking-[0.2em] text-[#0a0a0f] cba-gold-gradient cba-gold-glow rounded-2xl btn-press disabled:opacity-50 transition-all active:scale-95"
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            <span className="hidden xs:inline">
              {isUploading ? `${queueStats.complete}/${queueStats.total}` : 'Inject'}
            </span>
          </button>
        </div>
      </div>

      {/* Upload Queue Progress */}
      {uploadQueue.length > 0 && (
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
                  onClick={cancelBatch}
                  className="text-[9px] font-black uppercase text-zinc-600 hover:text-red-400 transition-colors tracking-widest flex items-center gap-1"
                >
                  <Ban className="h-3 w-3" /> Cancel
                </button>
              )}
              {!isUploading && (
                <button
                  type="button"
                  onClick={clearCompletedFromQueue}
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
                  <div className="ml-7 text-[9px] font-bold text-red-400/70 italic">
                    {item.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gap Analysis Warning Panel */}
      {gapAnalysis?.coverage.hasIssues && (
        <div className="border-b border-white/5 p-4 bg-amber-500/5">
          <button
            type="button"
            onClick={() => setShowGapDetails(!showGapDetails)}
            className="w-full flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              </div>
              <div className="text-left">
                <span className="text-[10px] font-black text-amber-400 uppercase tracking-[0.15em]">
                  Statement Coverage Issues Detected
                </span>
                <div className="flex items-center gap-3 mt-1">
                  {gapAnalysis.coverage.totalGaps > 0 && (
                    <span className="text-[9px] font-bold text-zinc-500">
                      <Calendar className="h-3 w-3 inline mr-1" />
                      {gapAnalysis.coverage.totalGaps} gap
                      {gapAnalysis.coverage.totalGaps !== 1 ? 's' : ''}
                    </span>
                  )}
                  {gapAnalysis.coverage.totalOverlaps > 0 && (
                    <span className="text-[9px] font-bold text-zinc-500">
                      <Layers className="h-3 w-3 inline mr-1" />
                      {gapAnalysis.coverage.totalOverlaps} overlap
                      {gapAnalysis.coverage.totalOverlaps !== 1 ? 's' : ''}
                    </span>
                  )}
                  {gapAnalysis.coverage.totalBalanceMismatches > 0 && (
                    <span className="text-[9px] font-bold text-zinc-500">
                      <DollarSign className="h-3 w-3 inline mr-1" />
                      {gapAnalysis.coverage.totalBalanceMismatches} balance mismatch
                      {gapAnalysis.coverage.totalBalanceMismatches !== 1 ? 'es' : ''}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <ChevronRight
              className={cn(
                'h-4 w-4 text-zinc-600 transition-transform',
                showGapDetails && 'rotate-90',
              )}
            />
          </button>

          {showGapDetails && (
            <div className="mt-4 space-y-3 max-h-[200px] overflow-y-auto scrollbar-thin">
              {/* Gaps */}
              {gapAnalysis.gaps.map((gap, i) => (
                <div
                  key={`gap-${i}`}
                  className="p-3 rounded-xl neu-inset bg-amber-500/5 border border-amber-500/10"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider">
                      Missing Period: {gap.gapDays} day{gap.gapDays !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <p className="text-[9px] text-zinc-500 font-bold">
                    {gap.gapStart} → {gap.gapEnd}
                  </p>
                  <p className="text-[8px] text-zinc-600 mt-1">
                    Between "{gap.beforeStatement}" and "{gap.afterStatement}"
                  </p>
                </div>
              ))}

              {/* Overlaps */}
              {gapAnalysis.overlaps.map((overlap, i) => (
                <div
                  key={`overlap-${i}`}
                  className="p-3 rounded-xl neu-inset bg-blue-500/5 border border-blue-500/10"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Layers className="h-3.5 w-3.5 text-blue-500" />
                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-wider">
                      Overlapping: {overlap.overlapDays} day{overlap.overlapDays !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <p className="text-[9px] text-zinc-500 font-bold">
                    {overlap.overlapStart} → {overlap.overlapEnd}
                  </p>
                  <p className="text-[8px] text-zinc-600 mt-1">
                    "{overlap.statement1}" overlaps with "{overlap.statement2}"
                  </p>
                </div>
              ))}

              {/* Balance Mismatches */}
              {gapAnalysis.balanceMismatches.map((mismatch, i) => (
                <div
                  key={`mismatch-${i}`}
                  className="p-3 rounded-xl neu-inset bg-red-500/5 border border-red-500/10"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                    <span className="text-[10px] font-black text-red-400 uppercase tracking-wider">
                      Balance Mismatch: ${Math.abs(mismatch.difference / 100).toFixed(2)}
                    </span>
                  </div>
                  <p className="text-[9px] text-zinc-500 font-bold">
                    Expected: ${(mismatch.expectedBalance / 100).toFixed(2)} → Actual: $
                    {(mismatch.actualBalance / 100).toFixed(2)}
                  </p>
                  <p className="text-[8px] text-zinc-600 mt-1">
                    Between "{mismatch.statement1}" and "{mismatch.statement2}"
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Drag and Drop Zone */}
      <UploadZone
        onFilesSelected={addFilesToQueue}
        className="flex-1 overflow-y-auto p-6 space-y-4 transition-colors relative scrollbar-thin"
      >
        {statements.length === 0 && uploadQueue.length === 0 ? (
          <FileUpload onFilesSelected={addFilesToQueue} />
        ) : (
          <div className="space-y-4">
            {statements.map((stmt) => (
              <div
                key={stmt.id}
                onClick={() =>
                  stmt.parsingStatus === 'FAILED' &&
                  setExpandedErrorId(expandedErrorId === stmt.id ? null : stmt.id)
                }
                className={cn(
                  'group p-5 transition-all neu-raised-sm rounded-3xl border border-white/5 hover:neu-float hover:border-white/10',
                  stmt.parsingStatus === 'FAILED'
                    ? 'border-l-red-500/50 cursor-pointer'
                    : 'hover:border-[#FFCC00]/20',
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="mt-1 w-10 h-10 neu-inset rounded-2xl flex items-center justify-center shrink-0">
                      {getStatusIcon(stmt.parsingStatus)}
                    </div>
                    <div className="min-w-0 text-left">
                      <p className="font-black text-[13px] text-zinc-100 truncate pr-2 group-hover:text-[#FFCC00] transition-colors tracking-tight">
                        {stmt.filename}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-2.5">
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-black/20 border border-white/5">
                          <Clock className="w-2.5 h-2.5 text-zinc-600" />
                          <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">
                            {new Date(stmt.uploadDate).toLocaleDateString()}
                          </span>
                        </div>
                        {stmt.aiModelUsed && (
                          <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-[#FFCC00]/5 text-[#FFCC00] rounded-lg border border-[#FFCC00]/20 uppercase font-black tracking-widest shadow-[0_0_15px_rgba(255,204,0,0.05)]">
                            <Activity className="w-2.5 h-2.5" />
                            <span className="text-[8px]">{stmt.aiModelUsed.split('/').pop()}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="flex items-center gap-2">
                      {stmt.parsingStatus === 'FAILED' && (
                        <button
                          type="button"
                          onClick={(e) => handleRetry(stmt.id, e)}
                          disabled={retryingIds.has(stmt.id)}
                          className="h-10 w-10 flex items-center justify-center text-red-400 neu-raised-sm hover:glow-danger rounded-xl btn-press border border-red-500/20"
                          title="Retry processing"
                        >
                          <RefreshCw
                            className={cn('h-4 w-4', retryingIds.has(stmt.id) && 'animate-spin')}
                          />
                        </button>
                      )}
                      {stmt.parsingStatus === 'COMPLETED' && (
                        <div className="h-8 w-8 flex items-center justify-center rounded-xl neu-inset border border-white/5 shadow-inner">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Error Details Section */}
                {stmt.parsingStatus === 'FAILED' && (
                  <div
                    className={cn(
                      'mt-5 space-y-4 overflow-hidden transition-all duration-500',
                      expandedErrorId === stmt.id
                        ? 'max-h-[400px] opacity-100'
                        : 'max-h-0 opacity-0',
                    )}
                  >
                    <div className="p-5 rounded-2xl neu-inset border border-red-500/10 space-y-4 bg-red-500/[0.02]">
                      <div className="flex items-start gap-4">
                        <div className="p-2 neu-raised-sm rounded-lg text-red-400 shrink-0">
                          <AlertTriangle className="h-4 w-4" />
                        </div>
                        <div className="space-y-1.5 flex-1">
                          <p className="text-[10px] font-black text-red-400 uppercase tracking-[0.2em] text-left">
                            {stmt.errorType?.replace(/_/g, ' ') || 'PARSING ERROR'}
                          </p>
                          <p className="text-xs text-zinc-400 leading-relaxed text-left font-bold italic">
                            "{stmt.errorMessage}"
                          </p>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-white/5 text-left">
                        <div className="flex items-start gap-4">
                          <div className="w-8 h-8 neu-raised-sm rounded-xl flex items-center justify-center shrink-0 text-blue-400">
                            <HelpCircle className="h-4 w-4" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em]">
                              Remediation Protocol
                            </p>
                            <p className="text-[11px] text-zinc-300 italic font-bold leading-snug">
                              {getActionableSuggestion(stmt.errorType)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between px-2">
                      <button
                        type="button"
                        className="text-[9px] font-black text-[#FFCC00] hover:brightness-125 flex items-center gap-2 uppercase tracking-[0.2em] btn-press"
                      >
                        Access Archives <ChevronRight className="h-3 w-3" />
                      </button>
                      <span className="text-[8px] text-zinc-700 font-mono font-black tracking-widest bg-white/[0.02] px-2 py-0.5 rounded border border-white/5">
                        NODE_ID: {stmt.id.slice(0, 8).toUpperCase()}
                      </span>
                    </div>
                  </div>
                )}

                {stmt.parsingStatus === 'FAILED' && expandedErrorId !== stmt.id && (
                  <div className="mt-4 flex items-center gap-2 text-[9px] font-black text-red-400 uppercase tracking-[0.2em] animate-pulse">
                    <AlertCircle className="h-3.5 w-3.5" /> Diagnostic required: Click to expand
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </UploadZone>

      {/* Footer */}
      <div className="p-4 border-t border-white/5 sticky bottom-0 text-center bg-black/40 backdrop-blur-md">
        <p className="text-[9px] text-zinc-600 font-black uppercase tracking-[0.3em]">
          System <span className="text-[#FFCC00]">Vault</span> • Automated Node Verification
        </p>
      </div>
    </div>
  );
}
