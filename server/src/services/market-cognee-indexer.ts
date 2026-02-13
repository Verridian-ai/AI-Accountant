/**
 * Market Intelligence Cognee Indexer (Wave 19)
 *
 * Reads market data from 5 domains (indicators, sentiment, RBA, ABS, prices)
 * and indexes them into 5 Cognee datasets for semantic search:
 *   1. market_intelligence    — combined market analysis documents (CHUNKS)
 *   2. market_sentiment       — sentiment snapshot documents (GRAPH_COMPLETION)
 *   3. rba_statistics         — RBA indicator documents grouped by category (CHUNKS_LEXICAL)
 *   4. abs_statistics         — ABS indicator documents grouped by dataflow (CHUNKS_LEXICAL)
 *   5. asx_market_data        — ASX/crypto price documents (CHUNKS)
 */

import { gt } from 'drizzle-orm';
import { db, economicIndicators, marketPrices, sentimentSnapshots } from '../schema.js';
import { cogneeTools, COGNEE_DATASETS } from './claude/cognee-tools.js';
import { cogneeClient, type CogneeSearchType } from './cognee_client.js';

export interface MarketIndexResult {
  intelligenceIndexed: number;
  sentimentIndexed: number;
  rbaIndexed: number;
  absIndexed: number;
  pricesIndexed: number;
  errors: string[];
  durationMs: number;
}

/** Custom cognify prompt for market intelligence entity extraction */
const MARKET_COGNIFY_PROMPT =
  'Extract economic and financial entities: indicator names, values, trends, ' +
  'percentage changes, time periods, data sources (RBA, ABS, ASX), asset symbols, ' +
  'sentiment labels, market sectors, exchange names, and causal relationships ' +
  'between economic indicators (e.g. cash rate affects lending rates). ' +
  'Identify temporal patterns like quarterly releases, seasonal trends, and rate cycles.';

export class MarketCogneeIndexer {
  /**
   * Index combined market intelligence documents into the market_intelligence dataset.
   * Creates rich, human-readable summaries combining indicators, prices, and sentiment.
   */
  async indexMarketIntelligence(
    snapshots: Array<{
      topic: string;
      summary: string;
      sentimentLabel: string;
      observationDate: string;
      indicators?: Array<{ name: string; value: number; unit: string; changePct: number | null }>;
      prices?: Array<{ symbol: string; name: string; price: number; changePct: number | null }>;
    }>,
  ): Promise<{ count: number; errors: string[] }> {
    const errors: string[] = [];

    try {
      if (!snapshots?.length) return { count: 0, errors: [] };

      const texts: string[] = [];

      for (const snap of snapshots) {
        let text =
          `Market Intelligence: ${snap.topic} (${snap.observationDate}). ` +
          `Sentiment: ${snap.sentimentLabel}. ` +
          (snap.summary ? `Summary: ${snap.summary}. ` : '');

        if (snap.indicators?.length) {
          const indicatorText = snap.indicators
            .map(
              (i) =>
                `${i.name}: ${i.value} ${i.unit}` +
                (i.changePct != null
                  ? ` (${i.changePct >= 0 ? '+' : ''}${i.changePct.toFixed(2)}%)`
                  : ''),
            )
            .join('; ');
          text += `Key Indicators: ${indicatorText}. `;
        }

        if (snap.prices?.length) {
          const priceText = snap.prices
            .map(
              (p) =>
                `${p.symbol} (${p.name}): $${p.price.toFixed(2)}` +
                (p.changePct != null
                  ? ` (${p.changePct >= 0 ? '+' : ''}${p.changePct.toFixed(2)}%)`
                  : ''),
            )
            .join('; ');
          text += `Market Prices: ${priceText}. `;
        }

        texts.push(text.trim());
      }

      if (texts.length > 0) {
        await cogneeTools.index(texts, COGNEE_DATASETS.marketIntelligence);
      }

      return { count: texts.length, errors };
    } catch (err: any) {
      errors.push(`Market intelligence indexing failed: ${err.message}`);
      return { count: 0, errors };
    }
  }

