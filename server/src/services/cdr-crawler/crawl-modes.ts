/**
 * CDR Open Banking Crawler — Crawl Mode Orchestration
 *
 * Full and incremental crawl orchestration logic, extracted from the main
 * CdrCrawler class to keep each file under 300 lines.
 */

import crypto from 'crypto';
import type { CdrCrawlerConfig, CrawlResult, CrawlError, DataHolderRecord } from './types.js';
import {
  getDataHoldersByIds,
  getProductById,
  createCrawlLog,
  completeCrawlLog,
} from './storage.js';
import { logger } from '../../lib/logger.js';

// ============================================================================
// Crawler Stage Interface (subset of CdrCrawler used by crawl modes)
// ============================================================================

export interface CrawlerStages {
  discoverDataHolders(): Promise<{
    holders: DataHolderRecord[];
    errors: CrawlError[];
  }>;
  crawlCatalog(dataHolder: DataHolderRecord): Promise<{
    productIds: string[];
    errors: CrawlError[];
  }>;
  crawlProductDetail(
    dataHolder: DataHolderRecord,
    compositeProductId: string,
  ): Promise<{ errors: CrawlError[] }>;
}

// ============================================================================
// Utility
// ============================================================================

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function collectRejections(results: PromiseSettledResult<void>[], allErrors: CrawlError[]): void {
  for (const result of results) {
    if (result.status === 'rejected') {
      allErrors.push({
        stage: 'catalog',
        message: result.reason?.message ?? String(result.reason),
      });
    }
  }
}

// ============================================================================
// Full Crawl (all 3 stages)
// ============================================================================

export async function executeFullCrawl(
  crawler: CrawlerStages,
  config: CdrCrawlerConfig,
): Promise<CrawlResult> {
  const start = Date.now();
  const allErrors: CrawlError[] = [];
  let holdersDiscovered = 0;
  let holdersProcessed = 0;
  let totalProductsDiscovered = 0;
  let totalProductsDetailed = 0;

  const logId = crypto.randomUUID();
  await createCrawlLog(logId, 'full');

  try {
    const { holders, errors: discoveryErrors } = await crawler.discoverDataHolders();
    allErrors.push(...discoveryErrors);
    holdersDiscovered = holders.length;

    const chunks = chunkArray(holders, config.maxConcurrentHolders);

    for (const chunk of chunks) {
      const results = await Promise.allSettled(
        chunk.map(async (holder) => {
          const catalogResult = await crawler.crawlCatalog(holder);
          allErrors.push(...catalogResult.errors);
          totalProductsDiscovered += catalogResult.productIds.length;

          for (const pid of catalogResult.productIds) {
            const detailResult = await crawler.crawlProductDetail(holder, pid);
            allErrors.push(...detailResult.errors);
            if (detailResult.errors.length === 0) totalProductsDetailed++;
          }

          holdersProcessed++;
        }),
      );

      collectRejections(results, allErrors);
    }
  } catch (err: any) {
    allErrors.push({ stage: 'discovery', message: err.message });
  }

  const durationMs = Date.now() - start;
  await completeCrawlLog(
    logId,
    totalProductsDiscovered,
    totalProductsDetailed,
    allErrors,
    durationMs,
  );

  logger.info(
    `[CDR] Full crawl complete: ${holdersDiscovered} holders, ${totalProductsDiscovered} products, ${totalProductsDetailed} detailed, ${allErrors.length} errors in ${durationMs}ms`,
  );

  return {
    holdersDiscovered,
    holdersProcessed,
    productsDiscovered: totalProductsDiscovered,
    productsDetailed: totalProductsDetailed,
    errors: allErrors,
    durationMs,
  };
}

// ============================================================================
// Incremental Crawl
// ============================================================================

export async function executeIncrementalCrawl(
  crawler: CrawlerStages,
  config: CdrCrawlerConfig,
  dataHolderIds?: string[],
): Promise<CrawlResult> {
  const start = Date.now();
  const allErrors: CrawlError[] = [];
  let holdersDiscovered = 0;
  let holdersProcessed = 0;
  let totalProductsDiscovered = 0;
  let totalProductsDetailed = 0;

  const logId = crypto.randomUUID();
  await createCrawlLog(logId, 'incremental');

  try {
    let holders: DataHolderRecord[];

    if (dataHolderIds?.length) {
      holders = await getDataHoldersByIds(dataHolderIds);
    } else {
      const result = await crawler.discoverDataHolders();
      allErrors.push(...result.errors);
      holders = result.holders;
      holdersDiscovered = holders.length;
    }

    const chunks = chunkArray(holders, config.maxConcurrentHolders);

    for (const chunk of chunks) {
      const results = await Promise.allSettled(
        chunk.map(async (holder) => {
          const catalogResult = await crawler.crawlCatalog(holder);
          allErrors.push(...catalogResult.errors);
          totalProductsDiscovered += catalogResult.productIds.length;

          for (const pid of catalogResult.productIds) {
            const existingProduct = await getProductById(pid);

            const lastUpdated = existingProduct?.lastUpdated;
            if (lastUpdated && existingProduct?.rawJson) {
              const age = Date.now() - new Date(lastUpdated).getTime();
              if (age < 24 * 60 * 60 * 1000) {
                totalProductsDetailed++;
                continue;
              }
            }

            const detailResult = await crawler.crawlProductDetail(holder, pid);
            allErrors.push(...detailResult.errors);
            if (detailResult.errors.length === 0) totalProductsDetailed++;
          }

          holdersProcessed++;
        }),
      );

      collectRejections(results, allErrors);
    }
  } catch (err: any) {
    allErrors.push({ stage: 'discovery', message: err.message });
  }

  const durationMs = Date.now() - start;
  await completeCrawlLog(
    logId,
    totalProductsDiscovered,
    totalProductsDetailed,
    allErrors,
    durationMs,
  );

  logger.info(
    `[CDR] Incremental crawl complete: ${holdersProcessed} holders, ${totalProductsDiscovered} products in ${durationMs}ms`,
  );

  return {
    holdersDiscovered,
    holdersProcessed,
    productsDiscovered: totalProductsDiscovered,
    productsDetailed: totalProductsDetailed,
    errors: allErrors,
    durationMs,
  };
}
