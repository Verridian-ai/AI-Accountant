import { eq, asc } from 'drizzle-orm';
import { db, ocrDocuments, ocrLineItems, merchantMemory } from '../../schema.js';
import type { OCRLineItemRecord } from './types.js';
import { CATEGORY_KEYWORDS } from './types.js';
import { processDocument } from './vision-extractor.js';
import { toLineItemRecord } from './mappers.js';

export async function extractLineItems(documentId: string): Promise<OCRLineItemRecord[]> {
  let items = await db
    .select()
    .from(ocrLineItems)
    .where(eq(ocrLineItems.documentId, documentId))
    .orderBy(asc(ocrLineItems.lineNumber))
    .all();
  if (!items.length) {
    await processDocument(documentId);
    items = await db
      .select()
      .from(ocrLineItems)
      .where(eq(ocrLineItems.documentId, documentId))
      .orderBy(asc(ocrLineItems.lineNumber))
      .all();
  }
  const doc = await db.select().from(ocrDocuments).where(eq(ocrDocuments.id, documentId)).get();
  const userId = (doc as Record<string, unknown> | undefined)?.userId as string | undefined;

  for (const item of items) {
    const itemRecord = item as Record<string, unknown>;
    if (itemRecord.category) continue;
    let matched = false;
    if (userId) {
      const memories = await db
        .select()
        .from(merchantMemory)
        .where(eq(merchantMemory.userId, userId))
        .all();
      for (const mem of memories) {
        const memRecord = mem as Record<string, unknown>;
        if (
          (itemRecord.description as string)
            .toLowerCase()
            .includes((memRecord.merchantPattern as string).toLowerCase())
        ) {
          await db
            .update(ocrLineItems)
            .set({ category: memRecord.category as string })
            .where(eq(ocrLineItems.id, itemRecord.id as string))
            .run();
          itemRecord.category = memRecord.category;
          matched = true;
          break;
        }
      }
    }
    if (!matched) {
      const desc = (itemRecord.description as string).toLowerCase();
      for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        if (keywords.some((kw) => desc.includes(kw))) {
          await db
            .update(ocrLineItems)
            .set({ category })
            .where(eq(ocrLineItems.id, itemRecord.id as string))
            .run();
          itemRecord.category = category;
          break;
        }
      }
    }
  }
  return (items as Record<string, unknown>[]).map((item) => toLineItemRecord(item));
}
