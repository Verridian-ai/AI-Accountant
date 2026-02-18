import fs from 'fs/promises';
import { eq, and, desc } from 'drizzle-orm';
import { db, ocrDocuments, ocrLineItems, documentQueue } from '../../schema.js';
import { logger } from '../../utils/logger.js';
import type { OCRDocumentRecord } from './types.js';
import { toDocumentRecord } from './mappers.js';

export async function getDocument(documentId: string): Promise<OCRDocumentRecord | null> {
  const doc = await db.select().from(ocrDocuments).where(eq(ocrDocuments.id, documentId)).get();
  return doc ? toDocumentRecord(doc as Record<string, unknown>) : null;
}

export async function listDocuments(
  userId: string,
  status?: string,
  documentType?: string,
): Promise<OCRDocumentRecord[]> {
  let query = db.select().from(ocrDocuments).where(eq(ocrDocuments.userId, userId));
  if (status)
    query = db
      .select()
      .from(ocrDocuments)
      .where(and(eq(ocrDocuments.userId, userId), eq(ocrDocuments.status, status)));
  if (documentType)
    query = db
      .select()
      .from(ocrDocuments)
      .where(
        and(
          eq(ocrDocuments.userId, userId),
          ...(status ? [eq(ocrDocuments.status, status)] : []),
          eq(ocrDocuments.documentType, documentType),
        ),
      );
  const docs = await query.orderBy(desc(ocrDocuments.createdAt)).all();
  return (docs as Record<string, unknown>[]).map((doc) => toDocumentRecord(doc));
}

export async function deleteDocument(documentId: string): Promise<void> {
  const doc = await db.select().from(ocrDocuments).where(eq(ocrDocuments.id, documentId)).get();
  if (!doc) throw new Error(`Document not found: ${documentId}`);
  const docRecord = doc as Record<string, unknown>;
  try {
    await fs.unlink(docRecord.filePath as string);
  } catch {
    logger.warn(`[OCR] Could not delete file at ${docRecord.filePath}`);
  }
  await db.delete(ocrLineItems).where(eq(ocrLineItems.documentId, documentId)).run();
  await db.delete(documentQueue).where(eq(documentQueue.documentId, documentId)).run();
  await db.delete(ocrDocuments).where(eq(ocrDocuments.id, documentId)).run();
  logger.info(`[OCR] Document ${documentId} deleted`);
}
