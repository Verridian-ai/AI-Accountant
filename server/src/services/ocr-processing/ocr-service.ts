/**
 * OCR Processing Module — OCRProcessingService class
 *
 * Uses Claude Vision API for intelligent data extraction from invoices,
 * receipts, bills, and other financial documents.
 */

import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { eq, and, desc, asc } from 'drizzle-orm';
import { getClient } from '../claude/client.js';
import { db, ocrDocuments, ocrLineItems, documentQueue, merchantMemory } from '../../schema.js';
import { logger } from '../../utils/logger.js';
import type { OCRDocumentRecord, OCRLineItemRecord, OCRExtractionResult } from './types.js';
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  VALID_DOCUMENT_TYPES,
  CATEGORY_KEYWORDS,
} from './types.js';

export class OCRProcessingService {
  private uploadsDir: string;

  constructor(uploadsDir?: string) {
    this.uploadsDir = uploadsDir ?? path.resolve(process.cwd(), 'uploads');
  }

  async uploadDocument(
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
    const ext = path.extname(safeName) || this.mimeToExtension(file.mimeType);
    const storedName = `${fileId}${ext}`;
    const userDir = path.join(this.uploadsDir, userId);
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
    return this.toDocumentRecord(doc);
  }

  async processDocument(documentId: string): Promise<OCRDocumentRecord> {
    const doc = await db.select().from(ocrDocuments).where(eq(ocrDocuments.id, documentId)).get();
    if (!doc) throw new Error(`Document not found: ${documentId}`);

    await db
      .update(ocrDocuments)
      .set({ status: 'processing', updatedAt: new Date().toISOString() })
      .where(eq(ocrDocuments.id, documentId))
      .run();

    try {
      const fileBuffer = await fs.readFile(doc.filePath);
      const base64Data = fileBuffer.toString('base64');
      const anthropic = getClient();
      const mimeType = doc.mimeType as
        | 'application/pdf'
        | 'image/png'
        | 'image/jpeg'
        | 'image/webp';

      const sourceBlock =
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
              sourceBlock as any,
              {
                type: 'text',
                text: `Extract all financial data from this document. Return a JSON object with:\n{\n  "documentType": "invoice|receipt|bill|credit_note|statement|quote|purchase_order",\n  "documentNumber": "string or null",\n  "vendorName": "string or null",\n  "vendorAbn": "string or null (11-digit ABN if visible)",\n  "documentDate": "YYYY-MM-DD or null",\n  "dueDate": "YYYY-MM-DD or null",\n  "subtotal": number or null,\n  "gstAmount": number or null,\n  "totalAmount": number,\n  "currency": "AUD",\n  "lineItems": [\n    {\n      "lineNumber": 1,\n      "description": "string",\n      "quantity": number,\n      "unitPrice": number or null,\n      "amount": number,\n      "gstAmount": number or null,\n      "gstInclusive": boolean\n    }\n  ],\n  "confidence": 0.0-1.0\n}\nReturn ONLY valid JSON, no markdown.`,
              },
            ],
          },
        ],
      });

      const textBlock = response.content.find((b: any) => b.type === 'text');
      const rawText = textBlock ? (textBlock as any).text : '';
      const cleaned = rawText
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();
      let extraction: OCRExtractionResult;
      try {
        extraction = JSON.parse(cleaned);
      } catch {
        throw new Error(
          `Failed to parse Vision API response as JSON: ${rawText.substring(0, 200)}`,
        );
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
      return this.toDocumentRecord(updated);
    } catch (err: any) {
      await db
        .update(ocrDocuments)
        .set({
          status: 'failed',
          errorMessage: err.message?.substring(0, 500),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(ocrDocuments.id, documentId))
        .run();
      logger.error(`[OCR] Document ${documentId} failed: ${err.message}`);
      throw err;
    }
  }

  async extractLineItems(documentId: string): Promise<OCRLineItemRecord[]> {
    let items: any[] = await db
      .select()
      .from(ocrLineItems)
      .where(eq(ocrLineItems.documentId, documentId))
      .orderBy(asc(ocrLineItems.lineNumber))
      .all();
    if (!items.length) {
      await this.processDocument(documentId);
      items = await db
        .select()
        .from(ocrLineItems)
        .where(eq(ocrLineItems.documentId, documentId))
        .orderBy(asc(ocrLineItems.lineNumber))
        .all();
    }
    const doc = await db.select().from(ocrDocuments).where(eq(ocrDocuments.id, documentId)).get();
    const userId = doc?.userId;

    for (const item of items) {
      if (item.category) continue;
      let matched = false;
      if (userId) {
        const memories: any[] = await db
          .select()
          .from(merchantMemory)
          .where(eq(merchantMemory.userId, userId))
          .all();
        for (const mem of memories) {
          if (item.description.toLowerCase().includes(mem.merchantPattern.toLowerCase())) {
            await db
              .update(ocrLineItems)
              .set({ category: mem.category })
              .where(eq(ocrLineItems.id, item.id))
              .run();
            item.category = mem.category;
            matched = true;
            break;
          }
        }
      }
      if (!matched) {
        const desc = item.description.toLowerCase();
        for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
          if (keywords.some((kw) => desc.includes(kw))) {
            await db
              .update(ocrLineItems)
              .set({ category })
              .where(eq(ocrLineItems.id, item.id))
              .run();
            item.category = category;
            break;
          }
        }
      }
    }
    return items.map(this.toLineItemRecord);
  }

  async classifyDocument(documentId: string): Promise<string> {
    const doc = await db.select().from(ocrDocuments).where(eq(ocrDocuments.id, documentId)).get();
    if (!doc) throw new Error(`Document not found: ${documentId}`);
    if (doc.documentType && doc.documentType !== 'unknown') return doc.documentType;

    const fileBuffer = await fs.readFile(doc.filePath);
    const base64Data = fileBuffer.toString('base64');
    const mimeType = doc.mimeType as 'application/pdf' | 'image/png' | 'image/jpeg' | 'image/webp';
    const sourceBlock =
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

    const anthropic = getClient();
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 64,
      messages: [
        {
          role: 'user',
          content: [
            sourceBlock as any,
            {
              type: 'text',
              text: 'Classify this financial document into exactly one of: invoice, receipt, bill, credit_note, statement, quote, purchase_order. Return only the classification word, nothing else.',
            },
          ],
        },
      ],
    });

    const textBlock = response.content.find((b: any) => b.type === 'text');
    const classification = (textBlock ? (textBlock as any).text : 'unknown').trim().toLowerCase();
    const validType = VALID_DOCUMENT_TYPES.has(classification) ? classification : 'unknown';
    await db
      .update(ocrDocuments)
      .set({ documentType: validType, updatedAt: new Date().toISOString() })
      .where(eq(ocrDocuments.id, documentId))
      .run();
    logger.info(`[OCR] Document ${documentId} classified as: ${validType}`);
    return validType;
  }

  async processBatch(
    userId: string,
    documentIds: string[],
  ): Promise<{ processed: number; failed: number; errors: string[] }> {
    let processed = 0,
      failed = 0;
    const errors: string[] = [];
    for (const docId of documentIds) {
      try {
        await this.processDocument(docId);
        processed++;
      } catch (err: any) {
        failed++;
        errors.push(`${docId}: ${err.message}`);
        logger.warn(`[OCR] Batch item ${docId} failed: ${err.message}`);
      }
      if (documentIds.indexOf(docId) < documentIds.length - 1)
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    logger.info(
      `[OCR] Batch complete for user ${userId}: ${processed} processed, ${failed} failed`,
    );
    return { processed, failed, errors };
  }

  async enqueueDocument(documentId: string, action: string, priority: number = 100): Promise<void> {
    const doc = await db.select().from(ocrDocuments).where(eq(ocrDocuments.id, documentId)).get();
    if (!doc) throw new Error(`Document not found: ${documentId}`);
    const now = new Date().toISOString();
    await db
      .insert(documentQueue)
      .values({
        id: randomUUID(),
        userId: doc.userId,
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
    logger.info(
      `[OCR] Enqueued document ${documentId} for action: ${action} (priority ${priority})`,
    );
  }

  async processQueue(limit: number = 10): Promise<void> {
    const items: any[] = await db
      .select()
      .from(documentQueue)
      .where(eq(documentQueue.status, 'queued'))
      .orderBy(asc(documentQueue.priority), asc(documentQueue.scheduledAt))
      .limit(limit)
      .all();

    for (const item of items) {
      const now = new Date().toISOString();
      await db
        .update(documentQueue)
        .set({ status: 'processing', attempts: (item.attempts ?? 0) + 1, startedAt: now })
        .where(eq(documentQueue.id, item.id))
        .run();
      try {
        switch (item.action) {
          case 'ocr_extract':
            await this.processDocument(item.documentId);
            break;
          case 'classify':
            await this.classifyDocument(item.documentId);
            break;
          default:
            throw new Error(`Unknown queue action: ${item.action}`);
        }
        await db
          .update(documentQueue)
          .set({ status: 'completed', completedAt: new Date().toISOString() })
          .where(eq(documentQueue.id, item.id))
          .run();
        logger.info(`[OCR] Queue item ${item.id} completed (action: ${item.action})`);
      } catch (err: any) {
        const attempts = (item.attempts ?? 0) + 1;
        const maxAttempts = item.maxAttempts ?? 3;
        if (attempts < maxAttempts) {
          await db
            .update(documentQueue)
            .set({ status: 'queued', errorMessage: err.message?.substring(0, 500) })
            .where(eq(documentQueue.id, item.id))
            .run();
          logger.warn(
            `[OCR] Queue item ${item.id} failed (attempt ${attempts}/${maxAttempts}), will retry: ${err.message}`,
          );
        } else {
          await db
            .update(documentQueue)
            .set({ status: 'failed', errorMessage: err.message?.substring(0, 500) })
            .where(eq(documentQueue.id, item.id))
            .run();
          logger.error(
            `[OCR] Queue item ${item.id} permanently failed after ${attempts} attempts: ${err.message}`,
          );
        }
      }
    }
  }

  async getDocument(documentId: string): Promise<OCRDocumentRecord | null> {
    const doc = await db.select().from(ocrDocuments).where(eq(ocrDocuments.id, documentId)).get();
    return doc ? this.toDocumentRecord(doc) : null;
  }

  async listDocuments(
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
    const docs: any[] = await query.orderBy(desc(ocrDocuments.createdAt)).all();
    return docs.map(this.toDocumentRecord);
  }

  async deleteDocument(documentId: string): Promise<void> {
    const doc = await db.select().from(ocrDocuments).where(eq(ocrDocuments.id, documentId)).get();
    if (!doc) throw new Error(`Document not found: ${documentId}`);
    try {
      await fs.unlink(doc.filePath);
    } catch {
      logger.warn(`[OCR] Could not delete file at ${doc.filePath}`);
    }
    await db.delete(ocrLineItems).where(eq(ocrLineItems.documentId, documentId)).run();
    await db.delete(documentQueue).where(eq(documentQueue.documentId, documentId)).run();
    await db.delete(ocrDocuments).where(eq(ocrDocuments.id, documentId)).run();
    logger.info(`[OCR] Document ${documentId} deleted`);
  }

  private mimeToExtension(mimeType: string): string {
    switch (mimeType) {
      case 'application/pdf':
        return '.pdf';
      case 'image/png':
        return '.png';
      case 'image/jpeg':
        return '.jpg';
      case 'image/webp':
        return '.webp';
      default:
        return '';
    }
  }

  private toDocumentRecord(raw: any): OCRDocumentRecord {
    return {
      id: raw.id,
      userId: raw.userId ?? raw.user_id,
      accountId: raw.accountId ?? raw.account_id ?? null,
      fileName: raw.fileName ?? raw.file_name,
      filePath: raw.filePath ?? raw.file_path,
      fileSize: raw.fileSize ?? raw.file_size,
      mimeType: raw.mimeType ?? raw.mime_type,
      documentType: raw.documentType ?? raw.document_type ?? 'unknown',
      documentNumber: raw.documentNumber ?? raw.document_number ?? null,
      vendorName: raw.vendorName ?? raw.vendor_name ?? null,
      vendorAbn: raw.vendorAbn ?? raw.vendor_abn ?? null,
      documentDate: raw.documentDate ?? raw.document_date ?? null,
      dueDate: raw.dueDate ?? raw.due_date ?? null,
      subtotal: raw.subtotal ?? null,
      gstAmount: raw.gstAmount ?? raw.gst_amount ?? null,
      totalAmount: raw.totalAmount ?? raw.total_amount ?? null,
      currency: raw.currency ?? 'AUD',
      extractedData: raw.extractedData ?? raw.extracted_data ?? null,
      confidenceScore: raw.confidenceScore ?? raw.confidence_score ?? 0,
      status: raw.status ?? 'pending',
      errorMessage: raw.errorMessage ?? raw.error_message ?? null,
      processedAt: raw.processedAt ?? raw.processed_at ?? null,
      createdAt: raw.createdAt ?? raw.created_at ?? new Date().toISOString(),
    };
  }

  private toLineItemRecord(raw: any): OCRLineItemRecord {
    return {
      id: raw.id,
      documentId: raw.documentId ?? raw.document_id,
      lineNumber: raw.lineNumber ?? raw.line_number,
      description: raw.description,
      quantity: raw.quantity ?? 1,
      unitPrice: raw.unitPrice ?? raw.unit_price ?? null,
      amount: raw.amount,
      gstAmount: raw.gstAmount ?? raw.gst_amount ?? 0,
      gstInclusive: raw.gstInclusive ?? raw.gst_inclusive ?? true,
      category: raw.category ?? null,
      accountCode: raw.accountCode ?? raw.account_code ?? null,
      confidenceScore: raw.confidenceScore ?? raw.confidence_score ?? 0,
    };
  }
}
