/**
 * CDR Open Banking Crawler — Storage Operations
 *
 * Database read/write operations for CDR data holders, products, and crawl logs.
 * Child record operations (rates, fees, features, eligibility) are in child-records.ts.
 */

import { eq, inArray } from 'drizzle-orm';
import { db, cdrDataHolders, cdrProducts, cdrCrawlLog } from '../../schema.js';
import type {
  CdrRegisterBrand,
  DataHolderRecord,
  CdrProductSummary,
  CdrProductDetail,
  CrawlError,
} from './types.js';
import {
  brandToInsertValues,
  brandToUpdateValues,
  productToInsertValues,
  productToUpdateValues,
} from './data-mapping.js';

// Re-export child records for convenience
export { replaceChildRecords } from './child-records.js';

// ============================================================================
// Data Holder storage
// ============================================================================

export async function upsertDataHolder(brand: CdrRegisterBrand, now: string): Promise<void> {
  const id = brand.dataHolderBrandId;

  const existing = await db.select().from(cdrDataHolders).where(eq(cdrDataHolders.id, id)).get();

  if (existing) {
    await db
      .update(cdrDataHolders)
      .set(brandToUpdateValues(brand, now))
      .where(eq(cdrDataHolders.id, id))
      .run();
  } else {
    await db.insert(cdrDataHolders).values(brandToInsertValues(brand, now)).run();
  }
}

export async function getDataHolderById(id: string): Promise<DataHolderRecord | null> {
  const holder = await db.select().from(cdrDataHolders).where(eq(cdrDataHolders.id, id)).get();

  if (!holder) return null;

  return {
    id: holder.id,
    dataHolderBrandId: holder.dataHolderBrandId,
    brandName: holder.brandName,
    publicBaseUri: holder.publicBaseUri,
  };
}

export async function getDataHoldersByIds(ids: string[]): Promise<DataHolderRecord[]> {
  const rows = await db.select().from(cdrDataHolders).where(inArray(cdrDataHolders.id, ids)).all();

  return rows.map((r: (typeof rows)[number]) => ({
    id: r.id,
    dataHolderBrandId: r.dataHolderBrandId,
    brandName: r.brandName,
    publicBaseUri: r.publicBaseUri,
  }));
}

export async function updateDataHolderStats(
  dataHolderId: string,
  productCount: number,
  now: string,
): Promise<void> {
  await db
    .update(cdrDataHolders)
    .set({
      productCount,
      lastCrawledAt: now,
      updatedAt: now,
    })
    .where(eq(cdrDataHolders.id, dataHolderId))
    .run();
}

// ============================================================================
// Product storage
// ============================================================================

export async function upsertProduct(
  product: CdrProductSummary,
  dataHolderId: string,
  now: string,
): Promise<string> {
  const compositeId = `${dataHolderId}::${product.productId}`;

  const existing = await db.select().from(cdrProducts).where(eq(cdrProducts.id, compositeId)).get();

  if (existing) {
    await db
      .update(cdrProducts)
      .set(productToUpdateValues(product, now))
      .where(eq(cdrProducts.id, compositeId))
      .run();
  } else {
    await db
      .insert(cdrProducts)
      .values(productToInsertValues(product, dataHolderId, compositeId, now))
      .run();
  }

  return compositeId;
}

export async function getProductById(compositeId: string) {
  return db.select().from(cdrProducts).where(eq(cdrProducts.id, compositeId)).get();
}

export async function updateProductDetail(
  compositeProductId: string,
  detail: CdrProductDetail,
  now: string,
): Promise<void> {
  await db
    .update(cdrProducts)
    .set({
      rawJson: JSON.stringify(detail),
      lastUpdated: detail.lastUpdated ?? now,
      updatedAt: now,
    })
    .where(eq(cdrProducts.id, compositeProductId))
    .run();
}

// ============================================================================
// Crawl log storage
// ============================================================================

export async function createCrawlLog(
  logId: string,
  crawlType: 'full' | 'incremental',
): Promise<void> {
  await db
    .insert(cdrCrawlLog)
    .values({
      id: logId,
      crawlType,
      status: 'running',
      startedAt: new Date().toISOString(),
    })
    .run();
}

export async function completeCrawlLog(
  logId: string,
  productsDiscovered: number,
  productsDetailed: number,
  errors: CrawlError[],
  durationMs: number,
): Promise<void> {
  await db
    .update(cdrCrawlLog)
    .set({
      status: errors.length > 0 ? 'completed_with_errors' : 'completed',
      productsDiscovered,
      productsUpdated: productsDetailed,
      errors: errors.length > 0 ? JSON.stringify(errors) : null,
      completedAt: new Date().toISOString(),
      durationMs,
    })
    .where(eq(cdrCrawlLog.id, logId))
    .run();
}
