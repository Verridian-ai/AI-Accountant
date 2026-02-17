/**
 * CDR Open Banking Crawler (Wave 18)
 *
 * 3-stage crawler for the Australian Consumer Data Right (CDR) Register:
 *   Stage 1 — Discovery: fetch data holder brands from CDR Register
 *   Stage 2 — Catalog: paginate each holder's product listing
 *   Stage 3 — Detail: fetch full product info (rates, fees, features, eligibility)
 *
 * Enforces per-holder rate limiting (500ms gap), exponential retry on 429/5xx,
 * and supports full + incremental crawl modes.
 */

import crypto from 'crypto';
import { eq, and, inArray } from 'drizzle-orm';
import {
  db,
  cdrDataHolders,
  cdrProducts,
  cdrLendingRates,
  cdrDepositRates,
  cdrFees,
  cdrFeatures,
  cdrEligibility,
  cdrCrawlLog,
} from '../schema.js';

// ============================================================================
// Types
// ============================================================================

export interface CdrCrawlerConfig {
  registerBaseUrl: string;
  rateLimit: number;
  maxConcurrentHolders: number;
  retryAttempts: number;
  retryDelayMs: number;
  requestTimeoutMs: number;
  userAgent: string;
}

export interface CrawlResult {
  holdersDiscovered: number;
  holdersProcessed: number;
  productsDiscovered: number;
  productsDetailed: number;
  errors: CrawlError[];
  durationMs: number;
}

export interface CrawlError {
  dataHolderId?: string;
  productId?: string;
  stage: 'discovery' | 'catalog' | 'detail';
  message: string;
  statusCode?: number;
}

interface DataHolderRecord {
  id: string;
  dataHolderBrandId: string;
  brandName: string;
  publicBaseUri: string;
}

/** CDR Register API response shape for data holder brands */
interface CdrRegisterBrand {
  dataHolderBrandId: string;
  brandName: string;
  abn?: string;
  acn?: string;
  logoUri?: string;
  status: string;
  endpointDetail?: {
    publicBaseUri?: string;
  };
  registerUri?: string;
  industry?: string;
}

/** CDR product list response */
interface CdrProductListResponse {
  data: {
    products: CdrProductSummary[];
  };
  links: {
    self: string;
    first?: string;
    prev?: string;
    next?: string;
    last?: string;
  };
  meta: {
    totalRecords: number;
    totalPages: number;
  };
}

interface CdrProductSummary {
  productId: string;
  name: string;
  description?: string;
  brand?: string;
  brandName?: string;
  productCategory: string;
  isTailored?: boolean;
  effectiveFrom?: string;
  effectiveTo?: string;
  applicationUri?: string;
  additionalInformation?: {
    overviewUri?: string;
    termsUri?: string;
    eligibilityUri?: string;
    feesAndPricingUri?: string;
    bundleUri?: string;
  };
}

interface CdrProductDetailResponse {
  data: CdrProductDetail;
}

interface CdrProductDetail extends CdrProductSummary {
  lastUpdated?: string;
  additionalInformation?: {
    overviewUri?: string;
    termsUri?: string;
    eligibilityUri?: string;
    feesAndPricingUri?: string;
    bundleUri?: string;
  };
  bundles?: unknown[];
  features?: CdrFeatureData[];
  constraints?: unknown[];
  eligibility?: CdrEligibilityData[];
  fees?: CdrFeeData[];
  depositRates?: CdrDepositRateData[];
  lendingRates?: CdrLendingRateData[];
}

interface CdrFeatureData {
  featureType: string;
  additionalValue?: string;
  additionalInfo?: string;
  additionalInfoUri?: string;
  isActivated?: boolean;
}

interface CdrEligibilityData {
  eligibilityType: string;
  additionalValue?: string;
  additionalInfo?: string;
  additionalInfoUri?: string;
}

interface CdrFeeData {
  name: string;
  feeType: string;
  amount?: string;
  balanceRate?: string;
  transactionRate?: string;
  accruedRate?: string;
  accrualFrequency?: string;
  currency?: string;
  additionalValue?: string;
  additionalInfo?: string;
  additionalInfoUri?: string;
  discounts?: unknown[];
}

