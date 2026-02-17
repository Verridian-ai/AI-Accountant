/**
 * OCR Document Processing Service
 *
 * Uses Claude Vision API for intelligent data extraction from invoices,
 * receipts, bills, and other financial documents.
 */

import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
import type Anthropic from '@anthropic-ai/sdk';
import { getClient } from './claude/client.js';
import { db, ocrDocuments, ocrLineItems, documentQueue, merchantMemory } from '../schema.js';
import { logger } from '../utils/logger.js';

// ============================================================================
// Type Definitions
// ============================================================================

export interface OCRDocumentRecord {
  id: string;
  userId: string;
  accountId?: string | null;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  documentType: string;
  documentNumber?: string | null;
  vendorName?: string | null;
  vendorAbn?: string | null;
  documentDate?: string | null;
  dueDate?: string | null;
  subtotal?: number | null;
  gstAmount?: number | null;
  totalAmount?: number | null;
  currency: string;
  extractedData?: Record<string, unknown>;
  confidenceScore: number;
  status: string;
  errorMessage?: string | null;
  processedAt?: string | null;
  createdAt: string;
}

export interface OCRLineItemRecord {
  id: string;
  documentId: string;
  lineNumber: number;
  description: string;
  quantity: number;
  unitPrice?: number | null;
  amount: number;
  gstAmount: number;
  gstInclusive: boolean;
  category?: string | null;
  accountCode?: string | null;
  confidenceScore: number;
}

export interface OCRExtractionResult {
  documentType: string;
  documentNumber?: string;
  vendorName?: string;
  vendorAbn?: string;
  documentDate?: string;
  dueDate?: string;
  subtotal?: number;
  gstAmount?: number;
  totalAmount: number;
  currency: string;
  lineItems: Array<{
    lineNumber: number;
    description: string;
    quantity: number;
    unitPrice?: number;
    amount: number;
    gstAmount?: number;
    gstInclusive: boolean;
  }>;
  confidence: number;
}

// ============================================================================
// Constants
// ============================================================================

const ALLOWED_MIME_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const VALID_DOCUMENT_TYPES = new Set([
  'invoice',
  'receipt',
  'bill',
  'credit_note',
  'statement',
  'quote',
  'purchase_order',
  'unknown',
]);

/** Keyword → category mapping for line item classification */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Office Supplies': [
    'stationery',
    'paper',
    'pen',
    'ink',
    'toner',
    'cartridge',
    'folder',
    'office',
  ],
  'Computer & IT': [
    'software',
    'license',
    'hosting',
    'domain',
    'computer',
    'laptop',
    'monitor',
    'keyboard',
    'mouse',
    'ssd',
    'ram',
    'server',
  ],
  Utilities: ['electricity', 'gas', 'water', 'power', 'energy', 'utility'],
  Telecommunications: [
    'phone',
    'mobile',
    'internet',
    'broadband',
    'nbn',
    'telstra',
    'optus',
    'vodafone',
    'sim',
  ],
  'Rent & Occupancy': ['rent', 'lease', 'occupancy', 'tenancy'],
  Insurance: ['insurance', 'premium', 'indemnity', 'liability cover'],
  'Motor Vehicle': [
    'fuel',
    'petrol',
    'diesel',
    'rego',
    'registration',
    'car',
    'vehicle',
    'parking',
    'toll',
  ],
  'Travel & Accommodation': [
    'flight',
    'airfare',
    'hotel',
    'motel',
    'accommodation',
    'taxi',
    'uber',
    'travel',
  ],
  'Meals & Entertainment': [
    'meal',
    'lunch',
    'dinner',
    'breakfast',
    'coffee',
    'catering',
    'restaurant',
  ],
  'Professional Services': [
    'accounting',
    'legal',
    'consulting',
    'advisory',
    'audit',
    'bookkeeping',
  ],
  'Advertising & Marketing': [
    'advertising',
    'marketing',
    'promotion',
    'ad spend',
    'google ads',
    'facebook ads',
    'seo',
  ],
  'Repairs & Maintenance': ['repair', 'maintenance', 'service', 'fix', 'plumber', 'electrician'],
  Cleaning: ['cleaning', 'cleaner', 'janitorial', 'sanitation'],
  'Postage & Freight': [
    'postage',
    'freight',
    'courier',
    'shipping',
    'delivery',
    'auspost',
    'sendle',
  ],
  'Training & Education': ['training', 'course', 'workshop', 'seminar', 'webinar', 'education'],
  Subscriptions: ['subscription', 'membership', 'annual fee', 'monthly fee'],
  'Materials & Supplies': ['material', 'supply', 'raw material', 'component', 'parts'],
  Equipment: ['equipment', 'tool', 'machinery', 'plant'],
};

