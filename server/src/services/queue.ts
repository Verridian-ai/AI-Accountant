/**
 * Bulk Upload Queue System
 *
 * Features:
 * - In-memory + persistent queue (SQLite-backed)
 * - Configurable concurrent workers (default: 3)
 * - Max 50 files per batch
 * - Priority queue with FIFO ordering and priority boost
 * - Retry on failure (max 3 retries with exponential backoff)
 * - SSE event emission for real-time progress updates
 * - Job persistence to survive server restarts
 *
 * Job states: pending, processing, completed, failed, cancelled
 */

import { db } from '../schema.js';
import { events } from '../events.js';
import { pipeline } from './pipeline.js';
import { logger } from '../utils/logger.js';
import { BaseError } from '../errors.js';
import crypto from 'crypto';
import { writeFile, mkdir, unlink, readFile } from 'fs/promises';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';

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

const DEFAULT_CONFIG: QueueConfig = {
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
// PRIORITY QUEUE IMPLEMENTATION
// ============================================================================

const PRIORITY_VALUES: Record<JobPriority, number> = {
  urgent: 4,
  high: 3,
  normal: 2,
  low: 1,
};

class PriorityQueue<T extends { priority: JobPriority; createdAt: string }> {
  private items: T[] = [];

  enqueue(item: T): void {
    this.items.push(item);
    this.items.sort((a, b) => {
      // First sort by priority (descending)
      const priorityDiff = PRIORITY_VALUES[b.priority] - PRIORITY_VALUES[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      // Then by creation time (FIFO - ascending)
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }

  dequeue(): T | undefined {
    return this.items.shift();
  }

  peek(): T | undefined {
    return this.items[0];
  }

  remove(predicate: (item: T) => boolean): T | undefined {
    const index = this.items.findIndex(predicate);
    if (index !== -1) {
      return this.items.splice(index, 1)[0];
    }
    return undefined;
  }

  find(predicate: (item: T) => boolean): T | undefined {
    return this.items.find(predicate);
  }

  findAll(predicate: (item: T) => boolean): T[] {
    return this.items.filter(predicate);
  }

  get length(): number {
    return this.items.length;
  }

  toArray(): T[] {
    return [...this.items];
  }

  clear(): void {
    this.items = [];
  }

  boostPriority(predicate: (item: T) => boolean, newPriority: JobPriority): boolean {
    const item = this.find(predicate);
    if (item && PRIORITY_VALUES[newPriority] > PRIORITY_VALUES[item.priority]) {
      item.priority = newPriority;
      // Re-sort after priority change
      this.items.sort((a, b) => {
        const priorityDiff = PRIORITY_VALUES[b.priority] - PRIORITY_VALUES[a.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
      return true;
    }
    return false;
  }
}

// ============================================================================
// WORKER POOL
// ============================================================================

interface Worker {
  id: number;
  busy: boolean;
  currentJobId?: string;
  currentFileId?: string;
  assignedAt?: number; // Timestamp when work was assigned
}

// ============================================================================
// BULK UPLOAD QUEUE CLASS
// ============================================================================

export class BulkUploadQueue {
  private config: QueueConfig;
  private pendingQueue: PriorityQueue<QueueJob>;
  private jobs: Map<string, QueueJob>;
  private workers: Worker[];
  private isProcessing: boolean = false;
  private processingPromise: Promise<void> | null = null;
  private initialized: boolean = false;
  private shutdownRequested: boolean = false;
  private initializationPromise: Promise<void> | null = null;
  private workerLock: boolean = false; // Mutex for worker assignment

  constructor(config: Partial<QueueConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.pendingQueue = new PriorityQueue();
    this.jobs = new Map();
    this.workers = [];

    // Initialize workers
    for (let i = 0; i < this.config.maxConcurrentWorkers; i++) {
      this.workers.push({ id: i, busy: false });
    }
  }

  // ========================================================================
  // INITIALIZATION & PERSISTENCE
  // ========================================================================

  async initialize(): Promise<void> {
    // Return existing promise if initialization is in progress
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    if (this.initialized) return;

    this.initializationPromise = this._doInitialize();
    return this.initializationPromise;
  }

  private async _doInitialize(): Promise<void> {
    logger.info('[Queue] Initializing bulk upload queue...');

    try {
      // Ensure persistence directory exists
      if (!existsSync(this.config.persistenceDir)) {
        mkdirSync(this.config.persistenceDir, { recursive: true });
      }

      // Load persisted jobs
      await this.loadPersistedJobs();

      this.initialized = true;
      logger.info(`[Queue] Initialized with ${this.config.maxConcurrentWorkers} workers`);

      // Start processing queue
      this.startProcessing();
    } catch (error) {
      this.initializationPromise = null;
      throw error;
    }
  }

  private async loadPersistedJobs(): Promise<void> {
    const persistencePath = path.join(this.config.persistenceDir, 'queue-state.json');

    try {
      if (existsSync(persistencePath)) {
        const data = await readFile(persistencePath, 'utf-8');
        const persistedState = JSON.parse(data) as { jobs: QueueJob[] };

        for (const job of persistedState.jobs) {
          // Reset processing jobs to pending on restart
          if (job.state === 'processing') {
            job.state = 'pending';
            job.files.forEach((f) => {
              if (f.state === 'processing') {
                f.state = 'pending';
              }
            });
            job.progress.processing = 0;
          }

          this.jobs.set(job.id, job);

          if (job.state === 'pending') {
            this.pendingQueue.enqueue(job);
          }
        }

        logger.info(`[Queue] Loaded ${persistedState.jobs.length} persisted jobs`);
      }
    } catch (error) {
      logger.warn('[Queue] Failed to load persisted jobs, starting fresh', error);
    }
  }

  private async persistJobs(): Promise<void> {
    const persistencePath = path.join(this.config.persistenceDir, 'queue-state.json');

    try {
      const jobs = Array.from(this.jobs.values());
      await writeFile(persistencePath, JSON.stringify({ jobs }, null, 2));
    } catch (error) {
      logger.error('[Queue] Failed to persist jobs', error);
    }
  }

  // ========================================================================
  // PUBLIC API
  // ========================================================================

  /**
   * Add a batch of files to the upload queue
   */
  async addJob(files: FileInfo[], userId: string, options: AddJobOptions = {}): Promise<QueueJob> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Validate batch size
    if (files.length > this.config.maxBatchSize) {
      throw new BatchSizeExceededError(files.length, this.config.maxBatchSize);
    }

    if (files.length === 0) {
      throw new QueueError('No files provided', 'EMPTY_BATCH');
    }

    const jobId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Save files to disk and create JobFile entries
    const jobFiles: JobFile[] = [];

    for (const file of files) {
      const fileId = crypto.randomUUID();
      // Sanitize filename: remove path separators, limit length, only allow safe characters
      const sanitizedName = path
        .basename(file.name)
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .slice(0, 100); // Limit filename length
      const safeFilename = `${fileId}_${sanitizedName}`;

      // Build path and verify it stays within persistence directory
      const baseDir = path.resolve(this.config.persistenceDir, 'files', jobId);
      const filePath = path.resolve(baseDir, safeFilename);

      // Security check: ensure the resolved path is within the expected directory
      if (!filePath.startsWith(baseDir)) {
        throw new QueueError(`Invalid filename: ${file.name}`, 'INVALID_FILENAME', {
          filename: file.name,
        });
      }

      // Ensure directory exists
      const fileDir = path.dirname(filePath);
      if (!existsSync(fileDir)) {
        mkdirSync(fileDir, { recursive: true });
      }

      // Write file to disk
      const buffer = Buffer.isBuffer(file.buffer) ? file.buffer : Buffer.from(file.buffer);
      await writeFile(filePath, buffer);

      jobFiles.push({
        id: fileId,
        filename: safeFilename,
        originalName: file.name,
        size: file.size,
        mimeType: file.type,
        filePath,
        state: 'pending',
        retryCount: 0,
      });
    }

    const job: QueueJob = {
      id: jobId,
      userId,
      files: jobFiles,
      priority: options.priority || 'normal',
      state: 'pending',
      progress: {
        total: files.length,
        completed: 0,
        failed: 0,
        processing: 0,
      },
      createdAt: now,
      retryCount: 0,
      metadata: options.metadata,
    };

    this.jobs.set(jobId, job);
    this.pendingQueue.enqueue(job);

    await this.persistJobs();

    // Emit job created event
    this.emitJobEvent(job, 'job_created');

    logger.info(`[Queue] Job ${jobId} created with ${files.length} files for user ${userId}`);

    // Trigger processing
    this.triggerProcessing();

    return job;
  }

  /**
   * Get the status of a specific job
   */
  getJobStatus(jobId: string): QueueJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get all jobs for a user
   */
  getUserJobs(userId: string): QueueJob[] {
    return Array.from(this.jobs.values())
      .filter((job) => job.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Cancel a pending or processing job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);

    if (!job) {
      throw new JobNotFoundError(jobId);
    }

    if (job.state === 'completed' || job.state === 'cancelled') {
      return false;
    }

    // Remove from pending queue if present
    this.pendingQueue.remove((j) => j.id === jobId);

    // Update job state
    job.state = 'cancelled';
    job.completedAt = new Date().toISOString();

    // Cancel any pending files
    job.files.forEach((file) => {
      if (file.state === 'pending' || file.state === 'processing') {
        file.state = 'cancelled';
      }
    });

    await this.persistJobs();

    // Emit cancellation event
    this.emitJobEvent(job, 'job_cancelled');

    logger.info(`[Queue] Job ${jobId} cancelled`);

    return true;
  }

  /**
   * Boost the priority of a pending job
   */
  boostPriority(jobId: string, newPriority: JobPriority): boolean {
    const job = this.jobs.get(jobId);

    if (!job || job.state !== 'pending') {
      return false;
    }

    const boosted = this.pendingQueue.boostPriority((j) => j.id === jobId, newPriority);

    if (boosted) {
      job.priority = newPriority;
      this.emitJobEvent(job, 'job_priority_changed');
      logger.info(`[Queue] Job ${jobId} priority boosted to ${newPriority}`);
    }

    return boosted;
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);

    if (!job || job.state !== 'failed') {
      return false;
    }

    // Reset job state
    job.state = 'pending';
    job.error = undefined;
    job.completedAt = undefined;
    job.progress.failed = 0;
    job.progress.processing = 0;
    job.retryCount++;

    // Reset failed files
    job.files.forEach((file) => {
      if (file.state === 'failed') {
        file.state = 'pending';
        file.error = undefined;
        file.retryCount = 0;
      }
    });

    this.pendingQueue.enqueue(job);
    await this.persistJobs();

    this.emitJobEvent(job, 'job_retrying');
    logger.info(`[Queue] Job ${jobId} queued for retry (attempt ${job.retryCount + 1})`);

    this.triggerProcessing();

    return true;
  }

  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    const jobs = Array.from(this.jobs.values());
    const completedJobs = jobs.filter((j) => j.state === 'completed');

    let totalProcessingTime = 0;
    let processedCount = 0;

    for (const job of completedJobs) {
      if (job.startedAt && job.completedAt) {
        totalProcessingTime +=
          new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime();
        processedCount++;
      }
    }

    return {
      totalJobs: jobs.length,
      pendingJobs: jobs.filter((j) => j.state === 'pending').length,
      processingJobs: jobs.filter((j) => j.state === 'processing').length,
      completedJobs: completedJobs.length,
      failedJobs: jobs.filter((j) => j.state === 'failed').length,
      cancelledJobs: jobs.filter((j) => j.state === 'cancelled').length,
      totalFilesProcessed: completedJobs.reduce((sum, j) => sum + j.progress.completed, 0),
      averageProcessingTimeMs: processedCount > 0 ? totalProcessingTime / processedCount : 0,
      workersActive: this.workers.filter((w) => w.busy).length,
      workersTotal: this.workers.length,
    };
  }

  /**
   * Clean up old completed jobs
   */
  async cleanup(): Promise<number> {
    const cutoffTime = Date.now() - this.config.cleanupCompletedAfterMs;
    let cleaned = 0;

    for (const [jobId, job] of this.jobs.entries()) {
      if (
        (job.state === 'completed' || job.state === 'cancelled') &&
        job.completedAt &&
        new Date(job.completedAt).getTime() < cutoffTime
      ) {
        // Delete associated files
        for (const file of job.files) {
          try {
            if (existsSync(file.filePath)) {
              await unlink(file.filePath);
            }
          } catch (e) {
            logger.warn(`[Queue] Failed to delete file ${file.filePath}`, e);
          }
        }

        this.jobs.delete(jobId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      await this.persistJobs();
      logger.info(`[Queue] Cleaned up ${cleaned} old jobs`);
    }

    return cleaned;
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('[Queue] Shutdown requested, waiting for workers to complete...');
    this.shutdownRequested = true;

    // Wait for current processing to complete
    if (this.processingPromise) {
      await this.processingPromise;
    }

    await this.persistJobs();
    logger.info('[Queue] Shutdown complete');
  }

  // ========================================================================
  // QUEUE PROCESSING
  // ========================================================================

  private triggerProcessing(): void {
    if (!this.isProcessing && !this.shutdownRequested) {
      this.processingPromise = this.processQueue();
    }
  }

  private startProcessing(): void {
    if (!this.isProcessing) {
      this.triggerProcessing();
    }
  }

  /**
   * Acquire worker lock to prevent race conditions in worker assignment
   */
  private async acquireWorkerLock(): Promise<boolean> {
    if (this.workerLock) return false;
    this.workerLock = true;
    return true;
  }

  private releaseWorkerLock(): void {
    this.workerLock = false;
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    logger.debug('[Queue] Starting queue processing cycle');

    try {
      while (!this.shutdownRequested) {
        // Acquire lock to prevent race conditions
        if (!(await this.acquireWorkerLock())) {
          await this.sleep(50);
          continue;
        }

        try {
          // Find available workers (double-check under lock)
          const availableWorkers = this.workers.filter((w) => !w.busy);

          if (availableWorkers.length === 0) {
            // All workers busy, wait a bit
            this.releaseWorkerLock();
            await this.sleep(100);
            continue;
          }

          // Get next pending job or file
          const nextWork = this.getNextWork();

          if (!nextWork) {
            // No work available, exit processing loop
            this.releaseWorkerLock();
            break;
          }

          const worker = availableWorkers[0];
          // Mark worker as busy BEFORE releasing lock
          worker.busy = true;
          worker.currentJobId = nextWork.job.id;
          worker.currentFileId = nextWork.file.id;
          worker.assignedAt = Date.now();

          this.releaseWorkerLock();

          // Process in background (don't await)
          this.processFileWithWorker(worker, nextWork.job, nextWork.file)
            .catch((err) => {
              logger.error(`[Queue] Worker ${worker.id} error`, err);
            })
            .finally(() => {
              worker.busy = false;
              worker.currentJobId = undefined;
              worker.currentFileId = undefined;
              worker.assignedAt = undefined;
              // Trigger next processing cycle
              if (!this.shutdownRequested) {
                setImmediate(() => this.triggerProcessing());
              }
            });
        } catch (error) {
          this.releaseWorkerLock();
          throw error;
        }
      }
    } finally {
      this.isProcessing = false;
      this.processingPromise = null;
    }
  }

  private getNextWork(): { job: QueueJob; file: JobFile } | null {
    // First, check jobs already in processing state for pending files
    for (const job of this.jobs.values()) {
      if (job.state === 'processing') {
        const pendingFile = job.files.find((f) => f.state === 'pending');
        if (pendingFile) {
          return { job, file: pendingFile };
        }
      }
    }

    // Then get next job from pending queue
    const nextJob = this.pendingQueue.peek();

    if (nextJob) {
      const pendingFile = nextJob.files.find((f) => f.state === 'pending');
      if (pendingFile) {
        // Move job to processing state
        if (nextJob.state === 'pending') {
          nextJob.state = 'processing';
          nextJob.startedAt = new Date().toISOString();
          this.pendingQueue.dequeue();
          this.emitJobEvent(nextJob, 'job_started');
        }
        return { job: nextJob, file: pendingFile };
      }
    }

    return null;
  }

  private async processFileWithWorker(worker: Worker, job: QueueJob, file: JobFile): Promise<void> {
    logger.info(
      `[Queue] Worker ${worker.id} processing file ${file.originalName} from job ${job.id}`,
    );

    file.state = 'processing';
    job.progress.processing++;

    this.emitFileEvent(job, file, 'file_processing');

    // Create a timeout promise for this file processing
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(
          new QueueError(
            `File processing timed out after ${this.config.jobTimeoutMs}ms`,
            'PROCESSING_TIMEOUT',
          ),
        );
      }, this.config.jobTimeoutMs);
    });

    try {
      // Create statement record and process through pipeline with timeout
      const statementId = await Promise.race([
        this.createStatementAndProcess(job.userId, file),
        timeoutPromise,
      ]);

      file.state = 'completed';
      file.statementId = statementId;
      file.processedAt = new Date().toISOString();

      job.progress.processing--;
      job.progress.completed++;

      this.emitFileEvent(job, file, 'file_completed');
      logger.info(`[Queue] File ${file.originalName} completed successfully`);
    } catch (error: unknown) {
      logger.error(`[Queue] File ${file.originalName} failed`, error);

      file.retryCount++;
      job.progress.processing--;

      // Don't retry timeout errors
      const errObj = error instanceof Error ? error as Error & { code?: string } : null;
      const isTimeout = errObj?.code === 'PROCESSING_TIMEOUT';
      const canRetry = !isTimeout && file.retryCount < this.config.maxRetries;

      if (canRetry) {
        // Queue for retry with exponential backoff
        const delay =
          this.config.retryDelayMs *
          Math.pow(this.config.retryBackoffMultiplier, file.retryCount - 1);
        logger.info(
          `[Queue] File ${file.originalName} will retry in ${delay}ms (attempt ${file.retryCount + 1})`,
        );

        file.state = 'pending';
        this.emitFileEvent(job, file, 'file_retrying');

        setTimeout(() => {
          this.triggerProcessing();
        }, delay);
      } else {
        file.state = 'failed';
        file.error = errObj?.message || 'Unknown error';
        job.progress.failed++;

        this.emitFileEvent(job, file, 'file_failed');
      }
    }

    // Check if job is complete
    await this.checkJobCompletion(job);
    await this.persistJobs();
  }

  private async createStatementAndProcess(userId: string, file: JobFile): Promise<string> {
    // Read file content and compute hash
    const fileBuffer = await readFile(file.filePath);
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // Check for duplicate
    const existingStatement = await this.findStatementByHash(hash);
    if (existingStatement) {
      throw new QueueError(`Duplicate file: ${file.originalName}`, 'DUPLICATE_FILE', { hash });
    }

    // Create statement record
    const statementId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Insert into statements table
    const { statements } = await import('../schema.js');
    await db.insert(statements).values({
      id: statementId,
      filename: file.originalName,
      hash,
      uploadDate: now,
      parsingStatus: 'PENDING',
      userId,
    });

    // Process through pipeline
    await pipeline.processStatement(statementId, file.filePath);

    return statementId;
  }

  private async findStatementByHash(hash: string): Promise<any> {
    const { statements } = await import('../schema.js');
    const { eq } = await import('drizzle-orm');
    return db.select().from(statements).where(eq(statements.hash, hash)).get();
  }

  private async checkJobCompletion(job: QueueJob): Promise<void> {
    const pendingFiles = job.files.filter((f) => f.state === 'pending' || f.state === 'processing');

    if (pendingFiles.length === 0) {
      // All files processed
      const hasFailures = job.progress.failed > 0;

      job.state = hasFailures && job.progress.completed === 0 ? 'failed' : 'completed';
      job.completedAt = new Date().toISOString();

      if (hasFailures) {
        job.error = `${job.progress.failed} of ${job.progress.total} files failed`;
      }

      this.emitJobEvent(job, job.state === 'completed' ? 'job_completed' : 'job_failed');

      logger.info(
        `[Queue] Job ${job.id} ${job.state}: ${job.progress.completed} completed, ${job.progress.failed} failed`,
      );
    }
  }

  // ========================================================================
  // SSE EVENT EMISSION
  // ========================================================================

  private emitJobEvent(job: QueueJob, eventType: string): void {
    events.emit('update', {
      type: 'queue_' + eventType,
      jobId: job.id,
      userId: job.userId,
      state: job.state,
      priority: job.priority,
      progress: job.progress,
      error: job.error,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
    });
  }

  private emitFileEvent(job: QueueJob, file: JobFile, eventType: string): void {
    events.emit('update', {
      type: 'queue_' + eventType,
      jobId: job.id,
      userId: job.userId,
      fileId: file.id,
      filename: file.originalName,
      fileState: file.state,
      statementId: file.statementId,
      error: file.error,
      retryCount: file.retryCount,
      progress: job.progress,
    });
  }

  // ========================================================================
  // UTILITIES
  // ========================================================================

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const bulkUploadQueue = new BulkUploadQueue();

// Auto-initialize on module load
bulkUploadQueue.initialize().catch((err) => {
  logger.error('[Queue] Failed to auto-initialize', err);
});

// Cleanup job on process exit
process.on('SIGTERM', async () => {
  await bulkUploadQueue.shutdown();
});

process.on('SIGINT', async () => {
  await bulkUploadQueue.shutdown();
});