interface CdrDepositRateData {
  depositRateType: string;
  rate: string;
  calculationFrequency?: string;
  applicationFrequency?: string;
  tiers?: unknown[];
  additionalValue?: string;
  additionalInfo?: string;
  additionalInfoUri?: string;
}

interface CdrLendingRateData {
  lendingRateType: string;
  rate: string;
  comparisonRate?: string;
  calculationFrequency?: string;
  applicationFrequency?: string;
  interestPaymentDue?: string;
  repaymentType?: string;
  loanPurpose?: string;
  tiers?: unknown[];
  additionalValue?: string;
  additionalInfo?: string;
  additionalInfoUri?: string;
}

// ============================================================================
// Rate Limiter
// ============================================================================

class PerHolderRateLimiter {
  private lastRequestTime = new Map<string, number>();
  private minGapMs: number;

  constructor(requestsPerSecond: number) {
    this.minGapMs = Math.max(500, Math.ceil(1000 / requestsPerSecond));
  }

  async wait(holderId: string): Promise<void> {
    const now = Date.now();
    const lastTime = this.lastRequestTime.get(holderId) ?? 0;
    const elapsed = now - lastTime;

    if (elapsed < this.minGapMs) {
      const delay = this.minGapMs - elapsed;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    this.lastRequestTime.set(holderId, Date.now());
  }
}

// ============================================================================
// CdrCrawler
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

export class CdrCrawler {
  private config: CdrCrawlerConfig;
  private rateLimiter: PerHolderRateLimiter;

  constructor(config?: Partial<CdrCrawlerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.rateLimiter = new PerHolderRateLimiter(this.config.rateLimit);
  }

  // --------------------------------------------------------------------------
  // HTTP helpers
  // --------------------------------------------------------------------------

  private async fetchWithRetry<T = unknown>(
    url: string,
    holderId: string,
    stage: CrawlError['stage'],
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.retryAttempts; attempt++) {
      await this.rateLimiter.wait(holderId);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);