// ============================================================================
// OCR Processing Service
// ============================================================================

export class OCRProcessingService {
  private uploadsDir: string;

  constructor(uploadsDir?: string) {
    this.uploadsDir = uploadsDir ?? path.resolve(process.cwd(), 'uploads');
  }

  // --------------------------------------------------------------------------
  // Document Upload
  // --------------------------------------------------------------------------

  async uploadDocument(
    userId: string,
    file: { originalName: string; buffer: Buffer; mimeType: string; size: number },
    accountId?: string,
  ): Promise<OCRDocumentRecord> {
    // Validate mime type
    if (!ALLOWED_MIME_TYPES.has(file.mimeType)) {
      throw new Error(`Unsupported file type: ${file.mimeType}. Accepted: pdf, png, jpeg, webp`);
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum: 10MB`);
    }

    // Sanitize filename — strip path separators
    const safeName = file.originalName.replace(/[/\\]/g, '_');

    // Generate server-side UUID filename
    const fileId = randomUUID();
    const ext = path.extname(safeName) || this.mimeToExtension(file.mimeType);
    const storedName = `${fileId}${ext}`;

    // Create per-user directory
    const userDir = path.join(this.uploadsDir, userId);
    await fs.mkdir(userDir, { recursive: true });

    const filePath = path.join(userDir, storedName);
    await fs.writeFile(filePath, file.buffer);

    // Create DB record
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

  // --------------------------------------------------------------------------
  // Document Processing (Claude Vision API)
  // --------------------------------------------------------------------------

  async processDocument(documentId: string): Promise<OCRDocumentRecord> {
    const doc = await db.select().from(ocrDocuments).where(eq(ocrDocuments.id, documentId)).get();
    if (!doc) throw new Error(`Document not found: ${documentId}`);

    // Update status to processing
    await db
      .update(ocrDocuments)
      .set({ status: 'processing', updatedAt: new Date().toISOString() })
      .where(eq(ocrDocuments.id, documentId))
      .run();

    try {
      // Read file as base64
      const fileBuffer = await fs.readFile(doc.filePath);
      const base64Data = fileBuffer.toString('base64');

      const anthropic = getClient();
      const mimeType = doc.mimeType as
        | 'application/pdf'
        | 'image/png'
        | 'image/jpeg'
        | 'image/webp';

      // Build content block — use 'document' for PDFs, 'image' for images
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
              sourceBlock,
              {
                type: 'text',
                text: `Extract all financial data from this document. Return a JSON object with:
{
  "documentType": "invoice|receipt|bill|credit_note|statement|quote|purchase_order",
  "documentNumber": "string or null",
  "vendorName": "string or null",
  "vendorAbn": "string or null (11-digit ABN if visible)",
  "documentDate": "YYYY-MM-DD or null",
  "dueDate": "YYYY-MM-DD or null",
  "subtotal": number or null,
  "gstAmount": number or null,
  "totalAmount": number,
  "currency": "AUD",
  "lineItems": [
    {
      "lineNumber": 1,
      "description": "string",
      "quantity": number,
      "unitPrice": number or null,
      "amount": number,
      "gstAmount": number or null,
      "gstInclusive": boolean
    }
  ],
  "confidence": 0.0-1.0
}
Return ONLY valid JSON, no markdown.`,
              },
            ],
          },
        ],
      });

      // Extract text content from response
      const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
      const rawText = textBlock?.text ?? '';

      // Parse JSON (strip any accidental markdown fencing)
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

      // Update ocr_documents with extracted fields
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

      // Insert line items
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
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : String(err);
      const now = new Date().toISOString();
      await db
        .update(ocrDocuments)
        .set({
          status: 'failed',
          errorMessage: errorMessage.substring(0, 500),
          updatedAt: now,
        })
        .where(eq(ocrDocuments.id, documentId))
        .run();

      logger.error(`[OCR] Document ${documentId} failed: ${errorMessage}`);
      throw err;
    }
  }

  // --------------------------------------------------------------------------
  // Line Item Extraction + Category Mapping
  // --------------------------------------------------------------------------

  async extractLineItems(documentId: string): Promise<OCRLineItemRecord[]> {
    // Check for existing line items
    let items = await db
      .select()
      .from(ocrLineItems)
      .where(eq(ocrLineItems.documentId, documentId))
      .orderBy(asc(ocrLineItems.lineNumber))
      .all();

    // If none, process the document first
    if (!items.length) {
      await this.processDocument(documentId);
      items = await db
        .select()
        .from(ocrLineItems)
        .where(eq(ocrLineItems.documentId, documentId))
        .orderBy(asc(ocrLineItems.lineNumber))
        .all();
    }

    // Get the document's userId for merchant memory lookup
    const doc = await db.select().from(ocrDocuments).where(eq(ocrDocuments.id, documentId)).get();
    const userId = doc?.userId;

    // Enrich each line item with category mapping
    for (const item of items) {
      if (item.category) continue; // already categorized

      let matched = false;

      // 1. Try merchant_memory pattern matching
      if (userId) {
        const memories = await db
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

      // 2. Fallback: keyword matching
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

    return items.map((item: typeof ocrLineItems.$inferSelect) => this.toLineItemRecord(item));
  }

  // --------------------------------------------------------------------------
  // Document Classification
  // --------------------------------------------------------------------------

  async classifyDocument(documentId: string): Promise<string> {
    const doc = await db.select().from(ocrDocuments).where(eq(ocrDocuments.id, documentId)).get();
    if (!doc) throw new Error(`Document not found: ${documentId}`);

    // If already classified, return existing type
    if (doc.documentType && doc.documentType !== 'unknown') {
      return doc.documentType;
    }

    // Read file and classify via Vision API
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
            sourceBlock,
            {
              type: 'text',
              text: 'Classify this financial document into exactly one of: invoice, receipt, bill, credit_note, statement, quote, purchase_order. Return only the classification word, nothing else.',
            },
          ],
        },
      ],
    });

    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
    const classification = (textBlock?.text ?? 'unknown').trim().toLowerCase();

    const validType = VALID_DOCUMENT_TYPES.has(classification) ? classification : 'unknown';

    await db
      .update(ocrDocuments)
      .set({
        documentType: validType,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(ocrDocuments.id, documentId))
      .run();

    logger.info(`[OCR] Document ${documentId} classified as: ${validType}`);
    return validType;
  }

  // --------------------------------------------------------------------------
  // Batch Processing
  // --------------------------------------------------------------------------

  async processBatch(
    userId: string,
    documentIds: string[],
  ): Promise<{ processed: number; failed: number; errors: string[] }> {
    let processed = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const docId of documentIds) {
      try {
        await this.processDocument(docId);
        processed++;
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        failed++;
        errors.push(`${docId}: ${errorMessage}`);
        logger.warn(`[OCR] Batch item ${docId} failed: ${errorMessage}`);
      }

      // Rate-limit: 1 second delay between API calls
      if (documentIds.indexOf(docId) < documentIds.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    logger.info(
      `[OCR] Batch complete for user ${userId}: ${processed} processed, ${failed} failed`,
    );
    return { processed, failed, errors };
  }

  // --------------------------------------------------------------------------
  // Queue Management
  // --------------------------------------------------------------------------

  async enqueueDocument(documentId: string, action: string, priority: number = 100): Promise<void> {
    // Look up the document to get userId
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
    // Fetch next batch of queued items ordered by priority ASC, scheduledAt ASC
    const items = await db
      .select()
      .from(documentQueue)
      .where(eq(documentQueue.status, 'queued'))
      .orderBy(asc(documentQueue.priority), asc(documentQueue.scheduledAt))
      .limit(limit)
      .all();

    for (const item of items) {
      const now = new Date().toISOString();

      // Mark as processing
      await db
        .update(documentQueue)
        .set({
          status: 'processing',
          attempts: (item.attempts ?? 0) + 1,
          startedAt: now,
        })
        .where(eq(documentQueue.id, item.id))
        .run();

      try {
        // Dispatch to the appropriate handler
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

        // Success
        await db
          .update(documentQueue)
          .set({
            status: 'completed',
            completedAt: new Date().toISOString(),
          })
          .where(eq(documentQueue.id, item.id))
          .run();

        logger.info(`[OCR] Queue item ${item.id} completed (action: ${item.action})`);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        const attempts = (item.attempts ?? 0) + 1;
        const maxAttempts = item.maxAttempts ?? 3;

        if (attempts < maxAttempts) {
          // Retry — set back to queued
          await db
            .update(documentQueue)
            .set({
              status: 'queued',
              errorMessage: errorMessage.substring(0, 500),
            })
            .where(eq(documentQueue.id, item.id))
            .run();

          logger.warn(
            `[OCR] Queue item ${item.id} failed (attempt ${attempts}/${maxAttempts}), will retry: ${errorMessage}`,
          );
        } else {
          // Max retries exceeded
          await db
            .update(documentQueue)
            .set({
              status: 'failed',
              errorMessage: errorMessage.substring(0, 500),
            })
            .where(eq(documentQueue.id, item.id))
            .run();

          logger.error(
            `[OCR] Queue item ${item.id} permanently failed after ${attempts} attempts: ${errorMessage}`,
          );
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // Utility Methods
  // --------------------------------------------------------------------------

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

    if (status) {
      query = db
        .select()
        .from(ocrDocuments)
        .where(and(eq(ocrDocuments.userId, userId), eq(ocrDocuments.status, status)));
    }

    if (documentType) {
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
    }

    const docs = await query.orderBy(desc(ocrDocuments.createdAt)).all();
    return docs.map((doc: typeof ocrDocuments.$inferSelect) => this.toDocumentRecord(doc));
  }

  async deleteDocument(documentId: string): Promise<void> {
    const doc = await db.select().from(ocrDocuments).where(eq(ocrDocuments.id, documentId)).get();
    if (!doc) throw new Error(`Document not found: ${documentId}`);

    // Remove file from disk
    try {
      await fs.unlink(doc.filePath);
    } catch {
      // File may already be gone — log but don't throw
      logger.warn(`[OCR] Could not delete file at ${doc.filePath}`);
    }

    // Delete line items (cascade should handle, but explicit for safety)
    await db.delete(ocrLineItems).where(eq(ocrLineItems.documentId, documentId)).run();

    // Delete queue items
    await db.delete(documentQueue).where(eq(documentQueue.documentId, documentId)).run();

    // Delete document record
    await db.delete(ocrDocuments).where(eq(ocrDocuments.id, documentId)).run();

    logger.info(`[OCR] Document ${documentId} deleted`);
  }

  // --------------------------------------------------------------------------
  // Private Helpers
  // --------------------------------------------------------------------------

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

  private toDocumentRecord(raw: typeof ocrDocuments.$inferSelect): OCRDocumentRecord {
    return {
      id: raw.id,
      userId: raw.userId,
      accountId: raw.accountId ?? null,
      fileName: raw.fileName,
      filePath: raw.filePath,
      fileSize: raw.fileSize,
      mimeType: raw.mimeType,
      documentType: raw.documentType ?? 'unknown',
      documentNumber: raw.documentNumber ?? null,
      vendorName: raw.vendorName ?? null,
      vendorAbn: raw.vendorAbn ?? null,
      documentDate: raw.documentDate ?? null,
      dueDate: raw.dueDate ?? null,
      subtotal: raw.subtotal ?? null,
      gstAmount: raw.gstAmount ?? null,
      totalAmount: raw.totalAmount ?? null,
      currency: raw.currency ?? 'AUD',
      extractedData: raw.extractedData ? (JSON.parse(raw.extractedData) as Record<string, unknown>) : undefined,
      confidenceScore: raw.confidenceScore ?? 0,
      status: raw.status ?? 'pending',
      errorMessage: raw.errorMessage ?? null,
      processedAt: raw.processedAt ?? null,
      createdAt: raw.createdAt ?? new Date().toISOString(),
    };
  }

  private toLineItemRecord(raw: typeof ocrLineItems.$inferSelect): OCRLineItemRecord {
    return {
      id: raw.id,
      documentId: raw.documentId,
      lineNumber: raw.lineNumber,
      description: raw.description,
      quantity: raw.quantity ?? 1,
      unitPrice: raw.unitPrice ?? null,
      amount: raw.amount,
      gstAmount: raw.gstAmount ?? 0,
      gstInclusive: Boolean(raw.gstInclusive ?? true),
      category: raw.category ?? null,
      accountCode: raw.accountCode ?? null,
      confidenceScore: raw.confidenceScore ?? 0,
    };
  }
}

// Singleton export
export const ocrProcessingService = new OCRProcessingService();
