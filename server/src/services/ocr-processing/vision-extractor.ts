import fs from 'fs/promises';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';
import { getClient } from '../claude/client.js';
import { db, ocrDocuments, ocrLineItems } from '../../schema.js';
import { logger } from '../../utils/logger.js';
import type { OCRDocumentRecord, OCRExtractionResult } from './types.js';
import { toDocumentRecord } from './mappers.js';

export async function processDocument(documentId: string): Promise<OCRDocumentRecord> {
  const doc = await db.select().from(ocrDocuments).where(eq(ocrDocuments.id, documentId)).get();
  if (!doc) throw new Error(`Document not found: ${documentId}`);

  await db
    .update(ocrDocuments)
    .set({ status: 'processing', updatedAt: new Date().toISOString() })
    .where(eq(ocrDocuments.id, documentId))
    .run();

  try {
    const fileBuffer = await fs.readFile((doc as Record<string, unknown>).filePath as string);
    const base64Data = fileBuffer.toString('base64');
    const anthropic = getClient();
    const mimeType = (doc as Record<string, unknown>).mimeType as
      | 'application/pdf'
      | 'image/png'
      | 'image/jpeg'
      | 'image/webp';

    const sourceBlock: Anthropic.DocumentBlockParam | Anthropic.ImageBlockParam =
      mimeType === 'application/pdf'
        ? {
            type: 'document' as const,
            source: {
              type: 'base64' as const,
              media_type: 'application/pdf' as const,
              data: base64Data,
            },
          }
        : {
            type: 'image' as const,
            source: { type: 'base64' as const, media_type: mimeType, data: base64Data },
          };

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            sourceBlock,
            {
              type: 'text',
              text: `Extract all financial data from this document. Return a JSON object with:\n{\n  "documentType": "invoice|receipt|bill|credit_note|statement|quote|purchase_order",\n  "documentNumber": "string or null",\n  "vendorName": "string or null",\n  "vendorAbn": "string or null (11-digit ABN if visible)",\n  "documentDate": "YYYY-MM-DD or null",\n  "dueDate": "YYYY-MM-DD or null",\n  "subtotal": number or null,\n  "gstAmount": number or null,\n  "totalAmount": number,\n  "currency": "AUD",\n  "lineItems": [\n    {\n      "lineNumber": 1,\n      "description": "string",\n      "quantity": number,\n      "unitPrice": number or null,\n      "amount": number,\n      "gstAmount": number or null,\n      "gstInclusive": boolean\n    }\n  ],\n  "confidence": 0.0-1.0\n}\nReturn ONLY valid JSON, no markdown.`,
            },
          ],
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    const rawText = textBlock && 'text' in textBlock ? textBlock.text : '';
    const cleaned = rawText
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();
    let extraction: OCRExtractionResult;
    try {
      extraction = JSON.parse(cleaned) as OCRExtractionResult;
    } catch {
      throw new Error(`Failed to parse Vision API response as JSON: ${rawText.substring(0, 200)}`);
    }

    const now = new Date().toISOString();
    await db
      .update(ocrDocuments)
      .set({
        documentType: extraction.documentType || 'unknown',
        documentNumber: extraction.documentNumber ?? null,
        vendorName: extraction.vendorName ?? null,
        vendorAbn: extraction.vendorAbn ?? null,
        documentDate: extraction.documentDate ?? null,
        dueDate: extraction.dueDate ?? null,
        subtotal: extraction.subtotal ?? null,
        gstAmount: extraction.gstAmount ?? null,
        totalAmount: extraction.totalAmount ?? null,
        currency: extraction.currency || 'AUD',
        extractedData: JSON.stringify(extraction),
        confidenceScore: extraction.confidence ?? 0,
        status: 'extracted',
        processedAt: now,
        updatedAt: now,
      })
      .where(eq(ocrDocuments.id, documentId))
      .run();

    if (extraction.lineItems?.length) {
      for (const item of extraction.lineItems) {
        await db
          .insert(ocrLineItems)
          .values({
            id: randomUUID(),
            documentId,
            lineNumber: item.lineNumber,
            description: item.description,
            quantity: item.quantity ?? 1,
            unitPrice: item.unitPrice ?? null,
            amount: item.amount,
            gstAmount: item.gstAmount ?? 0,
            gstInclusive: item.gstInclusive ?? true,
            confidenceScore: extraction.confidence ?? 0,
          })
          .run();
      }
    }

    logger.info(
      `[OCR] Document ${documentId} processed: ${extraction.lineItems?.length ?? 0} line items, confidence ${extraction.confidence}`,
    );
    const updated = await db
      .select()
      .from(ocrDocuments)
      .where(eq(ocrDocuments.id, documentId))
      .get();
    return toDocumentRecord(updated as Record<string, unknown>);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await db
      .update(ocrDocuments)
      .set({
        status: 'failed',
        errorMessage: msg.substring(0, 500),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(ocrDocuments.id, documentId))
      .run();
    logger.error(`[OCR] Document ${documentId} failed: ${msg}`);
    throw err;
  }
}