      try {
        const response = await fetch(url, {
          headers: {
            'x-v': '4',
            Accept: 'application/json',
            'User-Agent': this.config.userAgent,
          },
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('Retry-After') ?? '5', 10);
          const backoff = Math.max(
            retryAfter * 1000,
            this.config.retryDelayMs * Math.pow(2, attempt),
          );
          console.warn(
            `[CDR] 429 from ${holderId}, retrying in ${backoff}ms (attempt ${attempt + 1})`,
          );
          await new Promise((r) => setTimeout(r, backoff));
          continue;
        }

        if (response.status >= 500) {
          const backoff = this.config.retryDelayMs * Math.pow(2, attempt);
          console.warn(
            `[CDR] ${response.status} from ${holderId}, retrying in ${backoff}ms (attempt ${attempt + 1})`,
          );
          await new Promise((r) => setTimeout(r, backoff));
          continue;
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText} for ${url}`);
        }

        return await response.json() as T;
      } catch (err: unknown) {
        clearTimeout(timeout);
        lastError = err instanceof Error ? err : new Error(String(err));

        if (lastError.name === 'AbortError') {
          console.warn(`[CDR] Timeout for ${holderId} (attempt ${attempt + 1})`);
        }

        if (attempt < this.config.retryAttempts - 1) {
          const backoff = this.config.retryDelayMs * Math.pow(2, attempt);
          await new Promise((r) => setTimeout(r, backoff));
        }
      }
    }

    throw lastError ?? new Error(`Failed to fetch ${url} after retries`);
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
      console.log(`[CDR] Stage 1: Discovering data holders from ${url}`);

      const body = await this.fetchWithRetry(url, '__register__', 'discovery') as { data?: CdrRegisterBrand[] } | CdrRegisterBrand[];
      const brands: CdrRegisterBrand[] = (body as { data?: CdrRegisterBrand[] })?.data ?? (body as CdrRegisterBrand[]) ?? [];

      const activeBrands = (Array.isArray(brands) ? brands : []).filter(
        (b) => b.status === 'ACTIVE',
      );

      console.log(
        `[CDR] Found ${activeBrands.length} active data holders (of ${Array.isArray(brands) ? brands.length : 0} total)`,
      );

      const now = new Date().toISOString();

      for (const brand of activeBrands) {
        const publicBaseUri = brand.endpointDetail?.publicBaseUri ?? brand.registerUri ?? '';

        if (!publicBaseUri) {
          errors.push({
            stage: 'discovery',
            dataHolderId: brand.dataHolderBrandId,
            message: `No publicBaseUri for ${brand.brandName}`,
          });
          continue;
        }

        const id = brand.dataHolderBrandId;

        // Upsert into cdr_data_holders
        const existing = await db
          .select()
          .from(cdrDataHolders)
          .where(eq(cdrDataHolders.id, id))
          .get();

        if (existing) {
          await db
            .update(cdrDataHolders)
            .set({
              brandName: brand.brandName,
              abn: brand.abn ?? null,
              acn: brand.acn ?? null,
              logoUri: brand.logoUri ?? null,
              status: brand.status,
              publicBaseUri: publicBaseUri.replace(/\/$/, ''),
              registerUri: brand.registerUri ?? '',
              updatedAt: now,
            })
            .where(eq(cdrDataHolders.id, id))
            .run();
        } else {
          await db
            .insert(cdrDataHolders)
            .values({
              id,
              dataHolderBrandId: brand.dataHolderBrandId,
              brandName: brand.brandName,
              abn: brand.abn ?? null,
              acn: brand.acn ?? null,
              logoUri: brand.logoUri ?? null,
              status: brand.status,
              registerUri: brand.registerUri ?? '',
              publicBaseUri: publicBaseUri.replace(/\/$/, ''),
              industry: brand.industry ?? 'banking',
              createdAt: now,
              updatedAt: now,
            })
            .run();
        }

        holders.push({
          id,
          dataHolderBrandId: brand.dataHolderBrandId,
          brandName: brand.brandName,
          publicBaseUri: publicBaseUri.replace(/\/$/, ''),
        });
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[CDR] Discovery failed: ${errMsg}`);
      errors.push({
        stage: 'discovery',
        message: errMsg,
      });
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
      console.log(`[CDR] Stage 2: Crawling catalog for ${dataHolder.brandName}`);

      while (page <= totalPages) {
        const url = `${dataHolder.publicBaseUri}/cds-au/v1/banking/products?page=${page}&page-size=25`;
        const body: CdrProductListResponse = await this.fetchWithRetry(
          url,
          dataHolder.id,
          'catalog',
        );

        const products = body?.data?.products ?? [];
        totalPages = body?.meta?.totalPages ?? 1;

        for (const product of products) {
          const compositeId = `${dataHolder.id}::${product.productId}`;

          const existing = await db
            .select()
            .from(cdrProducts)
            .where(eq(cdrProducts.id, compositeId))
            .get();

          const additionalInfoUri = product.additionalInformation?.overviewUri ?? null;

          if (existing) {
            await db
              .update(cdrProducts)
              .set({
                name: product.name,
                description: product.description ?? null,
                brand: product.brand ?? null,
                brandName: product.brandName ?? null,
                productCategory: product.productCategory,
                isTailored: product.isTailored ?? false,
                effectiveFrom: product.effectiveFrom ?? null,
                effectiveTo: product.effectiveTo ?? null,
                applicationUri: product.applicationUri ?? null,
                additionalInfoUri,
                updatedAt: now,
              })
              .where(eq(cdrProducts.id, compositeId))
              .run();
          } else {
            await db
              .insert(cdrProducts)
              .values({
                id: compositeId,
                dataHolderId: dataHolder.id,
                productId: product.productId,
                name: product.name,
                description: product.description ?? null,
                brand: product.brand ?? null,
                brandName: product.brandName ?? null,
                productCategory: product.productCategory,
                isTailored: product.isTailored ?? false,
                effectiveFrom: product.effectiveFrom ?? null,
                effectiveTo: product.effectiveTo ?? null,
                applicationUri: product.applicationUri ?? null,
                additionalInfoUri,
                createdAt: now,
                updatedAt: now,
              })
              .run();
          }

          productIds.push(compositeId);
        }

        page++;
      }

