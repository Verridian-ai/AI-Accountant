/**
 * CDR Cognee Indexer (Wave 18) — Service Class
 *
 * Reads CDR products, rates, fees, and features from the database and indexes
 * them into 3 Cognee datasets for semantic search.
 */

import { eq } from 'drizzle-orm';
import { db, cdrProducts, cdrDataHolders } from '../../schema.js';
import { logger } from '../../lib/logger.js';
import { cogneeTools, COGNEE_DATASETS } from '../claude/cognee-tools.js';
import { cogneeClient, type CogneeSearchType } from '../cognee_client.js';
import type { CdrIndexResult } from './types.js';
import { BANKING_KNOWLEDGE_DOCS } from './banking-knowledge.js';
import {
  indexDataHolder as indexDataHolderImpl,
  incrementalIndex as incrementalIndexImpl,
} from './incremental-indexer.js';
import { indexRates, indexProductKnowledge } from './product-indexing.js';

export class CdrCogneeIndexer {
  async indexProducts(): Promise<{ count: number; errors: string[] }> {
    const errors: string[] = [];

    try {
      const products = await db.select().from(cdrProducts).all();
      if (!products?.length) return { count: 0, errors: [] };

      const texts: string[] = [];

      for (const product of products as any[]) {
        let holderName = product.brandName ?? product.brand ?? '';
        if (!holderName && product.dataHolderId) {
          const holder = await db
            .select()
            .from(cdrDataHolders)
            .where(eq(cdrDataHolders.id, product.dataHolderId))
            .get();
          holderName = (holder as any)?.brandName ?? product.dataHolderId;
        }

        const text =
          `Product: ${product.name}. ` +
          `Bank: ${holderName}. ` +
          `Category: ${product.productCategory}. ` +
          (product.description ? `Description: ${product.description}. ` : '') +
          (product.isTailored ? 'Tailored product. ' : '') +
          (product.applicationUri ? `Apply: ${product.applicationUri}. ` : '');

        texts.push(text.trim());
      }

      await cogneeTools.index(texts, COGNEE_DATASETS.cdrProducts);
      return { count: texts.length, errors };
    } catch (err: any) {
      errors.push(`Product indexing failed: ${err.message}`);
      return { count: 0, errors };
    }
  }

  async indexRates(): Promise<{ count: number; errors: string[] }> {
    return indexRates();
  }

  async indexProductKnowledge(): Promise<{ count: number; errors: string[] }> {
    return indexProductKnowledge();
  }

  async indexAll(): Promise<CdrIndexResult> {
    const start = Date.now();
    const allErrors: string[] = [];

    logger.info('[CDR-Indexer] Starting full CDR Cognee indexing...');

    const productResult = await this.indexProducts();
    allErrors.push(...productResult.errors);
    logger.info(`[CDR-Indexer] Indexed ${productResult.count} products`);

    const rateResult = await this.indexRates();
    allErrors.push(...rateResult.errors);
    logger.info(`[CDR-Indexer] Indexed ${rateResult.count} rates`);

    const knowledgeResult = await this.indexProductKnowledge();
    allErrors.push(...knowledgeResult.errors);
    logger.info(`[CDR-Indexer] Indexed ${knowledgeResult.count} knowledge documents`);

    const datasets = [
      COGNEE_DATASETS.cdrProducts,
      COGNEE_DATASETS.cdrRates,
      COGNEE_DATASETS.bankingProductKnowledge,
    ];

    for (const dataset of datasets) {
      try {
        await cogneeTools.cognify(dataset);
        logger.info(`[CDR-Indexer] Cognified dataset: ${dataset}`);
      } catch (err: any) {
        allErrors.push(`Cognify failed for ${dataset}: ${err.message}`);
      }
    }

    const durationMs = Date.now() - start;
    logger.info(
      `[CDR-Indexer] Complete: ${productResult.count} products, ${rateResult.count} rates, ${knowledgeResult.count} knowledge docs in ${durationMs}ms`,
    );

    return {
      productsIndexed: productResult.count,
      ratesIndexed: rateResult.count,
      knowledgeDocsIndexed: knowledgeResult.count,
      errors: allErrors,
      durationMs,
    };
  }

  async indexDataHolder(dataHolderId: string): Promise<CdrIndexResult> {
    return indexDataHolderImpl(dataHolderId);
  }

  async indexBankingKnowledge(): Promise<{ count: number; errors: string[] }> {
    const errors: string[] = [];

    try {
      await cogneeTools.index(BANKING_KNOWLEDGE_DOCS, COGNEE_DATASETS.bankingProductKnowledge);
      await cogneeTools.cognify(COGNEE_DATASETS.bankingProductKnowledge);

      logger.info(
        `[CDR-Indexer] Indexed ${BANKING_KNOWLEDGE_DOCS.length} static banking knowledge documents`,
      );

      return { count: BANKING_KNOWLEDGE_DOCS.length, errors };
    } catch (err: any) {
      errors.push(`Banking knowledge indexing failed: ${err.message}`);
      return { count: 0, errors };
    }
  }

  async incrementalIndex(since: string): Promise<CdrIndexResult> {
    return incrementalIndexImpl(since);
  }

  async searchProducts(query: string, searchType?: CogneeSearchType): Promise<string[]> {
    const datasets = [
      COGNEE_DATASETS.cdrProducts,
      COGNEE_DATASETS.cdrRates,
      COGNEE_DATASETS.bankingProductKnowledge,
    ];

    const results = await cogneeClient.crossDatasetSearch(query, datasets, {
      searchType: searchType ?? 'CHUNKS',
      topK: 5,
      mergeResults: true,
    });
    return results.map((r: any) => (typeof r === 'string' ? r : (r.content ?? JSON.stringify(r))));
  }
}

export const cdrCogneeIndexer = new CdrCogneeIndexer();
