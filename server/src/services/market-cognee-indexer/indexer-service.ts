/**
 * Market Intelligence Cognee Indexer (Wave 19) — Service Class
 *
 * Orchestrates full and incremental indexing across 5 Cognee datasets.
 * Domain-specific indexing logic is in domain-indexers.ts.
 */

import { gt } from 'drizzle-orm';
import { db, economicIndicators, marketPrices, sentimentSnapshots } from '../../schema.js';
import { COGNEE_DATASETS } from '../claude/cognee-tools.js';
import { cogneeClient, type CogneeSearchType } from '../cognee_client.js';
import { logger } from '../../lib/logger.js';
import type { MarketIndexResult } from './types.js';
import { MARKET_COGNIFY_PROMPT } from './types.js';
import {
  indexMarketIntelligence,
  indexSentimentData,
  indexRbaData,
  indexAbsData,
  indexMarketPrices,
  buildIntelligenceSnapshots,
} from './domain-indexers.js';

export class MarketCogneeIndexer {
  async indexMarketIntelligence(
    ...args: Parameters<typeof indexMarketIntelligence>
  ): ReturnType<typeof indexMarketIntelligence> {
    return indexMarketIntelligence(...args);
  }

  async indexSentimentData(
    ...args: Parameters<typeof indexSentimentData>
  ): ReturnType<typeof indexSentimentData> {
    return indexSentimentData(...args);
  }

  async indexRbaData(...args: Parameters<typeof indexRbaData>): ReturnType<typeof indexRbaData> {
    return indexRbaData(...args);
  }

  async indexAbsData(...args: Parameters<typeof indexAbsData>): ReturnType<typeof indexAbsData> {
    return indexAbsData(...args);
  }

  async indexMarketPrices(
    ...args: Parameters<typeof indexMarketPrices>
  ): ReturnType<typeof indexMarketPrices> {
    return indexMarketPrices(...args);
  }

  async fullIndex(): Promise<MarketIndexResult> {
    const start = Date.now();
    const allErrors: string[] = [];

    logger.info('[Market-Indexer] Starting full market Cognee indexing...');

    const allIndicators = await db.select().from(economicIndicators).all();
    const rbaIndicators = (allIndicators as any[]).filter(
      (i: any) => i.source === 'RBA' || i.source === 'Reserve Bank of Australia',
    );
    const absIndicators = (allIndicators as any[]).filter(
      (i: any) => i.source === 'ABS' || i.source === 'Australian Bureau of Statistics',
    );

    const allSentiment = await db.select().from(sentimentSnapshots).all();
    const allPrices = await db.select().from(marketPrices).all();

    const rbaResult = await indexRbaData(rbaIndicators);
    allErrors.push(...rbaResult.errors);
    logger.info(`[Market-Indexer] Indexed ${rbaResult.count} RBA documents`);

    const absResult = await indexAbsData(absIndicators);
    allErrors.push(...absResult.errors);
    logger.info(`[Market-Indexer] Indexed ${absResult.count} ABS documents`);

    const sentimentResult = await indexSentimentData(allSentiment as any[]);
    allErrors.push(...sentimentResult.errors);
    logger.info(`[Market-Indexer] Indexed ${sentimentResult.count} sentiment documents`);

    const priceResult = await indexMarketPrices(allPrices as any[]);
    allErrors.push(...priceResult.errors);
    logger.info(`[Market-Indexer] Indexed ${priceResult.count} price documents`);

    const intelligenceSnapshots = buildIntelligenceSnapshots(
      rbaIndicators,
      absIndicators,
      allSentiment as any[],
      allPrices as any[],
    );
    const intelligenceResult = await indexMarketIntelligence(intelligenceSnapshots);
    allErrors.push(...intelligenceResult.errors);
    logger.info(`[Market-Indexer] Indexed ${intelligenceResult.count} intelligence documents`);

    const datasets = [
      COGNEE_DATASETS.marketIntelligence,
      COGNEE_DATASETS.marketSentiment,
      COGNEE_DATASETS.rbaStatistics,
      COGNEE_DATASETS.absStatistics,
      COGNEE_DATASETS.asxMarketData,
    ];

    for (const dataset of datasets) {
      try {
        await cogneeClient.cognify([dataset], true, MARKET_COGNIFY_PROMPT);
        logger.info(`[Market-Indexer] Cognified dataset: ${dataset}`);
      } catch (err: any) {
        allErrors.push(`Cognify failed for ${dataset}: ${err.message}`);
      }
    }

    const durationMs = Date.now() - start;
    logger.info(
      `[Market-Indexer] Complete: ` +
        `${rbaResult.count} RBA, ${absResult.count} ABS, ` +
        `${sentimentResult.count} sentiment, ${priceResult.count} prices, ` +
        `${intelligenceResult.count} intelligence docs in ${durationMs}ms`,
    );

    return {
      intelligenceIndexed: intelligenceResult.count,
      sentimentIndexed: sentimentResult.count,
      rbaIndexed: rbaResult.count,
      absIndexed: absResult.count,
      pricesIndexed: priceResult.count,
      errors: allErrors,
      durationMs,
    };
  }

