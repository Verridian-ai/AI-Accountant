import fs from 'fs/promises';
import { eq } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';
import { getClient } from '../claude/client.js';
import { db, ocrDocuments } from '../../schema.js';
import { logger } from '../../utils/logger.js';
import { VALID_DOCUMENT_TYPES } from './types.js';

export async function classifyDocument(documentId: string): Promise<string> {
  const doc = await db.select().from(ocrDocuments).where(eq(ocrDocuments.id, documentId)).get();
  if (!doc) throw new Error(`Document not found: ${documentId}`);
  const docRecord = doc as Record<string, unknown>;
  if (docRecord.documentType && docRecord.documentType !== 'unknown')
    return docRecord.documentType as string;

  const fileBuffer = await fs.readFile(docRecord.filePath as string);
  const base64Data = fileBuffer.toString('base64');
  const mimeType = docRecord.mimeType as
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

  const textBlock = response.content.find((b) => b.type === 'text');
  const classification = (textBlock && 'text' in textBlock ? textBlock.text : 'unknown')
    .trim()
    .toLowerCase();
  const validType = VALID_DOCUMENT_TYPES.has(classification) ? classification : 'unknown';
  await db
    .update(ocrDocuments)
    .set({ documentType: validType, updatedAt: new Date().toISOString() })
    .where(eq(ocrDocuments.id, documentId))
    .run();
  logger.info(`[OCR] Document ${documentId} classified as: ${validType}`);
  return validType;
}