  /**
   * Index sentiment snapshot documents into the market_sentiment dataset.
   * Captures sentiment scores, labels, source counts, and summaries.
   */
  async indexSentimentData(sentiments: any[]): Promise<{ count: number; errors: string[] }> {
    const errors: string[] = [];

    try {
      if (!sentiments?.length) return { count: 0, errors: [] };

      const texts: string[] = [];

      for (const s of sentiments) {
        const text =
          `Sentiment Analysis: "${s.topic}" (${s.observationDate}). ` +
          `Query: "${s.query}". ` +
          (s.sentimentLabel ? `Label: ${s.sentimentLabel}. ` : '') +
          (s.sentimentScore != null ? `Score: ${Number(s.sentimentScore).toFixed(2)}. ` : '') +
          (s.confidence != null
            ? `Confidence: ${(Number(s.confidence) * 100).toFixed(0)}%. `
            : '') +
          `Posts: ${s.totalPosts ?? 0} (positive: ${s.positiveCount ?? 0}, negative: ${s.negativeCount ?? 0}, neutral: ${s.neutralCount ?? 0}). ` +
          (s.summary ? `Summary: ${s.summary}. ` : '') +
          (s.analysisModel ? `Model: ${s.analysisModel}. ` : '');

        texts.push(text.trim());
      }

      if (texts.length > 0) {
        await cogneeTools.index(texts, COGNEE_DATASETS.marketSentiment);
      }

      return { count: texts.length, errors };
    } catch (err: any) {
      errors.push(`Sentiment indexing failed: ${err.message}`);
      return { count: 0, errors };
    }
  }

  /**
   * Index RBA indicator documents into the rba_statistics dataset.
   * Groups indicators by category for structured retrieval.
   */
  async indexRbaData(indicators: any[]): Promise<{ count: number; errors: string[] }> {
    const errors: string[] = [];

    try {
      if (!indicators?.length) return { count: 0, errors: [] };

      const texts: string[] = [];

      // Group by category for richer documents
      const grouped = new Map<string, any[]>();
      for (const ind of indicators) {
        const cat = ind.category ?? 'General';
        if (!grouped.has(cat)) grouped.set(cat, []);
        grouped.get(cat)!.push(ind);
      }

      for (const [category, items] of grouped) {
        const indicatorDetails = items
          .map(
            (i: any) =>
              `${i.indicatorName} (${i.indicatorCode}): ${i.value} ${i.unit}` +
              (i.changePct != null
                ? ` (${Number(i.changePct) >= 0 ? '+' : ''}${Number(i.changePct).toFixed(2)}%)`
                : '') +
              ` [${i.referencePeriod}]`,
          )
          .join('; ');

        const latestDate = items.reduce(
          (max: string, i: any) => (i.observationDate > max ? i.observationDate : max),
          items[0].observationDate,
        );

        const text =
          `RBA Statistics — ${category} (as of ${latestDate}). ` +
          `Source: Reserve Bank of Australia. ` +
          `Indicators: ${indicatorDetails}.`;

        texts.push(text.trim());
      }

      // Also index individual indicators for fine-grained search
      for (const ind of indicators) {
        const text =
          `RBA Indicator: ${ind.indicatorName} (${ind.indicatorCode}). ` +
          `Category: ${ind.category}. ` +
          `Value: ${ind.value} ${ind.unit}. ` +
          (ind.previousValue != null ? `Previous: ${ind.previousValue} ${ind.unit}. ` : '') +
          (ind.changePct != null
            ? `Change: ${Number(ind.changePct) >= 0 ? '+' : ''}${Number(ind.changePct).toFixed(2)}%. `
            : '') +
          `Period: ${ind.referencePeriod}. ` +
          `Frequency: ${ind.frequency}. ` +
          `Date: ${ind.observationDate}.`;

        texts.push(text.trim());
      }

      if (texts.length > 0) {
        await cogneeTools.index(texts, COGNEE_DATASETS.rbaStatistics);
      }

      return { count: texts.length, errors };
    } catch (err: any) {
      errors.push(`RBA indexing failed: ${err.message}`);
      return { count: 0, errors };
    }
  }

