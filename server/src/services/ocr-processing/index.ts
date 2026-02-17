/**
 * OCR Processing Module — Barrel Export
 */

export * from './types.js';
export { OCRProcessingService } from './ocr-service.js';

import { OCRProcessingService } from './ocr-service.js';

// Export singleton instance
export const ocrProcessingService = new OCRProcessingService();