      // Update holder stats
      await db
        .update(cdrDataHolders)
        .set({
          productCount: productIds.length,
          lastCrawledAt: now,
          updatedAt: now,
        })
        .where(eq(cdrDataHolders.id, dataHolder.id))
        .run();

      console.log(`[CDR] Cataloged ${productIds.length} products from ${dataHolder.brandName}`);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[CDR] Catalog failed for ${dataHolder.brandName}: ${errMsg}`);
      errors.push({
        stage: 'catalog',
        dataHolderId: dataHolder.id,
        message: errMsg,
        statusCode: (err as Record<string, number>).statusCode,
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
      const body: CdrProductDetailResponse = await this.fetchWithRetry(
        url,
        dataHolder.id,
        'detail',
      );

      const detail = body?.data;
      if (!detail) {
        throw new Error(`Empty detail response for product ${productId}`);
      }

      const now = new Date().toISOString();

      // Update product with raw JSON and lastUpdated
      await db
        .update(cdrProducts)
        .set({
          rawJson: JSON.stringify(detail),
          lastUpdated: detail.lastUpdated ?? now,
          updatedAt: now,
        })
        .where(eq(cdrProducts.id, compositeProductId))
        .run();

      // --- Upsert child records (delete stale + insert fresh) ---

      // Lending rates
      await db
        .delete(cdrLendingRates)
        .where(eq(cdrLendingRates.productId, compositeProductId))
        .run();

      if (detail.lendingRates?.length) {
        for (const lr of detail.lendingRates) {
          await db
            .insert(cdrLendingRates)
            .values({
              id: crypto.randomUUID(),
              productId: compositeProductId,
              lendingRateType: lr.lendingRateType,
              rate: parseFloat(lr.rate) || 0,
              comparisonRate: lr.comparisonRate ? parseFloat(lr.comparisonRate) : null,
              calculationFrequency: lr.calculationFrequency ?? null,
              applicationFrequency: lr.applicationFrequency ?? null,
              interestPaymentDue: lr.interestPaymentDue ?? null,
              repaymentType: lr.repaymentType ?? null,
              loanPurpose: lr.loanPurpose ?? null,
              tiers: lr.tiers ? JSON.stringify(lr.tiers) : null,
              additionalValue: lr.additionalValue ?? null,
              additionalInfo: lr.additionalInfo ?? null,
              additionalInfoUri: lr.additionalInfoUri ?? null,
              createdAt: now,
            })
            .run();
        }
      }

      // Deposit rates
      await db
        .delete(cdrDepositRates)
        .where(eq(cdrDepositRates.productId, compositeProductId))
        .run();

      if (detail.depositRates?.length) {
        for (const dr of detail.depositRates) {
          await db
            .insert(cdrDepositRates)
            .values({
              id: crypto.randomUUID(),
              productId: compositeProductId,
              depositRateType: dr.depositRateType,
              rate: parseFloat(dr.rate) || 0,
              calculationFrequency: dr.calculationFrequency ?? null,
              applicationFrequency: dr.applicationFrequency ?? null,
              tiers: dr.tiers ? JSON.stringify(dr.tiers) : null,
              additionalValue: dr.additionalValue ?? null,
              additionalInfo: dr.additionalInfo ?? null,
              additionalInfoUri: dr.additionalInfoUri ?? null,
              createdAt: now,
            })
            .run();
        }
      }

      // Fees
      await db.delete(cdrFees).where(eq(cdrFees.productId, compositeProductId)).run();

      if (detail.fees?.length) {
        for (const fee of detail.fees) {
          await db
            .insert(cdrFees)
            .values({
              id: crypto.randomUUID(),
              productId: compositeProductId,
              name: fee.name,
              feeType: fee.feeType,
              amount: fee.amount ?? null,
              balanceRate: fee.balanceRate ?? null,
              transactionRate: fee.transactionRate ?? null,
              accruedRate: fee.accruedRate ?? null,
              accrualFrequency: fee.accrualFrequency ?? null,
              currency: fee.currency ?? 'AUD',
              additionalValue: fee.additionalValue ?? null,
              additionalInfo: fee.additionalInfo ?? null,
              additionalInfoUri: fee.additionalInfoUri ?? null,
              discounts: fee.discounts ? JSON.stringify(fee.discounts) : null,
              createdAt: now,
            })
            .run();
        }
      }

      // Features
      await db.delete(cdrFeatures).where(eq(cdrFeatures.productId, compositeProductId)).run();

      if (detail.features?.length) {
        for (const feat of detail.features) {
          await db
            .insert(cdrFeatures)
            .values({
              id: crypto.randomUUID(),
              productId: compositeProductId,
              featureType: feat.featureType,
              additionalValue: feat.additionalValue ?? null,
              additionalInfo: feat.additionalInfo ?? null,
              additionalInfoUri: feat.additionalInfoUri ?? null,
              isActivated: feat.isActivated ?? true,
              createdAt: now,
            })
            .run();
        }
      }

      // Eligibility
      await db.delete(cdrEligibility).where(eq(cdrEligibility.productId, compositeProductId)).run();

      if (detail.eligibility?.length) {
        for (const elig of detail.eligibility) {
          await db
            .insert(cdrEligibility)
            .values({
              id: crypto.randomUUID(),
              productId: compositeProductId,
              eligibilityType: elig.eligibilityType,
              additionalValue: elig.additionalValue ?? null,
              additionalInfo: elig.additionalInfo ?? null,
              additionalInfoUri: elig.additionalInfoUri ?? null,
              createdAt: now,
            })
            .run();
        }
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(
        `[CDR] Detail failed for ${productId} @ ${dataHolder.brandName}: ${errMsg}`,
      );
      errors.push({
        stage: 'detail',
        dataHolderId: dataHolder.id,
        productId,
        message: errMsg,
        statusCode: (err as Record<string, number>).statusCode,
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

    const holder = await db
      .select()
      .from(cdrDataHolders)
      .where(eq(cdrDataHolders.id, dataHolderId))
      .get();

    if (!holder) {
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

    const dh: DataHolderRecord = {
      id: holder.id,
      dataHolderBrandId: holder.dataHolderBrandId,
      brandName: holder.brandName,
      publicBaseUri: holder.publicBaseUri,
    };

    // Catalog
    const catalogResult = await this.crawlCatalog(dh);
    errors.push(...catalogResult.errors);
    productsDiscovered = catalogResult.productIds.length;

    // Detail for each product
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
  // Full Crawl (all 3 stages)
  // --------------------------------------------------------------------------

  async fullCrawl(): Promise<CrawlResult> {
    const start = Date.now();
    const allErrors: CrawlError[] = [];
    let holdersDiscovered = 0;
    let holdersProcessed = 0;
    let totalProductsDiscovered = 0;
    let totalProductsDetailed = 0;

    const logId = crypto.randomUUID();

    // Log crawl start
    await db
      .insert(cdrCrawlLog)
      .values({
        id: logId,
        crawlType: 'full',
        status: 'running',
        startedAt: new Date().toISOString(),
      })
      .run();

    try {
      // Stage 1
      const { holders, errors: discoveryErrors } = await this.discoverDataHolders();
      allErrors.push(...discoveryErrors);
      holdersDiscovered = holders.length;

      // Stage 2+3 with concurrency limit
      const chunks = this.chunkArray(holders, this.config.maxConcurrentHolders);

      for (const chunk of chunks) {
        const results = await Promise.allSettled(
          chunk.map(async (holder) => {
            const catalogResult = await this.crawlCatalog(holder);
            allErrors.push(...catalogResult.errors);
            totalProductsDiscovered += catalogResult.productIds.length;

            // Stage 3 for each product
            for (const pid of catalogResult.productIds) {
              const detailResult = await this.crawlProductDetail(holder, pid);
              allErrors.push(...detailResult.errors);
              if (detailResult.errors.length === 0) totalProductsDetailed++;
            }

            holdersProcessed++;
          }),
        );

        // Capture unexpected rejections
        for (const result of results) {
          if (result.status === 'rejected') {
            allErrors.push({
              stage: 'catalog',
              message: result.reason?.message ?? String(result.reason),
            });
          }
        }
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      allErrors.push({ stage: 'discovery', message: errMsg });
    }

    const durationMs = Date.now() - start;

    // Update crawl log
    await db
      .update(cdrCrawlLog)
      .set({
        status: allErrors.length > 0 ? 'completed_with_errors' : 'completed',
        productsDiscovered: totalProductsDiscovered,
        productsUpdated: totalProductsDetailed,
        errors: allErrors.length > 0 ? JSON.stringify(allErrors) : null,
        completedAt: new Date().toISOString(),
        durationMs,
      })
      .where(eq(cdrCrawlLog.id, logId))
      .run();

    console.log(
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

  // --------------------------------------------------------------------------
  // Incremental Crawl
  // --------------------------------------------------------------------------

  async incrementalCrawl(dataHolderIds?: string[]): Promise<CrawlResult> {
    const start = Date.now();
    const allErrors: CrawlError[] = [];
    let holdersDiscovered = 0;
    let holdersProcessed = 0;
    let totalProductsDiscovered = 0;
    let totalProductsDetailed = 0;

    const logId = crypto.randomUUID();
    await db
      .insert(cdrCrawlLog)
      .values({
        id: logId,
        crawlType: 'incremental',
        status: 'running',
        startedAt: new Date().toISOString(),
      })
      .run();

    try {
      let holders: DataHolderRecord[];

      if (dataHolderIds?.length) {
        // Skip discovery — use provided IDs
        const rows = await db
          .select()
          .from(cdrDataHolders)
          .where(inArray(cdrDataHolders.id, dataHolderIds))
          .all();

        holders = rows.map((r: Record<string, unknown>) => ({
          id: r.id,
          dataHolderBrandId: r.dataHolderBrandId,
          brandName: r.brandName,
          publicBaseUri: r.publicBaseUri,
        }));
      } else {
        // Run discovery to get fresh holder list
        const result = await this.discoverDataHolders();
        allErrors.push(...result.errors);
        holders = result.holders;
        holdersDiscovered = holders.length;
      }

      // Process with concurrency limit
      const chunks = this.chunkArray(holders, this.config.maxConcurrentHolders);

      for (const chunk of chunks) {
        const results = await Promise.allSettled(
          chunk.map(async (holder) => {
            const catalogResult = await this.crawlCatalog(holder);
            allErrors.push(...catalogResult.errors);
            totalProductsDiscovered += catalogResult.productIds.length;

            // Only re-detail products that appear changed (or all if no lastUpdated)
            for (const pid of catalogResult.productIds) {
              const existingProduct = await db
                .select()
                .from(cdrProducts)
                .where(eq(cdrProducts.id, pid))
                .get();

              // Skip detail if we already have rawJson and it was updated within the last 24h
              const lastUpdated = existingProduct?.lastUpdated;
              if (lastUpdated && existingProduct?.rawJson) {
                const age = Date.now() - new Date(lastUpdated).getTime();
                if (age < 24 * 60 * 60 * 1000) {
                  totalProductsDetailed++;
                  continue;
                }
              }

              const detailResult = await this.crawlProductDetail(holder, pid);
              allErrors.push(...detailResult.errors);
              if (detailResult.errors.length === 0) totalProductsDetailed++;
            }

            holdersProcessed++;
          }),
        );

        for (const result of results) {
          if (result.status === 'rejected') {
            allErrors.push({
              stage: 'catalog',
              message: result.reason?.message ?? String(result.reason),
            });
          }
        }
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      allErrors.push({ stage: 'discovery', message: errMsg });
    }

    const durationMs = Date.now() - start;

    await db
      .update(cdrCrawlLog)
      .set({
        status: allErrors.length > 0 ? 'completed_with_errors' : 'completed',
        productsDiscovered: totalProductsDiscovered,
        productsUpdated: totalProductsDetailed,
        errors: allErrors.length > 0 ? JSON.stringify(allErrors) : null,
        completedAt: new Date().toISOString(),
        durationMs,
      })
      .where(eq(cdrCrawlLog.id, logId))
      .run();

    console.log(
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

  // --------------------------------------------------------------------------
  // Utilities
  // --------------------------------------------------------------------------

  private chunkArray<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }
}

// Singleton export
export const cdrCrawler = new CdrCrawler();
