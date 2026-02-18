export type UploadStatus =
  | 'queued'
  | 'uploading'
  | 'processing'
  | 'complete'
  | 'failed'
  | 'duplicate'
  | 'cancelled';

export interface UploadQueueItem {
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
