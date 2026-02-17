/**
 * Queue Persistence — load and save queue state to disk.
 */

import { logger } from '../../utils/logger.js';
import { writeFile, readFile } from 'fs/promises';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';
import crypto from 'crypto';
import type { QueueJob, FileInfo, JobFile } from './types.js';
import { QueueError } from './types.js';

/**
 * Load persisted jobs from disk. Processing jobs are reset to pending.
 */
export async function loadPersistedJobs(persistenceDir: string): Promise<QueueJob[]> {
  const persistencePath = path.join(persistenceDir, 'queue-state.json');
  try {
    if (existsSync(persistencePath)) {
      const data = await readFile(persistencePath, 'utf-8');
      const persistedState = JSON.parse(data) as { jobs: QueueJob[] };
      for (const job of persistedState.jobs) {
        if (job.state === 'processing') {
          job.state = 'pending';
          job.files.forEach((f) => {
            if (f.state === 'processing') {
              f.state = 'pending';
            }
          });
          job.progress.processing = 0;
        }
      }
      logger.info(`[Queue] Loaded ${persistedState.jobs.length} persisted jobs`);
      return persistedState.jobs;
    }
  } catch (error) {
    logger.warn({ err: error }, '[Queue] Failed to load persisted jobs, starting fresh');
  }
  return [];
}

/**
 * Persist current jobs to disk.
 */
export async function persistJobsToDisk(
  persistenceDir: string,
  jobs: Map<string, QueueJob>,
): Promise<void> {
  const persistencePath = path.join(persistenceDir, 'queue-state.json');
  try {
    const jobArray = Array.from(jobs.values());
    await writeFile(persistencePath, JSON.stringify({ jobs: jobArray }, null, 2));
  } catch (error) {
    logger.error({ err: error }, '[Queue] Failed to persist jobs');
  }
}

/**
 * Write uploaded files to disk and return JobFile descriptors.
 */
export async function writeJobFiles(
  files: FileInfo[],
  persistenceDir: string,
  jobId: string,
): Promise<JobFile[]> {
  const jobFiles: JobFile[] = [];

  for (const file of files) {
    const fileId = crypto.randomUUID();
    const sanitizedName = path
      .basename(file.name)
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 100);
    const safeFilename = `${fileId}_${sanitizedName}`;
    const baseDir = path.resolve(persistenceDir, 'files', jobId);
    const filePath = path.resolve(baseDir, safeFilename);
    if (!filePath.startsWith(baseDir)) {
      throw new QueueError(`Invalid filename: ${file.name}`, 'INVALID_FILENAME', {
        filename: file.name,
      });
    }
    const fileDir = path.dirname(filePath);
    if (!existsSync(fileDir)) {
      mkdirSync(fileDir, { recursive: true });
    }
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

  return jobFiles;
}
