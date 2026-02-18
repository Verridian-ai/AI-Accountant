/**
 * CDR Open Banking Crawler — Main Orchestrator
 *
 * 3-stage crawler for the Australian Consumer Data Right (CDR) Register:
 *   Stage 1 — Discovery: fetch data holder brands from CDR Register
 *   Stage 2 — Catalog: paginate each holder's product listing
 *   Stage 3 — Detail: fetch full product info (rates, fees, features, eligibility)
 *
 * Enforces per-holder rate limiting (500ms gap), exponential retry on 429/5xx,
 * and supports full + incremental crawl modes.
 */

import type {
  CdrCrawlerConfig,
  CrawlResult,
  CrawlError,
  DataHolderRecord,
  CdrRegisterBrand,
  CdrProductListResponse,
  CdrProductDetailResponse,
} from './types.js';
import { PerHolderRateLimiter, fetchWithRetry } from './api-client.js';
import { brandToDataHolderRecord, extractPublicBaseUri } from './data-mapping.js';
import {
  upsertDataHolder,
  getDataHolderById,
  upsertProduct,
  updateProductDetail,
  replaceChildRecords,
  updateDataHolderStats,
} from './storage.js';
import { executeFullCrawl, executeIncrementalCrawl } from './crawl-modes.js';
import { logger } from '../../lib/logger.js';

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: CdrCrawlerConfig = {
  registerBaseUrl: 'https://api.cdr.gov.au',
  rateLimit: 2,
  maxConcurrentHolders: 3,
  retryAttempts: 3,
  retryDelayMs: 1000,
  requestTimeoutMs: 15000,
  userAgent: 'GoldLedger-CDR-Crawler/1.0',
};

interface CrawlerError extends Error {
  statusCode?: number;
}

// ============================================================================
// CdrCrawler Class
// ============================================================================

export class CdrCrawler {
  private config: CdrCrawlerConfig;
  private rateLimiter: PerHolderRateLimiter;

  constructor(config?: Partial<CdrCrawlerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.rateLimiter = new PerHolderRateLimiter(this.config.rateLimit);
  }

  // --------------------------------------------------------------------------
  // HTTP helper (delegates to api-client)
  // --------------------------------------------------------------------------

  private async fetch(url: string, holderId: string, stage: CrawlError['stage']): Promise<unknown> {
    return fetchWithRetry(url, holderId, stage, this.config, this.rateLimiter);
  }

  // --------------------------------------------------------------------------
  // Stage 1 — Discovery
  // --------------------------------------------------------------------------

  async discoverDataHolders(): Promise<{
    holders: DataHolderRecord[];
    errors: CrawlError[];
  }> {
    const errors: CrawlError[] = [];
    const holders: DataHolderRecord[] = [];

    try {
      const url = `${this.config.registerBaseUrl}/cdr-register/v1/banking/data-holders/brands`;
      logger.info(`[CDR] Stage 1: Discovering data holders from ${url}`);

      const body = await this.fetch(url, '__register__', 'discovery');
      const bodyObj = body as Record<string, unknown> | undefined;
      const brands: CdrRegisterBrand[] = (bodyObj?.data ?? body ?? []) as CdrRegisterBrand[];

      const activeBrands = (Array.isArray(brands) ? brands : []).filter(
        (b) => b.status === 'ACTIVE',
      );

      logger.info(
        `[CDR] Found ${activeBrands.length} active data holders (of ${Array.isArray(brands) ? brands.length : 0} total)`,
      );

      const now = new Date().toISOString();

      for (const brand of activeBrands) {
        const publicBaseUri = extractPublicBaseUri(brand);

        if (!publicBaseUri) {
          errors.push({
            stage: 'discovery',
            dataHolderId: brand.dataHolderBrandId,
            message: `No publicBaseUri for ${brand.brandName}`,
          });
          continue;
        }

        await upsertDataHolder(brand, now);
        holders.push(brandToDataHolderRecord(brand));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`[CDR] Discovery failed: ${message}`);
      errors.push({ stage: 'discovery', message });
    }

    return { holders, errors };
  }

  // --------------------------------------------------------------------------
  // Stage 2 — Catalog
  // --------------------------------------------------------------------------