  /**
   * Index ABS indicator documents into the abs_statistics dataset.
   * Groups indicators by category/dataflow for structured retrieval.
   */
  async indexAbsData(indicators: any[]): Promise<{ count: number; errors: string[] }> {
    const errors: string[] = [];

    try {
      if (!indicators?.length) return { count: 0, errors: [] };

      const texts: string[] = [];

      // Group by category for richer documents
      const grouped = new Map<string, any[]>();
      for (const ind of indicators) {
        const cat = ind.category ?? 'General';
        if (!grouped.has(cat)) grouped.set(cat, []);
        grouped.get(cat)!.push(ind);
      }

      for (const [category, items] of grouped) {
        const indicatorDetails = items
          .map(
            (i: any) =>
              `${i.indicatorName} (${i.indicatorCode}): ${i.value} ${i.unit}` +
              (i.changePct != null
                ? ` (${Number(i.changePct) >= 0 ? '+' : ''}${Number(i.changePct).toFixed(2)}%)`
                : '') +
              ` [${i.referencePeriod}]`,
          )
          .join('; ');

        const latestDate = items.reduce(
          (max: string, i: any) => (i.observationDate > max ? i.observationDate : max),
          items[0].observationDate,
        );

        const text =
          `ABS Statistics — ${category} (as of ${latestDate}). ` +
          `Source: Australian Bureau of Statistics. ` +
          `Indicators: ${indicatorDetails}.`;

        texts.push(text.trim());
      }

      // Also index individual indicators
      for (const ind of indicators) {
        const text =
          `ABS Indicator: ${ind.indicatorName} (${ind.indicatorCode}). ` +
          `Category: ${ind.category}. ` +
          `Value: ${ind.value} ${ind.unit}. ` +
          (ind.previousValue != null ? `Previous: ${ind.previousValue} ${ind.unit}. ` : '') +
          (ind.changePct != null
            ? `Change: ${Number(ind.changePct) >= 0 ? '+' : ''}${Number(ind.changePct).toFixed(2)}%. `
            : '') +
          `Period: ${ind.referencePeriod}. ` +
          `Frequency: ${ind.frequency}. ` +
          `Date: ${ind.observationDate}.`;

        texts.push(text.trim());
      }

      if (texts.length > 0) {
        await cogneeTools.index(texts, COGNEE_DATASETS.absStatistics);
      }

      return { count: texts.length, errors };
    } catch (err: any) {
      errors.push(`ABS indexing failed: ${err.message}`);
      return { count: 0, errors };
    }
  }

  /**
   * Index ASX/crypto market price documents into the asx_market_data dataset.
   * Captures symbol, name, price, change, volume, and market cap.
   */
  async indexMarketPrices(prices: any[]): Promise<{ count: number; errors: string[] }> {
    const errors: string[] = [];

    try {
      if (!prices?.length) return { count: 0, errors: [] };

      const texts: string[] = [];

      for (const p of prices) {
        const text =
          `Market Price: ${p.symbol} — ${p.name}. ` +
          `Type: ${p.assetType}. ` +
          `Price: $${Number(p.price).toFixed(2)} ${p.currency ?? 'AUD'}. ` +
          (p.previousClose != null
            ? `Previous Close: $${Number(p.previousClose).toFixed(2)}. `
            : '') +
          (p.changePct != null
            ? `Change: ${Number(p.changePct) >= 0 ? '+' : ''}${Number(p.changePct).toFixed(2)}%. `
            : '') +
          (p.dayHigh != null && p.dayLow != null
            ? `Range: $${Number(p.dayLow).toFixed(2)} – $${Number(p.dayHigh).toFixed(2)}. `
            : '') +
          (p.volume != null ? `Volume: ${Number(p.volume).toLocaleString()}. ` : '') +
          (p.marketCap != null ? `Market Cap: $${Number(p.marketCap).toLocaleString()}. ` : '') +
          (p.exchange ? `Exchange: ${p.exchange}. ` : '') +
          `Date: ${p.observationDate}.`;

        texts.push(text.trim());
      }

      if (texts.length > 0) {
        await cogneeTools.index(texts, COGNEE_DATASETS.asxMarketData);
      }

      return { count: texts.length, errors };
    } catch (err: any) {
      errors.push(`Market price indexing failed: ${err.message}`);
      return { count: 0, errors };
    }
  }

