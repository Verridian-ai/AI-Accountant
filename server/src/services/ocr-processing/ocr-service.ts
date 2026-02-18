/**
 * OCR Processing Module — OCRProcessingService class (thin shell)
 *
 * Delegates to sub-modules: file-storage, vision-extractor, classifier,
 * line-item-service, batch-processor, queue-manager, document-crud.
 */

import path from 'path';
import type { OCRDocumentRecord, OCRLineItemRecord } from './types.js';
import { uploadDocument } from './file-storage.js';
import { processDocument } from './vision-extractor.js';
import { classifyDocument } from './classifier.js';
import { extractLineItems } from './line-item-service.js';
import { processBatch } from './batch-processor.js';
import { enqueueDocument, processQueue } from './queue-manager.js';
import { getDocument, listDocuments, deleteDocument } from './document-crud.js';

export class OCRProcessingService {
  private uploadsDir: string;

  constructor(uploadsDir?: string) {
    this.uploadsDir = uploadsDir ?? path.resolve(process.cwd(), 'uploads');
  }

  uploadDocument(
    userId: string,
    file: { originalName: string; buffer: Buffer; mimeType: string; size: number },
    accountId?: string,
  ): Promise<OCRDocumentRecord> {
    return uploadDocument(this.uploadsDir, userId, file, accountId);
  }

  processDocument(documentId: string): Promise<OCRDocumentRecord> {
    return processDocument(documentId);
  }

  extractLineItems(documentId: string): Promise<OCRLineItemRecord[]> {
    return extractLineItems(documentId);
  }

  classifyDocument(documentId: string): Promise<string> {
    return classifyDocument(documentId);
  }

  processBatch(
    userId: string,
    documentIds: string[],
  ): Promise<{ processed: number; failed: number; errors: string[] }> {
    return processBatch(userId, documentIds);
  }

  enqueueDocument(documentId: string, action: string, priority?: number): Promise<void> {
    return enqueueDocument(documentId, action, priority);
  }

  processQueue(limit?: number): Promise<void> {
    return processQueue(limit);
  }

  getDocument(documentId: string): Promise<OCRDocumentRecord | null> {
    return getDocument(documentId);
  }

  listDocuments(
    userId: string,
    status?: string,
    documentType?: string,
  ): Promise<OCRDocumentRecord[]> {
    return listDocuments(userId, status, documentType);
  }

  deleteDocument(documentId: string): Promise<void> {
    return deleteDocument(documentId);
  }
}
