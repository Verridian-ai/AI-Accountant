/**
 * OCR Processing Module — Barrel Export
 */

export * from './types.js';
export { mimeToExtension, toDocumentRecord, toLineItemRecord } from './mappers.js';
export { uploadDocument } from './file-storage.js';
export { processDocument } from './vision-extractor.js';
export { classifyDocument } from './classifier.js';
export { extractLineItems } from './line-item-service.js';
export { processBatch } from './batch-processor.js';
export { enqueueDocument, processQueue } from './queue-manager.js';
export { getDocument, listDocuments, deleteDocument } from './document-crud.js';
export { OCRProcessingService } from './ocr-service.js';

import { OCRProcessingService } from './ocr-service.js';

// Export singleton instance
export const ocrProcessingService = new OCRProcessingService();