  async crawlCatalog(dataHolder: DataHolderRecord): Promise<{
    productIds: string[];
    errors: CrawlError[];
  }> {
    const errors: CrawlError[] = [];
    const productIds: string[] = [];
    const now = new Date().toISOString();
    let page = 1;
    let totalPages = 1;

    try {
      logger.info(`[CDR] Stage 2: Crawling catalog for ${dataHolder.brandName}`);

      while (page <= totalPages) {
        const url = `${dataHolder.publicBaseUri}/cds-au/v1/banking/products?page=${page}&page-size=25`;
        const body = (await this.fetch(url, dataHolder.id, 'catalog')) as CdrProductListResponse;

        const products = body?.data?.products ?? [];
        totalPages = body?.meta?.totalPages ?? 1;

        for (const product of products) {
          const compositeId = await upsertProduct(product, dataHolder.id, now);
          productIds.push(compositeId);
        }

        page++;
      }

      await updateDataHolderStats(dataHolder.id, productIds.length, now);
      logger.info(`[CDR] Cataloged ${productIds.length} products from ${dataHolder.brandName}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const statusCode = (err as CrawlerError).statusCode;
      logger.error(`[CDR] Catalog failed for ${dataHolder.brandName}: ${message}`);
      errors.push({
        stage: 'catalog',
        dataHolderId: dataHolder.id,
        message,
        statusCode,
      });
    }

    return { productIds, errors };
  }

  // --------------------------------------------------------------------------
  // Stage 3 — Detail
  // --------------------------------------------------------------------------

  async crawlProductDetail(
    dataHolder: DataHolderRecord,
    compositeProductId: string,
  ): Promise<{ errors: CrawlError[] }> {
    const errors: CrawlError[] = [];
    const productId = compositeProductId.split('::')[1] ?? compositeProductId;

    try {
      const url = `${dataHolder.publicBaseUri}/cds-au/v1/banking/products/${productId}`;
      const body = (await this.fetch(url, dataHolder.id, 'detail')) as CdrProductDetailResponse;

      const detail = body?.data;
      if (!detail) {
        throw new Error(`Empty detail response for product ${productId}`);
      }

      const now = new Date().toISOString();
      await updateProductDetail(compositeProductId, detail, now);
      await replaceChildRecords(compositeProductId, detail, now);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const statusCode = (err as CrawlerError).statusCode;
      logger.error(`[CDR] Detail failed for ${productId} @ ${dataHolder.brandName}: ${message}`);
      errors.push({
        stage: 'detail',
        dataHolderId: dataHolder.id,
        productId,
        message,
        statusCode,
      });
    }

    return { errors };
  }

  // --------------------------------------------------------------------------
  // Crawl a single data holder (catalog + detail)
  // --------------------------------------------------------------------------

  async crawlDataHolder(dataHolderId: string): Promise<CrawlResult> {
    const start = Date.now();
    const errors: CrawlError[] = [];
    let productsDiscovered = 0;
    let productsDetailed = 0;

    const dh = await getDataHolderById(dataHolderId);

    if (!dh) {
      return {
        holdersDiscovered: 0,
        holdersProcessed: 0,
        productsDiscovered: 0,
        productsDetailed: 0,
        errors: [
          {
            stage: 'catalog',
            dataHolderId,
            message: `Data holder ${dataHolderId} not found`,
          },
        ],
        durationMs: Date.now() - start,
      };
    }

    const catalogResult = await this.crawlCatalog(dh);
    errors.push(...catalogResult.errors);
    productsDiscovered = catalogResult.productIds.length;

    for (const pid of catalogResult.productIds) {
      const detailResult = await this.crawlProductDetail(dh, pid);
      errors.push(...detailResult.errors);
      if (detailResult.errors.length === 0) productsDetailed++;
    }

    return {
      holdersDiscovered: 0,
      holdersProcessed: 1,
      productsDiscovered,
      productsDetailed,
      errors,
      durationMs: Date.now() - start,
    };
  }

  // --------------------------------------------------------------------------
  // Full Crawl — delegates to crawl-modes
  // --------------------------------------------------------------------------

  async fullCrawl(): Promise<CrawlResult> {
    return executeFullCrawl(this, this.config);
  }

  // --------------------------------------------------------------------------
  // Incremental Crawl — delegates to crawl-modes
  // --------------------------------------------------------------------------

  async incrementalCrawl(dataHolderIds?: string[]): Promise<CrawlResult> {
    return executeIncrementalCrawl(this, this.config, dataHolderIds);
  }
}

// Singleton export
export const cdrCrawler = new CdrCrawler();
