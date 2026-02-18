/**
 * Market Intelligence Agent — Tool Handler Implementations
 *
 * Handler functions for fetching economic indicators (RBA/ABS), market prices
 * (ASX/crypto), sentiment research, impact analysis, market briefings, and
 * Cognee knowledge graph search.
 */

import { cogneeTools } from '../../cognee-tools.js';
import { rbaDataFeed } from '../../../rba-data-feed.js';
import { absDataFeed } from '../../../abs-data-feed.js';
import { marketPriceService } from '../../../market-prices.js';
import { sentimentAnalysisService } from '../../../sentiment-analysis.js';
import { MARKET_DATASETS } from './constants.js';

export function buildMarketIntelHandlers(): Map<
  string,
  (input: Record<string, unknown>) => Promise<unknown>
> {
  return new Map<string, (input: Record<string, unknown>) => Promise<unknown>>([
    [
      'get_economic_indicators',
      async (input) => {
        const sources = (input.sources as string[] | undefined) ?? ['both'];
        const categories = input.categories as string[] | undefined;
        const indicatorCode = input.indicatorCode as string | undefined;
        const results: Record<string, unknown> = {};

        if (indicatorCode) {
          if (indicatorCode.startsWith('RBA_')) {
            try {
              if (indicatorCode === 'RBA_CASH_RATE') {
                const cashRate = await rbaDataFeed.getCashRate();
                return { cashRate };
              }
              const history = await rbaDataFeed.getRateHistory(indicatorCode, 6);
              return { indicatorCode, history };
            } catch (err) {
              return { indicatorCode, error: err instanceof Error ? err.message : String(err) };
            }
          }
          if (indicatorCode.startsWith('ABS_')) {
            try {
              const indicator = await absDataFeed.getLatestIndicator(indicatorCode);
              return { indicator };
            } catch (err) {
              return { indicatorCode, error: err instanceof Error ? err.message : String(err) };
            }
          }
        }

        const fetchRba = sources.includes('rba') || sources.includes('both');
        const fetchAbs = sources.includes('abs') || sources.includes('both');

        if (fetchRba) {
          try {
            const rbaResult = await rbaDataFeed.fetchAllTables();
            let indicators = rbaResult.indicators;
            if (categories && categories.length > 0) {
              indicators = indicators.filter((ind) => categories.includes(ind.category));
            }
            results.rba = {
              tablesProcessed: rbaResult.tablesProcessed,
              indicatorCount: indicators.length,
              indicators: indicators.map((ind) => ({
                code: ind.indicatorCode,
                name: ind.indicatorName,
                value: ind.value,
                previousValue: ind.previousValue,
                changePct: ind.changePct,
                unit: ind.unit,
                category: ind.category,
                observationDate: ind.observationDate,
                source: ind.source,
              })),
              errors: rbaResult.errors,
            };
          } catch (err) {
            results.rba = { error: err instanceof Error ? err.message : String(err) };
          }
        }

        if (fetchAbs) {
          try {
            const absResult = await absDataFeed.fetchAllIndicators();
            let indicators = absResult.indicators;
            if (categories && categories.length > 0) {
              indicators = indicators.filter((ind) => categories.includes(ind.category));
            }
            results.abs = {
              dataflowsProcessed: absResult.dataflowsProcessed,
              indicatorCount: indicators.length,
              indicators: indicators.map((ind) => ({
                code: ind.indicatorCode,
                name: ind.indicatorName,
                value: ind.value,
                previousValue: ind.previousValue,
                changePct: ind.changePct,
                unit: ind.unit,
                category: ind.category,
                observationDate: ind.observationDate,
                source: ind.source,
              })),
              errors: absResult.errors,
            };
          } catch (err) {
            results.abs = { error: err instanceof Error ? err.message : String(err) };
          }
        }

        return results;
      },
    ],
    [
      'get_market_prices',
      async (input) => {
        const action = (input.action as string) ?? 'all';
        const symbol = input.symbol as string | undefined;
        const days = (input.days as number) ?? 30;
        const assetType = input.assetType as string | undefined;

        switch (action) {
          case 'quote': {
            if (!symbol) return { error: 'Symbol is required for quote action' };

            const cryptoIds = [
              'bitcoin',
              'ethereum',
              'solana',
              'ripple',
              'cardano',
              'polkadot',
              'chainlink',
              'avalanche-2',
            ];
            const isCrypto =
              cryptoIds.includes(symbol.toLowerCase()) ||
              ['BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOT', 'LINK', 'AVAX'].includes(
                symbol.toUpperCase(),
              );

            if (isCrypto) {
              const coinId =
                cryptoIds.find((c) => c === symbol.toLowerCase()) ?? symbol.toLowerCase();
              const price = await marketPriceService.fetchCryptoPrice(coinId);
              return price ?? { error: `No price found for ${symbol}` };
            }

            const quote = await marketPriceService.fetchASXQuote(symbol);
            return quote ?? { error: `No quote found for ${symbol}` };
          }

          case 'history': {
            if (!symbol) return { error: 'Symbol is required for history action' };
            const history = await marketPriceService.getPriceHistory(symbol, days);
            return {
              symbol,
              days,
              dataPoints: history.length,
              prices: history.slice(0, 60).map((p) => ({
                date: p.observationDate,
                price: p.price,
                high: p.dayHigh,
                low: p.dayLow,
                volume: p.volume,
                changePct: p.changePct,
              })),
            };
          }

          case 'search': {
            if (!symbol) return { error: 'Query text is required for search action' };
            const results = await marketPriceService.searchSymbol(symbol);
            return { query: symbol, results };
          }

          case 'batch': {
            const latest = await marketPriceService.getLatestPrices(
              assetType !== 'all' ? assetType : undefined,
            );
            return {
              count: latest.length,
              prices: latest.map((p) => ({
                symbol: p.symbol,
                name: p.name,
                price: p.price,
                changePct: p.changePct,
                assetType: p.assetType,
                observationDate: p.observationDate,
              })),
            };
          }

          case 'all':
          default: {
            const allPrices = await marketPriceService.getAllPrices();
            return {
              asx: {
                count: allPrices.asx.length,
                prices: allPrices.asx.map((p) => ({
                  symbol: p.symbol,
                  name: p.name,
                  price: p.price,
                  changePct: p.changePct,
                  previousClose: p.previousClose,
                  volume: p.volume,
                  observationDate: p.observationDate,
                })),
              },
              crypto: {
                count: allPrices.crypto.length,
                prices: allPrices.crypto.map((p) => ({
                  symbol: p.symbol,
                  name: p.name,
                  price: p.price,
                  changePct: p.changePct,
                  marketCap: p.marketCap,
                  volume: p.volume,
                  observationDate: p.observationDate,
                })),
              },
            };
          }
        }
      },
    ],
    [
      'research_sentiment',
      async (input) => {
        const topic = input.topic as string;
        try {
          const snapshot = await sentimentAnalysisService.getSentimentSnapshot(topic);
          return {
            topic: snapshot.topic,
            sentimentScore: snapshot.sentimentScore,
            sentimentLabel: snapshot.sentimentLabel,
            confidence: snapshot.confidence,
            positiveCount: snapshot.positiveCount,
            negativeCount: snapshot.negativeCount,
            neutralCount: snapshot.neutralCount,
            totalPosts: snapshot.totalPosts,
            topPositive: snapshot.topPositive,
            topNegative: snapshot.topNegative,
            summary: snapshot.summary,
            sources: snapshot.sources,
            observationDate: snapshot.observationDate,
          };
        } catch (err) {
          return {
            topic,
            error: err instanceof Error ? err.message : String(err),
            sentimentScore: 0,
            sentimentLabel: 'neutral',
            confidence: 0,
          };
        }
      },
    ],
    [
      'analyze_market_impact',
      async (input) => {
        const event = input.event as string;
        const context = (input.context as string) ?? '';
        try {
          const impact = await sentimentAnalysisService.analyzeMarketImpact(event, context);
          return {
            event: impact.event,
            impactSummary: impact.impactSummary,
            affectedSectors: impact.affectedSectors,
            shortTermOutlook: impact.shortTermOutlook,
            longTermOutlook: impact.longTermOutlook,
            confidence: impact.confidence,
            sources: impact.sources,
          };
        } catch (err) {
          return {
            event,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      },
    ],
    [
      'generate_market_briefing',
      async (input) => {
        const includeIndicators = (input.includeIndicators as boolean) ?? true;
        const includePrices = (input.includePrices as boolean) ?? true;
        const includeSentiment = (input.includeSentiment as boolean) ?? true;
        const focus = (input.focus as string) ?? 'general';

        const briefing: Record<string, unknown> = { focus, generatedAt: new Date().toISOString() };

        if (includeIndicators) {
          try {
            const cashRate = await rbaDataFeed.getCashRate();
            briefing.cashRate = cashRate;
          } catch {
            briefing.cashRate = { error: 'Unable to fetch RBA cash rate' };
          }

          try {
            const absIndicators = await absDataFeed.fetchAllIndicators();
            briefing.absIndicators = {
              count: absIndicators.indicators.length,
              indicators: absIndicators.indicators.map((ind) => ({
                code: ind.indicatorCode,
                name: ind.indicatorName,
                value: ind.value,
                changePct: ind.changePct,
                unit: ind.unit,
                observationDate: ind.observationDate,
              })),
            };
          } catch {
            briefing.absIndicators = { error: 'Unable to fetch ABS indicators' };
          }
        }

        if (includePrices) {
          try {
            const allPrices = await marketPriceService.getAllPrices();
            briefing.asxPrices = allPrices.asx.slice(0, 10).map((p) => ({
              symbol: p.symbol,
              name: p.name,
              price: p.price,
              changePct: p.changePct,
            }));
            briefing.cryptoPrices = allPrices.crypto.slice(0, 5).map((p) => ({
              symbol: p.symbol,
              name: p.name,
              price: p.price,
              changePct: p.changePct,
            }));
          } catch {
            briefing.prices = { error: 'Unable to fetch market prices' };
          }
        }

        if (includeSentiment) {
          const sentimentTopic =
            focus === 'general' ? 'Australian financial market' : `Australian ${focus} market`;
          try {
            const sentiment = await sentimentAnalysisService.getSentimentSnapshot(sentimentTopic);
            briefing.sentiment = {
              topic: sentiment.topic,
              score: sentiment.sentimentScore,
              label: sentiment.sentimentLabel,
              confidence: sentiment.confidence,
              summary: sentiment.summary,
            };
          } catch {
            briefing.sentiment = { error: 'Unable to fetch sentiment' };
          }
        }

        return briefing;
      },
    ],
    [
      'search_market_knowledge',
      async (input) => {
        const query = input.query as string;
        const dataset = (input.dataset as string) ?? 'market_intelligence';
        const datasetKey =
          dataset === 'market_sentiment'
            ? MARKET_DATASETS.marketSentiment
            : dataset === 'rba_statistics'
              ? MARKET_DATASETS.rbaStatistics
              : dataset === 'abs_statistics'
                ? MARKET_DATASETS.absStatistics
                : dataset === 'asx_market_data'
                  ? MARKET_DATASETS.asxMarketData
                  : MARKET_DATASETS.marketIntelligence;
        try {
          const results = await cogneeTools.search(query, datasetKey, 'CHUNKS');
          return { results, count: results.length };
        } catch {
          return { results: [], count: 0, error: 'Knowledge search unavailable' };
        }
      },
    ],
  ]);
}
