/**
 * Market Intelligence Agent (Wave 19)
 *
 * Australian market intelligence analyst powered by real economic data from
 * the RBA, ABS, ASX (Alpha Vantage), and CoinGecko. Provides data-driven
 * market analysis, sentiment research, impact assessments, and comprehensive
 * market briefings using the Cognee knowledge graph for historical context.
 */

import Anthropic from '@anthropic-ai/sdk';
import { ClaudeAgent } from '../base-agent.js';
import { cogneeTools } from '../cognee-tools.js';
import { rbaDataFeed } from '../../rba-data-feed.js';
import { absDataFeed } from '../../abs-data-feed.js';
import { marketPriceService } from '../../market-prices.js';
import { sentimentAnalysisService } from '../../sentiment-analysis.js';
import type { MarketIntelInput, MarketIntelOutput } from '../types.js';

// Market Intelligence Cognee dataset identifiers
const MARKET_DATASETS = {
  marketIntelligence: 'market_intelligence',
  marketSentiment: 'market_sentiment',
  rbaStatistics: 'rba_statistics',
  absStatistics: 'abs_statistics',
  asxMarketData: 'asx_market_data',
} as const;

export class MarketIntelligenceAgent extends ClaudeAgent<MarketIntelInput, MarketIntelOutput> {
  protected systemPrompt = `You are an Australian market intelligence analyst with expertise in macroeconomics, the RBA, ASX, and financial markets. You provide data-driven market analysis using real economic indicators and market data.

Your capabilities:
- Access real-time economic indicators from the RBA and ABS
- Track ASX equity and cryptocurrency prices
- Analyze market sentiment from recent news and social media
- Assess market impact of economic events
- Search indexed market knowledge for historical context
- Generate comprehensive market briefings

Rules:
- Always cite data sources (RBA, ABS, Alpha Vantage, CoinGecko)
- Include observation dates for all data points
- Distinguish between facts (data) and analysis (interpretation)
- Include appropriate disclaimers for forward-looking statements
- This is general market information, not personal financial advice
- Note when data may be delayed or cached
- Warn about limitations of free-tier data sources

Return a JSON object matching the MarketIntelOutput schema with "briefing", "keyIndicators", "marketSentiment", "recommendations", "warnings", and "disclaimer" fields.`;

  protected tools: Anthropic.Tool[] = [
    {
      name: 'get_economic_indicators',
      description:
        'Fetch current economic indicators from the RBA (cash rate, lending rates, CPI, housing) and ABS (unemployment, GDP, wages, CPI, dwelling approvals). Returns the latest values with change percentages.',
      input_schema: {
        type: 'object' as const,
        properties: {
          sources: {
            type: 'array',
            items: { type: 'string', enum: ['rba', 'abs', 'both'] },
            description: 'Which data sources to query (default: both)',
          },
          categories: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Filter by category: interest_rates, inflation, housing, employment, gdp, wages. Leave empty for all.',
          },
          indicatorCode: {
            type: 'string',
            description:
              'Specific indicator code to fetch (e.g. RBA_CASH_RATE, ABS_UNEMPLOYMENT_RATE). If provided, returns just this indicator.',
          },
        },
        required: [],
      },
    },
    {
      name: 'get_market_prices',
      description:
        'Fetch current ASX equity prices (via Alpha Vantage) and cryptocurrency prices (via CoinGecko). Can retrieve individual quotes, batch prices, or historical data.',
      input_schema: {
        type: 'object' as const,
        properties: {
          action: {
            type: 'string',
            enum: ['quote', 'batch', 'history', 'search', 'all'],
            description:
              'Action: quote (single symbol), batch (default watchlist), history (price history), search (find symbols), all (full watchlist refresh)',
          },
          symbol: {
            type: 'string',
            description:
              'Stock symbol (e.g. CBA, BHP) or crypto ID (e.g. bitcoin, ethereum). Required for quote, history.',
          },
          days: {
            type: 'number',
            description: 'Number of days of history to fetch (default: 30). For history action.',
          },
          assetType: {
            type: 'string',
            enum: ['equity', 'cryptocurrency', 'all'],
            description: 'Filter by asset type (default: all)',
          },
        },
        required: [],
      },
    },
    {
      name: 'research_sentiment',
      description:
        'Research market sentiment for a financial topic. Uses AI to analyze recent articles, news, and market commentary, returning a sentiment score, breakdown, and summary.',
      input_schema: {
        type: 'object' as const,
        properties: {
          topic: {
            type: 'string',
            description:
              'Financial topic to research (e.g. "RBA interest rate decision", "Australian property market", "ASX bank stocks")',
          },
        },
        required: ['topic'],
      },
    },
    {
      name: 'analyze_market_impact',
      description:
        'Analyze the potential market impact of a specific economic event on Australian sectors. Returns affected sectors, short/long-term outlooks, and confidence level.',
      input_schema: {
        type: 'object' as const,
        properties: {
          event: {
            type: 'string',
            description:
              'The economic event to analyze (e.g. "RBA raises cash rate by 25bps", "Iron ore price drops 15%")',
          },
          context: {
            type: 'string',
            description:
              'Additional context about the event (e.g. "3rd consecutive increase this year")',
          },
        },
        required: ['event'],
      },
    },
    {
      name: 'generate_market_briefing',
      description:
        'Generate a comprehensive market briefing by orchestrating fetches of economic indicators, market prices, and sentiment data. Returns a unified market overview.',
      input_schema: {
        type: 'object' as const,
        properties: {
          focus: {
            type: 'string',
            description:
              'Focus area for the briefing: general, interest_rates, equities, crypto, property, employment. Default: general.',
          },
          includeIndicators: {
            type: 'boolean',
            description: 'Include RBA/ABS economic indicators (default: true)',
          },
          includePrices: {
            type: 'boolean',
            description: 'Include ASX/crypto prices (default: true)',
          },
          includeSentiment: {
            type: 'boolean',
            description: 'Include sentiment analysis (default: true)',
          },
        },
        required: [],
      },
    },
    {
      name: 'search_market_knowledge',
      description:
        'Search the Cognee knowledge graph for indexed market intelligence, sentiment history, economic indicator trends, and historical market data.',
      input_schema: {
        type: 'object' as const,
        properties: {
          query: {
            type: 'string',
            description: 'Search query about market conditions, trends, or historical data',
          },
          dataset: {
            type: 'string',
            enum: [
              'market_intelligence',
              'market_sentiment',
              'rba_statistics',
              'abs_statistics',
              'asx_market_data',
            ],
            description: 'Knowledge dataset to search (default: market_intelligence)',
          },
        },
        required: ['query'],
      },
    },
  ];

  protected toolHandlers = new Map<string, (input: Record<string, unknown>) => Promise<unknown>>([
    [
      'get_economic_indicators',
      async (input) => {
        const sources = (input.sources as string[] | undefined) ?? ['both'];
        const categories = input.categories as string[] | undefined;
        const indicatorCode = input.indicatorCode as string | undefined;
        const results: Record<string, unknown> = {};

        // If a specific indicator code is requested, try to fetch it directly
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

            // Determine if crypto or ASX
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

        // Fetch economic indicators
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

        // Fetch market prices
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

        // Fetch sentiment
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

  constructor() {
    super('market_intelligence');
  }
}
