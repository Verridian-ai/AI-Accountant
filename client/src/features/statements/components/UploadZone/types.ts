import type { ReactNode } from 'react';

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

export interface UploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  onCancelFile?: (fileId: string) => void;
  onRetryFile?: (fileId: string, file: File) => void;
  uploadProgress?: Map<string, FileUploadProgress>;
  className?: string;
  children?: ReactNode;
  accept?: string;
  disabled?: boolean;
}
