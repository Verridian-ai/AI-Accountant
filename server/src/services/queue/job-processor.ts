import { db } from '../../schema.js';
import { pipeline } from '../pipeline.js';
import { logger } from '../../utils/logger.js';
import { events } from '../../events.js';
import crypto from 'crypto';
import { readFile } from 'fs/promises';
import type { QueueJob, JobFile, QueueConfig, Worker } from './types.js';
import { QueueError } from './types.js';

// ============================================================================
// FILE PROCESSING
// ============================================================================

export async function processFileWithWorker(
  worker: Worker,
  job: QueueJob,
  file: JobFile,
  queueConfig: QueueConfig,
  persistJobs: () => Promise<void>,
  checkJobCompletion: (job: QueueJob) => Promise<void>,
): Promise<void> {
  logger.info(
    `[Queue] Worker ${worker.id} processing file ${file.originalName} from job ${job.id}`,
  );

  file.state = 'processing';
  job.progress.processing++;

  emitFileEvent(job, file, 'file_processing');

  // Create a timeout promise for this file processing
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(
        new QueueError(
          `File processing timed out after ${queueConfig.jobTimeoutMs}ms`,
          'PROCESSING_TIMEOUT',
        ),
      );
    }, queueConfig.jobTimeoutMs);
  });

  try {
    // Create statement record and process through pipeline with timeout
    const statementId = await Promise.race([
      createStatementAndProcess(job.userId, file),
      timeoutPromise,
    ]);

    file.state = 'completed';
    file.statementId = statementId;
    file.processedAt = new Date().toISOString();

    job.progress.processing--;
    job.progress.completed++;

    emitFileEvent(job, file, 'file_completed');
    logger.info(`[Queue] File ${file.originalName} completed successfully`);
  } catch (error: unknown) {
    logger.error({ err: error }, `[Queue] File ${file.originalName} failed`);

    file.retryCount++;
    job.progress.processing--;

    // Don't retry timeout errors
    const isTimeout = (error as NodeJS.ErrnoException).code === 'PROCESSING_TIMEOUT';
    const canRetry = !isTimeout && file.retryCount < queueConfig.maxRetries;

    if (canRetry) {
      // Queue for retry with exponential backoff
      const delay =
        queueConfig.retryDelayMs *
        Math.pow(queueConfig.retryBackoffMultiplier, file.retryCount - 1);
      logger.info(
        `[Queue] File ${file.originalName} will retry in ${delay}ms (attempt ${file.retryCount + 1})`,
      );

      file.state = 'pending';
      emitFileEvent(job, file, 'file_retrying');

      // Return the delay so the caller can schedule reprocessing
      setTimeout(() => {
        // This will be picked up by the next processing cycle
      }, delay);
    } else {
      file.state = 'failed';
      file.error = error instanceof Error ? error.message : String(error) || 'Unknown error';
      job.progress.failed++;

      emitFileEvent(job, file, 'file_failed');
    }
  }

  // Check if job is complete
  await checkJobCompletion(job);
  await persistJobs();
}

// ============================================================================
// STATEMENT CREATION & PROCESSING
// ============================================================================

async function createStatementAndProcess(userId: string, file: JobFile): Promise<string> {
  // Read file content and compute hash
  const fileBuffer = await readFile(file.filePath);
  const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

  // Check for duplicate
  const existingStatement = await findStatementByHash(hash);
  if (existingStatement) {
    throw new QueueError(`Duplicate file: ${file.originalName}`, 'DUPLICATE_FILE', { hash });
  }

  // Create statement record
  const statementId = crypto.randomUUID();
  const now = new Date().toISOString();

  // Insert into statements table
  const { statements } = await import('../../schema.js');
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

async function findStatementByHash(hash: string): Promise<any> {
  const { statements } = await import('../../schema.js');
  const { eq } = await import('drizzle-orm');
  return db.select().from(statements).where(eq(statements.hash, hash)).get();
}

// ============================================================================
// JOB COMPLETION CHECK
// ============================================================================

export async function checkJobCompletion(job: QueueJob): Promise<void> {
  const pendingFiles = job.files.filter((f) => f.state === 'pending' || f.state === 'processing');

  if (pendingFiles.length === 0) {
    const hasFailures = job.progress.failed > 0;

    job.state = hasFailures && job.progress.completed === 0 ? 'failed' : 'completed';
    job.completedAt = new Date().toISOString();

    if (hasFailures) {
      job.error = `${job.progress.failed} of ${job.progress.total} files failed`;
    }

    emitJobEvent(job, job.state === 'completed' ? 'job_completed' : 'job_failed');

    logger.info(
      `[Queue] Job ${job.id} ${job.state}: ${job.progress.completed} completed, ${job.progress.failed} failed`,
    );
  }
}

// ============================================================================
// SSE EVENT EMISSION
// ============================================================================

export function emitJobEvent(job: QueueJob, eventType: string): void {
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

export function emitFileEvent(job: QueueJob, file: JobFile, eventType: string): void {
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