  /**
   * Run a full indexing pipeline: fetch all market data from DB and index all 5 datasets.
   * Triggers cognify on each dataset after indexing.
   */
  async fullIndex(): Promise<MarketIndexResult> {
    const start = Date.now();
    const allErrors: string[] = [];

    console.log('[Market-Indexer] Starting full market Cognee indexing...');

    // 1. Fetch all indicators from DB, split by source (RBA vs ABS)
    const allIndicators = await db.select().from(economicIndicators).all();
    const rbaIndicators = (allIndicators as any[]).filter(
      (i: any) => i.source === 'RBA' || i.source === 'Reserve Bank of Australia',
    );
    const absIndicators = (allIndicators as any[]).filter(
      (i: any) => i.source === 'ABS' || i.source === 'Australian Bureau of Statistics',
    );

    // 2. Fetch all sentiment snapshots
    const allSentiment = await db.select().from(sentimentSnapshots).all();

    // 3. Fetch all market prices
    const allPrices = await db.select().from(marketPrices).all();

    // Index RBA data
    const rbaResult = await this.indexRbaData(rbaIndicators);
    allErrors.push(...rbaResult.errors);
    console.log(`[Market-Indexer] Indexed ${rbaResult.count} RBA documents`);

    // Index ABS data
    const absResult = await this.indexAbsData(absIndicators);
    allErrors.push(...absResult.errors);
    console.log(`[Market-Indexer] Indexed ${absResult.count} ABS documents`);

    // Index sentiment
    const sentimentResult = await this.indexSentimentData(allSentiment as any[]);
    allErrors.push(...sentimentResult.errors);
    console.log(`[Market-Indexer] Indexed ${sentimentResult.count} sentiment documents`);

    // Index prices
    const priceResult = await this.indexMarketPrices(allPrices as any[]);
    allErrors.push(...priceResult.errors);
    console.log(`[Market-Indexer] Indexed ${priceResult.count} price documents`);

    // Build combined market intelligence from latest data
    const intelligenceSnapshots = this.buildIntelligenceSnapshots(
      rbaIndicators,
      absIndicators,
      allSentiment as any[],
      allPrices as any[],
    );
    const intelligenceResult = await this.indexMarketIntelligence(intelligenceSnapshots);
    allErrors.push(...intelligenceResult.errors);
    console.log(`[Market-Indexer] Indexed ${intelligenceResult.count} intelligence documents`);

    // Trigger cognify on all 5 datasets
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
        console.log(`[Market-Indexer] Cognified dataset: ${dataset}`);
      } catch (err: any) {
        allErrors.push(`Cognify failed for ${dataset}: ${err.message}`);
      }
    }

    const durationMs = Date.now() - start;
    console.log(
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

  /**
   * Incremental index: only index data updated since the given timestamp.
   * Avoids re-indexing unchanged data for efficiency.
   */
  async incrementalIndex(since: string): Promise<MarketIndexResult> {
    const start = Date.now();
    const allErrors: string[] = [];

    console.log(`[Market-Indexer] Incremental index for data updated since ${since}`);

    // Fetch only new indicators
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

    // Fetch only new sentiment
    const newSentiment = await db
      .select()
      .from(sentimentSnapshots)
      .where(gt(sentimentSnapshots.createdAt, since))
      .all();

    // Fetch only new prices
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
      console.log('[Market-Indexer] No updated market data found');
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

    // Index updated RBA data
    let rbaCount = 0;
    if (rbaIndicators.length) {
      const rbaResult = await this.indexRbaData(rbaIndicators);
      rbaCount = rbaResult.count;
      allErrors.push(...rbaResult.errors);
    }

    // Index updated ABS data
    let absCount = 0;
    if (absIndicators.length) {
      const absResult = await this.indexAbsData(absIndicators);
      absCount = absResult.count;
      allErrors.push(...absResult.errors);
    }

    // Index updated sentiment
    let sentimentCount = 0;
    if ((newSentiment as any[]).length) {
      const sentimentResult = await this.indexSentimentData(newSentiment as any[]);
      sentimentCount = sentimentResult.count;
      allErrors.push(...sentimentResult.errors);
    }

    // Index updated prices
    let priceCount = 0;
    if ((newPrices as any[]).length) {
      const priceResult = await this.indexMarketPrices(newPrices as any[]);
      priceCount = priceResult.count;
      allErrors.push(...priceResult.errors);
    }

    // Build combined intelligence from new data
    let intelligenceCount = 0;
    const intelligenceSnapshots = this.buildIntelligenceSnapshots(
      rbaIndicators,
      absIndicators,
      newSentiment as any[],
      newPrices as any[],
    );
    if (intelligenceSnapshots.length) {
      const intelligenceResult = await this.indexMarketIntelligence(intelligenceSnapshots);
      intelligenceCount = intelligenceResult.count;
      allErrors.push(...intelligenceResult.errors);
    }

    // Cognify only datasets that were updated
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
    console.log(
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

  /**
   * Convenience search wrapper that fans out across all 5 market datasets.
   * Returns merged results sorted by relevance.
   *
   * Smart search type selection:
   *  - CHUNKS: specific data point lookups
   *  - CHUNKS_LEXICAL: indicator name searches
   *  - GRAPH_COMPLETION: trend analysis and reasoning
   *  - RAG_COMPLETION: comprehensive market questions
   */
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

  // --- Private helpers ---

  /**
   * Build combined intelligence snapshot documents from multiple data sources.
   * Creates high-level market analysis documents for the market_intelligence dataset.
   */
  private buildIntelligenceSnapshots(
    rbaIndicators: any[],
    absIndicators: any[],
    sentiments: any[],
    prices: any[],
  ): Array<{
    topic: string;
    summary: string;
    sentimentLabel: string;
    observationDate: string;
    indicators?: Array<{ name: string; value: number; unit: string; changePct: number | null }>;
    prices?: Array<{ symbol: string; name: string; price: number; changePct: number | null }>;
  }> {
    const snapshots: Array<{
      topic: string;
      summary: string;
      sentimentLabel: string;
      observationDate: string;
      indicators?: Array<{ name: string; value: number; unit: string; changePct: number | null }>;
      prices?: Array<{ symbol: string; name: string; price: number; changePct: number | null }>;
    }> = [];

    const today = new Date().toISOString().split('T')[0];

    // Build RBA intelligence snapshot if we have data
    if (rbaIndicators.length) {
      snapshots.push({
        topic: 'RBA Economic Overview',
        summary: `${rbaIndicators.length} RBA indicators tracked across ${new Set(rbaIndicators.map((i: any) => i.category)).size} categories`,
        sentimentLabel: 'informational',
        observationDate: today,
        indicators: rbaIndicators.slice(0, 10).map((i: any) => ({
          name: i.indicatorName,
          value: Number(i.value),
          unit: i.unit,
          changePct: i.changePct != null ? Number(i.changePct) : null,
        })),
      });
    }

    // Build ABS intelligence snapshot if we have data
    if (absIndicators.length) {
      snapshots.push({
        topic: 'ABS Economic Overview',
        summary: `${absIndicators.length} ABS indicators tracked across ${new Set(absIndicators.map((i: any) => i.category)).size} categories`,
        sentimentLabel: 'informational',
        observationDate: today,
        indicators: absIndicators.slice(0, 10).map((i: any) => ({
          name: i.indicatorName,
          value: Number(i.value),
          unit: i.unit,
          changePct: i.changePct != null ? Number(i.changePct) : null,
        })),
      });
    }

    // Build market prices intelligence snapshot
    if (prices.length) {
      snapshots.push({
        topic: 'Market Prices Overview',
        summary: `${prices.length} assets tracked across ${new Set(prices.map((p: any) => p.assetType)).size} asset types`,
        sentimentLabel: 'informational',
        observationDate: today,
        prices: prices.slice(0, 15).map((p: any) => ({
          symbol: p.symbol,
          name: p.name,
          price: Number(p.price),
          changePct: p.changePct != null ? Number(p.changePct) : null,
        })),
      });
    }

    // Build sentiment intelligence snapshots
    for (const s of sentiments) {
      snapshots.push({
        topic: s.topic,
        summary: s.summary ?? '',
        sentimentLabel: s.sentimentLabel ?? 'neutral',
        observationDate: s.observationDate ?? today,
      });
    }

    return snapshots;
  }
}

export const marketCogneeIndexer = new MarketCogneeIndexer();
