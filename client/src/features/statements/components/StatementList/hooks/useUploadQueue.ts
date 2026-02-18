import { useState, useCallback, useRef, useEffect } from 'react';
import { api } from '@/api';
import type { BatchFileStatus } from '@/api';
import type { UploadStatus, UploadQueueItem } from '../types.js';

interface UseUploadQueueOptions {
  refreshStatements: () => Promise<void>;
}

export function useUploadQueue({ refreshStatements }: UseUploadQueueOptions) {
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [batchJobId, setBatchJobId] = useState<string | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const isProcessingRef = useRef(false);
  const uploadQueueRef = useRef<UploadQueueItem[]>([]);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    uploadQueueRef.current = uploadQueue;
  }, [uploadQueue]);

  // Clean up poll on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const startBatchPolling = useCallback(
    (jobId: string) => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

      const poll = async () => {
        try {
          const status = await api.getBatchStatus(jobId);
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

      poll();
      pollIntervalRef.current = setInterval(poll, 2000);
    },
    [refreshStatements],
  );

  const addFilesToQueue = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files).filter(
        (f) => f.type === 'application/pdf' || f.name.endsWith('.pdf') || f.name.endsWith('.csv'),
      );
      if (fileArray.length === 0) return;

      // Single file: sequential upload
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

      // Multiple files: batch API
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;

      const newItems: UploadQueueItem[] = fileArray.map((file) => ({
        id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        status: 'queued' as UploadStatus,
      }));
      setUploadQueue((prev) => [...prev, ...newItems]);

      try {
        setUploadQueue((prev) =>
          prev.map((i) =>
            newItems.find((n) => n.id === i.id) ? { ...i, status: 'uploading' as UploadStatus } : i,
          ),
        );

        const result = await api.uploadBatch(fileArray);
        setBatchJobId(result.jobId);

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

  const clearCompletedFromQueue = () => {
    setUploadQueue((prev) =>
      prev.filter(
        (item) =>
          item.status === 'queued' || item.status === 'uploading' || item.status === 'processing',
      ),
    );
    setBatchJobId(null);
  };

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

  return {
    uploadQueue,
    batchJobId,
    progressBarRef,
    isUploading,
    queueStats,
    addFilesToQueue,
    cancelBatch,
    clearCompletedFromQueue,
  };
}
