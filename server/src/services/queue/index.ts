/**
 * Queue Module — Barrel Export
 *
 * Re-exports all public types, errors, classes, and the singleton instance.
 */

export * from './types.js';
export { PriorityQueue } from './scheduler.js';
export {
  processFileWithWorker,
  checkJobCompletion,
  emitJobEvent,
  emitFileEvent,
} from './job-processor.js';
export { BulkUploadQueue } from './bulk-upload-queue.js';

import { BulkUploadQueue } from './bulk-upload-queue.js';
import { logger } from '../../utils/logger.js';

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const bulkUploadQueue = new BulkUploadQueue();

// Auto-initialize on module load
bulkUploadQueue.initialize().catch((err) => {
  logger.error({ err }, '[Queue] Failed to auto-initialize');
});

// Cleanup job on process exit
process.on('SIGTERM', async () => {
  await bulkUploadQueue.shutdown();
});

process.on('SIGINT', async () => {
  await bulkUploadQueue.shutdown();
});
