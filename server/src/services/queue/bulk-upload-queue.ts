/** BulkUploadQueue — Main queue class with worker-based processing. */
import { logger } from '../../utils/logger.js';
import { existsSync, mkdirSync } from 'fs';
import crypto from 'crypto';
import type {
  QueueConfig,
  QueueJob,
  QueueStats,
  FileInfo,
  AddJobOptions,
  JobFile,
  Worker,
} from './types.js';
import { DEFAULT_CONFIG, BatchSizeExceededError, QueueError } from './types.js';
import { PriorityQueue } from './scheduler.js';
import { processFileWithWorker, checkJobCompletion, emitJobEvent } from './job-processor.js';
import { loadPersistedJobs, persistJobsToDisk, writeJobFiles } from './queue-persistence.js';
import { computeQueueStats, cleanupOldJobs } from './queue-stats.js';

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
  private workerLock: boolean = false;

  constructor(config: Partial<QueueConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.pendingQueue = new PriorityQueue();
    this.jobs = new Map();
    this.workers = [];

    for (let i = 0; i < this.config.maxConcurrentWorkers; i++) {
      this.workers.push({ id: i, busy: false });
    }
  }

  async initialize(): Promise<void> {
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
      if (!existsSync(this.config.persistenceDir)) {
        mkdirSync(this.config.persistenceDir, { recursive: true });
      }
      const persisted = await loadPersistedJobs(this.config.persistenceDir);
      for (const job of persisted) {
        this.jobs.set(job.id, job);
        if (job.state === 'pending') {
          this.pendingQueue.enqueue(job);
        }
      }
      this.initialized = true;
      logger.info(`[Queue] Initialized with ${this.config.maxConcurrentWorkers} workers`);
      this.startProcessing();
    } catch (error) {
      this.initializationPromise = null;
      throw error;
    }
  }

  private async persistJobs(): Promise<void> {
    return persistJobsToDisk(this.config.persistenceDir, this.jobs);
  }

  async addJob(files: FileInfo[], userId: string, options: AddJobOptions = {}): Promise<QueueJob> {
    if (!this.initialized) {
      await this.initialize();
    }
    if (files.length > this.config.maxBatchSize) {
      throw new BatchSizeExceededError(files.length, this.config.maxBatchSize);
    }
    if (files.length === 0) {
      throw new QueueError('No files provided', 'EMPTY_BATCH');
    }

    const jobId = crypto.randomUUID();
    const now = new Date().toISOString();
    const jobFiles = await writeJobFiles(files, this.config.persistenceDir, jobId);

    const job: QueueJob = {
      id: jobId,
      userId,
      files: jobFiles,
      priority: options.priority || 'normal',
      state: 'pending',
      progress: { total: files.length, completed: 0, failed: 0, processing: 0 },
      createdAt: now,
      retryCount: 0,
      metadata: options.metadata,
    };

    this.jobs.set(jobId, job);
    this.pendingQueue.enqueue(job);
    await this.persistJobs();
    emitJobEvent(job, 'job_created');
    logger.info(`[Queue] Job ${jobId} created with ${files.length} files for user ${userId}`);
    this.triggerProcessing();
    return job;
  }

  getJobStatus(jobId: string): QueueJob | undefined {
    return this.jobs.get(jobId);
  }

  getUserJobs(userId: string): QueueJob[] {
    return Array.from(this.jobs.values())
      .filter((job) => job.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) {
      const { JobNotFoundError } = await import('./types.js');
      throw new JobNotFoundError(jobId);
    }
    if (job.state === 'completed' || job.state === 'cancelled') return false;
    this.pendingQueue.remove((j) => j.id === jobId);
    job.state = 'cancelled';
    job.completedAt = new Date().toISOString();
    job.files.forEach((file) => {
      if (file.state === 'pending' || file.state === 'processing') {
        file.state = 'cancelled';
      }
    });
    await this.persistJobs();
    emitJobEvent(job, 'job_cancelled');
    logger.info(`[Queue] Job ${jobId} cancelled`);
    return true;
  }

  boostPriority(jobId: string, newPriority: import('./types.js').JobPriority): boolean {
    const job = this.jobs.get(jobId);
    if (!job || job.state !== 'pending') return false;
    const boosted = this.pendingQueue.boostPriority((j) => j.id === jobId, newPriority);
    if (boosted) {
      job.priority = newPriority;
      emitJobEvent(job, 'job_priority_changed');
      logger.info(`[Queue] Job ${jobId} priority boosted to ${newPriority}`);
    }
    return boosted;
  }

  async retryJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job || job.state !== 'failed') return false;
    job.state = 'pending';
    job.error = undefined;
    job.completedAt = undefined;
    job.progress.failed = 0;
    job.progress.processing = 0;
    job.retryCount++;
    job.files.forEach((file) => {
      if (file.state === 'failed') {
        file.state = 'pending';
        file.error = undefined;
        file.retryCount = 0;
      }
    });
    this.pendingQueue.enqueue(job);
    await this.persistJobs();
    emitJobEvent(job, 'job_retrying');
    logger.info(`[Queue] Job ${jobId} queued for retry (attempt ${job.retryCount + 1})`);
    this.triggerProcessing();
    return true;
  }

  getStats(): QueueStats {
    return computeQueueStats(this.jobs, this.workers);
  }

  async cleanup(): Promise<number> {
    const cleaned = await cleanupOldJobs(this.jobs, this.config);
    if (cleaned > 0) {
      await this.persistJobs();
    }
    return cleaned;
  }

  async shutdown(): Promise<void> {
    logger.info('[Queue] Shutdown requested, waiting for workers to complete...');
    this.shutdownRequested = true;
    if (this.processingPromise) {
      await this.processingPromise;
    }
    await this.persistJobs();
    logger.info('[Queue] Shutdown complete');
  }

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
        if (!(await this.acquireWorkerLock())) {
          await this.sleep(50);
          continue;
        }
        try {
          const availableWorkers = this.workers.filter((w) => !w.busy);
          if (availableWorkers.length === 0) {
            this.releaseWorkerLock();
            await this.sleep(100);
            continue;
          }
          const nextWork = this.getNextWork();
          if (!nextWork) {
            this.releaseWorkerLock();
            break;
          }
          const worker = availableWorkers[0];
          worker.busy = true;
          worker.currentJobId = nextWork.job.id;
          worker.currentFileId = nextWork.file.id;
          worker.assignedAt = Date.now();
          this.releaseWorkerLock();

          processFileWithWorker(
            worker,
            nextWork.job,
            nextWork.file,
            this.config,
            () => this.persistJobs(),
            (job) => checkJobCompletion(job),
          )
            .catch((err) => {
              logger.error({ err }, `[Queue] Worker ${worker.id} error`);
            })
            .finally(() => {
              worker.busy = false;
              worker.currentJobId = undefined;
              worker.currentFileId = undefined;
              worker.assignedAt = undefined;
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
    for (const job of this.jobs.values()) {
      if (job.state === 'processing') {
        const pendingFile = job.files.find((f) => f.state === 'pending');
        if (pendingFile) return { job, file: pendingFile };
      }
    }
    const nextJob = this.pendingQueue.peek();
    if (nextJob) {
      const pendingFile = nextJob.files.find((f) => f.state === 'pending');
      if (pendingFile) {
        if (nextJob.state === 'pending') {
          nextJob.state = 'processing';
          nextJob.startedAt = new Date().toISOString();
          this.pendingQueue.dequeue();
          emitJobEvent(nextJob, 'job_started');
        }
        return { job: nextJob, file: pendingFile };
      }
    }
    return null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
