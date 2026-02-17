/**
 * Pipeline stage: PDF text extraction.
 */
import { readFile } from 'fs/promises';
import pdfParse from 'pdf-parse';
import { PdfParsingError } from '../../errors.js';
import { logger } from '../../utils/logger.js';

export async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delay: number = 1000,
  operationName: string = 'Operation',
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      logger.warn({ err: error }, `[${operationName}] Attempt ${i + 1} failed.`);
      if (i < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay * Math.pow(2, i))); // Exponential backoff
      }
    }
  }
  throw lastError;
}

/** Extract text content from a PDF file. Returns the raw text string. */
export async function extractPdfText(filePath: string): Promise<string> {
  logger.info(`[Pipeline] Extracting text from PDF: ${filePath}`);

  const pdfText = await withRetry(
    async () => {
      const pdfBuffer = await readFile(filePath);
      const pdfData = await pdfParse(pdfBuffer);
      const text = pdfData.text;
      if (!text || text.trim().length < 50) {
        throw new PdfParsingError(
          'PDF contained very little readable text. It might be a scanned image without OCR, or a password-protected file.',
        );
      }
      return text;
    },
    3,
    1000,
    'PDF Extraction',
  );

  logger.info(`[Pipeline] Extracted ${pdfText.length} characters from PDF`);
  return pdfText;
}
