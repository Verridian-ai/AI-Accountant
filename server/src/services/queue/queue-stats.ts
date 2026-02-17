/**
 * Queue Stats & Cleanup — Pure functions for computing queue statistics
 * and cleaning up completed/cancelled jobs.
 */

import { logger } from '../../utils/logger.js';
import { existsSync } from 'fs';
import { unlink } from 'fs/promises';
import type { QueueConfig, QueueJob, QueueStats, Worker } from './types.js';

/**
 * Compute aggregate queue statistics from jobs and workers.
 */
export function computeQueueStats(jobs: Map<string, QueueJob>, workers: Worker[]): QueueStats {
  const jobArray = Array.from(jobs.values());
  const completedJobs = jobArray.filter((j) => j.state === 'completed');
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
    totalJobs: jobArray.length,
    pendingJobs: jobArray.filter((j) => j.state === 'pending').length,
    processingJobs: jobArray.filter((j) => j.state === 'processing').length,
    completedJobs: completedJobs.length,
    failedJobs: jobArray.filter((j) => j.state === 'failed').length,
    cancelledJobs: jobArray.filter((j) => j.state === 'cancelled').length,
    totalFilesProcessed: completedJobs.reduce((sum, j) => sum + j.progress.completed, 0),
    averageProcessingTimeMs: processedCount > 0 ? totalProcessingTime / processedCount : 0,
    workersActive: workers.filter((w) => w.busy).length,
    workersTotal: workers.length,
  };
}

/**
 * Remove completed/cancelled jobs older than the configured cutoff.
 * Deletes associated files from disk. Returns number of cleaned jobs.
 */
export async function cleanupOldJobs(
  jobs: Map<string, QueueJob>,
  config: QueueConfig,
): Promise<number> {
  const cutoffTime = Date.now() - config.cleanupCompletedAfterMs;
  let cleaned = 0;
  for (const [jobId, job] of jobs.entries()) {
    if (
      (job.state === 'completed' || job.state === 'cancelled') &&
      job.completedAt &&
      new Date(job.completedAt).getTime() < cutoffTime
    ) {
      for (const file of job.files) {
        try {
          if (existsSync(file.filePath)) {
            await unlink(file.filePath);
          }
        } catch (e) {
          logger.warn({ err: e }, `[Queue] Failed to delete file ${file.filePath}`);
        }
      }
      jobs.delete(jobId);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    logger.info(`[Queue] Cleaned up ${cleaned} old jobs`);
  }
  return cleaned;
}
