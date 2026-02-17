import { BaseError } from '../../errors.js';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type JobState = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type JobPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface FileInfo {
  name: string;
  size: number;
  type: string;
  buffer: ArrayBuffer | Buffer;
}

export interface JobFile {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  filePath: string;
  state: JobState;
  statementId?: string;
  error?: string;
  retryCount: number;
  processedAt?: string;
}

export interface QueueJob {
  id: string;
  userId: string;
  files: JobFile[];
  priority: JobPriority;
  state: JobState;
  progress: {
    total: number;
    completed: number;
    failed: number;
    processing: number;
  };
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  retryCount: number;
  metadata?: Record<string, unknown>;
}

export interface QueueStats {
  totalJobs: number;
  pendingJobs: number;
  processingJobs: number;
  completedJobs: number;
  failedJobs: number;
  cancelledJobs: number;
  totalFilesProcessed: number;
  averageProcessingTimeMs: number;
  workersActive: number;
  workersTotal: number;
}

export interface AddJobOptions {
  priority?: JobPriority;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface QueueConfig {
  maxConcurrentWorkers: number;
  maxBatchSize: number;
  maxRetries: number;
  retryDelayMs: number;
  retryBackoffMultiplier: number;
  jobTimeoutMs: number;
  persistenceDir: string;
  cleanupCompletedAfterMs: number;
}

export const DEFAULT_CONFIG: QueueConfig = {
  maxConcurrentWorkers: 3,
  maxBatchSize: 50,
  maxRetries: 3,
  retryDelayMs: 2000,
  retryBackoffMultiplier: 2,
  jobTimeoutMs: 5 * 60 * 1000, // 5 minutes per file
  persistenceDir: './uploads/queue',
  cleanupCompletedAfterMs: 24 * 60 * 60 * 1000, // 24 hours
};

// ============================================================================
// ERRORS
// ============================================================================

export class QueueError extends BaseError {
  constructor(
    message: string,
    public code: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export class JobNotFoundError extends QueueError {
  constructor(jobId: string) {
    super(`Job not found: ${jobId}`, 'JOB_NOT_FOUND', { jobId });
  }
}

export class BatchSizeExceededError extends QueueError {
  constructor(size: number, maxSize: number) {
    super(`Batch size ${size} exceeds maximum of ${maxSize}`, 'BATCH_SIZE_EXCEEDED', {
      size,
      maxSize,
    });
  }
}

export class JobAlreadyProcessingError extends QueueError {
  constructor(jobId: string) {
    super(`Job ${jobId} is already being processed`, 'JOB_ALREADY_PROCESSING', { jobId });
  }
}

// ============================================================================
// WORKER INTERFACE
// ============================================================================

export interface Worker {
  id: number;
  busy: boolean;
  currentJobId?: string;
  currentFileId?: string;
  assignedAt?: number;
}

// ============================================================================
// PRIORITY VALUES
// ============================================================================

export const PRIORITY_VALUES: Record<JobPriority, number> = {
  urgent: 4,
  high: 3,
  normal: 2,
  low: 1,
};
