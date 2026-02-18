import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { db, ocrDocuments } from '../../schema.js';
import type { OCRDocumentRecord } from './types.js';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from './types.js';
import { toDocumentRecord, mimeToExtension } from './mappers.js';

export async function uploadDocument(
  uploadsDir: string,
  userId: string,
  file: { originalName: string; buffer: Buffer; mimeType: string; size: number },
  accountId?: string,
): Promise<OCRDocumentRecord> {
  if (!ALLOWED_MIME_TYPES.has(file.mimeType))
    throw new Error(`Unsupported file type: ${file.mimeType}. Accepted: pdf, png, jpeg, webp`);
  if (file.size > MAX_FILE_SIZE)
    throw new Error(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum: 10MB`);

  const safeName = file.originalName.replace(/[/\\]/g, '_');
  const fileId = randomUUID();
  const ext = path.extname(safeName) || mimeToExtension(file.mimeType);
  const storedName = `${fileId}${ext}`;
  const userDir = path.join(uploadsDir, userId);
  await fs.mkdir(userDir, { recursive: true });
  const filePath = path.join(userDir, storedName);
  await fs.writeFile(filePath, file.buffer);

  const docId = randomUUID();
  const now = new Date().toISOString();
  await db
    .insert(ocrDocuments)
    .values({
      id: docId,
      userId,
      accountId: accountId ?? null,
      fileName: safeName,
      filePath,
      fileSize: file.size,
      mimeType: file.mimeType,
      documentType: 'unknown',
      currency: 'AUD',
      confidenceScore: 0,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    })
    .run();

  const doc = await db.select().from(ocrDocuments).where(eq(ocrDocuments.id, docId)).get();
  return toDocumentRecord(doc as Record<string, unknown>);
}