  async incrementalIndex(since: string): Promise<MarketIndexResult> {
    const start = Date.now();
    const allErrors: string[] = [];

    logger.info(`[Market-Indexer] Incremental index for data updated since ${since}`);

    const newIndicators = await db
      .select()
      .from(economicIndicators)
      .where(gt(economicIndicators.createdAt, since))
      .all();

    const rbaIndicators = (newIndicators as any[]).filter(
      (i: any) => i.source === 'RBA' || i.source === 'Reserve Bank of Australia',
    );
    const absIndicators = (newIndicators as any[]).filter(
      (i: any) => i.source === 'ABS' || i.source === 'Australian Bureau of Statistics',
    );

    const newSentiment = await db
      .select()
      .from(sentimentSnapshots)
      .where(gt(sentimentSnapshots.createdAt, since))
      .all();

    const newPrices = await db
      .select()
      .from(marketPrices)
      .where(gt(marketPrices.createdAt, since))
      .all();

    if (
      !rbaIndicators.length &&
      !absIndicators.length &&
      !(newSentiment as any[]).length &&
      !(newPrices as any[]).length
    ) {
      logger.info('[Market-Indexer] No updated market data found');
      return {
        intelligenceIndexed: 0,
        sentimentIndexed: 0,
        rbaIndexed: 0,
        absIndexed: 0,
        pricesIndexed: 0,
        errors: [],
        durationMs: Date.now() - start,
      };
    }

    let rbaCount = 0;
    if (rbaIndicators.length) {
      const rbaResult = await indexRbaData(rbaIndicators);
      rbaCount = rbaResult.count;
      allErrors.push(...rbaResult.errors);
    }

    let absCount = 0;
    if (absIndicators.length) {
      const absResult = await indexAbsData(absIndicators);
      absCount = absResult.count;
      allErrors.push(...absResult.errors);
    }

    let sentimentCount = 0;
    if ((newSentiment as any[]).length) {
      const sentimentResult = await indexSentimentData(newSentiment as any[]);
      sentimentCount = sentimentResult.count;
      allErrors.push(...sentimentResult.errors);
    }

    let priceCount = 0;
    if ((newPrices as any[]).length) {
      const priceResult = await indexMarketPrices(newPrices as any[]);
      priceCount = priceResult.count;
      allErrors.push(...priceResult.errors);
    }

    let intelligenceCount = 0;
    const intelligenceSnapshots = buildIntelligenceSnapshots(
      rbaIndicators,
      absIndicators,
      newSentiment as any[],
      newPrices as any[],
    );
    if (intelligenceSnapshots.length) {
      const intelligenceResult = await indexMarketIntelligence(intelligenceSnapshots);
      intelligenceCount = intelligenceResult.count;
      allErrors.push(...intelligenceResult.errors);
    }

    const datasetsToUpdate: string[] = [];
    if (rbaCount) datasetsToUpdate.push(COGNEE_DATASETS.rbaStatistics);
    if (absCount) datasetsToUpdate.push(COGNEE_DATASETS.absStatistics);
    if (sentimentCount) datasetsToUpdate.push(COGNEE_DATASETS.marketSentiment);
    if (priceCount) datasetsToUpdate.push(COGNEE_DATASETS.asxMarketData);
    if (intelligenceCount) datasetsToUpdate.push(COGNEE_DATASETS.marketIntelligence);

    for (const dataset of datasetsToUpdate) {
      try {
        await cogneeClient.cognify([dataset], true, MARKET_COGNIFY_PROMPT);
      } catch (err: any) {
        allErrors.push(`Incremental cognify ${dataset}: ${err.message}`);
      }
    }

    const durationMs = Date.now() - start;
    logger.info(
      `[Market-Indexer] Incremental: ${rbaCount} RBA, ${absCount} ABS, ` +
        `${sentimentCount} sentiment, ${priceCount} prices, ` +
        `${intelligenceCount} intelligence docs in ${durationMs}ms`,
    );

    return {
      intelligenceIndexed: intelligenceCount,
      sentimentIndexed: sentimentCount,
      rbaIndexed: rbaCount,
      absIndexed: absCount,
      pricesIndexed: priceCount,
      errors: allErrors,
      durationMs,
    };
  }

  async searchMarketKnowledge(
    query: string,
    datasets?: string[],
    searchType?: CogneeSearchType,
  ): Promise<string[]> {
    const targetDatasets = datasets ?? [
      COGNEE_DATASETS.marketIntelligence,
      COGNEE_DATASETS.marketSentiment,
      COGNEE_DATASETS.rbaStatistics,
      COGNEE_DATASETS.absStatistics,
      COGNEE_DATASETS.asxMarketData,
    ];

    const results = await cogneeClient.crossDatasetSearch(query, targetDatasets, {
      searchType: searchType ?? 'CHUNKS',
      topK: 5,
      mergeResults: true,
    });
    return results.map((r: any) => (typeof r === 'string' ? r : (r.content ?? JSON.stringify(r))));
  }
}

export const marketCogneeIndexer = new MarketCogneeIndexer();
