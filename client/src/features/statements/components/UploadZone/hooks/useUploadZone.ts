import { useState, useCallback, useRef, useEffect } from 'react';
import type { DragEvent, ChangeEvent } from 'react';
import { generateFileId } from '../helpers.js';
import type { FileUploadState, FileUploadProgress } from '../types.js';

interface UseUploadZoneOptions {
  onFilesSelected: (files: File[]) => void;
  onCancelFile?: (fileId: string) => void;
  onRetryFile?: (fileId: string, file: File) => void;
  uploadProgress?: Map<string, FileUploadProgress>;
  disabled?: boolean;
}

export function useUploadZone({
  onFilesSelected,
  onCancelFile,
  onRetryFile,
  uploadProgress,
  disabled = false,
}: UseUploadZoneOptions) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<FileUploadState[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync external progress into internal file state
  useEffect(() => {
    if (!uploadProgress || uploadProgress.size === 0) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- valid: syncing external Map prop
    setFiles((prev) =>
      prev.map((f) => {
        const externalProgress = uploadProgress.get(f.id);
        if (!externalProgress) return f;

        const mappedStatus = (() => {
          const s = externalProgress.status.toLowerCase();
          if (s === 'completed' || s === 'complete' || s === 'done') return 'completed' as const;
          if (s === 'error' || s === 'failed') return 'error' as const;
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
      }),
    );
  }, [uploadProgress]);

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
      onFilesSelected(incoming);
    },
    [onFilesSelected, disabled],
  );

  const handleDragOver = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) setIsDragging(true);
    },
    [disabled],
  );

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      addFiles(Array.from(e.dataTransfer.files));
    },
    [addFiles],
  );

  const handleFileInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        addFiles(Array.from(e.target.files));
        e.target.value = '';
      }
    },
    [addFiles],
  );

  const handleCancel = useCallback(
    (fileId: string) => {
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      onCancelFile?.(fileId);
    },
    [onCancelFile],
  );

  const handleRetry = useCallback(
    (fileId: string, file: File) => {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileId ? { ...f, status: 'pending' as const, progress: 0, error: undefined } : f,
        ),
      );
      onRetryFile?.(fileId, file);
    },
    [onRetryFile],
  );

  const clearCompleted = useCallback(() => {
    setFiles((prev) => prev.filter((f) => f.status !== 'completed' && f.status !== 'error'));
  }, []);

  const hasFiles = files.length > 0;
  const showBatchSummary = files.length > 1;

  return {
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
  };
}
