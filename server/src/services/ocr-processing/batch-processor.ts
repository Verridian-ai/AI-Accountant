import { logger } from '../../utils/logger.js';
import { processDocument } from './vision-extractor.js';

export async function processBatch(
  userId: string,
  documentIds: string[],
): Promise<{ processed: number; failed: number; errors: string[] }> {
  let processed = 0,
    failed = 0;
  const errors: string[] = [];
  for (const docId of documentIds) {
    try {
      await processDocument(docId);
      processed++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      failed++;
      errors.push(`${docId}: ${msg}`);
      logger.warn(`[OCR] Batch item ${docId} failed: ${msg}`);
    }
    if (documentIds.indexOf(docId) < documentIds.length - 1)
      await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  logger.info(`[OCR] Batch complete for user ${userId}: ${processed} processed, ${failed} failed`);
  return { processed, failed, errors };
}
