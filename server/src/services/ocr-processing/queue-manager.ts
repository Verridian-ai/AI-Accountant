import { randomUUID } from 'crypto';
import { eq, asc } from 'drizzle-orm';
import { db, ocrDocuments, documentQueue } from '../../schema.js';
import { logger } from '../../utils/logger.js';
import { processDocument } from './vision-extractor.js';
import { classifyDocument } from './classifier.js';

export async function enqueueDocument(
  documentId: string,
  action: string,
  priority: number = 100,
): Promise<void> {
  const doc = await db.select().from(ocrDocuments).where(eq(ocrDocuments.id, documentId)).get();
  if (!doc) throw new Error(`Document not found: ${documentId}`);
  const docRecord = doc as Record<string, unknown>;
  const now = new Date().toISOString();
  await db
    .insert(documentQueue)
    .values({
      id: randomUUID(),
      userId: docRecord.userId as string,
      documentId,
      action,
      priority,
      status: 'queued',
      attempts: 0,
      maxAttempts: 3,
      scheduledAt: now,
      createdAt: now,
    })
    .run();
  logger.info(`[OCR] Enqueued document ${documentId} for action: ${action} (priority ${priority})`);
}

export async function processQueue(limit: number = 10): Promise<void> {
  const items = await db
    .select()
    .from(documentQueue)
    .where(eq(documentQueue.status, 'queued'))
    .orderBy(asc(documentQueue.priority), asc(documentQueue.scheduledAt))
    .limit(limit)
    .all();

  for (const item of items) {
    const itemRecord = item as Record<string, unknown>;
    const now = new Date().toISOString();
    await db
      .update(documentQueue)
      .set({
        status: 'processing',
        attempts: ((itemRecord.attempts as number) ?? 0) + 1,
        startedAt: now,
      })
      .where(eq(documentQueue.id, itemRecord.id as string))
      .run();
    try {
      switch (itemRecord.action) {
        case 'ocr_extract':
          await processDocument(itemRecord.documentId as string);
          break;
        case 'classify':
          await classifyDocument(itemRecord.documentId as string);
          break;
        default:
          throw new Error(`Unknown queue action: ${itemRecord.action}`);
      }
      await db
        .update(documentQueue)
        .set({ status: 'completed', completedAt: new Date().toISOString() })
        .where(eq(documentQueue.id, itemRecord.id as string))
        .run();
      logger.info(`[OCR] Queue item ${itemRecord.id} completed (action: ${itemRecord.action})`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const attempts = ((itemRecord.attempts as number) ?? 0) + 1;
      const maxAttempts = (itemRecord.maxAttempts as number) ?? 3;
      if (attempts < maxAttempts) {
        await db
          .update(documentQueue)
          .set({ status: 'queued', errorMessage: msg.substring(0, 500) })
          .where(eq(documentQueue.id, itemRecord.id as string))
          .run();
        logger.warn(
          `[OCR] Queue item ${itemRecord.id} failed (attempt ${attempts}/${maxAttempts}), will retry: ${msg}`,
        );
      } else {
        await db
          .update(documentQueue)
          .set({ status: 'failed', errorMessage: msg.substring(0, 500) })
          .where(eq(documentQueue.id, itemRecord.id as string))
          .run();
        logger.error(
          `[OCR] Queue item ${itemRecord.id} permanently failed after ${attempts} attempts: ${msg}`,
        );
      }
    }
  }
}
